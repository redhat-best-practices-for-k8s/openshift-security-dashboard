"use client";

import { useState } from "react";
import { WizardShell } from "./wizard-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { useClusterStore } from "@/store/cluster-store";
import type { PolicyRule, RBACSubject } from "@/types";
import { Plus, X, Search } from "lucide-react";

const ALL_VERBS = ["get", "list", "watch", "create", "update", "patch", "delete"];
const COMMON_RESOURCES = ["pods", "services", "deployments", "configmaps", "secrets", "namespaces", "nodes", "persistentvolumeclaims", "serviceaccounts", "ingresses", "jobs", "cronjobs", "statefulsets", "daemonsets", "replicasets", "events", "endpoints"];

interface CreateRoleWizardProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRoleWizard({ open, onClose }: CreateRoleWizardProps) {
  const [step, setStep] = useState(0);
  const { availableNamespaces } = useClusterStore();
  const { addChange, addChanges } = useChangesStore();

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [isCluster, setIsCluster] = useState(false);

  // Step 2: Rules
  const [rules, setRules] = useState<PolicyRule[]>([{ verbs: [], apiGroups: [""], resources: [] }]);

  // Step 3: Subjects (optional)
  const [createBinding, setCreateBinding] = useState(false);
  const [subjects, setSubjects] = useState<RBACSubject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");

  const steps = [
    { title: "Name & Scope", description: "Choose a name and whether this is a namespaced Role or cluster-wide ClusterRole" },
    { title: "Permission Rules", description: "Define what resources and actions this role allows" },
    { title: "Assign to Users?", description: "Optionally create a RoleBinding for this role", optional: true },
    { title: "Review", description: "Review and add to pending changes" },
  ];

  const canProceed = (() => {
    switch (step) {
      case 0: return name.trim().length > 0 && (isCluster || namespace.length > 0);
      case 1: return rules.some((r) => r.verbs.length > 0 && r.resources.length > 0);
      case 2: return true; // optional step
      case 3: return true;
      default: return false;
    }
  })();

  const handleComplete = () => {
    const kind = isCluster ? "ClusterRole" : "Role";
    const changes = [];

    changes.push({
      id: generateChangeId(),
      action: "create" as const,
      resourceKind: kind,
      resourceName: name,
      namespace: isCluster ? undefined : namespace,
      before: null,
      after: { rules, labels: {} },
      description: `Create ${kind} "${name}"${!isCluster ? ` in namespace "${namespace}"` : ""}`,
    });

    if (createBinding && subjects.length > 0) {
      const bindingKind = isCluster ? "ClusterRoleBinding" : "RoleBinding";
      changes.push({
        id: generateChangeId(),
        action: "create" as const,
        resourceKind: bindingKind,
        resourceName: `${name}-binding`,
        namespace: isCluster ? undefined : namespace,
        before: null,
        after: {
          roleRef: { kind, name, apiGroup: "rbac.authorization.k8s.io" },
          subjects: subjects,
        },
        description: `Create ${bindingKind} "${name}-binding" granting "${name}" to ${subjects.length} subject(s)`,
      });
    }

    addChanges(changes);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(0);
    setName("");
    setNamespace("");
    setIsCluster(false);
    setRules([{ verbs: [], apiGroups: [""], resources: [] }]);
    setCreateBinding(false);
    setSubjects([]);
    onClose();
  };

  const toggleResourceInRule = (ruleIdx: number, resource: string) => {
    const next = [...rules];
    const rule = { ...next[ruleIdx] };
    rule.resources = rule.resources.includes(resource)
      ? rule.resources.filter((r) => r !== resource)
      : [...rule.resources, resource];
    next[ruleIdx] = rule;
    setRules(next);
  };

  const toggleVerbInRule = (ruleIdx: number, verb: string) => {
    const next = [...rules];
    const rule = { ...next[ruleIdx] };
    rule.verbs = rule.verbs.includes(verb)
      ? rule.verbs.filter((v) => v !== verb)
      : [...rule.verbs, verb];
    next[ruleIdx] = rule;
    setRules(next);
  };

  return (
    <WizardShell
      open={open}
      onClose={resetAndClose}
      title="Create Role"
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      onComplete={handleComplete}
      canProceed={canProceed}
    >
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Role Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., pod-reader, deploy-manager" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isCluster} onCheckedChange={setIsCluster} />
            <Label className="text-xs">Cluster-wide (ClusterRole)</Label>
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
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {rules.map((rule, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Rule {i + 1}</span>
                {rules.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs mb-1 block">Resources (click to toggle)</Label>
                <div className="flex flex-wrap gap-1">
                  {COMMON_RESOURCES.map((r) => (
                    <button
                      key={r}
                      onClick={() => toggleResourceInRule(i, r)}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${rule.resources.includes(r) ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Verbs (click to toggle)</Label>
                <div className="flex flex-wrap gap-1">
                  {ALL_VERBS.map((v) => (
                    <button
                      key={v}
                      onClick={() => toggleVerbInRule(i, v)}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${rule.verbs.includes(v) ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">API Groups</Label>
                <Input
                  className="h-7 text-xs mt-1"
                  value={rule.apiGroups.join(", ")}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...rule, apiGroups: e.target.value.split(",").map((s) => s.trim()) };
                    setRules(next);
                  }}
                  placeholder='e.g., "", apps'
                />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRules([...rules, { verbs: [], apiGroups: [""], resources: [] }])} className="gap-1 text-xs w-full">
            <Plus className="h-3 w-3" /> Add Another Rule
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={createBinding} onCheckedChange={setCreateBinding} />
            <Label className="text-xs">Create a RoleBinding to assign this role</Label>
          </div>
          {createBinding && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter subjects..."
                  className="pl-8 h-8 text-xs"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                />
              </div>
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
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Changes to be added:</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-700">create</Badge>
                <span>{isCluster ? "ClusterRole" : "Role"} <strong>{name || "unnamed"}</strong></span>
                {!isCluster && namespace && <Badge variant="outline" className="text-[10px]">{namespace}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground ml-6">
                {rules.filter((r) => r.resources.length > 0).map((r, i) => (
                  <div key={i}>
                    Can {r.verbs.join(", ")} on {r.resources.join(", ")}
                  </div>
                ))}
              </div>
              {createBinding && subjects.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-xs mt-2">
                    <Badge variant="outline" className="text-[10px] bg-green-500/15 text-green-700">create</Badge>
                    <span>{isCluster ? "ClusterRoleBinding" : "RoleBinding"} <strong>{name}-binding</strong></span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">
                    Grants role to: {subjects.map((s) => `${s.kind}/${s.name}`).join(", ")}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </WizardShell>
  );
}
