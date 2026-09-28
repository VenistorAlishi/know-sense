import { randomUUID } from "crypto";
import type { Chunk, Fact, FactOrigin, FactStatus } from "../types";
import { embedText } from "../embeddings";

export function makeChunk(input: {
  sourceId: string;
  text: string;
  title: string;
  kind: Chunk["kind"];
  speaker?: string;
  timestamp?: string;
  personIds: string[];
}): Chunk {
  return {
    id: randomUUID(),
    sourceId: input.sourceId,
    text: input.text,
    title: input.title,
    kind: input.kind,
    speaker: input.speaker,
    timestamp: input.timestamp,
    embedding: embedText(`${input.title}\n${input.text}`),
    personIds: input.personIds,
    createdAt: new Date().toISOString(),
  };
}

export function makeFact(input: {
  sourceId: string;
  personIds: string[];
  kind: Fact["kind"];
  title: string;
  detail: string;
  evidenceChunkIds: string[];
  confidence?: Fact["confidence"];
  status?: FactStatus;
  origin?: FactOrigin;
  dueAt?: string;
}): Fact {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    sourceId: input.sourceId,
    personIds: input.personIds,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    evidenceChunkIds: input.evidenceChunkIds,
    confidence: input.confidence || "medium",
    status: input.status || "open",
    origin: input.origin || "heuristic",
    dueAt: input.dueAt,
    createdAt: now,
    updatedAt: now,
  };
}

/** Shared RU heuristics for tasks/themes from free text. */
export function heuristicFactsFromText(input: {
  sourceId: string;
  personIds: string[];
  text: string;
  chunkIds: string[];
  origin?: FactOrigin;
}): Fact[] {
  const facts: Fact[] = [];
  const evidence = input.chunkIds.slice(0, 3);
  const origin = input.origin || "heuristic";

  // Avoid \\b — JS word boundaries ignore Cyrillic.
  const taskRe =
    /(?:^|[\s«"(-])((?:надо|нужно|сделай|сделаем|задача|дедлайн|к пятниц[еыу]|завтра|договорились|висят|открыт[оы]?)\s[^.!?\n]{6,120})/giu;
  const tasks: string[] = [];
  for (const m of input.text.matchAll(taskRe)) {
    if (m[1]) tasks.push(m[1].trim());
  }
  for (const t of [...new Set(tasks)].slice(0, 8)) {
    facts.push(
      makeFact({
        sourceId: input.sourceId,
        personIds: input.personIds,
        kind: "task",
        title: t.trim().slice(0, 80),
        detail: t.trim(),
        evidenceChunkIds: evidence,
        confidence: "low",
        origin,
      }),
    );
  }

  const decisionRe =
    /(?:^|[\s«"(-])((?:решили|договорились|принято|будем)\s[^.!?\n]{6,120})/giu;
  const decisions: string[] = [];
  for (const m of input.text.matchAll(decisionRe)) {
    if (m[1]) decisions.push(m[1].trim());
  }
  for (const d of [...new Set(decisions)].slice(0, 4)) {
    facts.push(
      makeFact({
        sourceId: input.sourceId,
        personIds: input.personIds,
        kind: "decision",
        title: d.trim().slice(0, 80),
        detail: d.trim(),
        evidenceChunkIds: evidence,
        confidence: "low",
        origin,
      }),
    );
  }

  const themeHints: Array<[RegExp, string]> = [
    [/работ|проект|релиз|продукт/i, "работа и проекты"],
    [/семь|мама|папа|жен|муж|дочь|сын/i, "семья"],
    [/деньг|бюджет|зарплат|оплат/i, "деньги"],
    [/здоров|врач|больниц/i, "здоровье"],
    [/путешеств|поездк|отпуск|билет/i, "поездки"],
    [/учёб|универ|курс|обучен/i, "обучение"],
  ];
  for (const [re, theme] of themeHints) {
    if (re.test(input.text)) {
      facts.push(
        makeFact({
          sourceId: input.sourceId,
          personIds: input.personIds,
          kind: "theme",
          title: theme,
          detail: `Тема «${theme}» встречается в источнике.`,
          evidenceChunkIds: evidence,
          confidence: "medium",
          origin,
        }),
      );
    }
  }

  return facts;
}
