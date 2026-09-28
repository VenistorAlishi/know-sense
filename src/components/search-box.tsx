"use client";

import Link from "next/link";
import { useState } from "react";

type Result = {
  score: number;
  meetingId: string;
  meetingTitle: string;
  kind: string;
  title: string;
  text: string;
  speakers: string[];
};

export function SearchBox() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка поиска");
      setResults(data.results);
    } catch (err) {
      setError(String(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Например: что решили по запуску? роль Кирилла?"
          className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-4 py-3 text-[var(--ink)] outline-none ring-[var(--accent)] placeholder:text-[var(--muted)] focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-5 py-3 font-medium text-[var(--ink)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Ищу…" : "Найти"}
        </button>
      </form>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Ничего не найдено. Загрузите встречу и попробуйте другой запрос.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r, i) => (
            <li
              key={`${r.meetingId}-${i}`}
              className="border-b border-[var(--line)] pb-3 last:border-0"
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span className="uppercase tracking-wide">{r.kind}</span>
                <span>score {r.score.toFixed(3)}</span>
                <Link
                  href={`/meetings/${r.meetingId}`}
                  className="text-[var(--accent-deep)] underline-offset-2 hover:underline"
                >
                  {r.meetingTitle}
                </Link>
              </div>
              <p className="font-medium text-[var(--ink)]">{r.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                {r.text.slice(0, 280)}
                {r.text.length > 280 ? "…" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
