"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const TYPES = [
  { value: "auto", label: "Авто" },
  { value: "telegram_chat", label: "Telegram JSON" },
  { value: "meeting", label: "Встреча (.md)" },
  { value: "note", label: "Заметка" },
  { value: "file", label: "Файл/текст" },
] as const;

export function UploadPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("auto");
  const [markClose, setMarkClose] = useState(true);

  async function ingest(payload: FormData | Record<string, unknown>) {
    setError(null);
    setOk(null);
    const res =
      payload instanceof FormData
        ? await fetch("/api/ingest", { method: "POST", body: payload })
        : await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || data.detail || "Ошибка загрузки");
      return;
    }
    setOk(
      `Загружено: ${data.source.title} · ${data.chunkCount} чанков · ${data.factCount} фактов`,
    );
    startTransition(() => {
      router.push(`/sources/${data.source.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Тип</span>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as (typeof TYPES)[number]["value"])
              }
              className="rounded-md border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-[var(--ink)]"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={markClose}
              onChange={(e) => setMarkClose(e.target.checked)}
            />
            Peer из TG → близкий контакт
          </label>
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-sm text-[var(--muted)]">
          Файл (result.json / .md / .txt)
        </span>
        <input
          type="file"
          accept=".json,.md,.txt,application/json,text/markdown,text/plain"
          disabled={pending}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-medium file:text-[var(--ink)] hover:file:brightness-110"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("file", file);
            fd.append("type", type);
            fd.append("markPeerClose", markClose ? "true" : "false");
            void ingest(fd);
          }}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted)]">или вставьте текст / JSON</span>
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() =>
              void ingest({
                text,
                filename:
                  type === "telegram_chat" ? "result.json" : "pasted-note.md",
                type,
                markPeerClose: markClose,
              })
            }
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)] transition hover:bg-[var(--ink-soft)] disabled:opacity-40"
          >
            {pending ? "Загружаю…" : "Загрузить"}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={compact ? 6 : 10}
          placeholder='Telegram Desktop → Export chat history → JSON. Вставьте содержимое result.json…'
          className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2"
        />
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-[var(--ok)]" role="status">
          {ok}
        </p>
      )}
    </div>
  );
}
