import { NextResponse } from "next/server";
import {
  buildGoogleCalendarAuthUrl,
  googleCalendarConfigured,
} from "@/lib/connectors";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!googleCalendarConfigured()) {
      return NextResponse.json(
        {
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
        },
        { status: 400 },
      );
    }
    const url = buildGoogleCalendarAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 },
    );
  }
}
