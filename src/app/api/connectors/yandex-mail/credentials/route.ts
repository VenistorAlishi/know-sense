import { NextResponse } from "next/server";
import { saveYandexMailCredentials } from "@/lib/connectors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user?: string;
      appPassword?: string;
    };
    if (!body.user?.trim() || !body.appPassword?.trim()) {
      return NextResponse.json(
        { error: "Нужны user (email) и appPassword" },
        { status: 400 },
      );
    }
    await saveYandexMailCredentials({
      user: body.user,
      appPassword: body.appPassword,
    });
    return NextResponse.json({
      ok: true,
      user: body.user.trim(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Yandex Mail credentials failed", detail: String(e) },
      { status: 400 },
    );
  }
}
