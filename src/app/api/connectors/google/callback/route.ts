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
      `${base}/google?error=${encodeURIComponent(err)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(`${base}/google?error=missing_code`);
  }
  try {
    await exchangeGoogleCode(code);
    return NextResponse.redirect(`${base}/google?connected=1`);
  } catch (e) {
    return NextResponse.redirect(
      `${base}/google?error=${encodeURIComponent(String(e))}`,
    );
  }
}
