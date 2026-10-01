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

function statusTone(status: string): string {
  if (status === "connected" || status === "ok") return "text-[var(--ok)]";
  if (status === "error") return "text-[var(--danger)]";
  if (status === "needs_auth") return "text-[var(--accent-deep)]";
  return "text-[var(--muted)]";
}

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "подключено";
    case "needs_auth":
      return "нужен пароль";
    case "error":
      return "ошибка";
    case "available":
      return "не подключено";
    default:
      return status;
  }
}

export function MailPanel({ onSynced }: { onSynced?: () => void }) {
  const [info, setInfo] = useState<Status | null>(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"save" | "sync" | null>(null);

  async function reload() {
    const res = await fetch("/api/connectors");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Не удалось загрузить статус");
      return;
    }
    const row = (data.connectors || []).find(
      (c: { id: string }) => c.id === "yandex-mail",
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
    if (row.accountHint) setUser((u) => u || row.accountHint);
  }

  useEffect(() => {
    void reload();
  }, []);

  function save() {
    setError(null);
    setMsg(null);
    setBusyAction("save");
    startTransition(async () => {
      try {
        const res = await fetch("/api/connectors/yandex-mail/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user, appPassword: pass }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail || data.error || "Не удалось подключить");
        } else {
          setMsg(`Вход проверен: ${data.user}`);
          setPass("");
        }
        await reload();
      } finally {
        setBusyAction(null);
      }
    });
  }

  function sync() {
    setError(null);
    setMsg(null);
    setBusyAction("sync");
    startTransition(async () => {
      try {
        const res = await fetch("/api/connectors/yandex-mail/sync", {
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
              ? `Импортировано ${n} писем`
              : data.job?.detail || "Новых писем нет",
          );
          onSynced?.();
          // Soft refresh so SSR list updates
          if (n > 0) window.location.reload();
        }
        await reload();
      } finally {
        setBusyAction(null);
      }
    });
  }

  const connected = Boolean(info?.configured);

  return (
    <section
      className="mail-panel relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]/75 p-5 sm:p-6"
      aria-labelledby="mail-connect-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--accent)]/15 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="mail-connect-title"
              className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
            >
              Яндекс.Почта
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
              IMAP INBOX → база Смысла. Нужен пароль приложения, не обычный
              пароль от аккаунта.
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
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Аккаунт: <span className="font-medium text-[var(--ink)]">{info.accountHint}</span>
            {info.lastSyncAt ? (
              <span className="text-[var(--muted)]">
                {" "}
                · синхр. {new Date(info.lastSyncAt).toLocaleString("ru-RU")}
              </span>
            ) : null}
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--muted)]">
            Email
            <input
              type="email"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="you@yandex.ru"
              className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)]/60 px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--paper)]"
              autoComplete="username"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Пароль приложения
            <div className="mt-1.5 flex gap-2">
              <input
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="из id.yandex.ru"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)]/60 px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--paper)]"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="shrink-0 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--ink-soft)] hover:bg-[var(--paper-soft)]"
              >
                {showPass ? "Скрыть" : "Показать"}
              </button>
            </div>
          </label>
        </div>

        <ol className="mt-4 space-y-1 text-xs leading-relaxed text-[var(--muted)]">
          <li>1. Открой id.yandex.ru → Безопасность → Пароли приложений</li>
          <li>2. Создай пароль для «Почта» и вставь сюда</li>
          <li>3. Подключить → Забрать письма (INBOX, ~14 дней)</li>
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !user.trim() || !pass.trim()}
            onClick={save}
            className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--wash)] transition hover:bg-[var(--accent-deep)] disabled:opacity-40"
          >
            {busyAction === "save"
              ? "Проверяю IMAP…"
              : connected
                ? "Обновить пароль"
                : "Подключить"}
          </button>
          <button
            type="button"
            disabled={pending || !connected}
            onClick={sync}
            className="rounded-lg border border-[var(--line)] bg-[var(--accent)]/20 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent)]/35 disabled:opacity-40"
          >
            {busyAction === "sync" ? "Забираю…" : "Забрать письма"}
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
          !info.lastError.includes("YANDEX_MAIL") && (
            <p className="mt-2 text-xs text-[var(--danger)]">{info.lastError}</p>
          )}
      </div>
    </section>
  );
}
