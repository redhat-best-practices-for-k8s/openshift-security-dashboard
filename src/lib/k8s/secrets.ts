import { getCoreApi } from "./client";
import { apiCache } from "./cache";
import type { SecretInfo } from "@/types";

export async function getSecrets(namespace?: string): Promise<SecretInfo[]> {
  const cacheKey = `secrets:${namespace || "all"}`;
  const cached = apiCache.get<SecretInfo[]>(cacheKey);
  if (cached) return cached;

  const api = getCoreApi();
  let items;
  if (namespace) {
    const res = await api.listNamespacedSecret({ namespace });
    items = res.items;
  } else {
    const res = await api.listSecretForAllNamespaces();
    items = res.items;
  }

  const secrets: SecretInfo[] = items.map((s) => ({
    name: s.metadata?.name || "",
    namespace: s.metadata?.namespace || "",
    type: s.type || "Opaque",
    keys: Object.keys(s.data || {}),
    creationTimestamp: s.metadata?.creationTimestamp?.toISOString(),
    labels: s.metadata?.labels as Record<string, string> | undefined,
    linkedServiceAccounts: [], // Enriched later
    linkedPods: [], // Enriched later
  }));

  apiCache.set(cacheKey, secrets);
  return secrets;
}

// --- Write Operations ---

export async function createSecret(input: { name: string; namespace: string; type: string; data: Record<string, string>; labels?: Record<string, string> }) {
  const api = getCoreApi();
  // Encode data values to base64
  const encodedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.data)) {
    encodedData[key] = Buffer.from(value).toString("base64");
  }
  await api.createNamespacedSecret({
    namespace: input.namespace,
    body: {
      apiVersion: "v1",
      kind: "Secret",
      metadata: { name: input.name, namespace: input.namespace, labels: input.labels },
      type: input.type,
      data: encodedData,
    },
  });
  apiCache.invalidatePrefix("secrets:");
}

export async function deleteSecret(name: string, namespace: string) {
  const api = getCoreApi();
  await api.deleteNamespacedSecret({ name, namespace });
  apiCache.invalidatePrefix("secrets:");
}
