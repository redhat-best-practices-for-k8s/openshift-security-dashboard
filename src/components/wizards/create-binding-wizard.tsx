"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import type { RBACSubject } from "@/types";
import { Plus, X, Search } from "lucide-react";

interface CreateBindingWizardProps {
  open: boolean;
  onClose: () => void;
  roles?: { name: string; kind: string; namespace?: string }[];
}

export function CreateBindingWizard({ open, onClose, roles = [] }: CreateBindingWizardProps) {
  const [step, setStep] = useState(0);
  const { availableNamespaces } = useClusterStore();
  const { addChange } = useChangesStore();

  const [name, setName] = useState("");
  const [isCluster, setIsCluster] = useState(false);
  const [namespace, setNamespace] = useState("");
  const [selectedRole, setSelectedRole] = useState<{ kind: string; name: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [subjects, setSubjects] = useState<RBACSubject[]>([]);

  const steps = [
    { title: "Select Role", description: "Choose which role to bind" },
    { title: "Select Subjects", description: "Choose who receives this role's permissions" },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const canProceed = (() => {
    switch (step) {
      case 0: return selectedRole !== null && name.trim().length > 0 && (isCluster || namespace.length > 0);
      case 1: return subjects.some((s) => s.name.trim().length > 0);
      case 2: return true;
      default: return false;
    }
  })();

  const filteredRoles = roles.filter((r) => !roleFilter || r.name.toLowerCase().includes(roleFilter.toLowerCase()));

  const handleComplete = () => {
    if (!selectedRole) return;
    const kind = isCluster ? "ClusterRoleBinding" : "RoleBinding";
    addChange({
      id: generateChangeId(),
      action: "create",
      resourceKind: kind,
      resourceName: name,
      namespace: isCluster ? undefined : namespace,
      before: null,
      after: {
        roleRef: { kind: selectedRole.kind, name: selectedRole.name, apiGroup: "rbac.authorization.k8s.io" },
        subjects: subjects.filter((s) => s.name.trim()),
      },
      description: `Create ${kind} "${name}" binding "${selectedRole.name}" to ${subjects.length} subject(s)`,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0);
    setName("");
    setIsCluster(false);
    setNamespace("");
    setSelectedRole(null);
    setSubjects([]);
    onClose();
  };

  return (
    <WizardShell open={open} onClose={resetAndClose} title="Create Binding" steps={steps} currentStep={step} onStepChange={setStep} onComplete={handleComplete} canProceed={canProceed}>
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Binding Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., dev-pod-readers" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isCluster} onCheckedChange={setIsCluster} />
            <Label className="text-xs">Cluster-wide (ClusterRoleBinding)</Label>
          </div>
          {!isCluster && (
            <div>
              <Label className="text-xs">Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select namespace" /></SelectTrigger>
                <SelectContent>
                  {availableNamespaces.map((ns) => (
                    <SelectItem key={ns} value={ns} className="text-xs">{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Select Role</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-xs" placeholder="Filter roles..." value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
            </div>
            <ScrollArea className="h-[200px] mt-2 border rounded-lg">
              {filteredRoles.map((r) => (
                <button
                  key={`${r.kind}:${r.name}`}
                  onClick={() => setSelectedRole({ kind: r.kind, name: r.name })}
                  className={`w-full text-left p-2 text-xs flex items-center gap-2 hover:bg-muted/50 ${selectedRole?.name === r.name && selectedRole?.kind === r.kind ? "bg-primary/10" : ""}`}
                >
                  <Badge variant="outline" className="text-[9px]">{r.kind}</Badge>
                  {r.name}
                  {r.namespace && <span className="text-muted-foreground">({r.namespace})</span>}
                </button>
              ))}
              {filteredRoles.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No roles found</p>}
            </ScrollArea>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {subjects.map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2 border rounded-lg">
              <Select value={s.kind} onValueChange={(v) => { const next = [...subjects]; next[i] = { ...s, kind: v as RBACSubject["kind"] }; setSubjects(next); }}>
                <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="User" className="text-xs">User</SelectItem>
                  <SelectItem value="Group" className="text-xs">Group</SelectItem>
                  <SelectItem value="ServiceAccount" className="text-xs">ServiceAccount</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-7 text-xs flex-1" value={s.name} onChange={(e) => { const next = [...subjects]; next[i] = { ...s, name: e.target.value }; setSubjects(next); }} placeholder="Name" />
              {s.kind === "ServiceAccount" && (
                <Input className="h-7 text-xs w-[120px]" value={s.namespace || ""} onChange={(e) => { const next = [...subjects]; next[i] = { ...s, namespace: e.target.value }; setSubjects(next); }} placeholder="Namespace" />
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSubjects([...subjects, { kind: "User", name: "" }])} className="gap-1 text-xs w-full">
            <Plus className="h-3 w-3" /> Add Subject
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Summary:</h4>
          <div className="text-xs space-y-1">
            <p><strong>Type:</strong> {isCluster ? "ClusterRoleBinding" : "RoleBinding"}</p>
            <p><strong>Name:</strong> {name}</p>
            {!isCluster && <p><strong>Namespace:</strong> {namespace}</p>}
            <p><strong>Role:</strong> {selectedRole?.kind}/{selectedRole?.name}</p>
            <p><strong>Subjects:</strong></p>
            {subjects.filter((s) => s.name).map((s, i) => (
              <div key={i} className="ml-4">- {s.kind}/{s.name}{s.namespace ? ` (${s.namespace})` : ""}</div>
            ))}
          </div>
        </div>
      )}
    </WizardShell>
  );
}
