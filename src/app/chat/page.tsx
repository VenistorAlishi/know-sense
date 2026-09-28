import { ChatPanel } from "@/components/chat-panel";
import { palaceHealth } from "@/lib/palace";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const health = await palaceHealth();
  const palaceOk = health.ok && health.data.ok;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Чат с памятью
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Retrieval из MemPalace (+ локальный store). Локально:{" "}
          <code className="rounded bg-[var(--paper-soft)] px-1">ollama pull qwen3.5:9b</code>{" "}
          или <code className="rounded bg-[var(--paper-soft)] px-1">npm run setup:ai</code>.
          Без LLM — extractive цитаты.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Palace:{" "}
          {palaceOk
            ? `ok · ${health.data.drawers} drawers · ${health.data.embeddingModel || "embeddings"}`
            : `offline (${health.ok ? health.data.error || "down" : health.error})`}
        </p>
      </div>
      <ChatPanel />
    </div>
  );
}
