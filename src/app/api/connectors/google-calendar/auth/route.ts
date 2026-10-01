import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Backward-compat: redirect to shared Google OAuth. */
export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  return NextResponse.redirect(`${base}/api/connectors/google/auth`);
}
