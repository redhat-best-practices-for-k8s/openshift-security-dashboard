import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getSecrets } from "@/lib/k8s/secrets";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;

  try {
    const secrets = await getSecrets(namespace);
    return NextResponse.json(secrets);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch secrets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
