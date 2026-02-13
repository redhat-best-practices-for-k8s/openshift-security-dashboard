"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SecretDetail } from "@/components/secrets/secret-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateSecretWizard } from "@/components/wizards/create-secret-wizard";
import type { SecretInfo } from "@/types";
import { KeyRound, Search, Lock, ShieldAlert, FileKey, Clock, Plus } from "lucide-react";

const secretTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "Opaque": { label: "Opaque", icon: <Lock className="h-3.5 w-3.5" />, color: "bg-gray-500/10 text-gray-700" },
  "kubernetes.io/tls": { label: "TLS", icon: <ShieldAlert className="h-3.5 w-3.5" />, color: "bg-blue-500/10 text-blue-700" },
  "kubernetes.io/dockerconfigjson": { label: "Docker Config", icon: <FileKey className="h-3.5 w-3.5" />, color: "bg-purple-500/10 text-purple-700" },
  "kubernetes.io/service-account-token": { label: "SA Token", icon: <KeyRound className="h-3.5 w-3.5" />, color: "bg-teal-500/10 text-teal-700" },
  "kubernetes.io/dockercfg": { label: "Docker Cfg", icon: <FileKey className="h-3.5 w-3.5" />, color: "bg-purple-500/10 text-purple-700" },
  "kubernetes.io/basic-auth": { label: "Basic Auth", icon: <Lock className="h-3.5 w-3.5" />, color: "bg-yellow-500/10 text-yellow-700" },
  "kubernetes.io/ssh-auth": { label: "SSH Auth", icon: <Lock className="h-3.5 w-3.5" />, color: "bg-orange-500/10 text-orange-700" },
};

function getSecretTypeInfo(type: string) {
  return secretTypeLabels[type] || { label: type, icon: <Lock className="h-3.5 w-3.5" />, color: "bg-gray-500/10 text-gray-700" };
}

function daysSince(timestamp?: string): number | null {
  if (!timestamp) return null;
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
}

export default function SecretsPage() {
  return (
    <Suspense>
      <SecretsPageInner />
    </Suspense>
  );
}

function SecretsPageInner() {
  const { kubeconfigLoaded, selectedNamespace } = useClusterStore();
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [showCreateSecret, setShowCreateSecret] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<SecretInfo | null>(null);
  const searchParams = useSearchParams();
  const openConsumed = useRef(false);

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const ns = selectedNamespace ? `?namespace=${encodeURIComponent(selectedNamespace)}` : "";
        const res = await fetch(`/api/secrets${ns}`);
        const json = await res.json();
        if (Array.isArray(json)) setSecrets(json);
      } catch (error) {
        console.error("Failed to fetch secrets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [kubeconfigLoaded, selectedNamespace]);

  // Auto-open from ?open= param (once only)
  useEffect(() => {
    if (openConsumed.current) return;
    const openName = searchParams.get("open");
    const openNs = searchParams.get("ns");
    if (openName && secrets.length > 0) {
      const match = secrets.find((s) => s.name === openName && (!openNs || s.namespace === openNs));
      if (match) { setSelectedSecret(match); openConsumed.current = true; }
    }
  }, [searchParams, secrets]);

  if (!kubeconfigLoaded) {
    return (
      <EmptyState
        icon={<KeyRound className="h-12 w-12" />}
        title="No cluster connected"
        description="Upload a kubeconfig file on the dashboard page to get started."
      />
    );
  }

  const filtered = secrets.filter((s) => {
    if (!filter) return true;
    const lower = filter.toLowerCase();
    return s.name.toLowerCase().includes(lower) || s.namespace.toLowerCase().includes(lower) || s.type.toLowerCase().includes(lower);
  });

  // Group by type
  const byType = secrets.reduce<Record<string, SecretInfo[]>>((acc, s) => {
    const key = s.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const oldSecrets = secrets.filter((s) => {
    const days = daysSince(s.creationTimestamp);
    return days !== null && days > 365;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secrets Overview"
        description="Cluster secrets metadata (values are never displayed)"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{secrets.length} secrets</Badge>
          <Badge variant="secondary">{Object.keys(byType).length} types</Badge>
          {oldSecrets.length > 0 && (
            <Badge variant="outline" className="gap-1 text-yellow-700">
              <Clock className="h-3 w-3" />
              {oldSecrets.length} older than 1 year
            </Badge>
          )}
          <Button size="sm" onClick={() => setShowCreateSecret(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Create Secret</Button>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <Lock className="h-4 w-4 inline mr-1" />
        For security, only secret metadata is shown here - names, types, keys, and age. 
        <strong> Secret values are never displayed or transmitted to the browser.</strong>
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[500px]" />
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({secrets.length})</TabsTrigger>
            {Object.entries(byType).slice(0, 5).map(([type, items]) => {
              const info = getSecretTypeInfo(type);
              return (
                <TabsTrigger key={type} value={type} className="gap-1">
                  {info.icon}
                  {info.label} ({items.length})
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="mb-3 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Filter secrets..." className="pl-8 h-8 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Namespace</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Keys</TableHead>
                        <TableHead className="text-xs">Age</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 200).map((secret) => {
                        const info = getSecretTypeInfo(secret.type);
                        const days = daysSince(secret.creationTimestamp);
                        const isOld = days !== null && days > 365;
                        return (
                          <TableRow key={`${secret.namespace}/${secret.name}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedSecret(secret)}>
                            <TableCell className="font-medium text-sm">{secret.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{secret.namespace}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] gap-1 ${info.color}`}>
                                {info.icon}
                                {info.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {secret.keys.length > 0 ? secret.keys.join(", ") : "empty"}
                            </TableCell>
                            <TableCell className={`text-xs ${isOld ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                              {days !== null ? `${days}d` : "—"}
                              {isOld && <Clock className="h-3 w-3 inline ml-1" />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          {Object.entries(byType).slice(0, 5).map(([type, items]) => (
            <TabsContent key={type} value={type} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{getSecretTypeInfo(type).label} Secrets</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {items.map((secret) => (
                        <div key={`${secret.namespace}/${secret.name}`} className="p-3 rounded-lg border text-xs cursor-pointer hover:bg-muted/50" onClick={() => setSelectedSecret(secret)}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{secret.name}</span>
                            <Badge variant="outline" className="text-[10px]">{secret.namespace}</Badge>
                          </div>
                          <div className="text-muted-foreground">
                            Keys: {secret.keys.join(", ") || "empty"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <CreateSecretWizard open={showCreateSecret} onClose={() => setShowCreateSecret(false)} />
      <SecretDetail secret={selectedSecret} onClose={() => setSelectedSecret(null)} />
    </div>
  );
}
