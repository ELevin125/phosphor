import { loadFont as loadDisplay } from '@remotion/google-fonts/Jost';
import { loadFont as loadBody } from '@remotion/google-fonts/Outfit';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import type { Theme } from './types';

/**
 * Nightdrive — midnight's palette with the motion rebuilt.
 *
 * Everything visual is inherited from `midnight` deliberately: same navy base,
 * same cyan headlight bloom, same hot yellow accent, same hairline Jost. What
 * changes is timing and drawing.
 *
 * midnight's springs run 20-30 frames and every element fades in. That reads as
 * elegant, and elegant reads as corporate — it is the exact complaint that
 * produced the garage/debugview/ps1/cosmic line. So this theme keeps the look
 * and takes the later motion character: 8-12 frame springs, gestures that scale
 * and wipe rather than drift, and a camera that overshoots.
 *
 * `midnight` is left untouched so anything already rendered through it does not
 * move.
 *
 * The original description follows, because the palette reasoning still holds.
 *
 * Midnight — 90s anime night drive, frosted glass panels.
 *
 * Semi-dark rather than black: a cool desaturated navy base lit by a cyan
 * headlight bloom and a warm sodium glow near the horizon. One hot yellow
 * accent does all the emphasis work against an otherwise cold palette.
 *
 * Display type is deliberately thin and wide — the opposite of the heavy
 * grotesques the other themes use. The weight contrast between hairline
 * headings and solid mono code is a large part of the look.
 */
export const nightdrive: Theme = {
  name: 'nightdrive',
  description: "Midnight's palette, punchy motion. Frosted glass on cool navy, hot yellow accent, nothing drifts.",
  shikiTheme: 'poimandres',

  colors: {
    bg: '#0D131F',
    bgAlt: 'rgba(255, 255, 255, 0.04)',
    // Panels are translucent white, not solid — the backdrop shows through.
    surface: 'rgba(150, 180, 222, 0.14)',
    codeBg: 'rgba(9, 15, 26, 0.66)',
    border: 'rgba(200, 220, 248, 0.26)',
    text: '#EDF3FF',
    textMuted: '#93A6C4',
    accent: '#F5E14F',
    accentAlt: '#7CD9FF',
    positive: '#63DCA8',
    negative: '#FF7D8F',
    diffAddBg: 'rgba(99, 220, 168, 0.16)',
    diffRemoveBg: 'rgba(255, 125, 143, 0.14)',
    dimOpacity: 0.46,
    highlightBg: 'rgba(245, 225, 79, 0.14)',
  },

  backdrop: {
    // Layered radial glows over a navy base: cyan headlight from the lower
    // right, a colder moonlit patch top-left, warm sodium haze at the horizon.
    css: `
      radial-gradient(120% 70% at 78% 88%, rgba(124, 217, 255, 0.28) 0%, rgba(124, 217, 255, 0) 55%),
      radial-gradient(90% 55% at 12% 12%, rgba(122, 158, 214, 0.22) 0%, rgba(122, 158, 214, 0) 60%),
      radial-gradient(140% 45% at 50% 58%, rgba(233, 168, 92, 0.10) 0%, rgba(233, 168, 92, 0) 70%),
      linear-gradient(168deg, #162034 0%, #0D131F 45%, #070B13 100%)
    `,
    grain: 0.16,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield: this theme's backdrop carries its own texture.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  glass: {
    enabled: true,
    blurPx: 26,
    saturate: 1.35,
    hairline: 'rgba(255, 255, 255, 0.30)',
  },

  decor: {
    kind: 'none',
    glyphs: [],
    color: 'transparent',
    opacity: 0,
    fontFamily: null,
    frequency: 0,
  },

  crt: {
    enabled: false,
    pixelSize: 0,
    posterizeLevels: 0,
    scanlineOpacity: 0,
    scanlineHeight: 4,
    apertureOpacity: 0,
    vignette: 0,
    ditherOpacity: 0,
  },

  type: {
    display: '"Jost", system-ui, sans-serif',
    body: '"Outfit", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    // Hairline display weight is the signature; body stays light too.
    weightDisplay: 300,
    weightBody: 300,
    weightMono: 500,
    size: {
      title: 112,
      subtitle: 50,
      heading: 74,
      body: 46,
      code: 40,
      label: 28,
      caption: 56,
    },
    lineHeight: { tight: 1.02, normal: 1.4, code: 1.66 },
    letterSpacing: { display: '-0.01em', body: '0.005em', label: '0.26em' },
    labelTransform: 'uppercase',
  },

  shape: {
    radiusSm: 12,
    radiusMd: 28,
    radiusLg: 40,
    borderWidth: 1,
    shadow: '0 28px 70px rgba(3, 7, 15, 0.55)',
    shadowStrong: '0 40px 110px rgba(3, 7, 15, 0.72)',
    glow: '0 0 56px rgba(245, 225, 79, 0.30)',
  },

  draw: {
    // Brighter and harder-edged than midnight's: stamped ghosts rather than a
    // continuous line, so history reads as discrete updates.
    strokeWidth: 3,
    dotRadius: 26,
    dotStyle: 'solid',
    trailStyle: 'ghosts',
    trailFade: 0.16,
    gridStyle: 'dots',
    gridColor: 'rgba(200, 220, 248, 0.2)',
    tagStyle: 'plain',
    arrowHead: 26,
  },

  motion: {
    // Short and slightly overshooting. Nothing here takes longer than a third
    // of a second, so the video never waits on an animation.
    enter: { damping: 15, mass: 0.8, stiffness: 230, overshootClamping: false, durationInFrames: 10 },
    pop: { damping: 11, mass: 0.55, stiffness: 310, overshootClamping: false, durationInFrames: 8 },
    soft: { damping: 21, mass: 1, stiffness: 140, overshootClamping: false, durationInFrames: 15 },
    fadeFrames: 4,
    staggerFrames: 2,
    travelPx: 46,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.92,
    gestures: {
      title: 'stamp',
      panel: 'bop',
      code: 'swipe',
      callout: 'pop',
      label: 'snap',
      media: 'unfold',
    },
    camera: { damping: 17, mass: 0.9, stiffness: 200, overshootClamping: false, durationInFrames: 15 },
  },

  captions: {
    color: '#FFFFFF',
    bg: 'rgba(13, 19, 31, 0.42)',
    activeColor: '#F5E14F',
    weight: 500,
    radius: 22,
    paddingX: 32,
    paddingY: 16,
    letterSpacing: '0.01em',
    textTransform: 'none',
    textShadow: '0 2px 18px rgba(0, 0, 0, 0.75)',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['200', '300'], subsets: ['latin'] });
    loadBody('normal', { weights: ['300', '500'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
  },
};
