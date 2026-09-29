import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";

export interface UnzippedChatExport {
  /** Absolute path to result.json */
  resultJsonPath: string;
  /** Absolute path to export folder (parent of result.json) */
  exportDir: string;
  /** Display title hint from folder name */
  titleHint?: string;
}

const RESULT_NAMES = new Set(["result.json", "messages.json"]);

/**
 * Extract a Telegram ChatExport zip into destRoot and locate result.json files.
 * Supports zip with one or many ChatExport folders, or result.json at zip root.
 */
export async function extractChatExportZip(
  zipBuffer: Buffer,
  destRoot: string,
): Promise<UnzippedChatExport[]> {
  await fs.mkdir(destRoot, { recursive: true });
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(destRoot, true);

  const found: UnzippedChatExport[] = [];
  await walkForResults(destRoot, destRoot, found);

  // Prefer deeper ChatExport_* folders; dedupe by exportDir
  const byDir = new Map<string, UnzippedChatExport>();
  for (const item of found) {
    byDir.set(item.exportDir, item);
  }
  const list = [...byDir.values()].sort((a, b) =>
    a.exportDir.localeCompare(b.exportDir),
  );
  if (!list.length) {
    throw new Error(
      "В архиве нет result.json. Нужен JSON-экспорт Telegram Desktop (папка ChatExport_* или zip с ней).",
    );
  }
  return list;
}

async function walkForResults(
  root: string,
  dir: string,
  out: UnzippedChatExport[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // skip macOS junk / hidden
      if (ent.name === "__MACOSX" || ent.name.startsWith(".")) continue;
      await walkForResults(root, full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (!RESULT_NAMES.has(ent.name.toLowerCase())) continue;
    const exportDir = path.dirname(full);
    const base = path.basename(exportDir);
    out.push({
      resultJsonPath: full,
      exportDir,
      titleHint: /ChatExport_/i.test(base) ? base : undefined,
    });
  }
}

export async function unzipToTemp(
  zipBuffer: Buffer,
  baseTmpDir: string,
): Promise<{ tmpDir: string; exports: UnzippedChatExport[] }> {
  const tmpDir = path.join(baseTmpDir, `tgzip-${randomUUID()}`);
  const exports = await extractChatExportZip(zipBuffer, tmpDir);
  return { tmpDir, exports };
}

export async function rmTempQuiet(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
