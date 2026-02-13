"use client";

import { useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import type { TLSIPResult, TLSPortResult, TLSScanStatus } from "@/types";

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

interface NamespaceGroup {
  namespace: string;
  ips: TLSIPResult[];
  portCount: number;
  statusCounts: Record<string, number>;
}

interface TLSNamespaceViewProps {
  filteredIPs: TLSIPResult[];
  onSelectPort: (ip: TLSIPResult, port: TLSPortResult) => void;
}

export function TLSNamespaceView({ filteredIPs, onSelectPort }: TLSNamespaceViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups: NamespaceGroup[] = useMemo(() => {
    const map = new Map<string, TLSIPResult[]>();
    for (const ip of filteredIPs) {
      const ns = ip.pod?.Namespace || "(unknown)";
      const list = map.get(ns) || [];
      list.push(ip);
      map.set(ns, list);
    }

    return [...map.entries()]
      .map(([namespace, ips]) => {
        let portCount = 0;
        const statusCounts: Record<string, number> = {};
        for (const ip of ips) {
          for (const pr of ip.port_results || []) {
            portCount++;
            statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
          }
        }
        return { namespace, ips, portCount, statusCounts };
      })
      .sort((a, b) => a.namespace.localeCompare(b.namespace));
  }, [filteredIPs]);

  if (groups.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No results to display.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isOpen = expanded === group.namespace;
        return (
          <Collapsible
            key={group.namespace}
            open={isOpen}
            onOpenChange={() =>
              setExpanded(isOpen ? null : group.namespace)
            }
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="font-medium">{group.namespace}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {group.ips.length} pod{group.ips.length !== 1 ? "s" : ""} · {group.portCount} port{group.portCount !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {Object.entries(group.statusCounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <Badge
                          key={status}
                          variant="outline"
                          className={`text-[9px] ${statusColors[status as TLSScanStatus] || ""}`}
                        >
                          {status}: {count}
                        </Badge>
                      ))}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3 ml-6">
                    {group.ips.map((ip) => (
                      <div key={ip.ip} className="border rounded-md p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium">
                            {ip.pod?.Name || ip.ip}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {ip.ip}
                          </span>
                          {ip.openshift_component?.component && (
                            <Badge variant="outline" className="text-[9px]">
                              {ip.openshift_component.component}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {(ip.port_results || []).map((pr) => (
                            <div
                              key={pr.port}
                              className="flex items-center gap-2 text-xs hover:bg-muted/40 rounded px-2 py-1 cursor-pointer"
                              onClick={() => onSelectPort(ip, pr)}
                            >
                              <Badge
                                variant="outline"
                                className={`text-[9px] w-24 justify-center ${statusColors[pr.status] || ""}`}
                              >
                                {pr.status}
                              </Badge>
                              <span className="font-mono w-12">{pr.port}</span>
                              <span className="text-muted-foreground truncate">
                                {pr.service || "-"}
                              </span>
                              <span className="ml-auto flex gap-0.5">
                                {(pr.tls_versions || []).map((v) => (
                                  <Badge
                                    key={v}
                                    variant="outline"
                                    className={`text-[8px] font-mono ${
                                      v.includes("1.3")
                                        ? "bg-green-500/10"
                                        : v.includes("1.2")
                                          ? "bg-blue-500/10"
                                          : "bg-yellow-500/10"
                                    }`}
                                  >
                                    {v}
                                  </Badge>
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
