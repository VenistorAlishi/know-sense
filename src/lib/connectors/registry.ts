import type { ConnectorCatalogEntry, ConnectorId } from "./types";

export const CONNECTOR_CATALOG: ConnectorCatalogEntry[] = [
  {
    id: "voice",
    title: "Голос",
    description:
      "Загрузка голоса + Sync: ASR backfill для pending TG voice/audio (Whisper / OpenAI).",
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
    description:
      "IMAP (пароль приложения) → Sources типа email. Папка INBOX, инкремент по UID.",
    auth: "password",
  },
];

export function catalogEntry(id: ConnectorId): ConnectorCatalogEntry | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}
