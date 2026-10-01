import { getConnection, upsertConnection } from "./store";
import type { ConnectorId, ConnectorTokens } from "./types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const GOOGLE_CONNECTORS: ConnectorId[] = ["google-calendar", "google-drive"];

export function googleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "http://127.0.0.1:3847/api/connectors/google/callback";
  return { clientId, clientSecret, redirectUri };
}

export function googleConfigured(): boolean {
  const { clientId, clientSecret } = googleClientConfig();
  return Boolean(clientId && clientSecret);
}

/** @deprecated use googleConfigured */
export const googleCalendarConfigured = googleConfigured;

export function buildGoogleAuthUrl(state?: string): string {
  const { clientId, redirectUri } = googleClientConfig();
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
    scope: GOOGLE_SCOPES,
    state: state || "smysl",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

/** @deprecated use buildGoogleAuthUrl */
export const buildGoogleCalendarAuthUrl = buildGoogleAuthUrl;

async function writeTokensToBoth(tokens: ConnectorTokens): Promise<void> {
  for (const id of GOOGLE_CONNECTORS) {
    await upsertConnection({
      id,
      status: "connected",
      enabled: true,
      tokens,
      lastError: undefined,
    });
  }
}

export async function exchangeGoogleCode(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = googleClientConfig();
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
  const prevCal = await getConnection("google-calendar");
  const prevDrive = await getConnection("google-drive");
  const prevRefresh =
    data.refresh_token ||
    prevCal?.tokens?.refreshToken ||
    prevDrive?.tokens?.refreshToken;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : undefined;
  await writeTokensToBoth({
    accessToken: data.access_token,
    refreshToken: prevRefresh,
    expiresAt,
    tokenType: data.token_type,
    scope: data.scope || GOOGLE_SCOPES,
  });
}

export async function googleConnected(): Promise<boolean> {
  for (const id of GOOGLE_CONNECTORS) {
    const conn = await getConnection(id);
    if (conn?.tokens?.refreshToken || conn?.tokens?.accessToken) return true;
  }
  return false;
}

export async function getGoogleAccessToken(): Promise<string> {
  let conn =
    (await getConnection("google-calendar")) ||
    (await getConnection("google-drive"));
  // Prefer whichever has a refresh token
  const cal = await getConnection("google-calendar");
  const drive = await getConnection("google-drive");
  conn =
    [cal, drive].find((c) => c?.tokens?.refreshToken) ||
    [cal, drive].find((c) => c?.tokens?.accessToken) ||
    undefined;

  if (!conn?.tokens?.refreshToken && !conn?.tokens?.accessToken) {
    throw new Error("Google not connected — authorize Calendar/Drive first.");
  }

  if (
    conn.tokens.accessToken &&
    conn.tokens.expiresAt &&
    new Date(conn.tokens.expiresAt).getTime() > Date.now() + 60_000
  ) {
    return conn.tokens.accessToken;
  }

  if (!conn.tokens.refreshToken) {
    throw new Error("Google refresh token missing — re-authorize.");
  }

  const { clientId, clientSecret } = googleClientConfig();
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
    for (const id of GOOGLE_CONNECTORS) {
      await upsertConnection({
        id,
        status: "needs_auth",
        lastError: await res.clone().text(),
      });
    }
    throw new Error("Google refresh failed — re-authorize.");
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const next: ConnectorTokens = {
    ...conn.tokens,
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : conn.tokens.expiresAt,
  };
  await writeTokensToBoth(next);
  return data.access_token;
}
