"use client";

import { useEffect, useState } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { NamespacePodSecurity } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { FieldLabel } from "@/components/shared/field-label";
import { Eye, ShieldCheck, ShieldAlert, Shield, Info, Pencil } from "lucide-react";

const levelColors: Record<string, string> = {
  privileged: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  baseline: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  restricted: "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
};

const levelDescriptions: Record<string, { icon: React.ReactNode; description: string; controls: string[] }> = {
  privileged: {
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
    description: "Unrestricted policy. Allows anything, including known privilege escalations. Use only for system-critical workloads.",
    controls: ["No restrictions applied", "Containers can run as root", "Host namespaces allowed", "Privileged containers allowed", "All capabilities allowed"],
  },
  baseline: {
    icon: <Shield className="h-4 w-4 text-yellow-500" />,
    description: "Minimally restrictive. Prevents known privilege escalations while allowing most standard workloads.",
    controls: ["Privileged containers blocked", "Host namespaces blocked", "Host ports restricted", "Dangerous capabilities blocked", "procMount must be default"],
  },
  restricted: {
    icon: <ShieldCheck className="h-4 w-4 text-green-500" />,
    description: "Heavily restricted. Follows current pod hardening best practices. Recommended for most workloads.",
    controls: ["Must run as non-root", "Seccomp profile required", "All capabilities dropped", "No privilege escalation", "Root filesystem read-only"],
  },
};

function PodSecurityLevel({ level, mode }: { level: string; mode: string }) {
  const config = levelDescriptions[level];
  const colorClass = levelColors[level] || "bg-gray-500/15 text-gray-700";
  
  return (
    <Badge variant="outline" className={`${colorClass} text-[10px] gap-1`}>
      {config?.icon}
      {mode}: {level}
    </Badge>
  );
}

export default function PodSecurityPage() {
  const { kubeconfigLoaded } = useClusterStore();
  const [data, setData] = useState<NamespacePodSecurity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingNs, setEditingNs] = useState<NamespacePodSecurity | null>(null);
  const [editEnforce, setEditEnforce] = useState("");
  const [editAudit, setEditAudit] = useState("");
  const [editWarn, setEditWarn] = useState("");
  const { addChange } = useChangesStore();

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pod-security");
        const json = await res.json();
        if (Array.isArray(json)) setData(json);
      } catch (error) {
        console.error("Failed to fetch pod security data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [kubeconfigLoaded]);

  if (!kubeconfigLoaded) {
    return (
      <EmptyState
        icon={<Eye className="h-12 w-12" />}
        title="No cluster connected"
        description="Upload a kubeconfig file on the dashboard page to get started."
      />
    );
  }

  const userNamespaces = data.filter(
    (ns) => !ns.namespace.startsWith("openshift-") && !ns.namespace.startsWith("kube-")
  );
  const restrictedCount = userNamespaces.filter((ns) => ns.enforce === "restricted").length;
  const baselineCount = userNamespaces.filter((ns) => ns.enforce === "baseline").length;
  const privilegedCount = userNamespaces.filter((ns) => ns.enforce === "privileged").length;
  const unconfiguredCount = userNamespaces.filter((ns) => !ns.enforce && !ns.audit && !ns.warn).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pod Security Admission"
        description="Namespace-level pod security standards enforcement"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-500/10 text-green-700">{restrictedCount} restricted</Badge>
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700">{baselineCount} baseline</Badge>
          <Badge variant="secondary" className="bg-red-500/10 text-red-700">{privilegedCount} privileged</Badge>
          {unconfiguredCount > 0 && (
            <Badge variant="outline">{unconfiguredCount} unconfigured</Badge>
          )}
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="PodSecurityAdmission">Pod Security Admission</LearnTooltip> enforces 
        security standards at the namespace level. Each namespace can set three modes: 
        <strong> enforce</strong> (reject non-compliant pods), <strong>audit</strong> (log violations), 
        and <strong>warn</strong> (show warnings).
      </div>

      {/* Level Comparison */}
      <Accordion type="single" collapsible>
        <AccordionItem value="levels">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              What do the security levels mean?
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(levelDescriptions).map(([level, config]) => (
                <Card key={level} className={levelColors[level]?.replace("text-", "border-").split(" ")[2] || ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {config.icon}
                      <span className="capitalize">{level}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{config.description}</p>
                    <ul className="space-y-1">
                      {config.controls.map((c) => (
                        <li key={c} className="text-xs flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-current" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-24" />
          ))}
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold mb-3">Namespace Grid</h3>
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {userNamespaces.map((ns) => {
                const hasConfig = ns.enforce || ns.audit || ns.warn;
                return (
                  <Card key={ns.namespace} className={!hasConfig ? "opacity-60" : ""}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm truncate">{ns.namespace}</div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                          setEditingNs(ns);
                          setEditEnforce(ns.enforce || "");
                          setEditAudit(ns.audit || "");
                          setEditWarn(ns.warn || "");
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {ns.enforce && <PodSecurityLevel level={ns.enforce} mode="enforce" />}
                        {ns.audit && <PodSecurityLevel level={ns.audit} mode="audit" />}
                        {ns.warn && <PodSecurityLevel level={ns.warn} mode="warn" />}
                        {!hasConfig && (
                          <span className="text-xs text-muted-foreground">No PSA labels</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Edit PSA Dialog */}
      <Dialog open={!!editingNs} onOpenChange={(v) => !v && setEditingNs(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit PSA Labels: {editingNs?.namespace}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(["enforce", "audit", "warn"] as const).map((mode) => {
              const value = mode === "enforce" ? editEnforce : mode === "audit" ? editAudit : editWarn;
              const setter = mode === "enforce" ? setEditEnforce : mode === "audit" ? setEditAudit : setEditWarn;
              const termMap = { enforce: "PSAEnforce", audit: "PSAAudit", warn: "PSAWarn" } as const;
              return (
                <div key={mode}>
                  <Label className="text-xs capitalize"><FieldLabel term={termMap[mode]}>{mode}</FieldLabel></Label>
                  <Select value={value || "none"} onValueChange={(v) => setter(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Not set</SelectItem>
                      <SelectItem value="privileged" className="text-xs">Privileged</SelectItem>
                      <SelectItem value="baseline" className="text-xs">Baseline</SelectItem>
                      <SelectItem value="restricted" className="text-xs">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingNs(null)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              if (editingNs) {
                addChange({
                  id: generateChangeId(),
                  action: "update",
                  resourceKind: "NamespacePSA",
                  resourceName: editingNs.namespace,
                  before: { enforce: editingNs.enforce, audit: editingNs.audit, warn: editingNs.warn },
                  after: { enforce: editEnforce || undefined, audit: editAudit || undefined, warn: editWarn || undefined },
                  description: `Update PSA labels for namespace "${editingNs.namespace}"`,
                });
                setEditingNs(null);
              }
            }}>Save to Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
