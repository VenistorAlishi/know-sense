"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

type ConnectorRow = {
  id: string;
  title: string;
  description: string;
  auth: string;
  status: string;
  enabled: boolean;
  configured: boolean;
  accountHint?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastError?: string;
};

type Job = {
  connectorId: string;
  status: string;
  imported: number;
  skipped: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
  detail?: string;
};

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "подключено";
    case "needs_auth":
      return "нужен доступ";
    case "error":
      return "ошибка";
    case "available":
      return "доступно";
    default:
      return status;
  }
}

export default function ConnectorsPage() {
  const [rows, setRows] = useState<ConnectorRow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/connectors");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось загрузить коннекторы");
      return;
    }
    setRows(data.connectors || []);
    setJobs(data.jobs || []);
  }, []);

  useEffect(() => {
    void reload();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setMsg(`Подключено: ${params.get("connected")}`);
    }
    if (params.get("error")) {
      setError(params.get("error"));
    }
  }, [reload]);

  function sync(id: string) {
    setError(null);
    setMsg(null);
    setSyncingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/connectors/${id}/sync`, { method: "POST" });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          setError(
            data.job?.errors?.[0] || data.detail || data.error || "Sync error",
          );
        } else {
          setMsg(
            `${id}: импортировано ${data.job?.imported ?? 0}` +
              (data.job?.detail ? ` · ${data.job.detail}` : ""),
          );
        }
        await reload();
      } finally {
        setSyncingId(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-[var(--muted)]">
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          / Connectors
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Коннекторы
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Голос,{" "}
          <Link href="/google" className="text-[var(--accent-deep)] underline">
            Google
          </Link>
          ,{" "}
          <Link href="/mail" className="text-[var(--accent-deep)] underline">
            почта
          </Link>
          ,{" "}
          <Link href="/obsidian" className="text-[var(--accent-deep)] underline">
            Obsidian
          </Link>
          . Токены в{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">
            data/store/connectors.json
          </code>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {msg && (
        <p className="text-sm text-[var(--ok)]" role="status">
          {msg}
        </p>
      )}

      <ul className="space-y-4">
        {rows.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg text-[var(--ink)]">{c.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.description}</p>
                <p className="mt-2 text-xs text-[var(--ink-soft)]">
                  {statusLabel(c.status)}
                  {c.accountHint ? ` · ${c.accountHint}` : ""}
                  {c.lastSyncAt
                    ? ` · ${new Date(c.lastSyncAt).toLocaleString("ru-RU")}`
                    : ""}
                </p>
                {c.lastError && (
                  <p className="mt-1 text-xs text-[var(--danger)]">{c.lastError}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(c.id === "google-calendar" || c.id === "google-drive") && (
                  <Link
                    href="/google"
                    className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)]"
                  >
                    Открыть Google
                  </Link>
                )}
                {c.id === "voice" && (
                  <Link
                    href="/ingest#voice"
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
                  >
                    Загрузить голос
                  </Link>
                )}
                {c.id === "yandex-mail" && (
                  <Link
                    href="/mail"
                    className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)]"
                  >
                    Открыть почту
                  </Link>
                )}
                {c.id === "obsidian" && (
                  <Link
                    href="/obsidian"
                    className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)]"
                  >
                    Открыть Obsidian
                  </Link>
                )}
                {c.id === "voice" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => sync(c.id)}
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    {syncingId === c.id ? "…" : "ASR backfill"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {jobs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[var(--ink)]">Последние sync jobs</h2>
          <ul className="mt-2 space-y-2 text-xs text-[var(--muted)]">
            {jobs.map((j, i) => (
              <li key={`${j.connectorId}-${j.startedAt}-${i}`}>
                {new Date(j.finishedAt).toLocaleString("ru-RU")} · {j.connectorId} ·{" "}
                {j.status} · +{j.imported} / skip {j.skipped}
                {j.detail ? ` · ${j.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
