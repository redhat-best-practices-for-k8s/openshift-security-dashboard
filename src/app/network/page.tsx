"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { NetworkTopology } from "@/components/network/network-topology";
import { PolicyDetail } from "@/components/network/policy-detail";
import { CreateNetworkPolicyWizard } from "@/components/wizards/create-network-policy-wizard";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import type { NetworkPolicyData } from "@/types";
import { Network, GitGraph, List, ShieldCheck, ShieldAlert, Plus, Trash2, Search, X, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { NetworkPolicyRule, NetworkPolicyPeer } from "@/types";

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkPageInner />
    </Suspense>
  );
}

function NetworkPageInner() {
  const { kubeconfigLoaded, selectedNamespace, availableNamespaces } = useClusterStore();
  const [policies, setPolicies] = useState<NetworkPolicyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<NetworkPolicyData | null>(null);
  const [activeTab, setActiveTab] = useState("topology");
  const [listNsFilter, setListNsFilter] = useState("");
  const { addChange } = useChangesStore();
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const res = await fetch(`/api/network-policies${ns}`);
        const json = await res.json();
        if (Array.isArray(json)) setPolicies(json);
      } catch (error) {
        console.error("Failed to fetch network policies:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [kubeconfigLoaded, selectedNamespace]);

  // Auto-open from ?open= param (once only)
  useEffect(() => {
    if (openConsumed.current) return;
    const openName = searchParams.get("open");
    const openNs = searchParams.get("ns");
    if (openName && policies.length > 0) {
      const match = policies.find((p) => p.name === openName && (!openNs || p.namespace === openNs));
      if (match) { setSelectedPolicy(match); openConsumed.current = true; }
    }
  }, [searchParams, policies]);

  if (!kubeconfigLoaded) {
    return <EmptyState icon={<Network className="h-12 w-12" />} title="No cluster connected" description="Upload a kubeconfig file on the dashboard page to get started." />;
  }

  const nsWithPolicies = new Set(policies.map((p) => p.namespace));
  const userNamespaces = availableNamespaces.filter((ns) => !ns.startsWith("openshift-") && !ns.startsWith("kube-"));
  const coveragePercent = userNamespaces.length > 0 ? Math.round((userNamespaces.filter((ns) => nsWithPolicies.has(ns)).length / userNamespaces.length) * 100) : 0;

  const handleDeletePolicy = (policy: NetworkPolicyData) => {
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
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Network Policies" description="Visualize and manage network segmentation rules">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{policies.length} Policies</Badge>
          <Badge variant={coveragePercent >= 70 ? "secondary" : "destructive"}>{coveragePercent}% coverage</Badge>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Policy</Button>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="NetworkPolicy">Network Policies</LearnTooltip> are firewall rules for your cluster.
        By default, all pods can communicate freely. Policies restrict traffic to only what is explicitly allowed.
        Green borders indicate namespaces with policies; red means no policies (fully open).
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[600px]" />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="topology" className="gap-2"><GitGraph className="h-3.5 w-3.5" /> Topology</TabsTrigger>
            <TabsTrigger value="list" className="gap-2"><List className="h-3.5 w-3.5" /> Policy List</TabsTrigger>
            <TabsTrigger value="coverage" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Coverage</TabsTrigger>
          </TabsList>
          <TabsContent value="topology" className="mt-4">
            <NetworkTopology
              policies={policies}
              namespaces={availableNamespaces}
              onNamespaceClick={(ns) => {
                setListNsFilter(ns);
                setActiveTab("list");
              }}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-4 space-y-3">
            {/* Filter bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-9 text-xs pl-8"
                  placeholder="Filter by name or namespace..."
                  value={listNsFilter}
                  onChange={(e) => setListNsFilter(e.target.value)}
                />
              </div>
              {listNsFilter && (
                <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={() => setListNsFilter("")}>
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
              <Badge variant="outline" className="text-[10px]">
                {policies.filter((p) => {
                  if (!listNsFilter) return true;
                  const q = listNsFilter.toLowerCase();
                  return p.namespace.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
                }).length} of {policies.length}
              </Badge>
            </div>
            <Card>
              <CardContent className="pt-6">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {policies
                      .filter((p) => {
                        if (!listNsFilter) return true;
                        const q = listNsFilter.toLowerCase();
                        return p.namespace.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
                      })
                      .map((policy) => (
                      <div key={`${policy.namespace}/${policy.name}`} className="rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedPolicy(policy)}>
                        <div className="p-3 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{policy.name}</span>
                              <Badge variant="outline" className="text-[10px]">{policy.namespace}</Badge>
                              {policy.policyTypes.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Pod selector: {Object.entries(policy.podSelector).map(([k, v]) => `${k}=${v}`).join(", ") || "all pods"}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePolicy(policy); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {(policy.ingress.length > 0 || policy.egress.length > 0) && (
                          <div className="border-t px-3 py-2 space-y-2">
                            {policy.ingress.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wider">
                                  <ArrowDownToLine className="h-3 w-3" /> Ingress ({policy.ingress.length})
                                </div>
                                {policy.ingress.map((rule, i) => (
                                  <PolicyRuleSummary key={i} rule={rule} direction="ingress" />
                                ))}
                              </div>
                            )}
                            {policy.egress.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                                  <ArrowUpFromLine className="h-3 w-3" /> Egress ({policy.egress.length})
                                </div>
                                {policy.egress.map((rule, i) => (
                                  <PolicyRuleSummary key={i} rule={rule} direction="egress" />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {policy.ingress.length === 0 && policy.egress.length === 0 && (
                          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground italic">
                            No rules — {policy.policyTypes.includes("Ingress") ? "denies all ingress" : ""}{policy.policyTypes.includes("Ingress") && policy.policyTypes.includes("Egress") ? ", " : ""}{policy.policyTypes.includes("Egress") ? "denies all egress" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                    {policies.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">No network policies found.</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="coverage" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Namespace Coverage</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {userNamespaces.map((ns) => {
                    const hasPolicies = nsWithPolicies.has(ns);
                    return (
                      <div key={ns} className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${hasPolicies ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        {hasPolicies ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
                        <span className="truncate">{ns}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <CreateNetworkPolicyWizard open={showCreate} onClose={() => setShowCreate(false)} />
      <PolicyDetail policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </div>
  );
}

// ── Inline rule summary ─────────────────────────────────────────────────

function formatPeer(peer: NetworkPolicyPeer): string {
  const parts: string[] = [];
  if (peer.namespaceSelector) {
    const labels = Object.entries(peer.namespaceSelector);
    parts.push(labels.length === 0 ? "any namespace" : `ns{${labels.map(([k, v]) => `${k}=${v}`).join(",")}}`);
  }
  if (peer.podSelector) {
    const labels = Object.entries(peer.podSelector);
    parts.push(labels.length === 0 ? "all pods" : `pod{${labels.map(([k, v]) => `${k}=${v}`).join(",")}}`);
  }
  if (peer.ipBlock) {
    let s = peer.ipBlock.cidr;
    if (peer.ipBlock.except?.length) s += ` except ${peer.ipBlock.except.join(",")}`;
    parts.push(s);
  }
  return parts.join(" + ") || "all";
}

function formatPorts(ports?: { port: number | string; protocol: string }[]): string {
  if (!ports || ports.length === 0) return "all ports";
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ");
}

function PolicyRuleSummary({ rule, direction }: { rule: NetworkPolicyRule; direction: "ingress" | "egress" }) {
  const peers = direction === "ingress" ? rule.from : rule.to;
  const peerLabel = direction === "ingress" ? "from" : "to";
  const portsStr = formatPorts(rule.ports);

  if (!peers || peers.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground pl-4">
        Allow {peerLabel} <span className="font-medium text-foreground">anywhere</span> on <span className="font-mono">{portsStr}</span>
      </div>
    );
  }

  return (
    <div className="text-[11px] text-muted-foreground pl-4 space-y-0.5">
      {peers.map((peer, j) => (
        <div key={j}>
          Allow {peerLabel} <span className="font-medium text-foreground">{formatPeer(peer)}</span> on <span className="font-mono">{portsStr}</span>
        </div>
      ))}
    </div>
  );
}
