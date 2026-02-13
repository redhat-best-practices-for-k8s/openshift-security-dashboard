import * as k8s from "@kubernetes/client-node";
import { getCoreApi, getAppsApi, getBatchApi } from "./client";
import { apiCache } from "./cache";
import type { WorkloadResource, ContainerSecurityInfo, PodSecurityPosture, ContainerSecurityContext, ContainerPort, WorkloadKind } from "@/types";

function mapSecurityContext(sc?: k8s.V1SecurityContext): ContainerSecurityContext | undefined {
  if (!sc) return undefined;
  return {
    runAsUser: sc.runAsUser,
    runAsGroup: sc.runAsGroup,
    runAsNonRoot: sc.runAsNonRoot,
    readOnlyRootFilesystem: sc.readOnlyRootFilesystem,
    allowPrivilegeEscalation: sc.allowPrivilegeEscalation,
    privileged: sc.privileged,
    capabilities: sc.capabilities ? {
      add: sc.capabilities.add,
      drop: sc.capabilities.drop,
    } : undefined,
    seccompProfile: sc.seccompProfile ? {
      type: sc.seccompProfile.type,
      localhostProfile: sc.seccompProfile.localhostProfile,
    } : undefined,
  };
}

function mapContainers(containers?: k8s.V1Container[]): ContainerSecurityInfo[] {
  if (!containers) return [];
  return containers.map((c) => ({
    name: c.name,
    image: c.image || "",
    securityContext: mapSecurityContext(c.securityContext),
    ports: (c.ports || []).map((p) => ({
      name: p.name,
      containerPort: p.containerPort,
      protocol: p.protocol || "TCP",
      hostPort: p.hostPort,
    })),
    resources: c.resources ? {
      requests: c.resources.requests as Record<string, string> | undefined,
      limits: c.resources.limits as Record<string, string> | undefined,
    } : undefined,
    command: c.command,
    volumeMounts: c.volumeMounts?.map((vm) => ({
      name: vm.name,
      mountPath: vm.mountPath,
      readOnly: vm.readOnly,
    })),
  }));
}

function mapPodSecurityPosture(spec?: k8s.V1PodSpec): PodSecurityPosture {
  if (!spec) {
    return {
      hostNetwork: false,
      hostPID: false,
      hostIPC: false,
      serviceAccountName: "default",
      automountServiceAccountToken: true,
      volumes: [],
    };
  }
  return {
    hostNetwork: spec.hostNetwork || false,
    hostPID: spec.hostPID || false,
    hostIPC: spec.hostIPC || false,
    serviceAccountName: spec.serviceAccountName || "default",
    automountServiceAccountToken: spec.automountServiceAccountToken !== false,
    securityContext: spec.securityContext ? {
      runAsUser: spec.securityContext.runAsUser,
      runAsGroup: spec.securityContext.runAsGroup,
      runAsNonRoot: spec.securityContext.runAsNonRoot,
      seccompProfile: spec.securityContext.seccompProfile ? {
        type: spec.securityContext.seccompProfile.type,
        localhostProfile: spec.securityContext.seccompProfile.localhostProfile,
      } : undefined,
    } : undefined,
    volumes: (spec.volumes || []).map((v) => {
      const type = v.secret ? "secret" : v.configMap ? "configMap" : v.emptyDir ? "emptyDir" :
        v.hostPath ? "hostPath" : v.persistentVolumeClaim ? "pvc" : v.projected ? "projected" :
        v.downwardAPI ? "downwardAPI" : "other";
      return { name: v.name, type };
    }),
    nodeSelector: spec.nodeSelector as Record<string, string> | undefined,
    nodeName: spec.nodeName,
  };
}

function podToWorkload(pod: k8s.V1Pod): WorkloadResource {
  return {
    kind: "Pod",
    name: pod.metadata?.name || "",
    namespace: pod.metadata?.namespace || "",
    containers: mapContainers(pod.spec?.containers),
    initContainers: mapContainers(pod.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(pod.spec),
    labels: pod.metadata?.labels as Record<string, string> | undefined,
    annotations: pod.metadata?.annotations as Record<string, string> | undefined,
    creationTimestamp: pod.metadata?.creationTimestamp?.toISOString(),
    status: pod.status?.phase,
    podNames: [pod.metadata?.name || ""],
    appliedSCC: pod.metadata?.annotations?.["openshift.io/scc"],
  };
}

function deploymentToWorkload(dep: k8s.V1Deployment): WorkloadResource {
  return {
    kind: "Deployment",
    name: dep.metadata?.name || "",
    namespace: dep.metadata?.namespace || "",
    replicas: dep.spec?.replicas,
    readyReplicas: dep.status?.readyReplicas,
    containers: mapContainers(dep.spec?.template.spec?.containers),
    initContainers: mapContainers(dep.spec?.template.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(dep.spec?.template.spec),
    labels: dep.metadata?.labels as Record<string, string> | undefined,
    annotations: dep.metadata?.annotations as Record<string, string> | undefined,
    creationTimestamp: dep.metadata?.creationTimestamp?.toISOString(),
    status: dep.status?.readyReplicas === dep.spec?.replicas ? "Ready" : "Not Ready",
  };
}

function statefulSetToWorkload(sts: k8s.V1StatefulSet): WorkloadResource {
  return {
    kind: "StatefulSet",
    name: sts.metadata?.name || "",
    namespace: sts.metadata?.namespace || "",
    replicas: sts.spec?.replicas,
    readyReplicas: sts.status?.readyReplicas,
    containers: mapContainers(sts.spec?.template.spec?.containers),
    initContainers: mapContainers(sts.spec?.template.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(sts.spec?.template.spec),
    labels: sts.metadata?.labels as Record<string, string> | undefined,
    creationTimestamp: sts.metadata?.creationTimestamp?.toISOString(),
    status: sts.status?.readyReplicas === sts.spec?.replicas ? "Ready" : "Not Ready",
  };
}

function daemonSetToWorkload(ds: k8s.V1DaemonSet): WorkloadResource {
  return {
    kind: "DaemonSet",
    name: ds.metadata?.name || "",
    namespace: ds.metadata?.namespace || "",
    replicas: ds.status?.desiredNumberScheduled,
    readyReplicas: ds.status?.numberReady,
    containers: mapContainers(ds.spec?.template.spec?.containers),
    initContainers: mapContainers(ds.spec?.template.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(ds.spec?.template.spec),
    labels: ds.metadata?.labels as Record<string, string> | undefined,
    creationTimestamp: ds.metadata?.creationTimestamp?.toISOString(),
    status: ds.status?.numberReady === ds.status?.desiredNumberScheduled ? "Ready" : "Not Ready",
  };
}

function jobToWorkload(job: k8s.V1Job): WorkloadResource {
  return {
    kind: "Job",
    name: job.metadata?.name || "",
    namespace: job.metadata?.namespace || "",
    containers: mapContainers(job.spec?.template.spec?.containers),
    initContainers: mapContainers(job.spec?.template.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(job.spec?.template.spec),
    labels: job.metadata?.labels as Record<string, string> | undefined,
    creationTimestamp: job.metadata?.creationTimestamp?.toISOString(),
    status: job.status?.succeeded ? "Complete" : job.status?.active ? "Running" : "Pending",
  };
}

function cronJobToWorkload(cj: k8s.V1CronJob): WorkloadResource {
  return {
    kind: "CronJob",
    name: cj.metadata?.name || "",
    namespace: cj.metadata?.namespace || "",
    containers: mapContainers(cj.spec?.jobTemplate.spec?.template.spec?.containers),
    initContainers: mapContainers(cj.spec?.jobTemplate.spec?.template.spec?.initContainers),
    podSecurityPosture: mapPodSecurityPosture(cj.spec?.jobTemplate.spec?.template.spec),
    labels: cj.metadata?.labels as Record<string, string> | undefined,
    creationTimestamp: cj.metadata?.creationTimestamp?.toISOString(),
    status: cj.status?.active && cj.status.active.length > 0 ? "Active" : "Idle",
  };
}

export async function getWorkloads(namespace?: string): Promise<WorkloadResource[]> {
  const cacheKey = `workloads:${namespace || "all"}`;
  const cached = apiCache.get<WorkloadResource[]>(cacheKey);
  if (cached) return cached;

  const coreApi = getCoreApi();
  const appsApi = getAppsApi();
  const batchApi = getBatchApi();

  const [pods, deployments, statefulSets, daemonSets, jobs, cronJobs] = await Promise.all([
    namespace ? coreApi.listNamespacedPod({ namespace }) : coreApi.listPodForAllNamespaces(),
    namespace ? appsApi.listNamespacedDeployment({ namespace }) : appsApi.listDeploymentForAllNamespaces(),
    namespace ? appsApi.listNamespacedStatefulSet({ namespace }) : appsApi.listStatefulSetForAllNamespaces(),
    namespace ? appsApi.listNamespacedDaemonSet({ namespace }) : appsApi.listDaemonSetForAllNamespaces(),
    namespace ? batchApi.listNamespacedJob({ namespace }) : batchApi.listJobForAllNamespaces(),
    namespace ? batchApi.listNamespacedCronJob({ namespace }) : batchApi.listCronJobForAllNamespaces(),
  ]);

  // Build a map of owner (kind/namespace/name) -> applied SCC from pod annotations
  // This lets us enrich controller workloads with the SCC their pods actually use
  const ownerSCCMap = new Map<string, string>();
  for (const pod of pods.items) {
    const scc = pod.metadata?.annotations?.["openshift.io/scc"];
    if (!scc) continue;
    const ns = pod.metadata?.namespace || "";
    for (const owner of pod.metadata?.ownerReferences || []) {
      // For ReplicaSets, map to their Deployment owner name by stripping the hash suffix
      if (owner.kind === "ReplicaSet") {
        // ReplicaSet name format: <deployment-name>-<hash>
        const parts = owner.name.split("-");
        if (parts.length > 1) {
          const depName = parts.slice(0, -1).join("-");
          ownerSCCMap.set(`Deployment/${ns}/${depName}`, scc);
        }
      }
      ownerSCCMap.set(`${owner.kind}/${ns}/${owner.name}`, scc);
    }
  }

  const workloads: WorkloadResource[] = [
    ...deployments.items.map((d) => {
      const w = deploymentToWorkload(d);
      w.appliedSCC = ownerSCCMap.get(`Deployment/${w.namespace}/${w.name}`);
      return w;
    }),
    ...statefulSets.items.map((s) => {
      const w = statefulSetToWorkload(s);
      w.appliedSCC = ownerSCCMap.get(`StatefulSet/${w.namespace}/${w.name}`);
      return w;
    }),
    ...daemonSets.items.map((d) => {
      const w = daemonSetToWorkload(d);
      w.appliedSCC = ownerSCCMap.get(`DaemonSet/${w.namespace}/${w.name}`);
      return w;
    }),
    ...jobs.items.map((j) => {
      const w = jobToWorkload(j);
      w.appliedSCC = ownerSCCMap.get(`Job/${w.namespace}/${w.name}`);
      return w;
    }),
    ...cronJobs.items.map((c) => {
      const w = cronJobToWorkload(c);
      // CronJobs own Jobs which own Pods -- check via Job owner chain
      w.appliedSCC = ownerSCCMap.get(`CronJob/${w.namespace}/${w.name}`);
      return w;
    }),
    ...pods.items.filter((p) => {
      // Only include standalone pods (not managed by a controller)
      const owners = p.metadata?.ownerReferences;
      return !owners || owners.length === 0;
    }).map(podToWorkload),
  ];

  apiCache.set(cacheKey, workloads, 15000); // 15s TTL for workloads
  return workloads;
}

export async function getWorkloadDetail(kind: string, name: string, namespace: string): Promise<WorkloadResource | null> {
  const coreApi = getCoreApi();
  const appsApi = getAppsApi();
  const batchApi = getBatchApi();

  try {
    switch (kind.toLowerCase()) {
      case "pod": {
        const pod = await coreApi.readNamespacedPod({ name, namespace });
        return podToWorkload(pod);
      }
      case "deployment": {
        const dep = await appsApi.readNamespacedDeployment({ name, namespace });
        return deploymentToWorkload(dep);
      }
      case "statefulset": {
        const sts = await appsApi.readNamespacedStatefulSet({ name, namespace });
        return statefulSetToWorkload(sts);
      }
      case "daemonset": {
        const ds = await appsApi.readNamespacedDaemonSet({ name, namespace });
        return daemonSetToWorkload(ds);
      }
      case "job": {
        const job = await batchApi.readNamespacedJob({ name, namespace });
        return jobToWorkload(job);
      }
      case "cronjob": {
        const cj = await batchApi.readNamespacedCronJob({ name, namespace });
        return cronJobToWorkload(cj);
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Helper: apply security context patches to a pod template spec in-place
function applySecurityPatch(
  podSpec: k8s.V1PodSpec,
  patch: { podSecurityContext?: Record<string, unknown>; containerPatches?: Array<{ name: string; securityContext: Record<string, unknown> }> }
): void {
  if (patch.podSecurityContext) {
    podSpec.securityContext = {
      ...podSpec.securityContext,
      ...patch.podSecurityContext,
    } as k8s.V1PodSecurityContext;
  }
  if (patch.containerPatches) {
    for (const cp of patch.containerPatches) {
      const container = podSpec.containers?.find((c) => c.name === cp.name);
      if (container) {
        container.securityContext = {
          ...container.securityContext,
          ...cp.securityContext,
        } as k8s.V1SecurityContext;
      }
    }
  }
}

export async function patchWorkloadSecurityContext(
  kind: string,
  name: string,
  namespace: string,
  patch: { podSecurityContext?: Record<string, unknown>; containerPatches?: Array<{ name: string; securityContext: Record<string, unknown> }> }
): Promise<void> {
  const appsApi = getAppsApi();
  const batchApi = getBatchApi();

  // Read-then-replace approach: avoids content-type issues with patch methods
  switch (kind.toLowerCase()) {
    case "deployment": {
      const dep = await appsApi.readNamespacedDeployment({ name, namespace });
      applySecurityPatch(dep.spec!.template.spec!, patch);
      await appsApi.replaceNamespacedDeployment({ name, namespace, body: dep });
      break;
    }
    case "statefulset": {
      const sts = await appsApi.readNamespacedStatefulSet({ name, namespace });
      applySecurityPatch(sts.spec!.template.spec!, patch);
      await appsApi.replaceNamespacedStatefulSet({ name, namespace, body: sts });
      break;
    }
    case "daemonset": {
      const ds = await appsApi.readNamespacedDaemonSet({ name, namespace });
      applySecurityPatch(ds.spec!.template.spec!, patch);
      await appsApi.replaceNamespacedDaemonSet({ name, namespace, body: ds });
      break;
    }
    case "job": {
      const job = await batchApi.readNamespacedJob({ name, namespace });
      applySecurityPatch(job.spec!.template.spec!, patch);
      await batchApi.replaceNamespacedJob({ name, namespace, body: job });
      break;
    }
    case "cronjob": {
      const cj = await batchApi.readNamespacedCronJob({ name, namespace });
      applySecurityPatch(cj.spec!.jobTemplate.spec!.template.spec!, patch);
      await batchApi.replaceNamespacedCronJob({ name, namespace, body: cj });
      break;
    }
    default:
      throw new Error(`Cannot patch security context on ${kind}. Pods are immutable -- update the parent workload instead.`);
  }

  apiCache.invalidatePrefix("workloads:");
}
