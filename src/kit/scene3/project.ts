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
  /** Near/far depths across the drawn geometry, for normalising depth fade. */
  readonly camera: Camera;
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

  return {
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

// ------------------------------------------------------------------ meshes

/** A wireframe: points, plus the pairs of indices joined by an edge. */
export type Wire = {
  readonly points: readonly Vec3[];
  readonly edges: readonly (readonly [number, number])[];
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
  return { points, edges };
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
