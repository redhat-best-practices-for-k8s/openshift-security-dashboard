import { getNetworkingApi } from "./client";
import { apiCache } from "./cache";
import type { CreateNetworkPolicyInput, NetworkPolicyData } from "@/types";

export async function getNetworkPolicies(namespace?: string): Promise<NetworkPolicyData[]> {
  const cacheKey = `networkPolicies:${namespace || "all"}`;
  const cached = apiCache.get<NetworkPolicyData[]>(cacheKey);
  if (cached) return cached;

  const api = getNetworkingApi();
  let items;
  if (namespace) {
    const res = await api.listNamespacedNetworkPolicy({ namespace });
    items = res.items;
  } else {
    const res = await api.listNetworkPolicyForAllNamespaces();
    items = res.items;
  }

  const policies: NetworkPolicyData[] = items.map((p) => ({
    name: p.metadata?.name || "",
    namespace: p.metadata?.namespace || "",
    podSelector: (p.spec?.podSelector?.matchLabels || {}) as Record<string, string>,
    policyTypes: p.spec?.policyTypes || [],
    ingress: (p.spec?.ingress || []).map((rule) => ({
      from: rule._from?.map((peer) => ({
        podSelector: peer.podSelector?.matchLabels as Record<string, string> | undefined,
        namespaceSelector: peer.namespaceSelector?.matchLabels as Record<string, string> | undefined,
        ipBlock: peer.ipBlock ? { cidr: peer.ipBlock.cidr, except: peer.ipBlock.except } : undefined,
      })),
      ports: rule.ports?.map((port) => ({
        port: port.port || 0,
        protocol: port.protocol || "TCP",
      })),
    })),
    egress: (p.spec?.egress || []).map((rule) => ({
      to: rule.to?.map((peer) => ({
        podSelector: peer.podSelector?.matchLabels as Record<string, string> | undefined,
        namespaceSelector: peer.namespaceSelector?.matchLabels as Record<string, string> | undefined,
        ipBlock: peer.ipBlock ? { cidr: peer.ipBlock.cidr, except: peer.ipBlock.except } : undefined,
      })),
      ports: rule.ports?.map((port) => ({
        port: port.port || 0,
        protocol: port.protocol || "TCP",
      })),
    })),
    creationTimestamp: p.metadata?.creationTimestamp?.toISOString(),
  }));

  apiCache.set(cacheKey, policies);
  return policies;
}

// --- Write Operations ---

export async function createNetworkPolicy(input: CreateNetworkPolicyInput) {
  const api = getNetworkingApi();
  const body = {
    apiVersion: "networking.k8s.io/v1",
    kind: "NetworkPolicy",
    metadata: { name: input.name, namespace: input.namespace },
    spec: {
      podSelector: { matchLabels: input.podSelector },
      policyTypes: input.policyTypes,
      ingress: input.ingress.map((rule) => ({
        from: rule.from?.map((peer) => ({
          podSelector: peer.podSelector ? { matchLabels: peer.podSelector } : undefined,
          namespaceSelector: peer.namespaceSelector ? { matchLabels: peer.namespaceSelector } : undefined,
          ipBlock: peer.ipBlock,
        })),
        ports: rule.ports,
      })),
      egress: input.egress.map((rule) => ({
        to: rule.to?.map((peer) => ({
          podSelector: peer.podSelector ? { matchLabels: peer.podSelector } : undefined,
          namespaceSelector: peer.namespaceSelector ? { matchLabels: peer.namespaceSelector } : undefined,
          ipBlock: peer.ipBlock,
        })),
        ports: rule.ports,
      })),
    },
  };
  await api.createNamespacedNetworkPolicy({ namespace: input.namespace, body });
  apiCache.invalidatePrefix("networkPolicies:");
}

export async function updateNetworkPolicy(
  name: string,
  namespace: string,
  spec: { podSelector: Record<string, string>; policyTypes: string[]; ingress: Array<{ from?: Array<{ podSelector?: Record<string, string>; namespaceSelector?: Record<string, string>; ipBlock?: { cidr: string; except?: string[] } }>; ports?: Array<{ port: number | string; protocol: string }> }>; egress: Array<{ to?: Array<{ podSelector?: Record<string, string>; namespaceSelector?: Record<string, string>; ipBlock?: { cidr: string; except?: string[] } }>; ports?: Array<{ port: number | string; protocol: string }> }> }
) {
  const api = getNetworkingApi();
  const current = await api.readNamespacedNetworkPolicy({ name, namespace });
  current.spec = {
    podSelector: { matchLabels: spec.podSelector },
    policyTypes: spec.policyTypes,
    ingress: spec.ingress.map((rule) => ({
      _from: rule.from?.map((peer) => ({
        podSelector: peer.podSelector ? { matchLabels: peer.podSelector } : undefined,
        namespaceSelector: peer.namespaceSelector ? { matchLabels: peer.namespaceSelector } : undefined,
        ipBlock: peer.ipBlock,
      })),
      ports: rule.ports?.map((p) => ({ port: p.port, protocol: p.protocol })),
    })),
    egress: spec.egress.map((rule) => ({
      to: rule.to?.map((peer) => ({
        podSelector: peer.podSelector ? { matchLabels: peer.podSelector } : undefined,
        namespaceSelector: peer.namespaceSelector ? { matchLabels: peer.namespaceSelector } : undefined,
        ipBlock: peer.ipBlock,
      })),
      ports: rule.ports?.map((p) => ({ port: p.port, protocol: p.protocol })),
    })),
  } as never;
  await api.replaceNamespacedNetworkPolicy({ name, namespace, body: current });
  apiCache.invalidatePrefix("networkPolicies:");
}

export async function deleteNetworkPolicy(name: string, namespace: string) {
  const api = getNetworkingApi();
  await api.deleteNamespacedNetworkPolicy({ name, namespace });
  apiCache.invalidatePrefix("networkPolicies:");
}
