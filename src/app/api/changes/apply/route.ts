import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { createRole, updateRole, deleteRole, createClusterRole, updateClusterRole, deleteClusterRole, createRoleBinding, updateRoleBinding, deleteRoleBinding, createClusterRoleBinding, updateClusterRoleBinding, deleteClusterRoleBinding } from "@/lib/k8s/rbac";
import { createSCC, updateSCC, deleteSCC } from "@/lib/k8s/scc";
import { createNetworkPolicy, updateNetworkPolicy, deleteNetworkPolicy } from "@/lib/k8s/network";
import { updateNamespacePSALabels } from "@/lib/k8s/pod-security";
import { createServiceAccount, deleteServiceAccount } from "@/lib/k8s/service-accounts";
import { createSecret, deleteSecret } from "@/lib/k8s/secrets";
import { patchWorkloadSecurityContext } from "@/lib/k8s/workloads";
import type { PendingChange } from "@/types";

async function applyChange(change: PendingChange): Promise<{ success: boolean; error?: string }> {
  try {
    const spec = (change.after || {}) as Record<string, unknown>;
    const kind = change.resourceKind;
    const name = change.resourceName;
    const ns = change.namespace || "";

    if (change.action === "create") {
      switch (kind) {
        case "Role":
          await createRole({ name, namespace: ns, rules: (spec.rules || []) as never[], labels: spec.labels as Record<string, string> | undefined });
          break;
        case "ClusterRole":
          await createClusterRole({ name, rules: (spec.rules || []) as never[], labels: spec.labels as Record<string, string> | undefined });
          break;
        case "RoleBinding":
          await createRoleBinding({ name, namespace: ns, roleRef: spec.roleRef as never, subjects: (spec.subjects || []) as never[] });
          break;
        case "ClusterRoleBinding":
          await createClusterRoleBinding({ name, roleRef: spec.roleRef as never, subjects: (spec.subjects || []) as never[] });
          break;
        case "SecurityContextConstraints":
        case "SCC":
          await createSCC({ name, ...spec } as never);
          break;
        case "NetworkPolicy":
          await createNetworkPolicy({ name, namespace: ns, podSelector: (spec.podSelector || {}) as Record<string, string>, policyTypes: (spec.policyTypes || []) as string[], ingress: (spec.ingress || []) as never[], egress: (spec.egress || []) as never[] });
          break;
        case "ServiceAccount":
          await createServiceAccount(name, ns);
          break;
        case "Secret":
          await createSecret({ name, namespace: ns, type: (spec.type as string) || "Opaque", data: (spec.data || {}) as Record<string, string>, labels: spec.labels as Record<string, string> | undefined });
          break;
        default:
          return { success: false, error: `Unsupported kind: ${kind}` };
      }
    } else if (change.action === "update") {
      switch (kind) {
        case "Role":
          await updateRole(name, ns, (spec.rules || []) as never[]);
          break;
        case "ClusterRole":
          await updateClusterRole(name, (spec.rules || []) as never[]);
          break;
        case "RoleBinding":
          await updateRoleBinding(name, ns, (spec.subjects || []) as never[], spec.roleRef as never);
          break;
        case "ClusterRoleBinding":
          await updateClusterRoleBinding(name, (spec.subjects || []) as never[], spec.roleRef as never);
          break;
        case "SecurityContextConstraints":
        case "SCC":
          await updateSCC(name, spec as never);
          break;
        case "NetworkPolicy":
          await updateNetworkPolicy(name, ns, spec as never);
          break;
        case "NamespacePSA":
          await updateNamespacePSALabels(name, spec as never);
          break;
        case "Deployment":
        case "StatefulSet":
        case "DaemonSet":
        case "Job":
        case "CronJob":
          await patchWorkloadSecurityContext(kind, name, ns, spec as never);
          break;
        default:
          return { success: false, error: `Unsupported kind for update: ${kind}` };
      }
    } else if (change.action === "delete") {
      switch (kind) {
        case "Role":
          await deleteRole(name, ns);
          break;
        case "ClusterRole":
          await deleteClusterRole(name);
          break;
        case "RoleBinding":
          await deleteRoleBinding(name, ns);
          break;
        case "ClusterRoleBinding":
          await deleteClusterRoleBinding(name);
          break;
        case "SecurityContextConstraints":
        case "SCC":
          await deleteSCC(name);
          break;
        case "NetworkPolicy":
          await deleteNetworkPolicy(name, ns);
          break;
        case "ServiceAccount":
          await deleteServiceAccount(name, ns);
          break;
        case "Secret":
          await deleteSecret(name, ns);
          break;
        default:
          return { success: false, error: `Unsupported kind for delete: ${kind}` };
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const { changes } = await request.json() as { changes: PendingChange[] };
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const change of changes) {
      const result = await applyChange(change);
      results.push({ id: change.id, ...result });
      if (!result.success) {
        // Stop on first error
        break;
      }
    }

    const allSuccess = results.every((r) => r.success);
    return NextResponse.json({ results, allSuccess }, { status: allSuccess ? 200 : 207 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to apply changes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
