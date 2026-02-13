"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import { Plus, X, Search } from "lucide-react";

interface CreateServiceAccountWizardProps {
  open: boolean;
  onClose: () => void;
  roles?: { name: string; kind: string }[];
}

export function CreateServiceAccountWizard({ open, onClose, roles = [] }: CreateServiceAccountWizardProps) {
  const [step, setStep] = useState(0);
  const { availableNamespaces } = useClusterStore();
  const { addChange, addChanges } = useChangesStore();

  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [assignRole, setAssignRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ kind: string; name: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState("");

  const steps = [
    { title: "Name & Namespace", description: "Choose a name and namespace for the service account" },
    { title: "Assign Role?", description: "Optionally bind a role to this service account", optional: true },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const canProceed = step === 0 ? name.trim().length > 0 && namespace.length > 0 : true;
  const filteredRoles = roles.filter((r) => !roleFilter || r.name.toLowerCase().includes(roleFilter.toLowerCase()));

  const handleComplete = () => {
    const changes = [];
    changes.push({
      id: generateChangeId(),
      action: "create" as const,
      resourceKind: "ServiceAccount",
      resourceName: name,
      namespace,
      before: null,
      after: {},
      description: `Create ServiceAccount "${name}" in "${namespace}"`,
    });

    if (assignRole && selectedRole) {
      changes.push({
        id: generateChangeId(),
        action: "create" as const,
        resourceKind: "RoleBinding",
        resourceName: `${name}-${selectedRole.name}`,
        namespace,
        before: null,
        after: {
          roleRef: { kind: selectedRole.kind, name: selectedRole.name, apiGroup: "rbac.authorization.k8s.io" },
          subjects: [{ kind: "ServiceAccount", name, namespace }],
        },
        description: `Bind "${selectedRole.name}" to ServiceAccount "${name}"`,
      });
    }

    addChanges(changes);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0); setName(""); setNamespace(""); setAssignRole(false); setSelectedRole(null);
    onClose();
  };

  return (
    <WizardShell open={open} onClose={resetAndClose} title="Create Service Account" steps={steps} currentStep={step} onStepChange={setStep} onComplete={handleComplete} canProceed={canProceed}>
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Service Account Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., my-app-sa" />
          </div>
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
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={assignRole} onCheckedChange={setAssignRole} />
            <Label className="text-xs">Assign a role to this service account</Label>
          </div>
          {assignRole && (
            <div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-8 text-xs" placeholder="Filter roles..." value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
              </div>
              <ScrollArea className="h-[200px] mt-2 border rounded-lg">
                {filteredRoles.map((r) => (
                  <button
                    key={`${r.kind}:${r.name}`}
                    onClick={() => setSelectedRole({ kind: r.kind, name: r.name })}
                    className={`w-full text-left p-2 text-xs flex items-center gap-2 hover:bg-muted/50 ${selectedRole?.name === r.name ? "bg-primary/10" : ""}`}
                  >
                    <Badge variant="outline" className="text-[9px]">{r.kind}</Badge>
                    {r.name}
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="border rounded-lg p-4 text-xs space-y-2">
          <h4 className="text-sm font-medium">Summary:</h4>
          <p><strong>ServiceAccount:</strong> {name}</p>
          <p><strong>Namespace:</strong> {namespace}</p>
          {assignRole && selectedRole && (
            <p><strong>Role Binding:</strong> {selectedRole.kind}/{selectedRole.name}</p>
          )}
        </div>
      )}
    </WizardShell>
  );
}
