import { NextResponse } from "next/server";
import { analyzeMeeting } from "@/lib/analyze";
import { upsertMeeting, loadStore } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const store = await loadStore();
  return NextResponse.json({
    meetingCount: store.meetings.length,
    peopleCount: Object.keys(store.peopleIndex).length,
    updatedAt: store.updatedAt,
    meetings: store.meetings.map((m) => ({
      id: m.id,
      title: m.title,
      sourceFile: m.sourceFile,
      ingestedAt: m.ingestedAt,
      participants: m.participants,
      meaningCount: m.meanings.length,
      chunkCount: m.chunks.length,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let markdown = "";
    let filename = "meeting.md";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file === "object" && "text" in file) {
        const f = file as File;
        markdown = await f.text();
        filename = f.name || filename;
      } else {
        const text = form.get("text");
        if (typeof text === "string") markdown = text;
        const name = form.get("filename");
        if (typeof name === "string" && name.trim()) filename = name.trim();
      }
    } else {
      const body = await request.json();
      markdown = String(body.text || body.markdown || "");
      filename = String(body.filename || body.sourceFile || filename);
    }

    if (!markdown.trim()) {
      return NextResponse.json(
        { error: "Пустой текст встречи. Прикрепите .md или передайте text." },
        { status: 400 },
      );
    }

    const meeting = analyzeMeeting(markdown, filename);
    const store = await upsertMeeting(meeting, markdown);
    const kirill = Object.values(store.peopleIndex).find((p) => p.isUser);

    return NextResponse.json({
      ok: true,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        participants: meeting.participants,
        meaningCount: meeting.meanings.length,
        chunkCount: meeting.chunks.length,
        people: meeting.people,
        meanings: meeting.meanings,
      },
      kirill: kirill ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось разобрать встречу", detail: String(error) },
      { status: 500 },
    );
  }
}
