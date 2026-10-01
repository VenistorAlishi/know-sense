import Link from "next/link";
import { GooglePanel } from "@/components/google-panel";
import { listStats } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function GooglePage() {
  const { store } = await listStats();
  const calendar = store.sources
    .filter((s) => s.type === "calendar")
    .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))
    .slice(0, 20);
  const drive = store.sources
    .filter((s) => s.type === "drive")
    .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt))
    .slice(0, 20);

  return (
    <div className="space-y-10">
      <header className="google-hero space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Коннекторы · OAuth
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Google
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Календарь и Drive в одной памяти Смысла — события и документы рядом с
          чатами и почтой.
        </p>
      </header>

      <GooglePanel />

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="gcal-list">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2
                id="gcal-list"
                className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
              >
                Календарь
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {calendar.length
                  ? `${calendar.length} в базе (недавние)`
                  : "Пока пусто — забери события после OAuth"}
              </p>
            </div>
          </div>
          {calendar.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Нет событий calendar
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {calendar.map((ev, i) => (
                <li
                  key={ev.id}
                  className="google-row py-3"
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                >
                  <Link
                    href={`/sources/${ev.id}`}
                    className="block rounded-lg px-1 py-1 hover:bg-[var(--wash)]/40"
                  >
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {ev.title.replace(/^📅\s*/, "")}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">
                      {formatWhen(ev.meta.dateRange?.from || ev.ingestedAt)}
                      {ev.meta.peerName ? ` · ${ev.meta.peerName}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="gdrive-list">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2
                id="gdrive-list"
                className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
              >
                Drive
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {drive.length
                  ? `${drive.length} файлов в базе`
                  : "Docs / Sheets / текст появятся после Sync"}
              </p>
            </div>
          </div>
          {drive.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Нет файлов drive
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {drive.map((f, i) => (
                <li
                  key={f.id}
                  className="google-row py-3"
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                >
                  <Link
                    href={`/sources/${f.id}`}
                    className="block rounded-lg px-1 py-1 hover:bg-[var(--wash)]/40"
                  >
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {f.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">
                      {f.meta.driveMime?.replace("application/vnd.google-apps.", "") ||
                        "file"}
                      {f.meta.extractedAt
                        ? ` · ${formatWhen(f.meta.extractedAt)}`
                        : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Все источники —{" "}
        <Link href="/sources" className="text-[var(--accent-deep)] hover:underline">
          /sources
        </Link>
        . Почта —{" "}
        <Link href="/mail" className="text-[var(--accent-deep)] hover:underline">
          /mail
        </Link>
        .
      </p>
    </div>
  );
}
