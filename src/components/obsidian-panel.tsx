"use client";

import { useEffect, useState, useTransition } from "react";

type Status = {
  configured: boolean;
  status: string;
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
      return "нужен путь";
    case "error":
      return "ошибка";
    case "available":
      return "не подключено";
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

export function ObsidianPanel() {
  const [info, setInfo] = useState<Status | null>(null);
  const [vaultPath, setVaultPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);

  async function reload() {
    const res = await fetch("/api/connectors");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось загрузить статус");
      return;
    }
    const row = (data.connectors || []).find(
      (c: { id: string }) => c.id === "obsidian",
    );
    if (!row) return;
    setInfo({
      configured: row.configured,
      status: row.status,
      accountHint: row.accountHint,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      lastError: row.lastError,
    });
    if (row.accountHint) setVaultPath((p) => p || row.accountHint);
  }

  useEffect(() => {
    void reload();
  }, []);

  function save() {
    setError(null);
    setMsg(null);
    setBusy("save");
    startTransition(async () => {
      try {
        const res = await fetch("/api/connectors/obsidian/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail || data.error || "Не удалось сохранить путь");
        } else {
          setMsg(`Vault: ${data.vaultPath}`);
        }
        await reload();
      } finally {
        setBusy(null);
      }
    });
  }

  function sync() {
    setError(null);
    setMsg(null);
    setBusy("sync");
    startTransition(async () => {
      try {
        const res = await fetch("/api/connectors/obsidian/sync", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          setError(
            data.job?.errors?.[0] || data.detail || data.error || "Sync error",
          );
        } else {
          const n = data.job?.imported ?? 0;
          setMsg(
            n
              ? `Импортировано/обновлено ${n}`
              : data.job?.detail || "Новых заметок нет",
          );
          if (n > 0) window.location.reload();
        }
        await reload();
      } finally {
        setBusy(null);
      }
    });
  }

  const connected = Boolean(info?.configured);

  return (
    <section
      className="obsidian-panel relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]/75 p-5 sm:p-6"
      aria-labelledby="obsidian-connect-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[var(--accent)]/14 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="obsidian-connect-title"
              className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
            >
              Vault
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              Односторонний импорт: Смысл читает `.md`, Obsidian остаётся
              редактором. Без записи обратно в vault.
            </p>
          </div>
          <p
            className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] ${statusTone(info?.status || "available")}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full bg-current ${
                pending ? "animate-pulse" : ""
              }`}
            />
            {statusLabel(info?.status || "available")}
          </p>
        </div>

        {connected && info?.accountHint && (
          <p className="mt-3 break-all text-sm text-[var(--ink-soft)]">
            Путь:{" "}
            <span className="font-medium text-[var(--ink)]">
              {info.accountHint}
            </span>
            {info.lastSyncAt ? (
              <span className="text-[var(--muted)]">
                {" "}
                · синхр. {new Date(info.lastSyncAt).toLocaleString("ru-RU")}
              </span>
            ) : null}
          </p>
        )}

        <label className="mt-5 block text-xs text-[var(--muted)]">
          Абсолютный путь к vault
          <input
            type="text"
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            placeholder="/home/you/Documents/ObsidianVault"
            className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)]/60 px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--paper)]"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <ol className="mt-4 space-y-1 text-xs leading-relaxed text-[var(--muted)]">
          <li>1. Укажи папку vault (там же, где `.obsidian`)</li>
          <li>2. Сохранить путь → Импортировать заметки</li>
          <li>
            3. Повторный sync подтягивает новые и обновляет изменённые по hash
          </li>
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !vaultPath.trim()}
            onClick={save}
            className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--wash)] transition hover:bg-[var(--accent-deep)] disabled:opacity-40"
          >
            {busy === "save" ? "Проверяю…" : "Сохранить путь"}
          </button>
          <button
            type="button"
            disabled={pending || !connected}
            onClick={sync}
            className="rounded-lg border border-[var(--line)] bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent)]/35 disabled:opacity-40"
          >
            {busy === "sync" ? "Импортирую…" : "Импортировать заметки"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        {msg && (
          <p className="mt-3 text-sm text-[var(--ok)]" role="status">
            {msg}
          </p>
        )}
        {info?.lastError &&
          !error &&
          info.status === "error" &&
          !info.lastError.includes("OBSIDIAN_VAULT") && (
            <p className="mt-2 text-xs text-[var(--danger)]">{info.lastError}</p>
          )}
      </div>
    </section>
  );
}
