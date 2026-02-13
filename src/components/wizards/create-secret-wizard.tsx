"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import { Plus, X } from "lucide-react";

interface CreateSecretWizardProps {
  open: boolean;
  onClose: () => void;
}

export function CreateSecretWizard({ open, onClose }: CreateSecretWizardProps) {
  const [step, setStep] = useState(0);
  const { availableNamespaces } = useClusterStore();
  const { addChange } = useChangesStore();

  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [secretType, setSecretType] = useState("Opaque");
  const [entries, setEntries] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  const steps = [
    { title: "Name & Type", description: "Choose a name, namespace, and secret type" },
    { title: "Data", description: "Add key-value pairs for the secret" },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const canProceed = step === 0 ? name.trim().length > 0 && namespace.length > 0 : step === 1 ? entries.some((e) => e.key.trim()) : true;

  const handleComplete = () => {
    const data: Record<string, string> = {};
    entries.forEach((e) => { if (e.key.trim()) data[e.key.trim()] = e.value; });

    addChange({
      id: generateChangeId(),
      action: "create",
      resourceKind: "Secret",
      resourceName: name,
      namespace,
      before: null,
      after: { type: secretType, data },
      description: `Create Secret "${name}" in "${namespace}"`,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0); setName(""); setNamespace(""); setSecretType("Opaque"); setEntries([{ key: "", value: "" }]);
    onClose();
  };

  return (
    <WizardShell open={open} onClose={resetAndClose} title="Create Secret" steps={steps} currentStep={step} onStepChange={setStep} onComplete={handleComplete} canProceed={canProceed}>
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Secret Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., my-app-config" />
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
          <div>
            <Label className="text-xs">Secret Type</Label>
            <Select value={secretType} onValueChange={setSecretType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Opaque" className="text-xs">Opaque (generic)</SelectItem>
                <SelectItem value="kubernetes.io/tls" className="text-xs">TLS Certificate</SelectItem>
                <SelectItem value="kubernetes.io/dockerconfigjson" className="text-xs">Docker Config</SelectItem>
                <SelectItem value="kubernetes.io/basic-auth" className="text-xs">Basic Auth</SelectItem>
                <SelectItem value="kubernetes.io/ssh-auth" className="text-xs">SSH Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Input className="h-7 text-xs" value={entry.key} onChange={(e) => { const next = [...entries]; next[i] = { ...entry, key: e.target.value }; setEntries(next); }} placeholder="Key" />
                <Textarea className="text-xs min-h-[60px] resize-y" value={entry.value} onChange={(e) => { const next = [...entries]; next[i] = { ...entry, value: e.target.value }; setEntries(next); }} placeholder="Value" />
              </div>
              {entries.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 mt-0.5" onClick={() => setEntries(entries.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setEntries([...entries, { key: "", value: "" }])} className="gap-1 text-xs w-full">
            <Plus className="h-3 w-3" /> Add Entry
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="border rounded-lg p-4 text-xs space-y-2">
          <h4 className="text-sm font-medium">Summary:</h4>
          <p><strong>Name:</strong> {name}</p>
          <p><strong>Namespace:</strong> {namespace}</p>
          <p><strong>Type:</strong> {secretType}</p>
          <p><strong>Keys:</strong> {entries.filter((e) => e.key.trim()).map((e) => e.key).join(", ")}</p>
        </div>
      )}
    </WizardShell>
  );
}
