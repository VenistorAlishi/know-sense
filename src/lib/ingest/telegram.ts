import { randomUUID } from "crypto";
import { isSelfName } from "../bootstrap";
import type {
  Attachment,
  AttachmentKind,
  Chunk,
  DeriveStatus,
  Fact,
  KnowledgeStore,
  Person,
  Source,
} from "../types";
import { upsertPerson } from "../store";
import { heuristicFactsFromText, makeChunk, makeFact } from "./helpers";

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
  photo?: string;
  file?: string;
  thumbnail?: string;
  media_type?: string;
  mime_type?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  file_name?: string;
  file_size?: number;
  sticker_emoji?: string;
  contact_information?: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  };
  location_information?: {
    latitude?: number;
    longitude?: number;
  };
  poll?: {
    question?: string;
    answers?: Array<{ text?: string; voters?: number }>;
  };
  forwarded_from?: string;
  reply_to_message_id?: number;
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

function kindFromPath(ref: string, mediaType?: string, mime?: string): AttachmentKind {
  const r = ref.replace(/\\/g, "/").toLowerCase();
  const mt = (mediaType || "").toLowerCase();
  if (r.includes("voice_messages/") || mt === "voice_message") return "voice";
  if (r.includes("round_video_messages/") || mt === "video_message") return "video_note";
  if (r.includes("video_files/") || mt === "video_file") return "video";
  if (r.includes("stickers/") || mt === "sticker") return "sticker";
  if (r.includes("photos/") || mt === "photo" || !!mime?.startsWith("image/")) {
    if (mt === "animation" || r.endsWith(".gif") || r.endsWith(".webp")) {
      return mt === "sticker" ? "sticker" : "animation";
    }
    return "photo";
  }
  if (r.includes("files/") || mt === "audio_file" || mime?.startsWith("audio/")) {
    if (mime?.startsWith("audio/") || mt === "audio_file") return "audio";
    return "document";
  }
  if (mt === "animation") return "animation";
  return "other";
}

function fileRefFromMessage(msg: TgMessage): string | undefined {
  const raw = msg.file || msg.photo || msg.thumbnail;
  if (!raw || typeof raw !== "string") return undefined;
  return raw.replace(/\\/g, "/");
}

function mediaLabel(kind: AttachmentKind, msg: TgMessage, caption: string): string {
  const dur =
    typeof msg.duration_seconds === "number" ? ` ${msg.duration_seconds}s` : "";
  const emoji = msg.sticker_emoji ? ` ${msg.sticker_emoji}` : "";
  const base = `[${kind}${dur}${emoji}]`;
  return caption ? `${base} ${caption}` : base;
}

function deriveStatusFor(kind: AttachmentKind, hasFile: boolean): DeriveStatus {
  if (!hasFile) return "none";
  if (
    kind === "voice" ||
    kind === "audio" ||
    kind === "video" ||
    kind === "video_note" ||
    kind === "photo" ||
    kind === "document" ||
    kind === "animation"
  ) {
    return "pending";
  }
  return "none";
}

function extractStructuredMedia(msg: TgMessage): {
  kind: AttachmentKind;
  caption: string;
  ref?: string;
} | null {
  if (msg.contact_information) {
    const c = msg.contact_information;
    const caption = [c.first_name, c.last_name, c.phone_number]
      .filter(Boolean)
      .join(" ");
    return { kind: "contact", caption: caption || "contact" };
  }
  if (msg.location_information) {
    const loc = msg.location_information;
    return {
      kind: "location",
      caption: `${loc.latitude ?? "?"}, ${loc.longitude ?? "?"}`,
    };
  }
  if (msg.poll) {
    const answers = (msg.poll.answers || [])
      .map((a) => a.text)
      .filter(Boolean)
      .join("; ");
    return {
      kind: "poll",
      caption: `${msg.poll.question || "poll"}${answers ? ` — ${answers}` : ""}`,
    };
  }
  const ref = fileRefFromMessage(msg);
  if (ref || msg.media_type) {
    const kind = kindFromPath(ref || "", msg.media_type, msg.mime_type);
    const caption = extractTelegramText(msg.text).trim();
    return { kind, caption, ref };
  }
  return null;
}

function heuristicFactsFromChat(input: {
  sourceId: string;
  self: Person;
  peer: Person | null;
  chunks: Chunk[];
  sampleText: string;
}): Fact[] {
  const personIds = [input.self.id, ...(input.peer ? [input.peer.id] : [])];
  const evidence = input.chunks.slice(0, 3).map((c) => c.id);
  const facts: Fact[] = [];

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
        origin: "heuristic",
      }),
    );
  }

  facts.push(
    ...heuristicFactsFromText({
      sourceId: input.sourceId,
      personIds,
      text: input.sampleText,
      chunkIds: evidence,
      origin: "heuristic",
    }),
  );

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
  attachments: Attachment[];
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

  const speakerToPerson = new Map<string, Person>();
  speakerToPerson.set(ctx.self.canonicalName, ctx.self);

  const messageRows: Array<{
    from: string;
    text: string;
    date?: string;
    personId?: string;
  }> = [];
  const attachments: Attachment[] = [];
  const mediaChunks: Chunk[] = [];
  let textMessageCount = 0;

  const resolvePerson = (msg: TgMessage): Person => {
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
    return person;
  };

  for (const msg of data.messages) {
    if (msg.type && msg.type !== "message" && msg.type !== "service") {
      // keep service only if media somehow attached — normally skip non-message
      if (msg.type !== "message") continue;
    }
    if (msg.type === "service") continue;

    const text = extractTelegramText(msg.text).trim();
    const media = extractStructuredMedia(msg);
    if (!text && !media) continue;

    const person = resolvePerson(msg);
    const displayName = person.isSelf ? "Кирилл" : person.canonicalName;
    const personIds = [person.id];

    if (text) {
      textMessageCount += 1;
      messageRows.push({
        from: displayName,
        text,
        date: msg.date,
        personId: person.id,
      });
    }

    if (media) {
      const attId = randomUUID();
      const hasFile = Boolean(media.ref);
      const status = deriveStatusFor(media.kind, hasFile);
      const label = mediaLabel(media.kind, msg, media.caption);
      const chunk = makeChunk({
        sourceId,
        text: `${displayName}: ${label}`,
        title: `Медиа ${media.kind}${msg.date ? ` ${msg.date}` : ""}`.trim(),
        kind: "media_ref",
        speaker: displayName,
        timestamp: msg.date,
        personIds,
        attachmentIds: [attId],
        telegramMessageId: msg.id,
      });
      mediaChunks.push(chunk);

      const originalName =
        msg.file_name ||
        (media.ref ? media.ref.split("/").pop() : undefined) ||
        media.kind;

      attachments.push({
        id: attId,
        sourceId,
        messageId: msg.id,
        chunkId: chunk.id,
        kind: media.kind,
        mime: msg.mime_type,
        originalName,
        storedPath: "",
        byteSize: msg.file_size,
        width: msg.width,
        height: msg.height,
        durationSec: msg.duration_seconds,
        caption: media.caption || undefined,
        telegramFileRef: media.ref,
        deriveStatus: status,
        personIds,
        timestamp: msg.date,
        createdAt: new Date().toISOString(),
      });

      // Also fold short media label into text windows so chronology stays dense
      if (!text) {
        messageRows.push({
          from: displayName,
          text: label,
          date: msg.date,
          personId: person.id,
        });
      }
    }
  }

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
  const textChunks = windows.map((w) =>
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

  const chunks = [...textChunks, ...mediaChunks];

  const sampleText = messageRows
    .slice(0, 400)
    .map((m) => m.text)
    .join("\n");

  const facts = heuristicFactsFromChat({
    sourceId,
    self: ctx.self,
    peer,
    chunks: textChunks.length ? textChunks : chunks,
    sampleText,
  });

  if (peer) {
    facts.unshift(
      makeFact({
        sourceId,
        personIds: [peer.id, ctx.self.id],
        kind: "identity",
        title: peer.canonicalName,
        detail: `Участник личной переписки Telegram «${chatName}» с Кириллом. Сообщений (текст): ${textMessageCount}; медиа: ${attachments.length}.`,
        evidenceChunkIds: chunks.slice(0, 2).map((c) => c.id),
        confidence: "high",
      }),
    );
  }

  if (attachments.length) {
    const byKind = attachments.reduce(
      (acc, a) => {
        acc[a.kind] = (acc[a.kind] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const kindSummary = Object.entries(byKind)
      .map(([k, n]) => `${k}:${n}`)
      .join(", ");
    facts.push(
      makeFact({
        sourceId,
        personIds: [ctx.self.id, ...(peer ? [peer.id] : [])],
        kind: "context",
        title: `Медиа в чате: ${attachments.length}`,
        detail: `Вложений Telegram: ${kindSummary}. Слоты deriveStatus=pending готовы для ASR/OCR.`,
        evidenceChunkIds: mediaChunks.slice(0, 3).map((c) => c.id),
        confidence: "high",
        origin: "heuristic",
        status: "open",
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
      textMessageCount,
      mediaCount: attachments.length,
      peerName: peer?.canonicalName,
      originalFilename: ctx.filename,
      attachmentIds: attachments.map((a) => a.id),
      dateRange: {
        from: dates[0],
        to: dates[dates.length - 1],
      },
    },
    summary: peer
      ? `Telegram-чат с ${peer.canonicalName}: ${textMessageCount} текст, ${attachments.length} медиа.`
      : `Telegram-чат «${chatName}»: ${textMessageCount} текст, ${attachments.length} медиа.`,
    chunkIds: [],
    factIds: [],
  };

  return { source, chunks, facts, peopleTouched, attachments };
}
