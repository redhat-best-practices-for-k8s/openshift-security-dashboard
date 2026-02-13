import { NextRequest, NextResponse } from "next/server";
import { loadKubeConfig, getKubeConfig, getContexts, getCurrentContext, setContext, getCoreApi } from "@/lib/k8s/client";
import { apiCache } from "@/lib/k8s/cache";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("kubeconfig") as File | null;
    const raw = formData.get("kubeconfigRaw") as string | null;

    let content: string;
    if (file) {
      content = await file.text();
    } else if (raw) {
      content = raw;
    } else {
      return NextResponse.json({ error: "No kubeconfig provided" }, { status: 400 });
    }

    const kc = loadKubeConfig(content);
    const contexts = getContexts();
    const currentContext = getCurrentContext();

    return NextResponse.json({ contexts, currentContext });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse kubeconfig";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const kc = getKubeConfig();
  if (!kc) {
    return NextResponse.json({ loaded: false, contexts: [], currentContext: "" });
  }
  return NextResponse.json({
    loaded: true,
    contexts: getContexts(),
    currentContext: getCurrentContext(),
  });
}

export async function PUT(request: NextRequest) {
  try {
    const { context } = await request.json();
    setContext(context);
    apiCache.clear();

    // Fetch namespaces for new context
    const api = getCoreApi();
    const nsRes = await api.listNamespace();
    const namespaces = nsRes.items.map((ns) => ns.metadata?.name || "").filter(Boolean);

    return NextResponse.json({ currentContext: context, namespaces });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to switch context";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
