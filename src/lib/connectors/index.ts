import { CONNECTOR_CATALOG, catalogEntry } from "./registry";
import { loadConnectors, getConnection, upsertConnection } from "./store";
import { syncGoogleCalendar, googleCalendarConfigured } from "./google-calendar";
import { syncStub } from "./stubs";
import type { ConnectorId, SyncJobResult } from "./types";

export async function listConnectorStatus() {
  const store = await loadConnectors();
  return CONNECTOR_CATALOG.map((entry) => {
    const conn = store.connections.find((c) => c.id === entry.id);
    let status = conn?.status;
    if (entry.id === "voice") status = "connected";
    if (entry.id === "google-calendar" && !status) {
      status = googleCalendarConfigured() ? "needs_auth" : "available";
    }
    if ((entry.id === "google-drive" || entry.id === "yandex-mail") && !status) {
      status = "available";
    }
    return {
      ...entry,
      status: status || "available",
      enabled: conn?.enabled ?? entry.id === "voice",
      lastSyncAt: conn?.lastSyncAt,
      lastSyncStatus: conn?.lastSyncStatus,
      lastError: conn?.lastError,
      configured:
        entry.id === "voice"
          ? true
          : entry.id === "google-calendar"
            ? googleCalendarConfigured()
            : false,
    };
  });
}

export async function runConnectorSync(
  id: ConnectorId,
): Promise<SyncJobResult> {
  const entry = catalogEntry(id);
  if (!entry) throw new Error(`Unknown connector: ${id}`);
  await upsertConnection({ id, enabled: true });
  if (id === "google-calendar") return syncGoogleCalendar();
  if (id === "voice") {
    const startedAt = new Date().toISOString();
    const finishedAt = new Date().toISOString();
    return {
      connectorId: "voice",
      status: "ok",
      imported: 0,
      skipped: 0,
      errors: [],
      startedAt,
      finishedAt,
      detail: "Voice is push-based — POST /api/ingest/voice",
    };
  }
  return syncStub(id);
}

export { getConnection, loadConnectors };
export {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCode,
  googleCalendarConfigured,
} from "./google-calendar";
export { ingestVoiceNote, transcribeAudio } from "./voice";
