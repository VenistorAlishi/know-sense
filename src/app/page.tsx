import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { UploadPanel } from "@/components/upload-panel";
import { listStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { store, self, counts } = await listStats();
  const closePeople = store.people.filter((p) => p.relationToSelf === "close");
  const latest = store.sources[0];

  return (
    <div className="flex flex-col gap-14">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-6 py-12 text-[var(--paper)] sm:px-10 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 18%, rgba(43,181,160,.4), transparent 36%), radial-gradient(circle at 82% 8%, rgba(204,232,225,.22), transparent 42%), linear-gradient(135deg, transparent 40%, rgba(255,255,255,.05) 40%, rgba(255,255,255,.05) 41%, transparent 41%)",
          }}
        />
        <div className="relative max-w-2xl animate-[fade-up_700ms_ease-out]">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--wash)]">
            персональная база
          </p>
          <p className="mb-4 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            {self.canonicalName}
          </p>
          <h1 className="text-xl font-medium leading-snug text-[var(--wash)] sm:text-2xl">
            Векторная память обо мне, близких и всём, что я подтягиваю с компа
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--paper)]/75 sm:text-base">
            Сначала структура и универсальный ingest. Первый корпус — три
            большие переписки Telegram: из них соберём контекст о вас и трёх
            ближайших людях.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:brightness-110"
            >
              Чат с памятью
            </Link>
            <Link
              href="/ingest"
              className="rounded-lg border border-[var(--paper)]/25 px-4 py-2.5 text-sm text-[var(--paper)] transition hover:bg-white/5"
            >
              Загрузить TG-экспорт
            </Link>
            <Link
              href={`/people/${self.id}`}
              className="rounded-lg border border-[var(--paper)]/25 px-4 py-2.5 text-sm text-[var(--paper)] transition hover:bg-white/5"
            >
              Мой профиль
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Люди", counts.people],
          ["Близкие", counts.closePeople],
          ["Источники", counts.sources],
          ["Чанки", counts.chunks],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 px-4 py-4"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              {label}
            </p>
            <p className="mt-1 text-3xl font-semibold text-[var(--ink)]">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Ближайшие люди
          </h2>
          {closePeople.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Пока пусто. После загрузки трёх личных TG-чатов здесь появятся
              три близких контакта.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {closePeople.map((p) => (
                <li key={p.id} className="py-3">
                  <Link
                    href={`/people/${p.id}`}
                    className="font-medium text-[var(--ink)] hover:text-[var(--accent-deep)]"
                  >
                    {p.canonicalName}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {p.themes.slice(0, 3).join(" · ") || "темы появятся из переписки"}
                    {" · "}
                    {p.sourceIds.length} ист.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Быстрый ingest
          </h2>
          <UploadPanel compact />
          {latest && (
            <p className="text-sm text-[var(--ink-soft)]">
              Последний:{" "}
              <Link
                href={`/sources/${latest.id}`}
                className="text-[var(--accent-deep)] hover:underline"
              >
                {latest.title}
              </Link>
            </p>
          )}
        </aside>
      </section>

      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Поиск по смыслу
        </h2>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Поиск идёт по чанкам всех источников в персональной базе.
        </p>
        <SearchBox />
      </section>

      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
