import { getCustomObjectsApi } from "./client";
import { apiCache } from "./cache";
import type { SecurityContextConstraint } from "@/types";

export async function getSCCs(): Promise<SecurityContextConstraint[]> {
  const cacheKey = "sccs";
  const cached = apiCache.get<SecurityContextConstraint[]>(cacheKey);
  if (cached) return cached;

  const api = getCustomObjectsApi();
  try {
    const res = await api.listClusterCustomObject({
      group: "security.openshift.io",
      version: "v1",
      plural: "securitycontextconstraints",
    });
    const body = res as { items?: Record<string, unknown>[] };
    const items = body.items || [];

    const sccs: SecurityContextConstraint[] = items.map((item: Record<string, unknown>) => {
      const metadata = (item.metadata || {}) as Record<string, unknown>;
      return {
        name: (metadata.name as string) || "",
        priority: (item.priority as number) ?? null,
        allowPrivilegedContainer: (item.allowPrivilegedContainer as boolean) || false,
        allowPrivilegeEscalation: item.allowPrivilegeEscalation !== false,
        allowHostDirVolumePlugin: (item.allowHostDirVolumePlugin as boolean) || false,
        allowHostIPC: (item.allowHostIPC as boolean) || false,
        allowHostNetwork: (item.allowHostNetwork as boolean) || false,
        allowHostPID: (item.allowHostPID as boolean) || false,
        allowHostPorts: (item.allowHostPorts as boolean) || false,
        allowedCapabilities: (item.allowedCapabilities as string[]) || [],
        defaultAddCapabilities: (item.defaultAddCapabilities as string[]) || [],
        requiredDropCapabilities: (item.requiredDropCapabilities as string[]) || [],
        readOnlyRootFilesystem: (item.readOnlyRootFilesystem as boolean) || false,
        runAsUser: (item.runAsUser as SecurityContextConstraint["runAsUser"]) || { type: "RunAsAny" },
        seLinuxContext: (item.seLinuxContext as SecurityContextConstraint["seLinuxContext"]) || { type: "RunAsAny" },
        fsGroup: (item.fsGroup as SecurityContextConstraint["fsGroup"]) || { type: "RunAsAny" },
        supplementalGroups: (item.supplementalGroups as SecurityContextConstraint["supplementalGroups"]) || { type: "RunAsAny" },
        volumes: (item.volumes as string[]) || [],
        users: (item.users as string[]) || [],
        groups: (item.groups as string[]) || [],
        labels: metadata.labels as Record<string, string> | undefined,
        annotations: metadata.annotations as Record<string, string> | undefined,
        creationTimestamp: metadata.creationTimestamp as string | undefined,
      };
    });

    apiCache.set(cacheKey, sccs);
    return sccs;
  } catch {
    // Not an OpenShift cluster, return empty
    return [];
  }
}

// --- Write Operations ---

export async function createSCC(scc: Partial<SecurityContextConstraint> & { name: string }) {
  const api = getCustomObjectsApi();
  const body = {
    apiVersion: "security.openshift.io/v1",
    kind: "SecurityContextConstraints",
    metadata: { name: scc.name },
    allowPrivilegedContainer: scc.allowPrivilegedContainer || false,
    allowPrivilegeEscalation: scc.allowPrivilegeEscalation ?? true,
    allowHostDirVolumePlugin: scc.allowHostDirVolumePlugin || false,
    allowHostIPC: scc.allowHostIPC || false,
    allowHostNetwork: scc.allowHostNetwork || false,
    allowHostPID: scc.allowHostPID || false,
    allowHostPorts: scc.allowHostPorts || false,
    allowedCapabilities: scc.allowedCapabilities || [],
    defaultAddCapabilities: scc.defaultAddCapabilities || [],
    requiredDropCapabilities: scc.requiredDropCapabilities || [],
    readOnlyRootFilesystem: scc.readOnlyRootFilesystem || false,
    runAsUser: scc.runAsUser || { type: "MustRunAsRange" },
    seLinuxContext: scc.seLinuxContext || { type: "MustRunAs" },
    fsGroup: scc.fsGroup || { type: "MustRunAs" },
    supplementalGroups: scc.supplementalGroups || { type: "RunAsAny" },
    volumes: scc.volumes || ["configMap", "downwardAPI", "emptyDir", "persistentVolumeClaim", "projected", "secret"],
    priority: scc.priority ?? null,
    users: scc.users || [],
    groups: scc.groups || [],
  };
  await api.createClusterCustomObject({
    group: "security.openshift.io",
    version: "v1",
    plural: "securitycontextconstraints",
    body,
  });
  apiCache.invalidate("sccs");
}

export async function updateSCC(name: string, scc: Partial<SecurityContextConstraint>) {
  const api = getCustomObjectsApi();
  // Fetch current first
  const current = await api.getClusterCustomObject({
    group: "security.openshift.io",
    version: "v1",
    plural: "securitycontextconstraints",
    name,
  });
  const body = { ...(current as Record<string, unknown>), ...scc, metadata: { ...((current as Record<string, unknown>).metadata as Record<string, unknown>), name } };
  await api.replaceClusterCustomObject({
    group: "security.openshift.io",
    version: "v1",
    plural: "securitycontextconstraints",
    name,
    body,
  });
  apiCache.invalidate("sccs");
}

export async function deleteSCC(name: string) {
  const api = getCustomObjectsApi();
  await api.deleteClusterCustomObject({
    group: "security.openshift.io",
    version: "v1",
    plural: "securitycontextconstraints",
    name,
  });
  apiCache.invalidate("sccs");
}
