import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadUi } from '@remotion/google-fonts/ShareTechMono';
import type { Theme } from './types';

/**
 * Engine debug view — the in-joke.
 *
 * Viewport grey, wireframe green, gizmo yellow, and missing-texture magenta
 * (#FF00FF exactly — any other magenta breaks the joke) as the accent.
 *
 * Mono everywhere, including headings. Square corners, 1px wireframe borders,
 * and bounding boxes drawn around things that plainly do not need bounding
 * boxes. The layout should read as a tool someone left open, not a slide.
 *
 * Motion is instant and functional: `durationInFrames: 1` with clamping, zero
 * travel, no scale. Values change; nothing animates. This is the only theme
 * where a spring would be wrong.
 */
export const debugview: Theme = {
  name: 'debugview',
  description: 'Engine debug viewport. Wireframe green on viewport grey, missing-texture magenta, instant motion.',
  shikiTheme: 'monokai',

  colors: {
    // Unity/Blender viewport grey, not black.
    bg: '#3A3A3A',
    bgAlt: '#2B2B2B',
    surface: '#333333',
    codeBg: '#262626',
    // Wireframe green, at working opacity.
    border: 'rgba(126, 224, 74, 0.55)',
    text: '#E8E8E8',
    textMuted: '#9C9C9C',
    // The magenta. Do not adjust.
    accent: '#FF00FF',
    accentAlt: '#7EE04A',
    positive: '#7EE04A',
    negative: '#FF3B30',
    diffAddBg: 'rgba(126, 224, 74, 0.18)',
    diffRemoveBg: 'rgba(255, 59, 48, 0.16)',
    dimOpacity: 0.38,
    highlightBg: 'rgba(255, 212, 0, 0.18)',
  },

  backdrop: {
    // A viewport gradient with a faint grid, exactly like a scene view.
    css: `
      repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, rgba(0,0,0,0) 1px 64px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, rgba(0,0,0,0) 1px 64px),
      linear-gradient(180deg, #454545 0%, #3A3A3A 45%, #2E2E2E 100%)
    `,
    // Almost none — a debug view is clean, not filmic.
    grain: 0.04,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield: this theme's backdrop carries its own texture.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  glass: { enabled: false, blurPx: 0, saturate: 1, hairline: 'transparent' },

  decor: {
    kind: 'bounds',
    glyphs: [],
    // Gizmo yellow for the brackets and coordinate readouts.
    color: '#FFD400',
    opacity: 0.75,
    fontFamily: '"Share Tech Mono", ui-monospace, monospace',
    // Everything gets a bounding box. That is the joke.
    frequency: 1,
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
    display: '"Share Tech Mono", ui-monospace, monospace',
    body: '"Share Tech Mono", ui-monospace, monospace',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    weightDisplay: 400,
    weightBody: 400,
    weightMono: 400,
    size: {
      // Mono sets wide, so everything comes down a step from the other themes.
      title: 88,
      subtitle: 42,
      heading: 58,
      body: 40,
      code: 38,
      label: 26,
      caption: 48,
    },
    lineHeight: { tight: 1.12, normal: 1.4, code: 1.6 },
    letterSpacing: { display: '0.01em', body: '0.01em', label: '0.14em' },
    labelTransform: 'uppercase',
  },

  shape: {
    // A tool has square corners.
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    borderWidth: 1,
    // No drop shadows: nothing in a viewport floats.
    shadow: 'none',
    shadowStrong: 'none',
    glow: 'none',
  },

  draw: {
    // Wireframe: hollow rings, hairline strokes, a full lattice and dashed
    // paths. It should look like something you toggled on with a checkbox.
    strokeWidth: 2,
    dotRadius: 24,
    dotStyle: 'hollow',
    trailStyle: 'dashes',
    trailFade: 0.3,
    gridStyle: 'lines',
    gridColor: 'rgba(126, 224, 74, 0.16)',
    tagStyle: 'bracket',
    arrowHead: 22,
  },

  motion: {
    // Instant. A one-frame spring with clamping is a step function.
    enter: { damping: 200, mass: 0.1, stiffness: 1000, overshootClamping: true, durationInFrames: 1 },
    pop: { damping: 200, mass: 0.1, stiffness: 1000, overshootClamping: true, durationInFrames: 1 },
    soft: { damping: 200, mass: 0.1, stiffness: 1000, overshootClamping: true, durationInFrames: 2 },
    fadeFrames: 1,
    // Lines appear one frame apart, like a console printing.
    staggerFrames: 1,
    travelPx: 0,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 1,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'snap',
      panel: 'snap',
      code: 'swipe',
      callout: 'snap',
      label: 'snap',
      media: 'snap',
    },
    // A cut, not a move. The viewport jumps to the target the way a tool does.
    camera: { damping: 200, mass: 0.1, stiffness: 1000, overshootClamping: true, durationInFrames: 2 },
  },

  captions: {
    color: '#E8E8E8',
    bg: 'rgba(0, 0, 0, 0.62)',
    activeColor: '#FF00FF',
    weight: 400,
    radius: 0,
    paddingX: 20,
    paddingY: 10,
    letterSpacing: '0.02em',
    textTransform: 'none',
    textShadow: 'none',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadUi('normal', { weights: ['400'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
  },
};
