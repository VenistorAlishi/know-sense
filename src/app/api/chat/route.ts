import { NextResponse } from "next/server";
import { palaceHealth, palaceSearch, type PalaceHit } from "@/lib/palace";
import { searchKnowledge } from "@/lib/store";

export const runtime = "nodejs";

type ChatCitation = {
  text: string;
  score: number;
  source: string;
  wing?: string | null;
};

function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
}

function llmBaseUrl(): string {
  return (
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
}

function llmModel(): string {
  return process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function llmApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
}

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
    "Режим: extractive (без LLM). Добавьте OPENAI_API_KEY или LLM_BASE_URL для синтезированного ответа.",
  ].join("\n");
}

async function llmAnswer(
  message: string,
  citations: ChatCitation[],
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

  const res = await fetch(`${llmBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmApiKey()}`,
    },
    body: JSON.stringify({
      model: llmModel(),
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

  // Fallback / complement from local JSON store
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
    warning: palaceOk ? undefined : health.ok === false ? health.error : health.data?.error || "palace unavailable",
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
    let mode: "llm" | "extractive" = "extractive";
    let answer: string;

    if (llmConfigured()) {
      try {
        answer = await llmAnswer(message, gathered.citations);
        mode = "llm";
      } catch (error) {
        answer =
          extractiveAnswer(message, gathered.citations) +
          `\n\n(LLM недоступен: ${String(error)})`;
        mode = "extractive";
      }
    } else {
      answer = extractiveAnswer(message, gathered.citations);
    }

    return NextResponse.json({
      answer,
      citations: gathered.citations,
      mode,
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
  return NextResponse.json({
    llm: llmConfigured(),
    model: llmConfigured() ? llmModel() : null,
    palace: health.ok ? health.data : { ok: false, error: health.error },
  });
}
