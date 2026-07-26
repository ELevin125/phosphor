import { loadFont as loadDisplay } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { DEFAULT_DRAW } from './defaults';
import type { Theme } from './types';

/**
 * Terminal Neon — dark, high-contrast, electric.
 * Motion is snappy with a visible overshoot; shapes are tight and glowing.
 * Reads as "modern dev content".
 */
export const neon: Theme = {
  name: 'neon',
  description: 'Dark terminal. Electric cyan on near-black, snappy overshooting motion, glow.',
  shikiTheme: 'tokyo-night',

  colors: {
    bg: '#0B0F1A',
    bgAlt: '#111726',
    surface: '#151C2E',
    codeBg: '#0E1422',
    border: '#243049',
    text: '#E8EEFF',
    textMuted: '#7C8AAB',
    accent: '#3DE0FF',
    accentAlt: '#FF4D9D',
    positive: '#42E695',
    negative: '#FF5E6C',
    diffAddBg: 'rgba(66, 230, 149, 0.14)',
    diffRemoveBg: 'rgba(255, 94, 108, 0.14)',
    dimOpacity: 0.28,
    highlightBg: 'rgba(61, 224, 255, 0.12)',
  },

  backdrop: {
    css: 'linear-gradient(170deg, #111726 0%, #0B0F1A 60%, #070A12 100%)',
    grain: 0.1,
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
    display: '"Space Grotesk", system-ui, sans-serif',
    body: '"Space Grotesk", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    weightDisplay: 700,
    weightBody: 500,
    weightMono: 500,
    size: {
      title: 108,
      subtitle: 54,
      heading: 72,
      body: 46,
      code: 40,
      label: 30,
      caption: 56,
    },
    lineHeight: { tight: 1.04, normal: 1.35, code: 1.62 },
    letterSpacing: { display: '-0.03em', body: '-0.01em', label: '0.18em' },
    labelTransform: 'uppercase',
  },

  shape: {
    radiusSm: 8,
    radiusMd: 16,
    radiusLg: 24,
    borderWidth: 1,
    shadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
    shadowStrong: '0 32px 90px rgba(0, 0, 0, 0.7)',
    glow: '0 0 48px rgba(61, 224, 255, 0.35)',
  },

  draw: DEFAULT_DRAW,

  motion: {
    enter: { damping: 14, mass: 0.8, stiffness: 170, overshootClamping: false, durationInFrames: 16 },
    pop: { damping: 11, mass: 0.6, stiffness: 220, overshootClamping: false, durationInFrames: 13 },
    soft: { damping: 20, mass: 1, stiffness: 90, overshootClamping: false, durationInFrames: 26 },
    fadeFrames: 6,
    staggerFrames: 3,
    travelPx: 46,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.94,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'pop',
      panel: 'rise',
      code: 'swipe',
      callout: 'pop',
      label: 'fade',
      media: 'rise',
    },
    // Quick, with a little overshoot — matches the theme's springy panels.
    camera: { damping: 18, mass: 0.9, stiffness: 170, overshootClamping: false, durationInFrames: 18 },
  },

  captions: {
    color: '#FFFFFF',
    bg: 'transparent',
    activeColor: '#3DE0FF',
    weight: 700,
    radius: 12,
    paddingX: 28,
    paddingY: 14,
    letterSpacing: '-0.01em',
    textTransform: 'none',
    textShadow: '0 4px 24px rgba(0, 0, 0, 0.85)',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['500', '700'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
  },
};
