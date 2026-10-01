import { NextResponse } from "next/server";
import { runConnectorSync } from "@/lib/connectors";
import type { ConnectorId } from "@/lib/connectors/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const IDS: ConnectorId[] = [
  "google-calendar",
  "google-drive",
  "yandex-mail",
  "voice",
  "obsidian",
];

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!IDS.includes(id as ConnectorId)) {
      return NextResponse.json({ error: "Unknown connector" }, { status: 404 });
    }
    const job = await runConnectorSync(id as ConnectorId);
    return NextResponse.json({ ok: job.status !== "error", job });
  } catch (e) {
    return NextResponse.json(
      { error: "Sync failed", detail: String(e) },
      { status: 500 },
    );
  }
}
