import * as k8s from "@kubernetes/client-node";
import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getKubeConfig, getCoreApi, getRawKubeConfig } from "./client";
import { NODE_SCAN_SCRIPT } from "./node-scan-script";
import type { TLSScanResults, TLSIPResult, TLSPortResult } from "@/types";

// ── Raw types from bash script output ───────────────────────────────────

interface RawCipherEntry { name: string; version: string; }
interface RawPortResult {
  port: number; protocol: string; listen_address: string; process: string;
  status: string; reason: string; tls_versions: string[]; tls_ciphers: RawCipherEntry[];
  key_exchange_group?: string; key_exchange_bits?: number;
  signature_algorithm?: string; alpn_protocol?: string;
}
interface RawNetnsResult { netns: string; container_ids: string[]; ips: string[]; ports: RawPortResult[]; }
interface RawNodeResults { node: string; scan_results: RawNetnsResult[]; errors: unknown[]; scanned_netns: number; total_netns: number; }

// ── OpenShift component extraction (mirrors openshift/tls-scanner k8s.go) ──

function extractComponentNameFromImage(image: string): string {
  const parts = image.split("/");
  let imageName = parts[parts.length - 1] || "unknown";
  if (imageName.includes(":")) imageName = imageName.split(":")[0];
  if (imageName.includes("@")) imageName = imageName.split("@")[0];
  return imageName || "unknown";
}

function extractRegistryFromImage(image: string): string {
  if (image.includes("quay.io")) return "quay.io";
  if (image.includes("registry.redhat.com")) return "registry.redhat.com";
  if (image.includes("image-registry.openshift-image-registry.svc")) return "internal-registry";
  return image.split("/")[0] || "unknown";
}

function extractMaintainerFromNamespace(ns: string): string {
  if (ns.startsWith("openshift-")) return "openshift";
  if (ns.startsWith("kube-")) return "kubernetes";
  return "unknown";
}

function extractOpenshiftComponent(
  image: string,
  labels: Record<string, string>,
  containerName: string,
  namespace: string,
): { component: string; sourceLocation: string; maintainer: string } {
  // Step 1: try to derive component from the container image (primary method)
  if (image) {
    if (image.includes("quay.io/openshift-release-dev")) {
      const sourceLocation = "quay.io/openshift-release-dev";
      const maintainer = "openshift";
      // Try known patterns in the image reference
      if (image.includes("oauth-openshift")) return { component: "oauth-openshift", sourceLocation, maintainer };
      if (image.includes("apiserver")) return { component: "openshift-apiserver", sourceLocation, maintainer };
      if (image.includes("controller-manager")) return { component: "openshift-controller-manager", sourceLocation, maintainer };
      // For SHA-based release images, fall through to labels
    }

    if (image.includes("image-registry.openshift-image-registry.svc")) {
      const parts = image.split("/");
      if (parts.length >= 3) {
        return {
          component: extractComponentNameFromImage(image),
          sourceLocation: "internal-registry",
          maintainer: "user",
        };
      }
    }

    if (image.includes("quay.io") || image.includes("registry.redhat.com")) {
      const imgComponent = extractComponentNameFromImage(image);
      if (imgComponent && imgComponent !== "unknown") {
        return {
          component: imgComponent,
          sourceLocation: extractRegistryFromImage(image),
          maintainer: "redhat",
        };
      }
    }
  }

  // Step 2: fall back to pod labels (same priority as upstream extractComponentFromPod)
  const labelComponent =
    labels["app"] ||
    labels["component"] ||
    labels["app.kubernetes.io/name"] ||
    "";

  if (labelComponent) {
    return {
      component: labelComponent,
      sourceLocation: image ? extractRegistryFromImage(image) : "unknown",
      maintainer: extractMaintainerFromNamespace(namespace),
    };
  }

  // Step 3: fall back to container name, then image name
  const fallback = containerName || extractComponentNameFromImage(image || "");
  if (fallback && fallback !== "unknown") {
    return {
      component: fallback,
      sourceLocation: image ? extractRegistryFromImage(image) : "unknown",
      maintainer: extractMaintainerFromNamespace(namespace),
    };
  }

  return { component: "", sourceLocation: "unknown", maintainer: "unknown" };
}

// ── Cipher grading ──────────────────────────────────────────────────────

const GRADE_D = [/RC4/i, /DES/i, /3DES/i, /EXPORT/i, /NULL/i, /IDEA/i, /SEED/i, /anon/i];
const GRADE_A = [/GCM/i, /CHACHA20/i, /CCM/i, /^TLS_/];

function gradeCipher(name: string, version: string): string {
  if (GRADE_D.some((p) => p.test(name))) return "D";
  if (version === "TLSv1.3") return "A";
  if (GRADE_A.some((p) => p.test(name))) return /ECDHE|DHE/.test(name) ? "A" : "B";
  if (/ECDHE|DHE/.test(name)) return "B";
  return "C";
}

// ── Per-node process state ──────────────────────────────────────────────

interface NodeProc {
  proc: ChildProcess;
  stdout: string;
  stderr: string;
  done: boolean;
  exitCode: number | null;
  nodeName: string;
}

export interface NodeProgressEntry {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  scannedNetns: number;
  totalNetns: number;
}

interface ScanState {
  id: string;
  nodeProcs: Map<string, NodeProc>;
  kubeconfigPath: string;
  startTime: number;
}

// ── Scan history ────────────────────────────────────────────────────────

export interface ScanHistoryEntry {
  id: string;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  nodeCount: number;
  results?: TLSScanResults;
  logs: string;
}

const MAX_HISTORY = 10;

interface TLSScanGlobal {
  __tlsScanState?: ScanState | null;
  __tlsScanHistory?: ScanHistoryEntry[];
}
const g = globalThis as unknown as TLSScanGlobal;

function getState(): ScanState | null { return g.__tlsScanState ?? null; }
function setState(s: ScanState | null) { g.__tlsScanState = s; }
function getHistory(): ScanHistoryEntry[] {
  if (!g.__tlsScanHistory) g.__tlsScanHistory = [];
  return g.__tlsScanHistory;
}

function upsertHistory(entry: ScanHistoryEntry) {
  const history = getHistory();
  const idx = history.findIndex((h) => h.id === entry.id);
  if (idx >= 0) {
    history[idx] = entry;
  } else {
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();
  }
}

function generateScanId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Parse per-node progress from stdout ─────────────────────────────────

function parseNodeProgress(np: NodeProc): NodeProgressEntry {
  const name = np.nodeName;
  const hasResults = np.stdout.includes("===RESULTS_JSON_END===");

  if (hasResults) {
    const totalMatch = np.stdout.match(/-> (\d+) unique network namespaces/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    return { name, status: "completed", scannedNetns: total, totalNetns: total };
  }

  if (np.done && !hasResults) {
    return { name, status: "failed", scannedNetns: 0, totalNetns: 0 };
  }

  const totalMatch = np.stdout.match(/-> (\d+) unique network namespaces/);
  const totalNetns = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  if (totalNetns === 0) {
    return { name, status: np.stdout.length > 0 ? "running" : "pending", scannedNetns: 0, totalNetns: 0 };
  }

  const scannedMatches = np.stdout.match(/\[\d+\/\d+\] netns/g);
  const scannedNetns = scannedMatches ? scannedMatches.length : 0;

  return { name, status: "running", scannedNetns, totalNetns };
}

// ── Launch scan ─────────────────────────────────────────────────────────

export async function launchTLSScan(): Promise<{ scanId: string; namespace: string; nodeCount: number }> {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  const rawKc = getRawKubeConfig();
  if (!rawKc) throw new Error("Raw kubeconfig not available");

  const tmpDir = mkdtempSync(join(tmpdir(), "tls-scan-"));
  const kcPath = join(tmpDir, "kubeconfig");
  writeFileSync(kcPath, rawKc, { mode: 0o600 });

  const coreApi = getCoreApi();
  const nodeList = await coreApi.listNode();
  const nodes = nodeList.items
    .filter((n) => {
      const taints = n.spec?.taints || [];
      return !taints.some((t) => t.effect === "NoSchedule" && t.key === "node.kubernetes.io/unschedulable");
    })
    .map((n) => n.metadata?.name || "")
    .filter(Boolean);

  if (nodes.length === 0) {
    unlinkSync(kcPath);
    throw new Error("No schedulable nodes found");
  }

  // Finalize any previous active scan as cancelled
  const prev = getState();
  if (prev) {
    for (const np of prev.nodeProcs.values()) {
      if (!np.done) try { np.proc.kill(); } catch { /* ok */ }
    }
    try { unlinkSync(prev.kubeconfigPath); } catch { /* ok */ }
    const prevHistory = getHistory().find((h) => h.id === prev.id);
    if (prevHistory && prevHistory.status === "running") {
      prevHistory.status = "cancelled";
      prevHistory.endTime = Date.now();
    }
  }

  const scanId = generateScanId();
  const nodeProcs = new Map<string, NodeProc>();

  for (const nodeName of nodes) {
    const proc = spawn("oc", [
      "debug", `node/${nodeName}`,
      `--kubeconfig=${kcPath}`,
      "--no-tty",
      "--", "chroot", "/host", "bash", "-s",
    ], {
      env: { ...process.env, KUBECONFIG: kcPath, NODE_NAME: nodeName },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const np: NodeProc = { proc, stdout: "", stderr: "", done: false, exitCode: null, nodeName };

    proc.stdout?.on("data", (chunk: Buffer) => { np.stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { np.stderr += chunk.toString(); });
    proc.on("close", (code) => { np.done = true; np.exitCode = code; });
    proc.on("error", (err) => { np.done = true; np.exitCode = -1; np.stderr += `\nProcess error: ${err.message}`; });

    proc.stdin?.write(`export NODE_NAME="${nodeName}"\n`);
    proc.stdin?.write(NODE_SCAN_SCRIPT);
    proc.stdin?.end();

    nodeProcs.set(nodeName, np);
  }

  setState({ id: scanId, nodeProcs, kubeconfigPath: kcPath, startTime: Date.now() });

  upsertHistory({
    id: scanId,
    startTime: Date.now(),
    status: "running",
    nodeCount: nodes.length,
    logs: "",
  });

  return { scanId, namespace: "oc-debug", nodeCount: nodes.length };
}

// ── Poll status ─────────────────────────────────────────────────────────

export interface ScanStatusResult {
  status: "running" | "completed" | "failed" | "not_found";
  scanId?: string;
  results?: TLSScanResults;
  logs?: string;
  progress?: string;
  nodeProgress?: NodeProgressEntry[];
}

export async function getScanStatus(): Promise<ScanStatusResult> {
  const state = getState();
  if (!state) return { status: "not_found" };

  let logs = "";
  let completedNodes = 0;
  let failedNodes = 0;
  let runningNodes = 0;
  const total = state.nodeProcs.size;
  const finishedProcs: NodeProc[] = [];
  const nodeProgress: NodeProgressEntry[] = [];

  for (const [nodeName, np] of state.nodeProcs) {
    nodeProgress.push(parseNodeProgress(np));

    let displayLog = np.stdout;
    const jsonStart = displayLog.indexOf("===RESULTS_JSON_START===");
    const jsonEnd = displayLog.indexOf("===RESULTS_JSON_END===");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      displayLog = displayLog.substring(0, jsonStart) + displayLog.substring(jsonEnd + "===RESULTS_JSON_END===".length);
    }

    logs += `=== ${nodeName} ===\n`;
    if (displayLog.trim()) {
      logs += displayLog.trim() + "\n";
    }
    if (np.stderr.trim()) {
      const stderrLines = np.stderr.split("\n").filter((l) =>
        !l.includes("Starting pod/") && !l.includes("Removing debug pod") &&
        !l.includes("Warning: would violate") && !l.includes("To use host binaries") &&
        !l.includes("Pod IP:") && !l.includes("command prompt") && l.trim()
      ).join("\n");
      if (stderrLines.trim()) {
        logs += `${stderrLines.trim()}\n`;
      }
    }
    logs += "\n";

    if (np.done) {
      if (np.stdout.includes("===RESULTS_JSON_END===")) {
        completedNodes++;
        finishedProcs.push(np);
      } else {
        failedNodes++;
      }
    } else {
      if (np.stdout.includes("===RESULTS_JSON_END===")) {
        completedNodes++;
        finishedProcs.push(np);
      } else {
        runningNodes++;
      }
    }
  }

  const progress = `${completedNodes} of ${total} nodes complete${runningNodes > 0 ? `, ${runningNodes} scanning` : ""}${failedNodes > 0 ? `, ${failedNodes} failed` : ""}`;

  if (runningNodes > 0) {
    return { status: "running", scanId: state.id, logs, progress, nodeProgress };
  }

  if (completedNodes === 0 && failedNodes > 0) {
    upsertHistory({
      id: state.id, startTime: state.startTime, endTime: Date.now(),
      status: "failed", nodeCount: total, logs,
    });
    return { status: "failed", scanId: state.id, logs, progress, nodeProgress };
  }

  // All done — collect and merge results
  try {
    const results = await collectAndMergeResults(finishedProcs);
    upsertHistory({
      id: state.id, startTime: state.startTime, endTime: Date.now(),
      status: "completed", nodeCount: total, results, logs,
    });
    return { status: "completed", scanId: state.id, results, logs, progress, nodeProgress };
  } catch (err) {
    console.error("Failed to collect results:", err);
    upsertHistory({
      id: state.id, startTime: state.startTime, endTime: Date.now(),
      status: "failed", nodeCount: total, logs,
    });
    return { status: "completed", scanId: state.id, logs, progress, nodeProgress };
  }
}

// ── Collect and merge results ───────────────────────────────────────────

async function collectAndMergeResults(finishedProcs: NodeProc[]): Promise<TLSScanResults> {
  const allNodeResults: RawNodeResults[] = [];
  for (const np of finishedProcs) {
    const startMarker = "===RESULTS_JSON_START===";
    const endMarker = "===RESULTS_JSON_END===";
    const startIdx = np.stdout.indexOf(startMarker);
    const endIdx = np.stdout.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStr = np.stdout.substring(startIdx + startMarker.length, endIdx).trim();
      if (jsonStr) {
        try {
          allNodeResults.push(JSON.parse(jsonStr) as RawNodeResults);
        } catch (err) {
          console.error(`Failed to parse JSON from ${np.nodeName}:`, err);
        }
      }
    }
  }

  console.log(`[TLS] collectAndMergeResults: ${finishedProcs.length} finished nodes, parsed ${allNodeResults.length} JSON results`);
  for (const nr of allNodeResults) {
    console.log(`[TLS]   node=${nr.node} scan_results=${nr.scan_results.length} scanned_netns=${nr.scanned_netns}`);
    if (nr.scan_results.length > 0) {
      const s = nr.scan_results[0];
      console.log(`[TLS]     first entry: ips=[${s.ips.join(",")}] cids=[${s.container_ids.slice(0, 2).map(c => `${c.substring(0, 16)}...(len=${c.length})`).join(", ")}] ports=${s.ports.length}`);
    }
  }

  type PodEntry = {
    name: string; namespace: string; image: string;
    containers: string[]; component: string;
    sourceLocation: string; maintainer: string;
  };
  const containerMap = new Map<string, PodEntry>();
  let podCount = 0;

  try {
    const coreApi = getCoreApi();
    const allPods = await coreApi.listPodForAllNamespaces();
    podCount = allPods.items.length;
    console.log(`[TLS] listPodForAllNamespaces returned ${podCount} pods`);

    let cidCount = 0;
    for (const pod of allPods.items) {
      const podName = pod.metadata?.name || "";
      const podNs = pod.metadata?.namespace || "";
      const labels = pod.metadata?.labels || {};
      const statuses = pod.status?.containerStatuses || [];
      const containerNames = statuses.map((c) => c.name);
      const firstImage = statuses[0]?.image || "";
      const firstContainerName = pod.spec?.containers?.[0]?.name || containerNames[0] || "";

      const { component, sourceLocation, maintainer } =
        extractOpenshiftComponent(firstImage, labels, firstContainerName, podNs);

      const entry: PodEntry = {
        name: podName, namespace: podNs, image: firstImage,
        containers: containerNames, component, sourceLocation, maintainer,
      };

      for (const cs of statuses) {
        const cid = cs.containerID;
        if (cid) {
          const rawCid = cid.replace(/^[a-z0-9_-]+:\/\//, "");
          containerMap.set(rawCid, entry);
          containerMap.set(rawCid.substring(0, 12), entry);
          cidCount++;
          if (cidCount <= 3) {
            console.log(`[TLS]   sample k8s cid: raw="${cid}" -> stripped="${rawCid}" (len=${rawCid.length}), short="${rawCid.substring(0, 12)}" pod=${podNs}/${podName}`);
          }
        }
      }
    }
    console.log(`[TLS] containerMap: ${containerMap.size} entries from ${cidCount} container statuses across ${podCount} pods`);
  } catch (err) {
    console.error("[TLS] FAILED to list pods for containerID mapping:", err);
  }

  const ipResults: TLSIPResult[] = [];
  let totalIPs = 0;
  let matched = 0;
  let loggedMisses = 0;

  for (const nodeResult of allNodeResults) {
    for (const netnsResult of nodeResult.scan_results) {
      totalIPs++;

      let podInfo: PodEntry | undefined;
      for (const cid of netnsResult.container_ids) {
        podInfo = containerMap.get(cid) || containerMap.get(cid.substring(0, 12));
        if (podInfo) break;
      }

      if (podInfo) {
        matched++;
      } else if (loggedMisses < 5) {
        loggedMisses++;
        const sampleCids = netnsResult.container_ids.slice(0, 2);
        console.log(`[TLS]   MISS ip=${netnsResult.ips[0]} cids=[${sampleCids.map(c => `"${c}" (len=${c.length})`).join(", ")}] short=[${sampleCids.map(c => `"${c.substring(0, 12)}"`).join(", ")}]`);
      }

      const primaryIP = netnsResult.ips[0] || "";

      const portResults: TLSPortResult[] = netnsResult.ports.map((rawPort) => {
        const cipherNames = rawPort.tls_ciphers.map((c) => c.name);
        const cipherStrength: Record<string, string> = {};
        for (const c of rawPort.tls_ciphers) {
          cipherStrength[c.name] = gradeCipher(c.name, c.version);
        }

        const kexGroup = rawPort.key_exchange_group || undefined;
        const isPqc = kexGroup
          ? /MLKEM|Kyber|BIKE|HQC|NTRU|Frodo/i.test(kexGroup)
          : false;
        const hasT13 = rawPort.tls_ciphers.some((c) => c.version === "TLSv1.3");
        const quantumReady = isPqc || (hasT13 && !kexGroup);

        const handshake = (kexGroup || rawPort.signature_algorithm || rawPort.alpn_protocol)
          ? {
              key_exchange_group: kexGroup,
              key_exchange_bits: rawPort.key_exchange_bits || undefined,
              signature_algorithm: rawPort.signature_algorithm || undefined,
              alpn_protocol: rawPort.alpn_protocol || undefined,
              is_pqc: isPqc,
            }
          : undefined;

        return {
          port: rawPort.port,
          protocol: rawPort.protocol || "tcp",
          state: rawPort.status === "OK" ? "open" : rawPort.status.toLowerCase(),
          service: rawPort.process || "",
          process_name: rawPort.process || undefined,
          container_id: netnsResult.container_ids[0] || undefined,
          quantum_ready: quantumReady,
          tls_versions: rawPort.tls_versions,
          tls_ciphers: cipherNames.length > 0 ? cipherNames : undefined,
          tls_cipher_strength: Object.keys(cipherStrength).length > 0 ? cipherStrength : undefined,
          handshake,
          status: rawPort.status as TLSPortResult["status"],
          reason: rawPort.reason || undefined,
          listen_address: rawPort.listen_address || undefined,
        } satisfies TLSPortResult;
      });

      ipResults.push({
        ip: primaryIP,
        status: portResults.some((p) => p.status === "OK") ? "up" : "no_tls",
        open_ports: portResults.map((p) => p.port),
        port_results: portResults,
        node: nodeResult.node,
        container_ids: netnsResult.container_ids,
        pod: podInfo ? {
          Name: podInfo.name, Namespace: podInfo.namespace,
          Image: podInfo.image, Containers: podInfo.containers, IPs: netnsResult.ips,
        } : undefined,
        openshift_component: podInfo?.component ? {
          component: podInfo.component,
          source_location: podInfo.sourceLocation,
          maintainer_component: podInfo.maintainer,
          is_bundle: false,
        } : undefined,
      });
    }
  }

  console.log(`[TLS] Matched ${matched}/${totalIPs} network namespaces to pods (${podCount} pods in cluster, ${containerMap.size} container ID entries)`);

  return {
    timestamp: new Date().toISOString(),
    total_ips: totalIPs,
    scanned_ips: totalIPs,
    ip_results: ipResults,
    scan_errors: [],
  };
}

// ── Cleanup ─────────────────────────────────────────────────────────────

export async function cleanupScan(): Promise<void> {
  const state = getState();
  if (!state) return;

  for (const np of state.nodeProcs.values()) {
    if (!np.done) {
      try { np.proc.kill(); } catch { /* ok */ }
    }
  }

  try { unlinkSync(state.kubeconfigPath); } catch { /* ok */ }

  const histEntry = getHistory().find((h) => h.id === state.id);
  if (histEntry && histEntry.status === "running") {
    histEntry.status = "cancelled";
    histEntry.endTime = Date.now();
  }

  setState(null);
}

export function getActiveScan(): ScanState | null {
  return getState();
}

// ── History accessors ───────────────────────────────────────────────────

export function getScanHistory(): Omit<ScanHistoryEntry, "results">[] {
  return getHistory().map(({ results: _r, ...rest }) => rest);
}

export function getScanById(id: string): ScanHistoryEntry | undefined {
  return getHistory().find((h) => h.id === id);
}
