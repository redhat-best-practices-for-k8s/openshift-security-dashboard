"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResourceLink } from "@/components/shared/resource-link";
import type { SecurityContextConstraint, ServiceAccountInfo, WorkloadResource } from "@/types";
import type { SCCGrantSource, SCCAssociationData } from "@/lib/k8s/scc-rbac";
import { FieldLabel } from "@/components/shared/field-label";
import {
  Lock,
  UserCheck,
  Container,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  Shield,
  Key,
} from "lucide-react";

interface SCCRelationshipsProps {
  sccs: SecurityContextConstraint[];
  serviceAccounts: ServiceAccountInfo[];
  workloads: WorkloadResource[];
  associationData?: SCCAssociationData | null;
}

interface SAWithGrant {
  name: string;
  namespace: string;
  grantSource: SCCGrantSource;
}

function grantBadge(via: "user" | "group" | "rbac") {
  switch (via) {
    case "user":
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 bg-blue-500/10 text-blue-700 border-blue-300">
          <UserCheck className="h-2 w-2" /> <FieldLabel term="SCCGrant">direct</FieldLabel>
        </Badge>
      );
    case "group":
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 bg-purple-500/10 text-purple-700 border-purple-300">
          <Users className="h-2 w-2" /> <FieldLabel term="SCCGrant">group</FieldLabel>
        </Badge>
      );
    case "rbac":
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 bg-amber-500/10 text-amber-700 border-amber-300">
          <Key className="h-2 w-2" /> <FieldLabel term="SCCGrant">RBAC</FieldLabel>
        </Badge>
      );
  }
}

interface SCCRelationship {
  scc: SecurityContextConstraint;
  /** SAs associated via any grant type, with source info */
  associatedSAs: SAWithGrant[];
  /** Workloads actively using this SCC (from pod annotation) */
  workloads: WorkloadResource[];
}

export function SCCRelationships({
  sccs,
  serviceAccounts,
  workloads,
  associationData,
}: SCCRelationshipsProps) {
  const [filter, setFilter] = useState("");
  const [expandedSCC, setExpandedSCC] = useState<Set<string>>(new Set());

  const relationships: SCCRelationship[] = useMemo(() => {
    return sccs.map((scc) => {
      // Collect SAs for this SCC from the unified association data
      const associatedSAs: SAWithGrant[] = [];

      if (associationData) {
        // Use the server-side data which has all three sources
        for (const [saKey, sources] of Object.entries(associationData.grantSources)) {
          for (const source of sources) {
            if (source.scc === scc.name) {
              const [ns, ...nameParts] = saKey.split("/");
              const name = nameParts.join("/");
              associatedSAs.push({ name, namespace: ns, grantSource: source });
              break; // Only add each SA once per SCC
            }
          }
        }
      } else {
        // Fallback: client-side matching from SCC users/groups (incomplete, no RBAC)
        const saUserString = (ns: string, name: string) =>
          `system:serviceaccount:${ns}:${name}`;

        for (const sa of serviceAccounts) {
          if (scc.users.includes(saUserString(sa.namespace, sa.name))) {
            associatedSAs.push({
              name: sa.name,
              namespace: sa.namespace,
              grantSource: { scc: scc.name, via: "user", detail: "SCC users field" },
            });
          } else {
            const saGroups = [
              "system:authenticated",
              "system:serviceaccounts",
              `system:serviceaccounts:${sa.namespace}`,
            ];
            const matchedGroup = scc.groups.find((g) => saGroups.includes(g));
            if (matchedGroup) {
              associatedSAs.push({
                name: sa.name,
                namespace: sa.namespace,
                grantSource: { scc: scc.name, via: "group", detail: `SCC groups: ${matchedGroup}` },
              });
            }
          }
        }
      }

      // Workloads that use this SCC (via appliedSCC annotation)
      const sccWorkloads = workloads.filter((w) => w.appliedSCC === scc.name);

      return { scc, associatedSAs, workloads: sccWorkloads };
    });
  }, [sccs, workloads, serviceAccounts, associationData]);

  const filtered = useMemo(() => {
    if (!filter) return relationships;
    const q = filter.toLowerCase();
    return relationships.filter((r) => {
      if (r.scc.name.toLowerCase().includes(q)) return true;
      if (r.associatedSAs.some((sa) => sa.name.toLowerCase().includes(q) || sa.namespace.toLowerCase().includes(q))) return true;
      if (r.workloads.some((w) => w.name.toLowerCase().includes(q) || w.namespace.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [relationships, filter]);

  const toggleExpand = (name: string) => {
    setExpandedSCC((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const totalAssociations = relationships.reduce(
    (sum, r) => sum + r.associatedSAs.length,
    0
  );
  const activeCount = relationships.filter((r) => r.workloads.length > 0).length;

  // Count associations by type for the summary
  const grantTypeCounts = useMemo(() => {
    const counts = { user: 0, group: 0, rbac: 0 };
    for (const rel of relationships) {
      for (const sa of rel.associatedSAs) {
        counts[sa.grantSource.via]++;
      }
    }
    return counts;
  }, [relationships]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1">
          <Lock className="h-3 w-3" /> {sccs.length} SCCs
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <UserCheck className="h-3 w-3" /> {totalAssociations} SA associations
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Container className="h-3 w-3" /> {activeCount} actively used
        </Badge>
        {associationData && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-auto">
            Grant types:
            {grantTypeCounts.user > 0 && grantBadge("user")}
            {grantTypeCounts.group > 0 && grantBadge("group")}
            {grantTypeCounts.rbac > 0 && grantBadge("rbac")}
          </div>
        )}
      </div>

      {!associationData && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
          Association data is loading or unavailable. Showing only direct user/group grants (RBAC grants not included).
        </div>
      )}

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by SCC, service account, or workload..."
          className="pl-9 h-9 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Relationship Cards */}
      <div className="space-y-3">
        {filtered.map((rel) => {
          const isExpanded = expandedSCC.has(rel.scc.name);
          const isDangerous =
            rel.scc.allowPrivilegedContainer || rel.scc.allowHostNetwork || rel.scc.allowHostPID;
          const hasAssociations = rel.associatedSAs.length > 0;

          return (
            <Card
              key={rel.scc.name}
              className={`${isDangerous ? "border-red-500/30" : ""} ${!hasAssociations && rel.workloads.length === 0 ? "opacity-60" : ""}`}
            >
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(rel.scc.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ResourceLink kind="SCC" name={rel.scc.name} compact />
                      {isDangerous && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {rel.associatedSAs.length > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <UserCheck className="h-2.5 w-2.5" /> {rel.associatedSAs.length} SAs
                      </Badge>
                    )}
                    {rel.workloads.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Container className="h-2.5 w-2.5" /> {rel.workloads.length} workloads
                      </Badge>
                    )}
                    {!hasAssociations && rel.workloads.length === 0 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Unused
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 px-4 space-y-4">
                  {/* Associated Service Accounts (grouped by grant type) */}
                  {rel.associatedSAs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> Service Account Grants
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {rel.associatedSAs.map((sa) => {
                          // Find workloads using this SA
                          const saWorkloads = rel.workloads.filter(
                            (w) =>
                              w.podSecurityPosture.serviceAccountName === sa.name &&
                              w.namespace === sa.namespace
                          );
                          return (
                            <div
                              key={`${sa.namespace}/${sa.name}`}
                              className="border rounded-md p-2.5 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <ResourceLink
                                  kind="ServiceAccount"
                                  name={sa.name}
                                  namespace={sa.namespace}
                                />
                                {grantBadge(sa.grantSource.via)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                ns: {sa.namespace}
                              </div>
                              <div className="text-[10px] text-muted-foreground italic" title={sa.grantSource.detail}>
                                {sa.grantSource.detail}
                              </div>
                              {saWorkloads.length > 0 && (
                                <div className="pt-1 border-t">
                                  <span className="text-[10px] text-muted-foreground">
                                    Workloads:
                                  </span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {saWorkloads.map((w) => (
                                      <ResourceLink
                                        key={`${w.kind}/${w.namespace}/${w.name}`}
                                        kind={w.kind}
                                        name={w.name}
                                        namespace={w.namespace}
                                        compact
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active Workloads */}
                  {rel.workloads.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Container className="h-3 w-3" /> Active Workloads Using This SCC
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {rel.workloads.map((w) => (
                          <div
                            key={`${w.kind}/${w.namespace}/${w.name}`}
                            className="border rounded-md p-2.5 text-xs space-y-1"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">
                                {w.kind}
                              </Badge>
                              <ResourceLink kind={w.kind} name={w.name} namespace={w.namespace} compact />
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              <span>ns: {w.namespace}</span>
                              <span>SA: <ResourceLink kind="ServiceAccount" name={w.podSecurityPosture.serviceAccountName} namespace={w.namespace} compact /></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No associations */}
                  {!hasAssociations && rel.workloads.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      This SCC has no service account grants, group grants, or active workloads.
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No SCCs match your filter.
        </div>
      )}
    </div>
  );
}
