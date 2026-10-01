import Link from "next/link";
import { MailPanel } from "@/components/mail-panel";
import { listStats } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatMailDate(iso?: string, fallback?: string): string {
  const raw = iso || fallback;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bodyPreview(summary: string): string {
  return summary
    .replace(/^#.*$/m, "")
    .replace(/^From:.*$/gim, "")
    .replace(/^To:.*$/gim, "")
    .replace(/^Date:.*$/gim, "")
    .replace(/^Message-ID:.*$/gim, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export default async function MailPage() {
  const { store } = await listStats();
  const emails = store.sources
    .filter((s) => s.type === "email")
    .sort((a, b) => {
      const da = a.meta.emailDate || a.ingestedAt;
      const db = b.meta.emailDate || b.ingestedAt;
      return db.localeCompare(da);
    });

  return (
    <div className="space-y-10">
      <header className="mail-hero space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Коннектор · IMAP
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
          Почта
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Письма из Яндекса попадают в ту же память, что чаты и заметки — их
          можно искать в Jarvis и чате.
        </p>
      </header>

      <MailPanel />

      <section aria-labelledby="mail-inbox-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="mail-inbox-title"
              className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
            >
              В базе
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {emails.length
                ? `${emails.length} ${emails.length === 1 ? "письмо" : emails.length < 5 ? "письма" : "писем"}`
                : "Пока пусто — подключи аккаунт и забери INBOX"}
            </p>
          </div>
          <Link
            href="/sources"
            className="text-sm text-[var(--accent-deep)] hover:underline"
          >
            Все источники
          </Link>
        </div>

        {emails.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] px-5 py-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Inbox ещё не синхронизирован
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              После «Забрать письма» здесь появятся тема, отправитель и превью —
              клик откроет полный текст и факты.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {emails.map((mail, i) => {
              const from = mail.meta.emailFrom || mail.meta.peerName || "—";
              const when = formatMailDate(mail.meta.emailDate, mail.ingestedAt);
              const preview = bodyPreview(mail.summary);
              return (
                <li
                  key={mail.id}
                  className="mail-row py-4"
                  style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                >
                  <Link
                    href={`/sources/${mail.id}`}
                    className="group block rounded-lg outline-none transition hover:bg-[var(--wash)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 py-1 sm:px-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                        {from}
                      </p>
                      <time
                        className="shrink-0 text-xs tabular-nums text-[var(--muted)]"
                        dateTime={mail.meta.emailDate || mail.ingestedAt}
                      >
                        {when}
                      </time>
                    </div>
                    <p className="px-1 text-base font-medium text-[var(--ink)] group-hover:text-[var(--accent-deep)] sm:px-2">
                      {mail.title.replace(/^✉\s*/, "")}
                    </p>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 px-1 text-sm text-[var(--ink-soft)] sm:px-2">
                        {preview}
                      </p>
                    ) : null}
                    <p className="mt-1.5 px-1 text-xs text-[var(--muted)] sm:px-2">
                      {mail.chunkIds.length} чанков
                      {mail.factIds.length
                        ? ` · ${mail.factIds.length} фактов`
                        : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
