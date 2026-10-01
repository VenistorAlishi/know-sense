import { ingestSource } from "@/lib/ingest";
import { loadStore } from "@/lib/store";
import { upsertConnection, pushJob } from "./store";
import {
  getGoogleAccessToken,
  googleConfigured,
} from "./google-oauth";
import type { SyncJobResult } from "./types";

const CAL_API = "https://www.googleapis.com/calendar/v3";

export {
  googleConfigured as googleCalendarConfigured,
  buildGoogleAuthUrl as buildGoogleCalendarAuthUrl,
  exchangeGoogleCode,
  googleConfigured,
  buildGoogleAuthUrl,
} from "./google-oauth";

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
    if (!googleConfigured()) {
      throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
    }
    const token = await getGoogleAccessToken();
    const back = opts?.daysBack ?? 14;
    const forward = opts?.daysForward ?? 60;
    const timeMin = new Date(Date.now() - back * 86400_000).toISOString();
    const timeMax = new Date(Date.now() + forward * 86400_000).toISOString();

    const store = await loadStore();
    const seen = new Set(
      store.sources
        .filter((s) => s.type === "calendar")
        .map((s) => s.meta.originalFilename?.replace(/\.md$/, "") || "")
        .filter(Boolean),
    );

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
      const key = `gcal-${ev.id}`;
      if (seen.has(key)) {
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
          filename: `${key}.md`,
          type: "calendar",
          title: `${ev.summary || "Событие"} · ${start.slice(0, 10)}`,
          syncPalace: true,
          meta: {
            peerName: people || undefined,
            dateRange: {
              from: start || undefined,
              to: end || undefined,
            },
          },
        });
        seen.add(key);
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
