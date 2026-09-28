import Link from "next/link";
import { OpenFactsPanel } from "@/components/open-facts-panel";
import { listOpenFacts, loadStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OpenPage() {
  const store = await loadStore();
  const facts = listOpenFacts(store);
  const people = Object.fromEntries(
    store.people.map((p) => [p.id, p.canonicalName]),
  );
  const byPerson = new Map<string, number>();
  for (const f of facts) {
    for (const pid of f.personIds) {
      byPerson.set(pid, (byPerson.get(pid) || 0) + 1);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Открытое
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Задачи, решения и риски со статусом open. Это слой смысла поверх
          сырой памяти.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
          <Link href="/" className="underline decoration-[var(--accent)]">
            Inbox
          </Link>
          <Link href="/chat" className="underline decoration-[var(--accent)]">
            Чат (state)
          </Link>
          <Link href="/extract" className="underline decoration-[var(--accent)]">
            Extract из источников
          </Link>
        </div>
      </div>

      {byPerson.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...byPerson.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <Link
                key={id}
                href={`/people/${id}`}
                className="rounded-md bg-[var(--paper-soft)] px-2.5 py-1 text-xs text-[var(--ink-soft)]"
              >
                {people[id] || id.slice(0, 8)} · {n}
              </Link>
            ))}
        </div>
      )}

      <OpenFactsPanel facts={facts} people={people} />
    </div>
  );
}
