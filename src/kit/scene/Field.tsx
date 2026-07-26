import React from 'react';
import { useTheme } from '../ThemeContext';
import { useTone, type Tone } from './draw';
import { Layer, useSpace } from './Scene';

/** A direction per cell, or null where there isn't one. */
export type FieldArrow = readonly [number, number] | null;

export type FieldProps = {
  readonly cols: number;
  readonly rows: number;
  /**
   * Fill colour per cell, row-major (`z * cols + x`), null for none.
   *
   * Passed as a flat array rather than a callback so the whole field is one
   * value the caller can memoise, and so nothing is recomputed per cell during
   * render.
   */
  readonly fills?: readonly (string | null)[];
  /** Unit direction per cell, row-major. */
  readonly arrows?: readonly FieldArrow[];
  /** Per-cell arrow opacity, row-major — or one number for all of them. */
  readonly arrowOpacity?: readonly number[] | number;
  /**
   * Per-cell arrow scale, row-major — or one number for all.
   *
   * Lets arrows pop in with overshoot instead of fading. A field of two hundred
   * arrows that simply cross-dissolves reads as a texture change; the same
   * field where each arrow punches to 115% and settles reads as something being
   * built, which is what the beat is claiming.
   */
  readonly arrowScale?: readonly number[] | number;
  readonly arrowTone?: Tone;
  /** Draws a backing panel and border, so the field reads as a viewport. */
  readonly panel?: boolean;
  readonly showGrid?: boolean;
};

/**
 * A grid of cells with optional fills and per-cell direction arrows.
 *
 * The primitive behind every grid-based algorithm: flow fields, A* frontiers,
 * influence maps, fog of war. Cell (x, z) occupies world square
 * [x, x+1] x [z, z+1], so a scene showing it uses `world = {x: [0, cols],
 * y: [0, rows]}` and every other drawable in the scene shares those
 * coordinates — an agent at world (6.5, 8.5) is standing in the middle of cell
 * (6, 8) with no conversion anywhere.
 *
 * Everything renders into ONE `<Layer>`. A 13x16 field is 208 cells, and giving
 * each its own absolutely-positioned SVG — which is what composing it out of
 * `<Vec>` would do — is 208 SVG roots per frame for a picture that is a single
 * path's worth of geometry.
 *
 * The panel matters more than it looks. `gizmo`'s backdrop is a 64px lattice,
 * and a field at any other cell pitch beats against it into moire that reads as
 * a rendering bug. An opaque backing means the field's own grid is the only one
 * visible inside it.
 */
export const Field: React.FC<FieldProps> = ({
  cols,
  rows,
  fills,
  arrows,
  arrowOpacity = 1,
  arrowScale = 1,
  arrowTone = 'text',
  panel = true,
  showGrid = true,
}) => {
  const { colors, draw, shape } = useTheme();
  const space = useSpace();
  const arrowColor = useTone(arrowTone);

  const origin = space.project([0, rows]);   // top-left corner in screen space
  const cell = space.u(1);
  const width = cell * cols;
  const height = cell * rows;

  // Cell centre in screen space. World z counts up, screen y counts down.
  const centre = (x: number, z: number) => ({
    x: origin.x + (x + 0.5) * cell,
    y: origin.y + (rows - z - 0.5) * cell,
  });

  const head = Math.min(draw.arrowHead, cell * 0.34);
  const shaft = cell * 0.58;

  const opacityAt = (i: number): number =>
    typeof arrowOpacity === 'number' ? arrowOpacity : (arrowOpacity[i] ?? 1);
  const scaleAt = (i: number): number =>
    typeof arrowScale === 'number' ? arrowScale : (arrowScale[i] ?? 1);

  return (
    <Layer>
      {panel ? (
        <rect
          x={origin.x}
          y={origin.y}
          width={width}
          height={height}
          /*
            bgAlt, not codeBg. codeBg sits within a few values of the page
            background, so the panel was mathematically present and visually
            absent — the field looked like it was floating loose on the
            backdrop. A lighter fill plus a doubled border makes it a surface
            the diagram sits ON.
          */
          fill={colors.bgAlt}
          stroke={colors.border}
          strokeWidth={shape.borderWidth * 2}
        />
      ) : null}

      {fills
        ? fills.map((color, i) => {
            if (!color) {
              return null;
            }
            const x = i % cols;
            const z = Math.floor(i / cols);
            return (
              <rect
                key={`f${i}`}
                x={origin.x + x * cell}
                y={origin.y + (rows - z - 1) * cell}
                width={cell}
                height={cell}
                fill={color}
                shapeRendering="crispEdges"
              />
            );
          })
        : null}

      {showGrid && draw.gridStyle !== 'none'
        ? [
            ...Array.from({ length: cols + 1 }, (_, x) => (
              <line
                key={`v${x}`}
                x1={origin.x + x * cell}
                y1={origin.y}
                x2={origin.x + x * cell}
                y2={origin.y + height}
                stroke={draw.gridColor}
                strokeWidth={draw.strokeWidth * 0.5}
              />
            )),
            ...Array.from({ length: rows + 1 }, (_, z) => (
              <line
                key={`h${z}`}
                x1={origin.x}
                y1={origin.y + z * cell}
                x2={origin.x + width}
                y2={origin.y + z * cell}
                stroke={draw.gridColor}
                strokeWidth={draw.strokeWidth * 0.5}
              />
            )),
          ]
        : null}

      {arrows
        ? arrows.map((dir, i) => {
            const o = opacityAt(i);
            if (!dir || o <= 0.01) {
              return null;
            }
            const [dx, dz] = dir;
            const len = Math.hypot(dx, dz);
            if (len < 1e-6) {
              return null;
            }
            const k = scaleAt(i);
            if (k <= 0.01) {
              return null;
            }
            // Screen space: +z is up, so the y component flips.
            const ux = dx / len;
            const uy = -dz / len;
            const c = centre(i % cols, Math.floor(i / cols));

            const s = shaft * k;
            const h = head * k;
            const tipX = c.x + ux * s * 0.5;
            const tipY = c.y + uy * s * 0.5;
            const tailX = c.x - ux * s * 0.5;
            const tailY = c.y - uy * s * 0.5;
            const baseX = tipX - ux * h;
            const baseY = tipY - uy * h;
            const nx = -uy;
            const ny = ux;

            return (
              <g key={`a${i}`} opacity={o}>
                <line
                  x1={tailX}
                  y1={tailY}
                  x2={baseX}
                  y2={baseY}
                  stroke={arrowColor}
                  strokeWidth={draw.strokeWidth}
                  strokeLinecap="round"
                />
                <path
                  d={
                    `M ${tipX} ${tipY} ` +
                    `L ${baseX + nx * h * 0.4} ${baseY + ny * h * 0.4} ` +
                    `L ${baseX - nx * h * 0.4} ${baseY - ny * h * 0.4} Z`
                  }
                  fill={arrowColor}
                />
              </g>
            );
          })
        : null}
    </Layer>
  );
};
