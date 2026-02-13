"use client";

import { Badge } from "@/components/ui/badge";
import type { WorkloadResource, PortStatus } from "@/types";
import { AlertTriangle, Globe, Lock } from "lucide-react";

const SENSITIVE_PORTS = new Set([22, 23, 3306, 5432, 6379, 27017, 9200, 2379, 2380, 10250, 10255]);

interface PortAnalysisProps {
  workload: WorkloadResource;
}

export function PortAnalysis({ workload }: PortAnalysisProps) {
  const allPorts: Array<{ containerName: string; port: number; protocol: string; hostPort?: number; name?: string }> = [];

  for (const c of workload.containers) {
    for (const p of c.ports) {
      allPorts.push({ containerName: c.name, port: p.containerPort, protocol: p.protocol, hostPort: p.hostPort, name: p.name });
    }
  }

  if (allPorts.length === 0 && (!workload.ports || workload.ports.length === 0)) {
    return <p className="text-xs text-muted-foreground">No ports declared or detected.</p>;
  }

  return (
    <div className="space-y-2">
      {allPorts.map((p, i) => {
        const isSensitive = SENSITIVE_PORTS.has(p.port);
        const svcInfo = workload.ports?.find((ps) => ps.containerPort === p.port && ps.containerName === p.containerName);
        return (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg border text-xs">
            <div className="flex items-center gap-2">
              {isSensitive ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /> : <Lock className="h-3.5 w-3.5 text-green-500" />}
              <span className="font-medium">{p.port}/{p.protocol}</span>
              {p.name && <span className="text-muted-foreground">({p.name})</span>}
              <Badge variant="outline" className="text-[9px]">{p.containerName}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {p.hostPort && (
                <Badge variant="destructive" className="text-[9px] gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> hostPort:{p.hostPort}
                </Badge>
              )}
              {svcInfo?.serviceName && (
                <Badge variant="secondary" className="text-[9px] gap-1">
                  <Globe className="h-2.5 w-2.5" /> {svcInfo.serviceName}:{svcInfo.servicePort}
                </Badge>
              )}
              {isSensitive && <Badge variant="outline" className="text-[9px] text-yellow-600">sensitive</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
