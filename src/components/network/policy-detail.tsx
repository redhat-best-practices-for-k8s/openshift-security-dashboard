"use client";

import { useState } from "react";
import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { LabelPicker } from "@/components/network/label-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { NetworkPolicyData, NetworkPolicyRule, NetworkPolicyPeer } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";

interface PolicyDetailProps {
  policy: NetworkPolicyData | null;
  onClose: () => void;
}

function PeerEditor({ peer, onChange, onRemove }: { peer: NetworkPolicyPeer; onChange: (p: NetworkPolicyPeer) => void; onRemove: () => void }) {
  const hasPodSelector = !!peer.podSelector;
  const hasNsSelector = !!peer.namespaceSelector;
  const hasIpBlock = !!peer.ipBlock;

  return (
    <div className="p-2 border rounded-lg space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-medium">Peer</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={hasPodSelector} onCheckedChange={(v) => {
          const next = { ...peer };
          if (v) next.podSelector = {};
          else delete next.podSelector;
          onChange(next);
        }} />
        <Label className="text-[10px]"><FieldLabel term="PodSelector">Pod Selector</FieldLabel></Label>
      </div>
      {hasPodSelector && (
        <LabelPicker
          mode="pod"
          value={peer.podSelector || {}}
          onChange={(labels) => onChange({ ...peer, podSelector: labels })}
          placeholder="Pick pod labels..."
          compact
        />
      )}

      <div className="flex items-center gap-2">
        <Switch checked={hasNsSelector} onCheckedChange={(v) => {
          const next = { ...peer };
          if (v) next.namespaceSelector = {};
          else delete next.namespaceSelector;
          onChange(next);
        }} />
        <Label className="text-[10px]"><FieldLabel term="NamespaceSelector">Namespace Selector</FieldLabel></Label>
      </div>
      {hasNsSelector && (
        <LabelPicker
          mode="namespace"
          value={peer.namespaceSelector || {}}
          onChange={(labels) => onChange({ ...peer, namespaceSelector: labels })}
          placeholder="Pick namespace labels..."
          compact
        />
      )}

      <div className="flex items-center gap-2">
        <Switch checked={hasIpBlock} onCheckedChange={(v) => {
          const next = { ...peer };
          if (v) next.ipBlock = { cidr: "0.0.0.0/0" };
          else delete next.ipBlock;
          onChange(next);
        }} />
        <Label className="text-[10px]"><FieldLabel term="IPBlock">IP Block</FieldLabel></Label>
      </div>
      {hasIpBlock && (
        <Input
          className="h-6 text-[10px]"
          placeholder="10.0.0.0/8"
          value={peer.ipBlock?.cidr || ""}
          onChange={(e) => onChange({ ...peer, ipBlock: { ...peer.ipBlock, cidr: e.target.value } })}
        />
      )}
    </div>
  );
}

function RuleEditor({ rule, direction, onChange, onRemove }: { rule: NetworkPolicyRule; direction: "ingress" | "egress"; onChange: (r: NetworkPolicyRule) => void; onRemove: () => void }) {
  const peers = direction === "ingress" ? (rule.from || []) : (rule.to || []);
  const peerKey = direction === "ingress" ? "from" : "to";

  const updatePeer = (idx: number, peer: NetworkPolicyPeer) => {
    const next = [...peers];
    next[idx] = peer;
    onChange({ ...rule, [peerKey]: next });
  };

  const removePeer = (idx: number) => {
    const next = peers.filter((_, i) => i !== idx);
    onChange({ ...rule, [peerKey]: next.length > 0 ? next : undefined });
  };

  const addPeer = () => {
    onChange({ ...rule, [peerKey]: [...peers, { podSelector: {} }] });
  };

  const portsStr = (rule.ports || []).map((p) => `${p.port}/${p.protocol}`).join(", ");

  return (
    <div className="border rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium capitalize">{direction} Rule</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px]">{direction === "ingress" ? "Allow From" : "Allow To"}</Label>
        {peers.map((peer, i) => (
          <PeerEditor key={i} peer={peer} onChange={(p) => updatePeer(i, p)} onRemove={() => removePeer(i)} />
        ))}
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={addPeer}>
          <Plus className="h-2.5 w-2.5" /> Add Peer
        </Button>
      </div>

      <div>
        <Label className="text-[10px]"><FieldLabel term="NetworkPorts">Ports</FieldLabel> (port/protocol, comma-separated)</Label>
        <Input
          className="h-6 text-[10px] mt-1"
          placeholder="80/TCP, 443/TCP"
          value={portsStr}
          onChange={(e) => {
            const ports = e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
              const [port, protocol] = s.split("/");
              return { port: isNaN(Number(port)) ? port : Number(port), protocol: (protocol || "TCP").toUpperCase() };
            });
            onChange({ ...rule, ports: ports.length > 0 ? ports : undefined });
          }}
        />
      </div>
    </div>
  );
}

export function PolicyDetail({ policy, onClose }: PolicyDetailProps) {
  const { addChange } = useChangesStore();
  const [editing, setEditing] = useState(false);

  // Editable state
  const [podSelectorLabels, setPodSelectorLabels] = useState<Record<string, string>>({});
  const [hasIngress, setHasIngress] = useState(false);
  const [hasEgress, setHasEgress] = useState(false);
  const [ingressRules, setIngressRules] = useState<NetworkPolicyRule[]>([]);
  const [egressRules, setEgressRules] = useState<NetworkPolicyRule[]>([]);

  if (!policy) return null;

  const startEditing = () => {
    setPodSelectorLabels({ ...policy.podSelector });
    setHasIngress(policy.policyTypes.includes("Ingress"));
    setHasEgress(policy.policyTypes.includes("Egress"));
    setIngressRules(JSON.parse(JSON.stringify(policy.ingress)));
    setEgressRules(JSON.parse(JSON.stringify(policy.egress)));
    setEditing(true);
  };

  const handleSave = () => {
    const policyTypes: string[] = [];
    if (hasIngress) policyTypes.push("Ingress");
    if (hasEgress) policyTypes.push("Egress");

    const updated: NetworkPolicyData = {
      ...policy,
      podSelector: podSelectorLabels,
      policyTypes,
      ingress: hasIngress ? ingressRules : [],
      egress: hasEgress ? egressRules : [],
    };

    addChange({
      id: generateChangeId(),
      action: "update",
      resourceKind: "NetworkPolicy",
      resourceName: policy.name,
      namespace: policy.namespace,
      before: { podSelector: policy.podSelector, policyTypes: policy.policyTypes, ingress: policy.ingress, egress: policy.egress },
      after: { podSelector: updated.podSelector, policyTypes: updated.policyTypes, ingress: updated.ingress, egress: updated.egress },
      description: `Update NetworkPolicy "${policy.name}" in "${policy.namespace}"`,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: "NetworkPolicy",
      resourceName: policy.name,
      namespace: policy.namespace,
      before: { podSelector: policy.podSelector, policyTypes: policy.policyTypes },
      after: null,
      description: `Delete NetworkPolicy "${policy.name}" from "${policy.namespace}"`,
    });
    onClose();
  };

  // --- View Mode ---
  if (!editing) {
    return (
      <ResourceDetailSheet
        open={!!policy}
        onClose={onClose}
        title={policy.name}
        kind="NetworkPolicy"
        namespace={policy.namespace}
        onEdit={startEditing}
        aiContext={`Targets pods: ${Object.entries(policy.podSelector).map(([k, v]) => `${k}=${v}`).join(",") || "all"}. Types: ${policy.policyTypes.join(",")}. ${policy.ingress.length} ingress rule(s), ${policy.egress.length} egress rule(s).`}
        onDelete={handleDelete}
      >
        {policy.creationTimestamp && (
          <p className="text-xs text-muted-foreground">Created: {new Date(policy.creationTimestamp).toLocaleString()}</p>
        )}

        <div>
          <h4 className="text-xs font-medium mb-1"><FieldLabel term="PodSelector">Pod Selector</FieldLabel></h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(policy.podSelector).length > 0
              ? Object.entries(policy.podSelector).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px]">{k}={v}</Badge>
                ))
              : <span className="text-xs text-muted-foreground">All pods</span>}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium mb-1"><FieldLabel term="PolicyTypes">Policy Types</FieldLabel></h4>
          <div className="flex gap-1">
            {policy.policyTypes.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        </div>

        {policy.ingress.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2 flex items-center gap-1"><ArrowDown className="h-3.5 w-3.5" /> Ingress Rules</h4>
            {policy.ingress.map((rule, i) => (
              <div key={i} className="border rounded-lg p-2.5 mb-2 text-xs">
                {rule.from && rule.from.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Allow from:</span>
                    {rule.from.map((peer, j) => (
                      <div key={j} className="ml-2">
                        {peer.podSelector && <span>Pods: {Object.entries(peer.podSelector).map(([k, v]) => `${k}=${v}`).join(", ") || "all"}</span>}
                        {peer.namespaceSelector && <span className="ml-2">Namespaces: {Object.entries(peer.namespaceSelector).map(([k, v]) => `${k}=${v}`).join(", ") || "all"}</span>}
                        {peer.ipBlock && <span>IP: {peer.ipBlock.cidr}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Allow from: all</span>
                )}
                {rule.ports && rule.ports.length > 0 && (
                  <div className="mt-1">Ports: {rule.ports.map((p) => `${p.port}/${p.protocol}`).join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {policy.egress.length > 0 && (
          <div>
            <h4 className="text-xs font-medium mb-2 flex items-center gap-1"><ArrowUp className="h-3.5 w-3.5" /> Egress Rules</h4>
            {policy.egress.map((rule, i) => (
              <div key={i} className="border rounded-lg p-2.5 mb-2 text-xs">
                {rule.to && rule.to.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Allow to:</span>
                    {rule.to.map((peer, j) => (
                      <div key={j} className="ml-2">
                        {peer.podSelector && <span>Pods: {Object.entries(peer.podSelector).map(([k, v]) => `${k}=${v}`).join(", ") || "all"}</span>}
                        {peer.namespaceSelector && <span className="ml-2">Namespaces: {Object.entries(peer.namespaceSelector).map(([k, v]) => `${k}=${v}`).join(", ") || "all"}</span>}
                        {peer.ipBlock && <span>IP: {peer.ipBlock.cidr}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Allow to: all</span>
                )}
                {rule.ports && rule.ports.length > 0 && (
                  <div className="mt-1">Ports: {rule.ports.map((p) => `${p.port}/${p.protocol}`).join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </ResourceDetailSheet>
    );
  }

  // --- Edit Mode ---
  return (
    <ResourceDetailSheet
      open={!!policy}
      onClose={() => { setEditing(false); onClose(); }}
      title={policy.name}
      kind="NetworkPolicy"
      namespace={policy.namespace}
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs"><FieldLabel term="PodSelector">Pod Selector</FieldLabel></Label>
          <div className="mt-1">
            <LabelPicker
              mode="pod"
              value={podSelectorLabels}
              onChange={setPodSelectorLabels}
              placeholder="Pick pod labels from cluster..."
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Leave empty to target all pods in the namespace.</p>
        </div>

        <Separator />

        {/* Policy Types */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={hasIngress} onCheckedChange={setHasIngress} />
            <Label className="text-xs"><FieldLabel term="IngressRule">Ingress</FieldLabel></Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={hasEgress} onCheckedChange={setHasEgress} />
            <Label className="text-xs"><FieldLabel term="EgressRule">Egress</FieldLabel></Label>
          </div>
        </div>

        {/* Ingress Rules */}
        {hasIngress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium flex items-center gap-1"><ArrowDown className="h-3.5 w-3.5" /> Ingress Rules</h4>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setIngressRules([...ingressRules, { from: [{ podSelector: {} }], ports: [] }])}>
                <Plus className="h-2.5 w-2.5" /> Add Rule
              </Button>
            </div>
            {ingressRules.length === 0 && (
              <p className="text-[10px] text-muted-foreground p-2 border rounded bg-yellow-500/5 border-yellow-500/20">No ingress rules = deny all ingress traffic to selected pods.</p>
            )}
            {ingressRules.map((rule, i) => (
              <RuleEditor
                key={i}
                rule={rule}
                direction="ingress"
                onChange={(r) => { const next = [...ingressRules]; next[i] = r; setIngressRules(next); }}
                onRemove={() => setIngressRules(ingressRules.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        {/* Egress Rules */}
        {hasEgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium flex items-center gap-1"><ArrowUp className="h-3.5 w-3.5" /> Egress Rules</h4>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setEgressRules([...egressRules, { to: [{ podSelector: {} }], ports: [] }])}>
                <Plus className="h-2.5 w-2.5" /> Add Rule
              </Button>
            </div>
            {egressRules.length === 0 && (
              <p className="text-[10px] text-muted-foreground p-2 border rounded bg-yellow-500/5 border-yellow-500/20">No egress rules = deny all egress traffic from selected pods.</p>
            )}
            {egressRules.map((rule, i) => (
              <RuleEditor
                key={i}
                rule={rule}
                direction="egress"
                onChange={(r) => { const next = [...egressRules]; next[i] = r; setEgressRules(next); }}
                onRemove={() => setEgressRules(egressRules.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} className="gap-1 text-xs">
            <Check className="h-3 w-3" /> Save to Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
        </div>
      </div>
    </ResourceDetailSheet>
  );
}
