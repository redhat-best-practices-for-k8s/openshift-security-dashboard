"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download } from "lucide-react";

interface TLSScanLogsDialogProps {
  open: boolean;
  onClose: () => void;
  logs: string;
  scanId?: string;
}

export function TLSScanLogsDialog({ open, onClose, logs, scanId }: TLSScanLogsDialogProps) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (preRef.current) {
        const range = document.createRange();
        range.selectNodeContents(preRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tls-scan-${scanId || "logs"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>Scan Logs</DialogTitle>
              <DialogDescription>
                {scanId ? `Scan ${scanId}` : "Full output from the TLS scan"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleDownload} disabled={!logs}>
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="h-[65vh] rounded-md border bg-muted/30 overflow-auto">
          <pre
            ref={preRef}
            className="text-xs font-mono whitespace-pre-wrap p-3 select-text cursor-text"
          >
            {logs || "No logs available."}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
