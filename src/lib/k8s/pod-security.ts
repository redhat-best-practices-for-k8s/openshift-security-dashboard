import { getCoreApi } from "./client";
import { apiCache } from "./cache";
import type { NamespacePodSecurity } from "@/types";

const PSA_LABEL_PREFIX = "pod-security.kubernetes.io/";

export async function getNamespacePodSecurity(): Promise<NamespacePodSecurity[]> {
  const cacheKey = "namespacePodSecurity";
  const cached = apiCache.get<NamespacePodSecurity[]>(cacheKey);
  if (cached) return cached;

  const api = getCoreApi();
  const res = await api.listNamespace();
  
  const results: NamespacePodSecurity[] = res.items.map((ns) => {
    const labels = ns.metadata?.labels || {};
    return {
      namespace: ns.metadata?.name || "",
      enforce: labels[`${PSA_LABEL_PREFIX}enforce`],
      enforceVersion: labels[`${PSA_LABEL_PREFIX}enforce-version`],
      audit: labels[`${PSA_LABEL_PREFIX}audit`],
      auditVersion: labels[`${PSA_LABEL_PREFIX}audit-version`],
      warn: labels[`${PSA_LABEL_PREFIX}warn`],
      warnVersion: labels[`${PSA_LABEL_PREFIX}warn-version`],
    };
  });

  apiCache.set(cacheKey, results);
  return results;
}

// --- Write Operations ---

export async function updateNamespacePSALabels(namespace: string, labels: { enforce?: string; audit?: string; warn?: string }) {
  const api = getCoreApi();
  const patchBody: Record<string, string | null> = {};
  if (labels.enforce !== undefined) patchBody[`${PSA_LABEL_PREFIX}enforce`] = labels.enforce || null;
  if (labels.audit !== undefined) patchBody[`${PSA_LABEL_PREFIX}audit`] = labels.audit || null;
  if (labels.warn !== undefined) patchBody[`${PSA_LABEL_PREFIX}warn`] = labels.warn || null;

  await api.patchNamespace({ name: namespace, body: { metadata: { labels: patchBody } } });
  apiCache.invalidate("namespacePodSecurity");
}
