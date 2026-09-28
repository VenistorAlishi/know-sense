"use client";

import { useState } from "react";

type Citation = {
  text: string;
  score: number;
  source: string;
  wing?: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: string;
  warning?: string;
};

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Я — чат с вашей персональной памятью. Спросите, например: «о чём мы с Анной?» или «какие задачи по бюджету?»",
    },
  ]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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
                mode: {msg.mode}
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
                        {c.wing ? ` · ${c.wing}` : ""} · {c.score.toFixed(3)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">
                        {c.text.slice(0, 280)}
                        {c.text.length > 280 ? "…" : ""}
                      </p>
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
