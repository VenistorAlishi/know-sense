import { NextResponse } from "next/server";
import { getSource, listStats } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const detail = await getSource(id);
    if (!detail) {
      return NextResponse.json({ error: "Источник не найден" }, { status: 404 });
    }
    return NextResponse.json({
      ...detail.source,
      people: detail.people.map((p) => ({
        id: p.id,
        name: p.canonicalName,
        relationToSelf: p.relationToSelf,
        isSelf: p.isSelf,
      })),
      facts: detail.facts,
      chunks: detail.chunks.map(({ embedding, ...c }) => {
        void embedding;
        return c;
      }),
    });
  }

  const { store } = await listStats();
  return NextResponse.json({
    sources: store.sources.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      summary: s.summary,
      ingestedAt: s.ingestedAt,
      participants: s.participants,
      chunkCount: s.chunkIds.length,
      factCount: s.factIds.length,
      meta: s.meta,
    })),
  });
}
