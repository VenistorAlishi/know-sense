import Link from "next/link";
import { ObsidianPanel } from "@/components/obsidian-panel";
import { listStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ObsidianPage() {
  const { store } = await listStats();
  const notes = store.sources
    .filter((s) => s.type === "obsidian")
    .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));

  return (
    <div className="space-y-10">
      <header className="obsidian-hero space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Коннектор · vault
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Obsidian
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Vault остаётся местом письма. Смысл забирает заметки в ту же память,
          что почта, Drive и чаты — без sync обратно.
        </p>
      </header>

      <ObsidianPanel />

      <section aria-labelledby="obsidian-notes-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="obsidian-notes-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
            >
              В базе
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {notes.length
                ? `${notes.length} ${notes.length === 1 ? "заметка" : notes.length < 5 ? "заметки" : "заметок"}`
                : "Пока пусто — укажи vault и импортируй"}
            </p>
          </div>
          <Link
            href="/sources"
            className="text-sm text-[var(--accent-deep)] hover:underline"
          >
            Все источники
          </Link>
        </div>

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] px-5 py-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Vault ещё не импортирован
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              Для пробы можно указать{" "}
              <code className="rounded bg-[var(--paper-soft)] px-1 text-xs">
                data/fixtures/obsidian-vault
              </code>{" "}
              (абсолютный путь в репозитории).
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {notes.map((note, i) => (
              <li
                key={note.id}
                className="obsidian-row py-4"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <Link
                  href={`/sources/${note.id}`}
                  className="group block rounded-lg outline-none transition hover:bg-[var(--wash)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 py-1 sm:px-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--muted)]">
                      {note.meta.obsidianPath || note.meta.originalFilename}
                    </p>
                    <time
                      className="shrink-0 text-xs tabular-nums text-[var(--muted)]"
                      dateTime={note.ingestedAt}
                    >
                      {new Date(note.ingestedAt).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="px-1 text-base font-medium text-[var(--ink)] group-hover:text-[var(--accent-deep)] sm:px-2">
                    {note.title}
                  </p>
                  <p className="mt-1 line-clamp-2 px-1 text-sm text-[var(--ink-soft)] sm:px-2">
                    {note.summary}
                  </p>
                  {(note.meta.obsidianTags?.length || 0) > 0 && (
                    <p className="mt-1.5 px-1 text-xs text-[var(--muted)] sm:px-2">
                      {note.meta.obsidianTags!.map((t) => `#${t}`).join(" · ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
