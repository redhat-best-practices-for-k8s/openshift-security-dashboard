"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceLink } from "@/components/shared/resource-link";
import type { WorkloadResource, WorkloadKind } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { Search, ShieldAlert, ShieldCheck, Shield, Box, Filter, Lock } from "lucide-react";

interface WorkloadListProps {
  workloads: WorkloadResource[];
  onSelect: (workload: WorkloadResource) => void;
}

function getSecurityLevel(w: WorkloadResource): "critical" | "warning" | "good" | "unknown" {
  for (const c of w.containers) {
    if (c.securityContext?.privileged) return "critical";
  }
  if (w.podSecurityPosture.hostNetwork || w.podSecurityPosture.hostPID) return "critical";
  for (const c of w.containers) {
    if (!c.securityContext) return "warning";
    if (c.securityContext.runAsUser === 0) return "warning";
    if (c.securityContext.allowPrivilegeEscalation !== false) return "warning";
  }
  const allHardened = w.containers.every((c) => {
    const sc = c.securityContext;
    return sc && sc.runAsNonRoot && sc.readOnlyRootFilesystem && sc.allowPrivilegeEscalation === false;
  });
  if (allHardened) return "good";
  return "warning";
}

const securityIcons = {
  critical: <ShieldAlert className="h-3.5 w-3.5 text-red-500" />,
  warning: <Shield className="h-3.5 w-3.5 text-yellow-500" />,
  good: <ShieldCheck className="h-3.5 w-3.5 text-green-500" />,
  unknown: <Shield className="h-3.5 w-3.5 text-muted-foreground" />,
};

const securityLabels = {
  critical: "Critical",
  warning: "Needs Review",
  good: "Hardened",
  unknown: "Unknown",
};

const KINDS: WorkloadKind[] = ["Deployment", "StatefulSet", "DaemonSet", "Pod", "Job", "CronJob"];

export function WorkloadList({ workloads, onSelect }: WorkloadListProps) {
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [securityFilter, setSecurityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return workloads.filter((w) => {
      if (kindFilter !== "all" && w.kind !== kindFilter) return false;
      if (securityFilter !== "all" && getSecurityLevel(w) !== securityFilter) return false;
      if (filter) {
        const q = filter.toLowerCase();
        return w.name.toLowerCase().includes(q) || w.namespace.toLowerCase().includes(q);
      }
      return true;
    });
  }, [workloads, filter, kindFilter, securityFilter]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, good: 0, unknown: 0, total: workloads.length };
    for (const w of workloads) { c[getSecurityLevel(w)]++; }
    return c;
  }, [workloads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by name or namespace..." className="pl-9 h-9 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Kinds</SelectItem>
            {KINDS.map((k) => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={securityFilter} onValueChange={setSecurityFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><Shield className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Security</SelectItem>
            <SelectItem value="critical" className="text-xs">Critical ({counts.critical})</SelectItem>
            <SelectItem value="warning" className="text-xs">Needs Review ({counts.warning})</SelectItem>
            <SelectItem value="good" className="text-xs">Hardened ({counts.good})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline">{filtered.length} of {workloads.length}</Badge>
        {counts.critical > 0 && <Badge variant="destructive" className="text-[10px]">{counts.critical} critical</Badge>}
        {counts.warning > 0 && <Badge variant="secondary" className="text-[10px]">{counts.warning} need review</Badge>}
        {counts.good > 0 && <Badge className="text-[10px] bg-green-500">{counts.good} hardened</Badge>}
      </div>

      <Card>
        <CardContent className="pt-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[30px]"></TableHead>
                  <TableHead className="text-xs">Kind</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Namespace</TableHead>
                  <TableHead className="text-xs text-center">Containers</TableHead>
                  <TableHead className="text-xs text-center">Ports</TableHead>
                  <TableHead className="text-xs"><FieldLabel term="ServiceAccount">Service Account</FieldLabel></TableHead>
                  <TableHead className="text-xs"><FieldLabel term="AppliedSCC">SCC</FieldLabel></TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 300).map((w) => {
                  const level = getSecurityLevel(w);
                  const totalPorts = w.containers.reduce((sum, c) => sum + c.ports.length, 0);
                  return (
                    <TableRow key={`${w.kind}:${w.namespace}/${w.name}`} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(w)}>
                      <TableCell>{securityIcons[level]}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{w.kind}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{w.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.namespace}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{w.containers.length}</Badge></TableCell>
                      <TableCell className="text-center">{totalPorts > 0 ? <Badge variant="outline" className="text-[10px]">{totalPorts}</Badge> : <span className="text-muted-foreground text-[10px]">-</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <ResourceLink kind="ServiceAccount" name={w.podSecurityPosture.serviceAccountName} namespace={w.namespace} compact />
                      </TableCell>
                      <TableCell className="text-xs">
                        {w.appliedSCC ? <ResourceLink kind="SCC" name={w.appliedSCC} compact /> : <span className="text-muted-foreground text-[10px]">-</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{w.status || "-"}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
