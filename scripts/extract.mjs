#!/usr/bin/env node
/**
 * CLI: extract Fact candidates from pending sources via local Next API or direct.
 * Usage: npm run extract -- [limit]
 */
const limit = Number(process.argv[2] || 3);
const base = process.env.SMYSL_URL || "http://127.0.0.1:3847";

const res = await fetch(`${base}/api/extract`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ limit }),
});
const data = await res.json();
if (!res.ok) {
  console.error(data);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
