"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  MarkerType,
  Connection,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LabelPicker } from "@/components/network/label-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { NetworkPolicyData, NetworkPolicyPeer } from "@/types";
import { Search, ArrowRight, Plus, Info } from "lucide-react";

interface NetworkTopologyProps {
  policies: NetworkPolicyData[];
  namespaces: string[];
  /** Called when a namespace node is clicked */
  onNamespaceClick?: (namespace: string) => void;
}

interface PendingConnection {
  sourceNs: string;
  targetNs: string;
}

function buildTopology(
  policies: NetworkPolicyData[],
  namespaces: string[],
  filter: string,
  showSystem: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nsWithPolicies = new Set(policies.map((p) => p.namespace));

  // Build list of namespaces to show
  let nsToShow = [...new Set([
    ...Array.from(nsWithPolicies),
    ...namespaces,
  ])];

  // Filter out system namespaces unless showSystem is true
  if (!showSystem) {
    nsToShow = nsToShow.filter(
      (ns) => !ns.startsWith("openshift-") && !ns.startsWith("kube-")
    );
  }

  // Apply text filter
  if (filter) {
    const q = filter.toLowerCase();
    nsToShow = nsToShow.filter((ns) => ns.toLowerCase().includes(q));
  }

  nsToShow = nsToShow.sort().slice(0, 50);

  // Layout: dynamic columns based on count
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(nsToShow.length))));

  nsToShow.forEach((ns, i) => {
    const hasPolicies = nsWithPolicies.has(ns);
    const policyCount = policies.filter((p) => p.namespace === ns).length;
    const col = i % cols;
    const row = Math.floor(i / cols);

    nodes.push({
      id: `ns:${ns}`,
      position: { x: col * 240, y: row * 160 },
      data: {
        label: (
          <div className="text-xs text-center">
            <div className="font-semibold">{ns}</div>
            <div className="text-[10px] opacity-60">
              {policyCount} {policyCount === 1 ? "policy" : "policies"}
            </div>
          </div>
        ),
      },
      style: {
        background: hasPolicies ? "#22c55e15" : "#ef444415",
        border: `2px solid ${hasPolicies ? "#22c55e" : "#ef4444"}`,
        borderRadius: "12px",
        padding: "12px 16px",
        minWidth: "130px",
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  });

  const nsSet = new Set(nsToShow);

  // Edges from ingress rules
  policies.forEach((policy) => {
    if (!nsSet.has(policy.namespace)) return;

    policy.ingress.forEach((rule, ruleIdx) => {
      rule.from?.forEach((peer, peerIdx) => {
        if (peer.namespaceSelector) {
          const matchAll = Object.keys(peer.namespaceSelector).length === 0;
          if (matchAll) {
            nsToShow.forEach((ns) => {
              if (ns !== policy.namespace) {
                const edgeId = `${ns}->${policy.namespace}:${policy.name}:ingress:${ruleIdx}:${peerIdx}`;
                edges.push({
                  id: edgeId,
                  source: `ns:${ns}`,
                  target: `ns:${policy.namespace}`,
                  style: { stroke: "#22c55e", strokeWidth: 1.5 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#22c55e" },
                  label: `ingress: ${policy.name}`,
                  labelStyle: { fontSize: "8px", fill: "#22c55e" },
                });
              }
            });
          } else {
            // Match specific namespace labels — for now just show a generic edge
            // Could be enhanced with actual label matching
            const selectorStr = Object.entries(peer.namespaceSelector)
              .map(([k, v]) => `${k}=${v}`)
              .join(",");
            edges.push({
              id: `selector->${policy.namespace}:${policy.name}:ingress:${ruleIdx}:${peerIdx}`,
              source: `ns:${nsToShow[0] || policy.namespace}`,
              target: `ns:${policy.namespace}`,
              style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "5,5" },
              markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#3b82f6" },
              label: `ingress: ${selectorStr}`,
              labelStyle: { fontSize: "8px", fill: "#3b82f6" },
            });
          }
        }
      });
    });

    // Edges from egress rules
    policy.egress.forEach((rule, ruleIdx) => {
      rule.to?.forEach((peer, peerIdx) => {
        if (peer.namespaceSelector) {
          const matchAll = Object.keys(peer.namespaceSelector).length === 0;
          if (matchAll) {
            nsToShow.forEach((ns) => {
              if (ns !== policy.namespace) {
                const edgeId = `${policy.namespace}->${ns}:${policy.name}:egress:${ruleIdx}:${peerIdx}`;
                edges.push({
                  id: edgeId,
                  source: `ns:${policy.namespace}`,
                  target: `ns:${ns}`,
                  style: { stroke: "#f59e0b", strokeWidth: 1.5 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: "#f59e0b" },
                  label: `egress: ${policy.name}`,
                  labelStyle: { fontSize: "8px", fill: "#f59e0b" },
                });
              }
            });
          }
        }
      });
    });
  });

  return { nodes, edges };
}

export function NetworkTopology({ policies, namespaces, onNamespaceClick }: NetworkTopologyProps) {
  const [filter, setFilter] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const { addChange } = useChangesStore();

  // Dialog state for creating policy from drawn connection
  const [policyName, setPolicyName] = useState("");
  const [direction, setDirection] = useState<"ingress" | "egress">("ingress");
  const [podSelectorLabels, setPodSelectorLabels] = useState<Record<string, string>>({});
  const [ports, setPorts] = useState("");
  const [additionalPeers, setAdditionalPeers] = useState<NetworkPolicyPeer[]>([]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildTopology(policies, namespaces, filter, showSystem),
    [policies, namespaces, filter, showSystem]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNs = connection.source.replace("ns:", "");
    const targetNs = connection.target.replace("ns:", "");
    if (sourceNs === targetNs) return;

    setPendingConnection({ sourceNs, targetNs });
    setPolicyName(`allow-from-${sourceNs}`);
    setDirection("ingress");
    setPodSelectorLabels({});
    setPorts("");
    setAdditionalPeers([]);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const ns = node.id.replace("ns:", "");
    if (ns && onNamespaceClick) {
      onNamespaceClick(ns);
    }
  }, [onNamespaceClick]);

  const handleCreatePolicy = () => {
    if (!pendingConnection || !policyName.trim()) return;

    const parsedPorts = ports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [port, protocol] = s.split("/");
        return {
          port: isNaN(Number(port)) ? port : Number(port),
          protocol: (protocol || "TCP").toUpperCase(),
        };
      });

    const nsSelectorPeer: NetworkPolicyPeer = {
      namespaceSelector: { "kubernetes.io/metadata.name": pendingConnection.sourceNs },
    };

    const allPeers = [nsSelectorPeer, ...additionalPeers];

    if (direction === "ingress") {
      // Create ingress policy in the target namespace
      addChange({
        id: generateChangeId(),
        action: "create",
        resourceKind: "NetworkPolicy",
        resourceName: policyName,
        namespace: pendingConnection.targetNs,
        before: null,
        after: {
          podSelector: podSelectorLabels,
          policyTypes: ["Ingress"],
          ingress: [
            {
              from: allPeers,
              ports: parsedPorts.length > 0 ? parsedPorts : undefined,
            },
          ],
          egress: [],
        },
        description: `Create NetworkPolicy "${policyName}" in "${pendingConnection.targetNs}" allowing ingress from "${pendingConnection.sourceNs}"`,
      });
    } else {
      // Create egress policy in the source namespace
      addChange({
        id: generateChangeId(),
        action: "create",
        resourceKind: "NetworkPolicy",
        resourceName: policyName,
        namespace: pendingConnection.sourceNs,
        before: null,
        after: {
          podSelector: podSelectorLabels,
          policyTypes: ["Egress"],
          ingress: [],
          egress: [
            {
              to: allPeers,
              ports: parsedPorts.length > 0 ? parsedPorts : undefined,
            },
          ],
        },
        description: `Create NetworkPolicy "${policyName}" in "${pendingConnection.sourceNs}" allowing egress to "${pendingConnection.targetNs}"`,
      });
    }

    setPendingConnection(null);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-8"
            placeholder="Filter namespaces..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showSystem} onCheckedChange={setShowSystem} />
          <Label className="text-xs">Show system namespaces</Label>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-500 rounded" />
            <span>ingress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-amber-500 rounded" />
            <span>egress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500 rounded border-dashed" style={{ borderTop: "1px dashed #3b82f6" }} />
            <span>label-match</span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Draw connections</strong>: Drag from one namespace node to another to create a network policy.
          Green = has policies, Red = no policies.
        </span>
      </div>

      {/* Graph */}
      <div className="h-[600px] border rounded-lg overflow-hidden bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.2}
          maxZoom={2}
          connectOnClick={false}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap style={{ height: 80, width: 120 }} />
          <Panel position="top-right">
            <Badge variant="outline" className="text-[10px]">
              {nodes.length} namespaces · {edges.length} connections
            </Badge>
          </Panel>
        </ReactFlow>
      </div>

      {/* Create Policy Dialog (triggered by drawing a connection) */}
      <Dialog open={!!pendingConnection} onOpenChange={(v) => { if (!v) setPendingConnection(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              Create Network Policy
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pendingConnection && (
                <span className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {pendingConnection.sourceNs}
                  </Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[10px]">
                    {pendingConnection.targetNs}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Direction */}
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "ingress" | "egress")}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingress" className="text-xs">
                    Ingress — allow traffic INTO {pendingConnection?.targetNs}
                  </SelectItem>
                  <SelectItem value="egress" className="text-xs">
                    Egress — allow traffic OUT FROM {pendingConnection?.sourceNs}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {direction === "ingress"
                  ? `Policy will be created in "${pendingConnection?.targetNs}" namespace`
                  : `Policy will be created in "${pendingConnection?.sourceNs}" namespace`}
              </p>
            </div>

            {/* Policy Name */}
            <div>
              <Label className="text-xs">Policy Name</Label>
              <Input
                className="mt-1 h-8 text-xs"
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
              />
            </div>

            {/* Pod Selector */}
            <div>
              <Label className="text-xs">
                Target Pod Selector{" "}
                <span className="text-muted-foreground">(leave empty for all pods)</span>
              </Label>
              <div className="mt-1">
                <LabelPicker
                  mode="pod"
                  value={podSelectorLabels}
                  onChange={setPodSelectorLabels}
                  placeholder="Pick pod labels..."
                  compact
                />
              </div>
            </div>

            {/* Ports */}
            <div>
              <Label className="text-xs">
                Ports{" "}
                <span className="text-muted-foreground">(optional, e.g. 80/TCP, 443/TCP)</span>
              </Label>
              <Input
                className="mt-1 h-8 text-xs"
                placeholder="80/TCP, 443/TCP"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setPendingConnection(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1"
              onClick={handleCreatePolicy}
              disabled={!policyName.trim()}
            >
              <Plus className="h-3 w-3" />
              Add to Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
