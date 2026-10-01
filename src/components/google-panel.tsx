"use client";

import { useEffect, useState, useTransition } from "react";

type Row = {
  id: string;
  title: string;
  description: string;
  status: string;
  configured: boolean;
  accountHint?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastError?: string;
};

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "подключено";
    case "needs_auth":
      return "нужен OAuth";
    case "error":
      return "ошибка";
    case "available":
      return "нет ключей";
    default:
      return status;
  }
}

function statusTone(status: string): string {
  if (status === "connected" || status === "ok") return "text-[var(--ok)]";
  if (status === "error") return "text-[var(--danger)]";
  if (status === "needs_auth") return "text-[var(--accent-deep)]";
  return "text-[var(--muted)]";
}

export function GooglePanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/connectors");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось загрузить Google-коннекторы");
      return;
    }
    setRows(
      (data.connectors || []).filter(
        (c: Row) => c.id === "google-calendar" || c.id === "google-drive",
      ),
    );
  }

  useEffect(() => {
    void reload();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setMsg("Google аккаунт подключён (Calendar + Drive)");
    if (params.get("error")) setError(params.get("error"));
  }, []);

  function sync(id: string) {
    setError(null);
    setMsg(null);
    setSyncing(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/connectors/${id}/sync`, { method: "POST" });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          setError(
            data.job?.errors?.[0] || data.detail || data.error || "Sync error",
          );
        } else {
          const n = data.job?.imported ?? 0;
          setMsg(
            `${id}: +${n}` + (data.job?.detail ? ` · ${data.job.detail}` : ""),
          );
          if (n > 0) window.location.reload();
        }
        await reload();
      } finally {
        setSyncing(null);
      }
    });
  }

  const anyConfigured = rows.some((r) => r.configured);
  const anyConnected = rows.some((r) => r.status === "connected");

  return (
    <section className="google-panel space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]/75 p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-[var(--accent)]/12 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Google аккаунт
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Один OAuth на Calendar и Drive. В Google Cloud включи оба API и
              добавь redirect URI.
            </p>
          </div>
          <a
            href="/api/connectors/google/auth"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              anyConfigured
                ? "bg-[var(--ink)] text-[var(--wash)] hover:bg-[var(--accent-deep)]"
                : "pointer-events-none bg-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {anyConnected ? "Переподключить Google" : "Подключить Google"}
          </a>
        </div>

        {!anyConfigured && (
          <p className="relative mt-4 text-sm text-[var(--muted)]">
            Задай в{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1">.env.local</code>
            :{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1">GOOGLE_CLIENT_ID</code>{" "}
            и{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1">
              GOOGLE_CLIENT_SECRET
            </code>
            . Redirect:{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1 text-[11px]">
              http://127.0.0.1:3847/api/connectors/google/callback
            </code>
          </p>
        )}

        <ol className="relative mt-4 space-y-1 text-xs leading-relaxed text-[var(--muted)]">
          <li>1. Google Cloud → OAuth client (Web) + Calendar API + Drive API</li>
          <li>2. Redirect URI как выше → ключи в .env.local → Подключить</li>
          <li>
            3. Sync Calendar / Drive. Опционально{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1">
              GOOGLE_DRIVE_FOLDER_ID
            </code>
          </li>
        </ol>
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

      <ul className="grid gap-4 sm:grid-cols-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                {c.title.replace("Google ", "")}
              </h3>
              <p
                className={`text-xs uppercase tracking-[0.12em] ${statusTone(c.status)}`}
              >
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current ${
                    pending && syncing === c.id ? "animate-pulse" : ""
                  }`}
                />
                {statusLabel(c.status)}
              </p>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{c.description}</p>
            {c.accountHint && (
              <p className="mt-2 text-xs text-[var(--ink-soft)]">{c.accountHint}</p>
            )}
            {c.lastSyncAt && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                sync {new Date(c.lastSyncAt).toLocaleString("ru-RU")}
                {c.lastSyncStatus ? ` · ${c.lastSyncStatus}` : ""}
              </p>
            )}
            {c.lastError && c.status === "error" && (
              <p className="mt-2 text-xs text-[var(--danger)]">{c.lastError}</p>
            )}
            <button
              type="button"
              disabled={pending || c.status !== "connected"}
              onClick={() => sync(c.id)}
              className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--accent)]/20 px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent)]/35 disabled:opacity-40"
            >
              {syncing === c.id
                ? "Синхронизирую…"
                : c.id === "google-calendar"
                  ? "Забрать события"
                  : "Забрать файлы"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
