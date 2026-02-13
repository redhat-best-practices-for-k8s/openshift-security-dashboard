import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig, getCoreApi } from "@/lib/k8s/client";
import { apiCache } from "@/lib/k8s/cache";

export interface ClusterLabels {
  /** All unique label key=value pairs found on pods, grouped by key */
  podLabels: Record<string, string[]>;
  /** All unique label key=value pairs found on namespaces, grouped by key */
  namespaceLabels: Record<string, string[]>;
}

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;
  const cacheKey = `labels:${namespace || "all"}`;
  const cached = apiCache.get<ClusterLabels>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const coreApi = getCoreApi();

    const [podsRes, nsRes] = await Promise.all([
      namespace
        ? coreApi.listNamespacedPod({ namespace })
        : coreApi.listPodForAllNamespaces(),
      coreApi.listNamespace(),
    ]);

    // Collect pod labels
    const podLabels: Record<string, Set<string>> = {};
    for (const pod of podsRes.items) {
      const labels = pod.metadata?.labels;
      if (!labels) continue;
      for (const [key, value] of Object.entries(labels)) {
        if (!podLabels[key]) podLabels[key] = new Set();
        podLabels[key].add(value as string);
      }
    }

    // Collect namespace labels
    const namespaceLabels: Record<string, Set<string>> = {};
    for (const ns of nsRes.items) {
      const labels = ns.metadata?.labels;
      if (!labels) continue;
      for (const [key, value] of Object.entries(labels)) {
        if (!namespaceLabels[key]) namespaceLabels[key] = new Set();
        namespaceLabels[key].add(value as string);
      }
    }

    // Convert Sets to sorted arrays
    const result: ClusterLabels = {
      podLabels: Object.fromEntries(
        Object.entries(podLabels)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, Array.from(v).sort()])
      ),
      namespaceLabels: Object.fromEntries(
        Object.entries(namespaceLabels)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, Array.from(v).sort()])
      ),
    };

    apiCache.set(cacheKey, result, 20000); // 20s TTL
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch labels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
