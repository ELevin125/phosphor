/**
 * The layout law for every video. Nothing in `projects` may position by hand;
 * these numbers exist so that "will this collide with the TikTok UI?" is a
 * question the kit has already answered.
 *
 * There are two canvases now, not one. `portrait` is 1080x1920 for Reels and
 * Shorts; `landscape` is 1920x1080 for long-form on YouTube, where none of the
 * portrait numbers mean anything — there is no right-hand action rail to dodge,
 * the chrome sits somewhere else entirely, and a caption band sized for a tall
 * frame eats a sixth of a short one.
 *
 * A profile is a complete set of bounds, derived from four inputs by one
 * function, so the two cannot drift in HOW they are computed — only in what
 * they are computed from. Everything else in the kit reads a resolved profile
 * rather than the module-level constants.
 *
 * The module-level exports at the bottom are the portrait profile, unchanged,
 * and exist so the migration can happen one component at a time.
 */

export type ProfileName = 'portrait' | 'landscape';

/** The four numbers a profile is actually configured with. */
type ProfileInput = {
  readonly width: number;
  readonly height: number;
  /** Platform chrome to keep clear of, top and bottom. */
  readonly safeTop: number;
  readonly safeBottom: number;
  /** Horizontal padding. In portrait this also clears the action rail. */
  readonly gutter: number;
  /** Height of the burned-in caption band. */
  readonly captionHeight: number;
  /** Gap between the bottom of the content area and the top of the band. */
  readonly captionGap: number;
  /**
   * Longest caption phrase, in characters.
   *
   * Belongs to the profile because it is a width budget, not a style: the same
   * 48px face in a 1728px landscape band fits roughly twice what it fits in an
   * 864px portrait one. Three of the ten themes render captions uppercase,
   * which is ~15% wider, so each figure is set for the worst case rather than
   * the average.
   */
  readonly captionMaxChars: number;
};

export type Layout = {
  readonly name: ProfileName;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly safe: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
  };
  readonly gutter: number;
  readonly captionBand: { readonly height: number; readonly gapAbove: number };
  readonly captionBandTop: number;
  readonly captionBandBottom: number;
  readonly captionMaxChars: number;
  /** The only rectangle a video's visuals may occupy. */
  readonly content: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly width: number;
    readonly height: number;
  };
};

const derive = (name: ProfileName, i: ProfileInput): Layout => {
  const captionBandTop = i.height - i.safeBottom - i.captionHeight;
  const content = {
    top: i.safeTop,
    bottom: captionBandTop - i.captionGap,
    left: i.gutter,
    right: i.width - i.gutter,
  };
  return {
    name,
    canvas: { width: i.width, height: i.height },
    safe: { top: i.safeTop, bottom: i.safeBottom, left: i.gutter, right: i.gutter },
    gutter: i.gutter,
    captionBand: { height: i.captionHeight, gapAbove: i.captionGap },
    captionBandTop,
    captionBandBottom: captionBandTop + i.captionHeight,
    captionMaxChars: i.captionMaxChars,
    content: {
      ...content,
      width: content.right - content.left,
      height: content.bottom - content.top,
    },
  };
};

export const PROFILES: Record<ProfileName, Layout> = {
  /*
    Reels and Shorts. safeTop is ~12% of height (profile pill, "Reels" label,
    back button) and safeBottom ~20% (description, handle, sound, and the
    right-hand action rail).

    The gutter matches what the action rail needs horizontally. The rail only
    physically overlaps the lower half of the frame, but reserving it full
    height keeps the content box a plain rectangle rather than an L-shape, and
    costs ~10% of the width.
  */
  portrait: derive('portrait', {
    width: 1080,
    height: 1920,
    safeTop: 230,
    safeBottom: 384,
    gutter: 108,
    captionHeight: 176,
    captionGap: 24,
    captionMaxChars: 52,
  }),

  /*
    Long-form on YouTube. There is no action rail and no persistent overlay, so
    the gutter is padding rather than clearance and the frame can be used much
    harder — 5% a side instead of 10%.

    safeBottom clears the player's control bar and progress scrubber, which sit
    over the video whenever the viewer moves the mouse. safeTop is small: the
    only thing up there is the title on hover.

    The caption band is shorter in absolute terms and much shorter as a fraction
    of the frame: 176px is 9% of a 1920-tall canvas but 16% of a 1080-tall one,
    which reads as a letterbox rather than a band. It is also nearly twice as
    wide, so one line holds what took two in portrait.
  */
  landscape: derive('landscape', {
    width: 1920,
    height: 1080,
    safeTop: 48,
    safeBottom: 96,
    gutter: 96,
    captionHeight: 112,
    captionGap: 24,
    captionMaxChars: 104,
  }),
};

/** The profile assumed by anything that has not been handed one. */
export const DEFAULT_PROFILE: ProfileName = 'portrait';

// --- portrait constants ------------------------------------------------------
// The original module-level API, derived from the portrait profile so the two
// cannot disagree. Components are being migrated to `useLayout()`; until that
// is finished these keep every existing call site working unchanged.

const P = PROFILES.portrait;

export const CANVAS = P.canvas;
export const SAFE = P.safe;
export const GUTTER = P.gutter;
export const CAPTION_BAND = P.captionBand;
export const CAPTION_BAND_TOP = P.captionBandTop; // 1360
export const CAPTION_BAND_BOTTOM = P.captionBandBottom; // 1536
/** x: 108..972, y: 230..1336 */
export const CONTENT = P.content;

/**
 * Vertical rhythm unit. Use multiples of this for gaps.
 *
 * Not part of a profile: this is a spacing scale, and 24px is 24px whichever
 * way round the frame is. Making it profile-dependent would rescale every gap
 * in the kit for no reason.
 */
export const SPACE = 24;

export const space = (n: number): number => SPACE * n;
