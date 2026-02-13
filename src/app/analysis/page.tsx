"use client";

import { useEffect, useState, useCallback } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskAnalysisPanel } from "@/components/analysis/risk-analysis-panel";
import { CrossNamespaceMatrix } from "@/components/analysis/cross-namespace-matrix";
import { PSACompliancePanel } from "@/components/analysis/psa-compliance-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RiskFinding, SecurityScore, CrossNamespaceAccess, WorkloadResource, NamespacePodSecurity } from "@/types";
import { analyzePSACompliance, psaComplianceToFindings } from "@/lib/risk/psa-compliance";
import type { PSAComplianceResult } from "@/lib/risk/psa-compliance";
import { ResourceLink } from "@/components/shared/resource-link";
import { ScanSearch, ShieldAlert, Shield, Network, Loader2, BarChart3, ArrowLeftRight, HardDrive, Sparkles, ShieldCheck } from "lucide-react";

export default function AnalysisPage() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<RiskFinding[]>([]);
  const [crossNs, setCrossNs] = useState<CrossNamespaceAccess[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadResource[]>([]);
  const [psaData, setPsaData] = useState<NamespacePodSecurity[]>([]);
  const [psaResults, setPsaResults] = useState<PSAComplianceResult[]>([]);
  const [score, setScore] = useState<SecurityScore | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";

      // Fetch all data in parallel
      const [rbacRes, sccRes, netRes, psaRes, saRes, secretRes, wlRes] = await Promise.all([
        fetch(`/api/rbac${ns}`),
        fetch("/api/scc"),
        fetch(`/api/network-policies${ns}`),
        fetch("/api/pod-security"),
        fetch(`/api/service-accounts${ns}`),
        fetch(`/api/secrets${ns}`),
        fetch(`/api/workloads${ns}`),
      ]);

      const [rbac, scc, net, psa, sa, secrets, wl] = await Promise.all([
        rbacRes.json(),
        sccRes.json(),
        netRes.json(),
        psaRes.json(),
        saRes.json(),
        secretRes.json(),
        wlRes.json(),
      ]);

      if (Array.isArray(wl)) setWorkloads(wl);

      // Store PSA data
      const psaList: NamespacePodSecurity[] = Array.isArray(psa) ? psa : [];
      setPsaData(psaList);

      // Run PSA compliance analysis
      const wlList = Array.isArray(wl) ? wl as WorkloadResource[] : [];
      const psaComplianceResults = analyzePSACompliance(wlList, psaList);
      setPsaResults(psaComplianceResults);

      // Use existing scoring endpoint or compute client-side
      // For now, we'll send to a scoring API or compute locally
      const allFindings: RiskFinding[] = [];

      // Fetch from dashboard API which already computes findings
      const dashRes = await fetch("/api/cluster");
      const dashData = await dashRes.json();
      if (dashData.score) {
        setScore(dashData.score);
        allFindings.push(...(dashData.score.findings || []));
      }

      // We'll pass workloads for client-side analysis here since the server
      // endpoint doesn't yet include workload risks
      if (Array.isArray(wl)) {
        // Client-side workload risk analysis
        for (const w of wl as WorkloadResource[]) {
          // Privileged
          for (const c of w.containers) {
            if (c.securityContext?.privileged) {
              allFindings.push({
                id: `wl-privileged-${w.namespace}-${w.name}-${c.name}`,
                level: "critical",
                domain: "workloads",
                title: `Privileged container "${c.name}" in ${w.kind} "${w.name}"`,
                description: "Runs in privileged mode with full host access.",
                resource: `${w.kind}/${w.namespace}/${w.name}`,
                namespace: w.namespace,
                recommendation: "Remove privileged: true. Use specific capabilities instead.",
              });
            }
            if (!c.securityContext) {
              allFindings.push({
                id: `wl-no-secctx-${w.namespace}-${w.name}-${c.name}`,
                level: "medium",
                domain: "workloads",
                title: `No security context on "${c.name}" in ${w.kind} "${w.name}"`,
                description: "Container has no security context. Defaults may be permissive.",
                resource: `${w.kind}/${w.namespace}/${w.name}`,
                namespace: w.namespace,
                recommendation: "Add runAsNonRoot: true, readOnlyRootFilesystem: true, drop ALL capabilities.",
              });
            } else {
              if (c.securityContext.runAsUser === 0) {
                allFindings.push({
                  id: `wl-root-${w.namespace}-${w.name}-${c.name}`,
                  level: "high",
                  domain: "workloads",
                  title: `Root container "${c.name}" in ${w.kind} "${w.name}"`,
                  description: "Container runs as root (UID 0).",
                  resource: `${w.kind}/${w.namespace}/${w.name}`,
                  namespace: w.namespace,
                  recommendation: "Set runAsNonRoot: true and a non-zero runAsUser.",
                });
              }
              if (c.securityContext.allowPrivilegeEscalation !== false) {
                allFindings.push({
                  id: `wl-escalation-${w.namespace}-${w.name}-${c.name}`,
                  level: "medium",
                  domain: "workloads",
                  title: `Privilege escalation allowed in "${c.name}" of ${w.kind} "${w.name}"`,
                  description: "Container can gain more privileges via setuid.",
                  resource: `${w.kind}/${w.namespace}/${w.name}`,
                  namespace: w.namespace,
                  recommendation: "Set allowPrivilegeEscalation: false.",
                });
              }
            }
          }
          if (w.podSecurityPosture.hostNetwork) {
            allFindings.push({
              id: `wl-hostnet-${w.namespace}-${w.name}`,
              level: "critical",
              domain: "workloads",
              title: `${w.kind} "${w.name}" uses host networking`,
              description: "Bypasses network policies and can see all node traffic.",
              resource: `${w.kind}/${w.namespace}/${w.name}`,
              namespace: w.namespace,
              recommendation: "Remove hostNetwork unless required for CNI or ingress.",
            });
          }
        }
      }

      // Cross-namespace analysis
      if (rbac && !rbac.error) {
        const crossAccesses: CrossNamespaceAccess[] = [];
        const allBindings = [...(rbac.roleBindings || []), ...(rbac.clusterRoleBindings || [])];
        for (const b of allBindings) {
          const bNs = b.namespace || "(cluster)";
          for (const s of b.subjects || []) {
            if (s.kind === "ServiceAccount" && s.namespace && s.namespace !== b.namespace && b.kind === "RoleBinding") {
              crossAccesses.push({
                sourceNamespace: s.namespace,
                sourceSubject: { kind: s.kind, name: s.name },
                targetNamespace: bNs,
                bindingName: b.name,
                bindingKind: b.kind,
                roleRef: b.roleRef,
                grantedVerbs: [],
                grantedResources: [],
              });
            }
            if (b.kind === "ClusterRoleBinding" && s.kind === "ServiceAccount" && s.namespace) {
              crossAccesses.push({
                sourceNamespace: s.namespace,
                sourceSubject: { kind: s.kind, name: s.name },
                targetNamespace: "(all namespaces)",
                bindingName: b.name,
                bindingKind: b.kind,
                roleRef: b.roleRef,
                grantedVerbs: [],
                grantedResources: [],
              });
            }
          }
        }
        setCrossNs(crossAccesses);
      }

      // Add PSA compliance findings (enforce violations as critical, audit as medium, warn as low)
      allFindings.push(...psaComplianceToFindings(psaComplianceResults));

      // Deduplicate findings by id
      const seen = new Set<string>();
      const deduped = allFindings.filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });

      setFindings(deduped.sort((a, b) => {
        const order = ["critical", "high", "medium", "low", "info"];
        return order.indexOf(a.level) - order.indexOf(b.level);
      }));
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace]);

  useEffect(() => {
    if (kubeconfigLoaded) runAnalysis();
  }, [kubeconfigLoaded, runAnalysis]);

  if (!kubeconfigLoaded) {
    return <EmptyState icon={<ScanSearch className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />;
  }

  const criticalCount = findings.filter((f) => f.level === "critical").length;
  const highCount = findings.filter((f) => f.level === "high").length;
  const workloadFindings = findings.filter((f) => f.domain === "workloads");

  const handleFixWithAI = (finding: RiskFinding) => {
    // Dispatch to AI chat - will be handled by the chat panel
    const event = new CustomEvent("ai-fix-request", {
      detail: { prompt: `Fix this security issue: ${finding.title}\n\nDescription: ${finding.description}\nResource: ${finding.resource}${finding.namespace ? `\nNamespace: ${finding.namespace}` : ""}\n\nRecommendation: ${finding.recommendation}` },
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Security Analysis" description="Deep scan of your cluster security posture">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{findings.length} findings</Badge>
          {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">{criticalCount} critical</Badge>}
          {highCount > 0 && <Badge variant="secondary" className="text-[10px] bg-orange-500/15 text-orange-700">{highCount} high</Badge>}
          <Button size="sm" onClick={runAnalysis} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
            {loading ? "Scanning..." : "Re-scan"}
          </Button>
        </div>
      </PageHeader>

      {loading && findings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing cluster security posture...</p>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all" className="gap-2 text-xs"><BarChart3 className="h-3.5 w-3.5" /> All Findings ({findings.length})</TabsTrigger>
            <TabsTrigger value="workloads" className="gap-2 text-xs"><Shield className="h-3.5 w-3.5" /> Workloads ({workloadFindings.length})</TabsTrigger>
            <TabsTrigger value="cross-ns" className="gap-2 text-xs"><ArrowLeftRight className="h-3.5 w-3.5" /> Cross-Namespace ({crossNs.length})</TabsTrigger>
            <TabsTrigger value="psa" className="gap-2 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> PSA Compliance ({psaResults.length})</TabsTrigger>
            <TabsTrigger value="ports" className="gap-2 text-xs"><HardDrive className="h-3.5 w-3.5" /> Port Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <RiskAnalysisPanel findings={findings} onFixWithAI={handleFixWithAI} />
          </TabsContent>

          <TabsContent value="workloads" className="mt-4">
            <RiskAnalysisPanel findings={workloadFindings} onFixWithAI={handleFixWithAI} />
          </TabsContent>

          <TabsContent value="cross-ns" className="mt-4">
            <CrossNamespaceMatrix accesses={crossNs} />
          </TabsContent>

          <TabsContent value="psa" className="mt-4">
            <PSACompliancePanel results={psaResults} psaData={psaData} />
          </TabsContent>

          <TabsContent value="ports" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Port Audit</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workloads.filter((w) => w.containers.some((c) => c.ports.length > 0)).map((w) => (
                    <div key={`${w.kind}:${w.namespace}/${w.name}`} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ResourceLink kind={w.kind} name={w.name} namespace={w.namespace} />
                      </div>
                      {w.containers.filter((c) => c.ports.length > 0).map((c) => (
                        <div key={c.name} className="ml-4 text-xs space-y-1">
                          <span className="text-muted-foreground">{c.name}:</span>
                          <div className="flex flex-wrap gap-1 ml-2">
                            {c.ports.map((p) => (
                              <Badge
                                key={`${p.containerPort}/${p.protocol}`}
                                variant={p.hostPort ? "destructive" : "outline"}
                                className="text-[9px]"
                              >
                                {p.containerPort}/{p.protocol}
                                {p.hostPort ? ` (host:${p.hostPort})` : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {workloads.filter((w) => w.containers.some((c) => c.ports.length > 0)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No workloads with declared ports found.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
