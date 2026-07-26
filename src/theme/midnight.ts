import { loadFont as loadDisplay } from '@remotion/google-fonts/Jost';
import { loadFont as loadBody } from '@remotion/google-fonts/Outfit';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import type { Theme } from './types';

/**
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
export const midnight: Theme = {
  name: 'midnight',
  description: 'Retro anime night drive. Frosted glass on cool navy, hairline type, hot yellow accent.',
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
    // Thin and cold, like an overlay on glass. Continuous trails rather than
    // stamps — nothing in this theme should look mechanical.
    strokeWidth: 2,
    dotRadius: 24,
    dotStyle: 'solid',
    trailStyle: 'line',
    trailFade: 0.18,
    gridStyle: 'dots',
    gridColor: 'rgba(200, 220, 248, 0.14)',
    tagStyle: 'plain',
    arrowHead: 24,
  },

  motion: {
    // Glass slides and settles; nothing snaps or bounces hard.
    enter: { damping: 22, mass: 1, stiffness: 120, overshootClamping: false, durationInFrames: 20 },
    pop: { damping: 18, mass: 0.85, stiffness: 165, overshootClamping: false, durationInFrames: 16 },
    soft: { damping: 28, mass: 1.2, stiffness: 80, overshootClamping: false, durationInFrames: 30 },
    fadeFrames: 8,
    staggerFrames: 3,
    travelPx: 38,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.97,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'rise',
      panel: 'rise',
      code: 'fade',
      callout: 'slideLeft',
      label: 'fade',
      media: 'fade',
    },
    // A long, gliding move. This is the one theme where a slow camera is the point.
    camera: { damping: 28, mass: 1.2, stiffness: 100, overshootClamping: false, durationInFrames: 28 },
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
