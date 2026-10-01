import Link from "next/link";
import { notFound } from "next/navigation";
import { FactsList, PeopleStrip } from "@/components/meanings";
import { getSource } from "@/lib/store";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  telegram_chat: "Telegram",
  meeting: "Встреча",
  note: "Заметка",
  file: "Файл",
  email: "Почта",
  calendar: "Календарь",
  drive: "Drive",
  voice_note: "Голос",
  obsidian: "Obsidian",
  other: "Другое",
};

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSource(id);
  if (!detail) notFound();
  const { source, chunks, facts, people } = detail;
  const isEmail = source.type === "email";
  const isDrive = source.type === "drive";
  const isCalendar = source.type === "calendar";
  const isObsidian = source.type === "obsidian";

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {TYPE_LABEL[source.type] || source.type}
          {source.meta.messageCount != null
            ? ` · ${source.meta.messageCount} сообщ.`
            : ""}
          {isEmail && source.meta.emailDate
            ? ` · ${new Date(source.meta.emailDate).toLocaleString("ru-RU")}`
            : ""}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
          {source.title.replace(/^✉\s*/, "").replace(/^📅\s*/, "")}
        </h1>
        {isEmail && (source.meta.emailFrom || source.meta.emailTo) ? (
          <dl className="grid gap-1 text-sm text-[var(--ink-soft)] sm:grid-cols-[auto_1fr] sm:gap-x-3">
            {source.meta.emailFrom ? (
              <>
                <dt className="text-[var(--muted)]">От</dt>
                <dd>{source.meta.emailFrom}</dd>
              </>
            ) : null}
            {source.meta.emailTo ? (
              <>
                <dt className="text-[var(--muted)]">Кому</dt>
                <dd>{source.meta.emailTo}</dd>
              </>
            ) : null}
          </dl>
        ) : isDrive ? (
          <dl className="grid gap-1 text-sm text-[var(--ink-soft)] sm:grid-cols-[auto_1fr] sm:gap-x-3">
            {source.meta.driveMime ? (
              <>
                <dt className="text-[var(--muted)]">Тип</dt>
                <dd>{source.meta.driveMime}</dd>
              </>
            ) : null}
            {source.meta.driveLink ? (
              <>
                <dt className="text-[var(--muted)]">Ссылка</dt>
                <dd>
                  <a
                    href={source.meta.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-deep)] hover:underline"
                  >
                    Открыть в Drive
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        ) : isObsidian ? (
          <dl className="grid gap-1 text-sm text-[var(--ink-soft)] sm:grid-cols-[auto_1fr] sm:gap-x-3">
            {source.meta.obsidianPath ? (
              <>
                <dt className="text-[var(--muted)]">Файл</dt>
                <dd className="font-mono text-xs sm:text-sm">
                  {source.meta.obsidianPath}
                </dd>
              </>
            ) : null}
            {(source.meta.obsidianTags?.length || 0) > 0 ? (
              <>
                <dt className="text-[var(--muted)]">Теги</dt>
                <dd>
                  {source.meta.obsidianTags!.map((t) => `#${t}`).join(" · ")}
                </dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="max-w-3xl text-base leading-relaxed text-[var(--ink-soft)]">
            {source.summary}
          </p>
        )}
        <PeopleStrip people={people} />
        {isEmail ? (
          <p>
            <Link
              href="/mail"
              className="text-sm text-[var(--accent-deep)] hover:underline"
            >
              ← к почте
            </Link>
          </p>
        ) : null}
        {isDrive || isCalendar ? (
          <p>
            <Link
              href="/google"
              className="text-sm text-[var(--accent-deep)] hover:underline"
            >
              ← к Google
            </Link>
          </p>
        ) : null}
        {isObsidian ? (
          <p>
            <Link
              href="/obsidian"
              className="text-sm text-[var(--accent-deep)] hover:underline"
            >
              ← к Obsidian
            </Link>
          </p>
        ) : null}
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
