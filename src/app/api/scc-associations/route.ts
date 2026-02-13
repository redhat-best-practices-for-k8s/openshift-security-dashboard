import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig, getCoreApi } from "@/lib/k8s/client";
import { getFullSCCAssociations } from "@/lib/k8s/scc-rbac";
import type { SCCAssociationData } from "@/lib/k8s/scc-rbac";
import { apiCache } from "@/lib/k8s/cache";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;

  try {
    // We need to discover all SAs so we can resolve associations for each
    const coreApi = getCoreApi();

    const cacheKey = `sa-keys:${namespace || "all"}`;
    let saKeys = apiCache.get<Array<{ name: string; namespace: string }>>(cacheKey);

    if (!saKeys) {
      const saRes = namespace
        ? await coreApi.listNamespacedServiceAccount({ namespace })
        : await coreApi.listServiceAccountForAllNamespaces();

      saKeys = saRes.items.map((sa) => ({
        name: sa.metadata?.name || "",
        namespace: sa.metadata?.namespace || "",
      }));
      apiCache.set(cacheKey, saKeys, 20000);
    }

    const result: SCCAssociationData = await getFullSCCAssociations(saKeys);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch SCC associations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
