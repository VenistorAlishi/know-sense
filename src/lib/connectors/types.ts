export type ConnectorId =
  | "google-calendar"
  | "google-drive"
  | "yandex-mail"
  | "voice";

export type ConnectorStatus =
  | "available"
  | "needs_auth"
  | "connected"
  | "error"
  | "disabled";

export type SyncJobStatus =
  | "idle"
  | "running"
  | "ok"
  | "error";

export interface ConnectorTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string;
  /** Provider-specific extras (e.g. email address) */
  meta?: Record<string, string>;
}

export interface ConnectorConnection {
  id: ConnectorId;
  status: ConnectorStatus;
  tokens?: ConnectorTokens;
  /** Opaque sync cursor (page token, historyId, lastSyncedAt, …) */
  cursor?: Record<string, string>;
  lastSyncAt?: string;
  lastSyncStatus?: SyncJobStatus;
  lastError?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncJobResult {
  connectorId: ConnectorId;
  status: SyncJobStatus;
  imported: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
  detail?: string;
}

export interface ConnectorsStore {
  version: 1;
  updatedAt: string;
  connections: ConnectorConnection[];
  /** Recent sync runs (newest first, capped) */
  jobs: SyncJobResult[];
}

export interface ConnectorCatalogEntry {
  id: ConnectorId;
  title: string;
  description: string;
  auth: "oauth2" | "local" | "none" | "password";
  scopes?: string[];
}
