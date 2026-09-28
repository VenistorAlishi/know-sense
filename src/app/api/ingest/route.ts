import { NextResponse } from "next/server";
import { ingestSource } from "@/lib/ingest";
import { listStats } from "@/lib/store";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";

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
    })),
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";
    let filename = "source.txt";
    let type: SourceType | "auto" = "auto";
    let title: string | undefined;
    let markPeerClose: boolean | undefined;
    let syncPalace: boolean | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file === "object" && "text" in file) {
        const f = file as File;
        text = await f.text();
        filename = f.name || filename;
      }
      const textField = form.get("text");
      if (!text && typeof textField === "string") text = textField;
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
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Пустой источник. Передайте file или text." },
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
  }
}
