import type { SourceType } from "../types";
import { detectSourceType } from "./detect";
import { ingestTelegram } from "./telegram";
import { ingestMeetingMarkdown } from "./meeting";
import { ingestPlainText } from "./text";
import {
  commitIngest,
  getSelf,
  loadStore,
} from "../store";
import type { Person, Source } from "../types";

export interface IngestInput {
  text: string;
  filename?: string;
  type?: SourceType | "auto";
  title?: string;
  markPeerClose?: boolean;
}

export interface IngestResult {
  source: Source;
  people: Person[];
  chunkCount: number;
  factCount: number;
}

export async function ingestSource(input: IngestInput): Promise<IngestResult> {
  const filename = input.filename || "source.txt";
  const type =
    !input.type || input.type === "auto"
      ? detectSourceType(filename, input.text)
      : input.type;

  const store = await loadStore();
  const self = getSelf(store);

  const ctx = {
    store,
    self,
    filename,
    title: input.title,
    markPeerClose: input.markPeerClose ?? type === "telegram_chat",
  };

  const built =
    type === "telegram_chat"
      ? ingestTelegram(input.text, ctx)
      : type === "meeting"
        ? ingestMeetingMarkdown(input.text, ctx)
        : ingestPlainText(
            input.text,
            ctx,
            type === "note" ? "note" : type === "other" ? "other" : "file",
          );

  const saved = await commitIngest({
    store,
    ...built,
    rawContent: input.text,
    rawFilename: filename,
  });

  const source = saved.sources.find((s) => s.id === built.source.id)!;
  const people = saved.people.filter((p) => source.personIds.includes(p.id));

  return {
    source,
    people,
    chunkCount: built.chunks.length,
    factCount: built.facts.length,
  };
}

export { detectSourceType };
export { makeChunk, makeFact } from "./helpers";
