import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { UploadPanel } from "@/components/upload-panel";
import { loadStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await loadStore();
  const kirill = Object.values(store.peopleIndex).find((p) => p.isUser);
  const latest = store.meetings[0];

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
          <p className="mb-4 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            Смысл
          </p>
          <h1 className="text-xl font-medium leading-snug text-[var(--wash)] sm:text-2xl">
            Векторная база знаний из записей встреч
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--paper)]/75 sm:text-base">
            Загрузите анализ встречи — система разложит участников, темы,
            решения и задачи, найдёт Кирилла и позволит искать по смыслу, а не
            по ключевым словам.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#ingest"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:brightness-110"
            >
              Загрузить запись 47
            </a>
            {kirill ? (
              <Link
                href="/people/kirill"
                className="rounded-lg border border-[var(--paper)]/25 px-4 py-2.5 text-sm text-[var(--paper)] transition hover:bg-white/5"
              >
                Профиль Кирилла
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section id="ingest" className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-[fade-up_800ms_ease-out]">
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Первая запись
          </h2>
          <p className="mb-5 max-w-prose text-sm leading-relaxed text-[var(--muted)]">
            Нужен файл{" "}
            <code className="rounded bg-[var(--paper-soft)] px-1.5 py-0.5 text-[var(--ink)]">
              Анализ встречи — Запись 47.md
            </code>
            . Локальный путь Windows в облако не монтируется — прикрепите файл
            сюда или вставьте текст.
          </p>
          <UploadPanel />
        </div>

        <aside className="space-y-6 rounded-xl border border-[var(--line)] bg-[var(--paper)]/70 p-5 backdrop-blur-sm">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
              Состояние базы
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Встречи</dt>
                <dd className="text-2xl font-semibold text-[var(--ink)]">
                  {store.meetings.length}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Люди</dt>
                <dd className="text-2xl font-semibold text-[var(--ink)]">
                  {Object.keys(store.peopleIndex).length}
                </dd>
              </div>
            </dl>
          </div>

          {latest ? (
            <div>
              <h3 className="text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
                Последняя
              </h3>
              <Link
                href={`/meetings/${latest.id}`}
                className="mt-2 block font-medium text-[var(--accent-deep)] hover:underline"
              >
                {latest.title}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-[var(--ink-soft)]">
                {latest.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              База пустая. После загрузки «Записи 47» здесь появится разбор
              смыслов и профиль Кирилла.
            </p>
          )}

          {kirill && (
            <div className="rounded-lg bg-[var(--wash)]/60 p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Идентифицирован
              </p>
              <p className="font-medium text-[var(--ink)]">{kirill.canonicalName}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                {kirill.roleHints.length
                  ? kirill.roleHints.join(" · ")
                  : "роль уточняется по следующим встречам"}
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="animate-[fade-up_900ms_ease-out]">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Поиск по смыслу
        </h2>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Запрос идёт в векторное пространство чанков встреч (локальные
          эмбеддинги, без внешнего API).
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
