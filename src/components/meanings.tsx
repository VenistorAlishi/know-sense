import Link from "next/link";
import type { Fact, Person } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  identity: "Идентичность",
  relationship: "Связь",
  preference: "Предпочтение",
  skill: "Навык",
  event: "Событие",
  task: "Задача",
  context: "Контекст",
  theme: "Тема",
  decision: "Решение",
  risk: "Риск",
};

export function FactsList({ facts }: { facts: Fact[] }) {
  if (!facts.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Фактов пока нет — загрузите источники.
      </p>
    );
  }

  return (
    <ol className="space-y-5">
      {facts.map((f) => (
        <li key={f.id} className="grid gap-1 border-l-2 border-[var(--accent)] pl-4">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            <span>{KIND_LABEL[f.kind] || f.kind}</span>
            <span>·</span>
            <span>{f.status || "open"}</span>
            <span>·</span>
            <span>{f.origin || "heuristic"}</span>
            <span>·</span>
            <span>{f.confidence}</span>
          </div>
          <h3 className="font-medium text-[var(--ink)]">{f.title}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-soft)]">
            {f.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function PeopleStrip({ people }: { people: Person[] }) {
  if (!people.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((p) => (
        <li key={p.id}>
          <Link
            href={`/people/${p.isSelf ? "kirill" : p.id}`}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
              p.isSelf || p.relationToSelf === "close"
                ? "bg-[var(--accent)] text-[var(--ink)]"
                : "bg-[var(--paper-soft)] text-[var(--ink-soft)] hover:bg-[var(--line)]"
            }`}
          >
            <span className="font-medium">{p.canonicalName}</span>
            {p.isSelf && <span className="text-xs opacity-80">вы</span>}
            {!p.isSelf && p.relationToSelf === "close" && (
              <span className="text-xs opacity-80">близкий</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
