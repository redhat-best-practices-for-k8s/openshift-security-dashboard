"use client";

import { useState } from "react";
import { ResourceDetailSheet } from "@/components/shared/resource-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangesStore, generateChangeId } from "@/store/changes-store";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { FieldLabel } from "@/components/shared/field-label";
import type { RBACBinding, RBACSubject } from "@/types";
import { Plus, X, Check, Users, Shield } from "lucide-react";

interface BindingDetailProps {
  binding: RBACBinding | null;
  onClose: () => void;
}

function SubjectEditor({ subject, onChange, onRemove }: { subject: RBACSubject; onChange: (s: RBACSubject) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg">
      <Select value={subject.kind} onValueChange={(v) => onChange({ ...subject, kind: v as RBACSubject["kind"] })}>
        <SelectTrigger className="w-[130px] h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="User" className="text-xs">User</SelectItem>
          <SelectItem value="Group" className="text-xs">Group</SelectItem>
          <SelectItem value="ServiceAccount" className="text-xs">ServiceAccount</SelectItem>
        </SelectContent>
      </Select>
      <Input className="h-7 text-xs flex-1" value={subject.name} onChange={(e) => onChange({ ...subject, name: e.target.value })} placeholder="Name" />
      {subject.kind === "ServiceAccount" && (
        <Input className="h-7 text-xs w-[120px]" value={subject.namespace || ""} onChange={(e) => onChange({ ...subject, namespace: e.target.value })} placeholder="Namespace" />
      )}
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function BindingDetail({ binding, onClose }: BindingDetailProps) {
  const [editing, setEditing] = useState(false);
  const [editSubjects, setEditSubjects] = useState<RBACSubject[]>(binding?.subjects || []);
  const { addChange } = useChangesStore();

  if (!binding) return null;

  const handleSave = () => {
    addChange({
      id: generateChangeId(),
      action: "update",
      resourceKind: binding.kind,
      resourceName: binding.name,
      namespace: binding.namespace,
      before: { subjects: binding.subjects, roleRef: binding.roleRef },
      after: { subjects: editSubjects, roleRef: binding.roleRef },
      description: `Update subjects in ${binding.kind} "${binding.name}"`,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    addChange({
      id: generateChangeId(),
      action: "delete",
      resourceKind: binding.kind,
      resourceName: binding.name,
      namespace: binding.namespace,
      before: { subjects: binding.subjects, roleRef: binding.roleRef },
      after: null,
      description: `Delete ${binding.kind} "${binding.name}"`,
    });
    onClose();
  };

  return (
    <ResourceDetailSheet
      open={!!binding}
      onClose={onClose}
      title={binding.name}
      kind={binding.kind}
      namespace={binding.namespace}
      onEdit={() => { setEditing(true); setEditSubjects([...binding.subjects]); }}
      onDelete={handleDelete}
      aiContext={`Binds ${binding.roleRef.kind} "${binding.roleRef.name}" to ${binding.subjects.length} subject(s): ${binding.subjects.map((s) => `${s.kind}/${s.name}`).join(", ")}.`}
    >
      {binding.creationTimestamp && (
        <p className="text-xs text-muted-foreground">Created: {new Date(binding.creationTimestamp).toLocaleString()}</p>
      )}

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          <LearnTooltip term="Role">Role Reference</LearnTooltip>
        </h4>
        <div className="p-2.5 border rounded-lg text-xs">
          <Badge variant="outline" className="text-[10px] mr-1">{binding.roleRef.kind}</Badge>
          <span className="font-medium">{binding.roleRef.name}</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <LearnTooltip term="Subject">Subjects</LearnTooltip> ({editing ? editSubjects.length : binding.subjects.length})
        </h4>

        {editing ? (
          <div className="space-y-2">
            {editSubjects.map((subject, i) => (
              <SubjectEditor
                key={i}
                subject={subject}
                onChange={(updated) => {
                  const next = [...editSubjects];
                  next[i] = updated;
                  setEditSubjects(next);
                }}
                onRemove={() => setEditSubjects(editSubjects.filter((_, j) => j !== i))}
              />
            ))}
            <Button variant="outline" size="sm" onClick={() => setEditSubjects([...editSubjects, { kind: "User", name: "" }])} className="gap-1 text-xs w-full">
              <Plus className="h-3 w-3" /> Add Subject
            </Button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave} className="gap-1 text-xs">
                <Check className="h-3 w-3" /> Save to Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {binding.subjects.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border rounded-lg text-xs">
                <Badge variant="outline" className="text-[10px]">{s.kind}</Badge>
                <span className="font-medium">{s.name}</span>
                {s.namespace && <span className="text-muted-foreground">({s.namespace})</span>}
              </div>
            ))}
            {binding.subjects.length === 0 && <p className="text-xs text-muted-foreground">No subjects.</p>}
          </div>
        )}
      </div>
    </ResourceDetailSheet>
  );
}
