import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';

import { useContentBox } from '../LayoutProfile';
import { SceneHeight, SceneInset } from '../scene/Scene';
import { toneColor, type Tone } from '../scene/draw';
import { useTheme } from '../ThemeContext';
import {
  applyMat3,
  boxWire,
  eulerMat,
  frontFaces,
  frustumWire,
  gridWire,
  IDENTITY3,
  litEdges,
  makeSpace3,
  mulMat3,
  ringWire,
  sphereWire,
  terrainWire,
  type Camera,
  type Euler,
  type Mat3,
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

/**
 * The rotation every drawable below this point is subject to.
 *
 * Composed rather than replaced, so nesting `<Rot3>` builds a transform
 * hierarchy — which is the whole reason it exists. A gimbal IS a hierarchy:
 * the pitch ring is bolted to the inside of the yaw ring, so it inherits the
 * yaw rotation and adds its own. Written as nested components the code has the
 * same shape as the mechanism, and the degeneracy at pitch 90 comes out of the
 * composition instead of being animated by hand.
 */
const Xform3Context = createContext<Mat3>(IDENTITY3);

export const useXform3 = (): Mat3 => useContext(Xform3Context);

export type Rot3Props = {
  /** Yaw, pitch, roll in degrees — `Ry·Rx·Rz`, Unity's order. */
  readonly euler?: Euler;
  /** A rotation matrix directly, for anything a quaternion produced. */
  readonly rot?: Mat3;
  readonly children: React.ReactNode;
};

/**
 * Rotates everything inside it, about the scene origin.
 *
 * About the origin and not an arbitrary pivot, on purpose: a rotation with a
 * pivot is really a translation, and letting a video pass one would make
 * "where is this thing" depend on a chain of offsets nobody can hold in their
 * head. Put the object at the origin and move the camera.
 */
export const Rot3: React.FC<Rot3Props> = ({ euler, rot, children }) => {
  const parent = useXform3();
  const local = rot ?? (euler ? eulerMat(euler) : IDENTITY3);
  return (
    <Xform3Context.Provider value={mulMat3(parent, local)}>{children}</Xform3Context.Provider>
  );
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
  // A pane handed down by `<Versus>` has already decided this scene's height;
  // subtracting an inset from the content box again would just undo it. Same
  // rule as the 2D `<Scene>` — see the note beside SceneHeight.
  const fixed = useContext(SceneHeight);

  const box = useContentBox();
  const width = box.width;
  const height = fixed ?? box.height - inset;
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
  /**
   * What to do with edges the solid's own body hides. Ignored without `faces`.
   *
   * `dim` keeps the wireframe honest — you can still see the back of the box,
   * which is how you read its shape — while making it unmistakable which half
   * is which. `hide` is true hidden-line removal, for when the shape has to be
   * unambiguous at a glance. `show` is the old behaviour, and the reason a cube
   * used to turn itself inside out.
   */
  readonly backfaces?: 'dim' | 'hide' | 'show';
};

/** Draws a wireframe, one path per edge, faded by depth. */
export const WireMesh: React.FC<WireProps> = ({
  wire,
  tone = 'text',
  opacity = 1,
  depthFade = 0.72,
  strokeScale = 1,
  backfaces = 'dim',
}) => {
  const { colors, draw } = useTheme();
  const space = useSpace3();
  const rot = useXform3();
  const color = toneColor(colors, tone);

  const world = wire.points.map((p) => applyMat3(rot, p));
  const projected = world.map((p) => space.project(p));

  /*
    Fade against the SCENE's depth range when the camera declares a fit, and
    only fall back to this wire's own extent when it does not. Per-wire was the
    bug: it hands every object the full opacity ramp to itself, so a two-point
    spike is drawn at full brightness whichever way it points, and a far ring
    outshines the near face of the cube it is supposed to be behind.
  */
  const visible = projected.filter((p) => p.visible).map((p) => p.depth);
  const near = space.depth ? space.depth.near : visible.length ? Math.min(...visible) : 0;
  const far = space.depth ? space.depth.far : visible.length ? Math.max(...visible) : 1;
  const range = Math.max(1e-6, far - near);

  const lit =
    wire.faces && backfaces !== 'show'
      ? litEdges(wire, frontFaces(wire, world, space.camera.pos))
      : null;

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
        const hidden = lit ? !lit[i] : false;
        if (hidden && backfaces === 'hide') {
          return null;
        }
        const mid = (pa.depth + pb.depth) / 2;
        const t = Math.max(0, Math.min(1, (mid - near) / range));
        const o = (1 - depthFade * t) * (hidden ? 0.22 : 1);

        return (
          <line
            key={i}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={color}
            strokeWidth={draw.strokeWidth * strokeScale * (hidden ? 0.8 : 1)}
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

/**
 * A circle about an arbitrary axis — a gimbal ring, an orbit, a sweep.
 *
 * `span` under 360 makes it an arc, which is how an axis-angle rotation gets
 * drawn as what it is: one axis, one sweep about it. That picture is the entire
 * argument for a quaternion, and it cannot be composed from a box or a sphere.
 */
export const WireRing: React.FC<
  {
    readonly at?: Vec3;
    readonly r?: number;
    /** Normal of the plane the circle lies in. */
    readonly axis?: Vec3;
    readonly segments?: number;
    /** Degrees swept. Under 360 draws an arc. */
    readonly span?: number;
    /** Where the sweep starts, in degrees about the axis. */
    readonly from?: number;
  } & Shared
> = ({ at = [0, 0, 0], r = 1, axis = [0, 1, 0], segments = 64, span = 360, from = 0, ...rest }) => (
  <WireMesh wire={ringWire(at, r, axis, segments, span, from)} {...rest} />
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
  const rot = useXform3();
  const color = toneColor(colors, tone);
  const p = space.project(applyMat3(rot, at));
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
  const rot = useXform3();
  const color = toneColor(colors, tone);
  const p = space.project(applyMat3(rot, at));
  if (!p.visible) {
    return null;
  }

  /*
    Perspective divide, same as the geometry: a marker drawn at constant pixel
    size reads as a sticker on the lens rather than an object in the scene.

    Scaled so a dot sitting AT the camera's target renders at `dotRadius`. The
    previous version divided by a bare 0.06 with no relation to anything, which
    made the size depend on how far away the camera happened to have been
    solved to — dots came out roughly twice too big in a tight frame and read
    as thumbtacks stuck through the object rather than as points on it.
  */
  const target = space.camera.target ?? ([0, 0, 0] as Vec3);
  const pos = space.camera.pos;
  const dist = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
  /*
    A fraction of `dotRadius`, not all of it. That token sizes the 2D `Dot`,
    where the dot IS the agent and has to carry the frame on its own; here it
    marks a point on something larger, and at full size it stops being a marker
    and becomes a bead stuck through the geometry.
  */
  const r = (draw.dotRadius * 0.4 * size * dist) / Math.max(1e-3, p.depth);

  // A dot on the far side has to recede with everything else, or it reads as
  // being in front of geometry it is actually behind.
  const fade = space.depth
    ? 1 -
      0.55 *
        Math.max(0, Math.min(1, (p.depth - space.depth.near) / (space.depth.far - space.depth.near)))
    : 1;

  return (
    <Layer3 opacity={opacity * fade}>
      <circle cx={p.x} cy={p.y} r={Math.max(2, r)} fill={color} />
    </Layer3>
  );
};
