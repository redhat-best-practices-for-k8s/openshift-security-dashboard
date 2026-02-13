import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getNetworkPolicies } from "@/lib/k8s/network";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;

  try {
    const policies = await getNetworkPolicies(namespace);
    return NextResponse.json(policies);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch network policies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
