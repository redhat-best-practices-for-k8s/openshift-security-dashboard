"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelPicker } from "@/components/network/label-picker";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import type { NetworkPolicyRule, NetworkPolicyPeer } from "@/types";
import { Plus, X } from "lucide-react";

interface CreateNetworkPolicyWizardProps {
  open: boolean;
  onClose: () => void;
}

function PeerEditor({ peer, onChange, onRemove }: { peer: NetworkPolicyPeer; onChange: (p: NetworkPolicyPeer) => void; onRemove: () => void }) {
  const [peerType, setPeerType] = useState<"pod" | "namespace" | "ip">(
    peer.ipBlock ? "ip" : peer.namespaceSelector ? "namespace" : "pod"
  );

  return (
    <div className="border rounded p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Select value={peerType} onValueChange={(v) => {
          setPeerType(v as "pod" | "namespace" | "ip");
          if (v === "pod") onChange({ podSelector: {} });
          else if (v === "namespace") onChange({ namespaceSelector: {} });
          else onChange({ ipBlock: { cidr: "" } });
        }}>
          <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pod" className="text-xs">Pod Selector</SelectItem>
            <SelectItem value="namespace" className="text-xs">Namespace Selector</SelectItem>
            <SelectItem value="ip" className="text-xs">IP Block</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}><X className="h-3 w-3" /></Button>
      </div>
      {peerType === "ip" && (
        <Input className="h-7 text-xs" placeholder="CIDR e.g., 10.0.0.0/8" value={peer.ipBlock?.cidr || ""} onChange={(e) => onChange({ ipBlock: { cidr: e.target.value } })} />
      )}
      {peerType === "pod" && (
        <LabelPicker
          mode="pod"
          value={peer.podSelector || {}}
          onChange={(labels) => onChange({ podSelector: labels })}
          placeholder="Pick pod labels..."
          compact
        />
      )}
      {peerType === "namespace" && (
        <LabelPicker
          mode="namespace"
          value={peer.namespaceSelector || {}}
          onChange={(labels) => onChange({ namespaceSelector: labels })}
          placeholder="Pick namespace labels..."
          compact
        />
      )}
    </div>
  );
}

export function CreateNetworkPolicyWizard({ open, onClose }: CreateNetworkPolicyWizardProps) {
  const [step, setStep] = useState(0);
  const { availableNamespaces } = useClusterStore();
  const { addChange } = useChangesStore();

  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [podSelectorLabels, setPodSelectorLabels] = useState<Record<string, string>>({});
  const [enableIngress, setEnableIngress] = useState(true);
  const [enableEgress, setEnableEgress] = useState(false);
  const [ingressPeers, setIngressPeers] = useState<NetworkPolicyPeer[]>([]);
  const [egressPeers, setEgressPeers] = useState<NetworkPolicyPeer[]>([]);

  const steps = [
    { title: "Target", description: "Namespace and pod selector for this policy" },
    { title: "Ingress Rules", description: "Control incoming traffic" },
    { title: "Egress Rules", description: "Control outgoing traffic", optional: true },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const canProceed = step === 0 ? name.trim().length > 0 && namespace.length > 0 : true;

  const parsePodSelector = (): Record<string, string> => {
    return podSelectorLabels;
  };

  const handleComplete = () => {
    const policyTypes = [];
    if (enableIngress) policyTypes.push("Ingress");
    if (enableEgress) policyTypes.push("Egress");

    const ingress: NetworkPolicyRule[] = enableIngress ? [{ from: ingressPeers.length > 0 ? ingressPeers : undefined, ports: undefined }] : [];
    const egress: NetworkPolicyRule[] = enableEgress ? [{ to: egressPeers.length > 0 ? egressPeers : undefined, ports: undefined }] : [];

    addChange({
      id: generateChangeId(),
      action: "create",
      resourceKind: "NetworkPolicy",
      resourceName: name,
      namespace,
      before: null,
      after: {
        podSelector: parsePodSelector(),
        policyTypes,
        ingress,
        egress,
      },
      description: `Create NetworkPolicy "${name}" in "${namespace}"`,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0); setName(""); setNamespace(""); setPodSelectorLabels({});
    setEnableIngress(true); setEnableEgress(false);
    setIngressPeers([]); setEgressPeers([]);
    onClose();
  };

  return (
    <WizardShell open={open} onClose={resetAndClose} title="Create Network Policy" steps={steps} currentStep={step} onStepChange={setStep} onComplete={handleComplete} canProceed={canProceed}>
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Policy Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., default-deny-ingress" />
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
            <Label className="text-xs">Pod Selector (leave empty for all pods)</Label>
            <div className="mt-1">
              <LabelPicker
                mode="pod"
                value={podSelectorLabels}
                onChange={setPodSelectorLabels}
                namespace={namespace || undefined}
                placeholder="Pick pod labels from cluster..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch checked={enableIngress} onCheckedChange={setEnableIngress} />
              <Label className="text-xs">Control Ingress (incoming traffic)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={enableEgress} onCheckedChange={setEnableEgress} />
              <Label className="text-xs">Control Egress (outgoing traffic)</Label>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          {!enableIngress ? (
            <p className="text-xs text-muted-foreground">Ingress control is disabled. No ingress rules will be applied.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {ingressPeers.length === 0 ? "No peers = deny all incoming traffic (default deny)" : "Allow traffic from:"}
              </p>
              {ingressPeers.map((peer, i) => (
                <PeerEditor key={i} peer={peer} onChange={(p) => { const next = [...ingressPeers]; next[i] = p; setIngressPeers(next); }} onRemove={() => setIngressPeers(ingressPeers.filter((_, j) => j !== i))} />
              ))}
              <Button variant="outline" size="sm" onClick={() => setIngressPeers([...ingressPeers, { podSelector: {} }])} className="gap-1 text-xs w-full">
                <Plus className="h-3 w-3" /> Allow From Source
              </Button>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {!enableEgress ? (
            <p className="text-xs text-muted-foreground">Egress control is disabled. Outgoing traffic is unrestricted.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {egressPeers.length === 0 ? "No peers = deny all outgoing traffic" : "Allow traffic to:"}
              </p>
              {egressPeers.map((peer, i) => (
                <PeerEditor key={i} peer={peer} onChange={(p) => { const next = [...egressPeers]; next[i] = p; setEgressPeers(next); }} onRemove={() => setEgressPeers(egressPeers.filter((_, j) => j !== i))} />
              ))}
              <Button variant="outline" size="sm" onClick={() => setEgressPeers([...egressPeers, { podSelector: {} }])} className="gap-1 text-xs w-full">
                <Plus className="h-3 w-3" /> Allow To Destination
              </Button>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="border rounded-lg p-4 text-xs space-y-2">
          <h4 className="text-sm font-medium">NetworkPolicy: {name}</h4>
          <p>Namespace: <Badge variant="outline" className="text-[10px]">{namespace}</Badge></p>
          <p>Pod Selector: {Object.entries(podSelectorLabels).map(([k, v]) => `${k}=${v}`).join(", ") || "(all pods)"}</p>
          <p>Policy Types: {[enableIngress && "Ingress", enableEgress && "Egress"].filter(Boolean).join(", ")}</p>
          {enableIngress && <p>Ingress: {ingressPeers.length === 0 ? "Deny all" : `${ingressPeers.length} source(s) allowed`}</p>}
          {enableEgress && <p>Egress: {egressPeers.length === 0 ? "Deny all" : `${egressPeers.length} destination(s) allowed`}</p>}
        </div>
      )}
    </WizardShell>
  );
}
