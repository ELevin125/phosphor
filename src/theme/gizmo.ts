import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadUi } from '@remotion/google-fonts/ShareTechMono';
import type { ThemeSpec } from './types';

/**
 * Gizmo — the engine debug window, warmed with `cosmic`'s palette.
 *
 * Structure comes from `debugview`: square corners, 1px wireframe borders, mono
 * for absolutely everything, a viewport lattice behind the content, bounding
 * boxes and coordinate readouts on things that plainly do not need them. It
 * should read as a tool someone left open, not a slide.
 *
 * Colour comes from `cosmic`, with one important departure. cosmic's `#171029`
 * is a saturated indigo, and once it fills a 1080x1920 frame the entire video
 * goes purple and starts competing with the footage sitting on top of it. So
 * the violet here is a TINT on charcoal, not the subject, and the colour budget
 * is spent on two accents instead: star gold and lilac.
 *
 * Gold and lilac are far enough apart in hue to read instantly as two different
 * things — which is the whole job when they are labelling "you" and "the AI" —
 * and neither is the wireframe green or missing-texture magenta that would drag
 * this straight back to being `debugview` with extra steps.
 *
 * Motion is fast and functional: 6-8 frame springs, elements snap on rather
 * than drift in. Not `debugview`'s literal one-frame step function, which was
 * a joke about tools rather than something to watch for forty seconds.
 */
export const gizmo: ThemeSpec = {
  name: 'gizmo',
  description: 'Engine debug window. Charcoal and grid, star gold and lilac, mono throughout.',
  shikiTheme: 'vesper',

  colors: {
    // Violet-tinted charcoal. Desaturated hard on purpose — see the note above.
    bg: '#17141F',
    bgAlt: '#1F1B2B',
    surface: '#1C1826',
    codeBg: '#14111C',
    // Bone hairline, straight off the logo's line-work.
    border: 'rgba(244, 234, 218, 0.28)',
    text: '#F4EADA',
    textMuted: '#8E86A3',
    // Star gold. Warm, and the first thing the eye lands on.
    accent: '#FFC978',
    // Lilac. Cool enough to read as the machine half of a pair.
    accentAlt: '#B79BE8',
    positive: '#7FE0B0',
    negative: '#FF7A93',
    diffAddBg: 'rgba(127, 224, 176, 0.15)',
    diffRemoveBg: 'rgba(255, 122, 147, 0.14)',
    dimOpacity: 0.38,
    highlightBg: 'rgba(255, 201, 120, 0.14)',
  },

  backdrop: {
    // A viewport lattice: fine 64px cells with a heavier line every 256px, so
    // the grid has structure instead of reading as uniform graph paper.
    css: `
      repeating-linear-gradient(0deg, rgba(244,234,218,0.05) 0 1px, rgba(0,0,0,0) 1px 64px),
      repeating-linear-gradient(90deg, rgba(244,234,218,0.05) 0 1px, rgba(0,0,0,0) 1px 64px),
      repeating-linear-gradient(0deg, rgba(244,234,218,0.09) 0 1px, rgba(0,0,0,0) 1px 256px),
      repeating-linear-gradient(90deg, rgba(244,234,218,0.09) 0 1px, rgba(0,0,0,0) 1px 256px),
      linear-gradient(180deg, #1C1826 0%, #17141F 55%, #131019 100%)
    `,
    // Barely any: a tool window is clean, not filmic.
    grain: 0.05,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield. The grid is the background; adding stars behind a tool
    // window would be having it both ways.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  glass: { enabled: false, blurPx: 0, saturate: 1, hairline: 'transparent' },

  decor: {
    // The debugview joke, kept: brackets and coordinates on panels that do not
    // need them. Lilac rather than gizmo yellow so it never competes with the
    // gold accent for attention.
    kind: 'bounds',
    glyphs: [],
    color: '#B79BE8',
    opacity: 0.5,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    frequency: 0.6,
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
    /*
      Multiples of the profile's `typeBase`, not pixels — so the same theme
      works in a 1080x1920 frame and a 1920x1080 one without a second copy.

      The ratios are exactly the px values this theme shipped with, divided by
      the 40px portrait base, so every existing video renders identically.
    */
    scale: {
      // Mono sets wide, so everything sits a step below the sans themes.
      title: 2.2,
      subtitle: 1.05,
      heading: 1.45,
      body: 1,
      code: 0.95,
      // Up from debugview's 0.65: `label` is what badge chips use, and a badge
      // over footage has to hold its own against the picture behind it.
      label: 0.75,
      caption: 1.2,
    },
    lineHeight: { tight: 1.12, normal: 1.4, code: 1.6 },
    letterSpacing: { display: '0.01em', body: '0.01em', label: '0.16em' },
    labelTransform: 'uppercase',
  },

  shape: {
    // A tool has square corners and nothing floats.
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    borderWidth: 1,
    shadow: 'none',
    shadowStrong: 'none',
    glow: '0 0 32px rgba(255, 201, 120, 0.28)',
  },

  draw: {
    // Wireframe: hollow rings and dashed paths on a full lattice.
    strokeWidth: 2,
    dotRadius: 24,
    dotStyle: 'hollow',
    trailStyle: 'dashes',
    trailFade: 0.28,
    gridStyle: 'lines',
    gridColor: 'rgba(244, 234, 218, 0.12)',
    tagStyle: 'bracket',
    arrowHead: 22,
  },

  motion: {
    // Fast and functional. Short enough to feel like a tool responding,
    // long enough to be motion rather than a cut.
    enter: { damping: 18, mass: 0.6, stiffness: 260, overshootClamping: false, durationInFrames: 7 },
    pop: { damping: 12, mass: 0.5, stiffness: 320, overshootClamping: false, durationInFrames: 6 },
    soft: { damping: 22, mass: 0.9, stiffness: 160, overshootClamping: false, durationInFrames: 12 },
    fadeFrames: 3,
    staggerFrames: 1,
    travelPx: 28,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.95,
    gestures: {
      title: 'snap',
      panel: 'pop',
      code: 'swipe',
      callout: 'pop',
      label: 'snap',
      // Footage is already moving; it should be present, not perform.
      media: 'snap',
    },
    camera: { damping: 20, mass: 0.7, stiffness: 240, overshootClamping: false, durationInFrames: 10 },
  },

  captions: {
    color: '#F4EADA',
    bg: 'rgba(20, 17, 28, 0.94)',
    activeColor: '#FFC978',
    weight: 400,
    radius: 0,
    paddingX: 22,
    paddingY: 12,
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
