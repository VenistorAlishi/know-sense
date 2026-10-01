import { promises as fs } from "fs";
import path from "path";
import type {
  ConnectorConnection,
  ConnectorId,
  ConnectorsStore,
  SyncJobResult,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store", "connectors.json");

function emptyStore(): ConnectorsStore {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    connections: [],
    jobs: [],
  };
}

async function ensure() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

export async function loadConnectors(): Promise<ConnectorsStore> {
  await ensure();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ConnectorsStore;
    if (!Array.isArray(parsed.connections)) parsed.connections = [];
    if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
    return parsed;
  } catch {
    const store = emptyStore();
    await saveConnectors(store);
    return store;
  }
}

export async function saveConnectors(store: ConnectorsStore): Promise<void> {
  await ensure();
  store.updatedAt = new Date().toISOString();
  store.version = 1;
  store.jobs = (store.jobs || []).slice(0, 40);
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getConnection(
  id: ConnectorId,
): Promise<ConnectorConnection | undefined> {
  const store = await loadConnectors();
  return store.connections.find((c) => c.id === id);
}

export async function upsertConnection(
  patch: Partial<ConnectorConnection> & { id: ConnectorId },
): Promise<ConnectorConnection> {
  const store = await loadConnectors();
  const now = new Date().toISOString();
  const idx = store.connections.findIndex((c) => c.id === patch.id);
  if (idx === -1) {
    const created: ConnectorConnection = {
      id: patch.id,
      status: patch.status || "needs_auth",
      tokens: patch.tokens,
      cursor: patch.cursor,
      lastSyncAt: patch.lastSyncAt,
      lastSyncStatus: patch.lastSyncStatus,
      lastError: patch.lastError,
      enabled: patch.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    store.connections.push(created);
    await saveConnectors(store);
    return created;
  }
  const next: ConnectorConnection = {
    ...store.connections[idx],
    ...patch,
    updatedAt: now,
  };
  store.connections[idx] = next;
  await saveConnectors(store);
  return next;
}

export async function pushJob(job: SyncJobResult): Promise<void> {
  const store = await loadConnectors();
  store.jobs.unshift(job);
  await saveConnectors(store);
}

export { STORE_PATH as CONNECTORS_STORE_PATH };
