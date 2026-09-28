import { NextResponse } from "next/server";
import { embedText } from "@/lib/embeddings";
import {
  projectMapNodes,
  type MapEdge,
  type MapNodeInput,
} from "@/lib/map-project";
import { listOpenFacts, loadStore } from "@/lib/store";

export const runtime = "nodejs";

const CHUNK_CAP = 400;

export async function GET() {
  const store = await loadStore();
  const inputs: MapNodeInput[] = [];
  const edges: MapEdge[] = [];

  const chunks = store.chunks.slice(-CHUNK_CAP);
  for (const c of chunks) {
    const emb =
      Array.isArray(c.embedding) && c.embedding.length
        ? c.embedding
        : embedText(`${c.title}\n${c.text}`);
    inputs.push({
      id: `chunk:${c.id}`,
      kind: "chunk",
      label: c.title || c.text.slice(0, 48),
      embedding: emb,
      colorKey: "chunk",
      href: `/sources/${c.sourceId}`,
      meta: {
        chunkId: c.id,
        sourceId: c.sourceId,
        text: c.text.slice(0, 400),
        kind: c.kind,
      },
    });
  }

  const openFacts = listOpenFacts(store).slice(0, 120);
  for (const f of openFacts) {
    inputs.push({
      id: `fact:${f.id}`,
      kind: "fact",
      label: f.title,
      embedding: embedText(`${f.kind} ${f.title}\n${f.detail}`),
      colorKey: f.kind,
      href: "/open",
      meta: {
        factId: f.id,
        factKind: f.kind,
        status: f.status,
        detail: f.detail.slice(0, 400),
        personIds: f.personIds,
      },
    });
    for (const eid of f.evidenceChunkIds.slice(0, 3)) {
      if (chunks.some((c) => c.id === eid)) {
        edges.push({
          from: `fact:${f.id}`,
          to: `chunk:${eid}`,
          kind: "evidence",
        });
      }
    }
  }

  for (const p of store.people) {
    const theirs = chunks.filter((c) => c.personIds.includes(p.id));
    let embedding: number[];
    if (theirs.length) {
      const dim = theirs[0].embedding.length || 384;
      const acc = new Array(dim).fill(0);
      for (const c of theirs) {
        for (let i = 0; i < dim; i++) acc[i] += c.embedding[i] || 0;
      }
      for (let i = 0; i < dim; i++) acc[i] /= theirs.length;
      let n = 0;
      for (const x of acc) n += x * x;
      n = Math.sqrt(n) || 1;
      embedding = acc.map((x) => x / n);
    } else {
      embedding = embedText(
        `${p.canonicalName} ${p.bio} ${p.themes.join(" ")}`,
      );
    }
    inputs.push({
      id: `person:${p.id}`,
      kind: "person",
      label: p.canonicalName,
      embedding,
      colorKey: p.isSelf ? "self" : p.relationToSelf,
      href: `/people/${p.isSelf ? "kirill" : p.id}`,
      meta: {
        personId: p.id,
        relationToSelf: p.relationToSelf,
        themes: p.themes.slice(0, 6),
        isSelf: p.isSelf,
      },
    });

    for (const f of openFacts) {
      if (f.personIds.includes(p.id) && f.kind === "task") {
        edges.push({
          from: `person:${p.id}`,
          to: `fact:${f.id}`,
          kind: "owns",
        });
      }
    }
  }

  const nodes = projectMapNodes(inputs);
  return NextResponse.json({
    nodes,
    edges,
    counts: {
      chunks: chunks.length,
      facts: openFacts.length,
      people: store.people.length,
      nodes: nodes.length,
    },
  });
}
