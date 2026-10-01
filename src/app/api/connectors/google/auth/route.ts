import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, googleConfigured } from "@/lib/connectors";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!googleConfigured()) {
      return NextResponse.json(
        {
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
        },
        { status: 400 },
      );
    }
    return NextResponse.redirect(buildGoogleAuthUrl());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
