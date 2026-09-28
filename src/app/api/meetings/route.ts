import { NextResponse } from "next/server";
import { getMeeting, loadStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) {
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Встреча не найдена" }, { status: 404 });
    }
    const { chunks, ...rest } = meeting;
    return NextResponse.json({
      ...rest,
      chunkCount: chunks.length,
      chunks: chunks.map(({ embedding: _e, ...c }) => c),
    });
  }

  const store = await loadStore();
  return NextResponse.json({
    meetings: store.meetings.map((m) => ({
      id: m.id,
      title: m.title,
      sourceFile: m.sourceFile,
      ingestedAt: m.ingestedAt,
      participants: m.participants,
      summary: m.summary.slice(0, 280),
      meaningCount: m.meanings.length,
      topics: m.topics.slice(0, 6),
    })),
  });
}
