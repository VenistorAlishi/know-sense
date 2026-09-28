import { promises as fs } from "fs";
import path from "path";
import type { KnowledgeStore, MeetingRecord } from "./types";
import { cosineSimilarity } from "./utils";
import { embedText } from "./embeddings";
import { isUserName, normalizePersonKey } from "./analyze";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store", "knowledge.json");
const MEETINGS_DIR = path.join(DATA_DIR, "meetings");

function emptyStore(): KnowledgeStore {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    meetings: [],
    peopleIndex: {},
  };
}

async function ensureDirs() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.mkdir(MEETINGS_DIR, { recursive: true });
}

export async function loadStore(): Promise<KnowledgeStore> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as KnowledgeStore;
  } catch {
    return emptyStore();
  }
}

export async function saveStore(store: KnowledgeStore): Promise<void> {
  await ensureDirs();
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function rebuildPeopleIndex(store: KnowledgeStore) {
  const index: KnowledgeStore["peopleIndex"] = {};

  for (const meeting of store.meetings) {
    for (const person of meeting.people) {
      const key = normalizePersonKey(person.isPrimary ? "Кирилл" : person.name);
      const existing = index[key];
      if (!existing) {
        index[key] = {
          canonicalName: person.isPrimary ? "Кирилл" : person.name,
          aliases: [...person.aliases],
          meetingIds: [meeting.id],
          roleHints: [...person.roleHints],
          themes: [...person.themes],
          isUser: Boolean(person.isPrimary || isUserName(person.name)),
        };
      } else {
        existing.aliases = [...new Set([...existing.aliases, ...person.aliases])];
        existing.roleHints = [
          ...new Set([...existing.roleHints, ...person.roleHints]),
        ];
        existing.themes = [...new Set([...existing.themes, ...person.themes])].slice(
          0,
          12,
        );
        if (!existing.meetingIds.includes(meeting.id)) {
          existing.meetingIds.push(meeting.id);
        }
        if (person.isPrimary || isUserName(person.name)) existing.isUser = true;
      }
    }
  }

  store.peopleIndex = index;
}

export async function upsertMeeting(
  meeting: MeetingRecord,
  rawMarkdown: string,
): Promise<KnowledgeStore> {
  const store = await loadStore();
  store.meetings = store.meetings.filter(
    (m) => m.sourceFile !== meeting.sourceFile && m.id !== meeting.id,
  );
  store.meetings.unshift(meeting);
  rebuildPeopleIndex(store);

  const safeName = meeting.sourceFile.replace(/[^\wа-яё.\- ]+/gi, "_");
  await fs.writeFile(path.join(MEETINGS_DIR, safeName), rawMarkdown, "utf8");
  await saveStore(store);
  return store;
}

export async function searchKnowledge(query: string, limit = 8) {
  const store = await loadStore();
  const q = embedText(query);
  const scored = store.meetings.flatMap((meeting) =>
    meeting.chunks.map((chunk) => ({
      score: cosineSimilarity(q, chunk.embedding),
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      chunk,
    })),
  );

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0.05).slice(0, limit);
}

export async function getMeeting(id: string) {
  const store = await loadStore();
  return store.meetings.find((m) => m.id === id) ?? null;
}

export async function getPerson(key: string) {
  const store = await loadStore();
  const normalized = normalizePersonKey(key);
  const wantsUser =
    normalized === "кирилл" ||
    normalized === "kirill" ||
    normalized === "kiril" ||
    isUserName(key);

  const entry =
    store.peopleIndex[normalized] ||
    (wantsUser ? store.peopleIndex["кирилл"] : undefined) ||
    Object.values(store.peopleIndex).find(
      (p) =>
        normalizePersonKey(p.canonicalName) === normalized ||
        p.aliases.some((a) => normalizePersonKey(a) === normalized) ||
        (wantsUser && p.isUser),
    );

  if (!entry) return null;

  const meetings = store.meetings.filter((m) =>
    entry.meetingIds.includes(m.id),
  );
  const meanings = meetings.flatMap((m) =>
    m.meanings.filter(
      (meaning) =>
        meaning.speakers.some((s) => isUserName(s) && entry.isUser) ||
        meaning.speakers.some(
          (s) => normalizePersonKey(s) === normalizePersonKey(entry.canonicalName),
        ) ||
        meaning.detail.toLowerCase().includes(entry.canonicalName.toLowerCase()),
    ),
  );

  return { ...entry, meetings, meanings };
}

export { STORE_PATH, MEETINGS_DIR, DATA_DIR };
