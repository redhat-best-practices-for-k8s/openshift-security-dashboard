import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getAllRBACData } from "@/lib/k8s/rbac";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;

  try {
    const data = await getAllRBACData(namespace);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch RBAC data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
