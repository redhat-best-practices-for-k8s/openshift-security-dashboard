import { NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getNamespacePodSecurity } from "@/lib/k8s/pod-security";

export async function GET() {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const data = await getNamespacePodSecurity();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch pod security data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
