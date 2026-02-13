"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RBACData } from "@/types";
import { Search, Users } from "lucide-react";

interface WhoCanQueryProps {
  data: RBACData;
}

interface Result {
  subject: string;
  kind: string;
  namespace?: string;
  viaRole: string;
  viaBinding: string;
}

export function WhoCanQuery({ data }: WhoCanQueryProps) {
  const [resource, setResource] = useState("");
  const [verb, setVerb] = useState("");

  const results = useMemo((): Result[] => {
    if (!resource && !verb) return [];

    const allRoles = [...data.roles, ...data.clusterRoles];
    const roleMap = new Map(allRoles.map((r) => [`${r.kind}:${r.name}`, r]));
    const allBindings = [...data.roleBindings, ...data.clusterRoleBindings];
    const found: Result[] = [];

    for (const binding of allBindings) {
      const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
      const role = roleMap.get(roleKey);
      if (!role) continue;

      const hasPermission = role.rules.some((rule) => {
        const matchResource = !resource || rule.resources.includes(resource) || rule.resources.includes("*");
        const matchVerb = !verb || rule.verbs.includes(verb) || rule.verbs.includes("*");
        return matchResource && matchVerb;
      });

      if (hasPermission) {
        for (const subject of binding.subjects) {
          found.push({
            subject: subject.name,
            kind: subject.kind,
            namespace: subject.namespace || binding.namespace,
            viaRole: `${role.kind}/${role.name}`,
            viaBinding: `${binding.kind}/${binding.name}`,
          });
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return found.filter((r) => {
      const key = `${r.kind}:${r.namespace}:${r.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data, resource, verb]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Search className="h-4 w-4" />
          Who Can?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs">Resource</Label>
            <Input
              placeholder="e.g., pods, secrets, deployments"
              className="h-8 text-xs mt-1"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Verb</Label>
            <Input
              placeholder="e.g., get, create, delete"
              className="h-8 text-xs mt-1"
              value={verb}
              onChange={(e) => setVerb(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {resource || verb ? "No matching subjects found." : "Enter a resource and/or verb to search."}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5 inline mr-1" />
                {results.length} subject(s) can {verb || "*"} {resource || "*"}
              </p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{r.kind}</Badge>
                    <span className="font-medium">{r.subject}</span>
                    {r.namespace && <span className="text-muted-foreground">({r.namespace})</span>}
                  </div>
                  <span className="text-muted-foreground text-[10px]">via {r.viaRole}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
