import Link from "next/link";
import { loadStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const store = await loadStore();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Встречи
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Все загруженные разборы в векторной базе.
        </p>
      </div>

      {store.meetings.length === 0 ? (
        <p className="text-[var(--muted)]">
          Пока пусто.{" "}
          <Link href="/#ingest" className="text-[var(--accent-deep)] underline">
            Загрузите запись
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {store.meetings.map((m) => (
            <li key={m.id} className="py-5">
              <Link
                href={`/meetings/${m.id}`}
                className="text-lg font-medium text-[var(--ink)] hover:text-[var(--accent-deep)]"
              >
                {m.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(m.ingestedAt).toLocaleString("ru-RU")} ·{" "}
                {m.meanings.length} смыслов · {m.participants.length} участников
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-[var(--ink-soft)]">
                {m.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
