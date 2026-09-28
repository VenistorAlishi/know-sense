import Link from "next/link";
import { loadStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const store = await loadStore();
  const people = Object.entries(store.peopleIndex).sort((a, b) => {
    if (a[1].isUser) return -1;
    if (b[1].isUser) return 1;
    return b[1].meetingIds.length - a[1].meetingIds.length;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Люди
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Собранные профили из встреч. Кирилл помечается как основной
          пользователь базы.
        </p>
      </div>

      {people.length === 0 ? (
        <p className="text-[var(--muted)]">
          Людей пока нет.{" "}
          <Link href="/#ingest" className="text-[var(--accent-deep)] underline">
            Загрузите встречу
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {people.map(([key, p]) => (
            <li key={key} className="flex items-start justify-between gap-4 py-4">
              <div>
                <Link
                  href={`/people/${encodeURIComponent(p.isUser ? "kirill" : p.canonicalName)}`}
                  className="text-lg font-medium text-[var(--ink)] hover:text-[var(--accent-deep)]"
                >
                  {p.canonicalName}
                  {p.isUser ? " · вы" : ""}
                </Link>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {p.roleHints.length
                    ? p.roleHints.join(" · ")
                    : "роль пока не выведена"}
                </p>
                {p.themes.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    темы: {p.themes.slice(0, 4).join(", ")}
                  </p>
                )}
              </div>
              <span className="text-xs text-[var(--muted)]">
                {p.meetingIds.length} встр.
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
