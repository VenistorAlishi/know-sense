import { NextResponse } from "next/server";
import { listAttachments } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId") || undefined;
  const attachments = await listAttachments(sourceId);
  return NextResponse.json({
    ok: true,
    count: attachments.length,
    attachments: attachments.map((a) => ({
      id: a.id,
      sourceId: a.sourceId,
      kind: a.kind,
      originalName: a.originalName,
      storedPath: a.storedPath,
      telegramFileRef: a.telegramFileRef,
      mime: a.mime,
      byteSize: a.byteSize,
      durationSec: a.durationSec,
      width: a.width,
      height: a.height,
      caption: a.caption,
      deriveStatus: a.deriveStatus,
      derivedText: a.derivedText,
      timestamp: a.timestamp,
      personIds: a.personIds,
      messageId: a.messageId,
      chunkId: a.chunkId,
    })),
  });
}
