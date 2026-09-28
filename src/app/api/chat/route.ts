import { NextResponse } from "next/server";
import { completeChat, resolveLlmConfig } from "@/lib/llm";
import { palaceHealth, palaceSearch, type PalaceHit } from "@/lib/palace";
import { listOpenFacts, loadStore, searchKnowledge } from "@/lib/store";
import type { Fact } from "@/lib/types";

export const runtime = "nodejs";

type ChatCitation = {
  text: string;
  score: number;
  source: string;
  wing?: string | null;
  kind?: "fact" | "chunk" | "palace";
  factId?: string;
};

type ModeHint = "auto" | "state" | "recall";

function detectMode(message: string, hint: ModeHint): "state" | "recall" {
  if (hint === "state" || hint === "recall") return hint;
  const m = message.toLowerCase();
  if (
    /задач|что висит|открыт|дедлайн|решил|риск|статус|что у меня|что нужно|todo|action/i.test(
      m,
    )
  ) {
    return "state";
  }
  return "recall";
}

function extractiveAnswer(
  message: string,
  citations: ChatCitation[],
  retrievalMode: "state" | "recall",
): string {
  if (!citations.length) {
    return retrievalMode === "state"
      ? "Открытых фактов/задач по запросу нет. Добавьте заметку в Inbox или закрепите факт из чата."
      : "В памяти пока нет релевантных фрагментов. Добавьте заметку или TG-экспорт.";
  }
  const lines = citations.slice(0, 5).map((c, i) => {
    const snippet = c.text.replace(/\s+/g, " ").trim().slice(0, 220);
    return `${i + 1}. (${c.source}${c.wing ? ` / ${c.wing}` : ""}) ${snippet}${
      c.text.length > 220 ? "…" : ""
    }`;
  });
  return [
    retrievalMode === "state"
      ? `По состоянию («${message.trim()}») найдено ${citations.length} открыт(ых) факт(ов)/задач.`
      : `По запросу «${message.trim()}» в памяти ${citations.length} фрагмент(ов).`,
    "",
    "Ключевые пункты:",
    ...lines,
    "",
    "Режим: extractive (без LLM). Добавьте API-ключ в /settings или Ollama.",
  ].join("\n");
}

function factsToCitations(facts: Fact[], people: Map<string, string>): ChatCitation[] {
  return facts.map((f) => ({
    text: `[${f.kind}/${f.status}] ${f.title}\n${f.detail}`,
    score: f.kind === "task" ? 0.95 : f.kind === "decision" ? 0.9 : 0.8,
    source: people.get(f.personIds[0] || "") || f.kind,
    wing: f.origin,
    kind: "fact" as const,
    factId: f.id,
  }));
}

async function gatherStateCitations(message: string): Promise<{
  citations: ChatCitation[];
  palaceOk: boolean;
  warning?: string;
}> {
  const store = await loadStore();
  const people = new Map(store.people.map((p) => [p.id, p.canonicalName]));
  let open = listOpenFacts(store, {
    kinds: ["task", "decision", "risk", "context", "event"],
  });

  const q = message.toLowerCase();
  const named = store.people.filter((p) =>
    q.includes(p.canonicalName.toLowerCase()),
  );
  if (named.length) {
    const ids = new Set(named.map((p) => p.id));
    const focused = open.filter((f) => f.personIds.some((id) => ids.has(id)));
    if (focused.length) open = focused;
  }

  const citations = factsToCitations(open.slice(0, 12), people);

  // light palace supplement
  const health = await palaceHealth();
  const palaceOk = health.ok && health.data.ok;
  if (palaceOk && citations.length < 6) {
    const search = await palaceSearch({ query: message, limit: 3 });
    if (search.ok) {
      for (const hit of search.data.results as PalaceHit[]) {
        citations.push({
          text: hit.text,
          score: hit.score * 0.5,
          source: hit.sourceFile || "palace",
          wing: hit.wing,
          kind: "palace",
        });
      }
    }
  }

  return {
    citations: citations.slice(0, 12),
    palaceOk: Boolean(palaceOk),
    warning: palaceOk
      ? undefined
      : health.ok === false
        ? health.error
        : health.data?.error || undefined,
  };
}

async function gatherRecallCitations(
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
          kind: "palace",
        });
      }
    } else {
      return { citations, palaceOk: false, warning: search.error };
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
        kind: "chunk",
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

async function llmAnswer(
  message: string,
  citations: ChatCitation[],
  retrievalMode: "state" | "recall",
  cfg: Awaited<ReturnType<typeof resolveLlmConfig>>,
): Promise<string> {
  const context = citations
    .slice(0, 10)
    .map(
      (c, i) =>
        `[${i + 1}] type=${c.kind || "chunk"} source=${c.source} score=${c.score.toFixed(3)}\n${c.text}`,
    )
    .join("\n\n");

  const system =
    retrievalMode === "state"
      ? [
          "Ты — второй мозг Кирилла. Режим STATE: отвечай по открытым задачам/решениям/рискам.",
          "Отвечай по-русски, кратко. Группируй по людям или срочности.",
          "Не выдумывай задачи, которых нет в контексте.",
          "В конце перечисли номера пунктов, на которые опираешься.",
        ].join(" ")
      : [
          "Ты — второй мозг Кирилла (персональная база Смысл).",
          "Режим RECALL: отвечай по цитатам из памяти.",
          "Отвечай по-русски, кратко и по делу.",
          "Используй ТОЛЬКО предоставленный контекст.",
          "В конце перечисли номера цитат.",
        ].join(" ");

  return completeChat({
    cfg,
    system,
    user: `Вопрос:\n${message}\n\nКонтекст:\n${context || "(пусто)"}`,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || body.q || "").trim();
    const wing = body.wing ? String(body.wing) : undefined;
    const modeHint = (body.modeHint || body.mode || "auto") as ModeHint;
    if (!message) {
      return NextResponse.json({ error: "message обязателен" }, { status: 400 });
    }

    const retrievalMode = detectMode(message, modeHint);
    const gathered =
      retrievalMode === "state"
        ? await gatherStateCitations(message)
        : await gatherRecallCitations(message, wing);

    const llm = await resolveLlmConfig();
    let mode: "llm" | "extractive" = "extractive";
    let answer: string;
    let provider: string = "none";

    if (llm.configured) {
      try {
        answer = await llmAnswer(
          message,
          gathered.citations,
          retrievalMode,
          llm,
        );
        mode = "llm";
        provider = llm.provider;
      } catch (error) {
        answer =
          extractiveAnswer(message, gathered.citations, retrievalMode) +
          `\n\n(LLM недоступен: ${String(error)})`;
        mode = "extractive";
        provider = llm.provider;
      }
    } else {
      answer = extractiveAnswer(message, gathered.citations, retrievalMode);
    }

    return NextResponse.json({
      answer,
      citations: gathered.citations,
      mode,
      retrievalMode,
      provider,
      model: llm.configured ? llm.model : null,
      source: llm.source,
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
  const store = await loadStore();
  const open = listOpenFacts(store);
  return NextResponse.json({
    llm: {
      configured: llm.configured,
      provider: llm.provider,
      model: llm.configured ? llm.model : null,
      baseUrl: llm.configured ? llm.baseUrl : null,
      source: llm.source,
    },
    palace: health.ok ? health.data : { ok: false, error: health.error },
    open: {
      facts: open.length,
      tasks: open.filter((f) => f.kind === "task").length,
    },
  });
}
