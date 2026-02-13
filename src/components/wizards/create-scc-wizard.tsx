"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { AlertTriangle } from "lucide-react";

interface CreateSCCWizardProps {
  open: boolean;
  onClose: () => void;
}

export function CreateSCCWizard({ open, onClose }: CreateSCCWizardProps) {
  const [step, setStep] = useState(0);
  const { addChange } = useChangesStore();

  const [name, setName] = useState("");
  const [allowPrivileged, setAllowPrivileged] = useState(false);
  const [allowEscalation, setAllowEscalation] = useState(false);
  const [allowHostNetwork, setAllowHostNetwork] = useState(false);
  const [allowHostPID, setAllowHostPID] = useState(false);
  const [allowHostIPC, setAllowHostIPC] = useState(false);
  const [allowHostDirs, setAllowHostDirs] = useState(false);
  const [readOnlyRoot, setReadOnlyRoot] = useState(true);
  const [runAsUserType, setRunAsUserType] = useState("MustRunAsRange");
  const [dropCaps, setDropCaps] = useState("ALL");

  const steps = [
    { title: "Name", description: "Choose a name for the SCC" },
    { title: "Container Privileges", description: "Configure what containers are allowed to do" },
    { title: "Host Access", description: "Configure host-level access permissions" },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const warnings: string[] = [];
  if (allowPrivileged) warnings.push("Privileged containers have full host access");
  if (allowHostNetwork) warnings.push("Host networking bypasses network policies");
  if (runAsUserType === "RunAsAny") warnings.push("Containers can run as root");
  if (allowEscalation) warnings.push("Privilege escalation is allowed");

  const canProceed = step === 0 ? name.trim().length > 0 : true;

  const handleComplete = () => {
    addChange({
      id: generateChangeId(),
      action: "create",
      resourceKind: "SecurityContextConstraints",
      resourceName: name,
      before: null,
      after: {
        allowPrivilegedContainer: allowPrivileged,
        allowPrivilegeEscalation: allowEscalation,
        allowHostNetwork,
        allowHostPID,
        allowHostIPC,
        allowHostDirVolumePlugin: allowHostDirs,
        readOnlyRootFilesystem: readOnlyRoot,
        runAsUser: { type: runAsUserType },
        requiredDropCapabilities: dropCaps ? dropCaps.split(",").map((s) => s.trim()) : [],
        seLinuxContext: { type: "MustRunAs" },
        fsGroup: { type: "MustRunAs" },
        supplementalGroups: { type: "RunAsAny" },
        volumes: ["configMap", "downwardAPI", "emptyDir", "persistentVolumeClaim", "projected", "secret"],
      },
      description: `Create SCC "${name}"`,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0);
    setName("");
    setAllowPrivileged(false);
    setAllowEscalation(false);
    setAllowHostNetwork(false);
    setAllowHostPID(false);
    setAllowHostIPC(false);
    setAllowHostDirs(false);
    setReadOnlyRoot(true);
    setRunAsUserType("MustRunAsRange");
    setDropCaps("ALL");
    onClose();
  };

  const ToggleRow = ({ label, value, onChange, dangerous }: { label: string; value: boolean; onChange: (v: boolean) => void; dangerous?: boolean }) => (
    <div className="flex items-center justify-between p-2 rounded-lg border">
      <div className="flex items-center gap-2">
        {dangerous && value && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        <Label className="text-xs cursor-pointer">{label}</Label>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <WizardShell open={open} onClose={resetAndClose} title="Create Security Context Constraint" steps={steps} currentStep={step} onStepChange={setStep} onComplete={handleComplete} canProceed={canProceed}>
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">SCC Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., my-restricted-scc" />
          </div>
          <p className="text-xs text-muted-foreground">This SCC will be created in the cluster and can be assigned to service accounts via RBAC.</p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <ToggleRow label="Allow Privileged Containers" value={allowPrivileged} onChange={setAllowPrivileged} dangerous />
          <ToggleRow label="Allow Privilege Escalation" value={allowEscalation} onChange={setAllowEscalation} dangerous />
          <div className="p-2 rounded-lg border">
            <Label className="text-xs">Run As User Strategy</Label>
            <Select value={runAsUserType} onValueChange={setRunAsUserType}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MustRunAsRange" className="text-xs">MustRunAsRange (recommended)</SelectItem>
                <SelectItem value="MustRunAsNonRoot" className="text-xs">MustRunAsNonRoot</SelectItem>
                <SelectItem value="RunAsAny" className="text-xs">RunAsAny (dangerous)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ToggleRow label="Read-Only Root Filesystem" value={readOnlyRoot} onChange={setReadOnlyRoot} />
          <div className="p-2 rounded-lg border">
            <Label className="text-xs">Required Drop Capabilities</Label>
            <Input className="mt-1 h-8 text-xs" value={dropCaps} onChange={(e) => setDropCaps(e.target.value)} placeholder="e.g., ALL, NET_RAW" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <ToggleRow label="Allow Host Network" value={allowHostNetwork} onChange={setAllowHostNetwork} dangerous />
          <ToggleRow label="Allow Host PID" value={allowHostPID} onChange={setAllowHostPID} dangerous />
          <ToggleRow label="Allow Host IPC" value={allowHostIPC} onChange={setAllowHostIPC} dangerous />
          <ToggleRow label="Allow Host Directory Volumes" value={allowHostDirs} onChange={setAllowHostDirs} dangerous />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="border rounded-lg p-4 text-xs space-y-2">
            <h4 className="text-sm font-medium mb-2">SCC: {name}</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>Privileged: <Badge variant={allowPrivileged ? "destructive" : "secondary"} className="text-[10px]">{allowPrivileged ? "Yes" : "No"}</Badge></div>
              <div>Escalation: <Badge variant={allowEscalation ? "destructive" : "secondary"} className="text-[10px]">{allowEscalation ? "Yes" : "No"}</Badge></div>
              <div>Host Network: <Badge variant={allowHostNetwork ? "destructive" : "secondary"} className="text-[10px]">{allowHostNetwork ? "Yes" : "No"}</Badge></div>
              <div>Run As: <Badge variant="outline" className="text-[10px]">{runAsUserType}</Badge></div>
              <div>Read-Only Root: <Badge variant={readOnlyRoot ? "secondary" : "outline"} className="text-[10px]">{readOnlyRoot ? "Yes" : "No"}</Badge></div>
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-700 flex items-center gap-1 mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Warnings</p>
              {warnings.map((w, i) => <p key={i} className="text-xs text-yellow-600 ml-5">- {w}</p>)}
            </div>
          )}
        </div>
      )}
    </WizardShell>
  );
}
