"use client";

import { useEffect, useState } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { KubeconfigUpload } from "@/components/dashboard/kubeconfig-upload";
import { ClusterInfoBar } from "@/components/dashboard/cluster-info";
import { SecurityScoreCard } from "@/components/dashboard/security-score";
import { TopRisks } from "@/components/dashboard/top-risks";
import { DomainCards } from "@/components/dashboard/domain-cards";
import type { ClusterInfo, SecurityScore, RiskFinding } from "@/types";
import type { DomainStat } from "@/components/dashboard/domain-cards";
import { Shield, Lock, Network, Eye, UserCheck, KeyRound, Fingerprint } from "lucide-react";
import { calculateSecurityScore } from "@/lib/risk/scoring";
import {
  analyzeRBACRisks,
  analyzeSCCRisks,
  analyzeNetworkRisks,
  analyzePodSecurityRisks,
  analyzeServiceAccountRisks,
  analyzeSecretRisks,
} from "@/lib/risk/rules";

export default function DashboardPage() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [domainStats, setDomainStats] = useState<DomainStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";

        const [clusterRes, rbacRes, sccRes, netpolRes, psaRes, saRes, secretsRes] = await Promise.all([
          fetch("/api/cluster").then((r) => r.json()),
          fetch(`/api/rbac${ns}`).then((r) => r.json()),
          fetch("/api/scc").then((r) => r.json()),
          fetch(`/api/network-policies${ns}`).then((r) => r.json()),
          fetch("/api/pod-security").then((r) => r.json()),
          fetch(`/api/service-accounts${ns}`).then((r) => r.json()),
          fetch(`/api/secrets${ns}`).then((r) => r.json()),
        ]);

        if (!clusterRes.error) setClusterInfo(clusterRes);

        // Calculate risk
        const allFindings: RiskFinding[] = [];
        if (!rbacRes.error) allFindings.push(...analyzeRBACRisks(rbacRes));
        if (Array.isArray(sccRes)) allFindings.push(...analyzeSCCRisks(sccRes));
        if (Array.isArray(netpolRes)) {
          const namespaces = (psaRes || []).map((n: { namespace: string }) => n.namespace);
          allFindings.push(...analyzeNetworkRisks(netpolRes, namespaces));
        }
        if (Array.isArray(psaRes)) allFindings.push(...analyzePodSecurityRisks(psaRes));
        if (Array.isArray(saRes)) allFindings.push(...analyzeServiceAccountRisks(saRes));
        if (Array.isArray(secretsRes)) allFindings.push(...analyzeSecretRisks(secretsRes));

        const secScore = calculateSecurityScore(allFindings);
        setScore(secScore);

        // Build domain stats
        const findingsByDomain = (domain: string) =>
          allFindings.filter((f) => f.domain === domain).filter((f) => f.level === "critical" || f.level === "high").length;

        const stats: DomainStat[] = [
          { href: "/rbac", label: "RBAC", icon: Shield, count: (rbacRes.roleBindings?.length || 0) + (rbacRes.clusterRoleBindings?.length || 0), countLabel: "Bindings", alerts: findingsByDomain("rbac") },
          { href: "/scc", label: "SCCs", icon: Lock, count: Array.isArray(sccRes) ? sccRes.length : 0, countLabel: "Constraints", alerts: findingsByDomain("scc") },
          { href: "/network", label: "Network Policies", icon: Network, count: Array.isArray(netpolRes) ? netpolRes.length : 0, countLabel: "Policies", alerts: findingsByDomain("network") },
          { href: "/pod-security", label: "Pod Security", icon: Eye, count: Array.isArray(psaRes) ? psaRes.length : 0, countLabel: "Namespaces", alerts: findingsByDomain("pod-security") },
          { href: "/service-accounts", label: "Service Accounts", icon: UserCheck, count: Array.isArray(saRes) ? saRes.length : 0, countLabel: "Accounts", alerts: findingsByDomain("service-accounts") },
          { href: "/secrets", label: "Secrets", icon: KeyRound, count: Array.isArray(secretsRes) ? secretsRes.length : 0, countLabel: "Secrets", alerts: findingsByDomain("secrets") },
          { href: "/identity", label: "Identity", icon: Fingerprint, count: "-", countLabel: "Providers", alerts: findingsByDomain("identity") },
        ];
        setDomainStats(stats);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [kubeconfigLoaded, selectedNamespace]);

  if (!kubeconfigLoaded) {
    return <KubeconfigUpload />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive security posture analysis of your cluster
        </p>
      </div>

      <ClusterInfoBar info={clusterInfo} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SecurityScoreCard score={score} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <TopRisks findings={score?.findings || []} loading={loading} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Security Domains</h2>
        <DomainCards stats={domainStats} />
      </div>
    </div>
  );
}
