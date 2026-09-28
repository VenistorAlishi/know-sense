import type { Chunk, Person, Source } from "../types";
import { palaceMine, personWing, type PalaceMineText } from "../palace";

export type PalaceSyncResult = {
  attempted: boolean;
  ok: boolean;
  warning?: string;
  wings: string[];
  drawersFiled: number;
};

function chunkToText(chunk: Chunk, source: Source): PalaceMineText {
  return {
    id: `${source.id}_${chunk.id}`,
    title: chunk.title || source.title,
    body: chunk.text,
    meta: {
      sourceId: source.id,
      sourceType: source.type,
      chunkId: chunk.id,
      kind: chunk.kind,
      speaker: chunk.speaker,
      timestamp: chunk.timestamp,
    },
  };
}

/**
 * Sync ingested chunks into MemPalace wings (self + close peers).
 * Soft-fails if sidecar is down.
 */
export async function syncSourceToPalace(input: {
  source: Source;
  chunks: Chunk[];
  people: Person[];
}): Promise<PalaceSyncResult> {
  const { source, chunks, people } = input;
  if (!chunks.length) {
    return { attempted: false, ok: true, wings: [], drawersFiled: 0 };
  }

  const self = people.find((p) => p.isSelf);
  const closeOrSelf = people.filter(
    (p) => p.isSelf || p.relationToSelf === "close",
  );

  // Prefer peer wing for telegram; always also mine into kirill
  const targets = new Map<string, Person>();
  for (const p of closeOrSelf) {
    targets.set(personWing(p), p);
  }
  if (self) targets.set("kirill", self);

  // If telegram and we have a non-self peer, ensure that wing exists even if not close somehow
  if (source.type === "telegram_chat") {
    const peer =
      people.find((p) => !p.isSelf && p.relationToSelf === "close") ||
      people.find((p) => !p.isSelf);
    if (peer) targets.set(personWing(peer), peer);
  }

  let drawersFiled = 0;
  const wings: string[] = [];
  const errors: string[] = [];

  for (const [wing, person] of targets) {
    const personChunks =
      person.isSelf
        ? chunks
        : chunks.filter(
            (c) =>
              c.personIds.includes(person.id) ||
              c.text.includes(person.canonicalName),
          );
    const batch = (personChunks.length ? personChunks : chunks).slice(0, 80);
    const texts = batch.map((c) => chunkToText(c, source));
    const res = await palaceMine({ wing, texts, room: source.type });
    if (!res.ok) {
      errors.push(`${wing}: ${res.error}`);
      continue;
    }
    wings.push(res.data.wing);
    drawersFiled += res.data.drawersFiled || 0;
  }

  if (errors.length && !wings.length) {
    return {
      attempted: true,
      ok: false,
      warning: errors.join("; "),
      wings,
      drawersFiled,
    };
  }

  return {
    attempted: true,
    ok: true,
    warning: errors.length ? errors.join("; ") : undefined,
    wings,
    drawersFiled,
  };
}
