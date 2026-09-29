import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  ensureSelf,
  emptyStore,
  isSelfName,
  migrateStoreToV4,
  normalizePersonKey,
} from "./bootstrap";
import { embedText } from "./embeddings";
import type {
  Attachment,
  Chunk,
  Fact,
  FactKind,
  FactOrigin,
  FactStatus,
  KnowledgeStore,
  Person,
  Relation,
  RelationToSelf,
  Source,
} from "./types";
import { cosineSimilarity } from "./utils";
import { createHash } from "crypto";

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
    const parsed = JSON.parse(raw) as { version?: number };
    const needsMigrate = parsed?.version !== 4;
    const store = migrateStoreToV4(parsed);
    if (needsMigrate) await saveStore(store);
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
  store.version = 4;
  if (!Array.isArray(store.relations)) store.relations = [];
  if (!Array.isArray(store.attachments)) store.attachments = [];
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

/** Copy Telegram export media into data/sources/<sourceId>/media/… */
export async function materializeAttachments(input: {
  sourceId: string;
  attachments: Attachment[];
  exportDir?: string;
}): Promise<Attachment[]> {
  if (!input.attachments.length) return [];
  const mediaRoot = path.join(SOURCES_DIR, input.sourceId, "media");
  await fs.mkdir(mediaRoot, { recursive: true });

  const out: Attachment[] = [];
  for (const att of input.attachments) {
    const next = { ...att, sourceId: input.sourceId };
    const ref = att.telegramFileRef?.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    if (input.exportDir && ref) {
      const src = path.resolve(input.exportDir, ref);
      const exportRoot = path.resolve(input.exportDir);
      if (!src.startsWith(exportRoot + path.sep) && src !== exportRoot) {
        // path escape — keep metadata only
        out.push(next);
        continue;
      }
      try {
        const st = await fs.stat(src);
        if (st.isFile()) {
          const destRel = ref;
          const destAbs = path.join(mediaRoot, destRel);
          await fs.mkdir(path.dirname(destAbs), { recursive: true });
          await fs.copyFile(src, destAbs);
          const buf = await fs.readFile(destAbs);
          next.storedPath = path.join("data", "sources", input.sourceId, "media", destRel);
          next.byteSize = buf.length;
          next.sha256 = createHash("sha256").update(buf).digest("hex");
          if (!next.originalName || next.originalName === "media") {
            next.originalName = path.basename(destRel);
          }
        }
      } catch {
        // missing file in export — keep attachment metadata
      }
    }
    out.push(next);
  }
  return out;
}

export async function commitIngest(result: {
  store: KnowledgeStore;
  source: Source;
  chunks: Chunk[];
  facts: Fact[];
  peopleTouched: Person[];
  attachments?: Attachment[];
  exportDir?: string;
  rawContent: string;
  rawFilename: string;
}): Promise<KnowledgeStore> {
  const store = ensureSelf(result.store);
  const rawRef = await writeRawSource(result.rawFilename, result.rawContent);
  result.source.rawRef = rawRef;
  result.source.path = path.join("data", "sources", rawRef);

  const existing = store.sources.find(
    (s) => s.type === result.source.type && s.title === result.source.title,
  );
  if (existing) {
    store.chunks = store.chunks.filter((c) => c.sourceId !== existing.id);
    store.facts = store.facts.filter((f) => f.sourceId !== existing.id);
    store.attachments = (store.attachments || []).filter(
      (a) => a.sourceId !== existing.id,
    );
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

  const attachments = await materializeAttachments({
    sourceId: result.source.id,
    attachments: result.attachments || [],
    exportDir: result.exportDir,
  });

  result.source.chunkIds = result.chunks.map((c) => c.id);
  result.source.factIds = result.facts.map((f) => f.id);
  result.source.meta = {
    ...result.source.meta,
    attachmentIds: attachments.map((a) => a.id),
    mediaCount: attachments.length,
  };
  store.sources.unshift(result.source);
  store.chunks.push(...result.chunks);
  store.facts.push(...result.facts);
  store.attachments.push(...attachments);

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

export async function listAttachments(sourceId?: string) {
  const store = await loadStore();
  const all = store.attachments || [];
  if (!sourceId) return all;
  return all.filter((a) => a.sourceId === sourceId);
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
  const attachments = (store.attachments || []).filter((a) => a.sourceId === id);
  return { source, chunks, facts, people, attachments };
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

export function listOpenFacts(
  store: KnowledgeStore,
  opts?: { kinds?: FactKind[]; personId?: string },
): Fact[] {
  const kinds = opts?.kinds;
  return store.facts
    .filter((f) => f.status === "open")
    .filter((f) => !kinds || kinds.includes(f.kind))
    .filter((f) => !opts?.personId || f.personIds.includes(opts.personId))
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export async function listFacts(filters?: {
  status?: FactStatus | "all";
  kind?: FactKind;
  personId?: string;
}) {
  const store = await loadStore();
  let facts = [...store.facts];
  if (filters?.status && filters.status !== "all") {
    facts = facts.filter((f) => f.status === filters.status);
  }
  if (filters?.kind) facts = facts.filter((f) => f.kind === filters.kind);
  if (filters?.personId) {
    facts = facts.filter((f) => f.personIds.includes(filters.personId!));
  }
  facts.sort((a, b) =>
    (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
  );
  return { store, facts };
}

export async function createFact(input: {
  title: string;
  detail?: string;
  kind?: FactKind;
  personIds?: string[];
  sourceId?: string;
  evidenceChunkIds?: string[];
  confidence?: Fact["confidence"];
  origin?: FactOrigin;
  dueAt?: string;
  status?: FactStatus;
}): Promise<Fact> {
  const store = await loadStore();
  const self = getSelf(store);
  const now = new Date().toISOString();
  const personIds =
    input.personIds && input.personIds.length
      ? input.personIds
      : [self.id];
  const fact: Fact = {
    id: randomUUID(),
    title: input.title.trim(),
    detail: (input.detail || input.title).trim(),
    kind: input.kind || "context",
    personIds,
    sourceId: input.sourceId || "",
    evidenceChunkIds: input.evidenceChunkIds || [],
    confidence: input.confidence || "high",
    status: input.status || "open",
    origin: input.origin || "manual",
    dueAt: input.dueAt,
    createdAt: now,
    updatedAt: now,
  };
  store.facts.unshift(fact);
  for (const pid of personIds) {
    const person = store.people.find((p) => p.id === pid);
    if (person && !person.factIds.includes(fact.id)) {
      person.factIds.push(fact.id);
      person.updatedAt = now;
    }
  }
  if (fact.sourceId) {
    const source = store.sources.find((s) => s.id === fact.sourceId);
    if (source && !source.factIds.includes(fact.id)) {
      source.factIds.push(fact.id);
    }
  }
  await saveStore(store);
  return fact;
}

export async function patchFact(
  id: string,
  patch: Partial<
    Pick<
      Fact,
      | "title"
      | "detail"
      | "kind"
      | "status"
      | "dueAt"
      | "confidence"
      | "personIds"
    >
  >,
): Promise<Fact | null> {
  const store = await loadStore();
  const fact = store.facts.find((f) => f.id === id);
  if (!fact) return null;
  if (patch.title !== undefined) fact.title = patch.title.trim();
  if (patch.detail !== undefined) fact.detail = patch.detail.trim();
  if (patch.kind !== undefined) fact.kind = patch.kind;
  if (patch.status !== undefined) fact.status = patch.status;
  if (patch.dueAt !== undefined) fact.dueAt = patch.dueAt || undefined;
  if (patch.confidence !== undefined) fact.confidence = patch.confidence;
  if (patch.personIds !== undefined) fact.personIds = patch.personIds;
  fact.updatedAt = new Date().toISOString();
  await saveStore(store);
  return fact;
}

export async function addRelation(input: {
  fromPersonId: string;
  toPersonId: string;
  label: string;
  sourceId?: string;
  evidenceChunkIds?: string[];
}): Promise<Relation> {
  const store = await loadStore();
  const relation: Relation = {
    id: randomUUID(),
    fromPersonId: input.fromPersonId,
    toPersonId: input.toPersonId,
    label: input.label.trim(),
    sourceId: input.sourceId,
    evidenceChunkIds: input.evidenceChunkIds || [],
    createdAt: new Date().toISOString(),
  };
  store.relations.push(relation);
  await saveStore(store);
  return relation;
}

export async function listStats() {
  const store = await loadStore();
  const self = getSelf(store);
  const open = listOpenFacts(store);
  return {
    store,
    self,
    counts: {
      people: store.people.length,
      closePeople: store.people.filter((p) => p.relationToSelf === "close").length,
      sources: store.sources.length,
      chunks: store.chunks.length,
      facts: store.facts.length,
      attachments: (store.attachments || []).length,
      openFacts: open.length,
      openTasks: open.filter((f) => f.kind === "task").length,
      openDecisions: open.filter((f) => f.kind === "decision").length,
      openRisks: open.filter((f) => f.kind === "risk").length,
    },
  };
}

export { STORE_PATH, SOURCES_DIR, DATA_DIR };
