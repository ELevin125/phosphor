/**
 * World space.
 *
 * Everything drawn in a scene is authored in WORLD UNITS — the units of the
 * thing being explained — and mapped to pixels once, here. Authoring in pixels
 * is what forced every previous video into the same centred column: pixel
 * coordinates only make sense relative to the frame, so the frame becomes the
 * layout. World coordinates make sense relative to each other, so the diagram
 * becomes the layout.
 *
 * y points UP, as it does in every engine and every piece of maths anyone is
 * likely to be explaining. The flip to screen coordinates happens in `project`
 * and nowhere else.
 */

export type Vec2 = readonly [number, number];

/** The rectangle of world space a scene shows. */
export type World = {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
};

export type Space = {
  /** World point to pixels, relative to the scene box. */
  readonly project: (p: Vec2) => { readonly x: number; readonly y: number };
  /** World length to pixels. */
  readonly u: (units: number) => number;
  /** Scene box size in px. */
  readonly width: number;
  readonly height: number;
  readonly world: World;
};

/**
 * Fits `world` inside a `width`x`height` box without distorting it.
 *
 * Uniform scale on both axes is non-negotiable: a circle that renders as an
 * ellipse because the scene was stretched to fill the frame is a lie about the
 * thing being drawn. Excess space is left as margin instead.
 */
export const makeSpace = (world: World, width: number, height: number): Space => {
  const [x0, x1] = world.x;
  const [y0, y1] = world.y;
  const worldW = x1 - x0;
  const worldH = y1 - y0;
  const scale = Math.min(width / worldW, height / worldH);

  // Centre the fitted world box in the scene box.
  const padX = (width - worldW * scale) / 2;
  const padY = (height - worldH * scale) / 2;

  return {
    project: ([wx, wy]: Vec2) => ({
      x: padX + (wx - x0) * scale,
      // Screen y grows downward; world y grows upward.
      y: padY + (y1 - wy) * scale,
    }),
    u: (units: number) => units * scale,
    width,
    height,
    world,
  };
};
