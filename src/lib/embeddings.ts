/**
 * Local dense embeddings without external API keys.
 * Character + word n-gram hashing into a fixed 384-d space, L2-normalized.
 * Good enough for intra-corpus semantic search in Russian meeting notes.
 */

const DIM = 384;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addFeature(vec: Float64Array, token: string, weight: number) {
  const h = hashToken(token);
  const idx = h % DIM;
  const sign = (h & 1) === 0 ? 1 : -1;
  vec[idx] += sign * weight;
}

export function embedText(text: string): number[] {
  const cleaned = normalizeText(text);
  const vec = new Float64Array(DIM);
  if (!cleaned) return Array.from(vec);

  const words = cleaned.split(" ").filter(Boolean);

  for (const word of words) {
    addFeature(vec, `w:${word}`, 1.2);
    if (word.length >= 4) {
      addFeature(vec, `p3:${word.slice(0, 3)}`, 0.35);
      addFeature(vec, `s3:${word.slice(-3)}`, 0.35);
    }
    for (let i = 0; i < word.length - 2; i++) {
      addFeature(vec, `c3:${word.slice(i, i + 3)}`, 0.25);
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    addFeature(vec, `bg:${words[i]}_${words[i + 1]}`, 0.9);
  }

  // Light topic boosters for meeting-analysis vocabulary
  const boosters: Array<[RegExp, string, number]> = [
    [/решил|решение|договорились/, "topic:decision", 1.4],
    [/задач|сделать|ответственн|срок|дедлайн/, "topic:action", 1.4],
    [/риск|блокер|проблем|опасно/, "topic:risk", 1.3],
    [/бюджет|деньг|оплат|стоим/, "topic:money", 1.2],
    [/продукт|фич|релиз|запуск/, "topic:product", 1.2],
    [/клиент|продаж|лид|сделк/, "topic:sales", 1.2],
    [/команд|найм|роль|обязан/, "topic:team", 1.2],
  ];
  for (const [re, key, w] of boosters) {
    if (re.test(cleaned)) addFeature(vec, key, w);
  }

  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / norm;
  return out;
}

export const EMBEDDING_DIM = DIM;
