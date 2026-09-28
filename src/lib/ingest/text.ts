import { randomUUID } from "crypto";
import type { Chunk, Fact, KnowledgeStore, Person, Source, SourceType } from "../types";
import { heuristicFactsFromText, makeChunk, makeFact } from "./helpers";

export function ingestPlainText(
  raw: string,
  ctx: {
    store: KnowledgeStore;
    self: Person;
    filename: string;
    title?: string;
  },
  type: Extract<SourceType, "note" | "file" | "other"> = "note",
): {
  source: Source;
  chunks: Chunk[];
  facts: Fact[];
  peopleTouched: Person[];
} {
  const sourceId = randomUUID();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const title =
    ctx.title ||
    (type === "note"
      ? `Заметка ${stamp}`
      : ctx.filename.replace(/\.[^.]+$/, "") || "Файл");

  const parts = raw.match(/[\s\S]{1,1200}/g) || [raw];
  const chunks = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) =>
      makeChunk({
        sourceId,
        title: parts.length > 1 ? `${title} (${index + 1})` : title,
        text: part,
        kind: type === "note" ? "note" : "raw",
        personIds: [ctx.self.id],
      }),
    );

  const facts: Fact[] = [];
  if (chunks[0]) {
    facts.push(
      makeFact({
        sourceId,
        personIds: [ctx.self.id],
        kind: "context",
        title,
        detail: chunks[0].text.slice(0, 400),
        evidenceChunkIds: [chunks[0].id],
        confidence: "medium",
        origin: "heuristic",
      }),
    );
  }

  facts.push(
    ...heuristicFactsFromText({
      sourceId,
      personIds: [ctx.self.id],
      text: raw,
      chunkIds: chunks.map((c) => c.id),
      origin: "heuristic",
    }),
  );

  const source: Source = {
    id: sourceId,
    type,
    title,
    path: "",
    rawRef: "",
    participants: ["Кирилл"],
    personIds: [ctx.self.id],
    ingestedAt: new Date().toISOString(),
    meta: { originalFilename: ctx.filename },
    summary: raw.trim().slice(0, 280),
    chunkIds: [],
    factIds: [],
  };

  return { source, chunks, facts, peopleTouched: [ctx.self] };
}
