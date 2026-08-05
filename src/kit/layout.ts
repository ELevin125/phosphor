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
 * Every component reads a resolved profile via `useLayout()`. There used to be
 * a set of module-level portrait constants here as a migration shim; they are
 * gone, because a component that imported one was pinned to a 1080x1920 frame
 * no matter what it was rendered into — which is exactly the bug landscape
 * would hit, silently, in the components that had not been converted yet.
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
  /**
   * Body-text size in px. Every other size is a multiple of it, set by the
   * theme's `type.scale`.
   *
   * Belongs to the profile because it is a fact about the frame, not a design
   * decision: the same theme in a 1080-tall frame needs smaller absolute type
   * than in a 1920-tall one, and which multiple of body a title should be does
   * not change between them. See docs/DECISIONS.md#d010.
   */
  readonly typeBase: number;
  /**
   * Whether videos in this frame burn captions in by default.
   *
   * Portrait does: Reels and Shorts are watched muted, and the band is the
   * whole reason the content box stops where it does. Landscape does not —
   * long-form is watched with sound, YouTube renders its own subtitles from the
   * SRT sidecar (`npm run srt`), and a burned-in band would cost 136px of a
   * frame that is already 44% shorter.
   *
   * This is a DEFAULT, not a prohibition. The band geometry stays defined for
   * both, so a landscape video can still opt in with `showCaptions`.
   */
  readonly usesCaptions: boolean;
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
  /** Body-text size in px, which the theme's ratios are resolved against. */
  readonly typeBase: number;
  /** Default for `Stage`'s `showCaptions`. See the note on ProfileInput. */
  readonly usesCaptions: boolean;
  /**
   * The only rectangle a video's visuals may occupy, WITH the caption band
   * reserved. When captions are off the box extends over the band — call
   * `useContentBox()`, which accounts for that, rather than reading this.
   */
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
    typeBase: i.typeBase,
    usesCaptions: i.usesCaptions,
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
    // 40px is what every shipped short was authored and reviewed at.
    typeBase: 40,
    usesCaptions: true,
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
    /*
      Smaller in absolute terms, because the frame is 44% shorter and the
      viewing context is different — long-form is watched on a bigger screen
      from further away, so type can occupy less of the frame and stay just as
      readable. Anchoring to frame height alone would give 22px, which is too
      small to read on a phone; anchoring to width would give 71px, which is
      absurd. 32px is the practical figure for 1080p video body text.

      UNVERIFIED: no landscape video has been made yet. This is the first
      number to check against the pilot. See docs/STATUS.md.
    */
    typeBase: 32,
    // Long-form ships an SRT sidecar instead — see docs/FORMAT.md. Switching
    // this off returns the band to the content box: 936px tall, not 800.
    usesCaptions: false,
  }),
};

/** The profile assumed by anything that has not been handed one. */
export const DEFAULT_PROFILE: ProfileName = 'portrait';

/**
 * Vertical rhythm unit. Use multiples of this for gaps.
 *
 * Not part of a profile: this is a spacing scale, and 24px is 24px whichever
 * way round the frame is. Making it profile-dependent would rescale every gap
 * in the kit for no reason.
 */
export const SPACE = 24;

export const space = (n: number): number => SPACE * n;
