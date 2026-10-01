export type RelationToSelf = "self" | "close" | "other";

export type SourceType =
  | "telegram_chat"
  | "meeting"
  | "note"
  | "file"
  | "email"
  | "calendar"
  | "drive"
  | "voice_note"
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
  | "note"
  | "media_ref"
  | "transcript"
  | "ocr"
  | "caption";

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

export type AttachmentKind =
  | "photo"
  | "video"
  | "video_note"
  | "voice"
  | "audio"
  | "document"
  | "sticker"
  | "animation"
  | "contact"
  | "location"
  | "poll"
  | "other";

export type DeriveStatus = "none" | "pending" | "done" | "failed";

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
  exportDir?: string;
  mediaCount?: number;
  textMessageCount?: number;
  attachmentIds?: string[];
  /** Email connector fields */
  emailFrom?: string;
  emailTo?: string;
  emailDate?: string;
  emailMessageId?: string;
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
  attachmentIds?: string[];
  telegramMessageId?: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  sourceId: string;
  messageId?: number;
  chunkId?: string;
  kind: AttachmentKind;
  mime?: string;
  originalName: string;
  storedPath: string;
  byteSize?: number;
  sha256?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  caption?: string;
  telegramFileRef?: string;
  derivedText?: string;
  deriveStatus: DeriveStatus;
  deriveError?: string;
  personIds: string[];
  timestamp?: string;
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
  version: 4;
  updatedAt: string;
  selfPersonId: string;
  people: Person[];
  sources: Source[];
  chunks: Chunk[];
  facts: Fact[];
  relations: Relation[];
  attachments: Attachment[];
}
