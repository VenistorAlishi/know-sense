import { randomUUID } from "crypto";
import { embedText } from "./embeddings";
import { parseMeetingMarkdown, type ParsedMeeting } from "./meeting-parser";
import type {
  Meaning,
  MeetingChunk,
  MeetingRecord,
  PersonMention,
} from "./types";

const USER_ALIASES = ["кирилл", "kirill", "кирил", "kiril"];

function isUserName(name: string): boolean {
  const n = name.toLowerCase().replace(/ё/g, "е");
  return USER_ALIASES.some((a) => n === a || n.startsWith(`${a} `) || n.includes(a));
}

function normalizePersonKey(name: string): string {
  return name.toLowerCase().replace(/ё/g, "е").trim();
}

function inferRoleHints(text: string): string[] {
  const hints: string[] = [];
  const rules: Array<[RegExp, string]> = [
    [/фаундер|основател|ceo|сео/i, "основатель"],
    [/продакт|product|продукт/i, "продукт"],
    [/технич|разработ|engineer|cto/i, "техника"],
    [/продаж|sales|коммерц/i, "продажи"],
    [/маркетинг|marketing/i, "маркетинг"],
    [/операцион|coo|operations/i, "операции"],
    [/клиент|заказчик/i, "клиентская сторона"],
  ];
  for (const [re, label] of rules) {
    if (re.test(text)) hints.push(label);
  }
  return [...new Set(hints)];
}

function buildPeople(
  parsed: ParsedMeeting,
  meanings: Meaning[],
): PersonMention[] {
  const map = new Map<string, PersonMention>();

  const ensure = (name: string): PersonMention => {
    const key = normalizePersonKey(name);
    let person = map.get(key);
    if (!person) {
      person = {
        name,
        aliases: [name],
        roleHints: [],
        quoteCount: 0,
        actionCount: 0,
        decisionCount: 0,
        themes: [],
        snippets: [],
        isPrimary: isUserName(name),
      };
      map.set(key, person);
    }
    return person;
  };

  for (const p of parsed.participants) ensure(p);
  for (const block of parsed.speakerBlocks) {
    const person = ensure(block.speaker);
    person.quoteCount += 1;
    person.snippets.push(block.text.slice(0, 240));
    person.roleHints.push(...inferRoleHints(block.text));
  }

  for (const meaning of meanings) {
    for (const speaker of meaning.speakers) {
      const person = ensure(speaker);
      if (meaning.kind === "action") person.actionCount += 1;
      if (meaning.kind === "decision") person.decisionCount += 1;
      if (meaning.kind === "theme") person.themes.push(meaning.title);
      person.snippets.push(meaning.detail.slice(0, 240));
    }

    // Attribute actions mentioning a person
    for (const [key, person] of map) {
      if (meaning.detail.toLowerCase().includes(key)) {
        if (meaning.kind === "action") person.actionCount += 1;
        if (meaning.kind === "decision") person.decisionCount += 1;
        if (!meaning.speakers.includes(person.name)) {
          meaning.speakers.push(person.name);
        }
      }
    }
  }

  // Prefer canonical "Кирилл" for the user
  for (const person of map.values()) {
    if (person.isPrimary) {
      person.name = "Кирилл";
      person.aliases = [...new Set(["Кирилл", ...person.aliases])];
      person.roleHints = [...new Set(person.roleHints)];
    } else {
      person.roleHints = [...new Set(person.roleHints)];
      person.themes = [...new Set(person.themes)].slice(0, 8);
      person.snippets = person.snippets.slice(0, 6);
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return b.quoteCount + b.actionCount - (a.quoteCount + a.actionCount);
  });
}

function buildMeanings(
  meetingId: string,
  parsed: ParsedMeeting,
): Meaning[] {
  const meanings: Meaning[] = [];

  if (parsed.summary.trim()) {
    meanings.push({
      id: randomUUID(),
      meetingId,
      kind: "context",
      title: "Контекст встречи",
      detail: parsed.summary.trim(),
      speakers: [],
      confidence: "high",
      evidence: ["секция резюме / вступление"],
    });
  }

  for (const topic of parsed.topics) {
    meanings.push({
      id: randomUUID(),
      meetingId,
      kind: "theme",
      title: topic.slice(0, 80),
      detail: topic,
      speakers: [],
      confidence: "high",
      evidence: ["секция тем"],
    });
  }

  for (const decision of parsed.decisions) {
    const speakers = parsed.participants.filter((p) =>
      decision.toLowerCase().includes(p.toLowerCase()),
    );
    meanings.push({
      id: randomUUID(),
      meetingId,
      kind: "decision",
      title: decision.slice(0, 80),
      detail: decision,
      speakers,
      confidence: "high",
      evidence: ["секция решений"],
    });
  }

  for (const action of parsed.actions) {
    const speakers = parsed.participants.filter((p) =>
      action.toLowerCase().includes(p.toLowerCase()),
    );
    meanings.push({
      id: randomUUID(),
      meetingId,
      kind: "action",
      title: action.slice(0, 80),
      detail: action,
      speakers,
      confidence: "high",
      evidence: ["секция задач"],
    });
  }

  for (const section of parsed.sections) {
    if (/риск|блокер|проблем|опасност/i.test(section.heading + section.body)) {
      const items = section.body
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter((l) => l.length > 8);
      for (const item of items.slice(0, 8)) {
        meanings.push({
          id: randomUUID(),
          meetingId,
          kind: "risk",
          title: item.slice(0, 80),
          detail: item,
          speakers: [],
          confidence: "medium",
          evidence: [section.heading],
        });
      }
    }
  }

  const kirillMentions = [
    ...parsed.participants.filter(isUserName),
    ...parsed.speakerBlocks.filter((b) => isUserName(b.speaker)).map((b) => b.speaker),
  ];

  const fullText = [
    parsed.summary,
    ...parsed.topics,
    ...parsed.decisions,
    ...parsed.actions,
    ...parsed.speakerBlocks.map((b) => `${b.speaker}: ${b.text}`),
  ].join("\n");

  if (/кирилл|kirill/i.test(fullText) || kirillMentions.length) {
    const related = [
      ...parsed.speakerBlocks
        .filter((b) => isUserName(b.speaker))
        .map((b) => b.text),
      ...parsed.actions.filter((a) => /кирилл|kirill/i.test(a)),
      ...parsed.decisions.filter((d) => /кирилл|kirill/i.test(d)),
    ].slice(0, 5);

    meanings.push({
      id: randomUUID(),
      meetingId,
      kind: "identity",
      title: "Кирилл в этой встрече",
      detail:
        related.length > 0
          ? related.join("\n\n")
          : "Кирилл фигурирует среди участников или в тексте записи. Ниже — собранный профиль по упоминаниям.",
      speakers: ["Кирилл"],
      confidence: related.length ? "high" : "medium",
      evidence: ["упоминания имени Кирилл / Kirill"],
    });
  }

  return meanings;
}

function buildChunks(
  meetingId: string,
  parsed: ParsedMeeting,
  meanings: Meaning[],
): MeetingChunk[] {
  const chunks: MeetingChunk[] = [];
  const push = (
    kind: MeetingChunk["kind"],
    title: string,
    text: string,
    speakers: string[] = [],
  ) => {
    const clean = text.trim();
    if (!clean) return;
    chunks.push({
      id: randomUUID(),
      meetingId,
      kind,
      title,
      text: clean,
      speakers,
      embedding: embedText(`${title}\n${clean}`),
      createdAt: new Date().toISOString(),
    });
  };

  push("summary", "Резюме", parsed.summary);
  for (const topic of parsed.topics) push("topic", "Тема", topic);
  for (const decision of parsed.decisions)
    push("decision", "Решение", decision);
  for (const action of parsed.actions) push("action", "Задача", action);
  for (const block of parsed.speakerBlocks)
    push("speaker", block.speaker, block.text, [block.speaker]);
  for (const meaning of meanings) {
    push(
      meaning.kind === "theme"
        ? "topic"
        : meaning.kind === "decision"
          ? "decision"
          : meaning.kind === "action"
            ? "action"
            : meaning.kind === "identity"
              ? "speaker"
              : "context",
      meaning.title,
      meaning.detail,
      meaning.speakers,
    );
  }

  // Long section bodies as context chunks (split roughly)
  for (const section of parsed.sections) {
    const body = section.body.trim();
    if (body.length < 40) continue;
    const parts = body.match(/[\s\S]{1,700}/g) || [body];
    parts.forEach((part, i) =>
      push("context", `${section.heading}${parts.length > 1 ? ` (${i + 1})` : ""}`, part),
    );
  }

  return chunks;
}

export function analyzeMeeting(
  markdown: string,
  sourceFile: string,
): MeetingRecord {
  const parsed = parseMeetingMarkdown(
    markdown,
    sourceFile.replace(/\.md$/i, ""),
  );
  const id = randomUUID();
  const meanings = buildMeanings(id, parsed);
  const people = buildPeople(parsed, meanings);
  const chunks = buildChunks(id, parsed, meanings);

  return {
    id,
    title: parsed.title,
    sourceFile,
    ingestedAt: new Date().toISOString(),
    rawText: markdown,
    participants: parsed.participants,
    summary: parsed.summary,
    topics: parsed.topics,
    decisions: parsed.decisions,
    actions: parsed.actions,
    chunks,
    meanings,
    people,
  };
}

export { isUserName, normalizePersonKey };
