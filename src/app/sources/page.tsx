import Link from "next/link";
import { listStats } from "@/lib/store";

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
  other: "Другое",
};

export default async function SourcesPage() {
  const { store } = await listStats();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Источники
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Чаты, встречи, почта, заметки и любые текстовые материалы в одной базе.
          </p>
        </div>
        <Link
          href="/ingest"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--ink)]"
        >
          Загрузить
        </Link>
      </div>

      {store.sources.length === 0 ? (
        <p className="text-[var(--muted)]">
          Пока пусто. Начните с трёх экспортов Telegram.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {store.sources.map((s) => (
            <li key={s.id} className="py-5">
              <div className="flex flex-wrap items-baseline gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                <span>{TYPE_LABEL[s.type] || s.type}</span>
                <span>·</span>
                <span>{new Date(s.ingestedAt).toLocaleString("ru-RU")}</span>
              </div>
              <Link
                href={`/sources/${s.id}`}
                className="mt-1 block text-lg font-medium text-[var(--ink)] hover:text-[var(--accent-deep)]"
              >
                {s.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-soft)]">
                {s.summary}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {s.chunkIds.length} чанков · {s.factIds.length} фактов ·{" "}
                {s.participants.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
