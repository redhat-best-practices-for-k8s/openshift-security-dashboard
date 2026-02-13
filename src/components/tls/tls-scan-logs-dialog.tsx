"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TLSScanLogsDialogProps {
  open: boolean;
  onClose: () => void;
  logs: string;
  scanId?: string;
}

export function TLSScanLogsDialog({ open, onClose, logs, scanId }: TLSScanLogsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Scan Logs</DialogTitle>
          <DialogDescription>
            {scanId ? `Scan ${scanId}` : "Full output from the TLS scan"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[65vh] rounded-md border bg-muted/30 p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {logs || "No logs available."}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
