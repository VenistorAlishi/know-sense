import { NextResponse } from "next/server";

/** @deprecated Use /api/sources — meetings are a source type now. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const target = new URL("/api/sources", url.origin);
  if (id) target.searchParams.set("id", id);
  return NextResponse.redirect(target);
}
