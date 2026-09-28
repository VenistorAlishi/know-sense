import { randomUUID } from "crypto";
import type { KnowledgeStore, Person } from "./types";

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
    (a) => n === a || n.startsWith(`${a} `) || n.endsWith(` ${a}`) || n.includes(` ${a} `),
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
    version: 2,
    updatedAt: self.createdAt,
    selfPersonId: self.id,
    people: [self],
    sources: [],
    chunks: [],
    facts: [],
  };
}

export function ensureSelf(store: KnowledgeStore): KnowledgeStore {
  if (store.version !== 2) {
    return emptyStore();
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
  return store;
}
