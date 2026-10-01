import { NextResponse } from "next/server";
import { saveObsidianVaultPath } from "@/lib/connectors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { vaultPath?: string };
    if (!body.vaultPath?.trim()) {
      return NextResponse.json(
        { error: "Нужен vaultPath — абсолютный путь к папке Obsidian" },
        { status: 400 },
      );
    }
    await saveObsidianVaultPath(body.vaultPath);
    return NextResponse.json({
      ok: true,
      vaultPath: body.vaultPath.trim(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Obsidian config failed", detail: String(e) },
      { status: 400 },
    );
  }
}
