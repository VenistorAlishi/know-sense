import { randomUUID } from "crypto";
import type {
  Attachment,
  Chunk,
  Fact,
  KnowledgeStore,
  Person,
  Relation,
} from "./types";

export const SELF_ALIASES = [
  "кирилл",
  "kirill",
  "кирил",
  "kiril",
  "кирюша",
  "киря",
];

export function normalizePersonKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSelfName(name: string): boolean {
  const n = normalizePersonKey(name);
  if (!n) return false;
  return SELF_ALIASES.some(
    (a) =>
      n === a ||
      n.startsWith(`${a} `) ||
      n.endsWith(` ${a}`) ||
      n.includes(` ${a} `),
  );
}

export function createSelfPerson(now = new Date().toISOString()): Person {
  return {
    id: randomUUID(),
    canonicalName: "Кирилл",
    aliases: ["Кирилл", "Kirill", "Кирил"],
    isSelf: true,
    relationToSelf: "self",
    bio: "Владелец персональной базы знаний Смысл.",
    themes: [],
    sourceIds: [],
    factIds: [],
    telegramIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyStore(): KnowledgeStore {
  const self = createSelfPerson();
  return {
    version: 4,
    updatedAt: self.createdAt,
    selfPersonId: self.id,
    people: [self],
    sources: [],
    chunks: [],
    facts: [],
    relations: [],
    attachments: [],
  };
}

function migrateFact(raw: Partial<Fact> & { createdAt?: string }): Fact {
  const createdAt = raw.createdAt || new Date().toISOString();
  return {
    id: raw.id || randomUUID(),
    personIds: Array.isArray(raw.personIds) ? raw.personIds : [],
    sourceId: raw.sourceId || "",
    kind: raw.kind || "context",
    title: raw.title || "",
    detail: raw.detail || "",
    evidenceChunkIds: Array.isArray(raw.evidenceChunkIds)
      ? raw.evidenceChunkIds
      : [],
    confidence: raw.confidence || "medium",
    status: raw.status || "open",
    origin: raw.origin || "heuristic",
    dueAt: raw.dueAt,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

function migrateChunk(raw: Partial<Chunk>): Chunk {
  return {
    id: raw.id || randomUUID(),
    sourceId: raw.sourceId || "",
    text: raw.text || "",
    title: raw.title || "",
    speaker: raw.speaker,
    timestamp: raw.timestamp,
    kind: raw.kind || "raw",
    embedding: Array.isArray(raw.embedding) ? raw.embedding : [],
    personIds: Array.isArray(raw.personIds) ? raw.personIds : [],
    attachmentIds: Array.isArray(raw.attachmentIds) ? raw.attachmentIds : undefined,
    telegramMessageId: raw.telegramMessageId,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

/** Upgrade any older store to v4 in memory. */
export function migrateStoreToV4(raw: unknown): KnowledgeStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as LegacyStore;

  if (data.version === 4 && Array.isArray(data.people) && data.selfPersonId) {
    const store = data as KnowledgeStore;
    store.relations = Array.isArray(store.relations) ? store.relations : [];
    store.attachments = Array.isArray(store.attachments) ? store.attachments : [];
    store.facts = (store.facts || []).map((f) => migrateFact(f));
    store.chunks = (store.chunks || []).map((c) => migrateChunk(c));
    return ensureSelf(store);
  }

  // v3 or older → lift into v4 (reuse v3 shape first)
  const v3ish = migrateStoreToV3Legacy(data);
  return ensureSelf({
    ...v3ish,
    version: 4,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    chunks: (v3ish.chunks || []).map((c) => migrateChunk(c)),
  });
}

type LegacyStore = {
  version?: number;
  updatedAt?: string;
  selfPersonId?: string;
  people?: Person[];
  sources?: KnowledgeStore["sources"];
  chunks?: Chunk[];
  facts?: Fact[];
  relations?: Relation[];
  attachments?: Attachment[];
};

/** Internal: previous v3 migrator kept for lifting pre-v3 data. */
function migrateStoreToV3Legacy(data: LegacyStore): {
  version: 3;
  updatedAt: string;
  selfPersonId: string;
  people: Person[];
  sources: KnowledgeStore["sources"];
  chunks: Chunk[];
  facts: Fact[];
  relations: Relation[];
} {
  if (data.version === 3 && Array.isArray(data.people) && data.selfPersonId) {
    return {
      version: 3,
      updatedAt: data.updatedAt || new Date().toISOString(),
      selfPersonId: data.selfPersonId,
      people: data.people,
      sources: Array.isArray(data.sources) ? data.sources : [],
      chunks: Array.isArray(data.chunks) ? data.chunks : [],
      facts: (data.facts || []).map((f) => migrateFact(f)),
      relations: Array.isArray(data.relations) ? data.relations : [],
    };
  }

  const base = emptyStore();
  if (!Array.isArray(data.people) || !data.people.length) {
    return {
      version: 3,
      updatedAt: base.updatedAt,
      selfPersonId: base.selfPersonId,
      people: base.people,
      sources: [],
      chunks: [],
      facts: [],
      relations: [],
    };
  }

  const self =
    data.people.find((p) => p.id === data.selfPersonId && p.isSelf) ||
    data.people.find((p) => p.isSelf) ||
    base.people[0];

  return {
    version: 3,
    updatedAt: data.updatedAt || new Date().toISOString(),
    selfPersonId: self.id,
    people: data.people,
    sources: Array.isArray(data.sources) ? data.sources : [],
    chunks: Array.isArray(data.chunks) ? data.chunks : [],
    facts: (Array.isArray(data.facts) ? data.facts : []).map((f) =>
      migrateFact(f as Fact),
    ),
    relations: Array.isArray(data.relations)
      ? (data.relations as Relation[])
      : [],
  };
}

/** @deprecated use migrateStoreToV4 */
export function migrateStoreToV3(raw: unknown): KnowledgeStore {
  return migrateStoreToV4(raw);
}

export function ensureSelf(store: KnowledgeStore): KnowledgeStore {
  if (store.version !== 4) {
    return migrateStoreToV4(store);
  }
  let self = store.people.find((p) => p.id === store.selfPersonId && p.isSelf);
  if (!self) {
    self = store.people.find((p) => p.isSelf);
  }
  if (!self) {
    self = createSelfPerson();
    store.people.unshift(self);
  }
  store.selfPersonId = self.id;
  if (!Array.isArray(store.relations)) store.relations = [];
  if (!Array.isArray(store.attachments)) store.attachments = [];
  return store;
}
