"use client";

import { useState } from "react";
import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { FieldLabel } from "@/components/shared/field-label";
import type { RBACRole, PolicyRule } from "@/types";
import { Plus, X, Check } from "lucide-react";

interface RoleDetailProps {
  role: RBACRole | null;
  onClose: () => void;
}

const ALL_VERBS = ["get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"];

function RuleEditor({ rule, onChange, onRemove }: { rule: PolicyRule; onChange: (r: PolicyRule) => void; onRemove: () => void }) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs"><FieldLabel term="APIGroups">API Groups</FieldLabel></Label>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <Input
        className="h-7 text-xs"
        value={rule.apiGroups.join(", ")}
        onChange={(e) => onChange({ ...rule, apiGroups: e.target.value.split(",").map((s) => s.trim()) })}
        placeholder='e.g., "", apps, rbac.authorization.k8s.io'
      />
      <Label className="text-xs"><FieldLabel term="Resources">Resources</FieldLabel></Label>
      <Input
        className="h-7 text-xs"
        value={rule.resources.join(", ")}
        onChange={(e) => onChange({ ...rule, resources: e.target.value.split(",").map((s) => s.trim()) })}
        placeholder="e.g., pods, deployments, secrets"
      />
      <Label className="text-xs"><LearnTooltip term="Verb">Verbs</LearnTooltip></Label>
      <div className="flex flex-wrap gap-1.5">
        {ALL_VERBS.map((v) => {
          const active = rule.verbs.includes(v) || rule.verbs.includes("*");
          return (
            <button
              key={v}
              onClick={() => {
                const verbs = active ? rule.verbs.filter((x) => x !== v) : [...rule.verbs, v];
                onChange({ ...rule, verbs });
              }}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80 border-transparent"}`}
            >
              {v}
            </button>
          );
        })}
        <button
          onClick={() => onChange({ ...rule, verbs: rule.verbs.includes("*") ? [] : ["*"] })}
          className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${rule.verbs.includes("*") ? "bg-red-500 text-white border-red-500" : "bg-muted hover:bg-muted/80 border-transparent"}`}
        >
          * (all)
        </button>
      </div>
    </div>
  );
}

export function RoleDetail({ role, onClose }: RoleDetailProps) {
  const [editing, setEditing] = useState(false);
  const [editRules, setEditRules] = useState<PolicyRule[]>(role?.rules || []);
  const { addChange } = useChangesStore();

  if (!role) return null;

  const handleSave = () => {
    addChange({
      id: generateChangeId(),
      action: "update",
      resourceKind: role.kind,
      resourceName: role.name,
      namespace: role.namespace,
      before: { rules: role.rules },
      after: { rules: editRules },
      description: `Update ${role.kind} "${role.name}" rules`,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: role.kind,
      resourceName: role.name,
      namespace: role.namespace,
      before: { rules: role.rules },
      after: null,
      description: `Delete ${role.kind} "${role.name}"`,
    });
    onClose();
  };

  const addRule = () => {
    setEditRules([...editRules, { verbs: [], apiGroups: [""], resources: [] }]);
  };

  return (
    <ResourceDetailSheet
      open={!!role}
      onClose={onClose}
      title={role.name}
      kind={role.kind}
      namespace={role.namespace}
      onEdit={() => { setEditing(true); setEditRules([...role.rules]); }}
      aiContext={`This ${role.kind} has ${role.rules.length} rule(s): ${role.rules.map((r) => `${r.verbs.join(",")} on ${r.resources.join(",")}`).join("; ")}.`}
      onDelete={handleDelete}
    >
      {role.creationTimestamp && (
        <p className="text-xs text-muted-foreground">Created: {new Date(role.creationTimestamp).toLocaleString()}</p>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2">
          <LearnTooltip term="Verb">Rules</LearnTooltip> ({editing ? editRules.length : role.rules.length})
        </h4>

        {editing ? (
          <div className="space-y-3">
            {editRules.map((rule, i) => (
              <RuleEditor
                key={i}
                rule={rule}
                onChange={(updated) => {
                  const next = [...editRules];
                  next[i] = updated;
                  setEditRules(next);
                }}
                onRemove={() => setEditRules(editRules.filter((_, j) => j !== i))}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addRule} className="gap-1 text-xs w-full">
              <Plus className="h-3 w-3" /> Add Rule
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave} className="gap-1 text-xs">
                <Check className="h-3 w-3" /> Save to Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {role.rules.map((rule, i) => (
              <div key={i} className="border rounded-lg p-2.5 text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground"><FieldLabel term="Verb">Verbs</FieldLabel>: </span>
                  {rule.verbs.map((v) => (
                    <Badge key={v} variant={v === "*" ? "destructive" : "secondary"} className="text-[10px] mr-1">{v}</Badge>
                  ))}
                </div>
                <div>
                  <span className="text-muted-foreground"><FieldLabel term="Resources">Resources</FieldLabel>: </span>
                  {rule.resources.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px] mr-1">{r}</Badge>
                  ))}
                </div>
                <div>
                  <span className="text-muted-foreground"><FieldLabel term="APIGroups">API Groups</FieldLabel>: </span>
                  <span>{rule.apiGroups.join(", ") || '""'}</span>
                </div>
              </div>
            ))}
            {role.rules.length === 0 && <p className="text-xs text-muted-foreground">No rules defined.</p>}
          </div>
        )}
      </div>
    </ResourceDetailSheet>
  );
}
