"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RBACData } from "@/types";
import { Search, Check, X } from "lucide-react";

interface PermissionEntry {
  subject: string;
  subjectKind: string;
  namespace: string;
  resource: string;
  verbs: string[];
  roleName: string;
  roleKind: string;
}

function buildMatrix(data: RBACData): PermissionEntry[] {
  const entries: PermissionEntry[] = [];
  const allRoles = [...data.roles, ...data.clusterRoles];
  const roleMap = new Map(allRoles.map((r) => [`${r.kind}:${r.name}`, r]));

  const allBindings = [...data.roleBindings, ...data.clusterRoleBindings];

  for (const binding of allBindings) {
    const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
    const role = roleMap.get(roleKey);
    if (!role) continue;

    for (const subject of binding.subjects) {
      for (const rule of role.rules) {
        for (const resource of rule.resources) {
          entries.push({
            subject: subject.name,
            subjectKind: subject.kind,
            namespace: binding.namespace || "*",
            resource,
            verbs: rule.verbs,
            roleName: role.name,
            roleKind: role.kind,
          });
        }
      }
    }
  }

  return entries;
}

interface RBACMatrixProps {
  data: RBACData;
}

export function RBACMatrix({ data }: RBACMatrixProps) {
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => buildMatrix(data), [data]);

  const filtered = useMemo(() => {
    if (!filter) return entries.slice(0, 100);
    const lower = filter.toLowerCase();
    return entries
      .filter(
        (e) =>
          e.subject.toLowerCase().includes(lower) ||
          e.resource.toLowerCase().includes(lower) ||
          e.roleName.toLowerCase().includes(lower) ||
          e.namespace.toLowerCase().includes(lower)
      )
      .slice(0, 100);
  }, [entries, filter]);

  const allVerbs = ["get", "list", "watch", "create", "update", "patch", "delete", "*"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Permission Matrix</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by subject, resource, role..."
              className="pl-8 h-8 w-64 text-xs"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[140px]">Subject</TableHead>
                <TableHead className="text-xs w-[80px]">Type</TableHead>
                <TableHead className="text-xs w-[100px]">Namespace</TableHead>
                <TableHead className="text-xs w-[120px]">Resource</TableHead>
                {allVerbs.map((v) => (
                  <TableHead key={v} className="text-xs text-center w-[50px]">
                    {v}
                  </TableHead>
                ))}
                <TableHead className="text-xs">Via Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell className="font-medium">{entry.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.subjectKind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.namespace}</TableCell>
                  <TableCell><code className="text-[11px]">{entry.resource}</code></TableCell>
                  {allVerbs.map((v) => (
                    <TableCell key={v} className="text-center">
                      {entry.verbs.includes(v) || entry.verbs.includes("*") ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-muted-foreground">
                    <span className="text-[10px]">{entry.roleKind}/</span>{entry.roleName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 100 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Showing first 100 results. Use the filter to narrow down.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
