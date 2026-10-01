import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { ingestSource } from "@/lib/ingest";
import { listStats } from "@/lib/store";
import { rmTempQuiet, unzipToTemp } from "@/lib/ingest/unzip-export";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";
/** Allow large ChatExport zip uploads (media-heavy). */
export const maxDuration = 300;

const TMP_BASE = path.join(process.cwd(), "data", "tmp");

function isZipFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

export async function GET() {
  const { counts, self, store } = await listStats();
  return NextResponse.json({
    version: store.version,
    updatedAt: store.updatedAt,
    self: { id: self.id, name: self.canonicalName },
    counts,
    sources: store.sources.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      ingestedAt: s.ingestedAt,
      chunkCount: s.chunkIds.length,
      factCount: s.factIds.length,
      mediaCount: s.meta?.mediaCount ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  let tmpDir: string | undefined;
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";
    let filename = "source.txt";
    let type: SourceType | "auto" = "auto";
    let title: string | undefined;
    let markPeerClose: boolean | undefined;
    let syncPalace: boolean | undefined;
    let exportDir: string | undefined;
    let zipBuffer: Buffer | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        filename = f.name || filename;
        if (isZipFilename(filename)) {
          zipBuffer = Buffer.from(await f.arrayBuffer());
        } else {
          text = await f.text();
        }
      }
      const textField = form.get("text");
      if (!text && !zipBuffer && typeof textField === "string") text = textField;
      const name = form.get("filename");
      if (typeof name === "string" && name.trim()) filename = name.trim();
      const typeField = form.get("type");
      if (typeof typeField === "string" && typeField.trim()) {
        type = typeField.trim() as SourceType | "auto";
      }
      const titleField = form.get("title");
      if (typeof titleField === "string" && titleField.trim()) {
        title = titleField.trim();
      }
      const closeField = form.get("markPeerClose");
      if (typeof closeField === "string") {
        markPeerClose = closeField === "true" || closeField === "1";
      }
      const exportField = form.get("exportDir");
      if (typeof exportField === "string" && exportField.trim()) {
        exportDir = exportField.trim();
      }
      const syncField = form.get("syncPalace");
      if (typeof syncField === "string") {
        syncPalace = syncField === "true" || syncField === "1";
      }
    } else {
      const body = await request.json();
      text = String(body.text || body.markdown || "");
      filename = String(body.filename || body.sourceFile || filename);
      type = (body.type as SourceType | "auto") || "auto";
      title = body.title ? String(body.title) : undefined;
      if (typeof body.markPeerClose === "boolean") {
        markPeerClose = body.markPeerClose;
      }
      if (typeof body.syncPalace === "boolean") {
        syncPalace = body.syncPalace;
      }
      if (typeof body.exportDir === "string" && body.exportDir.trim()) {
        exportDir = body.exportDir.trim();
      }
      // Optional: base64 zip from CLI helper
      if (typeof body.zipBase64 === "string" && body.zipBase64) {
        zipBuffer = Buffer.from(body.zipBase64, "base64");
        if (!isZipFilename(filename)) filename = "chats.zip";
      }
    }

    // --- ZIP path: one or many ChatExport folders ---
    if (zipBuffer) {
      await fs.mkdir(TMP_BASE, { recursive: true });
      const unpacked = await unzipToTemp(zipBuffer, TMP_BASE);
      tmpDir = unpacked.tmpDir;

      const results = [];
      for (const exp of unpacked.exports) {
        const jsonText = await fs.readFile(exp.resultJsonPath, "utf8");
        const result = await ingestSource({
          text: jsonText,
          filename: path.basename(exp.resultJsonPath),
          type:
            type === "auto" || type === "telegram_chat"
              ? "telegram_chat"
              : type,
          // Prefer chat name from result.json; only use explicit UI title
          title,
          markPeerClose:
            markPeerClose ??
            (type === "telegram_chat" || type === "auto" || !type),
          syncPalace,
          exportDir: exp.exportDir,
        });
        results.push({
          source: {
            id: result.source.id,
            type: result.source.type,
            title: result.source.title,
            summary: result.source.summary,
            participants: result.source.participants,
            meta: result.source.meta,
          },
          chunkCount: result.chunkCount,
          factCount: result.factCount,
          attachmentCount: result.attachmentCount,
          people: result.people.map((p) => ({
            id: p.id,
            name: p.canonicalName,
            relationToSelf: p.relationToSelf,
            isSelf: p.isSelf,
          })),
          palace: result.palace ?? null,
        });
      }

      const first = results[0];
      return NextResponse.json({
        ok: true,
        zip: true,
        exportCount: results.length,
        // Back-compat single-source fields = first export
        source: first.source,
        chunkCount: first.chunkCount,
        factCount: first.factCount,
        attachmentCount: first.attachmentCount,
        people: first.people,
        palace: first.palace,
        results,
      });
    }

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Пустой источник. Передайте file (result.json / .zip), text или zip.",
        },
        { status: 400 },
      );
    }

    const result = await ingestSource({
      text,
      filename,
      type,
      title,
      markPeerClose,
      syncPalace,
      exportDir,
    });

    return NextResponse.json({
      ok: true,
      source: {
        id: result.source.id,
        type: result.source.type,
        title: result.source.title,
        summary: result.source.summary,
        participants: result.source.participants,
        meta: result.source.meta,
      },
      chunkCount: result.chunkCount,
      factCount: result.factCount,
      attachmentCount: result.attachmentCount,
      people: result.people.map((p) => ({
        id: p.id,
        name: p.canonicalName,
        relationToSelf: p.relationToSelf,
        isSelf: p.isSelf,
      })),
      palace: result.palace ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось загрузить источник", detail: String(error) },
      { status: 500 },
    );
  } finally {
    if (tmpDir) await rmTempQuiet(tmpDir);
  }
}
