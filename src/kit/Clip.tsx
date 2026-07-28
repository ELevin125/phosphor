import React from 'react';
import {
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useGestureStyle } from './motion';
import { PanelDecor } from './PanelDecor';
import { useSurfaceStyle } from './surface';
import { useTheme } from './ThemeContext';

export type ClipProps = {
  /** Path inside `public/`, e.g. `videos/you-vs-ai/clip0.mp4`. */
  readonly src: string;
  /** Small chip overlaid on the clip, e.g. "YOU". */
  readonly label?: string;
  /**
   * FRAMES into the source to start at. Prefer `startSeconds` — every video
   * that has used this wrote `13.5 * 30` with a comment explaining the 30.
   */
  readonly startAt?: number;
  /** Seconds into the source to start at. Converted using the composition fps. */
  readonly startSeconds?: number;
  /**
   * Which part of the frame to keep when the clip is cropped to the panel.
   * `'35% 50%'` biases left — useful when the action sits off-centre.
   */
  readonly objectPosition?: string;
  readonly delay?: number;
  /** Fill the space a Compare/Stack gives it. */
  readonly grow?: boolean;
  /**
   * Lock the panel to a width/height ratio, e.g. `4 / 3`.
   *
   * **Only for a clip sharing the frame with something else.** Setting it on a
   * clip shown alone is what produced the re-crop bug: two consecutive beats
   * with different ratios letterbox the same footage into different-shaped
   * boxes, and a shot that changes shape mid-cut reads as a rendering fault.
   * A lone clip wants `bleed`.
   */
  readonly aspect?: number;
  /**
   * Fill the content box edge to edge, with no panel, border or corner decor.
   *
   * This is the mode footage-led beats actually want, and its absence is why
   * both footage videos bypassed this component for a raw `OffthreadVideo`.
   * A hook shot is not a figure being presented on a surface — it is the
   * picture, and panel chrome around it just makes the frame smaller.
   */
  readonly bleed?: boolean;
  /** Tint colour for the label chip. Defaults to the theme accent. */
  readonly tone?: 'accent' | 'accentAlt';
};

/** Start offset in frames, from whichever unit the caller supplied. */
const trimOf = (
  c: { readonly startAt?: number; readonly startSeconds?: number },
  fps: number,
): number => c.startAt ?? (c.startSeconds !== undefined ? Math.round(c.startSeconds * fps) : 0);

/**
 * A gameplay clip, either full-bleed or in a themed frame.
 *
 * Uses `OffthreadVideo` rather than `Html5Video`: it extracts exact frames via
 * ffmpeg, which is both deterministic under render and the reason the
 * contact-sheet QA loop still works on beats containing video.
 *
 * Audio is always muted — these sit under narration or text, and game audio
 * fighting a voiceover is never what you want.
 */
export const Clip: React.FC<ClipProps> = ({
  src,
  label,
  startAt,
  startSeconds,
  objectPosition = 'center',
  delay = 0,
  grow = true,
  aspect,
  bleed = false,
  tone = 'accent',
}) => {
  const theme = useTheme();
  const { fps } = useVideoConfig();
  const enter = useGestureStyle('media', { delay, seed: label ?? 'clip' });
  const surface = useSurfaceStyle();
  const chipColor = tone === 'accentAlt' ? theme.colors.accentAlt : theme.colors.accent;

  const trim = trimOf({ startAt, startSeconds }, fps);

  return (
    <div
      style={{
        ...(bleed ? {} : enter),
        ...(bleed ? {} : surface),
        position: 'relative',
        overflow: 'hidden',
        // Bleed ignores `aspect` and `grow` entirely: it is defined as "fill the
        // box you were given", and honouring a ratio would reintroduce exactly
        // the letterboxing it exists to avoid.
        flexGrow: bleed ? 1 : aspect ? 0 : grow ? 1 : 0,
        flexBasis: bleed ? 0 : aspect ? 'auto' : grow ? 0 : 'auto',
        aspectRatio: !bleed && aspect ? `${aspect}` : undefined,
        minHeight: 0,
        width: '100%',
      }}
    >
      {bleed ? null : <PanelDecor seed={label ?? src} />}
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={trim}
        volume={0}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          display: 'block',
        }}
      />

      {label ? (
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: 18,
            padding: '10px 20px',
            borderRadius: theme.shape.radiusSm,
            background: theme.colors.bg,
            border: `${theme.shape.borderWidth}px solid ${chipColor}`,
            color: chipColor,
            fontFamily: theme.type.body,
            fontSize: theme.type.size.label,
            fontWeight: 700,
            letterSpacing: theme.type.letterSpacing.label,
            textTransform: theme.type.labelTransform,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export type CompareProps = {
  readonly top: ClipProps;
  readonly bottom: ClipProps;
  readonly gap?: number;
  readonly delay?: number;
};

/**
 * Two clips stacked, for "what you see vs what it sees".
 *
 * Stacked rather than sequential on purpose: the claim being made is about two
 * views of the *same* thing, and cutting between them forces the viewer to hold
 * the first in memory instead of comparing directly.
 */
export const Compare: React.FC<CompareProps> = ({ top, bottom, gap = 16, delay = 0 }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap,
      width: '100%',
      flexGrow: 1,
      flexBasis: 0,
      minHeight: 0,
    }}
  >
    <Clip {...top} delay={top.delay ?? delay} />
    <Clip {...bottom} delay={bottom.delay ?? delay + 4} />
  </div>
);

export type PeelProps = {
  readonly top: Omit<ClipProps, 'label' | 'tone'>;
  readonly bottom: Omit<ClipProps, 'label' | 'tone'>;
  /** Badge for the upper band. Rendered in `accent`. */
  readonly topLabel: string;
  /** Badge for the lower band. Rendered in `accentAlt`. */
  readonly bottomLabel: string;
  /**
   * Frames the lower band takes to wipe up into place. `0` shows both from the
   * first frame. Both clips play from t=0 regardless — the reveal is a mask,
   * never a delay, so no footage is lost to it.
   */
  readonly revealFrames?: number;
};

/**
 * Two clips butted together against one lit seam.
 *
 * The difference from `Compare` is not decoration. `Compare` sets two separate
 * panels with a gap, which reads as two things being presented side by side.
 * Peel removes the gap and the panel edges so the pair reads as ONE frame with
 * its skin pulled back — which is the actual claim when the two clips are the
 * same scene rendered two ways.
 *
 * The badges sit on the seam rather than in the corners, in the two accent
 * colours, because with no panel chrome the seam is the only structure in the
 * frame and labels belong on it.
 */
export const Peel: React.FC<PeelProps> = ({
  top,
  bottom,
  topLabel,
  bottomLabel,
  revealFrames = 24,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Linear, not a spring: this is a mask edge travelling, and an overshooting
  // wipe would expose the band below the frame before snapping back.
  const reveal =
    revealFrames > 0
      ? interpolate(frame, [0, revealFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const band: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    width: '100%',
  };

  const video: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };

  const badge = (color: string, side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [side]: 26,
    color,
    fontFamily: theme.type.display,
    fontSize: theme.type.size.heading,
    fontWeight: theme.type.weightDisplay,
    letterSpacing: theme.type.letterSpacing.display,
    textTransform: theme.type.labelTransform,
    // Two shadows, not one: a tight dark halo to hold the letterforms apart
    // from whatever is behind them, and a wide soft one to sink the footage
    // away underneath. A single shadow either haloes or sinks, never both, and
    // "You" in hot yellow over sunlit yellow terrain needs both.
    textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 6px 32px rgba(0,0,0,0.75)',
    lineHeight: 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        width: '100%',
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 0,
        position: 'relative',
      }}
    >
      <div style={band}>
        <OffthreadVideo
          src={staticFile(top.src)}
          trimBefore={trimOf(top, fps)}
          volume={0}
          style={{ ...video, objectPosition: top.objectPosition ?? 'center' }}
        />
      </div>

      {/*
        Clipped from the BOTTOM, so the band grows downward out of the seam.
        Clipping from the top instead makes it grow up off the bottom edge of
        the frame, which leaves a widening gap under the seam and reads as a
        loading error rather than a reveal.
      */}
      <div style={{ ...band, clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)` }}>
        <OffthreadVideo
          src={staticFile(bottom.src)}
          trimBefore={trimOf(bottom, fps)}
          volume={0}
          style={{ ...video, objectPosition: bottom.objectPosition ?? 'center' }}
        />
      </div>

      {/*
        A soft darkening hugging the seam. Without it the badges are at the
        mercy of the footage — "You" in hot yellow landed on sunlit yellow
        terrain and disappeared. It also does the seam a favour: a bright line
        needs something dark either side of it to read as an edge rather than
        as a scratch on the footage.
      */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 260,
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          opacity: reveal,
          background: `linear-gradient(180deg,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,0.55) 42%,
            rgba(0,0,0,0.62) 50%,
            rgba(0,0,0,0.55) 58%,
            rgba(0,0,0,0) 100%)`,
        }}
      />

      {/* The seam, growing from the centre as the lower band arrives. */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 6,
          transform: `translateY(-50%) scaleX(${reveal})`,
          background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accentAlt})`,
          boxShadow: theme.shape.glow,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 0,
          opacity: reveal,
        }}
      >
        <div style={{ ...badge(theme.colors.accent, 'left'), bottom: 22 }}>
          {topLabel}
        </div>
        <div style={{ ...badge(theme.colors.accentAlt, 'right'), top: 22 }}>
          {bottomLabel}
        </div>
      </div>
    </div>
  );
};
