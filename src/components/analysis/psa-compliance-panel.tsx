"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResourceLink } from "@/components/shared/resource-link";
import type { PSAComplianceResult } from "@/lib/risk/psa-compliance";
import type { NamespacePodSecurity } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { ShieldAlert, ShieldCheck, AlertTriangle, ChevronDown, Search, FileWarning, Shield } from "lucide-react";

function LevelBadge({ mode, level }: { mode: string; level?: string }) {
  const termMap: Record<string, string> = { enforce: "PSAEnforce", audit: "PSAAudit", warn: "PSAWarn" };
  const levelTermMap: Record<string, string> = { privileged: "PSAPrivileged", baseline: "PSABaseline", restricted: "PSARestricted" };
  if (!level) return <Badge variant="outline" className="text-[9px] text-muted-foreground"><FieldLabel term={termMap[mode] || mode}>{mode}</FieldLabel>: none</Badge>;
  const colors: Record<string, string> = {
    privileged: "bg-red-500/15 text-red-700 border-red-500/30",
    baseline: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
    restricted: "bg-green-500/15 text-green-700 border-green-500/30",
  };
  return <Badge variant="outline" className={`text-[9px] ${colors[level] || ""}`}><FieldLabel term={termMap[mode] || mode}>{mode}</FieldLabel>: <FieldLabel term={levelTermMap[level] || level}>{level}</FieldLabel></Badge>;
}

function ViolationCount({ count, variant }: { count: number; variant: "enforce" | "audit" | "warn" }) {
  if (count === 0) return null;
  const cfg = {
    enforce: { color: "bg-red-500/15 text-red-700 border-red-500/30", label: "enforce" },
    audit: { color: "bg-orange-500/15 text-orange-700 border-orange-500/30", label: "audit" },
    warn: { color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", label: "warn" },
  }[variant];
  return <Badge variant="outline" className={`text-[9px] gap-1 ${cfg.color}`}>{count} {cfg.label}</Badge>;
}

interface PSACompliancePanelProps {
  results: PSAComplianceResult[];
  psaData: NamespacePodSecurity[];
}

export function PSACompliancePanel({ results, psaData }: PSACompliancePanelProps) {
  const [filter, setFilter] = useState("");

  // Group by namespace
  const grouped = useMemo(() => {
    const map = new Map<string, PSAComplianceResult[]>();
    for (const r of results) {
      const ns = r.workload.namespace;
      if (filter && !ns.toLowerCase().includes(filter.toLowerCase()) && !r.workload.name.toLowerCase().includes(filter.toLowerCase())) continue;
      const existing = map.get(ns) || [];
      map.set(ns, [...existing, r]);
    }
    return map;
  }, [results, filter]);

  // PSA map for namespaces
  const psaMap = useMemo(() => {
    const m = new Map<string, NamespacePodSecurity>();
    for (const p of psaData) m.set(p.namespace, p);
    return m;
  }, [psaData]);

  // Namespaces with no PSA at all
  const noPolicyNamespaces = useMemo(() => {
    const nsWithWorkloads = new Set(results.map((r) => r.workload.namespace));
    // Also include namespaces from psaData that have no policy
    for (const p of psaData) {
      if (!p.enforce && !p.audit && !p.warn) nsWithWorkloads.add(p.namespace);
    }
    return Array.from(nsWithWorkloads).filter((ns) => {
      const psa = psaMap.get(ns);
      return !psa || (!psa.enforce && !psa.audit && !psa.warn);
    }).filter((ns) => !ns.startsWith("openshift-") && !ns.startsWith("kube-") && ns !== "default");
  }, [results, psaData, psaMap]);

  // Summary counts
  const totals = useMemo(() => {
    let enforce = 0, audit = 0, warn = 0;
    for (const r of results) {
      if (r.enforceViolations.length > 0) enforce++;
      if (r.auditViolations.length > 0) audit++;
      if (r.warnViolations.length > 0) warn++;
    }
    return { enforce, audit, warn, total: results.length };
  }, [results]);

  const sortedNamespaces = useMemo(() => {
    return Array.from(grouped.entries()).sort((a, b) => {
      // Namespaces with enforce violations first
      const aEnforce = a[1].filter((r) => r.enforceViolations.length > 0).length;
      const bEnforce = b[1].filter((r) => r.enforceViolations.length > 0).length;
      return bEnforce - aEnforce;
    });
  }, [grouped]);

  if (results.length === 0 && noPolicyNamespaces.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-green-500" />
        <p className="text-sm font-medium">All workloads comply with their namespace PSA policies</p>
        <p className="text-xs mt-1">No violations detected at any level.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Filter by namespace or workload..." className="pl-9 h-9 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px]">{totals.total} workloads with violations</Badge>
        {totals.enforce > 0 && <Badge variant="destructive" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" />{totals.enforce} would be rejected</Badge>}
        {totals.audit > 0 && <Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-700 border-orange-500/30 gap-1"><FileWarning className="h-3 w-3" />{totals.audit} audit logged</Badge>}
        {totals.warn > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-500/15 text-yellow-700 border-yellow-500/30 gap-1"><AlertTriangle className="h-3 w-3" />{totals.warn} warnings</Badge>}
      </div>

      {/* No-policy namespaces */}
      {noPolicyNamespaces.length > 0 && !filter && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
              Namespaces Without PSA Policy ({noPolicyNamespaces.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[10px] text-muted-foreground mb-2">These namespaces have no Pod Security Admission labels. Workloads are not validated against any security standard.</p>
            <div className="flex flex-wrap gap-1">
              {noPolicyNamespaces.slice(0, 20).map((ns) => (
                <Badge key={ns} variant="outline" className="text-[9px]">{ns}</Badge>
              ))}
              {noPolicyNamespaces.length > 20 && <Badge variant="outline" className="text-[9px]">+{noPolicyNamespaces.length - 20} more</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Namespace groups */}
      <ScrollArea className="h-[550px]">
        <div className="space-y-3">
          {sortedNamespaces.map(([ns, items]) => {
            const psa = psaMap.get(ns);
            const enforceCount = items.filter((r) => r.enforceViolations.length > 0).length;
            const auditCount = items.filter((r) => r.auditViolations.length > 0).length;
            const warnCount = items.filter((r) => r.warnViolations.length > 0).length;

            return (
              <Collapsible key={ns} defaultOpen={enforceCount > 0}>
                <Card>
                  <CollapsibleTrigger className="w-full text-left">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                          {enforceCount > 0 ? <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> : <Shield className="h-3.5 w-3.5 text-yellow-500" />}
                          <span className="text-xs font-medium">{ns}</span>
                          <LevelBadge mode="enforce" level={psa?.enforce} />
                          <LevelBadge mode="audit" level={psa?.audit} />
                          <LevelBadge mode="warn" level={psa?.warn} />
                        </div>
                        <div className="flex items-center gap-1">
                          <ViolationCount count={enforceCount} variant="enforce" />
                          <ViolationCount count={auditCount} variant="audit" />
                          <ViolationCount count={warnCount} variant="warn" />
                          <Badge variant="outline" className="text-[9px]">{items.length} workload{items.length !== 1 ? "s" : ""}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2">
                      {items.map((r) => (
                        <div key={`${r.workload.kind}:${r.workload.name}`} className="border rounded-lg p-2.5 text-xs space-y-1.5">
                          <div className="flex items-center gap-2">
                            <ResourceLink kind={r.workload.kind} name={r.workload.name} namespace={r.workload.namespace} />
                          </div>

                          {r.enforceViolations.length > 0 && (
                            <div className="p-2 rounded bg-red-500/5 border border-red-500/20">
                              <div className="flex items-center gap-1 mb-1">
                                <ShieldAlert className="h-3 w-3 text-red-600" />
                                <span className="text-[10px] font-medium text-red-700">Would be REJECTED (enforce: {r.enforceLevel})</span>
                              </div>
                              {r.enforceViolations.map((v, i) => (
                                <div key={i} className="text-[10px] text-red-700 ml-4">- {v}</div>
                              ))}
                            </div>
                          )}

                          {r.auditViolations.length > 0 && (
                            <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
                              <div className="flex items-center gap-1 mb-1">
                                <FileWarning className="h-3 w-3 text-orange-600" />
                                <span className="text-[10px] font-medium text-orange-700">Audit logged (audit: {r.auditLevel})</span>
                              </div>
                              {r.auditViolations.map((v, i) => (
                                <div key={i} className="text-[10px] text-orange-700 ml-4">- {v}</div>
                              ))}
                            </div>
                          )}

                          {r.warnViolations.length > 0 && (
                            <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                              <div className="flex items-center gap-1 mb-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                <span className="text-[10px] font-medium text-yellow-700">Warnings (warn: {r.warnLevel})</span>
                              </div>
                              {r.warnViolations.map((v, i) => (
                                <div key={i} className="text-[10px] text-yellow-700 ml-4">- {v}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
