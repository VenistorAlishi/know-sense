import Link from "next/link";
import { listStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { store } = await listStats();
  const people = [...store.people].sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.relationToSelf === "close" && b.relationToSelf !== "close") return -1;
    if (b.relationToSelf === "close" && a.relationToSelf !== "close") return 1;
    return b.sourceIds.length - a.sourceIds.length;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Люди
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Кирилл в центре. Близкие контакты появляются из личных Telegram-чатов.
        </p>
      </div>

      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {people.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-4 py-4">
            <div>
              <Link
                href={`/people/${p.isSelf ? "kirill" : p.id}`}
                className="text-lg font-medium text-[var(--ink)] hover:text-[var(--accent-deep)]"
              >
                {p.canonicalName}
                {p.isSelf ? " · вы" : ""}
                {p.relationToSelf === "close" ? " · близкий" : ""}
              </Link>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                {p.bio || "профиль наполняется из источников"}
              </p>
              {p.themes.length > 0 && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  темы: {p.themes.slice(0, 5).join(", ")}
                </p>
              )}
            </div>
            <span className="text-xs text-[var(--muted)]">
              {p.sourceIds.length} ист. · {p.factIds.length} факт.
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
