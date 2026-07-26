import type { ThemeDraw } from './types';

/**
 * Drawing defaults for the three original themes (`neon`, `paper`, `brut`).
 *
 * Those three are kept only as comparison points — they are the "too clean"
 * end of the range and are not what any real video uses. Opting them into a
 * shared default means the next time the token interface grows, they cost one
 * line each instead of a full hand-written block. Themes that are actually
 * used should spell every token out; a real theme's drawing style is a design
 * decision, not a fallback.
 */
export const DEFAULT_DRAW: ThemeDraw = {
  strokeWidth: 3,
  dotRadius: 26,
  dotStyle: 'solid',
  trailStyle: 'ghosts',
  trailFade: 0.2,
  gridStyle: 'dots',
  gridColor: 'rgba(128, 128, 128, 0.22)',
  tagStyle: 'plain',
  arrowHead: 26,
};
