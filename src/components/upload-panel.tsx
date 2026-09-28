"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function UploadPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [text, setText] = useState("");

  async function ingest(payload: FormData | { text: string; filename: string }) {
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
      setError(data.error || "Ошибка загрузки");
      return;
    }
    setOk(`Загружено: ${data.meeting.title} · смыслов: ${data.meeting.meaningCount}`);
    startTransition(() => {
      router.push(`/meetings/${data.meeting.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm text-[var(--muted)]">
          Файл анализа встречи (.md)
        </span>
        <input
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          disabled={pending}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:font-medium file:text-[var(--ink)] hover:file:brightness-110"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("file", file);
            void ingest(fd);
          }}
        />
      </label>

      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted)]">или вставьте текст</span>
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() =>
              void ingest({
                text,
                filename: "Анализ встречи — Запись 47.md",
              })
            }
            className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-[var(--paper)] transition hover:bg-[var(--ink-soft)] disabled:opacity-40"
          >
            {pending ? "Разбираю…" : "Разобрать"}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Вставьте содержимое «Анализ встречи — Запись 47.md»…"
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
