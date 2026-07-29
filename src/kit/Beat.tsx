import React, { createContext, useContext } from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTION_BAND_BOTTOM, CONTENT } from './layout';
import { quantise } from './motion';
import { useTheme } from './ThemeContext';

/** Timing for one beat, produced from `beats.yaml`. */
export type BeatTiming = {
  readonly id: string;
  readonly durationInFrames: number;
  /** The narration line. Present from day one, before any audio exists. */
  readonly vo: string;
};

type BeatContextValue = {
  readonly durationInFrames: number;
  readonly id: string;
  /** Frames the beat overhangs its slot by, used for the crossfade. */
  readonly overlap: number;
  /**
   * The beat's start frame in the composition.
   *
   * Sequence shifts `useCurrentFrame()` to zero for its children, which is
   * usually what you want — but a simulation that restarts at every beat
   * boundary turns a continuous scene back into a slideshow. Adding this back
   * gives composition time, so a scene can keep running while only its
   * annotations change.
   */
  readonly start: number;
};

/**
 * Whether the caption band is reserved. With captions off there is no band to
 * protect, so beats reclaim it rather than leaving 30% of the frame empty.
 */
export const LayoutContext = createContext<{ readonly captionBand: boolean }>({
  captionBand: true,
});

const BeatContext = createContext<BeatContextValue | null>(null);

/**
 * Supplies beat timing to components that need it (`CodeReveal` spreads its
 * line reveal over the beat length, for instance). `<Timeline>` and `<Board>`
 * both wrap their children in one — any layout that hosts kit components has
 * to provide this or they will throw.
 */
export const BeatProvider: React.FC<{
  readonly value: BeatContextValue;
  readonly children: React.ReactNode;
}> = ({ value, children }) => (
  <BeatContext.Provider value={value}>{children}</BeatContext.Provider>
);

/** Lets a component know how long the beat it lives in lasts. */
export const useBeat = (): BeatContextValue => {
  const ctx = useContext(BeatContext);
  if (!ctx) {
    throw new Error('Kit components must be rendered inside a <Beat>.');
  }
  return ctx;
};

/** Frames a wipe sweep takes, derived from the theme's entrance duration. */
const wipeDuration = (enterFrames: number): number =>
  Math.max(2, Math.round(enterFrames * 0.6));

export type BeatAlign = 'center' | 'top' | 'bottom';

export type BeatProps = {
  /** Must match an `id` in the video's beats. Timing is looked up from it. */
  readonly id: string;
  readonly align?: BeatAlign;
  readonly children: React.ReactNode;
};

const justifyFor = (align: BeatAlign) =>
  align === 'top' ? 'flex-start' : align === 'bottom' ? 'flex-end' : 'center';

/**
 * One beat of the video.
 *
 * Duration comes from the beats table on `<Stage>`, matched by `id` — never
 * hardcoded here. The beat fades itself out at the end so beats never hard-cut
 * into one another, and it constrains its children to the legal content box.
 */
export const Beat: React.FC<BeatProps> = ({ id, align = 'center', children }) => {
  const { durationInFrames, overlap } = useBeat();
  const { captionBand } = useContext(LayoutContext);
  const theme = useTheme();
  const rawFrame = useCurrentFrame();
  const frame = quantise(rawFrame, theme.motion.stepFrames);

  /**
   * A hard edge sweeping the beat in, instead of a dissolve. Reads as a game
   * UI transition rather than a slideshow — and because it is a clip rather
   * than an opacity ramp, the incoming beat is fully opaque the whole way, so
   * it never ghosts against the outgoing one.
   */
  const isWipe = theme.motion.transition === 'wipe';
  const wipeFrames = wipeDuration(theme.motion.enter.durationInFrames);
  const wipe = isWipe
    ? interpolate(frame, [0, wipeFrames], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 100;

  // Fade out during the OVERHANG, past the end of the slot. The next beat has
  // already started underneath by then, so cuts never flash empty.
  //
  // The curve is squared rather than linear. A linear dissolve leaves both
  // beats near half opacity in the middle of the overlap, which reads as two
  // layouts stacked on top of each other rather than as a transition. Squaring
  // drops the outgoing beat to ~25% by the halfway point, so the overlap
  // covers the gap without ever looking like a double exposure.
  const t = interpolate(
    frame,
    [durationInFrames, durationInFrames + overlap],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // A wipe COVERS the outgoing beat rather than dissolving it. Fading it as
  // well would leave a gap: the incoming beat is still clipped to nothing at
  // the moment the outgoing one has finished fading.
  const opacity = isWipe ? 1 : (1 - t) * (1 - t);

  const bottom = captionBand ? CONTENT.bottom : CAPTION_BAND_BOTTOM;

  return (
    <AbsoluteFill
      style={{
        opacity,
        top: CONTENT.top,
        left: CONTENT.left,
        width: CONTENT.width,
        height: bottom - CONTENT.top,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: justifyFor(align),
          alignItems: 'stretch',
          gap: 32,
          clipPath: wipe < 100 ? `inset(0 ${100 - wipe}% 0 0)` : undefined,
        }}
      >
        {children}
      </div>

      {/*
        A bright leading edge on the sweep. Without it, mid-wipe reads as two
        layouts torn together — especially when consecutive beats look alike.
        The bar is outside the clip so it is never cut by its own wipe.
      */}
      {isWipe && wipe > 0 && wipe < 100 ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${wipe}%`,
            width: 6,
            background: theme.colors.accent,
            boxShadow: theme.shape.glow,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Lays beats out back to back. Each `<Beat id>` child is matched to its timing
 * and wrapped in a `<Sequence>` at the right offset, so video files never
 * compute a frame number by hand.
 */
export const Timeline: React.FC<{
  readonly beats: readonly BeatTiming[];
  readonly children: React.ReactNode;
}> = ({ beats, children }) => {
  const theme = useTheme();
  // A wipe must overlap for as long as the sweep takes, or the outgoing beat
  // vanishes before the incoming one has covered it. A dissolve wants the
  // opposite: long overlaps ghost, so cap it at six frames (0.2s).
  const overlap =
    theme.motion.transition === 'wipe'
      ? wipeDuration(theme.motion.enter.durationInFrames)
      : Math.min(theme.motion.fadeFrames, 6);
  let offset = 0;

  return (
    <>
      {React.Children.toArray(children).map((child) => {
        if (!React.isValidElement<BeatProps>(child)) {
          return child;
        }

        const { id } = child.props;
        const timing = beats.find((b) => b.id === id);
        if (!timing) {
          throw new Error(
            `<Beat id="${id}"> has no timing. Add it to beats.yaml and re-run 'npm run build-beats'.`,
          );
        }

        const from = offset;
        offset += timing.durationInFrames;

        return (
          <Sequence
            key={id}
            name={id}
            from={from}
            durationInFrames={timing.durationInFrames + overlap}
          >
            <BeatContext.Provider
              value={{ durationInFrames: timing.durationInFrames, id, overlap, start: from }}
            >
              {child}
            </BeatContext.Provider>
          </Sequence>
        );
      })}
    </>
  );
};

/** The current beat's start frame, or 0 outside a beat. Never throws. */
export const useBeatStart = (): number => useContext(BeatContext)?.start ?? 0;

/**
 * How far through the current beat we are, 0..1.
 *
 * Every video that animates anything needs this, and before it lived here
 * three of them had defined it locally — identically, which is the good case.
 * The bad case is the one this prevents: a fourth video defining it slightly
 * differently, and a timing bug that only reproduces in one file.
 *
 * Clamped, because a beat's children can be mounted a frame either side of its
 * range during a transition and animations driven past 1 snap back.
 */
export const useBeatProgress = (): number => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useBeat();
  return Math.max(0, Math.min(1, frame / durationInFrames));
};

/**
 * Seconds since this beat started.
 *
 * For anything with a real rate — a simulation step, a countdown — where
 * progress through the beat is the wrong clock and wall time is the right one.
 */
export const useBeatSeconds = (): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const totalDuration = (beats: readonly BeatTiming[]): number =>
  beats.reduce((sum, b) => sum + b.durationInFrames, 0);
