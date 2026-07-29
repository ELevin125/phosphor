import React from 'react';
import { useTheme } from '../ThemeContext';
import { toneColor, type Tone } from './draw';
import { Layer, useSpace } from './Scene';
import type { Vec2, World } from './space';

export type GraphNode = {
  readonly id: string;
  readonly label: string;
  /** Explicit world position. Required under `free`, ignored otherwise. */
  readonly at?: Vec2;
  readonly tone?: Tone;
  readonly opacity?: number;
  /**
   * The one node currently "on" — the live state of a machine, the object being
   * visited. Drawn filled rather than outlined.
   */
  readonly active?: boolean;
};

export type GraphEdge = {
  readonly from: string;
  readonly to: string;
  /** Transition condition, message name, whatever the edge means. */
  readonly label?: string;
  /**
   * Which way the arrow points, `+1` at `to` through to `-1` at `from`.
   *
   * Values in between animate the flip, and the flip is an argument all by
   * itself: the same dependencies pointing the other way is the difference
   * between a direct call and an event, or between a class knowing its
   * collaborators and being handed them.
   */
  readonly direction?: number;
  /** 0..1 draw-on. */
  readonly reveal?: number;
  readonly tone?: Tone;
  /** A signal travelling this edge, 0..1 along its length. */
  readonly pulse?: number | null;
};

/**
 * How node positions are decided.
 *
 * `free` — every node carries its own `at`. Best when the arrangement is part
 * of the point, which for a small hand-composed diagram it usually is.
 * `ring` — evenly spaced around an ellipse. State machines, cycles.
 * `rows` — layered top to bottom. Hierarchies, dependency levels, call depth.
 */
export type GraphLayout =
  | { readonly kind: 'free' }
  | { readonly kind: 'ring'; readonly rx?: number; readonly ry?: number; readonly rotate?: number }
  | { readonly kind: 'rows'; readonly rows: readonly (readonly string[])[] };

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Ease both ends of a 0..1 ramp.
 *
 * Not a theme gesture on purpose. Gestures are springs fired by an event —
 * something arrives, something pops — whereas `direction` is a continuous prop
 * the caller interpolates itself, and a spring driven off an already-animated
 * value chases a moving target and rings. This just takes the corners off a
 * value that is handed to us.
 */
const smoothstep = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** Distance from a box centre to its edge, along a unit direction. */
const rectRadius = (ux: number, uy: number, w: number, h: number): number => {
  const tx = Math.abs(ux) > 1e-6 ? w / 2 / Math.abs(ux) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(uy) > 1e-6 ? h / 2 / Math.abs(uy) : Number.POSITIVE_INFINITY;
  return Math.min(tx, ty);
};

const midOf = (world: World): Vec2 => [
  (world.x[0] + world.x[1]) / 2,
  (world.y[0] + world.y[1]) / 2,
];

const place = (
  nodes: readonly GraphNode[],
  layout: GraphLayout,
  world: World,
): Map<string, Vec2> => {
  const out = new Map<string, Vec2>();
  const [cx, cy] = midOf(world);
  const halfW = (world.x[1] - world.x[0]) / 2;
  const halfH = (world.y[1] - world.y[0]) / 2;

  if (layout.kind === 'ring') {
    // 0.66 rather than 1: node boxes are drawn centred on their point, so a
    // ring at the full half-extent puts half of every box outside the world.
    const rx = layout.rx ?? halfW * 0.66;
    const ry = layout.ry ?? halfH * 0.66;
    const rot = ((layout.rotate ?? 0) * Math.PI) / 180;
    nodes.forEach((n, i) => {
      // Start at the top and go clockwise, which is how every state diagram
      // anyone has ever drawn on a whiteboard reads.
      const a = rot + Math.PI / 2 - (i / nodes.length) * Math.PI * 2;
      out.set(n.id, [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    });
    return out;
  }

  if (layout.kind === 'rows') {
    const rows = layout.rows;
    rows.forEach((row, r) => {
      const y = rows.length === 1 ? cy : cy + halfH * 0.72 * (1 - (2 * r) / (rows.length - 1));
      row.forEach((id, c) => {
        const x = row.length === 1 ? cx : cx + halfW * 0.66 * ((2 * c) / (row.length - 1) - 1);
        out.set(id, [x, y]);
      });
    });
    return out;
  }

  for (const n of nodes) {
    out.set(n.id, n.at ?? [cx, cy]);
  }
  return out;
};

export type GraphProps = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly layout?: GraphLayout;
  /** Default direction for edges that do not set their own. */
  readonly direction?: number;
  /** Default pulse for edges that do not set their own. */
  readonly pulse?: number | null;
  readonly edgeTone?: Tone;
};

/**
 * Nodes and directed edges: the primitive for any argument about **structure or
 * dependency direction**.
 *
 * Events versus direct calls, interfaces, dependency injection, state machines,
 * behaviour trees, scene hierarchy, assembly references — all of those are the
 * same picture, and the only thing that changes is which way the arrows point
 * and where the boxes sit. That question is invisible in code, because
 * `_camera.ShakeAt(...)` and `Died += ...` are both one line, and it is obvious
 * the instant it is drawn.
 *
 * Everything renders into ONE `<Layer>`, labels included as `<text>` — a node is
 * a box with a word in it, and giving each its own positioned div would mean the
 * labels and the edges were laid out by two systems that agree only by accident.
 *
 * Self-edges are skipped rather than drawn. A state machine's "stay here"
 * transitions are real but they are also the least informative arrows on the
 * diagram, and a loop drawn on a box the size of these is mostly loop.
 */
export const Graph: React.FC<GraphProps> = ({
  nodes,
  edges,
  layout = { kind: 'free' },
  direction = 1,
  pulse = null,
  edgeTone = 'muted',
}) => {
  const { colors, type, draw, shape } = useTheme();
  const space = useSpace();

  const fontSize = type.size.code;
  const padX = 26;
  // 0.6em is the advance width of every mono face the themes ship, the same
  // assumption `fitCodeSize` and `CodeTag` are built on.
  const boxOf = (label: string) => ({
    w: label.length * fontSize * 0.6 + padX * 2,
    h: fontSize * 2.4,
  });

  const pos = place(nodes, layout, space.world);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const head = draw.arrowHead;

  return (
    <Layer>
      {edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        const pa = pos.get(e.from);
        const pb = pos.get(e.to);
        if (!a || !b || !pa || !pb || e.from === e.to) {
          return null;
        }
        const r = e.reveal ?? 1;
        if (r <= 0.01) {
          return null;
        }

        const sa = space.project(pa);
        const sb = space.project(pb);
        const dx = sb.x - sa.x;
        const dy = sb.y - sa.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) {
          return null;
        }
        const ux = dx / len;
        const uy = dy / len;

        const gap = 10;
        const ba = boxOf(a.label);
        const bb = boxOf(b.label);
        const from = rectRadius(ux, uy, ba.w, ba.h) + gap;
        const to = len - rectRadius(ux, uy, bb.w, bb.h) - gap;
        if (to <= from) {
          return null;
        }

        // Draw-on from the source outward, so an edge appearing reads as the
        // reference being taken rather than as a line fading up.
        const span = (to - from) * r;
        const x1 = sa.x + ux * from;
        const y1 = sa.y + uy * from;
        const x2 = sa.x + ux * (from + span);
        const y2 = sa.y + uy * (from + span);

        const dir = e.direction ?? direction;
        const k = clamp01((dir + 1) / 2);

        /*
          Head sits near whichever end it points at, and turns as it slides, so
          a reversal reads as the arrows coming about rather than as a cut
          between two diagrams. Two things make that read cleanly, and both were
          got wrong by driving position and angle linearly off the same `k`.

          The slide is eased at both ends. Linear, every arrow in the diagram
          started and stopped dead on the same frame, which is what made a
          reversal look mechanical — nothing in the frame had any weight.

          The turn is a mirror along the shaft, not a rotation in the plane.
          Rotating 180deg means passing through 90deg, and an arrowhead square
          across its own line is not a turning arrow, it is a broken glyph;
          worse, it hits that pose at the midpoint of the slide, dead centre in
          the frame where it is most visible. Flipping `scaleX` through zero
          takes the same path a real object would — the head goes edge-on for a
          frame or two and comes back facing the other way. Compressed into the
          middle 40% so the thin part is brief and the arrow spends most of the
          reversal legible.
        */
        const t = 0.07 + 0.86 * smoothstep(k);
        const hx = x1 + (x2 - x1) * t;
        const hy = y1 + (y2 - y1) * t;
        const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
        const flip = 2 * smoothstep((k - 0.3) / 0.4) - 1;

        const color = toneColor(colors, e.tone ?? edgeTone);
        const p = e.pulse ?? pulse;

        return (
          <g key={`e${i}`} opacity={r}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={draw.strokeWidth * 1.4}
              strokeLinecap="round"
            />
            {r > 0.9 ? (
              <path
                d={`M ${head * 0.5} 0 L ${-head * 0.5} ${head * 0.42} L ${-head * 0.5} ${-head * 0.42} Z`}
                fill={color}
                // The line finishes drawing at r=1 and the head was appearing
                // at full size on the frame r crossed 0.9 — a pop on the one
                // element the eye is already tracking to the end of the line.
                opacity={smoothstep((r - 0.9) / 0.1)}
                transform={`translate(${hx} ${hy}) rotate(${angle}) scale(${flip} 1)`}
              />
            ) : null}
            {e.label && r > 0.9 ? (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 12}
                textAnchor="middle"
                fontFamily={type.mono}
                fontSize={fontSize * 0.72}
                fill={colors.textMuted}
                // A tight halo, because an edge label sits ON its own line.
                stroke={colors.bg}
                strokeWidth={6}
                paintOrder="stroke"
              >
                {e.label}
              </text>
            ) : null}
            {p !== null && p !== undefined && r > 0.9 ? (
              <circle
                cx={x1 + (x2 - x1) * p}
                cy={y1 + (y2 - y1) * p}
                r={draw.dotRadius * 0.55}
                fill={colors.accent}
              />
            ) : null}
          </g>
        );
      })}

      {nodes.map((n) => {
        const at = pos.get(n.id);
        if (!at) {
          return null;
        }
        const p = space.project(at);
        const { w, h } = boxOf(n.label);
        const color = n.tone ? toneColor(colors, n.tone) : n.active ? colors.accent : colors.border;

        return (
          <g key={n.id} opacity={n.opacity ?? 1}>
            <rect
              x={p.x - w / 2}
              y={p.y - h / 2}
              width={w}
              height={h}
              rx={shape.radiusSm}
              /*
                Active nodes are filled and the rest outlined. On a diagram where
                every box looks alike, "which one is live" has to be a difference
                in weight rather than a difference in hue — a recoloured outline
                disappears the moment the diagram gets busy.
              */
              fill={n.active ? colors.bgAlt : colors.codeBg}
              stroke={color}
              strokeWidth={shape.borderWidth * (n.active ? 2 : 1)}
            />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={type.mono}
              fontSize={fontSize}
              fontWeight={type.weightMono}
              fill={n.active ? color : colors.text}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </Layer>
  );
};
