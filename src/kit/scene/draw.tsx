import React from 'react';
import { useTheme } from '../ThemeContext';
import { Layer, useSpace } from './Scene';
import type { Vec2 } from './space';

export type Tone = 'accent' | 'accentAlt' | 'positive' | 'negative' | 'muted' | 'text';

export const useTone = (tone: Tone = 'accent'): string => {
  const { colors } = useTheme();
  switch (tone) {
    case 'accentAlt':
      return colors.accentAlt;
    case 'positive':
      return colors.positive;
    case 'negative':
      return colors.negative;
    case 'muted':
      return colors.textMuted;
    case 'text':
      return colors.text;
    default:
      return colors.accent;
  }
};

/**
 * The background lattice.
 *
 * Its job is to make motion measurable — a dot moving across an empty field has
 * no speed the eye can read, but a dot crossing gridlines does. Themes that
 * switch it off are choosing a different way to convey the same thing.
 */
export const Grid: React.FC<{ readonly step?: number }> = ({ step = 1 }) => {
  const { draw } = useTheme();
  const space = useSpace();
  if (draw.gridStyle === 'none') {
    return null;
  }

  const [x0, x1] = space.world.x;
  const [y0, y1] = space.world.y;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    xs.push(x);
  }
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    ys.push(y);
  }

  if (draw.gridStyle === 'dots') {
    return (
      <Layer>
        {xs.map((x) =>
          ys.map((y) => {
            const p = space.project([x, y]);
            return (
              <circle
                key={`${x}-${y}`}
                cx={p.x}
                cy={p.y}
                r={draw.strokeWidth}
                fill={draw.gridColor}
              />
            );
          }),
        )}
      </Layer>
    );
  }

  return (
    <Layer>
      {xs.map((x) => {
        const a = space.project([x, y0]);
        const b = space.project([x, y1]);
        return (
          <line
            key={`v${x}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={draw.gridColor}
            strokeWidth={draw.strokeWidth * 0.5}
          />
        );
      })}
      {ys.map((y) => {
        const a = space.project([x0, y]);
        const b = space.project([x1, y]);
        return (
          <line
            key={`h${y}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={draw.gridColor}
            strokeWidth={draw.strokeWidth * 0.5}
          />
        );
      })}
    </Layer>
  );
};

export type DotProps = {
  readonly at: Vec2;
  readonly tone?: Tone;
  /** Multiplier on the theme's marker radius. */
  readonly size?: number;
  readonly opacity?: number;
  /** Draws a soft halo behind it. For the one object that matters most. */
  readonly glow?: boolean;
};

/** A marker at a world point. The workhorse of every scene. */
export const Dot: React.FC<DotProps> = ({ at, tone, size = 1, opacity = 1, glow = false }) => {
  const { draw, shape } = useTheme();
  const space = useSpace();
  const color = useTone(tone);
  const p = space.project(at);
  const r = draw.dotRadius * size;

  return (
    <Layer opacity={opacity}>
      {glow ? <circle cx={p.x} cy={p.y} r={r * 2.6} fill={color} opacity={0.16} /> : null}
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill={draw.dotStyle === 'solid' ? color : 'none'}
        stroke={color}
        strokeWidth={draw.strokeWidth}
        style={glow && shape.glow !== 'none' ? { filter: `drop-shadow(0 0 ${r}px ${color})` } : undefined}
      />
    </Layer>
  );
};

export type TrailProps = {
  readonly points: readonly Vec2[];
  readonly tone?: Tone;
  readonly size?: number;
};

/**
 * The history of a moving thing.
 *
 * With `ghosts`, spacing between samples is itself the data: evenly spaced
 * stamps mean constant speed, bunching means deceleration. That is the single
 * most useful thing a diagram can show about motion, and it is invisible in
 * any still frame of the object alone.
 */
export const Trail: React.FC<TrailProps> = ({ points, tone, size = 0.55 }) => {
  const { draw } = useTheme();
  const space = useSpace();
  const color = useTone(tone);
  if (points.length < 2) {
    return null;
  }

  const projected = points.map((p) => space.project(p));

  if (draw.trailStyle === 'ghosts') {
    return (
      <Layer>
        {projected.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={draw.dotRadius * size}
            fill={draw.dotStyle === 'solid' ? color : 'none'}
            stroke={color}
            strokeWidth={draw.strokeWidth * 0.7}
            // Oldest sample sits at `trailFade`, newest at full.
            opacity={draw.trailFade + (1 - draw.trailFade) * (i / (projected.length - 1))}
          />
        ))}
      </Layer>
    );
  }

  const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <Layer>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={draw.strokeWidth * 1.4}
        strokeLinecap="round"
        strokeDasharray={draw.trailStyle === 'dashes' ? `${draw.dotRadius} ${draw.dotRadius}` : undefined}
        opacity={0.55}
      />
    </Layer>
  );
};

export type VecProps = {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly tone?: Tone;
  readonly dashed?: boolean;
  readonly opacity?: number;
};

/** An arrow between two world points, with a proper head. */
export const Vec: React.FC<VecProps> = ({ from, to, tone, dashed = false, opacity = 1 }) => {
  const { draw } = useTheme();
  const space = useSpace();
  const color = useTone(tone);

  const a = space.project(from);
  const b = space.project(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return null;
  }

  const ux = dx / len;
  const uy = dy / len;
  const head = draw.arrowHead;
  // Stop the shaft short so the head is not drawn on top of a blunt end.
  const tipX = b.x;
  const tipY = b.y;
  const baseX = b.x - ux * head;
  const baseY = b.y - uy * head;
  const nx = -uy;
  const ny = ux;

  return (
    <Layer opacity={opacity}>
      <line
        x1={a.x}
        y1={a.y}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={draw.strokeWidth * 1.4}
        strokeLinecap="round"
        strokeDasharray={dashed ? `${head * 0.5} ${head * 0.5}` : undefined}
      />
      <path
        d={`M ${tipX} ${tipY} L ${baseX + nx * head * 0.42} ${baseY + ny * head * 0.42} L ${baseX - nx * head * 0.42} ${baseY - ny * head * 0.42} Z`}
        fill={color}
      />
    </Layer>
  );
};

export type MeasureProps = {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly label?: string;
  readonly tone?: Tone;
  /** Perpendicular offset in world units, so it clears what it measures. */
  readonly offset?: number;
};

/**
 * A dimension line with end ticks — "this much".
 *
 * Distances are the claim in most explanations of motion, and a number in a box
 * elsewhere on screen makes the viewer do the mapping themselves. Drawing the
 * span where the span is removes that work.
 */
export const Measure: React.FC<MeasureProps> = ({ from, to, label, tone = 'muted', offset = 0 }) => {
  const { draw, type, colors } = useTheme();
  const space = useSpace();
  const color = useTone(tone);

  const rawA = space.project(from);
  const rawB = space.project(to);
  const dx = rawB.x - rawA.x;
  const dy = rawB.y - rawA.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    return null;
  }
  // Offset PERPENDICULAR to the span, so a vertical measure steps sideways to
  // clear what it measures and a horizontal one steps up. Offsetting along a
  // fixed axis only works for one orientation.
  const nx = -dy / len;
  const ny = dx / len;
  const off = space.u(offset);
  const a = { x: rawA.x + nx * off, y: rawA.y + ny * off };
  const b = { x: rawB.x + nx * off, y: rawB.y + ny * off };
  const tick = draw.dotRadius * 1.2;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  return (
    <>
      <Layer>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={draw.strokeWidth} />
        <line
          x1={a.x + nx * tick}
          y1={a.y + ny * tick}
          x2={a.x - nx * tick}
          y2={a.y - ny * tick}
          stroke={color}
          strokeWidth={draw.strokeWidth}
        />
        <line
          x1={b.x + nx * tick}
          y1={b.y + ny * tick}
          x2={b.x - nx * tick}
          y2={b.y - ny * tick}
          stroke={color}
          strokeWidth={draw.strokeWidth}
        />
      </Layer>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: mid.x,
            top: mid.y - tick * 2.4,
            transform: 'translate(-50%, -100%)',
            fontFamily: type.mono,
            fontSize: type.size.label,
            fontWeight: type.weightMono,
            letterSpacing: type.letterSpacing.label,
            color,
            background: colors.bg,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
