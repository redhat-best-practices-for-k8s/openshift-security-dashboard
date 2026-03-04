// Cluster connection
export interface KubeConfigInfo {
  contexts: { name: string; cluster: string; user: string; namespace?: string }[];
  currentContext: string;
  clusters: { name: string; server: string }[];
}

export interface ClusterInfo {
  name: string;
  server: string;
  version: string;
  platform: string; // "OpenShift" | "Kubernetes"
  openshiftVersion?: string;
  nodeCount: number;
  namespaceCount: number;
}

// RBAC types
export interface RBACRole {
  name: string;
  namespace?: string;
  kind: "Role" | "ClusterRole";
  rules: PolicyRule[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
}

export interface PolicyRule {
  verbs: string[];
  apiGroups: string[];
  resources: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export interface RBACBinding {
  name: string;
  namespace?: string;
  kind: "RoleBinding" | "ClusterRoleBinding";
  roleRef: { kind: string; name: string; apiGroup: string };
  subjects: RBACSubject[];
  creationTimestamp?: string;
}

export interface RBACSubject {
  kind: "User" | "Group" | "ServiceAccount";
  name: string;
  namespace?: string;
  apiGroup?: string;
}

export interface RBACData {
  roles: RBACRole[];
  clusterRoles: RBACRole[];
  roleBindings: RBACBinding[];
  clusterRoleBindings: RBACBinding[];
}

// SCC types
export interface SecurityContextConstraint {
  name: string;
  priority: number | null;
  allowPrivilegedContainer: boolean;
  allowPrivilegeEscalation: boolean;
  allowHostDirVolumePlugin: boolean;
  allowHostIPC: boolean;
  allowHostNetwork: boolean;
  allowHostPID: boolean;
  allowHostPorts: boolean;
  allowedCapabilities: string[];
  defaultAddCapabilities: string[];
  requiredDropCapabilities: string[];
  readOnlyRootFilesystem: boolean;
  runAsUser: RunAsUserStrategy;
  seLinuxContext: SELinuxStrategy;
  fsGroup: FSGroupStrategy;
  supplementalGroups: SupplementalGroupsStrategy;
  volumes: string[];
  users: string[];
  groups: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
}

export interface RunAsUserStrategy {
  type: string;
  uid?: number;
  uidRangeMin?: number;
  uidRangeMax?: number;
}

export interface SELinuxStrategy {
  type: string;
}

export interface FSGroupStrategy {
  type: string;
  ranges?: { min: number; max: number }[];
}

export interface SupplementalGroupsStrategy {
  type: string;
  ranges?: { min: number; max: number }[];
}

// Network Policy types
export interface NetworkPolicyData {
  name: string;
  namespace: string;
  podSelector: Record<string, string>;
  policyTypes: string[];
  ingress: NetworkPolicyRule[];
  egress: NetworkPolicyRule[];
  creationTimestamp?: string;
}

export interface NetworkPolicyRule {
  from?: NetworkPolicyPeer[];
  to?: NetworkPolicyPeer[];
  ports?: { port: number | string; protocol: string }[];
}

export interface NetworkPolicyPeer {
  podSelector?: Record<string, string>;
  namespaceSelector?: Record<string, string>;
  ipBlock?: { cidr: string; except?: string[] };
}

// Pod Security
export interface NamespacePodSecurity {
  namespace: string;
  enforce?: string;
  enforceVersion?: string;
  audit?: string;
  auditVersion?: string;
  warn?: string;
  warnVersion?: string;
}

// Service Accounts
export interface ServiceAccountInfo {
  name: string;
  namespace: string;
  secrets: string[];
  imagePullSecrets: string[];
  roles: string[];
  clusterRoles: string[];
  sccs: string[];
  podCount: number;
  creationTimestamp?: string;
}

// Secrets
export interface SecretInfo {
  name: string;
  namespace: string;
  type: string;
  keys: string[];
  creationTimestamp?: string;
  labels?: Record<string, string>;
  linkedServiceAccounts: string[];
  linkedPods: string[];
}

// Identity
export interface IdentityProvider {
  name: string;
  type: string;
  mappingMethod: string;
  challenge?: boolean;
  login?: boolean;
}

export interface OAuthClient {
  name: string;
  redirectURIs: string[];
  grantMethod: string;
  creationTimestamp?: string;
}

export interface UserInfo {
  name: string;
  fullName?: string;
  groups: string[];
  identities: string[];
}

export interface GroupInfo {
  name: string;
  users: string[];
}

// Risk scoring
export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

export interface RiskFinding {
  id: string;
  level: RiskLevel;
  domain: "rbac" | "scc" | "network" | "pod-security" | "service-accounts" | "secrets" | "identity" | "workloads";
  title: string;
  description: string;
  resource: string;
  namespace?: string;
  recommendation: string;
}

export interface SecurityScore {
  overall: number; // 0-100
  domains: {
    rbac: number;
    scc: number;
    network: number;
    podSecurity: number;
    serviceAccounts: number;
    secrets: number;
    identity: number;
    workloads: number;
  };
  findings: RiskFinding[];
}

// Graph types for React Flow
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

// Change staging types
export interface PendingChange {
  id: string;
  action: "create" | "update" | "delete";
  resourceKind: string;
  resourceName: string;
  namespace?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  description: string;
  aiSuggested?: boolean;
  aiExplanation?: string;
}

// AI Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  id: string;
  action: "create" | "update" | "delete";
  kind: string;
  name: string;
  namespace?: string;
  spec: Record<string, unknown>;
  explanation: string;
  applied?: boolean;
}

// Input types for create/update
export interface CreateRoleInput {
  name: string;
  namespace?: string;
  kind: "Role" | "ClusterRole";
  rules: PolicyRule[];
  labels?: Record<string, string>;
}

export interface CreateBindingInput {
  name: string;
  namespace?: string;
  kind: "RoleBinding" | "ClusterRoleBinding";
  roleRef: { kind: string; name: string; apiGroup: string };
  subjects: RBACSubject[];
}

export interface CreateNetworkPolicyInput {
  name: string;
  namespace: string;
  podSelector: Record<string, string>;
  policyTypes: string[];
  ingress: NetworkPolicyRule[];
  egress: NetworkPolicyRule[];
}

export interface CreateServiceAccountInput {
  name: string;
  namespace: string;
}

export interface CreateSecretInput {
  name: string;
  namespace: string;
  type: string;
  data: Record<string, string>;
  labels?: Record<string, string>;
}

// Workload types
export type WorkloadKind = "Pod" | "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob";

export interface ContainerSecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  privileged?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
  seccompProfile?: {
    type: string;
    localhostProfile?: string;
  };
  seLinuxOptions?: {
    user?: string;
    role?: string;
    type?: string;
    level?: string;
  };
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol: string;
  hostPort?: number;
}

export interface ContainerSecurityInfo {
  name: string;
  image: string;
  securityContext?: ContainerSecurityContext;
  ports: ContainerPort[];
  resources?: {
    requests?: Record<string, string>;
    limits?: Record<string, string>;
  };
  command?: string[];
  volumeMounts?: { name: string; mountPath: string; readOnly?: boolean }[];
}

export interface PodSecurityPosture {
  hostNetwork: boolean;
  hostPID: boolean;
  hostIPC: boolean;
  serviceAccountName: string;
  automountServiceAccountToken: boolean;
  securityContext?: ContainerSecurityContext;
  volumes: { name: string; type: string }[];
  nodeSelector?: Record<string, string>;
  nodeName?: string;
}

export interface PortStatus {
  containerName: string;
  containerPort: number;
  protocol: string;
  declared: boolean;
  hostPort?: number;
  serviceName?: string;
  servicePort?: number;
}

export interface WorkloadResource {
  kind: WorkloadKind;
  name: string;
  namespace: string;
  replicas?: number;
  readyReplicas?: number;
  containers: ContainerSecurityInfo[];
  initContainers?: ContainerSecurityInfo[];
  podSecurityPosture: PodSecurityPosture;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  status?: string;
  podNames?: string[];
  ports?: PortStatus[];
  /** The SCC applied to the pod(s) by OpenShift admission (from openshift.io/scc annotation) */
  appliedSCC?: string;
}

export interface CrossNamespaceAccess {
  sourceNamespace: string;
  sourceSubject: { kind: string; name: string };
  targetNamespace: string;
  bindingName: string;
  bindingKind: string;
  roleRef: { kind: string; name: string };
  grantedVerbs: string[];
  grantedResources: string[];
}

// ── TLS Scanner Types ───────────────────────────────────────────────────

export type TLSScanStatus =
  | "OK"
  | "NO_TLS"
  | "LOCALHOST_ONLY"
  | "FILTERED"
  | "CLOSED"
  | "MTLS_REQUIRED"
  | "TIMEOUT"
  | "NO_PORTS"
  | "ERROR";

export interface TLSConfigComplianceResult {
  version: boolean;
  ciphers: boolean;
}

export interface TLSHandshakeDetails {
  key_exchange_group?: string;
  key_exchange_bits?: number;
  signature_algorithm?: string;
  alpn_protocol?: string;
  is_pqc?: boolean;
}

export interface TLSPortResult {
  port: number;
  protocol: string;
  state: string;
  service: string;
  process_name?: string;
  container_name?: string;
  container_id?: string;
  quantum_ready?: boolean;
  tls_versions?: string[];
  tls_ciphers?: string[];
  tls_cipher_strength?: Record<string, string>;
  handshake?: TLSHandshakeDetails;
  error?: string;
  status: TLSScanStatus;
  reason?: string;
  listen_address?: string;
  ingress_tls_config_compliance?: TLSConfigComplianceResult;
  api_server_tls_config_compliance?: TLSConfigComplianceResult;
  kubelet_tls_config_compliance?: TLSConfigComplianceResult;
}

export interface TLSPodInfo {
  Name: string;
  Namespace: string;
  Image: string;
  IPs?: string[];
  Containers?: string[];
}

export interface TLSServiceInfo {
  name: string;
  namespace: string;
  type: string;
  ports?: number[];
}

export interface TLSOpenshiftComponent {
  component: string;
  source_location: string;
  maintainer_component: string;
  is_bundle: boolean;
}

export interface TLSIPResult {
  ip: string;
  status: string;
  open_ports: number[];
  port_results: TLSPortResult[];
  openshift_component?: TLSOpenshiftComponent;
  pod?: TLSPodInfo;
  services?: TLSServiceInfo[];
  error?: string;
  node?: string;
  container_ids?: string[];
}

export interface TLSScanError {
  ip: string;
  port: number;
  error_type: string;
  error_message: string;
  pod_name?: string;
  namespace?: string;
  container?: string;
}

export interface IngressTLSProfile {
  type?: string;
  min_tls_version?: string;
  ciphers?: string[];
  raw?: string;
}

export interface APIServerTLSProfile {
  type?: string;
  min_tls_version?: string;
  ciphers?: string[];
  raw?: string;
}

export interface KubeletTLSProfile {
  tls_cipher_suites?: string[];
  tls_min_version?: string;
  raw?: string;
}

export interface TLSSecurityProfile {
  ingress_controller?: IngressTLSProfile;
  api_server?: APIServerTLSProfile;
  kubelet_config?: KubeletTLSProfile;
}

export interface TLSScanResults {
  timestamp: string;
  total_ips: number;
  scanned_ips: number;
  ip_results: TLSIPResult[];
  tls_security_config?: TLSSecurityProfile;
  scan_errors?: TLSScanError[];
}
