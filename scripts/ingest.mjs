#!/usr/bin/env node
import { readFileSync } from "fs";
import { basename, resolve } from "path";

const args = process.argv.slice(2);
let type = "auto";
const files = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--type") {
    type = args[++i] || "auto";
  } else {
    files.push(args[i]);
  }
}

if (!files.length) {
  console.error(
    "Usage: npm run ingest -- [--type telegram|meeting|note|file|auto] <path> [more paths...]",
  );
  process.exit(1);
}

const port = process.env.PORT || 3847;

const normalizedType =
  type === "telegram" ? "telegram_chat" : type;

for (const file of files) {
  const absolute = resolve(file);
  const text = readFileSync(absolute, "utf8");
  const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      filename: basename(absolute),
      type: normalizedType,
      markPeerClose:
        normalizedType === "telegram_chat" || normalizedType === "auto",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(file, data);
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        file,
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
