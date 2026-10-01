import { ingestSource } from "@/lib/ingest";
import { getConnection, upsertConnection, pushJob } from "./store";
import type { SyncJobResult } from "./types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

function clientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "http://127.0.0.1:3847/api/connectors/google-calendar/callback";
  return { clientId, clientSecret, redirectUri };
}

export function googleCalendarConfigured(): boolean {
  const { clientId, clientSecret } = clientConfig();
  return Boolean(clientId && clientSecret);
}

export function buildGoogleCalendarAuthUrl(state?: string): string {
  const { clientId, redirectUri } = clientConfig();
  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID not set. Add it to .env.local (see .env.example).",
    );
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    state: state || "smysl",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = clientConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
  const prev = await getConnection("google-calendar");
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : undefined;
  await upsertConnection({
    id: "google-calendar",
    status: "connected",
    enabled: true,
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || prev?.tokens?.refreshToken,
      expiresAt,
      tokenType: data.token_type,
      scope: data.scope,
    },
    lastError: undefined,
  });
}

async function refreshAccessToken(): Promise<string> {
  const conn = await getConnection("google-calendar");
  if (!conn?.tokens?.refreshToken) {
    throw new Error("Google Calendar not connected — authorize first.");
  }
  if (
    conn.tokens.accessToken &&
    conn.tokens.expiresAt &&
    new Date(conn.tokens.expiresAt).getTime() > Date.now() + 60_000
  ) {
    return conn.tokens.accessToken;
  }
  const { clientId, clientSecret } = clientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.tokens.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    await upsertConnection({
      id: "google-calendar",
      status: "needs_auth",
      lastError: await res.text(),
    });
    throw new Error("Google refresh failed — re-authorize.");
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  await upsertConnection({
    id: "google-calendar",
    status: "connected",
    tokens: {
      ...conn.tokens,
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : conn.tokens.expiresAt,
    },
  });
  return data.access_token;
}

interface GCalEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
  htmlLink?: string;
}

export async function syncGoogleCalendar(opts?: {
  daysBack?: number;
  daysForward?: number;
}): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  try {
    if (!googleCalendarConfigured()) {
      throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
    }
    const token = await refreshAccessToken();
    const back = opts?.daysBack ?? 14;
    const forward = opts?.daysForward ?? 60;
    const timeMin = new Date(Date.now() - back * 86400_000).toISOString();
    const timeMax = new Date(Date.now() + forward * 86400_000).toISOString();

    const url = new URL(`${CAL_API}/calendars/primary/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Calendar API error: ${await res.text()}`);
    }
    const data = (await res.json()) as { items?: GCalEvent[] };
    const items = data.items || [];

    for (const ev of items) {
      if (!ev.id || ev.status === "cancelled") {
        skipped += 1;
        continue;
      }
      const start = ev.start?.dateTime || ev.start?.date || "";
      const end = ev.end?.dateTime || ev.end?.date || "";
      const people = (ev.attendees || [])
        .map((a) => a.displayName || a.email)
        .filter(Boolean)
        .join(", ");
      const text = [
        `# ${ev.summary || "Без названия"}`,
        "",
        `Start: ${start}`,
        `End: ${end}`,
        ev.location ? `Location: ${ev.location}` : "",
        people ? `Attendees: ${people}` : "",
        ev.hangoutLink ? `Meet: ${ev.hangoutLink}` : "",
        ev.htmlLink ? `Link: ${ev.htmlLink}` : "",
        "",
        ev.description || "",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await ingestSource({
          text,
          filename: `gcal-${ev.id}.md`,
          type: "calendar",
          title: `📅 ${ev.summary || "Событие"} · ${start.slice(0, 10)}`,
          syncPalace: true,
        });
        imported += 1;
      } catch (e) {
        errors.push(`${ev.id}: ${String(e)}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "google-calendar",
      status: errors.length && !imported ? "error" : "ok",
      imported,
      skipped,
      errors: errors.slice(0, 20),
      startedAt,
      finishedAt,
      detail: `Pulled ${items.length} events (${timeMin.slice(0, 10)}…${timeMax.slice(0, 10)})`,
    };
    await upsertConnection({
      id: "google-calendar",
      status: "connected",
      lastSyncAt: finishedAt,
      lastSyncStatus: job.status,
      lastError: errors[0],
      cursor: { timeMin, timeMax, syncedAt: finishedAt },
    });
    await pushJob(job);
    return job;
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "google-calendar",
      status: "error",
      imported,
      skipped,
      errors: [String(e)],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "google-calendar",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: String(e),
    });
    await pushJob(job);
    return job;
  }
}
