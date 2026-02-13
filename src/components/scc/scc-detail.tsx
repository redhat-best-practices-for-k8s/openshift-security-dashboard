"use client";

import { useState } from "react";
import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { SecurityContextConstraint } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { Check, AlertTriangle, Plus, X } from "lucide-react";

interface SCCDetailProps {
  scc: SecurityContextConstraint | null;
  onClose: () => void;
}

const ALL_VOLUME_TYPES = [
  "configMap", "downwardAPI", "emptyDir", "hostPath", "nfs", "persistentVolumeClaim",
  "projected", "secret", "csi", "ephemeral", "flexVolume", "iscsi", "fc",
  "azureDisk", "azureFile", "cephFS", "cinder", "gcePersistentDisk", "awsElasticBlockStore",
  "gitRepo", "glusterfs", "rbd", "storageos", "vsphereVolume", "*",
];

const COMMON_CAPABILITIES = [
  "ALL", "NET_BIND_SERVICE", "NET_RAW", "NET_ADMIN", "SYS_ADMIN", "SYS_PTRACE",
  "SYS_CHROOT", "SYS_TIME", "CHOWN", "DAC_OVERRIDE", "FSETID", "FOWNER",
  "MKNOD", "SETGID", "SETUID", "SETFCAP", "SETPCAP", "KILL", "AUDIT_WRITE",
  "DAC_READ_SEARCH", "LINUX_IMMUTABLE", "SYS_RAWIO", "SYS_MODULE",
];

function TagListEditor({ values, onChange, placeholder, suggestions }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[] }) {
  const [input, setInput] = useState("");

  const addValue = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const removeValue = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="outline" className="text-[10px] gap-1 pr-1">
            {v}
            <button onClick={() => removeValue(v)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          className="h-7 text-[10px] flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(input); } }}
        />
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => addValue(input)}>
          <Plus className="h-2.5 w-2.5" />
        </Button>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.filter((s) => !values.includes(s)).slice(0, 12).map((s) => (
            <button
              key={s}
              onClick={() => addValue(s)}
              className="text-[9px] px-1.5 py-0.5 rounded border bg-muted hover:bg-muted/80 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SCCDetail({ scc, onClose }: SCCDetailProps) {
  const [editing, setEditing] = useState(false);
  const { addChange } = useChangesStore();

  // All editable fields as individual state
  const [allowPrivilegedContainer, setAllowPrivilegedContainer] = useState(false);
  const [allowPrivilegeEscalation, setAllowPrivilegeEscalation] = useState(false);
  const [allowHostNetwork, setAllowHostNetwork] = useState(false);
  const [allowHostPID, setAllowHostPID] = useState(false);
  const [allowHostIPC, setAllowHostIPC] = useState(false);
  const [allowHostDirVolumePlugin, setAllowHostDirVolumePlugin] = useState(false);
  const [allowHostPorts, setAllowHostPorts] = useState(false);
  const [readOnlyRootFilesystem, setReadOnlyRootFilesystem] = useState(false);
  const [runAsUserType, setRunAsUserType] = useState("RunAsAny");
  const [seLinuxType, setSeLinuxType] = useState("RunAsAny");
  const [fsGroupType, setFsGroupType] = useState("RunAsAny");
  const [supplementalGroupsType, setSupplementalGroupsType] = useState("RunAsAny");
  const [priority, setPriority] = useState("");
  const [volumes, setVolumes] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [allowedCapabilities, setAllowedCapabilities] = useState<string[]>([]);
  const [defaultAddCapabilities, setDefaultAddCapabilities] = useState<string[]>([]);
  const [requiredDropCapabilities, setRequiredDropCapabilities] = useState<string[]>([]);

  if (!scc) return null;

  const startEditing = () => {
    setAllowPrivilegedContainer(scc.allowPrivilegedContainer);
    setAllowPrivilegeEscalation(scc.allowPrivilegeEscalation);
    setAllowHostNetwork(scc.allowHostNetwork);
    setAllowHostPID(scc.allowHostPID);
    setAllowHostIPC(scc.allowHostIPC);
    setAllowHostDirVolumePlugin(scc.allowHostDirVolumePlugin);
    setAllowHostPorts(scc.allowHostPorts);
    setReadOnlyRootFilesystem(scc.readOnlyRootFilesystem);
    setRunAsUserType(scc.runAsUser.type);
    setSeLinuxType(scc.seLinuxContext.type);
    setFsGroupType(scc.fsGroup.type);
    setSupplementalGroupsType(scc.supplementalGroups.type);
    setPriority(scc.priority !== null ? String(scc.priority) : "");
    setVolumes([...scc.volumes]);
    setUsers([...scc.users]);
    setGroups([...scc.groups]);
    setAllowedCapabilities([...scc.allowedCapabilities]);
    setDefaultAddCapabilities([...scc.defaultAddCapabilities]);
    setRequiredDropCapabilities([...scc.requiredDropCapabilities]);
    setEditing(true);
  };

  const handleSave = () => {
    const updated: SecurityContextConstraint = {
      ...scc,
      allowPrivilegedContainer,
      allowPrivilegeEscalation,
      allowHostNetwork,
      allowHostPID,
      allowHostIPC,
      allowHostDirVolumePlugin,
      allowHostPorts,
      readOnlyRootFilesystem,
      runAsUser: { type: runAsUserType },
      seLinuxContext: { type: seLinuxType },
      fsGroup: { type: fsGroupType },
      supplementalGroups: { type: supplementalGroupsType },
      priority: priority ? parseInt(priority) : null,
      volumes,
      users,
      groups,
      allowedCapabilities,
      defaultAddCapabilities,
      requiredDropCapabilities,
    };

    addChange({
      id: generateChangeId(),
      action: "update",
      resourceKind: "SecurityContextConstraints",
      resourceName: scc.name,
      before: { ...scc } as Record<string, unknown>,
      after: { ...updated } as Record<string, unknown>,
      description: `Update SCC "${scc.name}"`,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: "SecurityContextConstraints",
      resourceName: scc.name,
      before: { ...scc },
      after: null,
      description: `Delete SCC "${scc.name}"`,
    });
    onClose();
  };

  const boolFields: Array<{ value: boolean; setter: (v: boolean) => void; label: string; term: string; dangerous: boolean }> = [
    { value: editing ? allowPrivilegedContainer : scc.allowPrivilegedContainer, setter: setAllowPrivilegedContainer, label: "Privileged Containers", term: "AllowPrivilegedContainer", dangerous: true },
    { value: editing ? allowPrivilegeEscalation : scc.allowPrivilegeEscalation, setter: setAllowPrivilegeEscalation, label: "Privilege Escalation", term: "AllowPrivilegeEscalation", dangerous: true },
    { value: editing ? allowHostNetwork : scc.allowHostNetwork, setter: setAllowHostNetwork, label: "Host Network", term: "AllowHostNetwork", dangerous: true },
    { value: editing ? allowHostPID : scc.allowHostPID, setter: setAllowHostPID, label: "Host PID", term: "AllowHostPID", dangerous: true },
    { value: editing ? allowHostIPC : scc.allowHostIPC, setter: setAllowHostIPC, label: "Host IPC", term: "AllowHostIPC", dangerous: true },
    { value: editing ? allowHostDirVolumePlugin : scc.allowHostDirVolumePlugin, setter: setAllowHostDirVolumePlugin, label: "Host Dir Volumes", term: "AllowHostDirVolumes", dangerous: true },
    { value: editing ? allowHostPorts : scc.allowHostPorts, setter: setAllowHostPorts, label: "Host Ports", term: "AllowHostPorts", dangerous: true },
    { value: editing ? readOnlyRootFilesystem : scc.readOnlyRootFilesystem, setter: setReadOnlyRootFilesystem, label: "Read-Only Root FS", term: "ReadOnlyRootFS", dangerous: false },
  ];

  const strategyOptions = [
    { value: "RunAsAny", label: "RunAsAny" },
    { value: "MustRunAs", label: "MustRunAs" },
    { value: "MustRunAsRange", label: "MustRunAsRange" },
    { value: "MustRunAsNonRoot", label: "MustRunAsNonRoot" },
  ];

  return (
    <ResourceDetailSheet
      open={!!scc}
      onClose={() => { setEditing(false); onClose(); }}
      title={scc.name}
      kind="SCC"
      onEdit={startEditing}
      onDelete={handleDelete}
      aiContext={`Privileged: ${scc.allowPrivilegedContainer}, HostNetwork: ${scc.allowHostNetwork}, HostPID: ${scc.allowHostPID}, RunAsUser: ${scc.runAsUser.type}, Volumes: ${scc.volumes.join(",") || "none"}, Users: ${scc.users.length}, Groups: ${scc.groups.length}, AllowedCaps: ${scc.allowedCapabilities.join(",") || "none"}, RequiredDrop: ${scc.requiredDropCapabilities.join(",") || "none"}.`}
    >
      {scc.creationTimestamp && (
        <p className="text-xs text-muted-foreground">Created: {new Date(scc.creationTimestamp).toLocaleString()}</p>
      )}

      {/* Priority */}
      <div className="p-2 rounded-lg border">
        <Label className="text-xs"><FieldLabel term="SCCPriority">Priority</FieldLabel></Label>
        {editing ? (
          <Input
            className="h-7 text-xs mt-1"
            type="number"
            placeholder="null (no priority)"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        ) : (
          <Badge variant="outline" className="text-[10px] ml-2">{scc.priority !== null ? scc.priority : "none"}</Badge>
        )}
      </div>

      {/* Boolean Permissions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Permissions</h4>
        {boolFields.map((field) => (
          <div key={field.label} className="flex items-center justify-between p-2 rounded-lg border">
            <div className="flex items-center gap-2">
              {field.dangerous && field.value && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              <Label className="text-xs"><FieldLabel term={field.term}>{field.label}</FieldLabel></Label>
            </div>
            {editing ? (
              <Switch checked={field.value} onCheckedChange={field.setter} />
            ) : (
              <Badge variant={field.dangerous && field.value ? "destructive" : "secondary"} className="text-[10px]">
                {field.value ? "Yes" : "No"}
              </Badge>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Strategies */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Strategies</h4>
        {[
          { label: "Run As User", term: "RunAsUser", value: editing ? runAsUserType : scc.runAsUser.type, setter: setRunAsUserType },
          { label: "SELinux Context", term: "SELinuxContext", value: editing ? seLinuxType : scc.seLinuxContext.type, setter: setSeLinuxType },
          { label: "FS Group", term: "FSGroup", value: editing ? fsGroupType : scc.fsGroup.type, setter: setFsGroupType },
          { label: "Supplemental Groups", term: "SupplementalGroups", value: editing ? supplementalGroupsType : scc.supplementalGroups.type, setter: setSupplementalGroupsType },
        ].map((strat) => (
          <div key={strat.label} className="p-2 rounded-lg border">
            <Label className="text-xs"><FieldLabel term={strat.term}>{strat.label}</FieldLabel></Label>
            {editing ? (
              <Select value={strat.value} onValueChange={strat.setter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {strategyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-[10px] ml-2">{strat.value}</Badge>
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Capabilities */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Capabilities</h4>

        <div>
          <Label className="text-xs mb-1 block"><FieldLabel term="AllowedCapabilities">Allowed Capabilities</FieldLabel></Label>
          {editing ? (
            <TagListEditor
              values={allowedCapabilities}
              onChange={setAllowedCapabilities}
              placeholder="Add capability..."
              suggestions={COMMON_CAPABILITIES}
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {scc.allowedCapabilities.length > 0
                ? scc.allowedCapabilities.map((c) => <Badge key={c} variant="outline" className="text-[10px] bg-red-500/10 text-red-700">{c}</Badge>)
                : <span className="text-[10px] text-muted-foreground">None</span>}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs mb-1 block"><FieldLabel term="DefaultAddCapabilities">Default Add Capabilities</FieldLabel></Label>
          {editing ? (
            <TagListEditor
              values={defaultAddCapabilities}
              onChange={setDefaultAddCapabilities}
              placeholder="Add capability..."
              suggestions={COMMON_CAPABILITIES}
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {scc.defaultAddCapabilities.length > 0
                ? scc.defaultAddCapabilities.map((c) => <Badge key={c} variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700">{c}</Badge>)
                : <span className="text-[10px] text-muted-foreground">None</span>}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs mb-1 block"><FieldLabel term="RequiredDropCapabilities">Required Drop Capabilities</FieldLabel></Label>
          {editing ? (
            <TagListEditor
              values={requiredDropCapabilities}
              onChange={setRequiredDropCapabilities}
              placeholder="Add capability..."
              suggestions={COMMON_CAPABILITIES}
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {scc.requiredDropCapabilities.length > 0
                ? scc.requiredDropCapabilities.map((c) => <Badge key={c} variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">{c}</Badge>)
                : <span className="text-[10px] text-muted-foreground">None</span>}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Volumes */}
      <div>
        <Label className="text-xs mb-1 block"><FieldLabel term="AllowedVolumes">Allowed Volumes</FieldLabel></Label>
        {editing ? (
          <TagListEditor
            values={volumes}
            onChange={setVolumes}
            placeholder="Add volume type..."
            suggestions={ALL_VOLUME_TYPES}
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {scc.volumes.length > 0
              ? scc.volumes.map((v) => <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>)
              : <span className="text-[10px] text-muted-foreground">None</span>}
          </div>
        )}
      </div>

      <Separator />

      {/* Users */}
      <div>
        <Label className="text-xs mb-1 block"><FieldLabel term="SCCUsers">Users</FieldLabel></Label>
        {editing ? (
          <TagListEditor
            values={users}
            onChange={setUsers}
            placeholder="system:serviceaccount:ns:name"
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {scc.users.length > 0
              ? scc.users.map((u) => <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>)
              : <span className="text-[10px] text-muted-foreground">None</span>}
          </div>
        )}
      </div>

      {/* Groups */}
      <div>
        <Label className="text-xs mb-1 block"><FieldLabel term="SCCGroups">Groups</FieldLabel></Label>
        {editing ? (
          <TagListEditor
            values={groups}
            onChange={setGroups}
            placeholder="system:authenticated"
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {scc.groups.length > 0
              ? scc.groups.map((g) => <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>)
              : <span className="text-[10px] text-muted-foreground">None</span>}
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-2 pt-3">
          <Button size="sm" onClick={handleSave} className="gap-1 text-xs">
            <Check className="h-3 w-3" /> Save to Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
        </div>
      )}
    </ResourceDetailSheet>
  );
}
