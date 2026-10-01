import { CONNECTOR_CATALOG, catalogEntry } from "./registry";
import { loadConnectors, getConnection, upsertConnection } from "./store";
import { syncGoogleCalendar } from "./google-calendar";
import { syncGoogleDrive } from "./google-drive";
import {
  googleConfigured,
  googleConnected,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
} from "./google-oauth";
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
  const gConnected = await googleConnected();
  return CONNECTOR_CATALOG.map((entry) => {
    const conn = store.connections.find((c) => c.id === entry.id);
    let status = conn?.status;
    if (entry.id === "voice") status = "connected";
    if (
      (entry.id === "google-calendar" || entry.id === "google-drive") &&
      !status
    ) {
      status = !googleConfigured()
        ? "available"
        : gConnected
          ? "connected"
          : "needs_auth";
    }
    if (entry.id === "yandex-mail" && !status) {
      status = yandexMailConfigured(conn) ? "connected" : "available";
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
          : entry.id === "google-drive" && process.env.GOOGLE_DRIVE_FOLDER_ID
            ? `folder ${process.env.GOOGLE_DRIVE_FOLDER_ID}`
            : undefined,
      configured:
        entry.id === "voice"
          ? true
          : entry.id === "google-calendar" || entry.id === "google-drive"
            ? googleConfigured()
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
  if (id === "google-drive") return syncGoogleDrive();
  if (id === "voice") return backfillPendingAudio();
  if (id === "yandex-mail") return syncYandexMail();
  return syncStub(id);
}

export { getConnection, loadConnectors };
export {
  buildGoogleAuthUrl,
  buildGoogleAuthUrl as buildGoogleCalendarAuthUrl,
  exchangeGoogleCode,
  googleConfigured,
  googleConfigured as googleCalendarConfigured,
  googleConnected,
} from "./google-oauth";
export { syncGoogleCalendar } from "./google-calendar";
export { syncGoogleDrive } from "./google-drive";
export { ingestVoiceNote, transcribeAudio, backfillPendingAudio } from "./voice";
export {
  syncYandexMail,
  yandexMailConfigured,
  saveYandexMailCredentials,
} from "./yandex-mail";
