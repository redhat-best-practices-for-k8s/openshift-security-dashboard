"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { ServiceAccountDetail } from "@/components/service-accounts/sa-detail";
import { ResourceLink } from "@/components/shared/resource-link";
import { CreateServiceAccountWizard } from "@/components/wizards/create-service-account-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { ServiceAccountInfo } from "@/types";
import { UserCheck, Search, ChevronDown, AlertTriangle, Shield, KeyRound, Plus, Trash2, ExternalLink, Lock } from "lucide-react";

export default function ServiceAccountsPage() {
  return (
    <Suspense>
      <ServiceAccountsPageInner />
    </Suspense>
  );
}

function ServiceAccountsPageInner() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [sas, setSas] = useState<ServiceAccountInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [expandedSA, setExpandedSA] = useState<string | null>(null);
  const [selectedSA, setSelectedSA] = useState<ServiceAccountInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { addChange } = useChangesStore();
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const res = await fetch(`/api/service-accounts${ns}`);
        const json = await res.json();
        if (Array.isArray(json)) setSas(json);
      } catch (error) {
        console.error("Failed to fetch service accounts:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [kubeconfigLoaded, selectedNamespace]);

  // Auto-open from ?open= param (once only)
  useEffect(() => {
    if (openConsumed.current) return;
    const openName = searchParams.get("open");
    const openNs = searchParams.get("ns");
    if (openName && sas.length > 0) {
      const match = sas.find((sa) => sa.name === openName && (!openNs || sa.namespace === openNs));
      if (match) { setSelectedSA(match); openConsumed.current = true; }
    }
  }, [searchParams, sas]);

  const roles = useMemo(() => {
    // Collect unique roles from SAs
    const set = new Set<string>();
    sas.forEach((sa) => { sa.roles.forEach((r) => set.add(`Role:${r}`)); sa.clusterRoles.forEach((r) => set.add(`ClusterRole:${r}`)); });
    return Array.from(set).map((s) => { const [kind, name] = s.split(":"); return { kind, name }; });
  }, [sas]);

  if (!kubeconfigLoaded) {
    return <EmptyState icon={<UserCheck className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />;
  }

  const filtered = sas.filter((sa) => {
    if (!filter) return true;
    const lower = filter.toLowerCase();
    return sa.name.toLowerCase().includes(lower) || sa.namespace.toLowerCase().includes(lower);
  });

  const adminSAs = sas.filter((sa) => sa.clusterRoles.includes("cluster-admin"));

  const handleDelete = (sa: ServiceAccountInfo) => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: "ServiceAccount",
      resourceName: sa.name,
      namespace: sa.namespace,
      before: {},
      after: null,
      description: `Delete ServiceAccount "${sa.name}" from "${sa.namespace}"`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Service Accounts" description="Application identities and their permissions">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sas.length} accounts</Badge>
          {adminSAs.length > 0 && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{adminSAs.length} with cluster-admin</Badge>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create SA</Button>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="ServiceAccount">Service Accounts</LearnTooltip> are identities for applications running in pods. Each one can be assigned roles and SCCs. Click a row to expand details, or use the Create button.
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Filter by name or namespace..." className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[500px]" />
      ) : (
        <Card>
          <CardContent className="pt-0">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Namespace</TableHead>
                    <TableHead className="text-xs text-center">Roles</TableHead>
                    <TableHead className="text-xs text-center">Cluster Roles</TableHead>
                    <TableHead className="text-xs text-center">Secrets</TableHead>
                    <TableHead className="text-xs text-center">SCCs</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).flatMap((sa) => {
                    const key = `${sa.namespace}/${sa.name}`;
                    const isAdmin = sa.clusterRoles.includes("cluster-admin");
                    const isExpanded = expandedSA === key;
                    const rows = [
                      <TableRow key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedSA(isExpanded ? null : key)}>
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            {isAdmin && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                            {sa.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sa.namespace}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{sa.roles.length}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant={sa.clusterRoles.length > 0 ? "secondary" : "outline"} className="text-[10px]">{sa.clusterRoles.length}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{sa.secrets.length}</Badge></TableCell>
                        <TableCell className="text-center">
                          {sa.sccs.length > 0 ? (
                            <Badge variant={sa.sccs.some((s) => ["privileged", "anyuid"].includes(s)) ? "destructive" : "secondary"} className="text-[10px]">
                              {sa.sccs.length}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setSelectedSA(sa); }} title="Open detail">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(sa); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </TableCell>
                      </TableRow>,
                    ];
                    if (isExpanded) {
                      rows.push(
                        <TableRow key={`${key}-detail`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <div className="font-medium mb-1.5 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Roles</div>
                                {sa.roles.length > 0 ? sa.roles.map((r) => <ResourceLink key={r} kind="Role" name={r} namespace={sa.namespace} />) : <span className="text-muted-foreground">None</span>}
                                {sa.clusterRoles.length > 0 && (
                                  <div className="mt-2">
                                    <span className="text-muted-foreground">Cluster Roles:</span>
                                    <div className="mt-1 flex flex-wrap gap-1">{sa.clusterRoles.map((r) => <ResourceLink key={r} kind="ClusterRole" name={r} />)}</div>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-medium mb-1.5 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> Secrets</div>
                                {sa.secrets.length > 0 ? sa.secrets.map((s) => <div key={s}><ResourceLink kind="Secret" name={s} namespace={sa.namespace} compact /></div>) : <span className="text-muted-foreground">None</span>}
                              </div>
                              <div>
                                <div className="font-medium mb-1.5 flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> SCCs</div>
                                {sa.sccs.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {sa.sccs.map((scc) => <ResourceLink key={scc} kind="SCC" name={scc} compact />)}
                                  </div>
                                ) : <span className="text-muted-foreground">None</span>}
                              </div>
                              <div>
                                <div className="font-medium mb-1.5">Created</div>
                                <span className="text-muted-foreground">{sa.creationTimestamp ? new Date(sa.creationTimestamp).toLocaleDateString() : "Unknown"}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return rows;
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <CreateServiceAccountWizard open={showCreate} onClose={() => setShowCreate(false)} roles={roles} />
      <ServiceAccountDetail sa={selectedSA} onClose={() => setSelectedSA(null)} />
    </div>
  );
}
