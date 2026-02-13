import { getRbacApi } from "./client";
import { apiCache } from "./cache";
import { getSCCs } from "./scc";
import type { SecurityContextConstraint } from "@/types";

// --- Types for unified SCC associations ---

export interface SCCGrantSource {
  scc: string;
  via: "user" | "group" | "rbac";
  detail: string;
}

export interface SCCAssociationData {
  /** Map of "ns/saName" -> sorted SCC name list */
  associations: Record<string, string[]>;
  /** Map of "ns/saName" -> grant source details for each SCC */
  grantSources: Record<string, SCCGrantSource[]>;
}

/**
 * Build a map of SA/group identity -> set of SCC names granted through RBAC.
 * In OpenShift 4.x, SCCs can be granted via Roles/ClusterRoles that have
 * verb "use" on resource "securitycontextconstraints" (API group "security.openshift.io").
 */
export async function buildRBACSCCMap(): Promise<Map<string, Set<string>>> {
  const cacheKey = "rbac-scc-map";
  const cached = apiCache.get<Map<string, Set<string>>>(cacheKey);
  if (cached) return cached;

  const rbacApi = getRbacApi();

  const [clusterRolesRes, clusterRoleBindingsRes, roleBindingsRes, rolesRes] = await Promise.all([
    rbacApi.listClusterRole(),
    rbacApi.listClusterRoleBinding(),
    rbacApi.listRoleBindingForAllNamespaces(),
    rbacApi.listRoleForAllNamespaces(),
  ]);

  // Helper: check if a policy rule grants "use" on SCCs
  const extractSCCNames = (rules: Array<{ apiGroups?: string[]; resources?: string[]; verbs?: string[]; resourceNames?: string[] }>): Set<string> | null => {
    const sccNames = new Set<string>();
    for (const rule of rules) {
      const apiGroups = rule.apiGroups || [];
      const resources = rule.resources || [];
      const verbs = rule.verbs || [];
      if (
        (apiGroups.includes("security.openshift.io") || apiGroups.includes("*")) &&
        (resources.includes("securitycontextconstraints") || resources.includes("*")) &&
        (verbs.includes("use") || verbs.includes("*"))
      ) {
        const names = rule.resourceNames || [];
        if (names.length === 0) {
          sccNames.add("*");
        } else {
          for (const name of names) sccNames.add(name);
        }
      }
    }
    return sccNames.size > 0 ? sccNames : null;
  };

  // Step 1a: Find ClusterRoles that grant "use" on SCCs
  // Key: "ClusterRole/<name>"
  const roleToSCCs = new Map<string, Set<string>>();
  for (const cr of clusterRolesRes.items) {
    const roleName = cr.metadata?.name || "";
    if (!cr.rules) continue;
    const sccNames = extractSCCNames(cr.rules);
    if (sccNames) roleToSCCs.set(`ClusterRole/${roleName}`, sccNames);
  }

  // Step 1b: Find namespace-scoped Roles that grant "use" on SCCs
  // Key: "Role/<namespace>/<name>"
  for (const role of rolesRes.items) {
    const roleName = role.metadata?.name || "";
    const roleNs = role.metadata?.namespace || "";
    if (!role.rules) continue;
    const sccNames = extractSCCNames(role.rules);
    if (sccNames) roleToSCCs.set(`Role/${roleNs}/${roleName}`, sccNames);
  }

  // Step 2: Resolve bindings to SAs and groups
  const saToSCCs = new Map<string, Set<string>>();

  const addSCCsForSubject = (kind: string, name: string, namespace: string | undefined, sccNames: Set<string>) => {
    if (kind === "ServiceAccount" && namespace) {
      const key = `${namespace}/${name}`;
      if (!saToSCCs.has(key)) saToSCCs.set(key, new Set());
      for (const scc of sccNames) saToSCCs.get(key)!.add(scc);
    }
    if (kind === "Group") {
      const groupKey = `group:${name}`;
      if (!saToSCCs.has(groupKey)) saToSCCs.set(groupKey, new Set());
      for (const scc of sccNames) saToSCCs.get(groupKey)!.add(scc);
    }
  };

  // 2a: ClusterRoleBindings -> ClusterRoles
  for (const crb of clusterRoleBindingsRes.items) {
    const roleName = crb.roleRef?.name || "";
    const sccNames = roleToSCCs.get(`ClusterRole/${roleName}`);
    if (!sccNames) continue;
    for (const subject of crb.subjects || []) {
      addSCCsForSubject(subject.kind, subject.name, subject.namespace, sccNames);
    }
  }

  // 2b: RoleBindings -> ClusterRoles OR namespace-scoped Roles
  for (const rb of roleBindingsRes.items) {
    const roleKind = rb.roleRef?.kind || "";
    const roleName = rb.roleRef?.name || "";
    const rbNs = rb.metadata?.namespace || "";

    let sccNames: Set<string> | undefined;
    if (roleKind === "ClusterRole") {
      sccNames = roleToSCCs.get(`ClusterRole/${roleName}`);
    } else if (roleKind === "Role") {
      sccNames = roleToSCCs.get(`Role/${rbNs}/${roleName}`);
    }
    if (!sccNames) continue;

    for (const subject of rb.subjects || []) {
      const subjectNs = subject.namespace || rbNs;
      addSCCsForSubject(subject.kind, subject.name, subjectNs, sccNames);
    }
  }

  apiCache.set(cacheKey, saToSCCs, 30000);
  return saToSCCs;
}

export function resolveRBACSCCs(
  rbacMap: Map<string, Set<string>>,
  saName: string,
  saNamespace: string,
  allSCCNames: string[],
): string[] {
  const result = new Set<string>();

  const expand = (sccs: Set<string>) => {
    for (const scc of sccs) {
      if (scc === "*") { allSCCNames.forEach((n) => result.add(n)); }
      else result.add(scc);
    }
  };

  // Direct SA match
  const direct = rbacMap.get(`${saNamespace}/${saName}`);
  if (direct) expand(direct);

  // Group: system:serviceaccounts (all SAs everywhere)
  const allSAs = rbacMap.get("group:system:serviceaccounts");
  if (allSAs) expand(allSAs);

  // Group: system:serviceaccounts:<ns>
  const nsSAs = rbacMap.get(`group:system:serviceaccounts:${saNamespace}`);
  if (nsSAs) expand(nsSAs);

  // Group: system:authenticated
  const authSAs = rbacMap.get("group:system:authenticated");
  if (authSAs) expand(authSAs);

  return Array.from(result);
}

// --- Resolve RBAC SCCs with source tracking ---

function resolveRBACSCCsWithSources(
  rbacMap: Map<string, Set<string>>,
  saName: string,
  saNamespace: string,
  allSCCNames: string[],
): SCCGrantSource[] {
  const sources: SCCGrantSource[] = [];
  const seen = new Set<string>();

  const expandWithSource = (sccs: Set<string>, via: "rbac", detail: string) => {
    for (const scc of sccs) {
      if (scc === "*") {
        for (const n of allSCCNames) {
          if (!seen.has(n)) { seen.add(n); sources.push({ scc: n, via, detail: `${detail} (wildcard)` }); }
        }
      } else if (!seen.has(scc)) {
        seen.add(scc);
        sources.push({ scc, via, detail });
      }
    }
  };

  const direct = rbacMap.get(`${saNamespace}/${saName}`);
  if (direct) expandWithSource(direct, "rbac", `RBAC binding for SA ${saNamespace}/${saName}`);

  const allSAs = rbacMap.get("group:system:serviceaccounts");
  if (allSAs) expandWithSource(allSAs, "rbac", "RBAC via group system:serviceaccounts");

  const nsSAs = rbacMap.get(`group:system:serviceaccounts:${saNamespace}`);
  if (nsSAs) expandWithSource(nsSAs, "rbac", `RBAC via group system:serviceaccounts:${saNamespace}`);

  const authSAs = rbacMap.get("group:system:authenticated");
  if (authSAs) expandWithSource(authSAs, "rbac", "RBAC via group system:authenticated");

  return sources;
}

// --- Direct matching with source tracking ---

function matchSCCsWithSources(
  sccs: SecurityContextConstraint[],
  saName: string,
  saNamespace: string,
): SCCGrantSource[] {
  const sources: SCCGrantSource[] = [];
  const saUserString = `system:serviceaccount:${saNamespace}:${saName}`;

  for (const scc of sccs) {
    // Direct user match
    if (scc.users.includes(saUserString)) {
      sources.push({ scc: scc.name, via: "user", detail: `SCC users field: ${saUserString}` });
      continue;
    }
    // Group-level matches
    if (scc.groups.includes("system:authenticated")) {
      sources.push({ scc: scc.name, via: "group", detail: "SCC groups field: system:authenticated" });
    } else if (scc.groups.includes("system:serviceaccounts")) {
      sources.push({ scc: scc.name, via: "group", detail: "SCC groups field: system:serviceaccounts" });
    } else if (scc.groups.includes(`system:serviceaccounts:${saNamespace}`)) {
      sources.push({ scc: scc.name, via: "group", detail: `SCC groups field: system:serviceaccounts:${saNamespace}` });
    }
  }
  return sources;
}

/**
 * Unified SCC association resolver.
 * Combines direct (users/groups), and RBAC grants with source tracking.
 * Takes a list of SA keys ("ns/name") to resolve, or resolves for all SAs if none given.
 */
export async function getFullSCCAssociations(
  saKeys: Array<{ name: string; namespace: string }>,
): Promise<SCCAssociationData> {
  const cacheKey = `scc-associations:${saKeys.length > 100 ? "all" : saKeys.map((s) => `${s.namespace}/${s.name}`).join(",")}`;
  const cached = apiCache.get<SCCAssociationData>(cacheKey);
  if (cached) return cached;

  // Fetch SCCs and RBAC map in parallel
  const [sccs, rbacMap] = await Promise.all([
    getSCCs().catch((): SecurityContextConstraint[] => []),
    buildRBACSCCMap().catch(() => new Map<string, Set<string>>()),
  ]);

  const allSCCNames = sccs.map((s) => s.name);
  const associations: Record<string, string[]> = {};
  const grantSources: Record<string, SCCGrantSource[]> = {};

  for (const { name, namespace } of saKeys) {
    const key = `${namespace}/${name}`;

    // Direct + group matches from SCC objects
    const directSources = sccs.length > 0
      ? matchSCCsWithSources(sccs, name, namespace)
      : [];

    // RBAC matches
    const rbacSources = rbacMap.size > 0
      ? resolveRBACSCCsWithSources(rbacMap, name, namespace, allSCCNames)
      : [];

    // Merge and deduplicate (direct/group wins over RBAC for display)
    const allSources: SCCGrantSource[] = [];
    const seen = new Set<string>();
    for (const s of [...directSources, ...rbacSources]) {
      if (!seen.has(s.scc)) {
        seen.add(s.scc);
        allSources.push(s);
      }
    }

    associations[key] = allSources.map((s) => s.scc).sort();
    grantSources[key] = allSources;
  }

  const result: SCCAssociationData = { associations, grantSources };
  apiCache.set(cacheKey, result, 30000);
  return result;
}
