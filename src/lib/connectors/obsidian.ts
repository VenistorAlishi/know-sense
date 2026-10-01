import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ingestSource } from "@/lib/ingest";
import { ingestPlainText } from "@/lib/ingest/text";
import { getSelf, loadStore, saveStore } from "@/lib/store";
import { getConnection, upsertConnection, pushJob } from "./store";
import type { ConnectorConnection, SyncJobResult } from "./types";

const SKIP_DIRS = new Set([
  ".obsidian",
  ".trash",
  ".git",
  ".smart-env",
  "node_modules",
  ".vscode",
  ".idea",
]);

export function vaultPathFrom(
  conn?: ConnectorConnection | null,
): string | null {
  const fromConn = conn?.tokens?.meta?.vaultPath?.trim() || "";
  const fromEnv = process.env.OBSIDIAN_VAULT_PATH?.trim() || "";
  return fromConn || fromEnv || null;
}

export function obsidianConfigured(
  conn?: ConnectorConnection | null,
): boolean {
  return Boolean(vaultPathFrom(conn));
}

export async function saveObsidianVaultPath(vaultPath: string): Promise<void> {
  const resolved = path.resolve(vaultPath.trim());
  const st = await fs.stat(resolved);
  if (!st.isDirectory()) {
    throw new Error("Путь должен указывать на папку vault");
  }
  // Prefer a vault that looks like Obsidian (has .obsidian) but allow any md folder
  await upsertConnection({
    id: "obsidian",
    status: "connected",
    enabled: true,
    tokens: { meta: { vaultPath: resolved } },
    lastError: undefined,
  });
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function parseFrontmatter(raw: string): {
  body: string;
  title?: string;
  tags: string[];
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) {
    const tags = Array.from(raw.matchAll(/(?:^|\s)#([\w\u0400-\u04FF/-]+)/g)).map(
      (x) => x[1],
    );
    return { body: raw, tags: [...new Set(tags)].slice(0, 24) };
  }
  const fm = m[1];
  const body = m[2];
  let title: string | undefined;
  const tags: string[] = [];
  for (const line of fm.split(/\r?\n/)) {
    const titleMatch = line.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/^["']|["']$/g, "").trim();
      continue;
    }
    const tagsInline = line.match(/^tags:\s*\[(.*)\]\s*$/i);
    if (tagsInline) {
      for (const t of tagsInline[1].split(",")) {
        const clean = t.trim().replace(/^["'#]|["']$/g, "");
        if (clean) tags.push(clean);
      }
      continue;
    }
    const tagLine = line.match(/^-\s+#?([\w\u0400-\u04FF/-]+)\s*$/);
    if (tagLine && /tags:/i.test(fm.slice(0, fm.indexOf(line) + 1) || "")) {
      tags.push(tagLine[1]);
    }
  }
  // also collect body hashtags
  for (const x of body.matchAll(/(?:^|\s)#([\w\u0400-\u04FF/-]+)/g)) {
    tags.push(x[1]);
  }
  return { body, title, tags: [...new Set(tags)].slice(0, 24) };
}

/** Keep wiki links readable: [[Note|Alias]] → Alias, [[Note]] → Note */
export function normalizeObsidianMarkdown(raw: string): string {
  return raw
    .replace(/!\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g, "![[$1]]")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]|#]+)(?:#[^\]]+)?\]\]/g, "$1");
}

async function walkMarkdown(
  root: string,
  dir: string,
  out: string[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      await walkMarkdown(root, abs, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".md")) continue;
    out.push(abs);
  }
}

export async function syncObsidian(opts?: {
  limit?: number;
}): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let updated = 0;
  const limit = opts?.limit ?? 200;

  const conn = await getConnection("obsidian");
  const vault = vaultPathFrom(conn);
  if (!vault) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "obsidian",
      status: "error",
      imported: 0,
      skipped: 0,
      errors: [
        "Задай путь к vault: OBSIDIAN_VAULT_PATH или форма на /obsidian.",
      ],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "obsidian",
      status: "needs_auth",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: job.errors[0],
    });
    await pushJob(job);
    return job;
  }

  try {
    const files: string[] = [];
    await walkMarkdown(vault, vault, files);
    files.sort();
    const batch = files.slice(0, limit);

    const store = await loadStore();
    const byPath = new Map(
      store.sources
        .filter((s) => s.type === "obsidian" && s.meta.obsidianPath)
        .map((s) => [s.meta.obsidianPath!, s]),
    );

    for (const abs of batch) {
      const rel = path.relative(vault, abs).split(path.sep).join("/");
      try {
        const raw = await fs.readFile(abs, "utf8");
        if (!raw.trim()) {
          skipped += 1;
          continue;
        }
        const hash = contentHash(raw);
        const existing = byPath.get(rel);
        if (existing?.meta.obsidianHash === hash) {
          skipped += 1;
          continue;
        }

        const { body, title: fmTitle, tags } = parseFrontmatter(raw);
        const text = normalizeObsidianMarkdown(body.trim() || raw);
        const title =
          fmTitle ||
          path.basename(rel, path.extname(rel)).replace(/[_-]+/g, " ");
        const meta = {
          obsidianPath: rel,
          obsidianHash: hash,
          obsidianTags: tags,
          originalFilename: rel,
          exportDir: vault,
        };

        if (existing) {
          // In-place refresh: replace chunks/facts for this source
          const live = await loadStore();
          const self = getSelf(live);
          const built = ingestPlainText(
            text,
            { store: live, self, filename: rel, title },
            "note",
          );
          const src = live.sources.find((s) => s.id === existing.id);
          if (!src) {
            skipped += 1;
            continue;
          }
          const oldChunkIds = new Set(src.chunkIds);
          const oldFactIds = new Set(src.factIds);
          live.chunks = live.chunks.filter((c) => !oldChunkIds.has(c.id));
          live.facts = live.facts.filter((f) => !oldFactIds.has(f.id));
          for (const c of built.chunks) c.sourceId = src.id;
          for (const f of built.facts) f.sourceId = src.id;
          src.title = title;
          src.summary = text.slice(0, 280);
          src.type = "obsidian";
          src.path = abs;
          src.meta = { ...src.meta, ...meta };
          src.chunkIds = built.chunks.map((c) => c.id);
          src.factIds = built.facts.map((f) => f.id);
          src.ingestedAt = new Date().toISOString();
          live.chunks.push(...built.chunks);
          live.facts.push(...built.facts);
          await saveStore(live);
          updated += 1;
        } else {
          await ingestSource({
            text,
            filename: rel,
            type: "obsidian",
            title,
            syncPalace: true,
            meta,
          });
          imported += 1;
        }
      } catch (e) {
        errors.push(`${rel}: ${String(e)}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "obsidian",
      status: errors.length && !imported && !updated ? "error" : "ok",
      imported: imported + updated,
      skipped,
      errors: errors.slice(0, 20),
      startedAt,
      finishedAt,
      detail: `${vault} · ${batch.length}/${files.length} files · +${imported} ~${updated}`,
    };
    await upsertConnection({
      id: "obsidian",
      status: "connected",
      lastSyncAt: finishedAt,
      lastSyncStatus: job.status,
      lastError: errors[0],
      cursor: {
        vault,
        fileCount: String(files.length),
        syncedAt: finishedAt,
      },
    });
    await pushJob(job);
    return job;
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "obsidian",
      status: "error",
      imported,
      skipped,
      errors: [String(e)],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "obsidian",
      status: "error",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: String(e),
    });
    await pushJob(job);
    return job;
  }
}
