"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MemoryMap,
  type JarvisMapEdge,
  type JarvisMapNode,
} from "./memory-map";

type OpenTask = {
  id: string;
  title: string;
  detail: string;
  kind: string;
};

type ChatLine = { role: "user" | "assistant"; text: string };

export function JarvisDesk() {
  const [nodes, setNodes] = useState<JarvisMapNode[]>([]);
  const [edges, setEdges] = useState<JarvisMapEdge[]>([]);
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [selected, setSelected] = useState<JarvisMapNode | null>(null);
  const [focusPerson, setFocusPerson] = useState<string | null>(null);
  const [cmd, setCmd] = useState("");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [mapRes, factsRes] = await Promise.all([
          fetch("/api/map", { cache: "no-store" }),
          fetch("/api/facts?status=open&kind=task", { cache: "no-store" }),
        ]);
        const map = await mapRes.json();
        const facts = await factsRes.json();
        setNodes(map.nodes || []);
        setEdges(map.edges || []);
        setTasks((facts.facts || []).slice(0, 7));
        setLoaded(true);
      } catch (e) {
        setMapError(String(e));
      }
    })();
  }, []);

  const highlightIds = useMemo(() => {
    if (!focusPerson) return undefined;
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.id === focusPerson) set.add(n.id);
      const pids = n.meta?.personIds as string[] | undefined;
      if (pids?.some((id) => `person:${id}` === focusPerson)) set.add(n.id);
      if (
        n.kind === "fact" &&
        edges.some(
          (e) =>
            e.kind === "owns" &&
            e.from === focusPerson &&
            e.to === n.id,
        )
      ) {
        set.add(n.id);
      }
    }
    for (const e of edges) {
      if (e.from === focusPerson || e.to === focusPerson) {
        set.add(e.from);
        set.add(e.to);
      }
    }
    return set;
  }, [focusPerson, nodes, edges]);

  const ask = useCallback(
    async (message: string) => {
      const q = message.trim();
      if (!q || pending) return;
      setPending(true);
      setDrawerOpen(true);
      setChat((c) => [...c, { role: "user", text: q }]);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, modeHint: "auto" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "chat failed");
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            text: data.answer,
          },
        ]);
      } catch (e) {
        setChat((c) => [
          ...c,
          { role: "assistant", text: `Ошибка: ${String(e)}` },
        ]);
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--ink)] text-[var(--paper)]">
      {/* atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(900px 520px at 12% 10%, rgba(43,181,160,0.22), transparent 55%), radial-gradient(700px 420px at 88% 80%, rgba(15,127,110,0.18), transparent 50%), linear-gradient(165deg, #0a1c1f 0%, #0d2428 45%, #102e32 100%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--wash)]"
          >
            Смысл
          </Link>
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Jarvis
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-xs text-white/60">
          <Link href="/open" className="hover:text-white">
            Открытое
          </Link>
          <Link href="/chat" className="hover:text-white">
            Чат
          </Link>
          <Link href="/settings" className="hover:text-white">
            API
          </Link>
          <span className="hidden text-white/35 sm:inline">
            {loaded ? `${nodes.length} узлов` : "загрузка…"}
          </span>
        </nav>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {mapError ? (
            <p className="p-6 text-sm text-[var(--danger)]">{mapError}</p>
          ) : (
            <MemoryMap
              nodes={nodes}
              edges={edges}
              highlightIds={highlightIds}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          )}

          {/* selection card */}
          <aside
            className={`absolute right-3 top-3 w-[min(340px,calc(100%-1.5rem))] rounded-xl border border-white/10 bg-[var(--ink)]/85 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 ${
              selected
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-4 opacity-0"
            }`}
          >
            {selected && (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  {selected.kind} · {selected.colorKey}
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg leading-snug">
                  {selected.label}
                </h2>
                <p className="mt-2 max-h-28 overflow-y-auto text-xs leading-relaxed text-white/70">
                  {String(
                    selected.meta?.text ||
                      selected.meta?.detail ||
                      selected.meta?.themes ||
                      "",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={selected.href}
                    className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-[var(--ink)]"
                  >
                    Открыть
                  </Link>
                  <button
                    type="button"
                    className="rounded-md border border-white/20 px-2.5 py-1 text-xs"
                    onClick={() =>
                      void ask(`Расскажи про: ${selected.label}`)
                    }
                  >
                    Спросить
                  </button>
                  {selected.kind === "fact" && (
                    <Link
                      href="/open"
                      className="rounded-md border border-white/20 px-2.5 py-1 text-xs"
                    >
                      В /open
                    </Link>
                  )}
                  <button
                    type="button"
                    className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/50"
                    onClick={() => setSelected(null)}
                  >
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>

        {/* tasks rail */}
        <aside className="hidden w-64 shrink-0 flex-col border-l border-white/10 bg-black/20 md:flex">
          <div className="border-b border-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Open tasks
            </p>
            <p className="mt-1 text-xs text-white/50">
              Клик подсветит связанные узлы
            </p>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {tasks.length === 0 ? (
              <li className="text-xs text-white/40">
                Нет открытых задач. Inbox на главной.
              </li>
            ) : (
              tasks.map((t) => {
                const personEdge = edges.find(
                  (e) => e.kind === "owns" && e.to === `fact:${t.id}`,
                );
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(
                          nodes.find((n) => n.id === `fact:${t.id}`) || null,
                        );
                        setFocusPerson(personEdge?.from || null);
                      }}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-[var(--accent)]/50 hover:bg-white/10"
                    >
                      <p className="text-xs font-medium leading-snug">
                        {t.title}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <Link
            href="/open"
            className="border-t border-white/10 px-3 py-3 text-center text-xs text-[var(--accent)] hover:underline"
          >
            Все открытые →
          </Link>
        </aside>
      </div>

      {/* chat drawer */}
      <div
        className={`relative z-20 border-t border-white/10 bg-black/35 backdrop-blur-md transition-all duration-300 ${
          drawerOpen ? "max-h-56" : "max-h-0"
        } overflow-hidden`}
      >
        <div className="max-h-56 space-y-2 overflow-y-auto px-4 py-3 text-sm sm:px-6">
          {chat.map((line, i) => (
            <p
              key={i}
              className={
                line.role === "user"
                  ? "text-[var(--accent)]"
                  : "whitespace-pre-wrap text-white/80"
              }
            >
              <span className="text-[10px] uppercase tracking-wide opacity-50">
                {line.role === "user" ? "вы" : "смысл"} ·{" "}
              </span>
              {line.text}
            </p>
          ))}
        </div>
      </div>

      {/* command bar */}
      <form
        className="relative z-30 flex items-center gap-2 border-t border-white/10 bg-[var(--ink)]/95 px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          const q = cmd;
          setCmd("");
          void ask(q);
        }}
      >
        <span className="hidden font-[family-name:var(--font-display)] text-sm text-[var(--accent)] sm:inline">
          ⌘
        </span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="Спросить память… «что висит?» · «о чём с Игорем?»"
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-[var(--paper)] outline-none ring-[var(--accent)] placeholder:text-white/35 focus:ring-2"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => setDrawerOpen((v) => !v)}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/60"
        >
          {drawerOpen ? "Скрыть" : "Ответ"}
        </button>
        <button
          type="submit"
          disabled={pending || !cmd.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-40"
        >
          {pending ? "…" : "Go"}
        </button>
      </form>
    </div>
  );
}
