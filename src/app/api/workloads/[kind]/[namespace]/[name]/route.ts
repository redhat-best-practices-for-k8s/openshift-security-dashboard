import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getWorkloadDetail, patchWorkloadSecurityContext } from "@/lib/k8s/workloads";
import { getPortAnalysis } from "@/lib/k8s/ports";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; namespace: string; name: string }> }
) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const { kind, namespace, name } = await params;
    const workload = await getWorkloadDetail(kind, name, namespace);

    if (!workload) {
      return NextResponse.json({ error: "Workload not found" }, { status: 404 });
    }

    // Enrich with port analysis
    const portData = await getPortAnalysis(namespace);
    // For non-Pod workloads, aggregate ports from associated pods
    const podKeys = Object.keys(portData);
    const relevantPorts = podKeys
      .filter((k) => k.startsWith(`${namespace}/`))
      .flatMap((k) => portData[k]);
    workload.ports = relevantPorts.length > 0 ? relevantPorts : undefined;

    return NextResponse.json(workload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch workload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; namespace: string; name: string }> }
) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const { kind, namespace, name } = await params;
    const body = await request.json();

    await patchWorkloadSecurityContext(kind, name, namespace, body);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to patch workload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
