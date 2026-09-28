import { NextResponse } from "next/server";
import {
  extractBatch,
  extractFromSource,
  listExtractableSources,
} from "@/lib/extract";
import { listFacts } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const sources = await listExtractableSources(20);
  const { facts } = await listFacts({ status: "open" });
  const llmCandidates = facts.filter((f) => f.origin === "llm");
  return NextResponse.json({
    pendingSources: sources.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      ingestedAt: s.ingestedAt,
    })),
    openLlmFacts: llmCandidates.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = body.sourceId ? String(body.sourceId) : "";
    const limit = Math.min(Number(body.limit) || 3, 10);

    if (sourceId) {
      const result = await extractFromSource(sourceId);
      return NextResponse.json(result);
    }

    const batch = await extractBatch(limit);
    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json(
      { error: "extract failed", detail: String(error) },
      { status: 500 },
    );
  }
}
