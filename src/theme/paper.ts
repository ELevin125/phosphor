import { loadFont as loadDisplay } from '@remotion/google-fonts/Fraunces';
import { loadFont as loadBody } from '@remotion/google-fonts/IBMPlexSans';
import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';
import { DEFAULT_DRAW } from './defaults';
import type { Theme } from './types';

/**
 * Editorial Paper — warm, light, calm.
 * A serif display against a soft off-white, generous radii, and slow settled
 * motion with no bounce. Reads as "a good textbook", not "a dev influencer".
 */
export const paper: Theme = {
  name: 'paper',
  description: 'Warm off-white editorial. Serif display, rust accent, slow unhurried motion.',
  shikiTheme: 'vitesse-light',

  colors: {
    bg: '#F7F3EC',
    bgAlt: '#EFE9DE',
    surface: '#FFFDF9',
    codeBg: '#FFFDF9',
    border: '#DCD3C4',
    text: '#1F1B16',
    textMuted: '#7A7062',
    accent: '#C2410C',
    accentAlt: '#1D6E63',
    positive: '#1D6E63',
    negative: '#B4232B',
    diffAddBg: 'rgba(29, 110, 99, 0.12)',
    diffRemoveBg: 'rgba(180, 35, 43, 0.10)',
    dimOpacity: 0.30,
    highlightBg: 'rgba(194, 65, 12, 0.10)',
  },

  backdrop: {
    css: 'linear-gradient(170deg, #FBF8F2 0%, #F7F3EC 55%, #EFE9DE 100%)',
    grain: 0.05,
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
    display: '"Fraunces", Georgia, serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
    weightDisplay: 600,
    weightBody: 400,
    weightMono: 400,
    size: {
      title: 104,
      subtitle: 50,
      heading: 68,
      body: 44,
      code: 38,
      label: 28,
      caption: 54,
    },
    lineHeight: { tight: 1.08, normal: 1.42, code: 1.7 },
    letterSpacing: { display: '-0.015em', body: '0em', label: '0.14em' },
    labelTransform: 'uppercase',
  },

  shape: {
    radiusSm: 10,
    radiusMd: 20,
    radiusLg: 32,
    borderWidth: 1,
    shadow: '0 18px 44px rgba(60, 46, 28, 0.10)',
    shadowStrong: '0 28px 70px rgba(60, 46, 28, 0.16)',
    glow: 'none',
  },

  draw: DEFAULT_DRAW,

  motion: {
    enter: { damping: 26, mass: 1.1, stiffness: 95, overshootClamping: false, durationInFrames: 24 },
    pop: { damping: 22, mass: 1, stiffness: 130, overshootClamping: false, durationInFrames: 20 },
    soft: { damping: 30, mass: 1.3, stiffness: 70, overshootClamping: false, durationInFrames: 34 },
    fadeFrames: 10,
    staggerFrames: 4,
    travelPx: 28,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.985,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'rise',
      panel: 'fade',
      code: 'fade',
      callout: 'rise',
      label: 'fade',
      media: 'fade',
    },
    // Slow and fully damped. A printed page does not overshoot.
    camera: { damping: 30, mass: 1.2, stiffness: 90, overshootClamping: true, durationInFrames: 26 },
  },

  captions: {
    color: '#1F1B16',
    bg: 'rgba(255, 253, 249, 0.92)',
    activeColor: '#C2410C',
    weight: 600,
    radius: 20,
    paddingX: 34,
    paddingY: 18,
    letterSpacing: '0em',
    textTransform: 'none',
    textShadow: 'none',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['600'], subsets: ['latin'] });
    loadBody('normal', { weights: ['400', '600'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '600'], subsets: ['latin'] });
  },
};
