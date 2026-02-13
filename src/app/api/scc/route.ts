import { NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getSCCs } from "@/lib/k8s/scc";

export async function GET() {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const sccs = await getSCCs();
    return NextResponse.json(sccs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch SCCs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
