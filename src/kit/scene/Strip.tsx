import React from 'react';
import { useTheme } from '../ThemeContext';
import { toneColor, type Tone } from './draw';
import { Layer, useSpace } from './Scene';
import type { Vec2 } from './space';

export type StripCell = {
  /** Text inside the cell. Keep it short — these are narrow by design. */
  readonly label?: string;
  readonly tone?: Tone;
  /** Fills the cell rather than outlining it. Use for "occupied". */
  readonly filled?: boolean;
  readonly opacity?: number;
};

export type StripPointer = {
  /** Cell index the pointer aims at. Fractional values sit between cells. */
  readonly at: number;
  readonly label?: string;
  readonly tone?: Tone;
  /** Above the strip by default; below keeps two pointers from colliding. */
  readonly below?: boolean;
  readonly opacity?: number;
};

export type StripProps = {
  readonly cells: readonly StripCell[];
  /** Bottom-left corner of the strip, in world units. */
  readonly at?: Vec2;
  /** Cell width in world units. Height follows unless overridden. */
  readonly cellWidth?: number;
  readonly cellHeight?: number;
  readonly pointers?: readonly StripPointer[];
  /** Caption under the whole run, e.g. `Enemy[]` or `stack`. */
  readonly label?: string;
  /** Prints the index under every Nth cell. 0 turns it off. */
  readonly indexEvery?: number;
  readonly opacity?: number;
};

/**
 * A one-dimensional run of labelled cells, with pointers into it.
 *
 * The primitive for **contiguous memory** — arrays, pools, stacks, ring buffers,
 * cache lines, array-of-structs versus struct-of-arrays. All of those arguments
 * are about *adjacency*: which things sit next to which, and what a pointer is
 * currently looking at. A grid is the wrong shape for that, because a grid
 * implies two meaningful axes and here there is only one.
 *
 * Deliberately separate from `Field`. `Field` is a place — cell (x, z) is
 * somewhere an agent can stand. A `Strip` cell is an *index*, and the distance
 * between two cells is a stride rather than a distance. Conflating them is how
 * you end up drawing a heap as a room.
 *
 * Renders into one `<Layer>`, like every other scene drawable.
 */
export const Strip: React.FC<StripProps> = ({
  cells,
  at = [0, 0],
  cellWidth = 1,
  cellHeight,
  pointers = [],
  label,
  indexEvery = 0,
  opacity = 1,
}) => {
  const { colors, type, draw, shape } = useTheme();
  const space = useSpace();

  const ch = cellHeight ?? cellWidth * 1.35;
  const origin = space.project([at[0], at[1] + ch]);
  const cw = space.u(cellWidth);
  const h = space.u(ch);

  const fontSize = Math.min(type.size.code, h * 0.42);

  /*
    Everything under the strip has to clear the below-pointers, not just each
    other. A pointer drawn downward occupies the same band the index row and the
    caption want, and the first draft put all three there — the arrow ran
    straight through the indices and its label landed on top of the caption.
  */
  const belowExtent = pointers.some((p) => p.below) ? h * 0.55 + fontSize * 1.8 : 0;
  const underY = origin.y + h + belowExtent;

  return (
    <Layer opacity={opacity}>
      {cells.map((c, i) => {
        const color = c.tone ? toneColor(colors, c.tone) : colors.border;
        const x = origin.x + i * cw;
        return (
          <g key={`c${i}`} opacity={c.opacity ?? 1}>
            <rect
              x={x}
              y={origin.y}
              width={cw}
              height={h}
              fill={c.filled ? color : colors.codeBg}
              stroke={color}
              strokeWidth={shape.borderWidth}
              // Cells butt against each other, so a shared border that lands on
              // a half pixel shows as an uneven ladder of light and dark seams.
              shapeRendering="crispEdges"
            />
            {c.label ? (
              <text
                x={x + cw / 2}
                y={origin.y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={type.mono}
                fontSize={fontSize}
                fontWeight={type.weightMono}
                fill={c.filled ? colors.bg : colors.text}
              >
                {c.label}
              </text>
            ) : null}
            {indexEvery > 0 && i % indexEvery === 0 ? (
              <text
                x={x + cw / 2}
                y={underY + fontSize * 1.1}
                textAnchor="middle"
                fontFamily={type.mono}
                fontSize={fontSize * 0.72}
                fill={colors.textMuted}
              >
                {i}
              </text>
            ) : null}
          </g>
        );
      })}

      {pointers.map((p, i) => {
        const color = toneColor(colors, p.tone ?? 'accent');
        const x = origin.x + (p.at + 0.5) * cw;
        const tip = p.below ? origin.y + h : origin.y;
        const tail = p.below ? tip + h * 0.55 : tip - h * 0.55;
        const dir = p.below ? -1 : 1;
        const head = Math.min(draw.arrowHead, cw * 0.5);

        return (
          <g key={`p${i}`} opacity={p.opacity ?? 1}>
            <line
              x1={x}
              y1={tail}
              x2={x}
              y2={tip + dir * head * 0.6}
              stroke={color}
              strokeWidth={draw.strokeWidth * 1.4}
              strokeLinecap="round"
            />
            <path
              d={
                `M ${x} ${tip} ` +
                `L ${x - head * 0.42} ${tip + dir * head} ` +
                `L ${x + head * 0.42} ${tip + dir * head} Z`
              }
              fill={color}
            />
            {p.label ? (
              <text
                x={x}
                y={p.below ? tail + fontSize : tail - fontSize * 0.4}
                textAnchor="middle"
                fontFamily={type.mono}
                fontSize={fontSize * 0.82}
                fill={color}
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {label ? (
        <text
          x={origin.x}
          y={underY + (indexEvery > 0 ? fontSize * 2.4 : fontSize * 1.4)}
          fontFamily={type.mono}
          fontSize={fontSize * 0.88}
          fill={colors.textMuted}
          letterSpacing={type.letterSpacing.label}
        >
          {label}
        </text>
      ) : null}
    </Layer>
  );
};
