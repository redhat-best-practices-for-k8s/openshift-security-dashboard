# OpenShift Security Dashboard

A local web application that provides an intuitive, self-learning GUI for exploring and managing the full security posture of an OpenShift or Kubernetes cluster.

Upload a kubeconfig file and visually explore RBAC, SCCs, Network Policies, Pod Security Admission, Workloads, Service Accounts, Secrets, and OAuth/Identity — all from your browser, with built-in tooltips and an AI assistant to help you learn and make changes.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | LTS recommended |
| npm | 9+ | Ships with Node.js |
| [Ollama](https://ollama.com/) | Any | Optional — only needed for AI assistant |
| `qwen3:32b` model | — | Optional — `ollama pull qwen3:32b` |

You also need a valid **kubeconfig** file for the cluster you want to inspect.

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> security-dashboard
cd security-dashboard
npm install

# 2. Start the dev server
npm run dev

# 3. Open in your browser
open http://localhost:3000
```

> **macOS users:** If you see `EMFILE: too many open files` errors from the file watcher, raise the limit before starting:
>
> ```bash
> ulimit -n 10240
> npm run dev
> ```

### Connecting to a Cluster

1. On the landing page, **drag-and-drop** your kubeconfig file (any filename) or click to browse.
2. Select the context and namespace from the header dropdowns.
3. Navigate the security views using the sidebar.

### Enabling the AI Assistant

The AI assistant uses a local Ollama instance so your data never leaves your machine.

```bash
# Install Ollama (macOS)
brew install ollama

# Pull the model
ollama pull qwen3:32b

# Start the Ollama server (if not already running)
ollama serve
```

The assistant will appear on each resource detail panel. It uses the current resource as context and lets you ask questions or request changes in natural language.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server with Turbopack (hot reload) |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Production Build

```bash
npm run build
npm start
```

The app runs on port 3000 by default. Override with the `-p` flag:

```bash
npm run dev -- -p 4000
```

## Features

- **Dashboard** — Security posture score, top risk findings, domain quick-stats
- **RBAC Explorer** — Interactive graph of Subject → Binding → Role → Resource chains, permission matrix, "Who Can?" queries
- **SCC Manager** — Side-by-side comparison of Security Context Constraints with traffic-light risk indicators; full editing support
- **Network Policies** — Topology visualization, namespace-level segmentation, create policies by drawing links between namespaces
- **Pod Security Admission** — Namespace grid showing enforce / audit / warn levels with level comparison and editing
- **Workloads** — All workload types (Deployment, StatefulSet, DaemonSet, Pod, Job, CronJob) with per-container security context editing, port analysis, and applied/available SCC display
- **Service Accounts** — Permission rollup, cluster-admin detection, linked secrets/roles, unified SCC resolution (direct, group, RBAC)
- **Secrets** — Metadata-only view categorized by type with age/rotation warnings (values are never displayed)
- **OAuth & Identity** — Identity providers, OAuth clients, users, and groups browser
- **TLS Compliance** — Node-level TLS scanning across the entire cluster, producing the same data as [openshift/tls-scanner](https://github.com/openshift/tls-scanner). Enumerates every listening port on every pod via `oc debug` node sessions, probes for TLS support, detects cipher suites and TLS versions, and classifies each port (OK, NO_TLS, LOCALHOST_ONLY, FILTERED, MTLS_REQUIRED, etc.). Results are enriched with OpenShift component names derived from container images and pod labels, and filterable by the global namespace selector.
- **Analysis** — PSA compliance checker, cross-namespace access matrix, risk scoring
- **AI Assistant** — Ollama-powered contextual assistant on every resource detail page for questions and modification suggestions
- **Change Staging** — All modifications are previewed before applying; staged changes can be reviewed, edited, or discarded

### Self-Learning Design

Every security field has a hover tooltip explaining what it does:

1. **Glance** — Color-coded cards and badges showing counts and risk levels
2. **Explore** — Interactive visualizations with click-to-expand details
3. **Learn** — Hover any field label's `?` icon for a short explanation; click "What is this?" for the full glossary entry

## TLS Compliance Scanner

The TLS Compliance page provides a GUI equivalent of [openshift/tls-scanner](https://github.com/openshift/tls-scanner), producing the same result schema (`IPResult`, `PortResult`, `OpenshiftComponent`, etc.) and status categories (`OK`, `NO_TLS`, `LOCALHOST_ONLY`, `FILTERED`, `CLOSED`, `MTLS_REQUIRED`, `TIMEOUT`, `ERROR`).

Instead of deploying a scanner Job inside the cluster, the dashboard launches `oc debug node/` sessions to run a bash-based scan script on each node. The script:

1. Enumerates all running containers and their network namespaces via `crictl`
2. Lists listening TCP ports per namespace via `ss`
3. Probes each port with `openssl s_client` for TLS version and cipher support
4. Streams results back as structured JSON

Results are enriched server-side with Kubernetes pod metadata and OpenShift component information using the same approach as the upstream scanner:

- **Primary:** Component name derived from the container image reference (OpenShift release images, Red Hat registries, internal registry)
- **Fallback:** Pod labels (`app`, `component`, `app.kubernetes.io/name`)
- **Last resort:** Container name or image name

Scan results can be exported as JSON, and the global namespace selector filters all views (Overview, Port Results) to a single namespace.

## Security

- Your kubeconfig is processed entirely on your local machine
- It is sent only to the local Next.js server process (localhost) and never transmitted externally
- The AI assistant runs locally via Ollama — no data is sent to cloud APIs
- Secret values are never displayed in the browser — only metadata (names, types, keys, age)

## Architecture

```
Browser (localhost:3000)
  │
  ├── React Frontend (Next.js App Router)
  │     Pages: Dashboard, RBAC, SCCs, Network Policies, Pod Security,
  │            Workloads, Service Accounts, Secrets, Identity, TLS, Analysis
  │
  ├── Next.js API Routes (server-side)
  │     /api/kubeconfig        Upload / parse / switch kubeconfig
  │     /api/cluster            Cluster info
  │     /api/rbac               Roles, ClusterRoles, Bindings
  │     /api/scc                Security Context Constraints
  │     /api/scc-associations   Unified SCC → SA resolution
  │     /api/network-policies   Network policies + topology
  │     /api/pod-security       Pod Security Admission labels
  │     /api/workloads          Deployments, StatefulSets, Pods, etc.
  │     /api/service-accounts   Service accounts + SCC enrichment
  │     /api/secrets            Secret metadata
  │     /api/identity           OAuth / Identity (OpenShift)
  │     /api/analysis           Risk analysis, cross-namespace access
  │     /api/tls-scan            TLS scanning (node-level port + cipher enumeration)
  │     /api/ai/*               Ollama proxy for AI assistant
  │     /api/changes/apply      Apply staged changes to the cluster
  │
  ├── @kubernetes/client-node
  │     └── OpenShift / Kubernetes API Server
  │
  └── Ollama (localhost:11434)
        └── qwen3:32b model (optional)
```

## Project Structure

```
src/
  app/                    Next.js pages and API routes
  components/
    layout/               Sidebar, header, resource navigator
    shared/               FieldLabel, LearnTooltip, ResourceLink, ResourceDetailSheet
    ai/                   Chat panel, AI suggestion renderer
    rbac/                 RBAC graph, matrix, who-can, role/binding detail
    scc/                  SCC comparison, detail, relationships
    network/              Network topology, policy detail, label picker
    workloads/            Workload list, pod detail, security context editor
    service-accounts/     SA detail
    secrets/              Secret detail
    tls/                  TLS scan upload, results table, port detail, summary
    analysis/             PSA compliance, cross-namespace matrix, top risks
    dashboard/            Security score, domain cards
  lib/
    k8s/                  Kubernetes API client, cache, data fetchers, SCC-RBAC resolver, TLS scanner
    risk/                 Risk scoring engine and rules
    glossary.ts           60+ K8s / OpenShift field-level term definitions
  store/                  Zustand state management (cluster, changes)
  types/                  TypeScript type definitions
```

## Tech Stack

- **Next.js 16** (App Router, Turbopack) — Fullstack React framework
- **@kubernetes/client-node** — Official Kubernetes JavaScript client
- **@xyflow/react** (React Flow) — Interactive node-based graph visualization
- **Tailwind CSS 4** + **shadcn/ui** — Modern, accessible UI components
- **Zustand** — Lightweight client-side state management
- **Ollama** — Local LLM inference for AI assistant
- **Lucide React** — Icons

## License

MIT
