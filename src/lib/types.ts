export type RelationToSelf = "self" | "close" | "other";

export type SourceType =
  | "telegram_chat"
  | "meeting"
  | "note"
  | "file"
  | "other";

export type ChunkKind =
  | "message_window"
  | "summary"
  | "topic"
  | "decision"
  | "action"
  | "speaker"
  | "context"
  | "raw"
  | "note";

export type FactKind =
  | "identity"
  | "relationship"
  | "preference"
  | "skill"
  | "event"
  | "task"
  | "context"
  | "theme"
  | "decision"
  | "risk";

export type FactStatus = "open" | "done" | "stale" | "dismissed";

export type FactOrigin = "heuristic" | "manual" | "llm" | "import";

export interface Person {
  id: string;
  canonicalName: string;
  aliases: string[];
  isSelf: boolean;
  relationToSelf: RelationToSelf;
  bio: string;
  themes: string[];
  sourceIds: string[];
  factIds: string[];
  telegramIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SourceMeta {
  chatId?: string | number;
  chatType?: string;
  dateRange?: { from?: string; to?: string };
  messageCount?: number;
  peerName?: string;
  originalFilename?: string;
  extractedAt?: string;
}

export interface Source {
  id: string;
  type: SourceType;
  title: string;
  path: string;
  rawRef: string;
  participants: string[];
  personIds: string[];
  ingestedAt: string;
  meta: SourceMeta;
  summary: string;
  chunkIds: string[];
  factIds: string[];
}

export interface Chunk {
  id: string;
  sourceId: string;
  text: string;
  title: string;
  speaker?: string;
  timestamp?: string;
  kind: ChunkKind;
  embedding: number[];
  personIds: string[];
  createdAt: string;
}

export interface Fact {
  id: string;
  personIds: string[];
  sourceId: string;
  kind: FactKind;
  title: string;
  detail: string;
  evidenceChunkIds: string[];
  confidence: "high" | "medium" | "low";
  status: FactStatus;
  origin: FactOrigin;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  label: string;
  sourceId?: string;
  evidenceChunkIds: string[];
  createdAt: string;
}

export interface KnowledgeStore {
  version: 3;
  updatedAt: string;
  selfPersonId: string;
  people: Person[];
  sources: Source[];
  chunks: Chunk[];
  facts: Fact[];
  relations: Relation[];
}
