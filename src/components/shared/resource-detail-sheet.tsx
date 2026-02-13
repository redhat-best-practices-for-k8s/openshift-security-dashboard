"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Sparkles } from "lucide-react";

interface ResourceDetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: string;
  namespace?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Extra context lines to send to the AI when "Ask AI" is clicked */
  aiContext?: string;
  children: React.ReactNode;
}

function dispatchAIRequest(kind: string, name: string, namespace?: string, extra?: string) {
  const context = {
    kind,
    name,
    namespace,
    details: extra || "",
    summary: `${kind} "${name}"${namespace ? ` in namespace "${namespace}"` : ""}${extra ? ` — ${extra}` : ""}`,
  };
  const event = new CustomEvent("ai-resource-context", { detail: context });
  window.dispatchEvent(event);
}

export function ResourceDetailSheet({ open, onClose, title, kind, namespace, onEdit, onDelete, aiContext, children }: ResourceDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Badge variant="outline" className="text-[10px]">{kind}</Badge>
            {title}
            {namespace && <Badge variant="secondary" className="text-[10px]">{namespace}</Badge>}
          </SheetTitle>
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-1 text-xs">
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" onClick={onDelete} className="gap-1 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatchAIRequest(kind, title, namespace, aiContext)}
              className="gap-1 text-xs"
            >
              <Sparkles className="h-3 w-3" /> Ask AI
            </Button>
          </div>
        </SheetHeader>
        <div className="mt-4 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
