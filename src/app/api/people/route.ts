import { NextResponse } from "next/server";
import { getPerson, listStats } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || searchParams.get("name");

  if (id) {
    const person = await getPerson(id);
    if (!person) {
      return NextResponse.json({ error: "Человек не найден" }, { status: 404 });
    }
    return NextResponse.json({
      ...person.person,
      sources: person.sources.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        summary: s.summary,
        ingestedAt: s.ingestedAt,
      })),
      facts: person.facts,
      recentChunks: person.chunks.map(({ embedding, ...c }) => {
        void embedding;
        return c;
      }),
    });
  }

  const { store } = await listStats();
  const people = [...store.people].sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.relationToSelf === "close" && b.relationToSelf !== "close") return -1;
    if (b.relationToSelf === "close" && a.relationToSelf !== "close") return 1;
    return b.sourceIds.length - a.sourceIds.length;
  });

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      canonicalName: p.canonicalName,
      relationToSelf: p.relationToSelf,
      isSelf: p.isSelf,
      themes: p.themes,
      sourceCount: p.sourceIds.length,
      factCount: p.factIds.length,
    })),
  });
}
