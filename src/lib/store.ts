import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ensureSelf, emptyStore, isSelfName, normalizePersonKey } from "./bootstrap";
import { embedText } from "./embeddings";
import type {
  Chunk,
  Fact,
  KnowledgeStore,
  Person,
  RelationToSelf,
  Source,
} from "./types";
import { cosineSimilarity } from "./utils";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store", "knowledge.json");
const SOURCES_DIR = path.join(DATA_DIR, "sources");

async function ensureDirs() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.mkdir(SOURCES_DIR, { recursive: true });
}

export async function loadStore(): Promise<KnowledgeStore> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as KnowledgeStore | { version?: number };
    if (!parsed || (parsed as KnowledgeStore).version !== 2) {
      const store = emptyStore();
      await saveStore(store);
      return store;
    }
    const store = ensureSelf(parsed as KnowledgeStore);
    return store;
  } catch {
    const store = emptyStore();
    await saveStore(store);
    return store;
  }
}

export async function saveStore(store: KnowledgeStore): Promise<void> {
  await ensureDirs();
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function getSelf(store: KnowledgeStore): Person {
  const self =
    store.people.find((p) => p.id === store.selfPersonId) ||
    store.people.find((p) => p.isSelf);
  if (!self) throw new Error("Self person missing");
  return self;
}

export function findPersonByName(
  store: KnowledgeStore,
  name: string,
): Person | undefined {
  const key = normalizePersonKey(name);
  if (!key) return undefined;
  if (isSelfName(name)) return getSelf(store);
  return store.people.find(
    (p) =>
      normalizePersonKey(p.canonicalName) === key ||
      p.aliases.some((a) => normalizePersonKey(a) === key) ||
      p.telegramIds.some((id) => id === name || id === key),
  );
}

export function findPersonByTelegramId(
  store: KnowledgeStore,
  telegramId: string,
): Person | undefined {
  return store.people.find((p) => p.telegramIds.includes(String(telegramId)));
}

export function upsertPerson(
  store: KnowledgeStore,
  input: {
    name: string;
    aliases?: string[];
    relationToSelf?: RelationToSelf;
    telegramId?: string;
    bio?: string;
  },
): Person {
  const now = new Date().toISOString();
  if (isSelfName(input.name) || input.relationToSelf === "self") {
    const self = getSelf(store);
    const aliases = new Set([
      ...self.aliases,
      ...(input.aliases || []),
      input.name,
    ]);
    self.aliases = [...aliases];
    if (input.telegramId && !self.telegramIds.includes(input.telegramId)) {
      self.telegramIds.push(input.telegramId);
    }
    self.updatedAt = now;
    return self;
  }

  let person =
    (input.telegramId
      ? findPersonByTelegramId(store, input.telegramId)
      : undefined) || findPersonByName(store, input.name);

  if (!person) {
    person = {
      id: randomUUID(),
      canonicalName: input.name.trim(),
      aliases: [...new Set([input.name.trim(), ...(input.aliases || [])])],
      isSelf: false,
      relationToSelf: input.relationToSelf || "other",
      bio: input.bio || "",
      themes: [],
      sourceIds: [],
      factIds: [],
      telegramIds: input.telegramId ? [String(input.telegramId)] : [],
      createdAt: now,
      updatedAt: now,
    };
    store.people.push(person);
    return person;
  }

  person.aliases = [
    ...new Set([...person.aliases, input.name.trim(), ...(input.aliases || [])]),
  ];
  if (input.telegramId && !person.telegramIds.includes(String(input.telegramId))) {
    person.telegramIds.push(String(input.telegramId));
  }
  if (input.relationToSelf === "close" && person.relationToSelf !== "self") {
    person.relationToSelf = "close";
  }
  if (input.bio && !person.bio) person.bio = input.bio;
  person.updatedAt = now;
  return person;
}

export async function writeRawSource(
  filename: string,
  content: string,
): Promise<string> {
  await ensureDirs();
  const safe = filename.replace(/[^\wа-яё.\- ]+/gi, "_").slice(0, 120);
  const stamp = Date.now();
  const relative = `${stamp}_${safe || "source.txt"}`;
  const absolute = path.join(SOURCES_DIR, relative);
  await fs.writeFile(absolute, content, "utf8");
  return relative;
}

export async function commitIngest(result: {
  store: KnowledgeStore;
  source: Source;
  chunks: Chunk[];
  facts: Fact[];
  peopleTouched: Person[];
  rawContent: string;
  rawFilename: string;
}): Promise<KnowledgeStore> {
  const store = ensureSelf(result.store);
  const rawRef = await writeRawSource(result.rawFilename, result.rawContent);
  result.source.rawRef = rawRef;
  result.source.path = path.join("data", "sources", rawRef);

  // remove previous source with same title+type (re-ingest)
  const existing = store.sources.find(
    (s) => s.type === result.source.type && s.title === result.source.title,
  );
  if (existing) {
    store.chunks = store.chunks.filter((c) => c.sourceId !== existing.id);
    store.facts = store.facts.filter((f) => f.sourceId !== existing.id);
    store.sources = store.sources.filter((s) => s.id !== existing.id);
    for (const p of store.people) {
      p.sourceIds = p.sourceIds.filter((id) => id !== existing.id);
      p.factIds = p.factIds.filter((id) => !existing.factIds.includes(id));
    }
  }

  for (const person of result.peopleTouched) {
    const idx = store.people.findIndex((p) => p.id === person.id);
    if (idx === -1) store.people.push(person);
    else store.people[idx] = person;
  }

  for (const person of store.people) {
    if (!result.source.personIds.includes(person.id)) continue;
    if (!person.sourceIds.includes(result.source.id)) {
      person.sourceIds.push(result.source.id);
    }
    for (const fact of result.facts) {
      if (fact.personIds.includes(person.id) && !person.factIds.includes(fact.id)) {
        person.factIds.push(fact.id);
      }
    }
    person.updatedAt = new Date().toISOString();
  }

  result.source.chunkIds = result.chunks.map((c) => c.id);
  result.source.factIds = result.facts.map((f) => f.id);
  store.sources.unshift(result.source);
  store.chunks.push(...result.chunks);
  store.facts.push(...result.facts);

  for (const fact of result.facts) {
    if (fact.kind === "theme" || fact.kind === "context") {
      for (const pid of fact.personIds) {
        const person = store.people.find((p) => p.id === pid);
        if (!person) continue;
        person.themes = [...new Set([fact.title, ...person.themes])].slice(0, 20);
      }
    }
  }

  await saveStore(store);
  return store;
}

export async function searchKnowledge(query: string, limit = 8) {
  const store = await loadStore();
  const q = embedText(query);
  const sourceMap = new Map(store.sources.map((s) => [s.id, s]));
  const scored = store.chunks.map((chunk) => ({
    score: cosineSimilarity(q, chunk.embedding),
    source: sourceMap.get(chunk.sourceId),
    chunk,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0.05).slice(0, limit);
}

export async function getSource(id: string) {
  const store = await loadStore();
  const source = store.sources.find((s) => s.id === id);
  if (!source) return null;
  const chunks = store.chunks.filter((c) => c.sourceId === id);
  const facts = store.facts.filter((f) => f.sourceId === id);
  const people = store.people.filter((p) => source.personIds.includes(p.id));
  return { source, chunks, facts, people };
}

export async function getPerson(idOrName: string) {
  const store = await loadStore();
  const byId = store.people.find((p) => p.id === idOrName);
  const person =
    byId ||
    findPersonByName(store, idOrName) ||
    (normalizePersonKey(idOrName) === "kirill" ||
    normalizePersonKey(idOrName) === "self"
      ? getSelf(store)
      : undefined);
  if (!person) return null;
  const sources = store.sources.filter((s) => person.sourceIds.includes(s.id));
  const facts = store.facts.filter((f) => person.factIds.includes(f.id));
  const chunks = store.chunks
    .filter((c) => c.personIds.includes(person.id))
    .slice(0, 40);
  return { person, sources, facts, chunks };
}

export async function listStats() {
  const store = await loadStore();
  const self = getSelf(store);
  return {
    store,
    self,
    counts: {
      people: store.people.length,
      closePeople: store.people.filter((p) => p.relationToSelf === "close").length,
      sources: store.sources.length,
      chunks: store.chunks.length,
      facts: store.facts.length,
    },
  };
}

export { STORE_PATH, SOURCES_DIR, DATA_DIR };
