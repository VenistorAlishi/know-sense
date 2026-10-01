import { NextResponse } from "next/server";
import { ingestVoiceNote } from "@/lib/connectors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "Передайте audio file (multipart field file)" },
        { status: 400 },
      );
    }
    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    const title =
      typeof form.get("title") === "string"
        ? String(form.get("title"))
        : undefined;

    const result = await ingestVoiceNote({
      buffer,
      filename: f.name || "voice.ogg",
      mime: f.type || undefined,
      title,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      asrReady: Boolean(result.transcript),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Voice ingest failed", detail: String(e) },
      { status: 500 },
    );
  }
}
