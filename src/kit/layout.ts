/**
 * The layout law for every video. Nothing in `projects` may position by hand;
 * these numbers exist so that "will this collide with the TikTok UI?" is a
 * question the kit has already answered.
 *
 * Canvas is 1080x1920. All values are px in that space.
 */

export const CANVAS = { width: 1080, height: 1920 } as const;

/**
 * Platform UI safe areas. Instagram Reels and YouTube Shorts both overlay
 * chrome here — the top bar and the caption/handle/action-button cluster.
 */
export const SAFE = {
  /** ~12% of height. Profile pill, "Reels" label, back button. */
  top: Math.round(CANVAS.height * 0.12), // 230
  /** ~20% of height. Description, handle, sound, right-hand action rail. */
  bottom: Math.round(CANVAS.height * 0.2), // 384
  /**
   * The right-hand action rail (like / comment / share). It only physically
   * overlaps the lower half of the frame, but reserving it for the full height
   * keeps the content box a plain rectangle — much easier to reason about than
   * an L-shape, and the cost is ~10% of the width.
   */
  right: 108,
  left: 108,
} as const;

/**
 * Horizontal padding for all content. Matches `SAFE.right` so the content box
 * is symmetric AND clear of the action rail — if this drops below `SAFE.right`,
 * content starts colliding with the platform UI in the lower third.
 */
export const GUTTER = 108;

/**
 * The reserved caption band. Burned-in captions live here and ONLY here.
 * Code and graphics may never enter it — `contentBox` stops above it.
 */
export const CAPTION_BAND = {
  height: 176,
  /** Gap between the bottom of the content area and the top of the band. */
  gapAbove: 24,
} as const;

export const CAPTION_BAND_TOP = CANVAS.height - SAFE.bottom - CAPTION_BAND.height; // 1360
export const CAPTION_BAND_BOTTOM = CAPTION_BAND_TOP + CAPTION_BAND.height; // 1536

/**
 * The only rectangle a video's visuals may occupy.
 * x: 72..1008, y: 230..1336
 */
export const CONTENT = {
  top: SAFE.top,
  bottom: CAPTION_BAND_TOP - CAPTION_BAND.gapAbove,
  left: GUTTER,
  right: CANVAS.width - GUTTER,
  get width() {
    return this.right - this.left;
  },
  get height() {
    return this.bottom - this.top;
  },
} as const;

/** Vertical rhythm unit. Use multiples of this for gaps. */
export const SPACE = 24;

export const space = (n: number): number => SPACE * n;
