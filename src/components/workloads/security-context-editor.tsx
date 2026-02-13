"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { ContainerSecurityContext, WorkloadResource } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { Check, AlertTriangle, Info } from "lucide-react";

const COMMON_CAPABILITIES = ["NET_BIND_SERVICE", "NET_RAW", "NET_ADMIN", "SYS_ADMIN", "SYS_PTRACE", "CHOWN", "DAC_OVERRIDE", "FSETID", "FOWNER", "MKNOD", "SETGID", "SETUID", "SETFCAP", "SETPCAP", "KILL", "AUDIT_WRITE"];

interface SecurityContextEditorProps {
  workload: WorkloadResource;
  containerName: string;
  currentContext?: ContainerSecurityContext;
  onClose: () => void;
}

export function SecurityContextEditor({ workload, containerName, currentContext, onClose }: SecurityContextEditorProps) {
  const { addChange } = useChangesStore();

  const [runAsNonRoot, setRunAsNonRoot] = useState(currentContext?.runAsNonRoot ?? false);
  const [runAsUser, setRunAsUser] = useState<string>(currentContext?.runAsUser?.toString() || "");
  const [runAsGroup, setRunAsGroup] = useState<string>(currentContext?.runAsGroup?.toString() || "");
  const [readOnly, setReadOnly] = useState(currentContext?.readOnlyRootFilesystem ?? false);
  const [noEscalation, setNoEscalation] = useState(currentContext?.allowPrivilegeEscalation === false);
  const [privileged, setPrivileged] = useState(currentContext?.privileged ?? false);
  const [dropAll, setDropAll] = useState(currentContext?.capabilities?.drop?.includes("ALL") ?? false);
  const [addCaps, setAddCaps] = useState<string[]>(currentContext?.capabilities?.add || []);
  const [seccompType, setSeccompType] = useState(currentContext?.seccompProfile?.type || "");

  const isPod = workload.kind === "Pod";

  const handleSave = () => {
    const newContext: ContainerSecurityContext = {
      runAsNonRoot,
      ...(runAsUser ? { runAsUser: parseInt(runAsUser) } : {}),
      ...(runAsGroup ? { runAsGroup: parseInt(runAsGroup) } : {}),
      readOnlyRootFilesystem: readOnly,
      allowPrivilegeEscalation: !noEscalation,
      privileged,
      capabilities: {
        drop: dropAll ? ["ALL"] : [],
        add: addCaps.length > 0 ? addCaps : undefined,
      },
      ...(seccompType ? { seccompProfile: { type: seccompType } } : {}),
    };

    addChange({
      id: generateChangeId(),
      action: "update",
      resourceKind: workload.kind,
      resourceName: workload.name,
      namespace: workload.namespace,
      before: { containerName, securityContext: currentContext || {} },
      after: {
        containerPatches: [{ name: containerName, securityContext: newContext }],
      },
      description: `Update security context for container "${containerName}" in ${workload.kind} "${workload.name}"`,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      {isPod && (
        <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />
          <span>Pods are immutable. This change will be staged but can only be applied by updating the parent Deployment/StatefulSet/DaemonSet.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-xs font-medium">User & Group</h4>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-xs"><FieldLabel term="RunAsNonRoot">Run as Non-Root</FieldLabel></Label>
            <Switch checked={runAsNonRoot} onCheckedChange={setRunAsNonRoot} />
          </div>
          <div>
            <Label className="text-xs"><FieldLabel term="RunAsUser">Run As User (UID)</FieldLabel></Label>
            <Input className="h-7 text-xs mt-1" type="number" value={runAsUser} onChange={(e) => setRunAsUser(e.target.value)} placeholder="e.g., 1000" />
          </div>
          <div>
            <Label className="text-xs"><FieldLabel term="RunAsGroup">Run As Group (GID)</FieldLabel></Label>
            <Input className="h-7 text-xs mt-1" type="number" value={runAsGroup} onChange={(e) => setRunAsGroup(e.target.value)} placeholder="e.g., 1000" />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium">Filesystem & Privileges</h4>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-xs"><FieldLabel term="ReadOnlyRootFilesystem">Read-Only Root FS</FieldLabel></Label>
            <Switch checked={readOnly} onCheckedChange={setReadOnly} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <Label className="text-xs"><FieldLabel term="AllowPrivilegeEscalation">Block Privilege Escalation</FieldLabel></Label>
            <Switch checked={noEscalation} onCheckedChange={setNoEscalation} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg border">
            <div className="flex items-center gap-1">
              {privileged && <AlertTriangle className="h-3 w-3 text-red-500" />}
              <Label className="text-xs"><FieldLabel term="Privileged">Privileged</FieldLabel></Label>
            </div>
            <Switch checked={privileged} onCheckedChange={setPrivileged} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium">Capabilities</h4>
        <div className="flex items-center justify-between p-2 rounded-lg border">
          <Label className="text-xs"><FieldLabel term="DropCapabilities">Drop ALL Capabilities</FieldLabel></Label>
          <Switch checked={dropAll} onCheckedChange={setDropAll} />
        </div>
        {dropAll && (
          <div>
            <Label className="text-xs mb-1 block">Add Back (only what is needed)</Label>
            <div className="flex flex-wrap gap-1">
              {COMMON_CAPABILITIES.map((cap) => (
                <button
                  key={cap}
                  onClick={() => setAddCaps(addCaps.includes(cap) ? addCaps.filter((c) => c !== cap) : [...addCaps, cap])}
                  className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${addCaps.includes(cap) ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80"}`}
                >
                  {cap}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-medium"><FieldLabel term="SeccompProfile">Seccomp Profile</FieldLabel></h4>
        <Select value={seccompType || "none"} onValueChange={(v) => setSeccompType(v === "none" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Not set" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">Not set</SelectItem>
            <SelectItem value="RuntimeDefault" className="text-xs">RuntimeDefault (recommended)</SelectItem>
            <SelectItem value="Localhost" className="text-xs">Localhost</SelectItem>
            <SelectItem value="Unconfined" className="text-xs">Unconfined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button size="sm" onClick={handleSave} className="gap-1 text-xs">
          <Check className="h-3 w-3" /> Save to Preview
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
      </div>
    </div>
  );
}
