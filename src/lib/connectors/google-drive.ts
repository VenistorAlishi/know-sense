import { ingestSource } from "@/lib/ingest";
import { loadStore } from "@/lib/store";
import { upsertConnection, pushJob } from "./store";
import {
  getGoogleAccessToken,
  googleConfigured,
} from "./google-oauth";
import type { SyncJobResult } from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

const EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const DOWNLOADABLE = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/rtf",
]);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  size?: string;
}

function folderQuery(folderId?: string): string {
  const parts = [
    "trashed = false",
    "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.presentation' or mimeType contains 'text/')",
  ];
  if (folderId) {
    parts.push(`'${folderId}' in parents`);
  }
  return parts.join(" and ");
}

async function fetchFileText(
  token: string,
  file: DriveFile,
): Promise<string | null> {
  const exportMime = EXPORTABLE[file.mimeType];
  if (exportMime) {
    const url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`export ${file.id}: ${await res.text()}`);
    }
    return (await res.text()).trim();
  }
  if (DOWNLOADABLE.has(file.mimeType)) {
    const url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`download ${file.id}: ${await res.text()}`);
    }
    return (await res.text()).trim();
  }
  return null;
}

export async function syncGoogleDrive(opts?: {
  limit?: number;
  folderId?: string;
}): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  const limit = opts?.limit ?? 40;
  const folderId =
    opts?.folderId ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    undefined;

  try {
    if (!googleConfigured()) {
      throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
    }
    const token = await getGoogleAccessToken();
    const store = await loadStore();
    const seen = new Set(
      store.sources
        .filter((s) => s.type === "drive")
        .map(
          (s) =>
            s.meta.driveFileId ||
            s.meta.originalFilename?.replace(/\.md$/, "") ||
            "",
        )
        .filter(Boolean),
    );

    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    while (files.length < limit) {
      const url = new URL(`${DRIVE_API}/files`);
      url.searchParams.set("q", folderQuery(folderId));
      url.searchParams.set("orderBy", "modifiedTime desc");
      url.searchParams.set(
        "fields",
        "nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,owners,size)",
      );
      url.searchParams.set(
        "pageSize",
        String(Math.min(50, limit - files.length)),
      );
      url.searchParams.set("spaces", "drive");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Drive list error: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      files.push(...(data.files || []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    for (const file of files.slice(0, limit)) {
      const key = `gdrive-${file.id}`;
      if (seen.has(key) || seen.has(file.id)) {
        skipped += 1;
        continue;
      }
      try {
        const body = await fetchFileText(token, file);
        if (!body) {
          skipped += 1;
          continue;
        }
        // Skip huge blobs
        if (body.length > 400_000) {
          skipped += 1;
          errors.push(`${file.name}: too large (${body.length} chars)`);
          continue;
        }
        const owner =
          file.owners?.[0]?.displayName ||
          file.owners?.[0]?.emailAddress ||
          "";
        const text = [
          `# ${file.name}`,
          "",
          `Drive ID: ${file.id}`,
          `MIME: ${file.mimeType}`,
          file.modifiedTime ? `Modified: ${file.modifiedTime}` : "",
          owner ? `Owner: ${owner}` : "",
          file.webViewLink ? `Link: ${file.webViewLink}` : "",
          "",
          body,
        ]
          .filter(Boolean)
          .join("\n");

        await ingestSource({
          text,
          filename: `${key}.md`,
          type: "drive",
          title: file.name,
          syncPalace: true,
          meta: {
            driveFileId: file.id,
            driveMime: file.mimeType,
            driveLink: file.webViewLink,
            peerName: owner || undefined,
            extractedAt: file.modifiedTime,
          },
        });
        seen.add(key);
        imported += 1;
      } catch (e) {
        errors.push(`${file.name || file.id}: ${String(e)}`);
      }
    }

    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "google-drive",
      status: errors.length && !imported ? "error" : "ok",
      imported,
      skipped,
      errors: errors.slice(0, 20),
      startedAt,
      finishedAt,
      detail: folderId
        ? `Folder ${folderId} · ${files.length} candidates`
        : `My Drive recent · ${files.length} candidates`,
    };
    await upsertConnection({
      id: "google-drive",
      status: "connected",
      lastSyncAt: finishedAt,
      lastSyncStatus: job.status,
      lastError: errors[0],
      cursor: {
        syncedAt: finishedAt,
        folderId: folderId || "",
        lastCount: String(files.length),
      },
    });
    await pushJob(job);
    return job;
  } catch (e) {
    const finishedAt = new Date().toISOString();
    const job: SyncJobResult = {
      connectorId: "google-drive",
      status: "error",
      imported,
      skipped,
      errors: [String(e)],
      startedAt,
      finishedAt,
    };
    await upsertConnection({
      id: "google-drive",
      lastSyncAt: finishedAt,
      lastSyncStatus: "error",
      lastError: String(e),
    });
    await pushJob(job);
    return job;
  }
}
