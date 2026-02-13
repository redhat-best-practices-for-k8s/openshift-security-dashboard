import { NextResponse } from "next/server";
import { getKubeConfig, getCoreApi, getCustomObjectsApi } from "@/lib/k8s/client";
import { apiCache } from "@/lib/k8s/cache";
import type { ClusterInfo } from "@/types";

export async function GET() {
  const kc = getKubeConfig();
  if (!kc) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const cacheKey = "clusterInfo";
  const cached = apiCache.get<ClusterInfo>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const coreApi = getCoreApi();
    
    const [nodesRes, nsRes] = await Promise.all([
      coreApi.listNode().catch(() => ({ items: [] })),
      coreApi.listNamespace(),
    ]);

    // Try to detect OpenShift
    let platform = "Kubernetes";
    let openshiftVersion: string | undefined;
    try {
      const customApi = getCustomObjectsApi();
      const cv = await customApi.getClusterCustomObject({
        group: "config.openshift.io",
        version: "v1",
        plural: "clusterversions",
        name: "version",
      });
      const body = cv as Record<string, unknown>;
      const status = (body.status || {}) as Record<string, unknown>;
      const desired = (status.desired || {}) as Record<string, unknown>;
      openshiftVersion = desired.version as string;
      platform = "OpenShift";
    } catch {
      // Not OpenShift
    }

    const currentCtx = kc.getCurrentContext();
    const ctx = kc.getContextObject(currentCtx);
    const cluster = ctx ? kc.getCluster(ctx.cluster) : null;

    const info: ClusterInfo = {
      name: currentCtx,
      server: cluster?.server || "Unknown",
      version: openshiftVersion || "Unknown",
      platform,
      openshiftVersion,
      nodeCount: nodesRes.items.length,
      namespaceCount: nsRes.items.length,
    };

    apiCache.set(cacheKey, info, 60000);
    return NextResponse.json(info);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch cluster info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
