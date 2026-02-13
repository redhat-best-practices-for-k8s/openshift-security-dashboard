"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBadge } from "@/components/shared/risk-badge";
import type { SecurityScore } from "@/types";

interface SecurityScoreCardProps {
  score: SecurityScore | null;
  loading?: boolean;
}

export function SecurityScoreCard({ score, loading }: SecurityScoreCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Security Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center">
            <div className="animate-pulse bg-muted rounded h-10 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!score) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Security Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <ScoreBadge score={score.overall} />
          <span className="text-sm text-muted-foreground mb-1">/ 100</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {Object.entries(score.domains).map(([domain, value]) => (
            <div key={domain} className="text-center">
              <div className="text-xs text-muted-foreground capitalize">{domain.replace(/([A-Z])/g, " $1").trim()}</div>
              <div className={`text-sm font-semibold tabular-nums ${
                value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : value >= 40 ? "text-orange-600" : "text-red-600"
              }`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
