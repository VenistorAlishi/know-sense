"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type JarvisMapNode = {
  id: string;
  kind: "chunk" | "fact" | "person";
  label: string;
  x: number;
  y: number;
  colorKey: string;
  href: string;
  meta?: Record<string, unknown>;
};

export type JarvisMapEdge = {
  from: string;
  to: string;
  kind: "evidence" | "owns";
};

const COLORS: Record<string, string> = {
  chunk: "#5f7370",
  self: "#2bb5a0",
  close: "#0f7f6e",
  other: "#294348",
  task: "#c4a35a",
  decision: "#2bb5a0",
  risk: "#9b3b2e",
  theme: "#5f7370",
  context: "#7a8f8a",
  relationship: "#0f7f6e",
  event: "#294348",
};

function colorFor(key: string) {
  return COLORS[key] || COLORS.chunk;
}

export function MemoryMap({
  nodes,
  edges,
  highlightIds,
  selectedId,
  onSelect,
}: {
  nodes: JarvisMapNode[];
  edges: JarvisMapEdge[];
  highlightIds?: Set<string>;
  selectedId?: string | null;
  onSelect: (node: JarvisMapNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState({ x: 0, y: 0, scale: 1 });
  const [hover, setHover] = useState<JarvisMapNode | null>(null);
  const drag = useRef<{
    active: boolean;
    x: number;
    y: number;
    camX: number;
    camY: number;
  } | null>(null);
  const [ready, setReady] = useState(false);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    requestAnimationFrame(() => setReady(true));
    return () => ro.disconnect();
  }, []);

  const toScreen = useCallback(
    (nx: number, ny: number) => ({
      x: nx * size.w * cam.scale + cam.x,
      y: ny * size.h * cam.scale + cam.y,
    }),
    [cam, size],
  );

  const hitTest = useCallback(
    (sx: number, sy: number) => {
      let best: JarvisMapNode | null = null;
      let bestD = 16;
      for (const n of nodes) {
        const p = toScreen(n.x, n.y);
        const d = Math.hypot(p.x - sx, p.y - sy);
        const r = n.kind === "person" ? 10 : n.kind === "fact" ? 7 : 4;
        if (d < bestD + r) {
          bestD = d;
          best = n;
        }
      }
      return best;
    },
    [nodes, toScreen],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // atmosphere grid
    ctx.strokeStyle = "rgba(43,181,160,0.06)";
    ctx.lineWidth = 1;
    const step = 48 * cam.scale;
    for (let x = (cam.x % step) - step; x < size.w + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.h);
      ctx.stroke();
    }
    for (let y = (cam.y % step) - step; y < size.h + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.w, y);
      ctx.stroke();
    }

    // edges
    for (const e of edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const pa = toScreen(a.x, a.y);
      const pb = toScreen(b.x, b.y);
      ctx.beginPath();
      ctx.strokeStyle =
        e.kind === "owns"
          ? "rgba(43,181,160,0.22)"
          : "rgba(95,115,112,0.18)";
      ctx.lineWidth = e.kind === "owns" ? 1.2 : 0.8;
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    for (const n of nodes) {
      const p = toScreen(n.x, n.y);
      const highlighted = highlightIds?.has(n.id);
      const selected = selectedId === n.id;
      const hovered = hover?.id === n.id;
      const r =
        (n.kind === "person" ? 8 : n.kind === "fact" ? 5.5 : 3.2) *
        (selected || hovered ? 1.35 : 1) *
        Math.min(cam.scale, 1.6);
      const col = colorFor(n.colorKey);

      if (selected || highlighted) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(43,181,160,0.18)";
        ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.globalAlpha = highlighted || !highlightIds?.size ? 0.95 : 0.28;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (n.kind === "person" || selected || hovered) {
        ctx.font = "500 11px var(--font-body), system-ui, sans-serif";
        ctx.fillStyle = "rgba(238,245,242,0.88)";
        ctx.fillText(n.label.slice(0, 28), p.x + r + 4, p.y + 4);
      }
    }
  }, [
    nodes,
    edges,
    size,
    cam,
    byId,
    toScreen,
    highlightIds,
    selectedId,
    hover,
  ]);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden transition-opacity duration-700 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        style={{ width: size.w, height: size.h }}
        onPointerDown={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const hit = hitTest(sx, sy);
          if (hit) {
            onSelect(hit);
            return;
          }
          drag.current = {
            active: true,
            x: e.clientX,
            y: e.clientY,
            camX: cam.x,
            camY: cam.y,
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          if (drag.current?.active) {
            setCam((c) => ({
              ...c,
              x: drag.current!.camX + (e.clientX - drag.current!.x),
              y: drag.current!.camY + (e.clientY - drag.current!.y),
            }));
            return;
          }
          setHover(hitTest(sx, sy));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 0.92 : 1.08;
          setCam((c) => ({
            ...c,
            scale: Math.min(3.5, Math.max(0.45, c.scale * factor)),
          }));
        }}
        onDoubleClick={() => {
          setCam({ x: 0, y: 0, scale: 1 });
          onSelect(null);
        }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute rounded-md border border-[var(--accent)]/40 bg-[var(--ink)]/90 px-2 py-1 text-[11px] text-[var(--paper)] shadow-lg"
          style={{
            left: Math.min(
              size.w - 180,
              toScreen(hover.x, hover.y).x + 12,
            ),
            top: Math.max(8, toScreen(hover.x, hover.y).y - 28),
          }}
        >
          <span className="uppercase tracking-wide opacity-60">
            {hover.kind}
          </span>{" "}
          {hover.label}
        </div>
      )}
    </div>
  );
}
