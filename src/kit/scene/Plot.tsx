import React from 'react';
import { useTheme } from '../ThemeContext';
import { toneColor, type Tone } from './draw';
import { Layer, useSpace } from './Scene';
import type { Vec2 } from './space';

export type PlotCurve = {
  /** Sampled in plot units, not world units. */
  readonly points: readonly Vec2[];
  readonly tone?: Tone;
  readonly label?: string;
  /** 0..1 draw-on along the curve's length. */
  readonly reveal?: number;
  readonly dashed?: boolean;
  readonly opacity?: number;
};

export type PlotPoint = {
  readonly at: Vec2;
  readonly label?: string;
  readonly tone?: Tone;
  readonly opacity?: number;
};

export type PlotProps = {
  /** Data-space extent: what the axes mean. */
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  /** Where the plot box sits and how big it is, in world units. */
  readonly at?: Vec2;
  readonly width?: number;
  readonly height?: number;
  readonly curves?: readonly PlotCurve[];
  /**
   * Scattered, labelled points.
   *
   * This is what makes it a trade-off diagram rather than a graph: three options
   * plotted against cost and staleness say "pick one" in a way that three
   * numbers in a table never do.
   */
  readonly points?: readonly PlotPoint[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  /** Vertical rule at a data-space x, for "we are here". */
  readonly marker?: number | null;
  readonly grid?: boolean;
  readonly opacity?: number;
};

/**
 * A two-axis plot: curves, scattered options, or both.
 *
 * Covers two arguments that look different and are the same picture. **Curves**
 * are for anything tuned over a range — easing, damage falloff, difficulty ramp,
 * `Lerp` against `SmoothDamp` under a varying delta time. **Scatter** is for a
 * trade-off space, where the point is that no option wins on both axes.
 *
 * Worth having because the alternative keeps being worse. `every-frame` needed
 * exactly this — "60/s is cheap to be correct but expensive, a timer is cheap
 * but stale, invalidation is neither" is two axes and three points — and settled
 * for three stacked rulers, which showed the rates but never showed that the
 * third option was off the trade-off line entirely.
 *
 * Data space is separate from world space on purpose. A curve is authored in the
 * units of the thing being explained (seconds, damage, cells) and the plot maps
 * that into whatever box it was given, so changing the box never means rescaling
 * the data by hand.
 */
export const Plot: React.FC<PlotProps> = ({
  xRange,
  yRange,
  at = [0, 0],
  width = 6,
  height = 4,
  curves = [],
  points = [],
  xLabel,
  yLabel,
  marker = null,
  grid = true,
  opacity = 1,
}) => {
  const { colors, type, draw, shape } = useTheme();
  const space = useSpace();

  const origin = space.project([at[0], at[1] + height]);
  const w = space.u(width);
  const h = space.u(height);
  const fontSize = Math.min(type.size.label, h * 0.14);

  // Data space to pixels, inside the plot box.
  const toPx = ([dx, dy]: Vec2) => ({
    x: origin.x + ((dx - xRange[0]) / (xRange[1] - xRange[0])) * w,
    y: origin.y + h - ((dy - yRange[0]) / (yRange[1] - yRange[0])) * h,
  });

  const path = (pts: readonly Vec2[], reveal: number): string => {
    if (pts.length < 2) {
      return '';
    }
    const n = Math.max(2, Math.ceil(pts.length * Math.max(0, Math.min(1, reveal))));
    return pts
      .slice(0, n)
      .map((p, i) => {
        const q = toPx(p);
        return `${i === 0 ? 'M' : 'L'} ${q.x} ${q.y}`;
      })
      .join(' ');
  };

  return (
    <Layer opacity={opacity}>
      {grid
        ? [0.25, 0.5, 0.75].flatMap((f) => [
            <line
              key={`gh${f}`}
              x1={origin.x}
              y1={origin.y + h * f}
              x2={origin.x + w}
              y2={origin.y + h * f}
              stroke={draw.gridColor}
              strokeWidth={draw.strokeWidth * 0.5}
            />,
            <line
              key={`gv${f}`}
              x1={origin.x + w * f}
              y1={origin.y}
              x2={origin.x + w * f}
              y2={origin.y + h}
              stroke={draw.gridColor}
              strokeWidth={draw.strokeWidth * 0.5}
            />,
          ])
        : null}

      {/* Axes only on the left and bottom. A full box turns the plot into a
          panel, and then the curve reads as a picture hung on a wall. */}
      <path
        d={`M ${origin.x} ${origin.y} L ${origin.x} ${origin.y + h} L ${origin.x + w} ${origin.y + h}`}
        fill="none"
        stroke={colors.border}
        strokeWidth={shape.borderWidth * 2}
      />

      {marker !== null ? (
        <line
          x1={toPx([marker, yRange[0]]).x}
          y1={origin.y}
          x2={toPx([marker, yRange[0]]).x}
          y2={origin.y + h}
          stroke={colors.accentAlt}
          strokeWidth={draw.strokeWidth}
          opacity={0.8}
        />
      ) : null}

      {curves.map((c, i) => {
        const color = toneColor(colors, c.tone ?? 'accent');
        return (
          <g key={`c${i}`} opacity={c.opacity ?? 1}>
            <path
              d={path(c.points, c.reveal ?? 1)}
              fill="none"
              stroke={color}
              strokeWidth={draw.strokeWidth * 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={c.dashed ? `${draw.dotRadius * 0.5} ${draw.dotRadius * 0.5}` : undefined}
            />
            {c.label && (c.reveal ?? 1) > 0.98 && c.points.length ? (
              <text
                x={toPx(c.points[c.points.length - 1]!).x - 8}
                y={toPx(c.points[c.points.length - 1]!).y - 14}
                textAnchor="end"
                fontFamily={type.mono}
                fontSize={fontSize}
                fill={color}
              >
                {c.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {points.map((p, i) => {
        const color = toneColor(colors, p.tone ?? 'accent');
        const q = toPx(p.at);
        /*
          Labels flip to the inside near the right edge. A scatter's most
          interesting option is very often the extreme one, so the label most
          worth reading is exactly the one that runs off the frame — and unlike
          a clipped curve, a clipped label loses the part that names it.
        */
        const frac = (p.at[0] - xRange[0]) / (xRange[1] - xRange[0]);
        const flip = frac > 0.66;
        return (
          <g key={`p${i}`} opacity={p.opacity ?? 1}>
            <circle cx={q.x} cy={q.y} r={draw.dotRadius * 0.42} fill={color} />
            {p.label ? (
              <text
                x={q.x + draw.dotRadius * 0.7 * (flip ? -1 : 1)}
                y={q.y - draw.dotRadius * 0.3}
                textAnchor={flip ? 'end' : 'start'}
                fontFamily={type.mono}
                fontSize={fontSize}
                fill={color}
                stroke={colors.bg}
                strokeWidth={6}
                paintOrder="stroke"
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {xLabel ? (
        <text
          x={origin.x + w}
          y={origin.y + h + fontSize * 1.9}
          textAnchor="end"
          fontFamily={type.mono}
          fontSize={fontSize}
          fill={colors.textMuted}
          letterSpacing={type.letterSpacing.label}
        >
          {xLabel}
        </text>
      ) : null}

      {yLabel ? (
        <text
          x={origin.x}
          y={origin.y - fontSize * 0.8}
          fontFamily={type.mono}
          fontSize={fontSize}
          fill={colors.textMuted}
          letterSpacing={type.letterSpacing.label}
        >
          {yLabel}
        </text>
      ) : null}
    </Layer>
  );
};
