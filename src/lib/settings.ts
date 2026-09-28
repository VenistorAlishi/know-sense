import { promises as fs } from "fs";
import path from "path";

export type LlmProviderId =
  | "auto"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "openai-compat"
  | "ollama";

export type LlmSettings = {
  provider: LlmProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const SETTINGS_PATH = path.join(
  process.cwd(),
  "data",
  "store",
  "llm-settings.json",
);

const DEFAULTS: LlmSettings = {
  provider: "auto",
  apiKey: "",
  baseUrl: "",
  model: "",
};

export async function readLlmSettings(): Promise<LlmSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      provider: parsed.provider || "auto",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeLlmSettings(
  patch: Partial<LlmSettings>,
): Promise<LlmSettings> {
  const current = await readLlmSettings();
  const next: LlmSettings = {
    provider: patch.provider ?? current.provider,
    apiKey:
      patch.apiKey !== undefined ? String(patch.apiKey).trim() : current.apiKey,
    baseUrl:
      patch.baseUrl !== undefined
        ? String(patch.baseUrl).trim().replace(/\/$/, "")
        : current.baseUrl,
    model:
      patch.model !== undefined ? String(patch.model).trim() : current.model,
  };
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(
    SETTINGS_PATH,
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
  return next;
}

/** Public view — never send full key to the browser. */
export function maskLlmSettings(settings: LlmSettings) {
  const key = settings.apiKey;
  return {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model,
    hasApiKey: Boolean(key),
    apiKeyHint: key
      ? `${key.slice(0, 4)}…${key.slice(-4)}`
      : null,
  };
}
