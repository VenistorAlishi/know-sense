"use client";

import { useEffect, useState } from "react";

type ProviderId =
  | "auto"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "openai-compat"
  | "ollama";

type Active = {
  configured: boolean;
  provider: string;
  model: string | null;
  baseUrl: string | null;
  source: string;
};

const PRESETS: Record<
  ProviderId,
  { label: string; baseUrl: string; model: string; hint: string }
> = {
  auto: {
    label: "Авто",
    baseUrl: "",
    model: "",
    hint: "Ключ → облако; иначе Ollama; иначе extractive",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "Ключ sk-… с platform.openai.com",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    hint: "Ключ sk-ant-… с console.anthropic.com",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4.5",
    hint: "Один ключ → Claude / GPT / др. модели",
  },
  "openai-compat": {
    label: "OpenAI-compatible",
    baseUrl: "",
    model: "",
    hint: "Любой /v1/chat/completions endpoint",
  },
  ollama: {
    label: "Ollama (local)",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen3.5:9b",
    hint: "Без облачного ключа, только локально",
  },
};

export function LlmSettingsForm() {
  const [provider, setProvider] = useState<ProviderId>("auto");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/llm", { cache: "no-store" });
    const data = await res.json();
    setProvider(data.settings.provider || "auto");
    setBaseUrl(data.settings.baseUrl || "");
    setModel(data.settings.model || "");
    setHasKey(Boolean(data.settings.hasApiKey));
    setKeyHint(data.settings.apiKeyHint);
    setActive(data.active);
  }

  useEffect(() => {
    void load();
  }, []);

  function applyPreset(next: ProviderId) {
    setProvider(next);
    const p = PRESETS[next];
    if (p.baseUrl) setBaseUrl(p.baseUrl);
    if (p.model) setModel(p.model);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl,
          model,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "save failed");
      setHasKey(Boolean(data.settings.hasApiKey));
      setKeyHint(data.settings.apiKeyHint);
      setActive(data.active);
      setApiKey("");
      setStatus("Сохранено. Чат будет использовать этот провайдер.");
    } catch (error) {
      setStatus(`Ошибка: ${String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function clearKey() {
    setPending(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, baseUrl, model, clearApiKey: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "clear failed");
      setHasKey(false);
      setKeyHint(null);
      setActive(data.active);
      setStatus("Ключ удалён. Активен fallback (Ollama / extractive).");
    } catch (error) {
      setStatus(`Ошибка: ${String(error)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <p className="text-sm text-[var(--muted)]">
        Модель Cursor из агента сюда не подключается — у неё нет публичного
        API-ключа для вашего приложения. Вставьте ключ OpenAI, Anthropic или
        OpenRouter: чат начнёт синтезировать ответы поверх памяти.
      </p>

      {active && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-xs text-[var(--ink-soft)]">
          Сейчас:{" "}
          <strong className="text-[var(--ink)]">
            {active.configured
              ? `${active.provider} · ${active.model}`
              : "extractive (без LLM)"}
          </strong>
          {active.source ? ` · source=${active.source}` : ""}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--ink)]">
          Провайдер
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as ProviderId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                provider === id
                  ? "bg-[var(--accent)] text-[var(--ink)]"
                  : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink-soft)]"
              }`}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">{PRESETS[provider].hint}</p>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">API key</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            hasKey
              ? `сохранён (${keyHint}) — вставьте новый, чтобы заменить`
              : "sk-… / sk-ant-… / or-…"
          }
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          autoComplete="off"
        />
        {hasKey && (
          <button
            type="button"
            onClick={() => void clearKey()}
            className="text-xs text-[var(--danger)] underline"
            disabled={pending}
          >
            Удалить сохранённый ключ
          </button>
        )}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Base URL</span>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Model</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini / claude-sonnet-4-5 / …"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {status && (
          <span className="text-xs text-[var(--muted)]">{status}</span>
        )}
      </div>
    </form>
  );
}
