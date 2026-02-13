"use client";

import { useClusterStore } from "@/store/cluster-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Server, Layers } from "lucide-react";

export function Header() {
  const {
    kubeconfigLoaded,
    currentContext,
    availableContexts,
    selectedNamespace,
    availableNamespaces,
    setSelectedNamespace,
  } = useClusterStore();

  const handleContextSwitch = async (context: string) => {
    try {
      const res = await fetch("/api/kubeconfig", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const data = await res.json();
      if (data.namespaces) {
        useClusterStore.getState().setCurrentContext(context);
        useClusterStore.getState().setAvailableNamespaces(data.namespaces);
        useClusterStore.getState().setSelectedNamespace("");
      }
    } catch (error) {
      console.error("Failed to switch context:", error);
    }
  };

  if (!kubeconfigLoaded) return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <Select value={currentContext} onValueChange={handleContextSwitch}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select context" />
            </SelectTrigger>
            <SelectContent>
              {availableContexts.map((ctx) => (
                <SelectItem key={ctx.name} value={ctx.name} className="text-xs">
                  {ctx.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedNamespace || "__all__"} onValueChange={(v) => setSelectedNamespace(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="All namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All namespaces</SelectItem>
              {availableNamespaces.map((ns) => (
                <SelectItem key={ns} value={ns} className="text-xs">
                  {ns}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Badge variant="outline" className="text-xs">
          Connected
        </Badge>
      </div>
    </header>
  );
}
