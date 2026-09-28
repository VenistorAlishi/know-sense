import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Параметр q обязателен" }, { status: 400 });
  }
  const limit = Number(searchParams.get("limit") || 8);
  const results = await searchKnowledge(q, Number.isFinite(limit) ? limit : 8);
  return NextResponse.json({
    query: q,
    results: results.map((r) => ({
      score: Number(r.score.toFixed(4)),
      meetingId: r.meetingId,
      meetingTitle: r.meetingTitle,
      kind: r.chunk.kind,
      title: r.chunk.title,
      text: r.chunk.text,
      speakers: r.chunk.speakers,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const q = String(body.q || body.query || "").trim();
  if (!q) {
    return NextResponse.json({ error: "query обязателен" }, { status: 400 });
  }
  const results = await searchKnowledge(q, Number(body.limit) || 8);
  return NextResponse.json({ query: q, results });
}
