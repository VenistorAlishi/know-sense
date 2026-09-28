"use client";

import { useState } from "react";

type Citation = {
  text: string;
  score: number;
  source: string;
  wing?: string | null;
  kind?: string;
  factId?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: string;
  retrievalMode?: string;
  provider?: string;
  model?: string | null;
  warning?: string;
};

type ModeHint = "auto" | "state" | "recall";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [modeHint, setModeHint] = useState<ModeHint>("auto");
  const [pinStatus, setPinStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Спросите память. Режим auto сам выберет state (задачи/статус) или recall (цитаты). Пример: «что у меня висит?» или «о чём мы с Анной?»",
    },
  ]);

  async function pinFact(c: Citation) {
    setPinStatus(null);
    try {
      const title = c.text.split("\n")[0].replace(/^\[[^\]]+\]\s*/, "").slice(0, 120);
      const res = await fetch("/api/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Закреплённый факт",
          detail: c.text.slice(0, 800),
          kind: "context",
          origin: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "pin failed");
      setPinStatus(`Закреплено: ${data.fact.title}`);
    } catch (error) {
      setPinStatus(`Ошибка: ${String(error)}`);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || pending) return;
    setInput("");
    setPinStatus(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, modeHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка чата");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          mode: data.mode,
          retrievalMode: data.retrievalMode,
          provider: data.provider,
          model: data.model,
          warning: data.warning,
        },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Ошибка: ${String(error)}` },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[min(70vh,720px)] flex-col rounded-xl border border-[var(--line)] bg-[var(--paper)]/80">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
        {(["auto", "state", "recall"] as ModeHint[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModeHint(m)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              modeHint === m
                ? "bg-[var(--accent)] text-[var(--ink)]"
                : "border border-[var(--line)] text-[var(--ink-soft)]"
            }`}
          >
            {m}
          </button>
        ))}
        {pinStatus && (
          <span className="text-[10px] text-[var(--muted)]">{pinStatus}</span>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--paper-soft)] text-[var(--ink)]"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.mode && (
              <p className="mt-2 text-[10px] uppercase tracking-wide opacity-60">
                {msg.mode}
                {msg.retrievalMode ? ` · ${msg.retrievalMode}` : ""}
                {msg.provider ? ` · ${msg.provider}` : ""}
                {msg.model ? ` · ${msg.model}` : ""}
                {msg.warning ? ` · palace: ${msg.warning}` : ""}
              </p>
            )}
            {msg.citations && msg.citations.length > 0 && (
              <details className="mt-2 text-xs opacity-80">
                <summary className="cursor-pointer">
                  Цитаты ({msg.citations.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {msg.citations.map((c, j) => (
                    <li key={j} className="border-l-2 border-[var(--accent)] pl-2">
                      <p className="opacity-70">
                        {c.source}
                        {c.wing ? ` · ${c.wing}` : ""}
                        {c.kind ? ` · ${c.kind}` : ""} · {c.score.toFixed(3)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">
                        {c.text.slice(0, 280)}
                        {c.text.length > 280 ? "…" : ""}
                      </p>
                      {!c.factId && (
                        <button
                          type="button"
                          onClick={() => void pinFact(c)}
                          className="mt-1 text-[10px] uppercase tracking-wide text-[var(--accent-deep)] underline"
                        >
                          Закрепить факт
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={send}
        className="flex gap-2 border-t border-[var(--line)] p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите память…"
          className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {pending ? "…" : "Спросить"}
        </button>
      </form>
    </div>
  );
}
