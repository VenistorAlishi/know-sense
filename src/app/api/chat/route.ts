import { NextResponse } from "next/server";
import { resolveLlmConfig } from "@/lib/llm";
import { palaceHealth, palaceSearch, type PalaceHit } from "@/lib/palace";
import { searchKnowledge } from "@/lib/store";

export const runtime = "nodejs";

type ChatCitation = {
  text: string;
  score: number;
  source: string;
  wing?: string | null;
};

function extractiveAnswer(message: string, citations: ChatCitation[]): string {
  if (!citations.length) {
    return (
      "В памяти пока нет релевантных фрагментов по этому запросу. " +
      "Загрузите Telegram-экспорты или заметки и спросите снова."
    );
  }
  const lines = citations.slice(0, 4).map((c, i) => {
    const snippet = c.text.replace(/\s+/g, " ").trim().slice(0, 220);
    return `${i + 1}. (${c.source}${c.wing ? ` / ${c.wing}` : ""}) ${snippet}${
      c.text.length > 220 ? "…" : ""
    }`;
  });
  return [
    `По запросу «${message.trim()}» в вашей памяти нашлось ${citations.length} фрагмент(ов).`,
    "",
    "Ключевые цитаты:",
    ...lines,
    "",
    "Режим: extractive (без LLM). Запустите Ollama (`ollama pull qwen3.5:9b`) или задайте OPENAI_API_KEY.",
  ].join("\n");
}

async function llmAnswer(
  message: string,
  citations: ChatCitation[],
  cfg: Awaited<ReturnType<typeof resolveLlmConfig>>,
): Promise<string> {
  const context = citations
    .slice(0, 8)
    .map(
      (c, i) =>
        `[${i + 1}] source=${c.source} wing=${c.wing || "-"} score=${c.score.toFixed(3)}\n${c.text}`,
    )
    .join("\n\n");

  const system = [
    "Ты — второй мозг Кирилла (персональная база Смысл).",
    "Отвечай по-русски, кратко и по делу.",
    "Используй ТОЛЬКО предоставленный контекст из памяти.",
    "Если данных недостаточно — скажи прямо, что не хватает.",
    "В конце перечисли номера цитат, на которые опираешься.",
  ].join(" ");

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey || "ollama"}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Вопрос:\n${message}\n\nКонтекст памяти:\n${context || "(пусто)"}`,
        },
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

async function gatherCitations(
  message: string,
  wing?: string,
): Promise<{ citations: ChatCitation[]; palaceOk: boolean; warning?: string }> {
  const health = await palaceHealth();
  const palaceOk = health.ok && health.data.ok;
  const citations: ChatCitation[] = [];

  if (palaceOk) {
    const search = await palaceSearch({
      query: message,
      wing: wing || undefined,
      limit: 8,
    });
    if (search.ok) {
      for (const hit of search.data.results as PalaceHit[]) {
        citations.push({
          text: hit.text,
          score: hit.score,
          source: hit.sourceFile || hit.drawerId || "palace",
          wing: hit.wing,
        });
      }
    } else {
      return {
        citations,
        palaceOk: false,
        warning: search.error,
      };
    }
  }

  if (citations.length < 4) {
    const local = await searchKnowledge(message, 6);
    for (const hit of local) {
      citations.push({
        text: hit.chunk.text,
        score: hit.score,
        source: hit.source?.title || "local-store",
        wing: null,
      });
    }
  }

  citations.sort((a, b) => b.score - a.score);
  const deduped: ChatCitation[] = [];
  const seen = new Set<string>();
  for (const c of citations) {
    const key = c.text.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }

  return {
    citations: deduped.slice(0, 8),
    palaceOk: Boolean(palaceOk),
    warning: palaceOk
      ? undefined
      : health.ok === false
        ? health.error
        : health.data?.error || "palace unavailable",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || body.q || "").trim();
    const wing = body.wing ? String(body.wing) : undefined;
    if (!message) {
      return NextResponse.json({ error: "message обязателен" }, { status: 400 });
    }

    const gathered = await gatherCitations(message, wing);
    const llm = await resolveLlmConfig();
    let mode: "llm" | "extractive" = "extractive";
    let answer: string;
    let provider: string = "none";

    if (llm.configured) {
      try {
        answer = await llmAnswer(message, gathered.citations, llm);
        mode = "llm";
        provider = llm.provider;
      } catch (error) {
        answer =
          extractiveAnswer(message, gathered.citations) +
          `\n\n(LLM недоступен: ${String(error)})`;
        mode = "extractive";
        provider = llm.provider;
      }
    } else {
      answer = extractiveAnswer(message, gathered.citations);
    }

    return NextResponse.json({
      answer,
      citations: gathered.citations,
      mode,
      provider,
      model: llm.configured ? llm.model : null,
      palaceOk: gathered.palaceOk,
      warning: gathered.warning,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Chat failed", detail: String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  const health = await palaceHealth();
  const llm = await resolveLlmConfig();
  return NextResponse.json({
    llm: {
      configured: llm.configured,
      provider: llm.provider,
      model: llm.configured ? llm.model : null,
      baseUrl: llm.configured ? llm.baseUrl : null,
    },
    palace: health.ok ? health.data : { ok: false, error: health.error },
  });
}
