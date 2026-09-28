import Link from "next/link";
import { notFound } from "next/navigation";
import { MeaningsList } from "@/components/meanings";
import { getPerson } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const person = await getPerson(decoded === "kirill" ? "Кирилл" : decoded);
  if (!person) notFound();

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {person.isUser ? "основной пользователь базы" : "участник"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          {person.canonicalName}
        </h1>
        <p className="text-[var(--ink-soft)]">
          {person.roleHints.length
            ? person.roleHints.join(" · ")
            : "Ролевые сигналы появятся после большего числа встреч"}
        </p>
        {person.aliases.length > 1 && (
          <p className="text-sm text-[var(--muted)]">
            также: {person.aliases.filter((a) => a !== person.canonicalName).join(", ")}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Темы рядом с человеком
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
          <p className="text-sm text-[var(--muted)]">Темы ещё не связаны.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Встречи
        </h2>
        <ul className="space-y-3">
          {person.meetings.map((m) => (
            <li key={m.id}>
              <Link
                href={`/meetings/${m.id}`}
                className="font-medium text-[var(--accent-deep)] hover:underline"
              >
                {m.title}
              </Link>
              <p className="text-sm text-[var(--ink-soft)]">{m.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
          Смыслы с участием
        </h2>
        <MeaningsList meanings={person.meanings} />
      </section>
    </article>
  );
}
