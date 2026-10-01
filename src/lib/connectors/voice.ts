import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { ingestSource } from "@/lib/ingest";
import { materializeAttachments, loadStore, saveStore } from "@/lib/store";
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
