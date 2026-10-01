import { CONNECTOR_CATALOG, catalogEntry } from "./registry";
import { loadConnectors, getConnection, upsertConnection } from "./store";
import { syncGoogleCalendar, googleCalendarConfigured } from "./google-calendar";
import {
  syncYandexMail,
  yandexMailConfigured,
  saveYandexMailCredentials,
} from "./yandex-mail";
import { backfillPendingAudio } from "./voice";
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
    if (entry.id === "yandex-mail" && !status) {
      status = yandexMailConfigured(conn) ? "connected" : "available";
    }
    if (entry.id === "google-drive" && !status) {
      status = "available";
    }
    return {
      ...entry,
      status: status || "available",
      enabled: conn?.enabled ?? entry.id === "voice",
      lastSyncAt: conn?.lastSyncAt,
      lastSyncStatus: conn?.lastSyncStatus,
      lastError: conn?.lastError,
      accountHint:
        entry.id === "yandex-mail"
          ? conn?.tokens?.meta?.user || process.env.YANDEX_MAIL_USER || undefined
          : undefined,
      configured:
        entry.id === "voice"
          ? true
          : entry.id === "google-calendar"
            ? googleCalendarConfigured()
            : entry.id === "yandex-mail"
              ? yandexMailConfigured(conn)
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
  if (id === "voice") return backfillPendingAudio();
  if (id === "yandex-mail") return syncYandexMail();
  return syncStub(id);
}

export { getConnection, loadConnectors };
export {
  buildGoogleCalendarAuthUrl,
  exchangeGoogleCode,
  googleCalendarConfigured,
} from "./google-calendar";
export { ingestVoiceNote, transcribeAudio, backfillPendingAudio } from "./voice";
export {
  syncYandexMail,
  yandexMailConfigured,
  saveYandexMailCredentials,
} from "./yandex-mail";
