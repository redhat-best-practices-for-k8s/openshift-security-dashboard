import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getWorkloads } from "@/lib/k8s/workloads";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get("namespace") || undefined;
    const kind = searchParams.get("kind") || undefined;

    let workloads = await getWorkloads(namespace);

    if (kind) {
      workloads = workloads.filter((w) => w.kind.toLowerCase() === kind.toLowerCase());
    }

    return NextResponse.json(workloads);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch workloads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
