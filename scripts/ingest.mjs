#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "fs";
import { basename, dirname, join, resolve } from "path";

const args = process.argv.slice(2);
let type = "auto";
const inputs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--type") {
    type = args[++i] || "auto";
  } else {
    inputs.push(args[i]);
  }
}

if (!inputs.length) {
  console.error(
    "Usage: npm run ingest -- [--type telegram|meeting|note|file|auto] <path> [more…]",
  );
  console.error(
    "  <path>: result.json | ChatExport_* folder | .zip (one or many chats)",
  );
  process.exit(1);
}

const port = process.env.PORT || 3847;
const normalizedType = type === "telegram" ? "telegram_chat" : type;

function resolveSource(input) {
  const absolute = resolve(input);
  if (!existsSync(absolute)) {
    throw new Error(`Path not found: ${absolute}`);
  }
  const st = statSync(absolute);
  if (st.isDirectory()) {
    const candidates = [
      join(absolute, "result.json"),
      join(absolute, "messages.json"),
    ];
    const hit = candidates.find((p) => existsSync(p));
    if (!hit) {
      throw new Error(
        `No result.json in folder: ${absolute}\nExpected Telegram Desktop JSON export.`,
      );
    }
    return { kind: "dir", file: hit, exportDir: absolute };
  }
  if (absolute.toLowerCase().endsWith(".zip")) {
    return { kind: "zip", file: absolute };
  }
  const parent = dirname(absolute);
  const looksLikeExport =
    /ChatExport_/i.test(parent) ||
    existsSync(join(parent, "photos")) ||
    existsSync(join(parent, "voice_messages")) ||
    existsSync(join(parent, "files")) ||
    existsSync(join(parent, "video_files"));
  return {
    kind: "file",
    file: absolute,
    exportDir: looksLikeExport ? parent : undefined,
  };
}

async function postJson(body) {
  const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(data);
    process.exit(1);
  }
  return data;
}

async function postZip(filePath, sendType) {
  const buf = readFileSync(filePath);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([buf], { type: "application/zip" }),
    basename(filePath),
  );
  fd.append("type", sendType);
  fd.append(
    "markPeerClose",
    sendType === "telegram_chat" || sendType === "auto" ? "true" : "false",
  );
  fd.append("syncPalace", "true");
  const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(filePath, data);
    process.exit(1);
  }
  return data;
}

for (const input of inputs) {
  const resolved = resolveSource(input);

  if (resolved.kind === "zip") {
    const sendType =
      normalizedType === "auto" ? "telegram_chat" : normalizedType;
    console.error(`==> ZIP ${resolved.file}`);
    const data = await postZip(resolved.file, sendType);
    console.log(
      JSON.stringify(
        {
          input,
          zip: true,
          exportCount: data.exportCount,
          results: (data.results || []).map((r) => ({
            sourceId: r.source.id,
            title: r.source.title,
            chunks: r.chunkCount,
            facts: r.factCount,
            attachments: r.attachmentCount,
            palace: r.palace,
          })),
        },
        null,
        2,
      ),
    );
    continue;
  }

  const absolute = resolved.file;
  const text = readFileSync(absolute, "utf8");
  const inferredTelegram =
    normalizedType === "auto" &&
    (basename(absolute) === "result.json" ||
      /ChatExport_/i.test(input) ||
      text.includes('"messages"'));
  const sendType =
    normalizedType === "auto" && inferredTelegram
      ? "telegram_chat"
      : normalizedType;

  const data = await postJson({
    text,
    filename: basename(absolute),
    type: sendType,
    markPeerClose: sendType === "telegram_chat" || sendType === "auto",
    syncPalace: true,
    exportDir: resolved.exportDir || undefined,
  });

  console.log(
    JSON.stringify(
      {
        input,
        file: absolute,
        exportDir: resolved.exportDir || null,
        sourceId: data.source.id,
        title: data.source.title,
        type: data.source.type,
        chunks: data.chunkCount,
        facts: data.factCount,
        attachments: data.attachmentCount ?? 0,
        mediaCount: data.source?.meta?.mediaCount ?? 0,
        people: data.people,
        palace: data.palace ?? null,
      },
      null,
      2,
    ),
  );
}
