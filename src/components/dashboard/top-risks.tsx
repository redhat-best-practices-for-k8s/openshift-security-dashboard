"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/shared/risk-badge";
import { ResourceLink, parseResourceString } from "@/components/shared/resource-link";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RiskFinding } from "@/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Lightbulb } from "lucide-react";

interface TopRisksProps {
  findings: RiskFinding[];
  loading?: boolean;
}

export function TopRisks({ findings, loading }: TopRisksProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Top Risks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted rounded h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Deduplicate findings by id to prevent React key collisions
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  const top = unique.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Top Risks</CardTitle>
          <span className="text-xs text-muted-foreground">{findings.length} total findings</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] pr-3">
          {top.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No risks detected. Your cluster looks secure!
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {top.map((finding, i) => (
                <AccordionItem key={finding.id} value={finding.id}>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <RiskBadge level={finding.level} />
                      <span className="text-sm font-medium">{finding.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pl-1">
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                        Resource: {(() => {
                          const parsed = parseResourceString(finding.resource);
                          return parsed ? (
                            <ResourceLink kind={parsed.kind} name={parsed.name} namespace={parsed.namespace} />
                          ) : (
                            <code className="bg-muted px-1.5 py-0.5 rounded">{finding.resource}</code>
                          );
                        })()}
                      </div>
                      <div className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/10">
                        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs">{finding.recommendation}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
