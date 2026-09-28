import { randomUUID } from "crypto";
import { isSelfName } from "../bootstrap";
import type { Chunk, Fact, KnowledgeStore, Person, Source } from "../types";
import { upsertPerson } from "../store";
import { makeChunk, makeFact } from "./helpers";

type TgTextEntity = string | { type?: string; text?: string };

interface TgMessage {
  id?: number;
  type?: string;
  date?: string;
  date_unixtime?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  actor_id?: string;
  text?: TgTextEntity | TgTextEntity[];
  text_entities?: Array<{ type?: string; text?: string }>;
}

interface TgExport {
  name?: string;
  type?: string;
  id?: number | string;
  messages?: TgMessage[];
}

export function extractTelegramText(
  text: TgMessage["text"] | TgMessage["text_entities"],
): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  if (Array.isArray(text)) {
    return text
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || "";
      })
      .join("");
  }
  if (typeof text === "object" && text && "text" in text) {
    return String((text as { text?: string }).text || "");
  }
  return "";
}

function windowMessages(
  messages: Array<{
    from: string;
    text: string;
    date?: string;
    personId?: string;
  }>,
  maxChars = 1800,
  maxMsgs = 30,
) {
  const windows: Array<{
    text: string;
    title: string;
    timestamp?: string;
    speakers: string[];
    personIds: string[];
  }> = [];

  let buf: typeof messages = [];
  let chars = 0;

  const flush = () => {
    if (!buf.length) return;
    const text = buf.map((m) => `${m.from}: ${m.text}`).join("\n");
    const speakers = [...new Set(buf.map((m) => m.from))];
    const personIds = [
      ...new Set(buf.map((m) => m.personId).filter(Boolean) as string[]),
    ];
    windows.push({
      text,
      title: `Переписка ${buf[0].date || ""}`.trim(),
      timestamp: buf[0].date,
      speakers,
      personIds,
    });
    buf = [];
    chars = 0;
  };

  for (const m of messages) {
    const lineLen = m.from.length + m.text.length + 2;
    if (
      buf.length >= maxMsgs ||
      (chars + lineLen > maxChars && buf.length > 0)
    ) {
      flush();
    }
    buf.push(m);
    chars += lineLen;
  }
  flush();
  return windows;
}

function heuristicFactsFromChat(input: {
  sourceId: string;
  self: Person;
  peer: Person | null;
  chunks: Chunk[];
  sampleText: string;
}): Fact[] {
  const facts: Fact[] = [];
  const personIds = [input.self.id, ...(input.peer ? [input.peer.id] : [])];
  const evidence = input.chunks.slice(0, 3).map((c) => c.id);

  if (input.peer) {
    facts.push(
      makeFact({
        sourceId: input.sourceId,
        personIds,
        kind: "relationship",
        title: `Близкий контакт: ${input.peer.canonicalName}`,
        detail: `Личная переписка Telegram между Кириллом и ${input.peer.canonicalName}.`,
        evidenceChunkIds: evidence,
        confidence: "high",
      }),
    );
  }

  const taskRe =
    /(?:надо|нужно|сделай|сделаем|задача|дедлайн|к пятниц|завтра|договорились)\b[^.!?\n]{8,120}/gi;
  const tasks = input.sampleText.match(taskRe) || [];
  for (const t of [...new Set(tasks)].slice(0, 8)) {
    facts.push(
      makeFact({
        sourceId: input.sourceId,
        personIds,
        kind: "task",
        title: t.trim().slice(0, 80),
        detail: t.trim(),
        evidenceChunkIds: evidence,
        confidence: "low",
      }),
    );
  }

  const themeHints: Array<[RegExp, string]> = [
    [/работ|проект|релиз|продукт/i, "работа и проекты"],
    [/семь|мама|папа|жен|муж|дочь|сын/i, "семья"],
    [/деньг|бюджет|зарплат|оплат/i, "деньги"],
    [/здоров|врач|больниц/i, "здоровье"],
    [/путешеств|поездк|отпуск|билет/i, "поездки"],
    [/учёб|универ|курс|обучен/i, "обучение"],
  ];
  for (const [re, theme] of themeHints) {
    if (re.test(input.sampleText)) {
      facts.push(
        makeFact({
          sourceId: input.sourceId,
          personIds,
          kind: "theme",
          title: theme,
          detail: `В переписке встречается тема «${theme}».`,
          evidenceChunkIds: evidence,
          confidence: "medium",
        }),
      );
    }
  }

  return facts;
}

export function ingestTelegram(
  raw: string,
  ctx: {
    store: KnowledgeStore;
    self: Person;
    filename: string;
    title?: string;
    markPeerClose?: boolean;
  },
): {
  source: Source;
  chunks: Chunk[];
  facts: Fact[];
  peopleTouched: Person[];
} {
  let data: TgExport;
  try {
    data = JSON.parse(raw) as TgExport;
  } catch {
    throw new Error("Невалидный JSON Telegram-экспорта");
  }

  if (!Array.isArray(data.messages)) {
    throw new Error("В JSON нет массива messages — нужен result.json из Telegram Desktop");
  }

  const chatName = ctx.title || data.name || ctx.filename.replace(/\.json$/i, "");
  const sourceId = randomUUID();
  const peopleTouched: Person[] = [ctx.self];

  // Register speakers
  const speakerToPerson = new Map<string, Person>();
  speakerToPerson.set(ctx.self.canonicalName, ctx.self);

  const messageRows: Array<{
    from: string;
    text: string;
    date?: string;
    personId?: string;
  }> = [];

  for (const msg of data.messages) {
    if (msg.type && msg.type !== "message") continue;
    const text = extractTelegramText(msg.text).trim();
    if (!text) continue;
    const from = (msg.from || msg.actor || "Unknown").trim();
    const fromId = msg.from_id || msg.actor_id;

    let person = speakerToPerson.get(from);
    if (!person) {
      person = upsertPerson(ctx.store, {
        name: from,
        telegramId: fromId ? String(fromId) : undefined,
        relationToSelf: isSelfName(from) ? "self" : "other",
      });
      speakerToPerson.set(from, person);
      if (!peopleTouched.some((p) => p.id === person!.id)) {
        peopleTouched.push(person);
      }
    } else if (fromId) {
      person = upsertPerson(ctx.store, {
        name: from,
        telegramId: String(fromId),
        relationToSelf: person.relationToSelf,
      });
    }

    messageRows.push({
      from: person.isSelf ? "Кирилл" : person.canonicalName,
      text,
      date: msg.date,
      personId: person.id,
    });
  }

  // Prefer peer = non-self with most messages in personal chats
  const counts = new Map<string, number>();
  for (const row of messageRows) {
    if (!row.personId || row.personId === ctx.self.id) continue;
    counts.set(row.personId, (counts.get(row.personId) || 0) + 1);
  }
  let peer: Person | null = null;
  if (counts.size > 0) {
    const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    peer = peopleTouched.find((p) => p.id === topId) || null;
    if (peer && ctx.markPeerClose && peer.relationToSelf !== "self") {
      peer.relationToSelf = "close";
      peer = upsertPerson(ctx.store, {
        name: peer.canonicalName,
        relationToSelf: "close",
        telegramId: peer.telegramIds[0],
      });
    }
  } else if (data.name && !isSelfName(data.name)) {
    peer = upsertPerson(ctx.store, {
      name: data.name,
      relationToSelf: ctx.markPeerClose ? "close" : "other",
    });
    if (!peopleTouched.some((p) => p.id === peer!.id)) peopleTouched.push(peer);
  }

  const dates = messageRows.map((m) => m.date).filter(Boolean) as string[];
  const windows = windowMessages(messageRows);
  const chunks = windows.map((w) =>
    makeChunk({
      sourceId,
      text: w.text,
      title: w.title,
      kind: "message_window",
      timestamp: w.timestamp,
      personIds: w.personIds.length
        ? w.personIds
        : [ctx.self.id, ...(peer ? [peer.id] : [])],
    }),
  );

  const sampleText = messageRows
    .slice(0, 400)
    .map((m) => m.text)
    .join("\n");

  const facts = heuristicFactsFromChat({
    sourceId,
    self: ctx.self,
    peer,
    chunks,
    sampleText,
  });

  // Identity fact for peer
  if (peer) {
    facts.unshift(
      makeFact({
        sourceId,
        personIds: [peer.id, ctx.self.id],
        kind: "identity",
        title: peer.canonicalName,
        detail: `Участник личной переписки Telegram «${chatName}» с Кириллом. Сообщений в экспорте: ${messageRows.length}.`,
        evidenceChunkIds: chunks.slice(0, 2).map((c) => c.id),
        confidence: "high",
      }),
    );
  }

  const source: Source = {
    id: sourceId,
    type: "telegram_chat",
    title: chatName,
    path: "",
    rawRef: "",
    participants: [...new Set(messageRows.map((m) => m.from))],
    personIds: peopleTouched.map((p) => p.id),
    ingestedAt: new Date().toISOString(),
    meta: {
      chatId: data.id,
      chatType: data.type,
      messageCount: messageRows.length,
      peerName: peer?.canonicalName,
      originalFilename: ctx.filename,
      dateRange: {
        from: dates[0],
        to: dates[dates.length - 1],
      },
    },
    summary: peer
      ? `Telegram-чат с ${peer.canonicalName}: ${messageRows.length} сообщений.`
      : `Telegram-чат «${chatName}»: ${messageRows.length} сообщений.`,
    chunkIds: [],
    factIds: [],
  };

  return { source, chunks, facts, peopleTouched };
}
