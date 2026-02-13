"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldLabel } from "@/components/shared/field-label";
import type { SecurityContextConstraint } from "@/types";
import { Shield, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function RiskIndicator({ safe, label }: { safe: boolean; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {safe ? (
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
      ) : (
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
      )}
      <span className="text-xs">{label}</span>
    </div>
  );
}

function SCCCard({ scc, expanded, onToggle, onEdit }: { scc: SecurityContextConstraint; expanded: boolean; onToggle: () => void; onEdit: () => void }) {
  const dangerCount = [
    scc.allowPrivilegedContainer,
    scc.allowHostNetwork,
    scc.allowHostPID,
    scc.allowHostIPC,
    scc.allowHostDirVolumePlugin,
    scc.runAsUser.type === "RunAsAny",
    scc.allowedCapabilities.includes("*") || scc.allowedCapabilities.includes("ALL"),
    scc.allowPrivilegeEscalation,
  ].filter(Boolean).length;

  const riskLevel = dangerCount >= 5 ? "critical" : dangerCount >= 3 ? "high" : dangerCount >= 1 ? "medium" : "low";
  const riskColors = { critical: "border-red-500/50 bg-red-500/5", high: "border-orange-500/50 bg-orange-500/5", medium: "border-yellow-500/50 bg-yellow-500/5", low: "border-green-500/50 bg-green-500/5" };

  return (
    <Card className={`${riskColors[riskLevel]} transition-all`}>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dangerCount >= 3 ? (
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                ) : dangerCount > 0 ? (
                  <Shield className="h-4 w-4 text-yellow-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                )}
                <CardTitle className="text-sm">{scc.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {scc.priority !== null && (
                  <Badge variant="outline" className="text-[10px]">Priority: {scc.priority}</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {dangerCount} risk{dangerCount !== 1 ? "s" : ""}
                </Badge>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <RiskIndicator safe={!scc.allowPrivilegedContainer} label={<><FieldLabel term="AllowPrivilegedContainer">Privileged</FieldLabel>: {scc.allowPrivilegedContainer ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={!scc.allowPrivilegeEscalation} label={<><FieldLabel term="AllowPrivilegeEscalation">Escalation</FieldLabel>: {scc.allowPrivilegeEscalation ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={!scc.allowHostNetwork} label={<><FieldLabel term="AllowHostNetwork">Host Network</FieldLabel>: {scc.allowHostNetwork ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={!scc.allowHostPID} label={<><FieldLabel term="AllowHostPID">Host PID</FieldLabel>: {scc.allowHostPID ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={!scc.allowHostIPC} label={<><FieldLabel term="AllowHostIPC">Host IPC</FieldLabel>: {scc.allowHostIPC ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={!scc.allowHostDirVolumePlugin} label={<><FieldLabel term="AllowHostDirVolumes">Host Dirs</FieldLabel>: {scc.allowHostDirVolumePlugin ? "Allowed" : "Denied"}</>} />
              <RiskIndicator safe={scc.readOnlyRootFilesystem} label={<><FieldLabel term="ReadOnlyRootFS">Root FS</FieldLabel>: {scc.readOnlyRootFilesystem ? "Read-Only" : "Writable"}</>} />
              <RiskIndicator safe={scc.runAsUser.type !== "RunAsAny"} label={<><FieldLabel term="RunAsUser">RunAsUser</FieldLabel>: {scc.runAsUser.type}</>} />
            </div>

            {scc.requiredDropCapabilities.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground"><FieldLabel term="RequiredDropCapabilities">Dropped capabilities</FieldLabel>:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {scc.requiredDropCapabilities.map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">{cap}</Badge>
                  ))}
                </div>
              </div>
            )}

            {scc.allowedCapabilities.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground"><FieldLabel term="AllowedCapabilities">Allowed capabilities</FieldLabel>:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {scc.allowedCapabilities.map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-[10px] bg-red-500/10 text-red-700">{cap}</Badge>
                  ))}
                </div>
              </div>
            )}

            {scc.users.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground"><FieldLabel term="SCCUsers">Assigned users</FieldLabel>:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {scc.users.slice(0, 10).map((u) => (
                    <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
                  ))}
                  {scc.users.length > 10 && <Badge variant="outline" className="text-[10px]">+{scc.users.length - 10} more</Badge>}
                </div>
              </div>
            )}

            <div>
              <span className="text-xs text-muted-foreground"><FieldLabel term="AllowedVolumes">Volumes</FieldLabel>: </span>
              <span className="text-xs">{scc.volumes.join(", ") || "none"}</span>
            </div>

            <Button variant="outline" size="sm" className="gap-1 text-xs mt-2" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3" /> Edit SCC
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface SCCComparisonProps {
  sccs: SecurityContextConstraint[];
  onEdit?: (scc: SecurityContextConstraint) => void;
}

export function SCCComparison({ sccs, onEdit }: SCCComparisonProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (name: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const sorted = [...sccs].sort((a, b) => {
    const aRisk = [a.allowPrivilegedContainer, a.allowHostNetwork, a.allowHostPID].filter(Boolean).length;
    const bRisk = [b.allowPrivilegedContainer, b.allowHostNetwork, b.allowHostPID].filter(Boolean).length;
    return bRisk - aRisk;
  });

  return (
    <ScrollArea className="h-[700px] pr-3">
      <div className="space-y-3">
        {sorted.map((scc) => (
          <SCCCard
            key={scc.name}
            scc={scc}
            expanded={expandedCards.has(scc.name)}
            onToggle={() => toggleCard(scc.name)}
            onEdit={() => onEdit?.(scc)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
