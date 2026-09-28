"use client";

import { useState } from "react";

export function InboxPanel() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || pending) return;
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body,
          type: "note",
          title: title.trim() || undefined,
          filename: "inbox-note.txt",
          syncPalace: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ingest failed");
      setText("");
      setTitle("");
      setStatus(
        `Сохранено: ${data.source?.title || "заметка"} · фактов ${data.factCount ?? 0}` +
          (data.palace?.ok ? " · palace ok" : ""),
      );
    } catch (error) {
      setStatus(`Ошибка: ${String(error)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-4"
    >
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          Inbox
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Бросьте мысль за 5 секунд — уйдёт в память и в wing kirill.
        </p>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок (необязательно)"
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Надо обсудить бюджет с Игорем завтра… / решили отложить релиз…"
        rows={4}
        className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "В память"}
        </button>
        {status && (
          <span className="text-xs text-[var(--muted)]">{status}</span>
        )}
      </div>
    </form>
  );
}
