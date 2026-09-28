import { NextResponse } from "next/server";
import { getPerson, loadStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || searchParams.get("id");

  if (name) {
    const person = await getPerson(name);
    if (!person) {
      return NextResponse.json({ error: "Человек не найден" }, { status: 404 });
    }
    return NextResponse.json({
      ...person,
      meetings: person.meetings.map((m) => ({
        id: m.id,
        title: m.title,
        ingestedAt: m.ingestedAt,
        summary: m.summary.slice(0, 240),
      })),
    });
  }

  const store = await loadStore();
  return NextResponse.json({
    people: Object.entries(store.peopleIndex).map(([key, value]) => ({
      key,
      ...value,
    })),
  });
}
