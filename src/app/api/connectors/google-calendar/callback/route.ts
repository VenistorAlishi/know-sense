import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/connectors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const err = searchParams.get("error");
  const base = new URL(request.url).origin;
  if (err) {
    return NextResponse.redirect(
      `${base}/settings/connectors?error=${encodeURIComponent(err)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${base}/settings/connectors?error=missing_code`,
    );
  }
  try {
    await exchangeGoogleCode(code);
    return NextResponse.redirect(`${base}/settings/connectors?connected=google-calendar`);
  } catch (e) {
    return NextResponse.redirect(
      `${base}/settings/connectors?error=${encodeURIComponent(String(e))}`,
    );
  }
}
