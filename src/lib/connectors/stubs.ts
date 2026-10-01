import { upsertConnection, pushJob } from "./store";
import type { ConnectorId, SyncJobResult } from "./types";

/** Placeholder sync for connectors not fully wired yet. */
export async function syncStub(id: ConnectorId): Promise<SyncJobResult> {
  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const job: SyncJobResult = {
    connectorId: id,
    status: "error",
    imported: 0,
    skipped: 0,
    errors: [`Connector ${id} is not implemented.`],
    startedAt,
    finishedAt,
    detail: "stub",
  };
  await upsertConnection({
    id,
    status: "available",
    lastSyncAt: finishedAt,
    lastSyncStatus: "error",
    lastError: job.errors[0],
    enabled: false,
  });
  await pushJob(job);
  return job;
}
