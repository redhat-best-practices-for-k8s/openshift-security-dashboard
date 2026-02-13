export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
  learnMore?: string; // URL to official docs
}

const glossary: Record<string, GlossaryEntry> = {
  "Role": {
    term: "Role",
    short: "A set of permissions that apply within a single namespace.",
    long: "A Role defines what actions (verbs like get, list, create, delete) can be performed on which resources (pods, services, secrets, etc.) within a specific namespace. Think of it as a job description that lists what someone is allowed to do in one department.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole"
  },
  "ClusterRole": {
    term: "ClusterRole",
    short: "A set of permissions that apply across the entire cluster.",
    long: "A ClusterRole is like a Role, but it works across all namespaces or for cluster-wide resources (like nodes). It defines permissions that aren't limited to a single namespace. Think of it as a company-wide policy rather than a department-specific one.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#role-and-clusterrole"
  },
  "RoleBinding": {
    term: "RoleBinding",
    short: "Connects a user/group/service account to a Role within a namespace.",
    long: "A RoleBinding is the glue that assigns a Role's permissions to specific users, groups, or service accounts within a namespace. Without a binding, a role's permissions aren't applied to anyone. It's like giving someone a key card that grants them the access defined by a Role.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding"
  },
  "ClusterRoleBinding": {
    term: "ClusterRoleBinding",
    short: "Connects a user/group/service account to a ClusterRole cluster-wide.",
    long: "A ClusterRoleBinding grants the permissions defined in a ClusterRole across all namespaces in the cluster. It's the most powerful type of permission assignment. Use with caution, as it gives access everywhere.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding"
  },
  "ServiceAccount": {
    term: "Service Account",
    short: "An identity used by pods and applications running in the cluster.",
    long: "A ServiceAccount provides an identity for processes running in pods. Instead of using a human user's credentials, applications authenticate to the Kubernetes API using their service account. Every namespace has a 'default' service account, but you can create dedicated ones with specific permissions for better security.",
    learnMore: "https://kubernetes.io/docs/concepts/security/service-accounts/"
  },
  "SCC": {
    term: "Security Context Constraint (SCC)",
    short: "OpenShift rules controlling what a container is allowed to do at the OS level.",
    long: "Security Context Constraints are OpenShift's way of controlling what Linux capabilities containers can use. They determine whether containers can run as root, access host networking, use privileged mode, or mount certain volume types. SCCs are assigned to service accounts via RBAC, and OpenShift picks the most restrictive one that satisfies a pod's requirements.",
    learnMore: "https://docs.openshift.com/container-platform/latest/authentication/managing-security-context-constraints.html"
  },
  "SecurityContext": {
    term: "Security Context",
    short: "Per-pod or per-container security settings in the deployment spec.",
    long: "A Security Context is the set of security settings defined directly in a pod or container specification. It requests specific capabilities like running as a certain user ID, using read-only filesystems, or adding Linux capabilities. The cluster's SCCs (OpenShift) or Pod Security Admission (Kubernetes) then decides whether these requests are allowed.",
    learnMore: "https://kubernetes.io/docs/tasks/configure-pod-container/security-context/"
  },
  "NetworkPolicy": {
    term: "Network Policy",
    short: "Firewall rules controlling which pods can communicate with each other.",
    long: "Network Policies are like firewall rules for your cluster's internal network. By default, all pods can talk to all other pods. Network Policies let you restrict this by defining allowed ingress (incoming) and egress (outgoing) traffic based on pod labels, namespaces, or IP ranges. If no policy selects a pod, all traffic is allowed.",
    learnMore: "https://kubernetes.io/docs/concepts/services-networking/network-policies/"
  },
  "PodSecurityAdmission": {
    term: "Pod Security Admission",
    short: "Built-in Kubernetes admission controller that enforces pod security standards.",
    long: "Pod Security Admission (PSA) replaces the deprecated PodSecurityPolicy. It enforces three predefined security levels per namespace: Privileged (unrestricted), Baseline (prevents known privilege escalations), and Restricted (heavily restricted, follows best practices). Each namespace can configure enforce, audit, and warn modes independently.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-admission/"
  },
  "Namespace": {
    term: "Namespace",
    short: "A virtual cluster within your cluster, used to organize and isolate resources.",
    long: "Namespaces divide a single physical cluster into multiple virtual clusters. They provide scope for names, allow resource quotas, and enable access control boundaries. Think of them as separate rooms in a building - each room can have its own rules and occupants.",
    learnMore: "https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/"
  },
  "RBAC": {
    term: "RBAC (Role-Based Access Control)",
    short: "The system that controls who can do what in the cluster.",
    long: "RBAC is the authorization mechanism in Kubernetes that regulates access to cluster resources. It works through four objects: Roles (what permissions exist), RoleBindings (who gets those permissions in a namespace), ClusterRoles (cluster-wide permissions), and ClusterRoleBindings (cluster-wide assignments). The pattern is always: Subject -> Binding -> Role -> Resources.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/"
  },
  "Subject": {
    term: "Subject",
    short: "The entity (user, group, or service account) that receives permissions.",
    long: "In RBAC, a subject is who or what is being granted permissions. Subjects can be Users (human identities), Groups (collections of users), or ServiceAccounts (application identities). A RoleBinding or ClusterRoleBinding connects subjects to the roles that define their permissions.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/#referring-to-subjects"
  },
  "Verb": {
    term: "Verb",
    short: "An action that can be performed on a resource (get, list, create, delete, etc.).",
    long: "Verbs define what actions are permitted on Kubernetes resources. Common verbs include: get (read one), list (read many), watch (stream changes), create, update, patch, delete, and deletecollection. The wildcard '*' means all verbs. Roles specify which verbs are allowed on which resources.",
    learnMore: "https://kubernetes.io/docs/reference/access-authn-authz/authorization/#determine-the-request-verb"
  },
  "OAuthClient": {
    term: "OAuth Client",
    short: "An application registered to authenticate users via OpenShift's OAuth server.",
    long: "OAuth Clients are registered applications that can request authentication tokens from OpenShift's built-in OAuth server. They define redirect URIs and grant methods for the OAuth flow. This is how external tools and dashboards authenticate users against the cluster.",
    learnMore: "https://docs.openshift.com/container-platform/latest/authentication/configuring-oauth-clients.html"
  },
  "IdentityProvider": {
    term: "Identity Provider (IDP)",
    short: "An external system (LDAP, GitHub, etc.) that verifies user identities.",
    long: "Identity Providers are external authentication systems that OpenShift trusts to verify who a user is. Common types include LDAP, GitHub, GitLab, OpenID Connect, and HTPasswd. When a user logs in, OpenShift delegates the identity verification to the configured IDP.",
    learnMore: "https://docs.openshift.com/container-platform/latest/authentication/understanding-identity-provider.html"
  },
  "Privileged": {
    term: "Privileged",
    short: "A container running with full host access - maximum risk.",
    long: "A privileged container has almost unrestricted access to the host system. It can access all devices, override security modules, and essentially act as root on the host machine. This is the highest security risk level and should almost never be used in production. It's the equivalent of giving someone the master key to the entire building.",
  },
  "RunAsUser": {
    term: "RunAsUser",
    short: "Controls which user ID (UID) a container's processes run as.",
    long: "RunAsUser determines the Linux user ID under which container processes execute. Options include: MustRunAsRange (must be within a specific UID range), MustRunAs (must be a specific UID), RunAsAny (no restrictions - can run as root), and MustRunAsNonRoot (any UID except 0/root). Running as non-root is a security best practice.",
  },
  "Capabilities": {
    term: "Linux Capabilities",
    short: "Fine-grained Linux permissions that can be added to or removed from containers.",
    long: "Linux capabilities break down the power of the root user into individual permissions (like NET_ADMIN for network configuration, SYS_PTRACE for debugging). Instead of giving a container full root access, you can grant just the specific capabilities it needs. SCCs control which capabilities containers are allowed to request.",
  },

  // ── SCC Fields ────────────────────────────────────────────────────────

  "AllowPrivilegedContainer": {
    term: "Allow Privileged Containers",
    short: "Whether containers can run in privileged mode with full host access.",
    long: "When enabled, containers can run with almost unrestricted access to the host, including all devices and kernel capabilities. This is the most dangerous setting and should only be allowed for infrastructure components that truly need it (e.g., CNI plugins, storage drivers).",
    learnMore: "https://docs.openshift.com/container-platform/latest/authentication/managing-security-context-constraints.html",
  },
  "AllowPrivilegeEscalation": {
    term: "Allow Privilege Escalation",
    short: "Whether a process can gain more privileges than its parent process.",
    long: "Privilege escalation allows a child process to obtain more privileges than its parent (e.g., via setuid binaries or kernel exploits). Blocking this with allowPrivilegeEscalation: false is a key hardening step. It prevents processes inside containers from elevating to root even if a vulnerability is exploited.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/",
  },
  "AllowHostNetwork": {
    term: "Allow Host Network",
    short: "Whether pods can use the host machine's network namespace directly.",
    long: "When host networking is enabled, the pod shares the network stack of the host node. It can see all network interfaces, bind to any port on the host, and sniff traffic. This bypasses network policies entirely and is a significant security risk. Only required for components like ingress controllers or network monitors.",
  },
  "AllowHostPID": {
    term: "Allow Host PID",
    short: "Whether pods can see and interact with processes on the host machine.",
    long: "Host PID sharing lets container processes see every process on the host node. This breaks process isolation and can be used to inspect, signal, or trace other containers' processes. It is required by some monitoring tools but should be avoided in general workloads.",
  },
  "AllowHostIPC": {
    term: "Allow Host IPC",
    short: "Whether pods can use the host's inter-process communication namespace.",
    long: "Host IPC access lets containers communicate with processes on the host via shared memory segments, semaphores, and message queues. This can be exploited to leak data between containers or to the host. Rarely needed outside of legacy applications.",
  },
  "AllowHostDirVolumes": {
    term: "Allow Host Dir Volumes",
    short: "Whether pods can mount directories from the host filesystem.",
    long: "HostPath volumes mount a file or directory from the host node's filesystem into the pod. This breaks the container's filesystem isolation and can allow reading sensitive host files (e.g., /etc/shadow, kubelet credentials) or writing to them. Prefer persistent volumes instead.",
  },
  "AllowHostPorts": {
    term: "Allow Host Ports",
    short: "Whether containers can bind to ports on the host network interface.",
    long: "Host ports let containers expose ports directly on the host's network interface rather than through Kubernetes services. This can conflict with other host services and bypasses service-level load balancing. Use NodePort or LoadBalancer services instead when possible.",
  },
  "ReadOnlyRootFS": {
    term: "Read-Only Root Filesystem",
    short: "Whether the container's root filesystem is mounted read-only.",
    long: "A read-only root filesystem prevents containers from writing to the filesystem image. This stops attackers from modifying binaries, installing malware, or tampering with configuration files inside the container. Applications that need to write should use dedicated writable volume mounts (e.g., /tmp, /var/run).",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/",
  },
  "SCCPriority": {
    term: "SCC Priority",
    short: "Determines which SCC is preferred when multiple match (higher = preferred).",
    long: "When a pod matches multiple SCCs, the admission controller uses priority to break ties. Higher-priority SCCs are considered first. If priorities are equal, SCCs are sorted by restrictiveness (most restrictive wins). Setting priorities carefully ensures predictable SCC selection for workloads.",
  },
  "SELinuxContext": {
    term: "SELinux Context",
    short: "Controls the SELinux security label applied to containers.",
    long: "SELinux (Security-Enhanced Linux) provides mandatory access control by applying labels to files and processes. The SELinux context strategy in an SCC determines what labels containers can use. Options include MustRunAs (specific label), RunAsAny (no restrictions), or the default (let the system choose).",
    learnMore: "https://docs.openshift.com/container-platform/latest/authentication/managing-security-context-constraints.html",
  },
  "FSGroup": {
    term: "FS Group",
    short: "The group ID applied to all files in mounted volumes.",
    long: "FSGroup sets a supplemental group ID that is added to all containers in a pod and applied as the group owner of all volumes mounted in the pod. This is important for shared storage where files need to be readable/writable by a specific group. Strategies include MustRunAs, RunAsAny, and MustRunAsRange.",
    learnMore: "https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-the-security-context-for-a-pod",
  },
  "SupplementalGroups": {
    term: "Supplemental Groups",
    short: "Additional group IDs added to container processes.",
    long: "Supplemental groups are extra Linux group IDs that are added to the container's primary process. They determine which files the process can access based on group permissions. The SCC strategy controls which group IDs are allowed (e.g., MustRunAs restricts to a range, RunAsAny allows any).",
  },
  "AllowedCapabilities": {
    term: "Allowed Capabilities",
    short: "Linux capabilities that containers are permitted to request.",
    long: "This list defines which Linux capabilities an SCC allows containers to add. Capabilities like NET_ADMIN (network configuration), SYS_PTRACE (process tracing), or NET_RAW (raw socket access) are powerful and should only be allowed when genuinely needed. An empty list means no extra capabilities can be added.",
  },
  "DefaultAddCapabilities": {
    term: "Default Add Capabilities",
    short: "Capabilities automatically added to every container using this SCC.",
    long: "These capabilities are added to all containers that use this SCC, even if the container spec doesn't request them. This is typically used by infrastructure SCCs that need to grant baseline capabilities to their workloads. Most custom SCCs should leave this empty.",
  },
  "RequiredDropCapabilities": {
    term: "Required Drop Capabilities",
    short: "Capabilities that must be dropped from every container using this SCC.",
    long: "These capabilities are forcibly removed from containers using this SCC. Setting 'ALL' means every capability is dropped, which is the most secure option. Containers can then selectively add back only what they need (if allowed). The 'restricted' and 'restricted-v2' SCCs require dropping ALL.",
  },
  "AllowedVolumes": {
    term: "Allowed Volume Types",
    short: "The types of volumes (emptyDir, configMap, secret, etc.) pods can mount.",
    long: "This controls which volume types containers can use. Safe types include configMap, secret, emptyDir, and persistentVolumeClaim. Dangerous types include hostPath (host filesystem access) and '*' (all types). Restricting volume types prevents containers from accessing the host filesystem or other sensitive storage.",
  },
  "SCCUsers": {
    term: "SCC Users",
    short: "Service accounts explicitly granted access to use this SCC.",
    long: "The users field lists specific service accounts (in the format system:serviceaccount:<namespace>:<name>) that are directly allowed to use this SCC. This is one of three ways to grant SCC access, alongside the groups field and RBAC role bindings with the 'use' verb.",
  },
  "SCCGroups": {
    term: "SCC Groups",
    short: "Groups whose members are allowed to use this SCC.",
    long: "The groups field lists Kubernetes groups whose members can use this SCC. Common groups include system:authenticated (all logged-in users), system:serviceaccounts (all SAs in all namespaces), and system:serviceaccounts:<namespace> (all SAs in a specific namespace). Group-level grants affect many service accounts at once.",
  },

  // ── Container Security Context Fields ─────────────────────────────────

  "RunAsNonRoot": {
    term: "Run As Non-Root",
    short: "Ensures the container process does not run as the root user (UID 0).",
    long: "When set to true, the kubelet validates that the container is not running as root (UID 0) at startup and refuses to start it if it is. This is a critical security hardening step because root inside a container can exploit kernel vulnerabilities to escape the container. Always enable this unless the application absolutely requires root.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/",
  },
  "RunAsGroup": {
    term: "Run As Group",
    short: "The primary group ID (GID) for all processes in the container.",
    long: "RunAsGroup sets the primary Linux group ID for the container's main process and any files it creates. Combined with FSGroup for volumes, this controls file permission behavior. If not set, the container runtime's default group (usually root/0) is used.",
  },
  "ReadOnlyRootFilesystem": {
    term: "Read-Only Root Filesystem",
    short: "Mounts the container's root filesystem as read-only to prevent tampering.",
    long: "When enabled, the container's root filesystem cannot be written to. This prevents attackers from modifying application binaries, installing backdoors, or changing configuration. Applications that need writable space should use volume mounts for specific directories like /tmp or /var/run.",
  },
  "DropCapabilities": {
    term: "Drop Capabilities",
    short: "Linux capabilities removed from the container (drop ALL is recommended).",
    long: "Dropping capabilities removes Linux kernel permissions from the container process. Dropping ALL removes every capability, which is the most secure baseline. You can then add back only the specific capabilities the application needs. The 'restricted' pod security standard requires dropping ALL.",
  },
  "SeccompProfile": {
    term: "Seccomp Profile",
    short: "Restricts which system calls the container process can make.",
    long: "Seccomp (Secure Computing) profiles filter the Linux system calls a container can invoke. 'RuntimeDefault' uses the container runtime's built-in profile that blocks dangerous syscalls. 'Unconfined' disables filtering entirely (risky). 'Localhost' uses a custom profile from the node. The restricted pod security standard requires RuntimeDefault or Localhost.",
    learnMore: "https://kubernetes.io/docs/tutorials/security/seccomp/",
  },

  // ── Pod-level Posture Fields ──────────────────────────────────────────

  "HostNetwork": {
    term: "Host Network",
    short: "Whether the pod uses the host node's network namespace.",
    long: "When enabled, the pod shares the host's network stack, seeing all interfaces and traffic. This bypasses Kubernetes networking and network policies entirely. The pod can bind to any host port and sniff network traffic. Only use for network infrastructure components.",
  },
  "HostPID": {
    term: "Host PID",
    short: "Whether the pod can see all processes on the host node.",
    long: "Host PID namespace sharing lets the pod see and signal every process on the host, including other containers and system daemons. This breaks process isolation and can be used for privilege escalation. Only needed for specialized monitoring or debugging tools.",
  },
  "AutomountServiceAccountToken": {
    term: "Automount SA Token",
    short: "Whether the service account token is automatically mounted in the pod.",
    long: "By default, Kubernetes mounts a service account token into every pod at /var/run/secrets/kubernetes.io/serviceaccount/token. This token can be used to authenticate to the Kubernetes API. Disabling automounting reduces the attack surface for pods that don't need API access, preventing credential theft if the pod is compromised.",
    learnMore: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#opt-out-of-api-credential-automounting",
  },
  "AppliedSCC": {
    term: "Applied SCC",
    short: "The SCC actually enforced on this pod by the OpenShift admission controller.",
    long: "The applied SCC is the one the OpenShift admission controller selected for this pod from all available SCCs for its service account. The controller gathers all SCCs the SA can use, filters out those incompatible with the pod's security context, sorts by priority then restrictiveness, and picks the first match. This annotation (openshift.io/scc) shows which SCC won.",
  },
  "AvailableSCCs": {
    term: "Available SCCs",
    short: "All SCCs this service account is allowed to use (via users, groups, or RBAC).",
    long: "Available SCCs are the full set of Security Context Constraints this service account could use, gathered from three sources: direct entries in the SCC's users field, group memberships in the SCC's groups field, and RBAC roles/clusterroles with the 'use' verb on securitycontextconstraints. The admission controller selects the applied SCC from this set.",
  },

  // ── Network Policy Fields ─────────────────────────────────────────────

  "PodSelector": {
    term: "Pod Selector",
    short: "Label-based filter that selects which pods this policy applies to.",
    long: "A pod selector uses label key-value pairs to match pods. An empty selector ({}) matches all pods in the namespace. For network policies, the main pod selector determines which pods the policy's rules apply to. For ingress/egress peers, pod selectors narrow which pods are allowed as traffic sources/destinations.",
    learnMore: "https://kubernetes.io/docs/concepts/services-networking/network-policies/#the-networkpolicy-resource",
  },
  "NamespaceSelector": {
    term: "Namespace Selector",
    short: "Label-based filter to allow traffic from/to pods in matching namespaces.",
    long: "A namespace selector matches namespaces by their labels. When used in a network policy ingress/egress rule, it allows traffic from/to pods in those matching namespaces. Combined with a pod selector, it can target specific pods in specific namespaces. An empty selector matches all namespaces.",
  },
  "PolicyTypes": {
    term: "Policy Types",
    short: "Whether this policy controls Ingress (incoming), Egress (outgoing), or both.",
    long: "Policy types declare which traffic directions this policy governs. If Ingress is listed, the policy's ingress rules are applied (and if no ingress rules exist, all incoming traffic is denied). Same for Egress. A policy without any policyTypes listed defaults to Ingress only. For full isolation, specify both Ingress and Egress.",
  },
  "IngressRule": {
    term: "Ingress Rule",
    short: "Defines which incoming traffic is allowed to reach the selected pods.",
    long: "Ingress rules whitelist incoming traffic. Each rule can specify 'from' peers (by pod selector, namespace selector, or IP block) and 'ports'. If no 'from' is specified, all sources are allowed for those ports. If no ingress rules exist but Ingress is in policyTypes, all incoming traffic is denied (default deny).",
    learnMore: "https://kubernetes.io/docs/concepts/services-networking/network-policies/#behavior-of-to-and-from-selectors",
  },
  "EgressRule": {
    term: "Egress Rule",
    short: "Defines which outgoing traffic is allowed from the selected pods.",
    long: "Egress rules whitelist outgoing traffic. Each rule can specify 'to' peers (by pod selector, namespace selector, or IP block) and 'ports'. If no 'to' is specified, all destinations are allowed for those ports. If no egress rules exist but Egress is in policyTypes, all outgoing traffic is denied.",
  },
  "IPBlock": {
    term: "IP Block",
    short: "A CIDR range for allowing or excluding traffic by IP address.",
    long: "IP blocks define network policy peers by IP address range in CIDR notation (e.g., 10.0.0.0/8). The 'cidr' field specifies the allowed range, and the optional 'except' field carves out sub-ranges to exclude. IP blocks are used for traffic to/from external services or specific network segments.",
  },
  "CIDR": {
    term: "CIDR",
    short: "A notation for IP address ranges (e.g., 10.0.0.0/8 means all 10.x.x.x).",
    long: "CIDR (Classless Inter-Domain Routing) notation represents IP address ranges. The number after the slash is the number of fixed bits: /8 = 16M addresses, /16 = 65K, /24 = 256, /32 = single IP. In network policies, CIDR blocks define which external IP ranges are allowed as traffic sources or destinations.",
  },
  "NetworkPorts": {
    term: "Ports",
    short: "Which ports and protocols (TCP/UDP) traffic is allowed on.",
    long: "Port rules in network policies restrict which ports traffic can use. Each entry specifies a protocol (TCP, UDP, or SCTP) and a port number or named port. If no ports are specified in a rule, traffic on all ports is allowed. Use port restrictions to minimize the attack surface of exposed services.",
  },

  // ── PSA Fields ────────────────────────────────────────────────────────

  "PSAEnforce": {
    term: "PSA Enforce",
    short: "Rejects pods that violate this security level (hard block).",
    long: "The enforce mode actively prevents pods from being created or updated if they violate the configured security level. This is the strongest mode - non-compliant pods are rejected by the API server. Use enforce: restricted in production namespaces for maximum security.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-admission/",
  },
  "PSAAudit": {
    term: "PSA Audit",
    short: "Logs violations to the audit log but still allows the pod.",
    long: "Audit mode records policy violations in the Kubernetes audit log without blocking the pod. This is useful for monitoring compliance before switching to enforce mode. It lets you see which workloads would break before enforcing stricter policies.",
  },
  "PSAWarn": {
    term: "PSA Warn",
    short: "Shows a warning to the user but still allows the pod.",
    long: "Warn mode sends a warning message back to the user (visible in kubectl output) when a pod violates the configured level, but still allows creation. This helps educate developers about security issues without blocking their work. Good for transitioning to stricter policies.",
  },
  "PSAPrivileged": {
    term: "Privileged Level",
    short: "No restrictions at all - anything is allowed.",
    long: "The privileged level is completely unrestricted. It allows host namespaces, privileged containers, all capabilities, all volume types, and running as root. This is appropriate for system-level namespaces (kube-system, openshift-*) but should never be used for application workloads.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/#privileged",
  },
  "PSABaseline": {
    term: "Baseline Level",
    short: "Prevents known privilege escalation vectors while staying broadly compatible.",
    long: "The baseline level prevents the most dangerous configurations: privileged containers, host namespaces (network, PID, IPC), host ports, and dangerous capabilities. Most applications work under baseline without modification. It is a good middle ground for non-critical workloads.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/#baseline",
  },
  "PSARestricted": {
    term: "Restricted Level",
    short: "Maximum hardening - follows all current pod security best practices.",
    long: "The restricted level enforces all current security best practices: non-root execution, read-only root filesystem, drop ALL capabilities, seccomp profile required, no privilege escalation, and no host access. Applications may need modifications to run under restricted, but it provides the strongest security posture.",
    learnMore: "https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted",
  },

  // ── RBAC Fields ───────────────────────────────────────────────────────

  "APIGroups": {
    term: "API Groups",
    short: "The Kubernetes API group a resource belongs to (e.g., apps, networking.k8s.io).",
    long: "Kubernetes organizes its API into groups. Core resources (pods, services, secrets) use the empty string ''. Extended resources use named groups like 'apps' (deployments), 'rbac.authorization.k8s.io' (roles), or 'networking.k8s.io' (network policies). The wildcard '*' matches all API groups. In RBAC rules, specifying the correct API group is required to grant access to resources.",
    learnMore: "https://kubernetes.io/docs/reference/using-api/#api-groups",
  },
  "Resources": {
    term: "Resources",
    short: "The Kubernetes object types this rule applies to (pods, secrets, deployments, etc.).",
    long: "Resources are the Kubernetes object types that RBAC rules grant access to. Examples: 'pods', 'services', 'secrets', 'deployments', 'configmaps'. Sub-resources can be specified as 'resource/subresource' (e.g., 'pods/log'). The wildcard '*' matches all resources in the specified API groups.",
  },
  "ResourceNames": {
    term: "Resource Names",
    short: "Limits the rule to specific named resources instead of all resources of that type.",
    long: "ResourceNames restrict a rule to specific instances by name. For example, a rule on secrets with resourceNames: ['my-secret'] only grants access to that one secret, not all secrets. This is useful for granting minimal access to specific SCC names (via the 'use' verb) or individual secrets.",
  },

  // ── SA / Secrets Fields ───────────────────────────────────────────────

  "ImagePullSecrets": {
    term: "Image Pull Secrets",
    short: "Secrets used to authenticate when pulling container images from private registries.",
    long: "Image pull secrets contain credentials for private container registries (like Docker Hub, Quay, or a private registry). They are attached to service accounts so that pods using that SA can automatically pull images from authenticated registries without embedding credentials in pod specs.",
    learnMore: "https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/",
  },
  "SecretType": {
    term: "Secret Type",
    short: "The kind of secret (Opaque, TLS, docker-registry, service-account-token, etc.).",
    long: "Kubernetes secrets have types that hint at their contents: Opaque (generic key-value data), kubernetes.io/tls (TLS certificate + key), kubernetes.io/dockerconfigjson (registry credentials), kubernetes.io/service-account-token (SA authentication token). The type helps tools and controllers handle secrets correctly.",
    learnMore: "https://kubernetes.io/docs/concepts/configuration/secret/#secret-types",
  },
  "SecretKeys": {
    term: "Secret Keys",
    short: "The data keys stored inside the secret (e.g., username, password, tls.crt).",
    long: "Each secret contains one or more key-value pairs in its data field. Keys are the names (e.g., 'password', 'tls.crt', 'ca.crt') and values are base64-encoded. The keys tell you what kind of data the secret holds without revealing the actual values.",
  },
  "SCCGrant": {
    term: "SCC Grant Source",
    short: "How this SCC was granted: via direct user entry, group membership, or RBAC role.",
    long: "SCCs can be granted to service accounts through three mechanisms: (1) Direct - the SA is listed in the SCC's 'users' field, (2) Group - a group the SA belongs to is in the SCC's 'groups' field, (3) RBAC - a Role or ClusterRole with 'use' verb on the SCC is bound to the SA. Understanding the grant source helps troubleshoot why a pod gets a particular SCC.",
  },

  // ── TLS Scanner Fields ────────────────────────────────────────────────

  "TLSVersion": {
    term: "TLS Version",
    short: "The protocol version used for encrypted communication (TLSv1.2, TLSv1.3, etc.).",
    long: "TLS (Transport Layer Security) versions determine the cryptographic protocols used for secure communication. TLSv1.0 and TLSv1.1 are deprecated due to known vulnerabilities. TLSv1.2 is widely supported and considered secure when paired with strong ciphers. TLSv1.3 is the most recent version with improved security and performance. OpenShift TLS profiles control which versions are allowed.",
    learnMore: "https://docs.openshift.com/container-platform/latest/security/tls-security-profiles.html",
  },
  "TLSCipher": {
    term: "TLS Cipher Suite",
    short: "The encryption algorithm used for a TLS connection (e.g., AES-128-GCM, CHACHA20).",
    long: "Cipher suites define the combination of algorithms used for key exchange, encryption, and message authentication in a TLS connection. Strong ciphers (grade A) like AES-256-GCM with ECDHE key exchange are preferred. Weak ciphers (grade C/D) like RC4 or DES should be disabled. The cipher strength grade (A/B/C) indicates how secure the algorithm is considered.",
  },
  "TLSProfile": {
    term: "TLS Security Profile",
    short: "A predefined set of TLS versions and ciphers applied to cluster components.",
    long: "OpenShift TLS security profiles configure the minimum TLS version and allowed cipher suites for cluster components (Ingress Controller, API Server, Kubelet). Profile types include: Old (maximum compatibility, weakest security), Intermediate (balanced, recommended), Modern (strictest, TLSv1.3 only), and Custom (user-defined). These profiles ensure consistent TLS configuration across the cluster.",
    learnMore: "https://docs.openshift.com/container-platform/latest/security/tls-security-profiles.html",
  },
  "mTLS": {
    term: "Mutual TLS (mTLS)",
    short: "Both client and server verify each other's certificates during TLS handshake.",
    long: "In standard TLS, only the server presents a certificate. In mutual TLS, both sides authenticate: the server verifies the client's certificate and vice versa. This is common for etcd communication, service mesh traffic, and internal cluster APIs. Ports showing MTLS_REQUIRED status in a scan indicate the service requires a client certificate to complete the handshake.",
  },
  "TLSScanStatus": {
    term: "Scan Status",
    short: "The categorized result of scanning a port for TLS configuration.",
    long: "Each scanned port gets a status: OK (TLS working, ciphers enumerated), NO_TLS (port open but no TLS), LOCALHOST_ONLY (bound to 127.0.0.1, not network-accessible), FILTERED (blocked by network policy), CLOSED (not listening), MTLS_REQUIRED (needs client cert), TIMEOUT (connection timed out), NO_PORTS (pod declares no TCP ports), ERROR (scan error).",
  },
  "ListenAddress": {
    term: "Listen Address",
    short: "The network address a port is bound to (e.g., 0.0.0.0, 127.0.0.1, *).",
    long: "The listen address determines which network interfaces a service accepts connections on. '0.0.0.0' or '*' means all interfaces (network-accessible). '127.0.0.1' means localhost only (not accessible from other pods). Ports bound to localhost don't pose external TLS compliance concerns but may still need TLS for local security.",
  },
  "QuantumReady": {
    term: "Quantum Ready",
    short: "Whether a port supports TLS 1.3 and is capable of PQC key exchange.",
    long: "TLS 1.3 is the only TLS version whose protocol design supports Post-Quantum Cryptography (PQC) key exchange mechanisms such as ML-KEM (Kyber). Ports that negotiate at least one TLS 1.3 cipher are flagged as 'quantum capable' — they can adopt PQC once the server and client both support it. TLS 1.2 and below cannot use PQC key exchange regardless of the cipher suite chosen.",
    learnMore: "https://www.nist.gov/pqcrypto",
  },
  "ContainerID": {
    term: "Container ID",
    short: "The CRI runtime identifier for a container (e.g., crio://abc123...).",
    long: "The Container ID is assigned by the container runtime (CRI-O, containerd) when a container is created. It uniquely identifies a running container on a node and is used to map network namespaces back to pods. The node-level TLS scan discovers container IDs by inspecting each network namespace with crictl, then matches them to Kubernetes pods via their containerStatuses.",
  },
  "NetworkNamespace": {
    term: "Network Namespace",
    short: "A Linux kernel namespace that isolates network resources for containers.",
    long: "Network namespaces provide each pod (or group of containers sharing a pod) with its own network stack — IP addresses, routing tables, firewall rules, and listening ports. Containers in the same pod share a network namespace. The node-level TLS scan enumerates all unique network namespaces on each node, then scans ports within each namespace to discover TLS configurations.",
    learnMore: "https://man7.org/linux/man-pages/man7/network_namespaces.7.html",
  },
};

export default glossary;

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  return glossary[term] || Object.values(glossary).find(
    (entry) => entry.term.toLowerCase() === term.toLowerCase()
  );
}

export function searchGlossary(query: string): GlossaryEntry[] {
  const lower = query.toLowerCase();
  return Object.values(glossary).filter(
    (entry) =>
      entry.term.toLowerCase().includes(lower) ||
      entry.short.toLowerCase().includes(lower)
  );
}
