import React from 'react';
import { interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
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
   * Frames into the source clip to start at. Lets successive beats show
   * different moments instead of replaying the same opening every time.
   */
  readonly startAt?: number;
  /**
   * Which part of the frame to keep when the clip is cropped to the panel.
   * `'35% 50%'` biases left — useful when the action sits off-centre.
   */
  readonly objectPosition?: string;
  readonly delay?: number;
  /** Fill the space a Compare/Stack gives it. */
  readonly grow?: boolean;
  /**
   * Lock the panel to a width/height ratio, e.g. `4 / 3`. Use for a clip shown
   * on its own: letting a 16:9 source fill a tall panel crops it to ribbons.
   */
  readonly aspect?: number;
  /** Tint colour for the label chip. Defaults to the theme accent. */
  readonly tone?: 'accent' | 'accentAlt';
};

/**
 * A gameplay clip in a themed frame.
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
  startAt = 0,
  objectPosition = 'center',
  delay = 0,
  grow = true,
  aspect,
  tone = 'accent',
}) => {
  const theme = useTheme();
  const enter = useGestureStyle('media', { delay, seed: label ?? 'clip' });
  const surface = useSurfaceStyle();
  const chipColor = tone === 'accentAlt' ? theme.colors.accentAlt : theme.colors.accent;

  return (
    <div
      style={{
        ...enter,
        ...surface,
        position: 'relative',
        overflow: 'hidden',
        flexGrow: aspect ? 0 : grow ? 1 : 0,
        flexBasis: aspect ? 'auto' : grow ? 0 : 'auto',
        aspectRatio: aspect ? `${aspect}` : undefined,
        minHeight: 0,
        width: '100%',
      }}
    >
      <PanelDecor seed={label ?? src} />
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={startAt}
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
          trimBefore={top.startAt ?? 0}
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
          trimBefore={bottom.startAt ?? 0}
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
