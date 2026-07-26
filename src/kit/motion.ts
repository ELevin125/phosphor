import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Gesture, SpringPreset, ThemeGestures } from '../theme';
import { useTheme } from './ThemeContext';

export type { Gesture };
/** The element roles a theme assigns gestures to. */
export type GestureRole = keyof ThemeGestures;

export type MotionPreset = 'enter' | 'pop' | 'soft';

/** Direction an element travels in from, on entrance. */
export type From = 'up' | 'down' | 'left' | 'right' | 'none';

const toSpringConfig = (p: SpringPreset) => ({
  damping: p.damping,
  mass: p.mass,
  stiffness: p.stiffness,
  overshootClamping: p.overshootClamping,
});

/**
 * A 0..1 entrance progress driven by the theme's spring character.
 * Because the preset carries `durationInFrames`, swapping the theme changes
 * how long the motion takes as well as how it feels.
 */
export const useReveal = (opts?: {
  readonly delay?: number;
  readonly preset?: MotionPreset;
}): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const preset = theme.motion[opts?.preset ?? 'enter'];

  return spring({
    frame: quantise(frame, theme.motion.stepFrames),
    fps,
    delay: opts?.delay ?? 0,
    durationInFrames: preset.durationInFrames,
    config: toSpringConfig(preset),
  });
};

/**
 * Snaps a frame number to N-frame steps.
 *
 * Holding each value for several frames is what makes motion read as a console
 * that could not sustain a smooth framerate. Applied at the spring input so it
 * affects position, scale and opacity together — quantising only opacity looks
 * like a bug rather than a choice.
 */
export const quantise = (frame: number, stepFrames: number): number =>
  stepFrames > 1 ? Math.floor(frame / stepFrames) * stepFrames : frame;

/**
 * Constant sub-pixel wobble, PS1 vertex-jitter style.
 *
 * Seeded on the step index, so it is deterministic across re-renders and holds
 * still for the length of a step instead of vibrating every frame.
 */
export const useJitter = (seed: string): { x: number; y: number } => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const { jitterPx, stepFrames } = theme.motion;

  if (jitterPx <= 0) {
    return { x: 0, y: 0 };
  }
  const step = Math.floor(frame / Math.max(1, stepFrames));
  return {
    x: (random(`${seed}-jx-${step}`) - 0.5) * 2 * jitterPx,
    y: (random(`${seed}-jy-${step}`) - 0.5) * 2 * jitterPx,
  };
};

const offsetFor = (from: From, distance: number, progress: number): string => {
  const d = (1 - progress) * distance;
  switch (from) {
    case 'up':
      return `translateY(${-d}px)`;
    case 'down':
      return `translateY(${d}px)`;
    case 'left':
      return `translateX(${-d}px)`;
    case 'right':
      return `translateX(${d}px)`;
    case 'none':
      return 'translateY(0px)';
  }
};

/**
 * The standard entrance style. Use this instead of writing transforms by hand
 * so that every element in every video shares one motion language.
 */
export const useEnterStyle = (opts?: {
  readonly delay?: number;
  readonly preset?: MotionPreset;
  readonly from?: From;
  /** Overrides the theme travel distance. */
  readonly distance?: number;
  /** Stable string so the jitter differs per element but not per frame. */
  readonly seed?: string;
}): React.CSSProperties => {
  const theme = useTheme();
  const progress = useReveal({ delay: opts?.delay, preset: opts?.preset });
  const from = opts?.from ?? 'down';
  const distance = opts?.distance ?? theme.motion.travelPx;
  const scale = interpolate(progress, [0, 1], [theme.motion.enterScale, 1]);
  const jitter = useJitter(opts?.seed ?? 'el');

  return {
    opacity: interpolate(progress, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    transform:
      `translate(${jitter.x}px, ${jitter.y}px) ` +
      `${offsetFor(from, distance, progress)} scale(${scale})`,
  };
};

/**
 * Which spring a gesture wants, unless the caller overrides it.
 *
 * The scaling gestures are the ones that need overshoot to read at all — a pop
 * that stops dead at 1.0 is just a zoom — so they take the punchy preset.
 */
const presetForGesture = (g: Gesture): MotionPreset => {
  switch (g) {
    case 'pop':
    case 'bop':
    case 'stamp':
    case 'snap':
      return 'pop';
    case 'fade':
      return 'soft';
    default:
      return 'enter';
  }
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Builds the transform/opacity/clip for one gesture at progress `p`.
 *
 * `p` comes from a spring, so it can exceed 1 — that overshoot IS the gesture
 * for pop, bop and stamp, and clamping it here would flatten all three back
 * into a plain zoom.
 */
const gestureStyle = (
  g: Gesture,
  p: number,
  travel: number,
  themeScale: number,
): React.CSSProperties => {
  // Most gestures should be fully opaque well before they finish moving,
  // otherwise the fade is all you see and every gesture looks the same.
  const fastFade = clamp01(p * 2);

  switch (g) {
    case 'fade':
      return { opacity: clamp01(p), transform: `scale(${1 - (1 - p) * (1 - themeScale)})` };

    case 'rise':
      return { opacity: fastFade, transform: `translateY(${(1 - p) * travel}px)` };

    case 'drop':
      return { opacity: fastFade, transform: `translateY(${-(1 - p) * travel}px)` };

    case 'slideLeft':
      return { opacity: fastFade, transform: `translateX(${-(1 - p) * travel}px)` };

    case 'slideRight':
      return { opacity: fastFade, transform: `translateX(${(1 - p) * travel}px)` };

    case 'pop':
      return { opacity: fastFade, transform: `scale(${1 - (1 - p) * 0.45})` };

    case 'bop': {
      // Squash and stretch: while it is still rising it is tall and narrow,
      // and it flattens as it lands. The spring overshoot then bounces it.
      const s = 1 - (1 - p) * 0.35;
      const squash = (1 - p) * 0.16;
      return {
        opacity: fastFade,
        transform: `translateY(${(1 - p) * travel * 0.5}px) scale(${s - squash}, ${s + squash})`,
      };
    }

    case 'stamp':
      // Oversized, slamming down toward the viewer. Opacity has to come up
      // even faster or it reads as a zoom-out rather than an impact.
      return { opacity: clamp01(p * 3), transform: `scale(${1 + (1 - p) * 0.45})` };

    case 'unfold':
      return {
        opacity: fastFade,
        transform: `scaleY(${clamp01(p)})`,
        transformOrigin: 'top center',
      };

    case 'swipe':
      return {
        opacity: 1,
        clipPath: `inset(0 ${(1 - clamp01(p)) * 100}% 0 0)`,
      };

    case 'snap':
      // Deliberately not interpolated. One step of oversize, then on.
      return p <= 0
        ? { opacity: 0 }
        : { opacity: 1, transform: `scale(${p < 0.6 ? 1.06 : 1})` };
  }
};

/**
 * The entrance for an element, chosen by its ROLE.
 *
 * Components call this with what they are ('title', 'panel', 'code'…) and the
 * theme decides how that kind of thing arrives. This is the hook to use for
 * anything new; `useEnterStyle` remains for elements that want one specific
 * direction regardless of theme.
 */
export const useGestureStyle = (
  role: GestureRole,
  opts?: {
    readonly delay?: number;
    /** Overrides the theme's gesture for this role. Use sparingly. */
    readonly gesture?: Gesture;
    readonly preset?: MotionPreset;
    readonly seed?: string;
  },
): React.CSSProperties => {
  const theme = useTheme();
  const gesture = opts?.gesture ?? theme.motion.gestures[role];
  const progress = useReveal({
    delay: opts?.delay,
    preset: opts?.preset ?? presetForGesture(gesture),
  });
  const jitter = useJitter(opts?.seed ?? role);

  const base = gestureStyle(
    gesture,
    progress,
    theme.motion.travelPx,
    theme.motion.enterScale,
  );

  return {
    ...base,
    transform: `translate(${jitter.x}px, ${jitter.y}px) ${base.transform ?? ''}`.trim(),
  };
};

/**
 * Staggered delay for the nth item in a list. Uses the theme's stagger so a
 * calm theme spreads items out and a punchy one fires them off quickly.
 */
export const useStagger = (index: number, base = 0): number => {
  const theme = useTheme();
  return base + index * theme.motion.staggerFrames;
};
