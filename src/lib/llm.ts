/**
 * Resolve LLM endpoint for /api/chat.
 * Priority: explicit env → reachable Ollama → none (extractive mode).
 */

export type LlmConfig = {
  configured: boolean;
  provider: "openai" | "ollama" | "openai-compat" | "none";
  baseUrl: string;
  model: string;
  apiKey?: string;
};

const OLLAMA_DEFAULT = "http://127.0.0.1:11434/v1";
const OLLAMA_MODEL_DEFAULT = "qwen3.5:9b";

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
  const preferred = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || OLLAMA_MODEL_DEFAULT;
  if (available.some((n) => n === preferred || n.startsWith(`${preferred}:`) || n.startsWith(preferred))) {
    // exact or tag match
    const exact = available.find((n) => n === preferred);
    if (exact) return exact;
  }
  // prefer any qwen3.5 9b-ish, then any qwen3.5, then first model
  const qwen9 = available.find((n) => /qwen3\.5:9b/i.test(n));
  if (qwen9) return qwen9;
  const qwen = available.find((n) => /qwen3\.5/i.test(n));
  if (qwen) return qwen;
  return preferred;
}

export async function resolveLlmConfig(): Promise<LlmConfig> {
  const explicitKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const explicitBase =
    process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || "";
  const explicitModel =
    process.env.LLM_MODEL || process.env.OPENAI_MODEL || "";

  // Explicit cloud/compat key wins
  if (explicitKey && explicitKey !== "ollama") {
    return {
      configured: true,
      provider: explicitBase.includes("11434") ? "ollama" : "openai-compat",
      baseUrl: (explicitBase || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: explicitModel || "gpt-4o-mini",
      apiKey: explicitKey,
    };
  }

  // Explicit Ollama URL even without key
  if (explicitBase.includes("11434") || process.env.LLM_PROVIDER === "ollama") {
    const probe = await probeOllama();
    return {
      configured: probe.up,
      provider: "ollama",
      baseUrl: (explicitBase || OLLAMA_DEFAULT).replace(/\/$/, ""),
      model: pickOllamaModel(probe.models),
      apiKey: explicitKey || "ollama",
    };
  }

  // Auto-detect local Ollama
  const probe = await probeOllama();
  if (probe.up) {
    return {
      configured: true,
      provider: "ollama",
      baseUrl: OLLAMA_DEFAULT,
      model: pickOllamaModel(probe.models),
      apiKey: "ollama",
    };
  }

  // Key set to "ollama" but server down
  if (explicitKey === "ollama") {
    return {
      configured: false,
      provider: "ollama",
      baseUrl: OLLAMA_DEFAULT,
      model: explicitModel || OLLAMA_MODEL_DEFAULT,
      apiKey: "ollama",
    };
  }

  return {
    configured: false,
    provider: "none",
    baseUrl: "",
    model: "",
  };
}
