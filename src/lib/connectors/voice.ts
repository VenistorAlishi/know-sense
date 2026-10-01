import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { ingestSource } from "@/lib/ingest";
import { materializeAttachments, loadStore, saveStore } from "@/lib/store";
import { makeChunk } from "@/lib/ingest/helpers";
import { pushJob, upsertConnection } from "./store";
import type { SyncJobResult } from "./types";
import type { Attachment } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "sources", "_voice_inbox");

async function runCmd(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      resolve({ code: 1, stdout, stderr: String(err) });
    });
  });
}

/** Transcribe audio file → text. Prefer local whisper CLI, then OpenAI Whisper API. */
export async function transcribeAudio(filePath: string): Promise<{
  text: string;
  engine: string;
}> {
  // 1) whisper.cpp / openai-whisper CLI if present
  for (const [bin, args] of [
    ["whisper", [filePath, "--language", "ru", "--model", "base", "--output_format", "txt", "--output_dir", path.dirname(filePath)]],
    ["whisper-cli", ["-m", process.env.WHISPER_MODEL || "base", "-l", "ru", "-f", filePath]],
  ] as Array<[string, string[]]>) {
    const probe = await runCmd("bash", ["-lc", `command -v ${bin}`]);
    if (probe.code !== 0 || !probe.stdout.trim()) continue;
    const r = await runCmd(bin, args);
    if (r.code === 0) {
      const txtSide = filePath.replace(/\.[^.]+$/, ".txt");
      try {
        const t = (await fs.readFile(txtSide, "utf8")).trim();
        if (t) return { text: t, engine: bin };
      } catch {
        /* fall through */
      }
      const out = (r.stdout || "").trim();
      if (out) return { text: out, engine: bin };
    }
  }

  // 2) Python faster-whisper helper if installed
  const py = path.join(process.cwd(), "scripts", "transcribe_whisper.py");
  try {
    await fs.access(py);
    const r = await runCmd("python3", [py, filePath]);
    if (r.code === 0 && r.stdout.trim()) {
      return { text: r.stdout.trim(), engine: "faster-whisper" };
    }
  } catch {
    /* ignore */
  }

  // 3) OpenAI Whisper API
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    const buf = await fs.readFile(filePath);
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([Uint8Array.from(buf)], { type: "application/octet-stream" }),
      path.basename(filePath),
    );
    fd.append("model", "whisper-1");
    fd.append("language", "ru");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      if (data.text?.trim()) {
        return { text: data.text.trim(), engine: "openai-whisper-1" };
      }
    }
  }

  throw new Error(
    "ASR unavailable. Install whisper CLI / scripts/transcribe_whisper.py (faster-whisper), or set OPENAI_API_KEY.",
  );
}

export async function ingestVoiceNote(input: {
  buffer: Buffer;
  filename: string;
  title?: string;
  mime?: string;
}): Promise<{
  sourceId: string;
  attachmentId: string;
  transcript: string;
  engine: string;
}> {
  await fs.mkdir(VOICE_DIR, { recursive: true });
  const safe = input.filename.replace(/[^\w.\-а-яё]+/gi, "_").slice(0, 80);
  const stamp = Date.now();
  const abs = path.join(VOICE_DIR, `${stamp}_${safe || "voice.ogg"}`);
  await fs.writeFile(abs, input.buffer);

  let transcript = "";
  let engine = "none";
  let deriveError: string | undefined;
  try {
    const t = await transcribeAudio(abs);
    transcript = t.text;
    engine = t.engine;
  } catch (e) {
    deriveError = String(e);
  }

  const title =
    input.title ||
    (transcript
      ? `Голос: ${transcript.slice(0, 60)}${transcript.length > 60 ? "…" : ""}`
      : `Голосовая заметка ${new Date().toLocaleString("ru-RU")}`);

  const body = transcript
    ? transcript
    : `[voice] Файл ${input.filename} сохранён; транскрипт недоступен${deriveError ? `: ${deriveError}` : ""}.`;

  const result = await ingestSource({
    text: body,
    filename: `${safe || "voice"}.md`,
    type: "voice_note",
    title,
    syncPalace: true,
  });

  const sourceId = result.source.id;
  const attId = randomUUID();
  const relStored = path.join(
    "data",
    "sources",
    sourceId,
    "media",
    "voice",
    path.basename(abs),
  );
  const mediaAbs = path.join(process.cwd(), relStored);
  await fs.mkdir(path.dirname(mediaAbs), { recursive: true });
  await fs.copyFile(abs, mediaAbs);

  const attachment: Attachment = {
    id: attId,
    sourceId,
    kind: "voice",
    mime: input.mime || "audio/ogg",
    originalName: input.filename,
    storedPath: relStored,
    byteSize: input.buffer.length,
    deriveStatus: transcript ? "done" : "failed",
    derivedText: transcript || undefined,
    deriveError,
    personIds: result.people.filter((p) => p.isSelf).map((p) => p.id),
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const materialized = await materializeAttachments({
    sourceId,
    attachments: [attachment],
  });
  // materialize won't copy without telegramFileRef — patch store directly
  const store = await loadStore();
  const att = materialized[0] || attachment;
  if (!att.storedPath) att.storedPath = relStored;
  if (transcript) {
    att.derivedText = transcript;
    att.deriveStatus = "done";
  }
  store.attachments.push(att);
  const src = store.sources.find((s) => s.id === sourceId);
  if (src) {
    src.meta = {
      ...src.meta,
      mediaCount: (src.meta.mediaCount || 0) + 1,
      attachmentIds: [...(src.meta.attachmentIds || []), att.id],
      extractedAt: engine,
    };
    // Upgrade primary chunk kind to transcript when we have text
    if (transcript) {
      for (const c of store.chunks) {
        if (c.sourceId === sourceId && c.kind === "note") {
          c.kind = "transcript";
          c.attachmentIds = [att.id];
        }
      }
    }
  }
  await saveStore(store);

  return {
    sourceId,
    attachmentId: att.id,
    transcript,
    engine,
  };
}

/**
 * Transcribe Attachment rows with deriveStatus=pending (TG voice/audio etc.).
 * Creates transcript chunks and marks attachments done/failed.
 */
export async function backfillPendingAudio(opts?: {
  limit?: number;
}): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const limit = opts?.limit ?? 25;
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const store = await loadStore();
  const pending = (store.attachments || [])
    .filter(
      (a) =>
        a.deriveStatus === "pending" &&
        (a.kind === "voice" || a.kind === "audio" || a.kind === "video_note") &&
        a.storedPath,
    )
    .slice(0, limit);

  if (!pending.length) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "voice",
      status: "ok",
      imported: 0,
      skipped: 0,
      errors: [],
      startedAt,
      finishedAt,
      detail: "No pending voice/audio attachments",
    };
    await upsertConnection({
      id: "voice",
      status: "connected",
      lastSyncAt: finishedAt,
      lastSyncStatus: "ok",
    });
    await pushJob(job);
    return job;
  }

  for (const att of pending) {
    const abs = path.isAbsolute(att.storedPath)
      ? att.storedPath
      : path.join(process.cwd(), att.storedPath);
    try {
      await fs.access(abs);
      const { text, engine } = await transcribeAudio(abs);
      if (!text.trim()) {
        att.deriveStatus = "failed";
        att.deriveError = "Empty transcript";
        skipped += 1;
        continue;
      }
      att.derivedText = text;
      att.deriveStatus = "done";
      att.deriveError = undefined;

      const chunk = makeChunk({
        sourceId: att.sourceId,
        text,
        title: `Транскрипт ${att.kind}${att.timestamp ? ` ${att.timestamp}` : ""}`,
        kind: "transcript",
        timestamp: att.timestamp,
        personIds: att.personIds.length ? att.personIds : [],
        attachmentIds: [att.id],
        telegramMessageId: att.messageId,
      });
      store.chunks.push(chunk);
      const src = store.sources.find((s) => s.id === att.sourceId);
      if (src && !src.chunkIds.includes(chunk.id)) {
        src.chunkIds.push(chunk.id);
        src.meta = { ...src.meta, extractedAt: engine };
      }
      // Link media_ref chunk if present
      if (att.chunkId) {
        const ref = store.chunks.find((c) => c.id === att.chunkId);
        if (ref) {
          ref.attachmentIds = [...new Set([...(ref.attachmentIds || []), att.id])];
        }
      }
      imported += 1;
    } catch (e) {
      att.deriveStatus = "failed";
      att.deriveError = String(e);
      errors.push(`${att.id}: ${String(e)}`);
    }
  }

  await saveStore(store);
  const finishedAt = new Date().toISOString();
  const job: SyncJobResult = {
    connectorId: "voice",
    status: errors.length && !imported ? "error" : "ok",
    imported,
    skipped,
    errors: errors.slice(0, 20),
    startedAt,
    finishedAt,
    detail: `ASR backfill ${imported}/${pending.length} (limit ${limit})`,
  };
  await upsertConnection({
    id: "voice",
    status: "connected",
    lastSyncAt: finishedAt,
    lastSyncStatus: job.status,
    lastError: errors[0],
  });
  await pushJob(job);
  return job;
}
