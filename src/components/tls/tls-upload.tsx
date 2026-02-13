"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, XCircle, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { TLSScanResults } from "@/types";
import type { NodeProgressEntry } from "@/lib/k8s/tls-scanner";

interface TLSUploadProps {
  hasKubeConfig: boolean;
  onResults: (results: TLSScanResults, scanId: string) => void;
  onScanStarted?: () => void;
}

export function TLSUpload({ hasKubeConfig, onResults, onScanStarted }: TLSUploadProps) {
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState("");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [nodeProgress, setNodeProgress] = useState<NodeProgressEntry[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const pollRes = await fetch("/api/tls-scan");
        const pollData = await pollRes.json();

        if (pollData.logs) setLogs(pollData.logs);
        if (pollData.nodeProgress) setNodeProgress(pollData.nodeProgress);

        if (pollData.status === "completed") {
          stopPolling();
          setScanning(false);
          setStatusText("Scan complete!");
          if (pollData.results && pollData.scanId) {
            onResults(pollData.results, pollData.scanId);
          } else {
            setError("Scan completed but no results file was found");
          }
        } else if (pollData.status === "failed") {
          stopPolling();
          setScanning(false);
          setStatusText("");
          setError("Scan failed. Check logs for details.");
        } else if (pollData.status === "not_found") {
          stopPolling();
          setScanning(false);
          setStatusText("");
        } else {
          setStatusText(pollData.progress || "Scanning cluster nodes...");
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    }, 3000);
  }, [stopPolling, onResults]);

  useEffect(() => {
    if (!hasKubeConfig) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/tls-scan");
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "running") {
          setScanning(true);
          setStatusText("Resuming scan monitoring...");
          if (data.logs) setLogs(data.logs);
          if (data.nodeProgress) setNodeProgress(data.nodeProgress);
          if (data.scanId) setScanId(data.scanId);
          startPolling();
        } else if (data.status === "completed" && data.results && data.scanId) {
          onResults(data.results, data.scanId);
        }
      } catch {
        // API not available or kubeconfig issue
      }
    })();

    return () => { cancelled = true; };
  }, [hasKubeConfig, onResults, startPolling]);

  const startScan = async () => {
    setError("");
    setScanning(true);
    setStatusText("Running oc debug on each node...");
    setLogs("");
    setNodeProgress([]);
    onScanStarted?.();

    try {
      const res = await fetch("/api/tls-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to launch scan");
      }

      setScanId(data.scanId);
      setStatusText(`oc debug running on ${data.nodeCount} nodes...`);
      startPolling();
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const cancelScan = async () => {
    stopPolling();
    setScanning(false);
    setStatusText("");
    try {
      await fetch("/api/tls-scan", { method: "DELETE" });
    } catch { /* best effort */ }
  };

  if (scanning) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            TLS Scan In Progress
          </CardTitle>
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nodeProgress.length > 0 && (
            <div className="space-y-2">
              {nodeProgress.map((np) => {
                const pct = np.totalNetns > 0
                  ? Math.round((np.scannedNetns / np.totalNetns) * 100)
                  : 0;
                const shortName = np.name.split(".")[0];
                return (
                  <div key={np.name} className="flex items-center gap-3">
                    <div className="w-5 flex-shrink-0">
                      {np.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {np.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                      {np.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {np.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <span className="text-xs font-mono w-36 truncate" title={np.name}>
                      {shortName}
                    </span>
                    <div className="flex-1">
                      <Progress value={np.status === "completed" ? 100 : pct} className="h-2" />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {np.status === "pending" ? "waiting" :
                       np.status === "completed" ? `${np.totalNetns} netns` :
                       np.status === "failed" ? "failed" :
                       np.totalNetns > 0 ? `${np.scannedNetns}/${np.totalNetns}` : "starting"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <ScrollArea className="h-[50vh] rounded-md border bg-muted/30 p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {logs || "Waiting for pods to start..."}
            </pre>
            <div ref={logEndRef} />
          </ScrollArea>
          <Button variant="destructive" onClick={cancelScan}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Scan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`max-w-xl mx-auto ${!hasKubeConfig ? "opacity-60" : ""}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Run Node-Level TLS Scan
        </CardTitle>
        <CardDescription>
          Runs <code className="text-xs bg-muted px-1 rounded">oc debug node/&lt;name&gt;</code> on
          every cluster node. Each debug session uses the host&apos;s own tools
          (openssl, ss, crictl, nsenter) to scan every network namespace for
          TLS configuration, ciphers, and quantum-readiness.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          onClick={startScan}
          disabled={!hasKubeConfig}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Scan
        </Button>
        {!hasKubeConfig && (
          <p className="text-xs text-muted-foreground">
            Upload a kubeconfig first to use in-cluster scanning.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
