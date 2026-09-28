import { randomUUID } from "crypto";
import type { Chunk, Fact } from "../types";
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
}): Fact {
  return {
    id: randomUUID(),
    sourceId: input.sourceId,
    personIds: input.personIds,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    evidenceChunkIds: input.evidenceChunkIds,
    confidence: input.confidence || "medium",
    createdAt: new Date().toISOString(),
  };
}
