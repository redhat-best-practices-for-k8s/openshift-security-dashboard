"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResourceLink } from "@/components/shared/resource-link";
import type { CrossNamespaceAccess } from "@/types";
import { FieldLabel } from "@/components/shared/field-label";
import { ArrowRight, AlertTriangle } from "lucide-react";

interface CrossNamespaceMatrixProps {
  accesses: CrossNamespaceAccess[];
}

export function CrossNamespaceMatrix({ accesses }: CrossNamespaceMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{ source: string; target: string } | null>(null);

  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    for (const a of accesses) {
      ns.add(a.sourceNamespace);
      if (a.targetNamespace !== "(all namespaces)") ns.add(a.targetNamespace);
    }
    return Array.from(ns).sort();
  }, [accesses]);

  const matrix = useMemo(() => {
    const m = new Map<string, CrossNamespaceAccess[]>();
    for (const a of accesses) {
      const key = `${a.sourceNamespace}->${a.targetNamespace}`;
      const existing = m.get(key) || [];
      m.set(key, [...existing, a]);
    }
    return m;
  }, [accesses]);

  const clusterWide = accesses.filter((a) => a.targetNamespace === "(all namespaces)");

  const selectedAccesses = selectedCell
    ? matrix.get(`${selectedCell.source}->${selectedCell.target}`) || []
    : [];

  if (accesses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No cross-namespace access detected</p>
        <p className="text-xs mt-1">Service accounts only have permissions within their own namespace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clusterWide.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Cluster-Wide Access ({clusterWide.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clusterWide.map((a, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border text-xs flex-wrap">
                  <Badge variant="outline" className="text-[9px]">{a.sourceNamespace}</Badge>
                  <ResourceLink kind={a.sourceSubject.kind} name={a.sourceSubject.name} namespace={a.sourceNamespace} />
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="destructive" className="text-[9px]">all namespaces</Badge>
                  <span className="text-muted-foreground">via</span>
                  <ResourceLink kind={a.roleRef.kind} name={a.roleRef.name} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cross-Namespace Access Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left border-b font-medium">Source \ Target</th>
                    {namespaces.map((ns) => (
                      <th key={ns} className="p-2 text-center border-b font-medium max-w-[100px] truncate" title={ns}>{ns}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {namespaces.map((source) => (
                    <tr key={source}>
                      <td className="p-2 border-b font-medium">{source}</td>
                      {namespaces.map((target) => {
                        const key = `${source}->${target}`;
                        const items = matrix.get(key) || [];
                        const isSelf = source === target;
                        return (
                          <td key={target} className="p-1 border-b text-center">
                            {isSelf ? (
                              <span className="text-muted-foreground">-</span>
                            ) : items.length > 0 ? (
                              <button
                                onClick={() => setSelectedCell({ source, target })}
                                className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-500/15 text-red-700 font-medium hover:bg-red-500/25 transition-colors"
                              >
                                {items.length}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCell} onOpenChange={(v) => !v && setSelectedCell(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{selectedCell?.source}</Badge>
              <ArrowRight className="h-3 w-3" />
              <Badge variant="outline" className="text-[10px]">{selectedCell?.target}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedAccesses.map((a, i) => (
              <div key={i} className="p-3 border rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <ResourceLink kind={a.sourceSubject.kind} name={a.sourceSubject.name} namespace={a.sourceNamespace} />
                </div>
                <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                  Binding: <ResourceLink kind={a.bindingKind} name={a.bindingName} namespace={a.targetNamespace !== "(all namespaces)" ? a.targetNamespace : undefined} />
                </div>
                <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                  Role: <ResourceLink kind={a.roleRef.kind} name={a.roleRef.name} />
                </div>
                {a.grantedVerbs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-muted-foreground"><FieldLabel term="Verb">Verbs</FieldLabel>:</span>
                    {a.grantedVerbs.map((v) => <Badge key={v} variant="secondary" className="text-[9px]">{v}</Badge>)}
                  </div>
                )}
                {a.grantedResources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground"><FieldLabel term="Resources">Resources</FieldLabel>:</span>
                    {a.grantedResources.map((r) => <Badge key={r} variant="outline" className="text-[9px]">{r}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
