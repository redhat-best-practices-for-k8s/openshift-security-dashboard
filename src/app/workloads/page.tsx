"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { WorkloadList } from "@/components/workloads/workload-list";
import { PodDetail } from "@/components/workloads/pod-detail";
import { Badge } from "@/components/ui/badge";
import type { WorkloadResource } from "@/types";
import type { SCCAssociationData } from "@/lib/k8s/scc-rbac";
import { Container, ShieldAlert } from "lucide-react";

export default function WorkloadsPage() {
  return (
    <Suspense>
      <WorkloadsPageInner />
    </Suspense>
  );
}

function WorkloadsPageInner() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [workloads, setWorkloads] = useState<WorkloadResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WorkloadResource | null>(null);
  const [associationData, setAssociationData] = useState<SCCAssociationData | null>(null);
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const [res, assocRes] = await Promise.all([
          fetch(`/api/workloads${ns}`),
          fetch(`/api/scc-associations${ns}`).catch(() => null),
        ]);
        const json = await res.json();
        if (Array.isArray(json)) setWorkloads(json);
        if (assocRes && assocRes.ok) {
          const assocJson = await assocRes.json();
          if (assocJson.associations) setAssociationData(assocJson);
        }
      } catch (error) {
        console.error("Failed to fetch workloads:", error);
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
    const openKind = searchParams.get("kind");
    if (openName && workloads.length > 0) {
      const match = workloads.find((w) =>
        w.name === openName &&
        (!openNs || w.namespace === openNs) &&
        (!openKind || w.kind === openKind)
      );
      if (match) { setSelected(match); openConsumed.current = true; }
    }
  }, [searchParams, workloads]);

  if (!kubeconfigLoaded) {
    return <EmptyState icon={<Container className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />;
  }

  const privilegedCount = workloads.filter((w) =>
    w.containers.some((c) => c.securityContext?.privileged) || w.podSecurityPosture.hostNetwork || w.podSecurityPosture.hostPID
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Workloads" description="View and manage security contexts for all workload resources">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{workloads.length} workloads</Badge>
          {privilegedCount > 0 && (
            <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />{privilegedCount} elevated</Badge>
          )}
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="SecurityContext">Security contexts</LearnTooltip> define privilege and access controls for containers.
        This page shows all Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, and standalone Pods with their security posture.
        Click any row to view details and edit security settings.
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[600px]" />
      ) : (
        <WorkloadList workloads={workloads} onSelect={setSelected} />
      )}

      <PodDetail
        workload={selected}
        onClose={() => setSelected(null)}
        availableSCCs={
          selected && associationData
            ? associationData.associations[`${selected.namespace}/${selected.podSecurityPosture.serviceAccountName}`] || []
            : undefined
        }
      />
    </div>
  );
}
