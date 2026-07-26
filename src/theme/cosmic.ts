import { loadFont as loadDisplay } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadBody } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import type { Theme } from './types';

/**
 * Cosmic — a deep-space palette, built as a tool rather than a slide.
 *
 * A deliberate cross of two earlier themes. From `debugview` it keeps the
 * "this is an engine window, not a presentation" posture: mono labels, corner
 * brackets and coordinate readouts, small radii, nothing floating for
 * decoration. From `midnight` it keeps frosted glass and a genuinely dark but
 * not black base, so panels sit in front of something instead of on top of a
 * flat fill.
 *
 * The palette is bone line-work, bruised indigo sky, violet regolith and black
 * ink, with one addition: a warm star-gold accent. Without a warm colour every
 * emphasis lands in the same violet register as the background and disappears.
 * Gold against cold violet is also the one pairing that survives Instagram's
 * compression.
 *
 * The background is a starfield, not a grid and not a bare gradient. Two
 * reasons: it is the world the palette implies, and a camera pan across a
 * gradient looks like a still frame because there is nothing in it to move
 * past. The stars
 * parallax at a third of the camera's speed, which is what sells the board as
 * a space rather than as a sheet of content sliding around.
 *
 * Motion is the loud part. Every role gets a different gesture — the title
 * stamps down oversized, panels bop in with squash and stretch, code swipes
 * open behind a hard edge, labels snap on with no interpolation at all. All of
 * it is short: 8 to 12 frames, well under half a second, so the video is never
 * waiting on an animation to finish.
 */
export const cosmic: Theme = {
  name: 'cosmic',
  description: 'Bone and star-gold on bruised violet, glass panels in a debug window, loud short motion.',
  shikiTheme: 'poimandres',

  colors: {
    // Deep space violet. Semi-dark, never black — black kills the glass.
    bg: '#171029',
    bgAlt: 'rgba(244, 234, 218, 0.05)',
    // Violet-tinted glass, so panels pick up the sky rather than greying it.
    surface: 'rgba(150, 120, 205, 0.15)',
    codeBg: 'rgba(14, 9, 26, 0.72)',
    // Bone hairline, straight off the logo's line-work.
    border: 'rgba(244, 234, 218, 0.30)',
    text: '#F4EADA',
    textMuted: '#A794C9',
    // Star gold. The one warm thing in the theme, so it always reads as "here".
    accent: '#FFC978',
    accentAlt: '#B79BE8',
    positive: '#7FE0B0',
    negative: '#FF7A93',
    diffAddBg: 'rgba(127, 224, 176, 0.15)',
    diffRemoveBg: 'rgba(255, 122, 147, 0.14)',
    // Glass needs a high floor or dimmed content vanishes into the sky.
    dimOpacity: 0.42,
    highlightBg: 'rgba(255, 201, 120, 0.14)',
  },

  backdrop: {
    // The logo's sky: indigo overhead, warmer violet toward the horizon, with
    // the regolith glow coming up from the bottom edge.
    css: `
      radial-gradient(120% 55% at 50% 108%, rgba(139, 111, 176, 0.55) 0%, rgba(139, 111, 176, 0) 60%),
      radial-gradient(80% 50% at 82% 14%, rgba(123, 98, 168, 0.32) 0%, rgba(123, 98, 168, 0) 65%),
      linear-gradient(172deg, #2E2358 0%, #221845 38%, #171029 78%, #120C21 100%)
    `,
    grain: 0.15,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    stars: {
      count: 150,
      color: '#F4EADA',
      // Most are dots; a handful of four-point sparkles echo the logo without
      // turning the sky into glitter.
      sparkleRatio: 0.14,
      maxRadius: 5,
      parallax: 0.34,
    },
  },

  glass: {
    enabled: true,
    blurPx: 24,
    saturate: 1.3,
    hairline: 'rgba(244, 234, 218, 0.34)',
  },

  decor: {
    // The debugview inheritance: brackets and coordinates on panels that do
    // not need them. In bone rather than gizmo yellow, so it reads as
    // instrumentation instead of a second accent competing with the gold.
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
    // Bricolage has wonky, slightly uneven proportions — hand-drawn rather
    // than drafted, which is what keeps the titles off the corporate shelf.
    display: '"Bricolage Grotesque", system-ui, sans-serif',
    body: '"Space Grotesk", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    weightDisplay: 800,
    weightBody: 400,
    weightMono: 500,
    size: {
      title: 108,
      subtitle: 46,
      heading: 70,
      body: 44,
      code: 38,
      label: 25,
      caption: 54,
    },
    lineHeight: { tight: 0.98, normal: 1.38, code: 1.62 },
    letterSpacing: { display: '-0.03em', body: '0.005em', label: '0.22em' },
    labelTransform: 'uppercase',
  },

  shape: {
    // Softened tool panels: enough radius that they are not brutalist, little
    // enough that they never look like cards in a web app.
    radiusSm: 4,
    radiusMd: 10,
    radiusLg: 14,
    borderWidth: 1.5,
    shadow: '0 24px 60px rgba(6, 3, 16, 0.55)',
    shadowStrong: '0 34px 90px rgba(6, 3, 16, 0.7)',
    glow: '0 0 44px rgba(255, 201, 120, 0.34)',
  },

  draw: {
    // Inked line-work, straight off the logo: solid markers with a bone-weight
    // stroke, history stamped as ghosts, a faint dot lattice for scale.
    strokeWidth: 3,
    dotRadius: 26,
    dotStyle: 'solid',
    trailStyle: 'ghosts',
    trailFade: 0.16,
    gridStyle: 'dots',
    // Raised from 0.16: over a starfield backdrop a fainter lattice simply is
    // not there, and the grid's whole job is to make motion measurable.
    gridColor: 'rgba(244, 234, 218, 0.3)',
    tagStyle: 'bracket',
    arrowHead: 26,
  },

  motion: {
    // Everything is short and slightly overshooting. `enter` is 10 frames —
    // a third of a second — because the complaint about the earlier themes was
    // that elegant, slow motion reads as corporate.
    enter: { damping: 14, mass: 0.8, stiffness: 220, overshootClamping: false, durationInFrames: 10 },
    pop: { damping: 10, mass: 0.55, stiffness: 300, overshootClamping: false, durationInFrames: 8 },
    soft: { damping: 20, mass: 1, stiffness: 130, overshootClamping: false, durationInFrames: 16 },
    fadeFrames: 5,
    staggerFrames: 2,
    travelPx: 54,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.94,
    // The variety is here. Six roles, six different arrivals.
    gestures: {
      title: 'stamp',
      panel: 'bop',
      code: 'swipe',
      callout: 'pop',
      label: 'snap',
      media: 'rise',
    },
    // A game camera: fast, and it overshoots the target slightly before
    // settling, the way a follow camera catches up with something moving.
    camera: { damping: 17, mass: 0.9, stiffness: 190, overshootClamping: false, durationInFrames: 16 },
  },

  captions: {
    color: '#F4EADA',
    bg: 'rgba(23, 16, 41, 0.5)',
    activeColor: '#FFC978',
    weight: 600,
    radius: 8,
    paddingX: 28,
    paddingY: 14,
    letterSpacing: '0.01em',
    textTransform: 'none',
    textShadow: '0 2px 16px rgba(0, 0, 0, 0.8)',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['700', '800'], subsets: ['latin'] });
    loadBody('normal', { weights: ['400', '600'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
  },
};
