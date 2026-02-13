"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { TLSUpload } from "@/components/tls/tls-upload";
import { TLSSummary } from "@/components/tls/tls-summary";
import { TLSConfigPanel } from "@/components/tls/tls-config-panel";
import { TLSResultsTable } from "@/components/tls/tls-results-table";
import { TLSPortDetail } from "@/components/tls/tls-port-detail";
import { TLSScanLogsDialog } from "@/components/tls/tls-scan-logs-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RotateCcw,
  AlertTriangle,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Ban,
} from "lucide-react";
import type { TLSScanResults, TLSIPResult, TLSPortResult } from "@/types";

interface ScanHistorySummary {
  id: string;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  nodeCount: number;
  logs: string;
}

export default function TLSPage() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [results, setResults] = useState<TLSScanResults | null>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [currentLogs, setCurrentLogs] = useState<string>("");
  const [selectedIP, setSelectedIP] = useState<TLSIPResult | null>(null);
  const [selectedPort, setSelectedPort] = useState<TLSPortResult | null>(null);
  const [history, setHistory] = useState<ScanHistorySummary[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/tls-scan?history=true");
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (kubeconfigLoaded) fetchHistory();
  }, [kubeconfigLoaded, fetchHistory]);

  const filteredIPs = useMemo(() => {
    if (!results) return [];
    if (!selectedNamespace) return results.ip_results;
    return results.ip_results.filter((ip) => ip.pod?.Namespace === selectedNamespace);
  }, [results, selectedNamespace]);

  const handleSelectPort = (ip: TLSIPResult, port: TLSPortResult) => {
    setSelectedIP(ip);
    setSelectedPort(port);
  };

  const handleResults = useCallback((r: TLSScanResults, scanId: string) => {
    setResults(r);
    setCurrentScanId(scanId);
    fetchHistory();
  }, [fetchHistory]);

  const handleExport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tls-scan-${results.timestamp || "results"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadHistoryScan = async (scanId: string) => {
    setLoadingHistoryId(scanId);
    try {
      const res = await fetch(`/api/tls-scan?id=${scanId}`);
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        setCurrentScanId(scanId);
        setCurrentLogs(data.logs || "");
      } else if (data.logs) {
        setCurrentScanId(scanId);
        setCurrentLogs(data.logs);
        setLogsOpen(true);
      }
    } catch { /* ignore */ }
    setLoadingHistoryId(null);
  };

  const handleViewLogs = async () => {
    if (currentLogs) {
      setLogsOpen(true);
      return;
    }
    if (!currentScanId) return;
    try {
      const res = await fetch(`/api/tls-scan?id=${currentScanId}`);
      const data = await res.json();
      if (data.logs) {
        setCurrentLogs(data.logs);
        setLogsOpen(true);
      }
    } catch { /* ignore */ }
  };

  const handleNewScan = () => {
    setResults(null);
    setCurrentScanId(null);
    setCurrentLogs("");
  };

  // No results yet -- show upload/scan UI + history
  if (!results) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="TLS Compliance"
          description="Scan your cluster for TLS configuration compliance using node-level debug pods."
        />
        <TLSUpload
          hasKubeConfig={kubeconfigLoaded}
          onResults={handleResults}
          onScanStarted={fetchHistory}
        />

        {history.length > 0 && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-base">Scan History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Nodes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <ScanStatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(entry.startTime).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.endTime
                            ? formatDuration(entry.endTime - entry.startTime)
                            : "in progress"}
                        </TableCell>
                        <TableCell className="text-xs">{entry.nodeCount}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {entry.status === "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={loadingHistoryId === entry.id}
                              onClick={() => loadHistoryScan(entry.id)}
                            >
                              View Results
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setCurrentScanId(entry.id);
                              setCurrentLogs(entry.logs);
                              setLogsOpen(true);
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Logs
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <TLSScanLogsDialog
          open={logsOpen}
          onClose={() => setLogsOpen(false)}
          logs={currentLogs}
          scanId={currentScanId || undefined}
        />
      </div>
    );
  }

  // Results loaded -- show dashboard
  return (
    <div className="space-y-6">
      <PageHeader
        title="TLS Compliance"
        description={`Scan from ${results.timestamp || "unknown"} · ${filteredIPs.length} of ${results.scanned_ips} IPs${selectedNamespace ? ` in ${selectedNamespace}` : ""}`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleViewLogs}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Logs
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewScan}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            New Scan
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ports">
            Port Results
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {filteredIPs.reduce((sum, ip) => sum + (ip.port_results?.length || 0), 0)}
            </Badge>
          </TabsTrigger>
          {results.scan_errors && results.scan_errors.length > 0 && (
            <TabsTrigger value="errors">
              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-destructive" />
              Errors
              <Badge variant="destructive" className="ml-1.5 text-[10px]">
                {results.scan_errors.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <TLSSummary results={results} filteredIPs={filteredIPs} />
          {results.tls_security_config && (
            <TLSConfigPanel config={results.tls_security_config} />
          )}
        </TabsContent>

        <TabsContent value="ports">
          <TLSResultsTable
            filteredIPs={filteredIPs}
            onSelectPort={handleSelectPort}
          />
        </TabsContent>

        {results.scan_errors && results.scan_errors.length > 0 && (
          <TabsContent value="errors">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Pod</TableHead>
                    <TableHead>Namespace</TableHead>
                    <TableHead>Error Type</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.scan_errors.map((err, i) => (
                    <TableRow key={`${err.ip}-${err.port}-${i}`}>
                      <TableCell className="font-mono text-xs">{err.ip}</TableCell>
                      <TableCell className="font-mono text-xs">{err.port}</TableCell>
                      <TableCell className="text-xs">{err.pod_name || "-"}</TableCell>
                      <TableCell className="text-xs">{err.namespace || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {err.error_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {err.error_message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <TLSPortDetail
        ipResult={selectedIP}
        portResult={selectedPort}
        open={!!selectedPort}
        onClose={() => {
          setSelectedIP(null);
          setSelectedPort(null);
        }}
      />

      <TLSScanLogsDialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        logs={currentLogs}
        scanId={currentScanId || undefined}
      />
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────────

function ScanStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-300">
          <Play className="h-3 w-3" /> Running
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
          <Ban className="h-3 w-3" /> Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
