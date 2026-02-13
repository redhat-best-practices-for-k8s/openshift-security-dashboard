import * as k8s from "@kubernetes/client-node";

// Store kubeconfig on globalThis so it persists across Turbopack/Next.js
// hot-module reloads (module-level `let` gets reset when the module is re-evaluated).
interface KubeGlobal {
  __kubeConfig?: k8s.KubeConfig | null;
  __kubeconfigRaw?: string | null;
}
const g = globalThis as unknown as KubeGlobal;

export function loadKubeConfig(configContent: string): k8s.KubeConfig {
  const kc = new k8s.KubeConfig();
  kc.loadFromString(configContent);
  g.__kubeConfig = kc;
  g.__kubeconfigRaw = configContent;
  return kc;
}

export function getKubeConfig(): k8s.KubeConfig | null {
  return g.__kubeConfig ?? null;
}

export function getRawKubeConfig(): string | null {
  return g.__kubeconfigRaw ?? null;
}

export function setContext(contextName: string): void {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  kc.setCurrentContext(contextName);
}

export function getCoreApi(): k8s.CoreV1Api {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.CoreV1Api);
}

export function getRbacApi(): k8s.RbacAuthorizationV1Api {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.RbacAuthorizationV1Api);
}

export function getCustomObjectsApi(): k8s.CustomObjectsApi {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.CustomObjectsApi);
}

export function getNetworkingApi(): k8s.NetworkingV1Api {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.NetworkingV1Api);
}

export function getVersionApi(): k8s.VersionApi {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.VersionApi);
}

export function isLoaded(): boolean {
  return getKubeConfig() !== null;
}

export function getContexts() {
  const kc = getKubeConfig();
  if (!kc) return [];
  return kc.getContexts().map((ctx) => ({
    name: ctx.name,
    cluster: ctx.cluster,
    user: ctx.user,
    namespace: ctx.namespace,
  }));
}

export function getCurrentContext(): string {
  const kc = getKubeConfig();
  if (!kc) return "";
  return kc.getCurrentContext();
}

export function getAppsApi(): k8s.AppsV1Api {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.AppsV1Api);
}

export function getBatchApi(): k8s.BatchV1Api {
  const kc = getKubeConfig();
  if (!kc) throw new Error("KubeConfig not loaded");
  return kc.makeApiClient(k8s.BatchV1Api);
}
