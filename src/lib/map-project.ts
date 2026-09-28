/**
 * Lightweight PCA → 2D for embedding map nodes.
 * No WASM / umap dependency; fine for personal corpora (hundreds of nodes).
 */

export type MapNodeKind = "chunk" | "fact" | "person";

export type MapNodeInput = {
  id: string;
  kind: MapNodeKind;
  label: string;
  embedding: number[];
  colorKey: string;
  href: string;
  meta?: Record<string, unknown>;
};

export type MapNode = MapNodeInput & {
  x: number;
  y: number;
};

export type MapEdge = {
  from: string;
  to: string;
  kind: "evidence" | "owns";
};

function mean(vectors: number[][], dim: number): number[] {
  const m = new Array(dim).fill(0);
  if (!vectors.length) return m;
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) m[i] += v[i] || 0;
  }
  for (let i = 0; i < dim; i++) m[i] /= vectors.length;
  return m;
}

function subtract(v: number[], m: number[]): number[] {
  return v.map((x, i) => x - (m[i] || 0));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function norm(v: number[]): number {
  return Math.sqrt(dot(v, v)) || 1;
}

function scale(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

/** Power iteration for top eigenvector of X^T X (rows = samples). */
function topEigenvector(centered: number[][], dim: number, iters = 40): number[] {
  let v = new Array(dim).fill(0).map((_, i) => ((i * 37) % 97) / 97 - 0.5);
  v = scale(v, 1 / norm(v));
  for (let t = 0; t < iters; t++) {
    const acc = new Array(dim).fill(0);
    for (const row of centered) {
      const proj = dot(row, v);
      for (let i = 0; i < dim; i++) acc[i] += row[i] * proj;
    }
    const n = norm(acc);
    v = scale(acc, 1 / n);
  }
  return v;
}

function projectTo2D(embeddings: number[][]): Array<{ x: number; y: number }> {
  if (!embeddings.length) return [];
  const dim = embeddings[0].length;
  const m = mean(embeddings, dim);
  let centered = embeddings.map((v) => subtract(v, m));

  if (embeddings.length === 1) {
    return [{ x: 0.5, y: 0.5 }];
  }

  const e1 = topEigenvector(centered, dim);
  // Deflate for second component
  centered = centered.map((row) => {
    const p = dot(row, e1);
    return row.map((x, i) => x - e1[i] * p);
  });
  const e2 = topEigenvector(centered, dim);

  const pts = embeddings.map((v) => {
    const c = subtract(v, m);
    return { x: dot(c, e1), y: dot(c, e2) };
  });

  // Normalize to [0.08, 0.92] for canvas padding
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return pts.map((p) => ({
    x: 0.08 + ((p.x - minX) / spanX) * 0.84,
    y: 0.08 + ((p.y - minY) / spanY) * 0.84,
  }));
}

export function projectMapNodes(inputs: MapNodeInput[]): MapNode[] {
  if (!inputs.length) return [];
  const coords = projectTo2D(inputs.map((n) => n.embedding));
  return inputs.map((n, i) => ({
    ...n,
    x: coords[i]?.x ?? 0.5,
    y: coords[i]?.y ?? 0.5,
  }));
}
