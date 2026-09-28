import { randomUUID } from "crypto";
import type { Fact, KnowledgeStore, Person, Relation } from "./types";

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
    version: 3,
    updatedAt: self.createdAt,
    selfPersonId: self.id,
    people: [self],
    sources: [],
    chunks: [],
    facts: [],
    relations: [],
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

/** Upgrade v2 (or partial) stores to v3 in memory. */
export function migrateStoreToV3(raw: unknown): KnowledgeStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const data = raw as Partial<KnowledgeStore> & { version?: number };
  if (data.version === 3 && Array.isArray(data.people) && data.selfPersonId) {
    const store = data as KnowledgeStore;
    store.relations = Array.isArray(store.relations) ? store.relations : [];
    store.facts = (store.facts || []).map((f) => migrateFact(f));
    return ensureSelf(store);
  }

  // v2 or unknown → lift into v3
  const base = emptyStore();
  if (!Array.isArray(data.people) || !data.people.length) {
    return base;
  }

  const self =
    data.people.find((p) => p.id === data.selfPersonId && p.isSelf) ||
    data.people.find((p) => p.isSelf) ||
    base.people[0];

  return ensureSelf({
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
  });
}

export function ensureSelf(store: KnowledgeStore): KnowledgeStore {
  if (store.version !== 3) {
    return migrateStoreToV3(store);
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
  return store;
}
