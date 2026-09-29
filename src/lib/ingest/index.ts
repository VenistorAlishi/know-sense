import type { Attachment, SourceType } from "../types";
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
import { syncSourceToPalace, type PalaceSyncResult } from "./palace-sync";

export interface IngestInput {
  text: string;
  filename?: string;
  type?: SourceType | "auto";
  title?: string;
  markPeerClose?: boolean;
  syncPalace?: boolean;
  /** Absolute path to Telegram ChatExport_* folder (for media copy). */
  exportDir?: string;
}

export interface IngestResult {
  source: Source;
  people: Person[];
  chunkCount: number;
  factCount: number;
  attachmentCount: number;
  palace?: PalaceSyncResult;
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
        ? {
            ...ingestMeetingMarkdown(input.text, ctx),
            attachments: [] as Attachment[],
          }
        : {
            ...ingestPlainText(
              input.text,
              ctx,
              type === "note" ? "note" : type === "other" ? "other" : "file",
            ),
            attachments: [] as Attachment[],
          };

  if (input.exportDir) {
    built.source.meta = {
      ...built.source.meta,
      exportDir: input.exportDir,
    };
  }

  const saved = await commitIngest({
    store,
    source: built.source,
    chunks: built.chunks,
    facts: built.facts,
    peopleTouched: built.peopleTouched,
    attachments: built.attachments,
    exportDir: input.exportDir,
    rawContent: input.text,
    rawFilename: filename,
  });

  const source = saved.sources.find((s) => s.id === built.source.id)!;
  const people = saved.people.filter((p) => source.personIds.includes(p.id));
  const attachmentCount = (saved.attachments || []).filter(
    (a) => a.sourceId === source.id,
  ).length;

  let palace: PalaceSyncResult | undefined;
  if (input.syncPalace !== false) {
    palace = await syncSourceToPalace({
      source,
      chunks: built.chunks,
      people,
    });
  }

  return {
    source,
    people,
    chunkCount: built.chunks.length,
    factCount: built.facts.length,
    attachmentCount,
    palace,
  };
}

export { detectSourceType };
export { makeChunk, makeFact } from "./helpers";
