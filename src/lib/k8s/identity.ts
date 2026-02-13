import { getCustomObjectsApi } from "./client";
import { apiCache } from "./cache";
import type { IdentityProvider, OAuthClient, UserInfo, GroupInfo } from "@/types";

export async function getIdentityProviders(): Promise<IdentityProvider[]> {
  const cacheKey = "identityProviders";
  const cached = apiCache.get<IdentityProvider[]>(cacheKey);
  if (cached) return cached;

  try {
    const api = getCustomObjectsApi();
    const res = await api.getClusterCustomObject({
      group: "config.openshift.io",
      version: "v1",
      plural: "oauths",
      name: "cluster",
    });
    const body = res as Record<string, unknown>;
    const spec = (body.spec || {}) as Record<string, unknown>;
    const idps = (spec.identityProviders || []) as Record<string, unknown>[];
    
    const providers: IdentityProvider[] = idps.map((idp) => ({
      name: (idp.name as string) || "",
      type: (idp.type as string) || "Unknown",
      mappingMethod: (idp.mappingMethod as string) || "claim",
      challenge: idp.challenge as boolean | undefined,
      login: idp.login as boolean | undefined,
    }));

    apiCache.set(cacheKey, providers);
    return providers;
  } catch {
    return [];
  }
}

export async function getOAuthClients(): Promise<OAuthClient[]> {
  const cacheKey = "oauthClients";
  const cached = apiCache.get<OAuthClient[]>(cacheKey);
  if (cached) return cached;

  try {
    const api = getCustomObjectsApi();
    const res = await api.listClusterCustomObject({
      group: "oauth.openshift.io",
      version: "v1",
      plural: "oauthclients",
    });
    const body = res as { items?: Record<string, unknown>[] };
    const items = body.items || [];

    const clients: OAuthClient[] = items.map((item) => {
      const metadata = (item.metadata || {}) as Record<string, unknown>;
      return {
        name: (metadata.name as string) || "",
        redirectURIs: (item.redirectURIs as string[]) || [],
        grantMethod: (item.grantMethod as string) || "auto",
        creationTimestamp: metadata.creationTimestamp as string | undefined,
      };
    });

    apiCache.set(cacheKey, clients);
    return clients;
  } catch {
    return [];
  }
}

export async function getUsers(): Promise<UserInfo[]> {
  const cacheKey = "users";
  const cached = apiCache.get<UserInfo[]>(cacheKey);
  if (cached) return cached;

  try {
    const api = getCustomObjectsApi();
    const res = await api.listClusterCustomObject({
      group: "user.openshift.io",
      version: "v1",
      plural: "users",
    });
    const body = res as { items?: Record<string, unknown>[] };
    const items = body.items || [];

    const users: UserInfo[] = items.map((item) => {
      const metadata = (item.metadata || {}) as Record<string, unknown>;
      return {
        name: (metadata.name as string) || "",
        fullName: item.fullName as string | undefined,
        groups: (item.groups as string[]) || [],
        identities: (item.identities as string[]) || [],
      };
    });

    apiCache.set(cacheKey, users);
    return users;
  } catch {
    return [];
  }
}

export async function getGroups(): Promise<GroupInfo[]> {
  const cacheKey = "groups";
  const cached = apiCache.get<GroupInfo[]>(cacheKey);
  if (cached) return cached;

  try {
    const api = getCustomObjectsApi();
    const res = await api.listClusterCustomObject({
      group: "user.openshift.io",
      version: "v1",
      plural: "groups",
    });
    const body = res as { items?: Record<string, unknown>[] };
    const items = body.items || [];

    const groups: GroupInfo[] = items.map((item) => {
      const metadata = (item.metadata || {}) as Record<string, unknown>;
      return {
        name: (metadata.name as string) || "",
        users: (item.users as string[]) || [],
      };
    });

    apiCache.set(cacheKey, groups);
    return groups;
  } catch {
    return [];
  }
}
