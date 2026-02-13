import { NextRequest, NextResponse } from "next/server";
import { isLoaded } from "@/lib/k8s/client";
import {
  launchTLSScan,
  getScanStatus,
  cleanupScan,
  getActiveScan,
  getScanHistory,
  getScanById,
} from "@/lib/k8s/tls-scanner";

export async function POST() {
  if (!isLoaded()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    const result = await launchTLSScan();
    return NextResponse.json({ status: "launched", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isLoaded()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;

  // GET ?history=true — return list of past scans (without full results)
  if (searchParams.get("history") === "true") {
    const history = getScanHistory();
    return NextResponse.json({ history });
  }

  // GET ?id=<scanId> — return a specific historical scan with results + logs
  const scanId = searchParams.get("id");
  if (scanId) {
    const entry = getScanById(scanId);
    if (!entry) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }
    return NextResponse.json(entry);
  }

  // Default: return current active scan status
  const active = getActiveScan();
  if (!active) {
    return NextResponse.json({ status: "not_found" });
  }

  try {
    const result = await getScanStatus();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isLoaded()) {
    return NextResponse.json({ error: "KubeConfig not loaded" }, { status: 400 });
  }

  try {
    await cleanupScan();
    return NextResponse.json({ status: "cleaned" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
