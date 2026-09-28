import { randomUUID } from "crypto";
import type { Chunk, Fact, KnowledgeStore, Person, Source } from "../types";
import { parseMeetingMarkdown } from "../meeting-parser";
import { upsertPerson } from "../store";
import { isSelfName } from "../bootstrap";
import { makeChunk, makeFact } from "./helpers";

export function ingestMeetingMarkdown(
  raw: string,
  ctx: {
    store: KnowledgeStore;
    self: Person;
    filename: string;
    title?: string;
  },
): {
  source: Source;
  chunks: Chunk[];
  facts: Fact[];
  peopleTouched: Person[];
} {
  const parsed = parseMeetingMarkdown(raw, ctx.title || ctx.filename);
  const sourceId = randomUUID();
  const peopleTouched: Person[] = [ctx.self];

  for (const name of parsed.participants) {
    const person = upsertPerson(ctx.store, {
      name,
      relationToSelf: isSelfName(name) ? "self" : "other",
    });
    if (!peopleTouched.some((p) => p.id === person.id)) peopleTouched.push(person);
  }

  const personIds = peopleTouched.map((p) => p.id);
  const chunks: Chunk[] = [];
  const facts: Fact[] = [];

  if (parsed.summary) {
    const chunk = makeChunk({
      sourceId,
      title: "Резюме",
      text: parsed.summary,
      kind: "summary",
      personIds,
    });
    chunks.push(chunk);
    facts.push(
      makeFact({
        sourceId,
        personIds,
        kind: "context",
        title: "Контекст встречи",
        detail: parsed.summary,
        evidenceChunkIds: [chunk.id],
        confidence: "high",
      }),
    );
  }

  for (const topic of parsed.topics) {
    const chunk = makeChunk({
      sourceId,
      title: "Тема",
      text: topic,
      kind: "topic",
      personIds,
    });
    chunks.push(chunk);
    facts.push(
      makeFact({
        sourceId,
        personIds,
        kind: "theme",
        title: topic.slice(0, 80),
        detail: topic,
        evidenceChunkIds: [chunk.id],
        confidence: "high",
      }),
    );
  }

  for (const decision of parsed.decisions) {
    const related = peopleTouched
      .filter((p) => decision.toLowerCase().includes(p.canonicalName.toLowerCase()))
      .map((p) => p.id);
    const chunk = makeChunk({
      sourceId,
      title: "Решение",
      text: decision,
      kind: "decision",
      personIds: related.length ? related : personIds,
    });
    chunks.push(chunk);
    facts.push(
      makeFact({
        sourceId,
        personIds: related.length ? related : personIds,
        kind: "decision",
        title: decision.slice(0, 80),
        detail: decision,
        evidenceChunkIds: [chunk.id],
        confidence: "high",
      }),
    );
  }

  for (const action of parsed.actions) {
    const related = peopleTouched
      .filter((p) => action.toLowerCase().includes(p.canonicalName.toLowerCase()))
      .map((p) => p.id);
    const chunk = makeChunk({
      sourceId,
      title: "Задача",
      text: action,
      kind: "action",
      personIds: related.length ? related : personIds,
    });
    chunks.push(chunk);
    facts.push(
      makeFact({
        sourceId,
        personIds: related.length ? related : [ctx.self.id],
        kind: "task",
        title: action.slice(0, 80),
        detail: action,
        evidenceChunkIds: [chunk.id],
        confidence: "high",
      }),
    );
  }

  for (const block of parsed.speakerBlocks) {
    const person = upsertPerson(ctx.store, {
      name: block.speaker,
      relationToSelf: isSelfName(block.speaker) ? "self" : "other",
    });
    if (!peopleTouched.some((p) => p.id === person.id)) peopleTouched.push(person);
    chunks.push(
      makeChunk({
        sourceId,
        title: person.canonicalName,
        text: block.text,
        kind: "speaker",
        speaker: person.canonicalName,
        personIds: [person.id],
      }),
    );
  }

  for (const section of parsed.sections) {
    const body = section.body.trim();
    if (body.length < 40) continue;
    const parts = body.match(/[\s\S]{1,700}/g) || [body];
    parts.forEach((part, i) => {
      chunks.push(
        makeChunk({
          sourceId,
          title: `${section.heading}${parts.length > 1 ? ` (${i + 1})` : ""}`,
          text: part,
          kind: "context",
          personIds,
        }),
      );
    });
  }

  const source: Source = {
    id: sourceId,
    type: "meeting",
    title: parsed.title,
    path: "",
    rawRef: "",
    participants: parsed.participants,
    personIds: peopleTouched.map((p) => p.id),
    ingestedAt: new Date().toISOString(),
    meta: {
      originalFilename: ctx.filename,
      messageCount: parsed.speakerBlocks.length,
    },
    summary: parsed.summary.slice(0, 400),
    chunkIds: [],
    factIds: [],
  };

  return { source, chunks, facts, peopleTouched };
}
