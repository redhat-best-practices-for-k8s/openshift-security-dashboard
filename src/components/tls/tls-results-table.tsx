"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/components/shared/field-label";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Shield,
  ShieldCheck,
  ShieldX,
  Timer,
  Ban,
  Server,
  Atom,
} from "lucide-react";
import type { TLSIPResult, TLSPortResult, TLSScanStatus } from "@/types";

const statusIcons: Record<TLSScanStatus, React.ReactNode> = {
  OK: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  NO_TLS: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  LOCALHOST_ONLY: <Server className="h-3.5 w-3.5 text-blue-600" />,
  FILTERED: <Ban className="h-3.5 w-3.5 text-yellow-600" />,
  CLOSED: <Ban className="h-3.5 w-3.5 text-gray-500" />,
  MTLS_REQUIRED: <Lock className="h-3.5 w-3.5 text-purple-600" />,
  TIMEOUT: <Timer className="h-3.5 w-3.5 text-orange-600" />,
  NO_PORTS: <Shield className="h-3.5 w-3.5 text-gray-400" />,
  ERROR: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
};

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

interface FlatPortRow {
  ip: string;
  podName: string;
  podNamespace: string;
  component: string;
  node: string;
  containerId: string;
  portResult: TLSPortResult;
}

interface TLSResultsTableProps {
  filteredIPs: TLSIPResult[];
  onSelectPort: (ip: TLSIPResult, port: TLSPortResult) => void;
}

type QuantumFilter = "all" | "quantum-ready" | "not-quantum-ready";

export function TLSResultsTable({ filteredIPs, onSelectPort }: TLSResultsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tlsVersionFilter, setTlsVersionFilter] = useState("all");
  const [quantumFilter, setQuantumFilter] = useState<QuantumFilter>("all");

  const flatRows: FlatPortRow[] = useMemo(() => {
    const rows: FlatPortRow[] = [];
    for (const ip of filteredIPs) {
      for (const pr of ip.port_results || []) {
        rows.push({
          ip: ip.ip,
          podName: ip.pod?.Name || "",
          podNamespace: ip.pod?.Namespace || "",
          component: ip.openshift_component?.component || "",
          node: ip.node || "",
          containerId: pr.container_id || "",
          portResult: pr,
        });
      }
    }
    return rows;
  }, [filteredIPs]);

  const statuses = useMemo(
    () => [...new Set(flatRows.map((r) => r.portResult.status))].sort(),
    [flatRows],
  );
  const tlsVersions = useMemo(() => {
    const set = new Set<string>();
    for (const r of flatRows) {
      for (const v of r.portResult.tls_versions || []) set.add(v);
    }
    return [...set].sort();
  }, [flatRows]);

  const filtered = useMemo(() => {
    let rows = flatRows;

    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.portResult.status === statusFilter);
    }
    if (tlsVersionFilter !== "all") {
      rows = rows.filter((r) =>
        r.portResult.tls_versions?.includes(tlsVersionFilter),
      );
    }
    if (quantumFilter === "quantum-ready") {
      rows = rows.filter((r) => r.portResult.quantum_ready === true);
    } else if (quantumFilter === "not-quantum-ready") {
      rows = rows.filter((r) => r.portResult.quantum_ready !== true);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.podName.toLowerCase().includes(q) ||
          r.podNamespace.toLowerCase().includes(q) ||
          r.component.toLowerCase().includes(q) ||
          r.ip.includes(q) ||
          r.node.toLowerCase().includes(q) ||
          r.containerId.toLowerCase().includes(q) ||
          String(r.portResult.port).includes(q) ||
          (r.portResult.service || "").toLowerCase().includes(q) ||
          (r.portResult.process_name || "").toLowerCase().includes(q),
      );
    }

    return rows;
  }, [flatRows, statusFilter, tlsVersionFilter, quantumFilter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search pods, IPs, ports, nodes, container IDs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tlsVersionFilter} onValueChange={setTlsVersionFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="TLS Version" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All versions</SelectItem>
            {tlsVersions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {(["all", "quantum-ready", "not-quantum-ready"] as QuantumFilter[]).map((val) => (
            <Button
              key={val}
              size="sm"
              variant={quantumFilter === val ? "default" : "outline"}
              className="h-8 text-xs px-2"
              onClick={() => setQuantumFilter(val)}
            >
              {val === "all" ? (
                "All"
              ) : val === "quantum-ready" ? (
                <span className="flex items-center gap-1">
                  <Atom className="h-3 w-3" /> QR
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldX className="h-3 w-3" /> No QR
                </span>
              )}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filtered.length} of {flatRows.length} ports
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">
                <FieldLabel term="TLSScanStatus">Status</FieldLabel>
              </TableHead>
              <TableHead>Pod</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Component</TableHead>
              <TableHead className="w-16">Port</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>
                <FieldLabel term="TLSVersion">TLS</FieldLabel>
              </TableHead>
              <TableHead className="w-20">
                <FieldLabel term="TLSCipher">Ciphers</FieldLabel>
              </TableHead>
              <TableHead className="w-14">
                <FieldLabel term="QuantumReady">QR</FieldLabel>
              </TableHead>
              <TableHead>
                <FieldLabel term="ContainerID">Container</FieldLabel>
              </TableHead>
              <TableHead>
                <FieldLabel term="ListenAddress">Listen</FieldLabel>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No port results match your filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 200).map((row, i) => {
                const pr = row.portResult;
                const parentIP = filteredIPs.find((ip) => ip.ip === row.ip);
                return (
                  <TableRow
                    key={`${row.ip}-${pr.port}-${i}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => parentIP && onSelectPort(parentIP, pr)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {statusIcons[pr.status]}
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusColors[pr.status] || ""}`}
                        >
                          {pr.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium truncate max-w-[150px]">
                      {row.podName || row.ip}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.podNamespace}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {row.component}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{pr.port}</TableCell>
                    <TableCell className="text-xs truncate max-w-[100px]">
                      {pr.service || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-0.5">
                        {(pr.tls_versions || []).map((v) => (
                          <Badge
                            key={v}
                            variant="outline"
                            className={`text-[9px] font-mono ${
                              v.includes("1.3")
                                ? "bg-green-500/10 text-green-700"
                                : v.includes("1.2")
                                  ? "bg-blue-500/10 text-blue-700"
                                  : "bg-yellow-500/10 text-yellow-700"
                            }`}
                          >
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-center">
                      {pr.tls_ciphers?.length || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {pr.quantum_ready ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : pr.status === "OK" ? (
                        <ShieldX className="h-3.5 w-3.5 text-red-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                      {row.containerId ? row.containerId.substring(0, 12) : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {pr.listen_address || "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > 200 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 200 of {filtered.length} results. Use filters to narrow down.
        </p>
      )}
    </div>
  );
}
