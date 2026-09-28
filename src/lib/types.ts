export type ChunkKind =
  | "summary"
  | "topic"
  | "decision"
  | "action"
  | "speaker"
  | "context"
  | "raw";

export type MeaningKind =
  | "theme"
  | "decision"
  | "action"
  | "risk"
  | "context"
  | "identity";

export interface MeetingChunk {
  id: string;
  meetingId: string;
  kind: ChunkKind;
  title: string;
  text: string;
  speakers: string[];
  embedding: number[];
  createdAt: string;
}

export interface Meaning {
  id: string;
  meetingId: string;
  kind: MeaningKind;
  title: string;
  detail: string;
  speakers: string[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface PersonMention {
  name: string;
  aliases: string[];
  roleHints: string[];
  quoteCount: number;
  actionCount: number;
  decisionCount: number;
  themes: string[];
  snippets: string[];
  isPrimary?: boolean;
}

export interface MeetingRecord {
  id: string;
  title: string;
  sourceFile: string;
  ingestedAt: string;
  rawText: string;
  participants: string[];
  summary: string;
  topics: string[];
  decisions: string[];
  actions: string[];
  chunks: MeetingChunk[];
  meanings: Meaning[];
  people: PersonMention[];
}

export interface KnowledgeStore {
  version: 1;
  updatedAt: string;
  meetings: MeetingRecord[];
  peopleIndex: Record<
    string,
    {
      canonicalName: string;
      aliases: string[];
      meetingIds: string[];
      roleHints: string[];
      themes: string[];
      isUser?: boolean;
    }
  >;
}
