import { NextResponse } from "next/server";
import { createFact, listFacts, patchFact } from "@/lib/store";
import type { FactKind, FactStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "open") as
    | FactStatus
    | "all";
  const kind = url.searchParams.get("kind") as FactKind | null;
  const personId = url.searchParams.get("personId") || undefined;
  const { facts, store } = await listFacts({
    status,
    kind: kind || undefined,
    personId,
  });
  const people = Object.fromEntries(
    store.people.map((p) => [p.id, p.canonicalName]),
  );
  return NextResponse.json({ facts, people });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "title обязателен" }, { status: 400 });
    }
    const fact = await createFact({
      title,
      detail: body.detail ? String(body.detail) : undefined,
      kind: body.kind as FactKind | undefined,
      personIds: Array.isArray(body.personIds) ? body.personIds.map(String) : undefined,
      sourceId: body.sourceId ? String(body.sourceId) : undefined,
      evidenceChunkIds: Array.isArray(body.evidenceChunkIds)
        ? body.evidenceChunkIds.map(String)
        : undefined,
      confidence: body.confidence,
      origin: body.origin || "manual",
      dueAt: body.dueAt ? String(body.dueAt) : undefined,
      status: (body.status as FactStatus) || "open",
    });
    return NextResponse.json({ fact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "create fact failed", detail: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const fact = await patchFact(id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      detail: body.detail !== undefined ? String(body.detail) : undefined,
      kind: body.kind,
      status: body.status,
      dueAt: body.dueAt !== undefined ? String(body.dueAt) : undefined,
      confidence: body.confidence,
      personIds: Array.isArray(body.personIds)
        ? body.personIds.map(String)
        : undefined,
    });
    if (!fact) {
      return NextResponse.json({ error: "fact not found" }, { status: 404 });
    }
    return NextResponse.json({ fact });
  } catch (error) {
    return NextResponse.json(
      { error: "patch fact failed", detail: String(error) },
      { status: 500 },
    );
  }
}
