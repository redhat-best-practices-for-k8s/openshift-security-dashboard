import { getCoreApi, getRbacApi } from "./client";
import { apiCache } from "./cache";
import { getSCCs } from "./scc";
import type { ServiceAccountInfo, SecurityContextConstraint } from "@/types";

/**
 * Match SCCs to a service account by checking the SCC users and groups fields.
 * Exported so the API route can also call it to enrich cached SA data.
 */
export function matchSCCsToServiceAccount(
  sccs: SecurityContextConstraint[],
  saName: string,
  saNamespace: string,
): string[] {
  const matched: string[] = [];
  const saUserString = `system:serviceaccount:${saNamespace}:${saName}`;
  for (const scc of sccs) {
    // Direct user match
    if (scc.users.includes(saUserString)) {
      matched.push(scc.name);
      continue;
    }
    // Group-level matches
    const saGroups = [
      "system:authenticated",
      "system:serviceaccounts",
      `system:serviceaccounts:${saNamespace}`,
    ];
    if (scc.groups.some((g) => saGroups.includes(g))) {
      matched.push(scc.name);
    }
  }
  return matched;
}

export async function getServiceAccounts(namespace?: string): Promise<ServiceAccountInfo[]> {
  const cacheKey = `serviceAccounts:${namespace || "all"}`;
  const cached = apiCache.get<ServiceAccountInfo[]>(cacheKey);
  if (cached) return cached;

  const coreApi = getCoreApi();
  const rbacApi = getRbacApi();

  // Fetch SAs
  let saItems;
  if (namespace) {
    const res = await coreApi.listNamespacedServiceAccount({ namespace });
    saItems = res.items;
  } else {
    const res = await coreApi.listServiceAccountForAllNamespaces();
    saItems = res.items;
  }

  // Fetch bindings for enrichment
  const [roleBindingsRes, clusterRoleBindingsRes] = await Promise.all([
    namespace
      ? rbacApi.listNamespacedRoleBinding({ namespace })
      : rbacApi.listRoleBindingForAllNamespaces(),
    rbacApi.listClusterRoleBinding(),
  ]);

  const roleBindings = roleBindingsRes.items;
  const clusterRoleBindings = clusterRoleBindingsRes.items;

  const results: ServiceAccountInfo[] = saItems.map((sa) => {
    const saName = sa.metadata?.name || "";
    const saNamespace = sa.metadata?.namespace || "";

    // Find roles bound to this SA
    const boundRoles: string[] = [];
    const boundClusterRoles: string[] = [];

    for (const rb of roleBindings) {
      if (rb.metadata?.namespace !== saNamespace) continue;
      const match = rb.subjects?.some(
        (s) => s.kind === "ServiceAccount" && s.name === saName && (s.namespace === saNamespace || !s.namespace)
      );
      if (match) {
        if (rb.roleRef.kind === "Role") boundRoles.push(rb.roleRef.name);
        else boundClusterRoles.push(rb.roleRef.name);
      }
    }

    for (const crb of clusterRoleBindings) {
      const match = crb.subjects?.some(
        (s) => s.kind === "ServiceAccount" && s.name === saName && s.namespace === saNamespace
      );
      if (match) {
        boundClusterRoles.push(crb.roleRef.name);
      }
    }

    return {
      name: saName,
      namespace: saNamespace,
      secrets: (sa.secrets || []).map((s) => s.name || ""),
      imagePullSecrets: (sa.imagePullSecrets || []).map((s) => s.name || ""),
      roles: boundRoles,
      clusterRoles: [...new Set(boundClusterRoles)],
      sccs: [], // Enriched at the API route level with fresh SCC data
      podCount: 0, // Will be enriched  
      creationTimestamp: sa.metadata?.creationTimestamp?.toISOString(),
    };
  });

  apiCache.set(cacheKey, results);
  return results;
}

// --- Write Operations ---

export async function createServiceAccount(name: string, namespace: string) {
  const coreApi = getCoreApi();
  await coreApi.createNamespacedServiceAccount({
    namespace,
    body: { apiVersion: "v1", kind: "ServiceAccount", metadata: { name, namespace } },
  });
  apiCache.invalidatePrefix("serviceAccounts:");
}

export async function deleteServiceAccount(name: string, namespace: string) {
  const coreApi = getCoreApi();
  await coreApi.deleteNamespacedServiceAccount({ name, namespace });
  apiCache.invalidatePrefix("serviceAccounts:");
}
