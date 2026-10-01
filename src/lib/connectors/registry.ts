import type { ConnectorCatalogEntry, ConnectorId } from "./types";

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    id: "voice",
    title: "Голос",
    description:
      "Загрузка голосовых заметок: локальный Whisper → transcript в базу (Attachment + Chunk).",
    auth: "local",
  },
  {
    id: "google-calendar",
    title: "Google Calendar",
    description: "OAuth + pull событий в Sources типа calendar и Facts kind=event.",
    auth: "oauth2",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  },
  {
    id: "google-drive",
    title: "Google Drive",
    description: "Каркас: pull выбранных папок/доков (следующий срез).",
    auth: "oauth2",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  },
  {
    id: "yandex-mail",
    title: "Яндекс.Почта",
    description: "Каркас: OAuth/IMAP ingest писем (следующий срез).",
    auth: "oauth2",
    scopes: ["mail:imap_ro"],
  },
];

export function catalogEntry(id: ConnectorId): ConnectorCatalogEntry | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}
