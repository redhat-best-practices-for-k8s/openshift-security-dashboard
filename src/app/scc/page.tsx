"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { SCCComparison } from "@/components/scc/scc-comparison";
import { SCCDetail } from "@/components/scc/scc-detail";
import { SCCRelationships } from "@/components/scc/scc-relationships";
import { CreateSCCWizard } from "@/components/wizards/create-scc-wizard";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SecurityContextConstraint, ServiceAccountInfo, WorkloadResource } from "@/types";
import type { SCCAssociationData } from "@/lib/k8s/scc-rbac";
import { Lock, AlertTriangle, Plus, GitBranch } from "lucide-react";

export default function SCCPage() {
  return (
    <Suspense>
      <SCCPageInner />
    </Suspense>
  );
}

function SCCPageInner() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [sccs, setSccs] = useState<SecurityContextConstraint[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccountInfo[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadResource[]>([]);
  const [associationData, setAssociationData] = useState<SCCAssociationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingScc, setEditingScc] = useState<SecurityContextConstraint | null>(null);
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const [sccRes, saRes, wlRes, assocRes] = await Promise.all([
          fetch("/api/scc"),
          fetch(`/api/service-accounts${ns}`),
          fetch(`/api/workloads${ns}`),
          fetch(`/api/scc-associations${ns}`).catch(() => null),
        ]);
        const [sccJson, saJson, wlJson] = await Promise.all([
          sccRes.json(),
          saRes.json(),
          wlRes.json(),
        ]);
        if (Array.isArray(sccJson)) setSccs(sccJson);
        if (Array.isArray(saJson)) setServiceAccounts(saJson);
        if (Array.isArray(wlJson)) setWorkloads(wlJson);
        if (assocRes && assocRes.ok) {
          const assocJson = await assocRes.json();
          if (assocJson.associations) setAssociationData(assocJson);
        }
      } catch (error) {
        console.error("Failed to fetch SCCs:", error);
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
    if (openName && sccs.length > 0) {
      const match = sccs.find((s) => s.name === openName);
      if (match) { setEditingScc(match); openConsumed.current = true; }
    }
  }, [searchParams, sccs]);

  if (!kubeconfigLoaded) {
    return <EmptyState icon={<Lock className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />;
  }

  const dangerousCount = sccs.filter((s) => s.allowPrivilegedContainer || s.allowHostNetwork).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Security Context Constraints" description="Manage what containers are allowed to do at the OS level">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{sccs.length} SCCs</Badge>
          {dangerousCount > 0 && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{dangerousCount} permissive</Badge>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create SCC</Button>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="SCC">SCCs</LearnTooltip> control what Linux capabilities containers can use.
        They determine whether containers can run as root, access host networking, or use <LearnTooltip term="Privileged">privileged</LearnTooltip> mode.
        Each card below shows a constraint with traffic-light indicators:
        <span className="inline-flex items-center gap-1 mx-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> safe</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> risky</span>.
        Click a card to expand details and edit.
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-muted rounded-lg h-24" />)}</div>
      ) : sccs.length === 0 ? (
        <EmptyState icon={<Lock className="h-12 w-12" />} title="No SCCs found" description="This may not be an OpenShift cluster, or you may not have permission to view SCCs." />
      ) : (
        <Tabs defaultValue="constraints" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="constraints" className="gap-2 text-xs">
              <Lock className="h-3.5 w-3.5" /> Constraints ({sccs.length})
            </TabsTrigger>
            <TabsTrigger value="relationships" className="gap-2 text-xs">
              <GitBranch className="h-3.5 w-3.5" /> Relationships
            </TabsTrigger>
          </TabsList>
          <TabsContent value="constraints" className="mt-4">
            <SCCComparison sccs={sccs} onEdit={setEditingScc} />
          </TabsContent>
          <TabsContent value="relationships" className="mt-4">
            <SCCRelationships
              sccs={sccs}
              serviceAccounts={serviceAccounts}
              workloads={workloads}
              associationData={associationData}
            />
          </TabsContent>
        </Tabs>
      )}

      <CreateSCCWizard open={showCreate} onClose={() => setShowCreate(false)} />
      <SCCDetail scc={editingScc} onClose={() => setEditingScc(null)} />
    </div>
  );
}
