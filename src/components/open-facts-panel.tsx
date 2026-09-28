"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Fact, FactKind } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  task: "Задача",
  decision: "Решение",
  risk: "Риск",
  context: "Контекст",
  theme: "Тема",
  relationship: "Связь",
  event: "Событие",
  identity: "Идентичность",
  preference: "Предпочтение",
  skill: "Навык",
};

const STATE_KINDS: FactKind[] = ["task", "decision", "risk"];

export function OpenFactsPanel({
  facts,
  people,
}: {
  facts: Fact[];
  people: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: Fact["status"]) {
    setBusy(id);
    try {
      const res = await fetch("/api/facts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("patch failed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const grouped = STATE_KINDS.map((kind) => ({
    kind,
    items: facts.filter((f) => f.kind === kind),
  })).filter((g) => g.items.length > 0);

  const other = facts.filter((f) => !STATE_KINDS.includes(f.kind));

  if (!facts.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Открытых фактов нет. Добавьте заметку в Inbox или закрепите из чата.
      </p>
    );
  }

  function renderList(items: Fact[]) {
    return (
      <ul className="space-y-3">
        {items.map((f) => (
          <li
            key={f.id}
            className="rounded-lg border border-[var(--line)] bg-[var(--paper)]/80 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              <span>{KIND_LABEL[f.kind] || f.kind}</span>
              <span>·</span>
              <span>{f.origin}</span>
              <span>·</span>
              <span>{f.confidence}</span>
            </div>
            <h3 className="mt-1 font-medium text-[var(--ink)]">{f.title}</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{f.detail}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {f.personIds
                .map((id) => people[id] || id.slice(0, 8))
                .join(" · ")}
              {f.sourceId ? (
                <>
                  {" · "}
                  <Link
                    href={`/sources/${f.sourceId}`}
                    className="underline decoration-[var(--accent)]"
                  >
                    источник
                  </Link>
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => void setStatus(f.id, "done")}
                className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] disabled:opacity-40"
              >
                Готово
              </button>
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => void setStatus(f.id, "stale")}
                className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-soft)]"
              >
                Устарело
              </button>
              <button
                type="button"
                disabled={busy === f.id}
                onClick={() => void setStatus(f.id, "dismissed")}
                className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--danger)]"
              >
                Скрыть
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map((g) => (
        <section key={g.kind}>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            {KIND_LABEL[g.kind]} · {g.items.length}
          </h2>
          {renderList(g.items)}
        </section>
      ))}
      {other.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Прочее открытое · {other.length}
          </h2>
          {renderList(other)}
        </section>
      )}
    </div>
  );
}
