import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types";
import { AlertTriangle, AlertCircle, Info, ShieldAlert, ShieldCheck } from "lucide-react";

const riskConfig: Record<RiskLevel, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: {
    label: "Critical",
    className: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
    icon: ShieldAlert,
  },
  high: {
    label: "High",
    className: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
    icon: AlertCircle,
  },
  low: {
    label: "Low",
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
    icon: Info,
  },
  info: {
    label: "Info",
    className: "bg-gray-500/15 text-gray-700 border-gray-500/30 dark:text-gray-400",
    icon: ShieldCheck,
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  className?: string;
}

export function RiskBadge({ level, showIcon = true, className }: RiskBadgeProps) {
  const config = riskConfig[level];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, "gap-1", className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  let colorClass: string;
  if (score >= 80) colorClass = "text-green-600 dark:text-green-400";
  else if (score >= 60) colorClass = "text-yellow-600 dark:text-yellow-400";
  else if (score >= 40) colorClass = "text-orange-600 dark:text-orange-400";
  else colorClass = "text-red-600 dark:text-red-400";

  return (
    <span className={cn("font-bold text-2xl tabular-nums", colorClass, className)}>
      {score}
    </span>
  );
}
