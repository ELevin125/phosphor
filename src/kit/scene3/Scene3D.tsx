import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';
import { CAPTION_BAND_BOTTOM, CONTENT } from '../layout';
import { useContentBox } from '../LayoutProfile';
import { SceneInset } from '../scene/Scene';
import { toneColor, type Tone } from '../scene/draw';
import { useTheme } from '../ThemeContext';
import {
  boxWire,
  frustumWire,
  gridWire,
  makeSpace3,
  sphereWire,
  terrainWire,
  type Camera,
  type Space3,
  type Vec3,
  type Wire,
} from './project';

const Space3Context = createContext<Space3 | null>(null);

export const useSpace3 = (): Space3 => {
  const ctx = useContext(Space3Context);
  if (!ctx) {
    throw new Error('3D drawables must be rendered inside a <Scene3D>.');
  }
  return ctx;
};

export type Scene3DProps = {
  readonly camera: Camera;
  readonly children: React.ReactNode;
};

/**
 * A 3D drawing surface, in world units, rendered as SVG wireframe.
 *
 * Not Three.js, and the reason is the theme. Wireframes are lines, and lines go
 * through the same theme tokens as everything else — stroke width, colour, the
 * `gizmo` palette. A WebGL render would take its look from materials and lights
 * instead, so a 3D beat would arrive looking like it came from a different
 * video. It would also need a GL backend in the headless renderer, which is
 * slower and one driver update away from breaking.
 *
 * The limitation to be honest about: there is no occlusion. Everything is drawn,
 * with distant geometry faded. For wireframes that is arguably correct — seeing
 * the back of the box is how you read its shape — but it means this cannot
 * express "the wall hides the enemy". If a video needs that, it needs footage.
 *
 * Reserve it for claims that are genuinely spatial. A 3D picture of a 2D idea is
 * worse than the 2D one.
 */
export const Scene3D: React.FC<Scene3DProps> = ({ camera, children }) => {
  const { bottom: inset } = useContext(SceneInset);

  const box = useContentBox();
  const width = box.width;
  const height = box.height - inset;
  const space = makeSpace3(camera, width, height);

  return (
    <AbsoluteFill style={{ top: 0, left: 0, width, height }}>
      <Space3Context.Provider value={space}>{children}</Space3Context.Provider>
    </AbsoluteFill>
  );
};

/** A full-scene SVG layer, matching the 2D scene's convention. */
export const Layer3: React.FC<{
  readonly children: React.ReactNode;
  readonly opacity?: number;
}> = ({ children, opacity }) => {
  const space = useSpace3();
  return (
    <svg
      width={space.width}
      height={space.height}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity }}
      aria-hidden
    >
      {children}
    </svg>
  );
};

export type WireProps = {
  readonly wire: Wire;
  readonly tone?: Tone;
  readonly opacity?: number;
  /**
   * How strongly distant edges fade, 0..1.
   *
   * Doing the work depth cueing does in a shaded render. Without it a wireframe
   * is genuinely ambiguous — the classic Necker cube, where the eye cannot tell
   * which face is nearer and flips between readings while you watch.
   */
  readonly depthFade?: number;
  readonly strokeScale?: number;
};

/** Draws a wireframe, one path per edge, faded by depth. */
export const WireMesh: React.FC<WireProps> = ({
  wire,
  tone = 'text',
  opacity = 1,
  depthFade = 0.72,
  strokeScale = 1,
}) => {
  const { colors, draw } = useTheme();
  const space = useSpace3();
  const color = toneColor(colors, tone);

  const projected = wire.points.map((p) => space.project(p));
  const depths = projected.filter((p) => p.visible).map((p) => p.depth);
  const near = depths.length ? Math.min(...depths) : 0;
  const far = depths.length ? Math.max(...depths) : 1;
  const range = Math.max(1e-6, far - near);

  return (
    <Layer3 opacity={opacity}>
      {wire.edges.map(([a, b], i) => {
        const pa = projected[a];
        const pb = projected[b];
        // Both ends must be in front of the camera. Clipping a partially
        // visible edge properly is real work for a case this rarely hits, and
        // drawing it unclipped throws a line across the whole frame.
        if (!pa || !pb || !pa.visible || !pb.visible) {
          return null;
        }
        const mid = (pa.depth + pb.depth) / 2;
        const t = (mid - near) / range;
        const o = 1 - depthFade * t;

        return (
          <line
            key={i}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={color}
            strokeWidth={draw.strokeWidth * strokeScale}
            strokeLinecap="round"
            opacity={o}
          />
        );
      })}
    </Layer3>
  );
};

type Shared = Omit<WireProps, 'wire'>;

export const WireGrid: React.FC<
  { readonly size?: number; readonly step?: number; readonly y?: number } & Shared
> = ({ size = 10, step = 1, y = 0, ...rest }) => (
  <WireMesh wire={gridWire(size, step, y)} tone={rest.tone ?? 'muted'} {...rest} />
);

export const WireBox: React.FC<
  { readonly at?: Vec3; readonly size?: number | Vec3 } & Shared
> = ({ at = [0, 0, 0], size = 1, ...rest }) => <WireMesh wire={boxWire(at, size)} {...rest} />;

export const WireSphere: React.FC<
  {
    readonly at?: Vec3;
    readonly r?: number;
    readonly segments?: number;
    readonly rings?: number;
  } & Shared
> = ({ at = [0, 0, 0], r = 1, segments, rings, ...rest }) => (
  <WireMesh wire={sphereWire(at, r, segments, rings)} {...rest} />
);

export const WireTerrain: React.FC<
  {
    readonly size?: number;
    readonly cells?: number;
    readonly height: (x: number, z: number) => number;
  } & Shared
> = ({ size = 10, cells = 14, height, ...rest }) => (
  <WireMesh wire={terrainWire(size, cells, height)} tone={rest.tone ?? 'muted'} {...rest} />
);

export const WireFrustum: React.FC<
  {
    readonly eye: Vec3;
    readonly target?: Vec3;
    readonly fov?: number;
    readonly near?: number;
    readonly far?: number;
    readonly aspect?: number;
  } & Shared
> = ({ eye, target = [0, 0, 0], fov = 40, near = 0.6, far = 4, aspect = 1, ...rest }) => (
  <WireMesh
    wire={frustumWire(eye, target, fov, near, far, aspect)}
    tone={rest.tone ?? 'accentAlt'}
    {...rest}
  />
);

export type Tag3Props = {
  readonly at: Vec3;
  readonly children: React.ReactNode;
  readonly tone?: Tone;
  readonly opacity?: number;
};

/**
 * A label pinned to a point in 3D. The 2D `Tag`'s job, one dimension up: it
 * tracks its point as the camera moves, so the viewer never has to work out
 * which box "the collider" refers to.
 */
export const Tag3: React.FC<Tag3Props> = ({ at, children, tone = 'text', opacity = 1 }) => {
  const { colors, type, draw } = useTheme();
  const space = useSpace3();
  const color = toneColor(colors, tone);
  const p = space.project(at);
  if (!p.visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y - draw.dotRadius,
        transform: 'translate(-50%, -100%)',
        opacity,
        fontFamily: type.mono,
        fontSize: type.size.label,
        fontWeight: type.weightMono,
        letterSpacing: type.letterSpacing.label,
        textTransform: type.labelTransform,
        color,
        whiteSpace: 'nowrap',
        background: colors.bgAlt,
        padding: '6px 14px',
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
};

/** A marker at a 3D point, scaled by distance so depth stays readable. */
export const Dot3: React.FC<{
  readonly at: Vec3;
  readonly tone?: Tone;
  readonly size?: number;
  readonly opacity?: number;
}> = ({ at, tone = 'accent', size = 1, opacity = 1 }) => {
  const { colors, draw } = useTheme();
  const space = useSpace3();
  const color = toneColor(colors, tone);
  const p = space.project(at);
  if (!p.visible) {
    return null;
  }
  // Perspective divide, same as the geometry: a marker drawn at constant pixel
  // size reads as a sticker on the lens rather than an object in the scene.
  const r = (draw.dotRadius * size * 0.5 * space.height) / (p.depth * space.height * 0.06);

  return (
    <Layer3 opacity={opacity}>
      <circle cx={p.x} cy={p.y} r={Math.max(3, r)} fill={color} />
    </Layer3>
  );
};
