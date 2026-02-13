"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResourceLink, parseResourceString } from "@/components/shared/resource-link";
import type { RiskFinding, RiskLevel } from "@/types";
import { AlertTriangle, ShieldAlert, Shield, Info, Search, Sparkles, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const levelConfig: Record<RiskLevel, { icon: React.ReactNode; color: string; label: string }> = {
  critical: { icon: <ShieldAlert className="h-3.5 w-3.5" />, color: "bg-red-500/15 text-red-700 border-red-500/30", label: "Critical" },
  high: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-orange-500/15 text-orange-700 border-orange-500/30", label: "High" },
  medium: { icon: <Shield className="h-3.5 w-3.5" />, color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", label: "Medium" },
  low: { icon: <Info className="h-3.5 w-3.5" />, color: "bg-blue-500/15 text-blue-700 border-blue-500/30", label: "Low" },
  info: { icon: <Info className="h-3.5 w-3.5" />, color: "bg-gray-500/15 text-gray-700 border-gray-500/30", label: "Info" },
};

interface RiskAnalysisPanelProps {
  findings: RiskFinding[];
  onFixWithAI?: (finding: RiskFinding) => void;
}

export function RiskAnalysisPanel({ findings, onFixWithAI }: RiskAnalysisPanelProps) {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (levelFilter !== "all" && f.level !== levelFilter) return false;
      if (domainFilter !== "all" && f.domain !== domainFilter) return false;
      if (filter) {
        const q = filter.toLowerCase();
        return f.title.toLowerCase().includes(q) || f.resource.toLowerCase().includes(q) || (f.namespace || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [findings, filter, levelFilter, domainFilter]);

  const grouped = useMemo(() => {
    const groups: Record<RiskLevel, RiskFinding[]> = { critical: [], high: [], medium: [], low: [], info: [] };
    for (const f of filtered) groups[f.level].push(f);
    return groups;
  }, [filtered]);

  const domains = useMemo(() => [...new Set(findings.map((f) => f.domain))], [findings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search findings..." className="pl-9 h-9 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="All Levels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Levels</SelectItem>
            <SelectItem value="critical" className="text-xs">Critical</SelectItem>
            <SelectItem value="high" className="text-xs">High</SelectItem>
            <SelectItem value="medium" className="text-xs">Medium</SelectItem>
            <SelectItem value="low" className="text-xs">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="All Domains" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Domains</SelectItem>
            {domains.map((d) => <SelectItem key={d} value={d} className="text-xs capitalize">{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 text-xs">
        {(["critical", "high", "medium", "low"] as RiskLevel[]).map((level) => {
          const count = findings.filter((f) => f.level === level).length;
          if (count === 0) return null;
          const cfg = levelConfig[level];
          return <Badge key={level} variant="outline" className={`${cfg.color} text-[10px] gap-1`}>{cfg.icon}{count} {cfg.label}</Badge>;
        })}
        <Badge variant="outline" className="text-[10px]">{filtered.length} shown</Badge>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {(["critical", "high", "medium", "low", "info"] as RiskLevel[]).map((level) => {
            const items = grouped[level];
            if (items.length === 0) return null;
            const cfg = levelConfig[level];
            return (
              <Collapsible key={level} defaultOpen={level === "critical" || level === "high"}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-muted/50">
                  <ChevronDown className="h-4 w-4 transition-transform" />
                  <Badge variant="outline" className={`${cfg.color} text-[10px] gap-1`}>{cfg.icon}{cfg.label}</Badge>
                  <span className="text-xs text-muted-foreground">({items.length} findings)</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {items.map((finding) => (
                    <Card key={finding.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[9px] capitalize">{finding.domain}</Badge>
                              {finding.namespace && <Badge variant="outline" className="text-[9px]">{finding.namespace}</Badge>}
                            </div>
                            <p className="text-xs font-medium">{finding.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{finding.description}</p>
                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                              Resource: {(() => {
                                const parsed = parseResourceString(finding.resource);
                                return parsed ? (
                                  <ResourceLink kind={parsed.kind} name={parsed.name} namespace={parsed.namespace} />
                                ) : (
                                  <span>{finding.resource}</span>
                                );
                              })()}
                            </div>
                            <div className="mt-2 p-2 rounded bg-muted/50 text-[10px]">
                              <strong>Recommendation:</strong> {finding.recommendation}
                            </div>
                          </div>
                          {onFixWithAI && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 shrink-0" onClick={() => onFixWithAI(finding)}>
                              <Sparkles className="h-3 w-3" /> Fix
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
