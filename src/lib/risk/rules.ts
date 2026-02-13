import type { RBACData, SecurityContextConstraint, NetworkPolicyData, NamespacePodSecurity, ServiceAccountInfo, SecretInfo, RiskFinding, RiskLevel, WorkloadResource } from "@/types";

export function analyzeRBACRisks(data: RBACData): RiskFinding[] {
  const findings: RiskFinding[] = [];

  // Check for wildcard roles
  const allRoles = [...data.roles, ...data.clusterRoles];
  for (const role of allRoles) {
    for (const rule of role.rules) {
      const nsKey = role.namespace ? `${role.namespace}/` : "";
      if (rule.verbs.includes("*") && rule.resources.includes("*")) {
        findings.push({
          id: `rbac-wildcard-${role.kind}-${nsKey}${role.name}`,
          level: "critical",
          domain: "rbac",
          title: `Wildcard permissions in ${role.kind} "${role.name}"`,
          description: `This ${role.kind} grants ALL verbs on ALL resources${role.namespace ? ` in namespace "${role.namespace}"` : " cluster-wide"}. This is equivalent to full admin access.`,
          resource: `${role.kind}/${role.name}`,
          namespace: role.namespace,
          recommendation: "Replace wildcard rules with specific resource and verb permissions following the principle of least privilege.",
        });
      } else if (rule.verbs.includes("*")) {
        findings.push({
          id: `rbac-verb-wildcard-${role.kind}-${nsKey}${role.name}-${rule.resources.join(",")}`,
          level: "high",
          domain: "rbac",
          title: `All verbs allowed on ${rule.resources.join(", ")} in ${role.kind} "${role.name}"`,
          description: `This ${role.kind} allows every possible action on ${rule.resources.join(", ")} resources.`,
          resource: `${role.kind}/${role.name}`,
          namespace: role.namespace,
          recommendation: "Restrict to only the verbs that are actually needed (e.g., get, list instead of *).",
        });
      }
      // Check for secrets access
      if (rule.resources.includes("secrets") && (rule.verbs.includes("*") || rule.verbs.includes("get") || rule.verbs.includes("list"))) {
        findings.push({
          id: `rbac-secrets-access-${role.kind}-${nsKey}${role.name}`,
          level: "high",
          domain: "rbac",
          title: `Secrets access in ${role.kind} "${role.name}"`,
          description: `This ${role.kind} allows reading secrets, which may contain sensitive credentials, tokens, and certificates.`,
          resource: `${role.kind}/${role.name}`,
          namespace: role.namespace,
          recommendation: "Limit secrets access to only the specific secrets needed. Consider using resourceNames to restrict to named secrets.",
        });
      }
    }
  }

  // Check for ClusterRoleBindings to powerful roles
  for (const crb of data.clusterRoleBindings) {
    if (crb.roleRef.name === "cluster-admin") {
      for (const subject of crb.subjects) {
        findings.push({
          id: `rbac-cluster-admin-${subject.kind}-${subject.name}`,
          level: "critical",
          domain: "rbac",
          title: `cluster-admin bound to ${subject.kind} "${subject.name}"`,
          description: `The ${subject.kind} "${subject.name}" has full cluster-admin privileges. This grants unrestricted access to every resource in every namespace.`,
          resource: `ClusterRoleBinding/${crb.name}`,
          recommendation: "Review whether cluster-admin access is truly necessary. Consider creating a more restrictive ClusterRole with only the required permissions.",
        });
      }
    }
  }

  return findings;
}

export function analyzeSCCRisks(sccs: SecurityContextConstraint[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const scc of sccs) {
    if (scc.allowPrivilegedContainer) {
      findings.push({
        id: `scc-privileged-${scc.name}`,
        level: "critical",
        domain: "scc",
        title: `SCC "${scc.name}" allows privileged containers`,
        description: "Privileged containers have full access to the host. This bypasses almost all security boundaries.",
        resource: `SCC/${scc.name}`,
        recommendation: "Use a more restrictive SCC. If privileged access is required, consider using specific capabilities instead.",
      });
    }

    if (scc.allowHostNetwork) {
      findings.push({
        id: `scc-host-network-${scc.name}`,
        level: "high",
        domain: "scc",
        title: `SCC "${scc.name}" allows host networking`,
        description: "Containers using host networking can see all network traffic on the node and bypass network policies.",
        resource: `SCC/${scc.name}`,
        recommendation: "Disable host networking unless absolutely required (e.g., for CNI plugins).",
      });
    }

    if (scc.runAsUser.type === "RunAsAny") {
      findings.push({
        id: `scc-runasany-${scc.name}`,
        level: "medium",
        domain: "scc",
        title: `SCC "${scc.name}" allows running as any user (including root)`,
        description: "Containers can run as root (UID 0), which increases the impact of container escape vulnerabilities.",
        resource: `SCC/${scc.name}`,
        recommendation: "Use MustRunAsRange or MustRunAsNonRoot to prevent containers from running as root.",
      });
    }

    if (scc.allowedCapabilities.includes("*") || scc.allowedCapabilities.includes("ALL")) {
      findings.push({
        id: `scc-all-caps-${scc.name}`,
        level: "critical",
        domain: "scc",
        title: `SCC "${scc.name}" allows all Linux capabilities`,
        description: "Allowing all capabilities is nearly equivalent to running as privileged.",
        resource: `SCC/${scc.name}`,
        recommendation: "Restrict to only the specific capabilities needed (e.g., NET_BIND_SERVICE).",
      });
    }
  }

  return findings;
}

export function analyzeNetworkRisks(
  policies: NetworkPolicyData[],
  namespaces: string[]
): RiskFinding[] {
  const findings: RiskFinding[] = [];

  // Check namespaces without any NetworkPolicy
  const namespacesWithPolicies = new Set(policies.map((p) => p.namespace));
  for (const ns of namespaces) {
    if (ns.startsWith("openshift-") || ns.startsWith("kube-")) continue;
    if (!namespacesWithPolicies.has(ns)) {
      findings.push({
        id: `netpol-missing-${ns}`,
        level: "medium",
        domain: "network",
        title: `No NetworkPolicy in namespace "${ns}"`,
        description: `Namespace "${ns}" has no network policies. All pods can receive traffic from any source and send traffic to any destination.`,
        resource: `Namespace/${ns}`,
        namespace: ns,
        recommendation: "Create at least a default-deny ingress policy and explicitly allow required traffic.",
      });
    }
  }

  return findings;
}

export function analyzePodSecurityRisks(nsps: NamespacePodSecurity[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const nsp of nsps) {
    if (nsp.namespace.startsWith("openshift-") || nsp.namespace.startsWith("kube-")) continue;
    
    if (nsp.enforce === "privileged") {
      findings.push({
        id: `psa-privileged-${nsp.namespace}`,
        level: "high",
        domain: "pod-security",
        title: `Namespace "${nsp.namespace}" enforces privileged pod security`,
        description: "This namespace allows unrestricted pod security, meaning any pod can run regardless of its security context.",
        resource: `Namespace/${nsp.namespace}`,
        namespace: nsp.namespace,
        recommendation: "Consider enforcing 'baseline' or 'restricted' and using 'audit'/'warn' to identify non-compliant pods.",
      });
    }

    if (!nsp.enforce && !nsp.audit && !nsp.warn) {
      findings.push({
        id: `psa-none-${nsp.namespace}`,
        level: "low",
        domain: "pod-security",
        title: `No Pod Security Admission labels on namespace "${nsp.namespace}"`,
        description: "This namespace has no Pod Security Admission labels configured. Default cluster-level settings apply.",
        resource: `Namespace/${nsp.namespace}`,
        namespace: nsp.namespace,
        recommendation: "Add pod-security.kubernetes.io labels to explicitly set security standards.",
      });
    }
  }

  return findings;
}

export function analyzeServiceAccountRisks(sas: ServiceAccountInfo[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const sa of sas) {
    if (sa.clusterRoles.includes("cluster-admin")) {
      findings.push({
        id: `sa-cluster-admin-${sa.namespace}-${sa.name}`,
        level: "critical",
        domain: "service-accounts",
        title: `ServiceAccount "${sa.name}" in "${sa.namespace}" has cluster-admin`,
        description: "This service account has full cluster-admin privileges. Any pod using it has unrestricted access.",
        resource: `ServiceAccount/${sa.namespace}/${sa.name}`,
        namespace: sa.namespace,
        recommendation: "Remove cluster-admin binding and create a role with only the necessary permissions.",
      });
    }
  }

  return findings;
}

export function analyzeSecretRisks(secrets: SecretInfo[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const secret of secrets) {
    if (!secret.creationTimestamp) continue;
    const age = Date.now() - new Date(secret.creationTimestamp).getTime();
    const days = age / (1000 * 60 * 60 * 24);
    if (days > 365 && secret.type === "kubernetes.io/tls") {
      findings.push({
        id: `secret-old-tls-${secret.namespace}-${secret.name}`,
        level: "medium",
        domain: "secrets",
        title: `TLS secret "${secret.name}" in "${secret.namespace}" is over 1 year old`,
        description: "Old TLS secrets may contain expired or soon-to-expire certificates.",
        resource: `Secret/${secret.namespace}/${secret.name}`,
        namespace: secret.namespace,
        recommendation: "Verify the certificate expiry date and rotate if needed.",
      });
    }
  }

  return findings;
}

// --- Workload Risk Analysis ---

const SENSITIVE_PORTS = new Set([22, 23, 3306, 5432, 6379, 27017, 9200, 2379, 2380, 10250, 10255]);

export function analyzeWorkloadRisks(workloads: WorkloadResource[]): RiskFinding[] {
  const findings: RiskFinding[] = [];

  for (const w of workloads) {
    const wRef = `${w.kind}/${w.namespace}/${w.name}`;

    // Host namespace access
    if (w.podSecurityPosture.hostNetwork) {
      findings.push({
        id: `wl-host-network-${w.namespace}-${w.name}`,
        level: "critical",
        domain: "workloads",
        title: `${w.kind} "${w.name}" uses host networking`,
        description: "This workload shares the host network namespace. It can see all network traffic on the node and bypasses network policies.",
        resource: wRef,
        namespace: w.namespace,
        recommendation: "Remove hostNetwork unless absolutely required (e.g., for CNI plugins or ingress controllers).",
      });
    }

    if (w.podSecurityPosture.hostPID) {
      findings.push({
        id: `wl-host-pid-${w.namespace}-${w.name}`,
        level: "critical",
        domain: "workloads",
        title: `${w.kind} "${w.name}" uses host PID namespace`,
        description: "This workload can see and interact with all processes on the host node.",
        resource: wRef,
        namespace: w.namespace,
        recommendation: "Remove hostPID. It is rarely needed and allows container escapes.",
      });
    }

    if (w.podSecurityPosture.hostIPC) {
      findings.push({
        id: `wl-host-ipc-${w.namespace}-${w.name}`,
        level: "high",
        domain: "workloads",
        title: `${w.kind} "${w.name}" uses host IPC namespace`,
        description: "This workload shares IPC with the host, allowing inter-process communication with host processes.",
        resource: wRef,
        namespace: w.namespace,
        recommendation: "Remove hostIPC unless required for specific host communication.",
      });
    }

    // Automount token when not needed
    if (w.podSecurityPosture.automountServiceAccountToken && w.podSecurityPosture.serviceAccountName === "default") {
      findings.push({
        id: `wl-automount-default-${w.namespace}-${w.name}`,
        level: "low",
        domain: "workloads",
        title: `${w.kind} "${w.name}" auto-mounts default SA token`,
        description: "The default service account token is mounted. If the application doesn't call the Kubernetes API, this is unnecessary exposure.",
        resource: wRef,
        namespace: w.namespace,
        recommendation: "Set automountServiceAccountToken: false, or use a dedicated service account with minimal permissions.",
      });
    }

    // Host path volumes
    const hostPathVols = w.podSecurityPosture.volumes.filter((v) => v.type === "hostPath");
    if (hostPathVols.length > 0) {
      findings.push({
        id: `wl-hostpath-${w.namespace}-${w.name}`,
        level: "high",
        domain: "workloads",
        title: `${w.kind} "${w.name}" mounts host path volumes`,
        description: `Mounts ${hostPathVols.length} host path volume(s), allowing direct access to the node filesystem.`,
        resource: wRef,
        namespace: w.namespace,
        recommendation: "Replace hostPath with PersistentVolumeClaims or other volume types.",
      });
    }

    // Per-container checks
    for (const container of w.containers) {
      const cRef = `${wRef} (container: ${container.name})`;
      const sc = container.securityContext;

      // No security context at all
      if (!sc) {
        findings.push({
          id: `wl-no-secctx-${w.namespace}-${w.name}-${container.name}`,
          level: "medium",
          domain: "workloads",
          title: `No security context on "${container.name}" in ${w.kind} "${w.name}"`,
          description: "This container has no security context defined. It will use the pod-level defaults, which may be permissive.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: "Add a security context with runAsNonRoot: true, readOnlyRootFilesystem: true, and drop ALL capabilities.",
        });
        continue;
      }

      // Privileged
      if (sc.privileged) {
        findings.push({
          id: `wl-privileged-${w.namespace}-${w.name}-${container.name}`,
          level: "critical",
          domain: "workloads",
          title: `Privileged container "${container.name}" in ${w.kind} "${w.name}"`,
          description: "This container runs in privileged mode with full access to the host. This is the most dangerous security setting.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: "Remove privileged: true. Use specific capabilities instead if host access is needed.",
        });
      }

      // Privilege escalation
      if (sc.allowPrivilegeEscalation !== false && !sc.privileged) {
        findings.push({
          id: `wl-escalation-${w.namespace}-${w.name}-${container.name}`,
          level: "medium",
          domain: "workloads",
          title: `Privilege escalation allowed in "${container.name}" of ${w.kind} "${w.name}"`,
          description: "The container can gain more privileges than its parent process via setuid binaries or other mechanisms.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: "Set allowPrivilegeEscalation: false.",
        });
      }

      // Running as root
      if (sc.runAsUser === 0 || (!sc.runAsNonRoot && !sc.runAsUser)) {
        const isExplicitRoot = sc.runAsUser === 0;
        findings.push({
          id: `wl-root-${w.namespace}-${w.name}-${container.name}`,
          level: isExplicitRoot ? "high" : "medium",
          domain: "workloads",
          title: `${isExplicitRoot ? "Runs as root" : "May run as root"}: "${container.name}" in ${w.kind} "${w.name}"`,
          description: isExplicitRoot
            ? "This container explicitly runs as root (UID 0), increasing the impact of container escape vulnerabilities."
            : "No runAsNonRoot constraint. The container image determines whether it runs as root.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: "Set runAsNonRoot: true and specify a non-zero runAsUser.",
        });
      }

      // Dangerous capabilities
      const dangerousCaps = ["SYS_ADMIN", "NET_ADMIN", "ALL", "SYS_PTRACE", "NET_RAW"];
      const addedCaps = sc.capabilities?.add || [];
      const dangerousAdded = addedCaps.filter((c) => dangerousCaps.includes(c));
      if (dangerousAdded.length > 0) {
        findings.push({
          id: `wl-caps-${w.namespace}-${w.name}-${container.name}`,
          level: dangerousAdded.includes("SYS_ADMIN") || dangerousAdded.includes("ALL") ? "critical" : "high",
          domain: "workloads",
          title: `Dangerous capabilities on "${container.name}" in ${w.kind} "${w.name}"`,
          description: `Container adds capabilities: ${dangerousAdded.join(", ")}. These grant significant host-level access.`,
          resource: cRef,
          namespace: w.namespace,
          recommendation: `Remove capabilities: ${dangerousAdded.join(", ")}. Use the minimum set required.`,
        });
      }

      // Not dropping ALL capabilities
      const droppedCaps = sc.capabilities?.drop || [];
      if (!droppedCaps.includes("ALL") && !droppedCaps.includes("all")) {
        findings.push({
          id: `wl-nodrop-${w.namespace}-${w.name}-${container.name}`,
          level: "low",
          domain: "workloads",
          title: `Capabilities not dropped in "${container.name}" of ${w.kind} "${w.name}"`,
          description: "Best practice is to drop ALL capabilities and only add back those specifically needed.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: 'Add capabilities: { drop: ["ALL"] } and selectively add back required capabilities.',
        });
      }

      // Writable root filesystem
      if (!sc.readOnlyRootFilesystem) {
        findings.push({
          id: `wl-rw-root-${w.namespace}-${w.name}-${container.name}`,
          level: "low",
          domain: "workloads",
          title: `Writable root filesystem in "${container.name}" of ${w.kind} "${w.name}"`,
          description: "The container can write to its root filesystem. Attackers could modify binaries or inject malicious code.",
          resource: cRef,
          namespace: w.namespace,
          recommendation: "Set readOnlyRootFilesystem: true. Use emptyDir volumes for writable directories.",
        });
      }

      // Sensitive ports
      for (const port of container.ports) {
        if (SENSITIVE_PORTS.has(port.containerPort)) {
          findings.push({
            id: `wl-sensitive-port-${w.namespace}-${w.name}-${container.name}-${port.containerPort}`,
            level: "medium",
            domain: "workloads",
            title: `Sensitive port ${port.containerPort} on "${container.name}" in ${w.kind} "${w.name}"`,
            description: `Port ${port.containerPort} is commonly associated with sensitive services (SSH, databases, etc.) and should be carefully controlled.`,
            resource: cRef,
            namespace: w.namespace,
            recommendation: "Ensure this port is protected by NetworkPolicies and only accessible by intended consumers.",
          });
        }

        if (port.hostPort) {
          findings.push({
            id: `wl-hostport-${w.namespace}-${w.name}-${container.name}-${port.containerPort}`,
            level: "high",
            domain: "workloads",
            title: `Host port ${port.hostPort} exposed by "${container.name}" in ${w.kind} "${w.name}"`,
            description: "This container exposes a port directly on the host node, bypassing Kubernetes service routing and network policies.",
            resource: cRef,
            namespace: w.namespace,
            recommendation: "Use a Service (NodePort or LoadBalancer) instead of hostPort.",
          });
        }
      }
    }
  }

  return findings;
}
