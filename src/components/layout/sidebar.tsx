"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Shield,
  Network,
  Users,
  KeyRound,
  Lock,
  Eye,
  LayoutDashboard,
  UserCheck,
  Fingerprint,
  Container,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, description: "Security overview" },
  { href: "/workloads", label: "Workloads", icon: Container, description: "Pods & deployments" },
  { href: "/analysis", label: "Analysis", icon: ScanSearch, description: "Deep security scan" },
  { href: "/rbac", label: "RBAC", icon: Shield, description: "Roles & permissions" },
  { href: "/scc", label: "SCCs", icon: Lock, description: "Security constraints" },
  { href: "/network", label: "Network Policies", icon: Network, description: "Traffic rules" },
  { href: "/pod-security", label: "Pod Security", icon: Eye, description: "Admission control" },
  { href: "/service-accounts", label: "Service Accounts", icon: UserCheck, description: "Application identities" },
  { href: "/secrets", label: "Secrets", icon: KeyRound, description: "Credentials & certs" },
  { href: "/tls", label: "TLS Compliance", icon: ShieldCheck, description: "TLS scan results" },
  { href: "/identity", label: "Identity", icon: Fingerprint, description: "Users & auth" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-sm font-bold leading-tight">OpenShift</h1>
          <p className="text-xs text-muted-foreground leading-tight">Security Dashboard</p>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{item.label}</div>
                {!isActive && (
                  <div className="text-xs opacity-60 truncate">{item.description}</div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
