#!/usr/bin/env node
import { readFileSync } from "fs";
import { basename, resolve } from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run ingest -- <path-to-meeting.md>");
  process.exit(1);
}

const absolute = resolve(file);
const text = readFileSync(absolute, "utf8");
const port = process.env.PORT || 3847;
const res = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, filename: basename(absolute) }),
});
const data = await res.json();
if (!res.ok) {
  console.error(data);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
