export type PalaceHit = {
  text: string;
  score: number;
  wing?: string | null;
  room?: string | null;
  sourceFile?: string | null;
  sourcePath?: string | null;
  drawerId?: string | null;
  meta?: Record<string, unknown>;
};

export type PalaceMineText = {
  id: string;
  title?: string;
  body: string;
  meta?: Record<string, unknown>;
};

const DEFAULT_URL = "http://127.0.0.1:3851";

export function palaceUrl(): string {
  return (process.env.PALACE_URL || DEFAULT_URL).replace(/\/$/, "");
}

async function palaceFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${palaceUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          typeof data?.detail === "string"
            ? data.detail
            : data?.error || `palace HTTP ${res.status}`,
      };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

export async function palaceHealth() {
  return palaceFetch<{
    ok: boolean;
    palaceDir: string;
    drawers: number;
    embeddingModel?: string;
    error?: string | null;
  }>("/health");
}

export async function palaceMine(input: {
  wing: string;
  texts: PalaceMineText[];
  room?: string;
}) {
  return palaceFetch<{
    ok: boolean;
    wing: string;
    drawersFiled: number;
    files: string[];
  }>("/mine", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function palaceSearch(input: {
  query: string;
  wing?: string;
  limit?: number;
}) {
  return palaceFetch<{
    query: string;
    wing?: string | null;
    results: PalaceHit[];
  }>("/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function palaceWings() {
  return palaceFetch<{ wings: string[] }>("/wings");
}

/** Cyrillic-aware wing slug matching the sidecar. */
export function wingSlug(name: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const lower = name.trim().toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += map[ch] ?? ch;
  }
  const slug = out
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "wing";
}

export function personWing(person: {
  isSelf?: boolean;
  canonicalName: string;
  id: string;
}): string {
  if (person.isSelf) return "kirill";
  const base = wingSlug(person.canonicalName);
  return base || `person-${person.id.slice(0, 8)}`;
}
