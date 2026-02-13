import { NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getIdentityProviders, getOAuthClients, getUsers, getGroups } from "@/lib/k8s/identity";

export async function GET() {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const [identityProviders, oauthClients, users, groups] = await Promise.all([
      getIdentityProviders(),
      getOAuthClients(),
      getUsers(),
      getGroups(),
    ]);

    return NextResponse.json({ identityProviders, oauthClients, users, groups });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch identity data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
