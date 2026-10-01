import { NextResponse } from "next/server";
import { listConnectorStatus, loadConnectors } from "@/lib/connectors";

export const runtime = "nodejs";

export async function GET() {
  const connectors = await listConnectorStatus();
  const store = await loadConnectors();
  return NextResponse.json({
    ok: true,
    connectors,
    jobs: store.jobs.slice(0, 15),
  });
}
