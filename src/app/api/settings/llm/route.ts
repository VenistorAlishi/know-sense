import { NextResponse } from "next/server";
import { resolveLlmConfig } from "@/lib/llm";
import {
  maskLlmSettings,
  readLlmSettings,
  writeLlmSettings,
  type LlmProviderId,
} from "@/lib/settings";

export const runtime = "nodejs";

const PROVIDERS: LlmProviderId[] = [
  "auto",
  "openai",
  "anthropic",
  "openrouter",
  "openai-compat",
  "ollama",
];

export async function GET() {
  const settings = await readLlmSettings();
  const active = await resolveLlmConfig();
  return NextResponse.json({
    settings: maskLlmSettings(settings),
    active: {
      configured: active.configured,
      provider: active.provider,
      model: active.configured ? active.model : null,
      baseUrl: active.configured ? active.baseUrl : null,
      source: active.source,
    },
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider || "auto") as LlmProviderId;
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "unknown provider" }, { status: 400 });
    }

    const patch: Parameters<typeof writeLlmSettings>[0] = {
      provider,
      baseUrl: body.baseUrl !== undefined ? String(body.baseUrl) : undefined,
      model: body.model !== undefined ? String(body.model) : undefined,
    };

    // Empty string apiKey = keep existing; null/false clears; non-empty replaces
    if (body.clearApiKey === true) {
      patch.apiKey = "";
    } else if (
      typeof body.apiKey === "string" &&
      body.apiKey.trim() &&
      !body.apiKey.includes("…")
    ) {
      patch.apiKey = body.apiKey;
    }

    const saved = await writeLlmSettings(patch);
    const active = await resolveLlmConfig();
    return NextResponse.json({
      ok: true,
      settings: maskLlmSettings(saved),
      active: {
        configured: active.configured,
        provider: active.provider,
        model: active.configured ? active.model : null,
        baseUrl: active.configured ? active.baseUrl : null,
        source: active.source,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save settings", detail: String(error) },
      { status: 500 },
    );
  }
}
