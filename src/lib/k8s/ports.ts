import { getCoreApi } from "./client";
import { apiCache } from "./cache";
import type { PortStatus } from "@/types";

export async function getPortAnalysis(namespace?: string): Promise<Record<string, PortStatus[]>> {
  const cacheKey = `portAnalysis:${namespace || "all"}`;
  const cached = apiCache.get<Record<string, PortStatus[]>>(cacheKey);
  if (cached) return cached;

  const coreApi = getCoreApi();

  const [podsRes, servicesRes] = await Promise.all([
    namespace ? coreApi.listNamespacedPod({ namespace }) : coreApi.listPodForAllNamespaces(),
    namespace ? coreApi.listNamespacedService({ namespace }) : coreApi.listServiceForAllNamespaces(),
  ]);

  // Build a map of services -> target ports
  const servicePortMap = new Map<string, Array<{ serviceName: string; servicePort: number; targetPort: number | string; protocol: string }>>();
  for (const svc of servicesRes.items) {
    const svcNs = svc.metadata?.namespace || "";
    const svcName = svc.metadata?.name || "";
    const selector = svc.spec?.selector;
    if (!selector) continue;

    const selectorKey = `${svcNs}:${Object.entries(selector).sort().map(([k, v]) => `${k}=${v}`).join(",")}`;
    const ports = svc.spec?.ports || [];
    const entries = ports.map((p) => ({
      serviceName: `${svcNs}/${svcName}`,
      servicePort: p.port,
      targetPort: p.targetPort || p.port,
      protocol: p.protocol || "TCP",
    }));

    const existing = servicePortMap.get(selectorKey) || [];
    servicePortMap.set(selectorKey, [...existing, ...entries]);
  }

  const result: Record<string, PortStatus[]> = {};

  for (const pod of podsRes.items) {
    const podName = pod.metadata?.name || "";
    const podNs = pod.metadata?.namespace || "";
    const podKey = `${podNs}/${podName}`;
    const podLabels = pod.metadata?.labels || {};
    const statuses: PortStatus[] = [];

    // Find services matching this pod
    const matchingServices: Array<{ serviceName: string; servicePort: number; targetPort: number | string; protocol: string }> = [];
    for (const [selectorKey, svcPorts] of servicePortMap.entries()) {
      const [selectorNs, selectorLabelsStr] = selectorKey.split(":");
      if (selectorNs !== podNs) continue;
      const selectorLabels = Object.fromEntries(
        selectorLabelsStr.split(",").filter(Boolean).map((pair) => pair.split("="))
      );
      const matches = Object.entries(selectorLabels).every(([k, v]) => podLabels[k] === v);
      if (matches) matchingServices.push(...svcPorts);
    }

    // Declared ports from spec
    for (const container of pod.spec?.containers || []) {
      for (const port of container.ports || []) {
        const svcMatch = matchingServices.find(
          (s) => s.targetPort === port.containerPort || s.targetPort === port.name
        );
        statuses.push({
          containerName: container.name,
          containerPort: port.containerPort,
          protocol: port.protocol || "TCP",
          declared: true,
          hostPort: port.hostPort,
          serviceName: svcMatch?.serviceName,
          servicePort: svcMatch?.servicePort,
        });
      }
    }

    if (statuses.length > 0 || matchingServices.length > 0) {
      result[podKey] = statuses;
    }
  }

  apiCache.set(cacheKey, result, 15000);
  return result;
}
