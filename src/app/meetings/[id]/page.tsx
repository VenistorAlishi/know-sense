import Link from "next/link";
import { notFound } from "next/navigation";
import { MeaningsList, PeopleStrip } from "@/components/meanings";
import { getMeeting } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();

  const kirill = meeting.people.find((p) => p.isPrimary);

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {meeting.sourceFile}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
          {meeting.title}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-[var(--ink-soft)]">
          {meeting.summary}
        </p>
        <PeopleStrip people={meeting.people} />
      </header>

      {kirill && (
        <section className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Кирилл на этой встрече
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Реплик: {kirill.quoteCount} · задач рядом: {kirill.actionCount} ·
            решений рядом: {kirill.decisionCount}
          </p>
          {kirill.roleHints.length > 0 && (
            <p className="mt-1 text-sm text-[var(--ink)]">
              Ролевые сигналы: {kirill.roleHints.join(", ")}
            </p>
          )}
          {kirill.snippets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {kirill.snippets.slice(0, 4).map((s, i) => (
                <li
                  key={i}
                  className="border-l-2 border-[var(--accent-deep)] pl-3 text-sm leading-relaxed text-[var(--ink-soft)]"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/people/kirill"
            className="mt-4 inline-block text-sm font-medium text-[var(--accent-deep)] hover:underline"
          >
            Полный профиль Кирилла →
          </Link>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
            Темы
          </h2>
          <ul className="space-y-2 text-sm text-[var(--ink)]">
            {meeting.topics.length ? (
              meeting.topics.map((t, i) => <li key={i}>{t}</li>)
            ) : (
              <li className="text-[var(--muted)]">не выделены явно</li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
            Решения
          </h2>
          <ul className="space-y-2 text-sm text-[var(--ink)]">
            {meeting.decisions.length ? (
              meeting.decisions.map((t, i) => <li key={i}>{t}</li>)
            ) : (
              <li className="text-[var(--muted)]">не выделены явно</li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
            Задачи
          </h2>
          <ul className="space-y-2 text-sm text-[var(--ink)]">
            {meeting.actions.length ? (
              meeting.actions.map((t, i) => <li key={i}>{t}</li>)
            ) : (
              <li className="text-[var(--muted)]">не выделены явно</li>
            )}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Карта смыслов
        </h2>
        <MeaningsList meanings={meeting.meanings} />
      </section>

      <p className="text-xs text-[var(--muted)]">
        Чанков в индексе: {meeting.chunks.length}
      </p>
    </article>
  );
}
