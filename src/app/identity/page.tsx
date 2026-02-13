"use client";

import { useEffect, useState } from "react";
import { useClusterStore } from "@/store/cluster-store";
import { PageHeader } from "@/components/shared/page-header";
import { LearnTooltip } from "@/components/shared/learn-tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { IdentityProvider, OAuthClient, UserInfo, GroupInfo } from "@/types";
import { Fingerprint, Key, Users, UserCog, Search, Globe, Shield } from "lucide-react";

interface IdentityData {
  identityProviders: IdentityProvider[];
  oauthClients: OAuthClient[];
  users: UserInfo[];
  groups: GroupInfo[];
}

export default function IdentityPage() {
  const { kubeconfigLoaded } = useClusterStore();
  const [data, setData] = useState<IdentityData>({ identityProviders: [], oauthClients: [], users: [], groups: [] });
  const [loading, setLoading] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    if (!kubeconfigLoaded) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/identity");
        const json = await res.json();
        if (!json.error) setData(json);
      } catch (error) {
        console.error("Failed to fetch identity data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [kubeconfigLoaded]);

  if (!kubeconfigLoaded) {
    return (
      <EmptyState
        icon={<Fingerprint className="h-12 w-12" />}
        title="No cluster connected"
        description="Upload a kubeconfig file on the dashboard page to get started."
      />
    );
  }

  const filteredUsers = data.users.filter((u) => {
    if (!userFilter) return true;
    const lower = userFilter.toLowerCase();
    return u.name.toLowerCase().includes(lower) || u.fullName?.toLowerCase().includes(lower);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth & Identity"
        description="Authentication providers, users, and groups"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data.identityProviders.length} IDPs</Badge>
          <Badge variant="secondary">{data.users.length} Users</Badge>
          <Badge variant="secondary">{data.groups.length} Groups</Badge>
        </div>
      </PageHeader>

      <div className="p-3 rounded-lg bg-muted/50 text-sm">
        <LearnTooltip term="IdentityProvider">Identity Providers</LearnTooltip> verify who users are, while 
        <LearnTooltip term="OAuthClient"> OAuth Clients</LearnTooltip> allow applications to authenticate 
        against the cluster. Users and groups link to RBAC for authorization.
        {data.identityProviders.length === 0 && data.users.length === 0 && (
          <span className="block mt-1 text-muted-foreground italic">
            (OpenShift identity APIs not available - this may be a standard Kubernetes cluster)
          </span>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-lg h-[500px]" />
      ) : (
        <Tabs defaultValue="idp">
          <TabsList>
            <TabsTrigger value="idp" className="gap-2">
              <Globe className="h-3.5 w-3.5" />
              Providers ({data.identityProviders.length})
            </TabsTrigger>
            <TabsTrigger value="oauth" className="gap-2">
              <Key className="h-3.5 w-3.5" />
              OAuth Clients ({data.oauthClients.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Users ({data.users.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <UserCog className="h-3.5 w-3.5" />
              Groups ({data.groups.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="idp" className="mt-4">
            {data.identityProviders.length === 0 ? (
              <EmptyState
                icon={<Globe className="h-12 w-12" />}
                title="No Identity Providers found"
                description="This cluster may not be OpenShift, or no IDPs are configured."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.identityProviders.map((idp) => (
                  <Card key={idp.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        {idp.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <Badge variant="secondary" className="text-[10px]">{idp.type}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mapping Method</span>
                          <span>{idp.mappingMethod}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="oauth" className="mt-4">
            {data.oauthClients.length === 0 ? (
              <EmptyState
                icon={<Key className="h-12 w-12" />}
                title="No OAuth Clients found"
                description="No OAuth clients registered in this cluster."
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Grant Method</TableHead>
                          <TableHead className="text-xs">Redirect URIs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.oauthClients.map((client) => (
                          <TableRow key={client.name}>
                            <TableCell className="font-medium text-sm">{client.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{client.grantMethod}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {client.redirectURIs.slice(0, 2).join(", ")}
                              {client.redirectURIs.length > 2 && ` +${client.redirectURIs.length - 2} more`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="mb-3 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search users..." className="pl-8 h-8 text-xs" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
                </div>
                <ScrollArea className="h-[400px]">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {data.users.length === 0 ? "No users found (may not be an OpenShift cluster)." : "No matching users."}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Username</TableHead>
                          <TableHead className="text-xs">Full Name</TableHead>
                          <TableHead className="text-xs">Groups</TableHead>
                          <TableHead className="text-xs">Identities</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.slice(0, 200).map((user) => (
                          <TableRow key={user.name}>
                            <TableCell className="font-medium text-sm">{user.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{user.fullName || "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.groups.map((g) => (
                                  <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                                ))}
                                {user.groups.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {user.identities.join(", ") || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            {data.groups.length === 0 ? (
              <EmptyState
                icon={<UserCog className="h-12 w-12" />}
                title="No Groups found"
                description="No groups configured in this cluster."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.groups.map((group) => (
                  <Card key={group.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {group.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground mb-2">
                        {group.users.length} member{group.users.length !== 1 ? "s" : ""}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.users.slice(0, 10).map((u) => (
                          <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
                        ))}
                        {group.users.length > 10 && (
                          <Badge variant="outline" className="text-[10px]">+{group.users.length - 10} more</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
