import { NextRequest, NextResponse } from "next/server";
import { getKubeConfig } from "@/lib/k8s/client";
import { getServiceAccounts } from "@/lib/k8s/service-accounts";
import { getFullSCCAssociations } from "@/lib/k8s/scc-rbac";

export async function GET(request: NextRequest) {
  if (!getKubeConfig()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const namespace = request.nextUrl.searchParams.get("namespace") || undefined;

  try {
    // Always fetch SAs first — this is the critical path
    const sas = await getServiceAccounts(namespace);

    // Try to enrich with SCCs using the unified resolver — completely optional
    try {
      const saKeys = sas.map((sa) => ({ name: sa.name, namespace: sa.namespace }));
      const { associations } = await getFullSCCAssociations(saKeys);

      for (const sa of sas) {
        const key = `${sa.namespace}/${sa.name}`;
        sa.sccs = associations[key] || [];
      }
    } catch {
      // SCC enrichment failed — return SAs without SCC data rather than failing
      console.error("SCC enrichment failed, returning SAs without SCC data");
    }

    return NextResponse.json(sas);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch service accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
