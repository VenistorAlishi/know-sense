import Link from "next/link";
import { notFound } from "next/navigation";
import { FactsList } from "@/components/meanings";
import { getPerson } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const detail = await getPerson(decoded);
  if (!detail) notFound();
  const { person, sources, facts, chunks } = detail;

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {person.isSelf
            ? "владелец базы"
            : person.relationToSelf === "close"
              ? "близкий контакт"
              : "человек в базе"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          {person.canonicalName}
        </h1>
        <p className="text-[var(--ink-soft)]">
          {person.bio || "Биография собирается из фактов источников."}
        </p>
        {person.aliases.length > 1 && (
          <p className="text-sm text-[var(--muted)]">
            также:{" "}
            {person.aliases
              .filter((a) => a !== person.canonicalName)
              .join(", ")}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Темы
        </h2>
        {person.themes.length ? (
          <ul className="flex flex-wrap gap-2">
            {person.themes.map((t) => (
              <li
                key={t}
                className="rounded-md bg-[var(--paper-soft)] px-3 py-1 text-sm text-[var(--ink)]"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">Темы ещё не извлечены.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Источники
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Нет источников.{" "}
            <Link href="/ingest" className="text-[var(--accent-deep)] underline">
              Загрузить
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {sources.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sources/${s.id}`}
                  className="font-medium text-[var(--accent-deep)] hover:underline"
                >
                  {s.title}
                </Link>
                <p className="text-sm text-[var(--ink-soft)]">{s.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Факты
        </h2>
        <FactsList facts={facts} />
      </section>

      {chunks.length > 0 && (
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
            Фрагменты
          </h2>
          <ul className="space-y-3">
            {chunks.slice(0, 8).map((c) => (
              <li
                key={c.id}
                className="border-l-2 border-[var(--line)] pl-3 text-sm text-[var(--ink-soft)]"
              >
                <p className="text-xs text-[var(--muted)]">{c.title}</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {c.text.slice(0, 320)}
                  {c.text.length > 320 ? "…" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
