import Link from "next/link";
import { notFound } from "next/navigation";
import { FactsList, PeopleStrip } from "@/components/meanings";
import { getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSource(id);
  if (!detail) notFound();
  const { source, chunks, facts, people } = detail;

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {source.type}
          {source.meta.messageCount != null
            ? ` · ${source.meta.messageCount} сообщ.`
            : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
          {source.title}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-[var(--ink-soft)]">
          {source.summary}
        </p>
        <PeopleStrip people={people} />
      </header>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Факты
        </h2>
        <FactsList facts={facts} />
      </section>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Чанки
        </h2>
        <ul className="space-y-4">
          {chunks.slice(0, 40).map((c) => (
            <li
              key={c.id}
              className="border-b border-[var(--line)] pb-4 last:border-0"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {c.kind}
                {c.timestamp ? ` · ${c.timestamp}` : ""}
              </p>
              <p className="font-medium text-[var(--ink)]">{c.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-soft)]">
                {c.text.slice(0, 500)}
                {c.text.length > 500 ? "…" : ""}
              </p>
            </li>
          ))}
        </ul>
        {chunks.length > 40 && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Показаны 40 из {chunks.length}. Полный поиск — на главной.
          </p>
        )}
      </section>

      <p className="text-xs text-[var(--muted)]">
        Файл: {source.path || source.rawRef} ·{" "}
        <Link href="/ingest" className="text-[var(--accent-deep)] hover:underline">
          загрузить ещё
        </Link>
      </p>
    </article>
  );
}
