"use client";

import { Suspense, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { RBACGraph } from "@/components/rbac/rbac-graph";
import { RBACMatrix } from "@/components/rbac/rbac-matrix";
import { WhoCanQuery } from "@/components/rbac/who-can-query";
import { RoleDetail } from "@/components/rbac/role-detail";
import { BindingDetail } from "@/components/rbac/binding-detail";
import { CreateRoleWizard } from "@/components/wizards/create-role-wizard";
import { CreateBindingWizard } from "@/components/wizards/create-binding-wizard";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { RBACData, RBACRole, RBACBinding } from "@/types";
import { Shield, GitGraph, Table, Search, Plus } from "lucide-react";

export default function RBACPage() {
  return (
    <Suspense>
      <RBACPageInner />
    </Suspense>
  );
}

function RBACPageInner() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [data, setData] = useState<RBACData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RBACRole | null>(null);
  const [selectedBinding, setSelectedBinding] = useState<RBACBinding | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showCreateBinding, setShowCreateBinding] = useState(false);
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const res = await fetch(`/api/rbac${ns}`);
        const json = await res.json();
        if (!json.error) setData(json);
      } catch (error) {
        console.error("Failed to fetch RBAC data:", error);
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
    const openKind = searchParams.get("kind");
    const openNs = searchParams.get("ns");
    if (!openName || !data) return;

    if (openKind === "Role" || openKind === "ClusterRole") {
      const allRoles = [...(data.roles || []), ...(data.clusterRoles || [])];
      const match = allRoles.find((r) => r.name === openName && (!openNs || r.namespace === openNs));
      if (match) { setSelectedRole(match); openConsumed.current = true; }
    } else if (openKind === "RoleBinding" || openKind === "ClusterRoleBinding") {
      const allBindings = [...(data.roleBindings || []), ...(data.clusterRoleBindings || [])];
      const match = allBindings.find((b) => b.name === openName && (!openNs || b.namespace === openNs));
      if (match) { setSelectedBinding(match); openConsumed.current = true; }
    }
  }, [searchParams, data]);

  const handleNodeClick = (nodeId: string) => {
    if (!data) return;
    const [kind, ...rest] = nodeId.split(":");
    const nameOrNsName = rest.join(":");

    if (kind === "Role" || kind === "ClusterRole") {
      const allRoles = [...(data.roles || []), ...(data.clusterRoles || [])];
      const role = allRoles.find((r) => r.name === nameOrNsName || `${r.namespace || ""}:${r.name}` === nameOrNsName);
      if (role) setSelectedRole(role);
    } else {
      // Try to find a binding for this subject
      const allBindings = [...(data.roleBindings || []), ...(data.clusterRoleBindings || [])];
      const binding = allBindings.find((b) => b.subjects.some((s) => nodeId.includes(s.name)));
      if (binding) setSelectedBinding(binding);
    }
  };

  const roleList = useMemo(() => {
    if (!data) return [];
    return [
      ...data.roles.map((r) => ({ name: r.name, kind: "Role" as const, namespace: r.namespace })),
      ...data.clusterRoles.map((r) => ({ name: r.name, kind: "ClusterRole" as const })),
    ];
  }, [data]);

  if (!kubeconfigLoaded) {
    return (
      <EmptyState icon={<Shield className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="RBAC Explorer" description="Visualize and manage Role-Based Access Control">
        <div className="flex items-center gap-2">
          {data && (
            <>
              <Badge variant="secondary">{data.roles.length + data.clusterRoles.length} Roles</Badge>
              <Badge variant="secondary">{data.roleBindings.length + data.clusterRoleBindings.length} Bindings</Badge>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Create</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowCreateRole(true)}>Role / ClusterRole</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreateBinding(true)}>RoleBinding / ClusterRoleBinding</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="RBAC">RBAC</LearnTooltip> controls who can do what in your cluster.
        The pattern is: <LearnTooltip term="Subject">Subject</LearnTooltip> {"→"}{" "}
        <LearnTooltip term="RoleBinding">Binding</LearnTooltip> {"→"}{" "}
        <LearnTooltip term="Role">Role</LearnTooltip> {"→"} Resources.
        Click any node in the graph to view details and edit.
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[600px]" />
      ) : data ? (
        <Tabs defaultValue="graph">
          <TabsList>
            <TabsTrigger value="graph" className="gap-2"><GitGraph className="h-3.5 w-3.5" /> Graph View</TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2"><Table className="h-3.5 w-3.5" /> Matrix View</TabsTrigger>
            <TabsTrigger value="query" className="gap-2"><Search className="h-3.5 w-3.5" /> Who Can?</TabsTrigger>
          </TabsList>
          <TabsContent value="graph" className="mt-4">
            <RBACGraph data={data} onNodeClick={handleNodeClick} />
          </TabsContent>
          <TabsContent value="matrix" className="mt-4">
            <RBACMatrix data={data} />
          </TabsContent>
          <TabsContent value="query" className="mt-4">
            <WhoCanQuery data={data} />
          </TabsContent>
        </Tabs>
      ) : null}

      <RoleDetail role={selectedRole} onClose={() => setSelectedRole(null)} />
      <BindingDetail binding={selectedBinding} onClose={() => setSelectedBinding(null)} />
      <CreateRoleWizard open={showCreateRole} onClose={() => setShowCreateRole(false)} />
      <CreateBindingWizard open={showCreateBinding} onClose={() => setShowCreateBinding(false)} roles={roleList} />
    </div>
  );
}
