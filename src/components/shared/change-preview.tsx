"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useChangesStore } from "@/store/changes-store";
import { Eye, Trash2, Play, X, Sparkles, Plus, Pencil, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { stringify } from "yaml";

const actionIcons = { create: Plus, update: Pencil, delete: Trash2 };
const actionColors = {
  create: "bg-green-500/15 text-green-700 border-green-500/30",
  update: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  delete: "bg-red-500/15 text-red-700 border-red-500/30",
};

export function ChangePreview() {
  const { changes, removeChange, clearChanges, applyingChanges, setApplyingChanges, setLastApplyError } = useChangesStore();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; success: boolean; error?: string }>>([]);

  const handleApply = async () => {
    setApplyingChanges(true);
    setResults([]);
    setLastApplyError(null);

    try {
      const res = await fetch("/api/changes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const data = await res.json();
      setResults(data.results || []);

      if (data.allSuccess) {
        clearChanges();
        setTimeout(() => setOpen(false), 1500);
      } else {
        const failed = data.results?.find((r: { success: boolean }) => !r.success);
        if (failed) setLastApplyError(failed.error || "Unknown error");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to apply";
      setLastApplyError(message);
    } finally {
      setApplyingChanges(false);
    }
  };

  if (changes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2 fixed bottom-4 right-44 z-50 shadow-lg">
          <Eye className="h-4 w-4" />
          Review Changes
          <Badge variant="secondary" className="text-[10px] ml-1 bg-white/20">{changes.length}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Review Pending Changes ({changes.length})
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="space-y-3 pr-3">
            {changes.map((change) => {
              const ActionIcon = actionIcons[change.action];
              const result = results.find((r) => r.id === change.id);
              return (
                <div key={change.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${actionColors[change.action]}`}>
                        <ActionIcon className="h-3 w-3" />
                        {change.action}
                      </Badge>
                      <span className="text-sm font-medium">{change.resourceKind}</span>
                      <span className="text-sm">{change.resourceName}</span>
                      {change.namespace && (
                        <Badge variant="outline" className="text-[10px]">{change.namespace}</Badge>
                      )}
                      {change.aiSuggested && (
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      )}
                      {result && (
                        result.success
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeChange(change.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{change.description}</p>
                  {change.aiExplanation && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-2 flex items-start gap-1">
                      <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                      {change.aiExplanation.slice(0, 200)}{change.aiExplanation.length > 200 ? "..." : ""}
                    </p>
                  )}
                  {change.after && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                        View spec
                      </summary>
                      <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                        {stringify(change.after)}
                      </pre>
                    </details>
                  )}
                  {result && !result.success && (
                    <p className="text-xs text-red-500 mt-1">Error: {result.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={clearChanges} disabled={applyingChanges}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear All
          </Button>
          <Button size="sm" onClick={handleApply} disabled={applyingChanges} className="gap-2">
            {applyingChanges ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Apply {changes.length} Change{changes.length !== 1 ? "s" : ""} to Cluster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
