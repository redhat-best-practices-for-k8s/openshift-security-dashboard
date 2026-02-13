import type { RBACData, RBACBinding, CrossNamespaceAccess } from "@/types";

export function analyzeCrossNamespaceAccess(data: RBACData): CrossNamespaceAccess[] {
  const results: CrossNamespaceAccess[] = [];

  // Find the rules granted by each role reference
  const roleRulesMap = new Map<string, { verbs: string[]; resources: string[] }>();
  for (const role of [...data.roles, ...data.clusterRoles]) {
    const key = `${role.kind}:${role.name}`;
    const verbs = new Set<string>();
    const resources = new Set<string>();
    for (const rule of role.rules) {
      rule.verbs.forEach((v) => verbs.add(v));
      rule.resources.forEach((r) => resources.add(r));
    }
    roleRulesMap.set(key, { verbs: Array.from(verbs), resources: Array.from(resources) });
  }

  function processBinding(binding: RBACBinding) {
    const bindingNs = binding.namespace || "(cluster)";

    for (const subject of binding.subjects) {
      // Cross-namespace: subject's namespace differs from binding's namespace
      const subjectNs = subject.namespace || "(cluster)";

      if (binding.kind === "RoleBinding" && subject.kind === "ServiceAccount" && subject.namespace && subject.namespace !== binding.namespace) {
        const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
        const granted = roleRulesMap.get(roleKey);

        results.push({
          sourceNamespace: subjectNs,
          sourceSubject: { kind: subject.kind, name: subject.name },
          targetNamespace: bindingNs,
          bindingName: binding.name,
          bindingKind: binding.kind,
          roleRef: { kind: binding.roleRef.kind, name: binding.roleRef.name },
          grantedVerbs: granted?.verbs || [],
          grantedResources: granted?.resources || [],
        });
      }

      // ClusterRoleBindings that give SAs broad access
      if (binding.kind === "ClusterRoleBinding" && subject.kind === "ServiceAccount" && subject.namespace) {
        const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
        const granted = roleRulesMap.get(roleKey);

        results.push({
          sourceNamespace: subjectNs,
          sourceSubject: { kind: subject.kind, name: subject.name },
          targetNamespace: "(all namespaces)",
          bindingName: binding.name,
          bindingKind: binding.kind,
          roleRef: { kind: binding.roleRef.kind, name: binding.roleRef.name },
          grantedVerbs: granted?.verbs || [],
          grantedResources: granted?.resources || [],
        });
      }
    }
  }

  for (const rb of data.roleBindings) processBinding(rb);
  for (const crb of data.clusterRoleBindings) processBinding(crb);

  return results;
}
