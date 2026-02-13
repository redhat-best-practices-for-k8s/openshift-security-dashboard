"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Box, Layers, Globe } from "lucide-react";
import type { ClusterInfo } from "@/types";

interface ClusterInfoBarProps {
  info: ClusterInfo | null;
  loading?: boolean;
}

export function ClusterInfoBar({ info, loading }: ClusterInfoBarProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-muted rounded h-6 w-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!info) return null;

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{info.name}</span>
            <Badge variant="secondary" className="text-[10px]">{info.platform}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            <span>{info.nodeCount} nodes</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>{info.namespaceCount} namespaces</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="h-3.5 w-3.5" />
            <span>v{info.version}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
