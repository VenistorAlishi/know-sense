import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { ingestSource } from "@/lib/ingest";
import { loadStore } from "@/lib/store";
import { getConnection, upsertConnection, pushJob } from "./store";
import type { ConnectorConnection, SyncJobResult } from "./types";

const IMAP_HOST = process.env.YANDEX_IMAP_HOST || "imap.yandex.com";
const IMAP_PORT = Number(process.env.YANDEX_IMAP_PORT || "993");

export type YandexMailCreds = {
  user: string;
  appPassword: string;
};

function envCreds(): YandexMailCreds | null {
  const user = process.env.YANDEX_MAIL_USER || "";
  const appPassword = process.env.YANDEX_MAIL_APP_PASSWORD || "";
  if (user && appPassword) return { user, appPassword };
  return null;
}

export function credsFromConnection(
  conn?: ConnectorConnection | null,
): YandexMailCreds | null {
  const user = conn?.tokens?.meta?.user || "";
  const appPassword = conn?.tokens?.meta?.appPassword || "";
  if (user && appPassword) return { user, appPassword };
  return envCreds();
}

export function yandexMailConfigured(
  conn?: ConnectorConnection | null,
): boolean {
  return Boolean(credsFromConnection(conn));
}

export async function saveYandexMailCredentials(
  input: YandexMailCreds,
): Promise<void> {
  const user = input.user.trim();
  const appPassword = input.appPassword.trim();
  if (!user || !appPassword) {
    throw new Error("Нужны email и пароль приложения Яндекса");
  }
  // Quick IMAP probe so UI fails fast on bad creds
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    logger: false,
    auth: { user, pass: appPassword },
  });
  try {
    await client.connect();
    await client.logout();
  } catch (e) {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    throw new Error(`IMAP login failed: ${String(e)}`);
  }
  await upsertConnection({
    id: "yandex-mail",
    status: "connected",
    enabled: true,
    tokens: {
      meta: { user, appPassword },
    },
    lastError: undefined,
  });
}

function formatAddress(value: unknown): string {
  if (!value) return "";
  const objs = Array.isArray(value) ? value : [value];
  const parts: string[] = [];
  for (const obj of objs) {
    const rec = obj as { text?: string; value?: Array<{ name?: string; address?: string }> };
    if (rec.text) {
      parts.push(rec.text);
      continue;
    }
    for (const a of rec.value || []) {
      if (a.name && a.address) parts.push(`${a.name} <${a.address}>`);
      else if (a.address || a.name) parts.push(a.address || a.name || "");
    }
  }
  return parts.filter(Boolean).join(", ");
}

function messageKey(messageId: string | undefined, uid: number): string {
  const mid = (messageId || "").replace(/[<>\s]/g, "");
  return mid ? `yandex-${mid}` : `yandex-uid-${uid}`;
}

export async function syncYandexMail(opts?: {
  limit?: number;
  daysBack?: number;
}): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  const limit = opts?.limit ?? 40;
  const daysBack = opts?.daysBack ?? 14;

  const conn = await getConnection("yandex-mail");
  const creds = credsFromConnection(conn);
  if (!creds) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "yandex-mail",
      status: "error",
      imported: 0,
      skipped: 0,
      errors: [
        "Задай YANDEX_MAIL_USER + YANDEX_MAIL_APP_PASSWORD или сохрани пароль приложения в UI.",
      ],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "yandex-mail",
      status: "needs_auth",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: job.errors[0],
    });
    await pushJob(job);
    return job;
  }

  const store = await loadStore();
  const seen = new Set(
    store.sources
      .filter((s) => s.type === "email")
      .map((s) => s.meta.originalFilename?.replace(/\.md$/, "") || "")
      .filter(Boolean),
  );

  const since = new Date(Date.now() - daysBack * 86400_000);
  const lastUid = Number(conn?.cursor?.lastUid || "0") || 0;
  let maxUid = lastUid;

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    logger: false,
    auth: { user: creds.user, pass: creds.appPassword },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const query =
        lastUid > 0
          ? { uid: `${lastUid + 1}:*` }
          : { since };
      const uids = await client.search(query, { uid: true });
      const batch = (uids || []).slice(-limit);

      for (const uid of batch) {
        if (uid > maxUid) maxUid = uid;
        try {
          const downloaded = await client.download(uid, undefined, { uid: true });
          if (!downloaded?.content) {
            skipped += 1;
            continue;
          }
          const chunks: Buffer[] = [];
          for await (const piece of downloaded.content) {
            chunks.push(Buffer.isBuffer(piece) ? piece : Buffer.from(piece));
          }
          const raw = Buffer.concat(chunks);
          const parsed = await simpleParser(raw);
          const key = messageKey(parsed.messageId, uid);
          if (seen.has(key)) {
            skipped += 1;
            continue;
          }

          const subject = (parsed.subject || "(без темы)").trim();
          const from = formatAddress(parsed.from);
          const to = formatAddress(parsed.to);
          const date = parsed.date?.toISOString() || new Date().toISOString();
          const body =
            (parsed.text || "").trim() ||
            (parsed.html
              ? String(parsed.html)
                  .replace(/<style[\s\S]*?<\/style>/gi, " ")
                  .replace(/<script[\s\S]*?<\/script>/gi, " ")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
              : "");

          const text = [
            `# ${subject}`,
            "",
            `From: ${from}`,
            `To: ${to}`,
            `Date: ${date}`,
            parsed.messageId ? `Message-ID: ${parsed.messageId}` : "",
            "",
            body || "[пустое тело письма]",
          ]
            .filter((line) => line !== "")
            .join("\n");

          await ingestSource({
            text,
            filename: `${key}.md`,
            type: "email",
            title: subject,
            syncPalace: true,
            meta: {
              emailFrom: from || undefined,
              emailTo: to || undefined,
              emailDate: date,
              emailMessageId: parsed.messageId || undefined,
              peerName: from || undefined,
            },
          });
          seen.add(key);
          imported += 1;
        } catch (e) {
          errors.push(`uid ${uid}: ${String(e)}`);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();

    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "yandex-mail",
      status: errors.length && !imported ? "error" : "ok",
      imported,
      skipped,
      errors: errors.slice(0, 20),
      startedAt,
      finishedAt,
      detail: `IMAP ${creds.user} · since ${since.toISOString().slice(0, 10)} · uid≤${maxUid}`,
    };
    await upsertConnection({
      id: "yandex-mail",
      status: "connected",
      lastSyncAt: finishedAt,
      lastSyncStatus: job.status,
      lastError: errors[0],
      cursor: {
        lastUid: String(maxUid),
        syncedAt: finishedAt,
        user: creds.user,
      },
    });
    await pushJob(job);
    return job;
  } catch (e) {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "yandex-mail",
      status: "error",
      imported,
      skipped,
      errors: [String(e)],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "yandex-mail",
      status: "error",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: String(e),
    });
    await pushJob(job);
    return job;
  }
}
