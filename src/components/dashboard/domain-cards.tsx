"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Network, Eye, UserCheck, KeyRound, Fingerprint, ArrowRight } from "lucide-react";

interface DomainStat {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | string;
  countLabel: string;
  score?: number;
  alerts?: number;
}

interface DomainCardsProps {
  stats: DomainStat[];
}

const defaultStats: DomainStat[] = [
  { href: "/rbac", label: "RBAC", icon: Shield, count: "-", countLabel: "Bindings", alerts: 0 },
  { href: "/scc", label: "SCCs", icon: Lock, count: "-", countLabel: "Constraints", alerts: 0 },
  { href: "/network", label: "Network Policies", icon: Network, count: "-", countLabel: "Policies", alerts: 0 },
  { href: "/pod-security", label: "Pod Security", icon: Eye, count: "-", countLabel: "Namespaces", alerts: 0 },
  { href: "/service-accounts", label: "Service Accounts", icon: UserCheck, count: "-", countLabel: "Accounts", alerts: 0 },
  { href: "/secrets", label: "Secrets", icon: KeyRound, count: "-", countLabel: "Secrets", alerts: 0 },
  { href: "/identity", label: "Identity", icon: Fingerprint, count: "-", countLabel: "Providers", alerts: 0 },
];

export function DomainCards({ stats }: DomainCardsProps) {
  const items = stats.length > 0 ? stats : defaultStats;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer group">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  {item.alerts !== undefined && item.alerts > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {item.alerts}
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-bold tabular-nums">{item.count}</div>
                <div className="text-xs text-muted-foreground">{item.countLabel}</div>
                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  {item.label}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export { defaultStats };
export type { DomainStat };
