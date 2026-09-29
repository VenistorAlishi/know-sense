#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "fs";
import { basename, join, resolve } from "path";

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
    "Usage: npm run ingest -- [--type telegram|meeting|note|file|auto] <path> [more paths...]",
  );
  console.error(
    "  <path> may be result.json or a ChatExport_* folder containing result.json",
  );
  process.exit(1);
}

const port = process.env.PORT || 3847;

const normalizedType =
  type === "telegram" ? "telegram_chat" : type;

/** Resolve ChatExport folder → result.json (or keep file path). */
function resolveSourcePath(input) {
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
    return hit;
  }
  return absolute;
}

for (const input of inputs) {
  const absolute = resolveSourcePath(input);
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

  const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      filename: basename(absolute),
      type: sendType,
      markPeerClose: sendType === "telegram_chat" || sendType === "auto",
      syncPalace: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(input, data);
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        input,
        file: absolute,
        sourceId: data.source.id,
        title: data.source.title,
        type: data.source.type,
        chunks: data.chunkCount,
        facts: data.factCount,
        people: data.people,
        palace: data.palace ?? null,
      },
      null,
      2,
    ),
  );
}
