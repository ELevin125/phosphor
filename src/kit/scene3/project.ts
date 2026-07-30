/**
 * 3D world space.
 *
 * The same contract as `scene/space.ts` — author in the units of the thing being
 * explained, map to pixels exactly once — with a camera in place of a fit.
 *
 * Right-handed, y UP, which is Unity's convention and therefore the one that
 * matches whatever the viewer has open in another window. Getting this wrong
 * would make every diagram a mirror of the engine it is describing.
 */

export type Vec3 = readonly [number, number, number];

export type Camera = {
  /** Where the camera is, in world units. */
  readonly pos: Vec3;
  /** What it looks at. */
  readonly target?: Vec3;
  /** Vertical field of view in degrees. */
  readonly fov?: number;
  /** World up. Only change it for a deliberately rolled shot. */
  readonly up?: Vec3;
  /**
   * Radius around `target` that must stay in frame. `pos` then supplies only
   * the viewing DIRECTION, and the distance is solved.
   *
   * This is the 3D form of what `makeSpace` does in 2D — the caller describes
   * the thing, not the pixels. Without it every 3D beat starts by guessing a
   * camera distance and re-rendering until the geometry stops falling off the
   * edge, which is exactly the hand-tuning the layout law exists to abolish.
   */
  readonly fit?: number;
};

export type Projected = {
  readonly x: number;
  readonly y: number;
  /** Distance along the view axis. Used for depth fade and painter sorting. */
  readonly depth: number;
  /** False when the point is behind the camera and must not be drawn. */
  readonly visible: boolean;
};

export type Space3 = {
  readonly project: (p: Vec3) => Projected;
  readonly width: number;
  readonly height: number;
  readonly camera: Camera;
  /**
   * Depth range of the whole scene, when the camera declares a `fit`.
   *
   * Every drawable fades against THIS rather than against its own extent, and
   * the difference is not cosmetic. Normalising per-wire means each object gets
   * the full opacity range to itself: a two-point spike is drawn at full
   * brightness whichever way it points, and a ring on the far side of the scene
   * can come out brighter than the near face of the cube. The depth cue then
   * contradicts the geometry, which is exactly when a wireframe stops reading
   * as a solid and the eye starts flipping it inside out.
   *
   * Null when there is no `fit`, since then nothing here knows how big the
   * scene is; callers fall back to per-wire.
   */
  readonly depth: { readonly near: number; readonly far: number } | null;
};

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Builds the world-to-screen projection for a camera and a pixel box.
 *
 * Perspective rather than orthographic by default, because the arguments this
 * exists for — frustums, depth, "the far plane is doing the culling" — are
 * arguments about perspective. An orthographic wireframe of a frustum is a
 * trapezoid with no explanation attached.
 */
export const makeSpace3 = (camera: Camera, width: number, height: number): Space3 => {
  const target = camera.target ?? ([0, 0, 0] as Vec3);
  const up = camera.up ?? ([0, 1, 0] as Vec3);
  const fov = ((camera.fov ?? 40) * Math.PI) / 180;

  // Half-height of the view at unit depth. Width follows from the box aspect,
  // so a tall frame narrows the horizontal view rather than squashing the
  // picture — the same "never distort" rule the 2D scene enforces.
  const tan = Math.tan(fov / 2);
  const aspect = width / height;

  let pos = camera.pos;
  if (camera.fit !== undefined) {
    const dir = norm(sub(camera.pos, target));
    // On a 1080x1920 frame the horizontal half-extent is the smaller of the
    // two, so it is what actually constrains the fit. Solving against the
    // vertical would put the geometry comfortably in frame top to bottom and
    // hanging off both sides.
    const limit = tan * Math.min(1, aspect);
    const dist = camera.fit / Math.max(1e-6, limit);
    pos = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
  }

  // View basis. `forward` points from the camera at the target.
  const forward = norm(sub(target, pos));
  const right = norm(cross(forward, up));
  const trueUp = cross(right, forward);

  // The fit sphere IS the scene's extent — that is what declaring it means —
  // so the depth range follows from it without a second pass over the geometry.
  const dist = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
  const depth =
    camera.fit !== undefined
      ? { near: Math.max(1e-3, dist - camera.fit), far: dist + camera.fit }
      : null;

  return {
    depth,
    project: (p: Vec3): Projected => {
      const rel = sub(p, pos);
      const depth = dot(rel, forward);
      if (depth <= 1e-4) {
        return { x: 0, y: 0, depth, visible: false };
      }
      const sx = dot(rel, right) / (depth * tan);
      const sy = dot(rel, trueUp) / (depth * tan);
      // Screen y grows downward; view y grows upward.
      return {
        x: width / 2 + (sx * height) / 2,
        y: height / 2 - (sy * height) / 2,
        depth,
        visible: true,
      };
    },
    width,
    height,
    camera: { ...camera, pos },
  };
};

// --------------------------------------------------------------- rotation

/**
 * Row-major 3x3. Rotations only — there is no translation or scale here, and
 * deliberately so: a wireframe scene that can shear is a scene where "the box
 * looks wrong" has more than one possible cause.
 */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export const IDENTITY3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const mulMat3 = (a: Mat3, b: Mat3): Mat3 => {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return out as unknown as Mat3;
};

export const applyMat3 = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

export const rotX = (a: number): Mat3 => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [1, 0, 0, 0, c, -s, 0, s, c];
};

export const rotY = (a: number): Mat3 => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};

export const rotZ = (a: number): Mat3 => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

/** Yaw, pitch, roll — in degrees, in that order. */
export type Euler = readonly [yaw: number, pitch: number, roll: number];

/**
 * Euler angles to a matrix, composed `Ry(yaw) · Rx(pitch) · Rz(roll)`.
 *
 * The order is not a detail and it is not arbitrary: it is Unity's, so the
 * pitch axis sits between the other two and reaching 90 on it swings yaw and
 * roll into the same plane. Under a different order a different angle
 * degenerates, and a video about the yaw/roll collapse would be showing
 * something that does not happen in the engine the viewer has open.
 */
export const eulerMat = (e: Euler): Mat3 =>
  mulMat3(rotY(e[0]), mulMat3(rotX(e[1]), rotZ(e[2])));

/**
 * A matrix back to yaw/pitch/roll — the inverse of `eulerMat`.
 *
 * This is the function an inspector calls to fill in three boxes, and it is
 * where the failure actually lives. `eulerMat` is fine: every triple names
 * exactly one orientation. Coming back the other way is not a function at all
 * near pitch ±90, because infinitely many triples produce that matrix, so this
 * has to *pick* one — and the pick is discontinuous, which is why the numbers
 * in the inspector can jump 360 while nothing on screen moves.
 */
/**
 * An angle in (-180, 180], with -180 folded onto +180.
 *
 * Not pedantry. `atan2` picks between -180 and +180 on the SIGN of an argument
 * that is numerically zero, and IEEE floats have both +0 and -0, so a roll
 * sitting at exactly half a turn strobes between "-180" and "180" frame to
 * frame while nothing moves. Half a turn is half a turn; it gets one name.
 */
export const wrapDeg = (a: number): number => {
  const w = a - 360 * Math.floor((a + 180) / 360);
  return w <= -180 + 1e-9 ? 180 : w;
};

export const eulerFrom = (m: Mat3): Euler => {
  const sp = Math.max(-1, Math.min(1, -m[5]));
  const pitch = Math.asin(sp);
  const cp = Math.cos(pitch);

  // Within a thousandth of a degree of the pole there is no yaw/roll split to
  // recover — only their difference survives — so roll is pinned at zero and
  // yaw takes the whole of it. Any other split would be equally correct and
  // this one at least stays put.
  if (Math.abs(cp) < 1e-5) {
    return [wrapDeg(deg(Math.atan2(-m[6], m[0]))), deg(pitch), 0];
  }
  return [
    wrapDeg(deg(Math.atan2(m[2], m[8]))),
    deg(pitch),
    wrapDeg(deg(Math.atan2(m[3], m[4]))),
  ];
};

/**
 * Component-wise interpolation of Euler angles.
 *
 * This is the bug, kept as a first-class function rather than written inline in
 * a video, because it has to be *exactly* what an engine does when it blends
 * two Vector3 rotations — no wrapping, no shortest-arc correction. Adding
 * either would fix the failure the video exists to show.
 */
export const lerpEuler = (a: Euler, b: Euler, t: number): Euler => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** `[x, y, z, w]`, w last — the layout Unity and glTF both use. */
export type Quat = readonly [number, number, number, number];

export const quatFromAxisAngle = (axis: Vec3, angle: number): Quat => {
  const [x, y, z] = norm(axis);
  const h = rad(angle) / 2;
  const s = Math.sin(h);
  return [x * s, y * s, z * s, Math.cos(h)];
};

export const quatMul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/** Same composition order as `eulerMat`, so the two always agree. */
export const quatFromEuler = (e: Euler): Quat =>
  quatMul(
    quatFromAxisAngle([0, 1, 0], e[0]),
    quatMul(quatFromAxisAngle([1, 0, 0], e[1]), quatFromAxisAngle([0, 0, 1], e[2])),
  );

export const quatMat = (q: Quat): Mat3 => {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
};

/**
 * Spherical interpolation, taking the short way round.
 *
 * The sign flip is what makes this the fix rather than a second version of the
 * same bug: `q` and `-q` are the same orientation, so without choosing the
 * nearer of the two the blend can still travel the long arc.
 */
export const slerp = (a: Quat, b: Quat, t: number): Quat => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let end = b;
  if (d < 0) {
    end = [-b[0], -b[1], -b[2], -b[3]];
    d = -d;
  }
  // Near-parallel: sin(theta) goes to zero and the division blows up. A plain
  // lerp is within a rounding error of the arc at this angle anyway.
  if (d > 0.9995) {
    const out: Quat = [
      a[0] + (end[0] - a[0]) * t,
      a[1] + (end[1] - a[1]) * t,
      a[2] + (end[2] - a[2]) * t,
      a[3] + (end[3] - a[3]) * t,
    ];
    const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
    return [out[0] / l, out[1] / l, out[2] / l, out[3] / l];
  }
  const theta = Math.acos(Math.min(1, d));
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return [
    a[0] * wa + end[0] * wb,
    a[1] * wa + end[1] * wb,
    a[2] * wa + end[2] * wb,
    a[3] * wa + end[3] * wb,
  ];
};

/** The single axis a rotation turns about, and by how much, in degrees. */
export const axisAngle = (q: Quat): { readonly axis: Vec3; readonly angle: number } => {
  const w = Math.max(-1, Math.min(1, q[3]));
  const angle = deg(2 * Math.acos(w));
  const s = Math.sqrt(Math.max(0, 1 - w * w));
  // Below this the axis is numerically meaningless — the rotation is nothing,
  // so any axis is as correct as any other and a stable one avoids a flicker.
  if (s < 1e-6) {
    return { axis: [0, 1, 0], angle: 0 };
  }
  return { axis: [q[0] / s, q[1] / s, q[2] / s], angle };
};

/**
 * Angle between two orientations, in degrees — the real distance travelled.
 *
 * The number the whole video turns on. Euler components can swing 360 while
 * this reads half a degree, and only by measuring the orientation rather than
 * the parameters does that gap become visible rather than asserted.
 */
export const angleBetween = (a: Mat3, b: Mat3): number => {
  // trace(Aᵀ B) is the element-wise dot of the two matrices, because
  // (AᵀB)[k][k] = Σᵢ A[i][k]·B[i][k] and summing over k covers every entry.
  let trace = 0;
  for (let i = 0; i < 9; i++) {
    trace += a[i]! * b[i]!;
  }
  return deg(Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))));
};

// ------------------------------------------------------------------ meshes

/** A wireframe: points, plus the pairs of indices joined by an edge. */
export type Wire = {
  readonly points: readonly Vec3[];
  readonly edges: readonly (readonly [number, number])[];
  /**
   * Outward-wound polygons, for shapes that enclose a volume.
   *
   * Optional, and the difference it makes is the whole reason it was added. A
   * wireframe cube with all twelve edges drawn is the Necker cube: the eye
   * genuinely cannot tell which face is nearer and flips between the two
   * readings while you watch, so corners look like they are sticking out when
   * they should be going in. Depth fading only softens that, because it is a
   * heuristic about distance rather than a fact about visibility.
   *
   * With faces, visibility is exact rather than heuristic — for a CONVEX solid,
   * an edge is hidden precisely when both the faces meeting at it point away.
   * Every solid in this kit is convex, so this is not an approximation.
   */
  readonly faces?: readonly (readonly number[])[];
};

/**
 * Which faces point at the camera. `pts` must already be in world space.
 *
 * Newell's method rather than a cross product of two edges, because it is
 * correct for polygons that are not quite planar — the sphere's bands are not,
 * and a cross product picks its answer from whichever two edges it happened to
 * be handed.
 */
export const frontFaces = (wire: Wire, pts: readonly Vec3[], eye: Vec3): boolean[] =>
  (wire.faces ?? []).map((f) => {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pts[f[i]!]!;
      const b = pts[f[(i + 1) % f.length]!]!;
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      cx += a[0];
      cy += a[1];
      cz += a[2];
    }
    const n = f.length;
    return (
      nx * (cx / n - eye[0]) + ny * (cy / n - eye[1]) + nz * (cz / n - eye[2]) < 0
    );
  });

const edgeKey = (a: number, b: number): string => (a < b ? `${a},${b}` : `${b},${a}`);

/** True for each edge that belongs to at least one front-facing polygon. */
export const litEdges = (wire: Wire, front: readonly boolean[]): boolean[] => {
  const faces = wire.faces;
  if (!faces || faces.length === 0) {
    return wire.edges.map(() => true);
  }
  const lit = new Set<string>();
  faces.forEach((f, fi) => {
    if (!front[fi]) {
      return;
    }
    for (let i = 0; i < f.length; i++) {
      lit.add(edgeKey(f[i]!, f[(i + 1) % f.length]!));
    }
  });
  return wire.edges.map(([a, b]) => lit.has(edgeKey(a, b)));
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Axis-aligned box. `size` is full width, not half-extent. */
export const boxWire = (at: Vec3, size: number | Vec3): Wire => {
  const [sx, sy, sz] = typeof size === 'number' ? [size, size, size] : size;
  const h: Vec3 = [sx / 2, sy / 2, sz / 2];
  const points: Vec3[] = [];
  for (const dz of [-1, 1]) {
    for (const dy of [-1, 1]) {
      for (const dx of [-1, 1]) {
        points.push(add(at, [dx * h[0], dy * h[1], dz * h[2]]));
      }
    }
  }
  // Indices are (dz, dy, dx) little-endian, so bit 0 is x, bit 1 is y, bit 2 z.
  const edges: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      const j = i ^ bit;
      if (j > i) {
        edges.push([i, j]);
      }
    }
  }
  // Wound counter-clockwise seen from OUTSIDE, so Newell's normal points out.
  const faces: number[][] = [
    [1, 3, 7, 5], // +x
    [0, 4, 6, 2], // -x
    [2, 6, 7, 3], // +y
    [0, 1, 5, 4], // -y
    [4, 5, 7, 6], // +z
    [0, 2, 3, 1], // -z
  ];
  return { points, edges, faces };
};

/**
 * Latitude/longitude sphere.
 *
 * Deliberately coarse by default. A wireframe sphere at high tessellation reads
 * as a solid grey ball — the lines converge past the point where they describe
 * curvature and start merely filling it in.
 */
export const sphereWire = (at: Vec3, r: number, segments = 12, rings = 6): Wire => {
  const points: Vec3[] = [];
  const edges: [number, number][] = [];
  for (let ring = 1; ring < rings; ring++) {
    const phi = (ring / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      points.push(
        add(at, [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        ]),
      );
    }
  }
  const perRing = segments;
  const ringCount = rings - 1;
  for (let ring = 0; ring < ringCount; ring++) {
    for (let s = 0; s < segments; s++) {
      const i = ring * perRing + s;
      edges.push([i, ring * perRing + ((s + 1) % segments)]);
      if (ring + 1 < ringCount) {
        edges.push([i, (ring + 1) * perRing + s]);
      }
    }
  }
  // Poles.
  const north = points.push(add(at, [0, r, 0])) - 1;
  const south = points.push(add(at, [0, -r, 0])) - 1;
  for (let s = 0; s < segments; s++) {
    edges.push([north, s]);
    edges.push([south, (ringCount - 1) * perRing + s]);
  }
  return { points, edges };
};

/** Flat lattice on the XZ plane — the ground. */
export const gridWire = (size: number, step: number, y = 0): Wire => {
  const points: Vec3[] = [];
  const edges: [number, number][] = [];
  const h = size / 2;
  for (let x = -h; x <= h + 1e-6; x += step) {
    const a = points.push([x, y, -h]) - 1;
    const b = points.push([x, y, h]) - 1;
    edges.push([a, b]);
  }
  for (let z = -h; z <= h + 1e-6; z += step) {
    const a = points.push([-h, y, z]) - 1;
    const b = points.push([h, y, z]) - 1;
    edges.push([a, b]);
  }
  return { points, edges };
};

/**
 * Heightfield on the XZ plane, from a sampler.
 *
 * `cells` is per side, so the wire count is quadratic — 16 is already 544 edges
 * and about as much as reads cleanly at this frame size.
 */
export const terrainWire = (
  size: number,
  cells: number,
  height: (x: number, z: number) => number,
): Wire => {
  const points: Vec3[] = [];
  const edges: [number, number][] = [];
  const step = size / cells;
  const h = size / 2;
  const idx = (i: number, j: number) => i * (cells + 1) + j;

  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j <= cells; j++) {
      const x = -h + j * step;
      const z = -h + i * step;
      points.push([x, height(x, z), z]);
    }
  }
  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j <= cells; j++) {
      if (j < cells) {
        edges.push([idx(i, j), idx(i, j + 1)]);
      }
      if (i < cells) {
        edges.push([idx(i, j), idx(i + 1, j)]);
      }
    }
  }
  return { points, edges };
};

/**
 * A circle about an arbitrary axis — a gimbal ring, an orbit, a turn radius.
 *
 * `span` in degrees makes it an arc instead, which is how a rotation gets drawn
 * as the thing it actually is: one axis and one sweep about it.
 */
export const ringWire = (
  at: Vec3,
  r: number,
  axis: Vec3,
  segments = 48,
  span = 360,
  from = 0,
): Wire => {
  const n = norm(axis);
  // Any vector not parallel to the axis will do for the first basis vector;
  // picking the world axis the normal leans on LEAST keeps the cross product
  // well away from zero.
  const seed: Vec3 =
    Math.abs(n[0]) < Math.abs(n[1]) && Math.abs(n[0]) < Math.abs(n[2])
      ? [1, 0, 0]
      : Math.abs(n[1]) < Math.abs(n[2])
        ? [0, 1, 0]
        : [0, 0, 1];
  const u = norm(cross(n, seed));
  const v = cross(n, u);

  const closed = Math.abs(span) >= 359.999;
  const count = Math.max(3, Math.round((segments * Math.abs(span)) / 360));
  const points: Vec3[] = [];
  const edges: [number, number][] = [];
  const steps = closed ? count : count + 1;
  for (let i = 0; i < steps; i++) {
    const a = ((from + (span * i) / count) * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    points.push([
      at[0] + (u[0] * c + v[0] * s) * r,
      at[1] + (u[1] * c + v[1] * s) * r,
      at[2] + (u[2] * c + v[2] * s) * r,
    ]);
  }
  for (let i = 0; i < steps - 1; i++) {
    edges.push([i, i + 1]);
  }
  if (closed) {
    edges.push([steps - 1, 0]);
  }
  return { points, edges };
};

/** A bare segment. For an axis of rotation, a normal, a reach. */
export const lineWire = (a: Vec3, b: Vec3): Wire => ({ points: [a, b], edges: [[0, 1]] });

/** Merges wires into one mesh, so a composite draws in a single layer. */
export const joinWires = (...wires: readonly Wire[]): Wire => {
  const points: Vec3[] = [];
  const edges: [number, number][] = [];
  for (const w of wires) {
    const base = points.length;
    points.push(...w.points);
    for (const [a, b] of w.edges) {
      edges.push([base + a, base + b]);
    }
  }
  return { points, edges };
};

/** Rotates a wire in place. Composition happens on the matrices, not here. */
export const transformWire = (wire: Wire, m: Mat3): Wire => ({
  points: wire.points.map((p) => applyMat3(m, p)),
  edges: wire.edges,
});

/** A camera's view volume, for arguments about culling and near/far planes. */
export const frustumWire = (
  eye: Vec3,
  target: Vec3,
  fovDeg: number,
  near: number,
  far: number,
  aspect = 1,
): Wire => {
  const forward = norm(sub(target, eye));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tan = Math.tan((fovDeg * Math.PI) / 360);

  const corner = (d: number, sx: number, sy: number): Vec3 => {
    const hh = d * tan;
    const hw = hh * aspect;
    return [
      eye[0] + forward[0] * d + right[0] * sx * hw + up[0] * sy * hh,
      eye[1] + forward[1] * d + right[1] * sx * hw + up[1] * sy * hh,
      eye[2] + forward[2] * d + right[2] * sx * hw + up[2] * sy * hh,
    ];
  };

  const points: Vec3[] = [];
  for (const d of [near, far]) {
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      points.push(corner(d, sx, sy));
    }
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    edges.push([i, (i + 1) % 4]);
    edges.push([4 + i, 4 + ((i + 1) % 4)]);
    edges.push([i, 4 + i]);
  }
  return { points, edges };
};
