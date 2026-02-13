"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldLabel } from "@/components/shared/field-label";
import type { TLSScanResults, TLSIPResult, TLSScanStatus } from "@/types";

const statusColors: Record<TLSScanStatus, string> = {
  OK: "bg-green-500/15 text-green-700 border-green-200",
  NO_TLS: "bg-red-500/15 text-red-700 border-red-200",
  LOCALHOST_ONLY: "bg-blue-500/15 text-blue-700 border-blue-200",
  FILTERED: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
  CLOSED: "bg-gray-500/15 text-gray-700 border-gray-200",
  MTLS_REQUIRED: "bg-purple-500/15 text-purple-700 border-purple-200",
  TIMEOUT: "bg-orange-500/15 text-orange-700 border-orange-200",
  NO_PORTS: "bg-gray-500/15 text-gray-500 border-gray-200",
  ERROR: "bg-red-500/15 text-red-700 border-red-200",
};

interface TLSSummaryProps {
  results: TLSScanResults;
  filteredIPs: TLSIPResult[];
}

export function TLSSummary({ results, filteredIPs }: TLSSummaryProps) {
  const allPorts = filteredIPs.flatMap((ip) => ip.port_results || []);

  const statusCounts: Record<string, number> = {};
  for (const pr of allPorts) {
    statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
  }

  const tlsVersionCounts: Record<string, number> = {};
  for (const pr of allPorts) {
    for (const v of pr.tls_versions || []) {
      tlsVersionCounts[v] = (tlsVersionCounts[v] || 0) + 1;
    }
  }

  let weakCipherCount = 0;
  for (const pr of allPorts) {
    if (pr.tls_cipher_strength) {
      for (const grade of Object.values(pr.tls_cipher_strength)) {
        if (grade === "C" || grade === "D") weakCipherCount++;
      }
    }
  }

  const tlsPorts = allPorts.filter((p) => p.status === "OK");
  const quantumReadyCount = tlsPorts.filter((p) => p.quantum_ready).length;
  const quantumPct = tlsPorts.length > 0 ? Math.round((quantumReadyCount / tlsPorts.length) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            IPs Scanned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{results.scanned_ips}</div>
          <p className="text-xs text-muted-foreground">
            of {results.total_ips} total IPs
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            <FieldLabel term="TLSScanStatus">Ports by Status</FieldLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{allPorts.length}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(statusCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={`text-[10px] ${statusColors[status as TLSScanStatus] || ""}`}
                >
                  {status}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            <FieldLabel term="TLSVersion">TLS Versions</FieldLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Object.keys(tlsVersionCounts).length}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(tlsVersionCounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([version, count]) => (
                <Badge key={version} variant="outline" className="text-[10px]">
                  {version}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            <FieldLabel term="TLSCipher">Weak Ciphers</FieldLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${weakCipherCount > 0 ? "text-destructive" : "text-green-600"}`}>
            {weakCipherCount}
          </div>
          <p className="text-xs text-muted-foreground">
            ciphers rated C or D
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            <FieldLabel term="QuantumReady">Quantum Ready</FieldLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${quantumReadyCount > 0 ? "text-green-600" : "text-muted-foreground"}`}>
            {quantumReadyCount}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {tlsPorts.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {quantumPct}% TLS ports support TLS 1.3
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
