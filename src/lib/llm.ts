/**
 * Resolve LLM endpoint for /api/chat.
 * Priority: env → local settings (UI) → Ollama → none (extractive).
 */

import { readLlmSettings, type LlmProviderId } from "@/lib/settings";

export type LlmConfig = {
  configured: boolean;
  provider: "openai" | "anthropic" | "openrouter" | "ollama" | "openai-compat" | "none";
  baseUrl: string;
  model: string;
  apiKey?: string;
  source: "env" | "settings" | "ollama" | "none";
};

const OLLAMA_DEFAULT = "http://127.0.0.1:11434/v1";
const OLLAMA_MODEL_DEFAULT = "qwen3.5:9b";
const OPENAI_DEFAULT = "https://api.openai.com/v1";
const ANTHROPIC_DEFAULT = "https://api.anthropic.com";
const OPENROUTER_DEFAULT = "https://openrouter.ai/api/v1";

let ollamaCache: { at: number; up: boolean; models: string[] } | null = null;

async function probeOllama(): Promise<{ up: boolean; models: string[] }> {
  const now = Date.now();
  if (ollamaCache && now - ollamaCache.at < 15_000) {
    return ollamaCache;
  }
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      ollamaCache = { at: now, up: false, models: [] };
      return ollamaCache;
    }
    const data = await res.json();
    const models = (data.models || []).map(
      (m: { name?: string }) => m.name || "",
    );
    ollamaCache = { at: now, up: true, models };
    return ollamaCache;
  } catch {
    ollamaCache = { at: now, up: false, models: [] };
    return ollamaCache;
  }
}

function pickOllamaModel(available: string[]): string {
  const preferred =
    process.env.LLM_MODEL || process.env.OLLAMA_MODEL || OLLAMA_MODEL_DEFAULT;
  const exact = available.find((n) => n === preferred);
  if (exact) return exact;
  const qwen9 = available.find((n) => /qwen3\.5:9b/i.test(n));
  if (qwen9) return qwen9;
  const qwen = available.find((n) => /qwen3\.5/i.test(n));
  if (qwen) return qwen;
  return preferred;
}

function detectProviderFromBase(
  baseUrl: string,
  hint?: LlmProviderId,
): LlmConfig["provider"] {
  if (hint && hint !== "auto" && hint !== "ollama") {
    if (hint === "openai") return "openai";
    if (hint === "anthropic") return "anthropic";
    if (hint === "openrouter") return "openrouter";
    return "openai-compat";
  }
  const u = baseUrl.toLowerCase();
  if (u.includes("11434")) return "ollama";
  if (u.includes("anthropic.com")) return "anthropic";
  if (u.includes("openrouter.ai")) return "openrouter";
  if (u.includes("openai.com")) return "openai";
  return "openai-compat";
}

function defaultsForProvider(provider: LlmProviderId): {
  baseUrl: string;
  model: string;
} {
  switch (provider) {
    case "anthropic":
      return { baseUrl: ANTHROPIC_DEFAULT, model: "claude-sonnet-4-5" };
    case "openrouter":
      return {
        baseUrl: OPENROUTER_DEFAULT,
        model: "anthropic/claude-sonnet-4.5",
      };
    case "openai":
      return { baseUrl: OPENAI_DEFAULT, model: "gpt-4o-mini" };
    case "ollama":
      return { baseUrl: OLLAMA_DEFAULT, model: OLLAMA_MODEL_DEFAULT };
    default:
      return { baseUrl: OPENAI_DEFAULT, model: "gpt-4o-mini" };
  }
}

function fromCloudKey(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerHint?: LlmProviderId;
  source: "env" | "settings";
}): LlmConfig {
  const provider = detectProviderFromBase(opts.baseUrl, opts.providerHint);
  const fallback = defaultsForProvider(
    opts.providerHint && opts.providerHint !== "auto"
      ? opts.providerHint
      : provider === "none"
        ? "openai"
        : (provider as LlmProviderId),
  );
  const baseUrl = (opts.baseUrl || fallback.baseUrl).replace(/\/$/, "");
  return {
    configured: true,
    provider,
    baseUrl,
    model: opts.model || fallback.model,
    apiKey: opts.apiKey,
    source: opts.source,
  };
}

export async function resolveLlmConfig(): Promise<LlmConfig> {
  const envKey =
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.LLM_API_KEY ||
    "";
  const envBase =
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.ANTHROPIC_BASE_URL ||
    "";
  const envModel =
    process.env.LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "";
  const envProvider = (process.env.LLM_PROVIDER || "auto") as LlmProviderId;

  // Env cloud key wins (except placeholder "ollama")
  if (envKey && envKey !== "ollama") {
    let base = envBase;
    let providerHint = envProvider;
    if (!base) {
      if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        base = ANTHROPIC_DEFAULT;
        providerHint = "anthropic";
      } else if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
        base = OPENROUTER_DEFAULT;
        providerHint = "openrouter";
      } else {
        base = defaultsForProvider(
          providerHint !== "auto" ? providerHint : "openai",
        ).baseUrl;
      }
    }
    return fromCloudKey({
      apiKey: envKey,
      baseUrl: base,
      model: envModel,
      providerHint,
      source: "env",
    });
  }

  // Local UI settings (data/store/llm-settings.json)
  const settings = await readLlmSettings();
  if (settings.apiKey && settings.provider !== "ollama") {
    const hint =
      settings.provider === "auto"
        ? detectProviderFromBase(settings.baseUrl || "")
        : settings.provider;
    const fallback = defaultsForProvider(
      hint === "none" || hint === "ollama" ? "openai" : (hint as LlmProviderId),
    );
    return fromCloudKey({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl || fallback.baseUrl,
      model: settings.model || fallback.model,
      providerHint:
        settings.provider === "auto"
          ? (hint as LlmProviderId)
          : settings.provider,
      source: "settings",
    });
  }

  // Local Ollama (auto or forced)
  const forceOllama =
    envProvider === "ollama" ||
    settings.provider === "ollama" ||
    envBase.includes("11434") ||
    envKey === "ollama";

  const probe = await probeOllama();
  if (probe.up) {
    const ollamaModel =
      settings.provider === "ollama" && settings.model
        ? settings.model
        : pickOllamaModel(probe.models);
    return {
      configured: true,
      provider: "ollama",
      baseUrl: (envBase.includes("11434") ? envBase : OLLAMA_DEFAULT).replace(
        /\/$/,
        "",
      ),
      model: ollamaModel,
      apiKey: "ollama",
      source: "ollama",
    };
  }

  if (forceOllama) {
    return {
      configured: false,
      provider: "ollama",
      baseUrl: OLLAMA_DEFAULT,
      model: settings.model || envModel || OLLAMA_MODEL_DEFAULT,
      apiKey: "ollama",
      source: "ollama",
    };
  }

  return {
    configured: false,
    provider: "none",
    baseUrl: "",
    model: "",
    source: "none",
  };
}

export async function completeChat(opts: {
  cfg: LlmConfig;
  system: string;
  user: string;
}): Promise<string> {
  const { cfg, system, user } = opts;
  if (!cfg.configured) throw new Error("LLM not configured");

  if (cfg.provider === "anthropic") {
    const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1024,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const parts = data?.content;
    const text = Array.isArray(parts)
      ? parts
          .filter((p: { type?: string }) => p.type === "text")
          .map((p: { text?: string }) => p.text || "")
          .join("\n")
      : "";
    if (!text) throw new Error("Empty Anthropic response");
    return text;
  }

  // OpenAI / OpenRouter / Ollama / openai-compat
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey || "ollama"}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = "http://127.0.0.1:3847";
    headers["X-Title"] = "Smysl";
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return String(content);
}
