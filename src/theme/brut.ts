import { loadFont as loadDisplay } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as loadBody } from '@remotion/google-fonts/IBMPlexSans';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { DEFAULT_DRAW } from './defaults';
import type { Theme } from './types';

/**
 * Brutalist Poster — flat, loud, zero softness.
 * Hard offset shadows instead of blur, square corners, thick black borders,
 * and motion that snaps into place with no bounce at all.
 */
export const brut: Theme = {
  name: 'brut',
  description: 'Neo-brutalist poster. Flat blue on bone, square corners, hard shadows, hard snaps.',
  shikiTheme: 'github-light-high-contrast',

  colors: {
    bg: '#FFFBEF',
    bgAlt: '#FFE44D',
    surface: '#FFFFFF',
    codeBg: '#FFFFFF',
    border: '#111111',
    text: '#111111',
    textMuted: '#5C5C5C',
    accent: '#2B2BFF',
    accentAlt: '#FFE44D',
    positive: '#00A150',
    negative: '#E5252A',
    diffAddBg: 'rgba(0, 161, 80, 0.16)',
    diffRemoveBg: 'rgba(229, 37, 42, 0.14)',
    dimOpacity: 0.32,
    highlightBg: 'rgba(255, 228, 77, 0.75)',
  },

  backdrop: {
    css: '#FFFBEF',
    grain: 0.0,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield: this theme's backdrop carries its own texture.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  // Flat theme: panels are opaque, nothing is blurred.
  glass: {
    enabled: false,
    blurPx: 0,
    saturate: 1,
    hairline: 'transparent',
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
    display: '"Archivo Black", Impact, sans-serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    // Archivo Black ships a single weight; it is already black.
    weightDisplay: 400,
    weightBody: 600,
    weightMono: 700,
    size: {
      title: 112,
      subtitle: 50,
      heading: 74,
      body: 46,
      code: 40,
      label: 30,
      caption: 58,
    },
    lineHeight: { tight: 0.98, normal: 1.3, code: 1.6 },
    letterSpacing: { display: '-0.02em', body: '0em', label: '0.22em' },
    labelTransform: 'uppercase',
  },

  shape: {
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    borderWidth: 4,
    // Hard offset shadow, no blur — the whole point of the theme.
    shadow: '10px 10px 0 #111111',
    shadowStrong: '16px 16px 0 #111111',
    glow: 'none',
  },

  draw: DEFAULT_DRAW,

  motion: {
    enter: { damping: 30, mass: 0.7, stiffness: 260, overshootClamping: true, durationInFrames: 9 },
    pop: { damping: 26, mass: 0.6, stiffness: 320, overshootClamping: true, durationInFrames: 7 },
    soft: { damping: 34, mass: 0.9, stiffness: 180, overshootClamping: true, durationInFrames: 14 },
    fadeFrames: 3,
    staggerFrames: 2,
    travelPx: 64,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 1,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'stamp',
      panel: 'slideLeft',
      code: 'unfold',
      callout: 'stamp',
      label: 'snap',
      media: 'slideRight',
    },
    // Hard and fast, no settle. The camera arrives like a cut.
    camera: { damping: 26, mass: 0.6, stiffness: 260, overshootClamping: true, durationInFrames: 10 },
  },

  captions: {
    color: '#111111',
    bg: '#FFE44D',
    activeColor: '#2B2BFF',
    weight: 700,
    radius: 0,
    paddingX: 30,
    paddingY: 16,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
    textShadow: 'none',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['400'], subsets: ['latin'] });
    loadBody('normal', { weights: ['600', '700'], subsets: ['latin'] });
    loadMono('normal', { weights: ['700'], subsets: ['latin'] });
  },
};
