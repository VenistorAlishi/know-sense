import type { SourceType } from "../types";

export function detectSourceType(filename: string, text: string): SourceType {
  const lower = filename.toLowerCase();
  const trimmed = text.trim();

  if (
    lower === "result.json" ||
    lower.endsWith("/result.json") ||
    lower.includes("telegram") ||
    looksLikeTelegramJson(trimmed)
  ) {
    return "telegram_chat";
  }

  if (
    lower.endsWith(".md") &&
    /(участник|резюме|повестк|решени|задач|анализ встречи)/i.test(trimmed)
  ) {
    return "meeting";
  }

  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return "note";
  }

  return "file";
}

function looksLikeTelegramJson(text: string): boolean {
  if (!text.startsWith("{") && !text.startsWith("[")) return false;
  try {
    const data = JSON.parse(text) as {
      messages?: unknown;
      name?: unknown;
      type?: unknown;
    };
    return (
      Array.isArray(data.messages) &&
      typeof data.name === "string" &&
      (typeof data.type === "string" || data.type === undefined)
    );
  } catch {
    return false;
  }
}
