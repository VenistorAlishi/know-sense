import { heuristicFactsFromText } from "./ingest/helpers";
import { completeChat, resolveLlmConfig } from "./llm";
import { createFact, loadStore, saveStore } from "./store";
import type { FactKind, Source } from "./types";

export type ExtractCandidate = {
  title: string;
  detail: string;
  kind: FactKind;
  confidence: "high" | "medium" | "low";
  personNames?: string[];
};

const KIND_SET = new Set<FactKind>([
  "identity",
  "relationship",
  "preference",
  "skill",
  "event",
  "task",
  "context",
  "theme",
  "decision",
  "risk",
]);

function parseCandidates(raw: string): ExtractCandidate[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1)) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item): ExtractCandidate | null => {
        const o = item as Record<string, unknown>;
        const kindRaw = String(o.kind || "context") as FactKind;
        const confidence: ExtractCandidate["confidence"] =
          o.confidence === "high" || o.confidence === "low"
            ? o.confidence
            : "medium";
        const title = String(o.title || "").trim().slice(0, 160);
        if (!title) return null;
        return {
          title,
          detail: String(o.detail || title).trim().slice(0, 800),
          kind: KIND_SET.has(kindRaw) ? kindRaw : "context",
          confidence,
          personNames: Array.isArray(o.personNames)
            ? o.personNames.map(String)
            : undefined,
        };
      })
      .filter((c): c is ExtractCandidate => Boolean(c));
  } catch {
    return [];
  }
}

export async function listExtractableSources(limit = 12): Promise<Source[]> {
  const store = await loadStore();
  return store.sources
    .filter((s) => !s.meta?.extractedAt)
    .slice(0, limit);
}

export async function extractFromSource(sourceId: string): Promise<{
  sourceId: string;
  candidates: ExtractCandidate[];
  created: number;
  error?: string;
}> {
  const store = await loadStore();
  const source = store.sources.find((s) => s.id === sourceId);
  if (!source) {
    return { sourceId, candidates: [], created: 0, error: "source not found" };
  }

  const chunks = store.chunks
    .filter((c) => c.sourceId === sourceId)
    .slice(0, 8);
  const text = chunks.map((c) => c.text).join("\n\n").slice(0, 6000);
  if (!text.trim()) {
    return { sourceId, candidates: [], created: 0, error: "no chunks" };
  }

  const llm = await resolveLlmConfig();
  const people = store.people
    .map((p) => p.canonicalName)
    .slice(0, 20)
    .join(", ");

  let candidates: ExtractCandidate[] = [];
  let usedFallback = false;

  if (llm.configured) {
    try {
      const raw = await completeChat({
        cfg: llm,
        system: [
          "Извлеки из текста факты для персональной базы Кирилла.",
          "Верни ТОЛЬКО JSON-массив объектов:",
          '{"title","detail","kind","confidence","personNames?"}[]',
          "kind: task|decision|risk|theme|relationship|event|context|preference|skill",
          "Максимум 8 элементов. Пиши по-русски. Без markdown.",
        ].join(" "),
        user: `Известные люди: ${people || "Кирилл"}\n\nИсточник «${source.title}»:\n${text}`,
      });
      candidates = parseCandidates(raw).slice(0, 8);
    } catch {
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  // Soft fallback when LLM down/slow: RU heuristics as llm-tagged candidates for review
  if (!candidates.length) {
    usedFallback = true;
    candidates = heuristicFactsFromText({
      sourceId,
      personIds: source.personIds,
      text,
      chunkIds: chunks.map((c) => c.id),
      origin: "llm",
    }).map((f) => ({
      title: f.title,
      detail: f.detail,
      kind: f.kind,
      confidence: f.confidence,
    }));
  }

  let created = 0;
  for (const c of candidates) {
    const personIds = source.personIds.slice(0, 3);
    if (c.personNames?.length) {
      for (const name of c.personNames) {
        const p = store.people.find(
          (x) => x.canonicalName.toLowerCase() === name.toLowerCase(),
        );
        if (p && !personIds.includes(p.id)) personIds.push(p.id);
      }
    }
    await createFact({
      title: c.title,
      detail: c.detail,
      kind: c.kind,
      personIds: personIds.length ? personIds : undefined,
      sourceId,
      evidenceChunkIds: chunks.slice(0, 2).map((ch) => ch.id),
      confidence: c.confidence,
      origin: "llm",
      status: "open",
    });
    created += 1;
  }

  // reload + mark extracted
  const fresh = await loadStore();
  const src = fresh.sources.find((s) => s.id === sourceId);
  if (src) {
    src.meta = { ...src.meta, extractedAt: new Date().toISOString() };
    await saveStore(fresh);
  }

  return {
    sourceId,
    candidates,
    created,
    error: usedFallback
      ? "LLM unavailable — used heuristic candidates (origin=llm) for review"
      : undefined,
  };
}

export async function extractBatch(limit = 5) {
  const sources = await listExtractableSources(limit);
  const results = [];
  for (const s of sources) {
    results.push(await extractFromSource(s.id));
  }
  return { results, processed: results.length };
}
