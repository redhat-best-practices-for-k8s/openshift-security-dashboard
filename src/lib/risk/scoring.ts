import type { RiskFinding, SecurityScore, RiskLevel } from "@/types";

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

function calculateDomainScore(findings: RiskFinding[]): number {
  if (findings.length === 0) return 100;
  
  const totalPenalty = findings.reduce(
    (sum, f) => sum + RISK_WEIGHTS[f.level],
    0
  );
  
  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

export function calculateSecurityScore(findings: RiskFinding[]): SecurityScore {
  const domainFindings: Record<string, RiskFinding[]> = {
    rbac: [],
    scc: [],
    network: [],
    "pod-security": [],
    "service-accounts": [],
    secrets: [],
    identity: [],
    workloads: [],
  };

  for (const f of findings) {
    if (domainFindings[f.domain]) {
      domainFindings[f.domain].push(f);
    }
  }

  const domains = {
    rbac: calculateDomainScore(domainFindings.rbac),
    scc: calculateDomainScore(domainFindings.scc),
    network: calculateDomainScore(domainFindings.network),
    podSecurity: calculateDomainScore(domainFindings["pod-security"]),
    serviceAccounts: calculateDomainScore(domainFindings["service-accounts"]),
    secrets: calculateDomainScore(domainFindings.secrets),
    identity: calculateDomainScore(domainFindings.identity),
    workloads: calculateDomainScore(domainFindings.workloads),
  };

  const overall = Math.round(
    Object.values(domains).reduce((a, b) => a + b, 0) / Object.keys(domains).length
  );

  // Sort findings by severity
  const sortedFindings = [...findings].sort((a, b) => {
    const order: RiskLevel[] = ["critical", "high", "medium", "low", "info"];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });

  return { overall, domains, findings: sortedFindings };
}
