"use client";

import { useState } from "react";
import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { ResourceLink } from "@/components/shared/resource-link";
import { SecurityContextEditor } from "./security-context-editor";
import { PortAnalysis } from "./port-analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { WorkloadResource, ContainerSecurityInfo } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { Shield, ShieldAlert, ShieldCheck, Box, Pencil, Network, HardDrive, User, Lock } from "lucide-react";

interface PodDetailProps {
  workload: WorkloadResource | null;
  onClose: () => void;
  /** Available SCCs for the workload's service account (from unified resolver) */
  availableSCCs?: string[];
}

function SecurityBadge({ sc }: { sc?: { privileged?: boolean; runAsNonRoot?: boolean; readOnlyRootFilesystem?: boolean; allowPrivilegeEscalation?: boolean; capabilities?: { drop?: string[] } } }) {
  if (!sc) return <Badge variant="outline" className="text-[10px] text-yellow-600 gap-1"><ShieldAlert className="h-3 w-3" />No context</Badge>;
  if (sc.privileged) return <Badge variant="destructive" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" />Privileged</Badge>;
  const hardened = sc.runAsNonRoot && sc.readOnlyRootFilesystem && sc.allowPrivilegeEscalation === false && sc.capabilities?.drop?.includes("ALL");
  if (hardened) return <Badge className="text-[10px] gap-1 bg-green-500"><ShieldCheck className="h-3 w-3" />Hardened</Badge>;
  return <Badge variant="secondary" className="text-[10px] gap-1"><Shield className="h-3 w-3" />Partial</Badge>;
}

function ContainerCard({ container, workload, onEditSecurity }: { container: ContainerSecurityInfo; workload: WorkloadResource; onEditSecurity: () => void }) {
  const sc = container.securityContext;
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{container.name}</span>
          <SecurityBadge sc={sc} />
        </div>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={onEditSecurity}>
          <Pencil className="h-2.5 w-2.5" /> Edit Security
        </Button>
      </div>
      <div className="text-[10px] text-muted-foreground">{container.image}</div>

      {sc && (
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {sc.runAsNonRoot ? "Non-root" : sc.runAsUser !== undefined ? `UID ${sc.runAsUser}` : "Default user"}
          </div>
          <div><FieldLabel term="ReadOnlyRootFilesystem">RO root</FieldLabel>: {sc.readOnlyRootFilesystem ? "Yes" : "No"}</div>
          <div><FieldLabel term="AllowPrivilegeEscalation">Escalation</FieldLabel>: {sc.allowPrivilegeEscalation === false ? "Blocked" : "Allowed"}</div>
          <div><FieldLabel term="Privileged">Privileged</FieldLabel>: {sc.privileged ? "Yes" : "No"}</div>
          {sc.capabilities?.drop && sc.capabilities.drop.length > 0 && (
            <div className="col-span-2">Drop: {sc.capabilities.drop.join(", ")}</div>
          )}
          {sc.capabilities?.add && sc.capabilities.add.length > 0 && (
            <div className="col-span-2">Add: {sc.capabilities.add.join(", ")}</div>
          )}
        </div>
      )}

      {container.ports.length > 0 && (
        <div className="text-[10px]">
          <span className="text-muted-foreground">Ports: </span>
          {container.ports.map((p) => `${p.containerPort}/${p.protocol}`).join(", ")}
        </div>
      )}
    </div>
  );
}

export function PodDetail({ workload, onClose, availableSCCs }: PodDetailProps) {
  const [editingContainer, setEditingContainer] = useState<string | null>(null);

  if (!workload) return null;

  const psp = workload.podSecurityPosture;
  const editContainer = workload.containers.find((c) => c.name === editingContainer);

  return (
    <ResourceDetailSheet
      open={!!workload}
      onClose={onClose}
      title={workload.name}
      kind={workload.kind}
      namespace={workload.namespace}
      aiContext={`${workload.containers.length} container(s): ${workload.containers.map((c) => `${c.name} (${c.image}${c.securityContext?.privileged ? ", PRIVILEGED" : ""}${c.securityContext?.runAsNonRoot ? ", nonRoot" : ""})`).join("; ")}. SA: ${workload.podSecurityPosture.serviceAccountName}. HostNetwork: ${workload.podSecurityPosture.hostNetwork}. Ports: ${workload.containers.flatMap((c) => c.ports.map((p) => `${p.containerPort}/${p.protocol}`)).join(",") || "none"}.`}
    >
      {/* Status */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[10px]">{workload.status || "Unknown"}</Badge>
        {workload.replicas !== undefined && (
          <span className="text-muted-foreground">{workload.readyReplicas || 0}/{workload.replicas} ready</span>
        )}
        {workload.creationTimestamp && (
          <span className="text-muted-foreground">Created {new Date(workload.creationTimestamp).toLocaleDateString()}</span>
        )}
      </div>

      {/* Pod-level security */}
      <div>
        <h4 className="text-xs font-medium mb-2">Pod Security Posture</h4>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2 rounded border flex items-center gap-1.5">
            <Network className="h-3 w-3" />
            <FieldLabel term="HostNetwork">Host Network</FieldLabel>: <Badge variant={psp.hostNetwork ? "destructive" : "secondary"} className="text-[9px]">{psp.hostNetwork ? "Yes" : "No"}</Badge>
          </div>
          <div className="p-2 rounded border flex items-center gap-1.5">
            <FieldLabel term="HostPID">Host PID</FieldLabel>: <Badge variant={psp.hostPID ? "destructive" : "secondary"} className="text-[9px]">{psp.hostPID ? "Yes" : "No"}</Badge>
          </div>
          <div className="p-2 rounded border flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <FieldLabel term="ServiceAccount">SA</FieldLabel>: {psp.serviceAccountName}
          </div>
          <div className="p-2 rounded border flex items-center gap-1.5">
            <FieldLabel term="AutomountServiceAccountToken">Token</FieldLabel>: <Badge variant={psp.automountServiceAccountToken ? "outline" : "secondary"} className="text-[9px]">{psp.automountServiceAccountToken ? "Mounted" : "Disabled"}</Badge>
          </div>
          {workload.appliedSCC && (
            <div className="p-2 rounded border col-span-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                <FieldLabel term="AppliedSCC">Applied SCC</FieldLabel>: <ResourceLink kind="SCC" name={workload.appliedSCC} />
              </div>
              {availableSCCs && availableSCCs.length > 0 && (
                <div className="text-[9px] text-muted-foreground">
                  Selected by admission controller from {availableSCCs.length} available SCC{availableSCCs.length !== 1 ? "s" : ""} for SA &quot;{psp.serviceAccountName}&quot;
                </div>
              )}
            </div>
          )}
          {availableSCCs && availableSCCs.length > 0 && (
            <div className="p-2 rounded border col-span-2 space-y-1">
              <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Shield className="h-3 w-3" /> <FieldLabel term="AvailableSCCs">Available SCCs</FieldLabel> for SA &quot;{psp.serviceAccountName}&quot;
              </div>
              <div className="flex flex-wrap gap-1">
                {availableSCCs.map((scc) => (
                  <ResourceLink key={scc} kind="SCC" name={scc} compact />
                ))}
              </div>
            </div>
          )}
        </div>
        {psp.volumes.length > 0 && (
          <div className="mt-2 text-[10px]">
            <span className="text-muted-foreground">Volumes: </span>
            {psp.volumes.map((v) => (
              <Badge key={v.name} variant={v.type === "hostPath" ? "destructive" : "outline"} className="text-[9px] mr-1">{v.name} ({v.type})</Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Containers */}
      <div>
        <h4 className="text-xs font-medium mb-2">Containers ({workload.containers.length})</h4>
        {editingContainer && editContainer ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-[10px]">Editing: {editingContainer}</Badge>
            </div>
            <SecurityContextEditor
              workload={workload}
              containerName={editingContainer}
              currentContext={editContainer.securityContext}
              onClose={() => setEditingContainer(null)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {workload.containers.map((c) => (
              <ContainerCard key={c.name} container={c} workload={workload} onEditSecurity={() => setEditingContainer(c.name)} />
            ))}
          </div>
        )}
      </div>

      {workload.initContainers && workload.initContainers.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-medium mb-2">Init Containers ({workload.initContainers.length})</h4>
            <div className="space-y-2">
              {workload.initContainers.map((c) => (
                <ContainerCard key={c.name} container={c} workload={workload} onEditSecurity={() => setEditingContainer(c.name)} />
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Ports */}
      <div>
        <h4 className="text-xs font-medium mb-2 flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Port Analysis</h4>
        <PortAnalysis workload={workload} />
      </div>
    </ResourceDetailSheet>
  );
}
