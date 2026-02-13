import type { WorkloadResource, NamespacePodSecurity, RiskFinding } from "@/types";

// --- PSA Compliance Result ---

export interface PSAComplianceResult {
  workload: { kind: string; name: string; namespace: string };
  enforceLevel: string | undefined;
  auditLevel: string | undefined;
  warnLevel: string | undefined;
  enforceViolations: string[];
  auditViolations: string[];
  warnViolations: string[];
}

// --- Baseline allowed capabilities (everything else is a violation) ---

const BASELINE_ALLOWED_CAPS = new Set([
  "AUDIT_WRITE", "CHOWN", "DAC_OVERRIDE", "FOWNER", "FSETID", "KILL",
  "MKNOD", "NET_BIND_SERVICE", "SETFCAP", "SETGID", "SETPCAP", "SETUID",
  "SYS_CHROOT",
]);

// --- Check functions ---

function checkBaselineViolations(w: WorkloadResource): string[] {
  const violations: string[] = [];
  const psp = w.podSecurityPosture;

  // Host namespaces
  if (psp.hostNetwork) violations.push("Uses hostNetwork");
  if (psp.hostPID) violations.push("Uses hostPID");
  if (psp.hostIPC) violations.push("Uses hostIPC");

  for (const c of w.containers) {
    const sc = c.securityContext;

    // Privileged
    if (sc?.privileged) {
      violations.push(`Container "${c.name}": runs in privileged mode`);
    }

    // Host ports
    for (const p of c.ports) {
      if (p.hostPort) {
        violations.push(`Container "${c.name}": uses hostPort ${p.hostPort}`);
      }
    }

    // Capabilities beyond baseline-allowed set
    const addedCaps = sc?.capabilities?.add || [];
    for (const cap of addedCaps) {
      if (cap === "ALL" || !BASELINE_ALLOWED_CAPS.has(cap)) {
        violations.push(`Container "${c.name}": adds capability ${cap}`);
      }
    }
  }

  // Init containers
  for (const c of w.initContainers || []) {
    const sc = c.securityContext;
    if (sc?.privileged) {
      violations.push(`Init container "${c.name}": runs in privileged mode`);
    }
    const addedCaps = sc?.capabilities?.add || [];
    for (const cap of addedCaps) {
      if (cap === "ALL" || !BASELINE_ALLOWED_CAPS.has(cap)) {
        violations.push(`Init container "${c.name}": adds capability ${cap}`);
      }
    }
  }

  return violations;
}

function checkRestrictedViolations(w: WorkloadResource): string[] {
  // Restricted includes all baseline violations plus additional checks
  const violations = checkBaselineViolations(w);

  for (const c of w.containers) {
    const sc = c.securityContext;

    // Must run as non-root
    if (!sc?.runAsNonRoot && w.podSecurityPosture.securityContext?.runAsNonRoot !== true) {
      violations.push(`Container "${c.name}": runAsNonRoot is not set to true`);
    }

    // Must set runAsUser to non-zero (if explicitly 0)
    if (sc?.runAsUser === 0) {
      violations.push(`Container "${c.name}": runs as root (UID 0)`);
    }

    // Must drop ALL capabilities
    const droppedCaps = sc?.capabilities?.drop || [];
    if (!droppedCaps.includes("ALL") && !droppedCaps.includes("all")) {
      violations.push(`Container "${c.name}": does not drop ALL capabilities`);
    }

    // allowPrivilegeEscalation must be false
    if (sc?.allowPrivilegeEscalation !== false) {
      violations.push(`Container "${c.name}": allowPrivilegeEscalation is not false`);
    }

    // Seccomp profile must be RuntimeDefault or Localhost
    const seccomp = sc?.seccompProfile?.type;
    const podSeccomp = w.podSecurityPosture.securityContext?.seccompProfile?.type;
    const effectiveSeccomp = seccomp || podSeccomp;
    if (!effectiveSeccomp || effectiveSeccomp === "Unconfined") {
      violations.push(`Container "${c.name}": no seccomp profile or Unconfined`);
    }
  }

  // Init containers restricted checks
  for (const c of w.initContainers || []) {
    const sc = c.securityContext;

    if (!sc?.runAsNonRoot && w.podSecurityPosture.securityContext?.runAsNonRoot !== true) {
      violations.push(`Init container "${c.name}": runAsNonRoot is not set to true`);
    }
    if (sc?.runAsUser === 0) {
      violations.push(`Init container "${c.name}": runs as root (UID 0)`);
    }
    const droppedCaps = sc?.capabilities?.drop || [];
    if (!droppedCaps.includes("ALL") && !droppedCaps.includes("all")) {
      violations.push(`Init container "${c.name}": does not drop ALL capabilities`);
    }
    if (sc?.allowPrivilegeEscalation !== false) {
      violations.push(`Init container "${c.name}": allowPrivilegeEscalation is not false`);
    }
  }

  return violations;
}

function getViolationsForLevel(level: string | undefined, w: WorkloadResource): string[] {
  if (!level || level === "privileged") return [];
  if (level === "baseline") return checkBaselineViolations(w);
  if (level === "restricted") return checkRestrictedViolations(w);
  return [];
}

// --- Main analysis function ---

export function analyzePSACompliance(
  workloads: WorkloadResource[],
  psaData: NamespacePodSecurity[]
): PSAComplianceResult[] {
  const psaMap = new Map<string, NamespacePodSecurity>();
  for (const psa of psaData) {
    psaMap.set(psa.namespace, psa);
  }

  const results: PSAComplianceResult[] = [];

  for (const w of workloads) {
    const psa = psaMap.get(w.namespace);

    const enforceLevel = psa?.enforce;
    const auditLevel = psa?.audit;
    const warnLevel = psa?.warn;

    const enforceViolations = getViolationsForLevel(enforceLevel, w);
    const auditViolations = getViolationsForLevel(auditLevel, w);
    const warnViolations = getViolationsForLevel(warnLevel, w);

    // Only include workloads that have at least one violation at any level
    if (enforceViolations.length > 0 || auditViolations.length > 0 || warnViolations.length > 0) {
      results.push({
        workload: { kind: w.kind, name: w.name, namespace: w.namespace },
        enforceLevel,
        auditLevel,
        warnLevel,
        enforceViolations,
        auditViolations,
        warnViolations,
      });
    }
  }

  return results;
}

// --- Convert enforce violations to RiskFindings for the "All Findings" tab ---

export function psaComplianceToFindings(results: PSAComplianceResult[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const r of results) {
    if (r.enforceViolations.length > 0) {
      findings.push({
        id: `psa-enforce-${r.workload.namespace}-${r.workload.kind}-${r.workload.name}`,
        level: "critical",
        domain: "pod-security",
        title: `${r.workload.kind} "${r.workload.name}" violates PSA enforce="${r.enforceLevel}"`,
        description: `This workload has ${r.enforceViolations.length} violation(s) against the namespace enforce policy. It would be rejected by the admission controller: ${r.enforceViolations.join("; ")}.`,
        resource: `${r.workload.kind}/${r.workload.namespace}/${r.workload.name}`,
        namespace: r.workload.namespace,
        recommendation: "Fix the security context to comply with the namespace PSA enforce level, or adjust the namespace policy if the workload requires these capabilities.",
      });
    }

    if (r.auditViolations.length > 0) {
      findings.push({
        id: `psa-audit-${r.workload.namespace}-${r.workload.kind}-${r.workload.name}`,
        level: "medium",
        domain: "pod-security",
        title: `${r.workload.kind} "${r.workload.name}" triggers PSA audit="${r.auditLevel}"`,
        description: `This workload generates ${r.auditViolations.length} audit log entries: ${r.auditViolations.join("; ")}.`,
        resource: `${r.workload.kind}/${r.workload.namespace}/${r.workload.name}`,
        namespace: r.workload.namespace,
        recommendation: "Review audit violations. These indicate the workload would fail if the audit level were promoted to enforce.",
      });
    }

    if (r.warnViolations.length > 0) {
      findings.push({
        id: `psa-warn-${r.workload.namespace}-${r.workload.kind}-${r.workload.name}`,
        level: "low",
        domain: "pod-security",
        title: `${r.workload.kind} "${r.workload.name}" triggers PSA warn="${r.warnLevel}"`,
        description: `This workload triggers ${r.warnViolations.length} warning(s): ${r.warnViolations.join("; ")}.`,
        resource: `${r.workload.kind}/${r.workload.namespace}/${r.workload.name}`,
        namespace: r.workload.namespace,
        recommendation: "Warnings indicate future non-compliance. Harden the security context proactively.",
      });
    }
  }

  return findings;
}
