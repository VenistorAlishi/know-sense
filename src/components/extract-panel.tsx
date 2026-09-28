"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PendingSource = {
  id: string;
  title: string;
  type: string;
  ingestedAt: string;
};

export function ExtractPanel() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingSource[]>([]);
  const [openLlm, setOpenLlm] = useState(0);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/extract", { cache: "no-store" });
    const data = await res.json();
    setPending(data.pendingSources || []);
    setOpenLlm(data.openLlmFacts || 0);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(sourceId?: string) {
    setBusy(true);
    setLog(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceId ? { sourceId } : { limit: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "extract failed");
      if (sourceId) {
        setLog(
          data.error
            ? `Ошибка: ${data.error}`
            : `Создано фактов: ${data.created} (кандидатов ${data.candidates?.length || 0})`,
        );
      } else {
        const created = (data.results || []).reduce(
          (n: number, r: { created?: number }) => n + (r.created || 0),
          0,
        );
        setLog(`Обработано источников: ${data.processed} · фактов: ${created}`);
      }
      await refresh();
      router.refresh();
    } catch (error) {
      setLog(`Ошибка: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--muted)]">
        LLM читает источники без <code>extractedAt</code> и создаёт кандидаты
        Fact (<code>origin=llm</code>, status=open). Подтвердите или скройте их
        на странице Открытое.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || pending.length === 0}
          onClick={() => void run()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {busy ? "Извлекаю…" : `Извлечь из ${Math.min(3, pending.length)} источников`}
        </button>
        <span className="text-xs text-[var(--muted)]">
          В очереди: {pending.length} · open llm-фактов: {openLlm}
        </span>
      </div>
      {log && <p className="text-xs text-[var(--ink-soft)]">{log}</p>}
      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {pending.length === 0 ? (
          <li className="py-3 text-sm text-[var(--muted)]">
            Нет необработанных источников. Добавьте заметку в Inbox.
          </li>
        ) : (
          pending.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium text-[var(--ink)]">{s.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {s.type} · {new Date(s.ingestedAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(s.id)}
                className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-soft)]"
              >
                Extract
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
