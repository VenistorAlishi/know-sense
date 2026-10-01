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
    description:
      "OAuth (общий с Drive) → события primary calendar → Sources calendar.",
    auth: "oauth2",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  },
  {
    id: "google-drive",
    title: "Google Drive",
    description:
      "OAuth (общий с Calendar) → Docs/Sheets/текст → Sources drive. Опционально GOOGLE_DRIVE_FOLDER_ID.",
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
  {
    id: "obsidian",
    title: "Obsidian",
    description:
      "Односторонний импорт .md из локального vault (без .obsidian/.trash). Путь в UI или OBSIDIAN_VAULT_PATH.",
    auth: "local",
  },
];

export function catalogEntry(id: ConnectorId): ConnectorCatalogEntry | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}
