import type { Meaning, PersonMention } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  theme: "Тема",
  decision: "Решение",
  action: "Задача",
  risk: "Риск",
  context: "Контекст",
  identity: "Идентичность",
};

export function MeaningsList({ meanings }: { meanings: Meaning[] }) {
  if (!meanings.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Структурированных смыслов пока нет — загрузите более размеченный анализ
        встречи.
      </p>
    );
  }

  return (
    <ol className="space-y-5">
      {meanings.map((m) => (
        <li key={m.id} className="grid gap-1 border-l-2 border-[var(--accent)] pl-4">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            <span>{KIND_LABEL[m.kind] || m.kind}</span>
            <span>·</span>
            <span>{m.confidence}</span>
            {m.speakers.length > 0 && (
              <>
                <span>·</span>
                <span className="normal-case tracking-normal">{m.speakers.join(", ")}</span>
              </>
            )}
          </div>
          <h3 className="font-medium text-[var(--ink)]">{m.title}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-soft)]">
            {m.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function PeopleStrip({ people }: { people: PersonMention[] }) {
  if (!people.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((p) => (
        <li key={p.name}>
          <a
            href={`/people/${encodeURIComponent(p.isPrimary ? "kirill" : p.name)}`}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
              p.isPrimary
                ? "bg-[var(--accent)] text-[var(--ink)]"
                : "bg-[var(--paper-soft)] text-[var(--ink-soft)] hover:bg-[var(--line)]"
            }`}
          >
            <span className="font-medium">{p.name}</span>
            {p.isPrimary && <span className="text-xs opacity-80">вы</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
