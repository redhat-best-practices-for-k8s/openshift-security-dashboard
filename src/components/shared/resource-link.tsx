"use client";

import { Badge } from "@/components/ui/badge";

export interface ResourceLinkProps {
  kind: string;
  name: string;
  namespace?: string;
  /** If true, show only the name without the kind badge */
  compact?: boolean;
}

export const kindToRoute: Record<string, string> = {
  Role: "/rbac",
  ClusterRole: "/rbac",
  RoleBinding: "/rbac",
  ClusterRoleBinding: "/rbac",
  ServiceAccount: "/service-accounts",
  Secret: "/secrets",
  NetworkPolicy: "/network",
  SecurityContextConstraints: "/scc",
  SCC: "/scc",
  Namespace: "/pod-security",
  Pod: "/workloads",
  Deployment: "/workloads",
  StatefulSet: "/workloads",
  DaemonSet: "/workloads",
  Job: "/workloads",
  CronJob: "/workloads",
};

export function dispatchNavigateToResource(kind: string, name: string, namespace?: string) {
  const event = new CustomEvent("navigate-to-resource", {
    detail: { kind, name, namespace },
  });
  window.dispatchEvent(event);
}

export function ResourceLink({ kind, name, namespace, compact }: ResourceLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchNavigateToResource(kind, name, namespace);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="inline text-xs font-medium text-primary hover:underline cursor-pointer"
        title={`View ${kind} "${name}"${namespace ? ` in ${namespace}` : ""}`}
      >
        {name}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 hover:underline cursor-pointer group"
      title={`View ${kind} "${name}"${namespace ? ` in ${namespace}` : ""}`}
    >
      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 group-hover:border-primary/50">
        {kind}
      </Badge>
      <span className="text-xs">
        {namespace && <span className="text-muted-foreground">{namespace}/</span>}
        <span className="font-medium">{name}</span>
      </span>
    </button>
  );
}

/**
 * Parse a resource string in the format "Kind/namespace/name" or "Kind/name"
 * as used in finding.resource fields.
 */
export function parseResourceString(resource: string): { kind: string; name: string; namespace?: string } | null {
  if (!resource) return null;
  const parts = resource.split("/");
  if (parts.length === 3) {
    return { kind: parts[0], name: parts[2], namespace: parts[1] };
  }
  if (parts.length === 2) {
    return { kind: parts[0], name: parts[1] };
  }
  return null;
}
