import * as k8s from "@kubernetes/client-node";
import { getRbacApi } from "./client";
import { apiCache } from "./cache";
import type { RBACRole, RBACBinding, RBACData, PolicyRule } from "@/types";

function mapPolicyRules(rules?: k8s.V1PolicyRule[]): PolicyRule[] {
  if (!rules) return [];
  return rules.map((r) => ({
    verbs: r.verbs || [],
    apiGroups: r.apiGroups || [],
    resources: r.resources || [],
    resourceNames: r.resourceNames,
    nonResourceURLs: r.nonResourceURLs,
  }));
}

export async function getRoles(namespace?: string): Promise<RBACRole[]> {
  const cacheKey = `roles:${namespace || "all"}`;
  const cached = apiCache.get<RBACRole[]>(cacheKey);
  if (cached) return cached;

  const api = getRbacApi();
  let items: k8s.V1Role[];
  if (namespace) {
    const res = await api.listNamespacedRole({ namespace });
    items = res.items;
  } else {
    const res = await api.listRoleForAllNamespaces();
    items = res.items;
  }

  const roles: RBACRole[] = items.map((r) => ({
    name: r.metadata?.name || "",
    namespace: r.metadata?.namespace,
    kind: "Role",
    rules: mapPolicyRules(r.rules),
    labels: r.metadata?.labels as Record<string, string> | undefined,
    annotations: r.metadata?.annotations as Record<string, string> | undefined,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString(),
  }));

  apiCache.set(cacheKey, roles);
  return roles;
}

export async function getClusterRoles(): Promise<RBACRole[]> {
  const cacheKey = "clusterRoles";
  const cached = apiCache.get<RBACRole[]>(cacheKey);
  if (cached) return cached;

  const api = getRbacApi();
  const res = await api.listClusterRole();
  const roles: RBACRole[] = res.items.map((r) => ({
    name: r.metadata?.name || "",
    kind: "ClusterRole",
    rules: mapPolicyRules(r.rules),
    labels: r.metadata?.labels as Record<string, string> | undefined,
    annotations: r.metadata?.annotations as Record<string, string> | undefined,
    creationTimestamp: r.metadata?.creationTimestamp?.toISOString(),
  }));

  apiCache.set(cacheKey, roles);
  return roles;
}

export async function getRoleBindings(namespace?: string): Promise<RBACBinding[]> {
  const cacheKey = `roleBindings:${namespace || "all"}`;
  const cached = apiCache.get<RBACBinding[]>(cacheKey);
  if (cached) return cached;

  const api = getRbacApi();
  let items: k8s.V1RoleBinding[];
  if (namespace) {
    const res = await api.listNamespacedRoleBinding({ namespace });
    items = res.items;
  } else {
    const res = await api.listRoleBindingForAllNamespaces();
    items = res.items;
  }

  const bindings: RBACBinding[] = items.map((b) => ({
    name: b.metadata?.name || "",
    namespace: b.metadata?.namespace,
    kind: "RoleBinding",
    roleRef: {
      kind: b.roleRef.kind,
      name: b.roleRef.name,
      apiGroup: b.roleRef.apiGroup,
    },
    subjects: (b.subjects || []).map((s) => ({
      kind: s.kind as "User" | "Group" | "ServiceAccount",
      name: s.name,
      namespace: s.namespace,
      apiGroup: s.apiGroup,
    })),
    creationTimestamp: b.metadata?.creationTimestamp?.toISOString(),
  }));

  apiCache.set(cacheKey, bindings);
  return bindings;
}

export async function getClusterRoleBindings(): Promise<RBACBinding[]> {
  const cacheKey = "clusterRoleBindings";
  const cached = apiCache.get<RBACBinding[]>(cacheKey);
  if (cached) return cached;

  const api = getRbacApi();
  const res = await api.listClusterRoleBinding();
  const bindings: RBACBinding[] = res.items.map((b) => ({
    name: b.metadata?.name || "",
    kind: "ClusterRoleBinding",
    roleRef: {
      kind: b.roleRef.kind,
      name: b.roleRef.name,
      apiGroup: b.roleRef.apiGroup,
    },
    subjects: (b.subjects || []).map((s) => ({
      kind: s.kind as "User" | "Group" | "ServiceAccount",
      name: s.name,
      namespace: s.namespace,
      apiGroup: s.apiGroup,
    })),
    creationTimestamp: b.metadata?.creationTimestamp?.toISOString(),
  }));

  apiCache.set(cacheKey, bindings);
  return bindings;
}

export async function getAllRBACData(namespace?: string): Promise<RBACData> {
  const [roles, clusterRoles, roleBindings, allClusterRoleBindings] = await Promise.all([
    getRoles(namespace),
    getClusterRoles(),
    getRoleBindings(namespace),
    getClusterRoleBindings(),
  ]);

  // Filter ClusterRoleBindings when a namespace is selected:
  // Keep only CRBs that reference ServiceAccounts in the selected namespace,
  // or that reference Users/Groups (which are cluster-wide identities).
  let clusterRoleBindings = allClusterRoleBindings;
  if (namespace) {
    clusterRoleBindings = allClusterRoleBindings.filter((crb) =>
      crb.subjects.some(
        (s) =>
          (s.kind === "ServiceAccount" && s.namespace === namespace) ||
          s.kind === "User" ||
          s.kind === "Group"
      )
    );
  }

  return { roles, clusterRoles, roleBindings, clusterRoleBindings };
}

// --- Write Operations ---

function toPolicyRules(rules: PolicyRule[]): k8s.V1PolicyRule[] {
  return rules.map((r) => ({
    verbs: r.verbs,
    apiGroups: r.apiGroups,
    resources: r.resources,
    resourceNames: r.resourceNames,
    nonResourceURLs: r.nonResourceURLs,
  }));
}

export async function createRole(input: { name: string; namespace: string; rules: PolicyRule[]; labels?: Record<string, string> }) {
  const api = getRbacApi();
  const body: k8s.V1Role = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name: input.name, namespace: input.namespace, labels: input.labels },
    rules: toPolicyRules(input.rules),
  };
  await api.createNamespacedRole({ namespace: input.namespace, body });
  apiCache.invalidatePrefix("roles:");
}

export async function updateRole(name: string, namespace: string, rules: PolicyRule[]) {
  const api = getRbacApi();
  const body: k8s.V1Role = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name, namespace },
    rules: toPolicyRules(rules),
  };
  await api.replaceNamespacedRole({ name, namespace, body });
  apiCache.invalidatePrefix("roles:");
}

export async function deleteRole(name: string, namespace: string) {
  const api = getRbacApi();
  await api.deleteNamespacedRole({ name, namespace });
  apiCache.invalidatePrefix("roles:");
}

export async function createClusterRole(input: { name: string; rules: PolicyRule[]; labels?: Record<string, string> }) {
  const api = getRbacApi();
  const body: k8s.V1ClusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name: input.name, labels: input.labels },
    rules: toPolicyRules(input.rules),
  };
  await api.createClusterRole({ body });
  apiCache.invalidate("clusterRoles");
}

export async function updateClusterRole(name: string, rules: PolicyRule[]) {
  const api = getRbacApi();
  const body: k8s.V1ClusterRole = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules: toPolicyRules(rules),
  };
  await api.replaceClusterRole({ name, body });
  apiCache.invalidate("clusterRoles");
}

export async function deleteClusterRole(name: string) {
  const api = getRbacApi();
  await api.deleteClusterRole({ name });
  apiCache.invalidate("clusterRoles");
}

function toSubjects(subjects: Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }>): Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }> {
  return subjects.map((s) => ({
    kind: s.kind,
    name: s.name,
    namespace: s.namespace,
    apiGroup: s.apiGroup || (s.kind === "ServiceAccount" ? "" : "rbac.authorization.k8s.io"),
  }));
}

export async function createRoleBinding(input: { name: string; namespace: string; roleRef: { kind: string; name: string; apiGroup: string }; subjects: Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }> }) {
  const api = getRbacApi();
  const body: k8s.V1RoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: { name: input.name, namespace: input.namespace },
    roleRef: { kind: input.roleRef.kind, name: input.roleRef.name, apiGroup: input.roleRef.apiGroup },
    subjects: toSubjects(input.subjects),
  };
  await api.createNamespacedRoleBinding({ namespace: input.namespace, body });
  apiCache.invalidatePrefix("roleBindings:");
}

export async function updateRoleBinding(name: string, namespace: string, subjects: Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }>, roleRef: { kind: string; name: string; apiGroup: string }) {
  const api = getRbacApi();
  const body: k8s.V1RoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: { name, namespace },
    roleRef: { kind: roleRef.kind, name: roleRef.name, apiGroup: roleRef.apiGroup },
    subjects: toSubjects(subjects),
  };
  await api.replaceNamespacedRoleBinding({ name, namespace, body });
  apiCache.invalidatePrefix("roleBindings:");
}

export async function deleteRoleBinding(name: string, namespace: string) {
  const api = getRbacApi();
  await api.deleteNamespacedRoleBinding({ name, namespace });
  apiCache.invalidatePrefix("roleBindings:");
}

export async function createClusterRoleBinding(input: { name: string; roleRef: { kind: string; name: string; apiGroup: string }; subjects: Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }> }) {
  const api = getRbacApi();
  const body: k8s.V1ClusterRoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: { name: input.name },
    roleRef: { kind: input.roleRef.kind, name: input.roleRef.name, apiGroup: input.roleRef.apiGroup },
    subjects: toSubjects(input.subjects),
  };
  await api.createClusterRoleBinding({ body });
  apiCache.invalidate("clusterRoleBindings");
}

export async function updateClusterRoleBinding(name: string, subjects: Array<{ kind: string; name: string; namespace?: string; apiGroup?: string }>, roleRef: { kind: string; name: string; apiGroup: string }) {
  const api = getRbacApi();
  const body: k8s.V1ClusterRoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: { name },
    roleRef: { kind: roleRef.kind, name: roleRef.name, apiGroup: roleRef.apiGroup },
    subjects: toSubjects(subjects),
  };
  await api.replaceClusterRoleBinding({ name, body });
  apiCache.invalidate("clusterRoleBindings");
}

export async function deleteClusterRoleBinding(name: string) {
  const api = getRbacApi();
  await api.deleteClusterRoleBinding({ name });
  apiCache.invalidate("clusterRoleBindings");
}
