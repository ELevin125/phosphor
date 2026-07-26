import { loadFont as loadDisplay } from '@remotion/google-fonts/Oswald';
import { loadFont as loadBody } from '@remotion/google-fonts/BarlowCondensed';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadStencil } from '@remotion/google-fonts/StardosStencil';
import type { Theme } from './types';

/**
 * Late-night garage — 2am in a workshop with one lamp on.
 *
 * Sodium-vapour orange against cold midnight blue-black. Warm cream carries
 * the reading; chrome grey carries the structure. The palette is deliberately
 * split-temperature: everything lit is warm, everything unlit is cold, and
 * nothing sits in between.
 *
 * No borders anywhere. Panels are defined by a halogen falloff — a warm pool
 * of light at the top edge fading into the dark — plus a soft spill shadow.
 * That is what stops it reading as a card-based corporate layout.
 *
 * Motion carries weight: high mass, heavy damping, nothing pops or overshoots.
 * Things arrive and settle, the way a heavy object set down does.
 */
export const garage: Theme = {
  name: 'garage',
  description: 'Late-night workshop. Sodium orange on midnight blue-black, condensed signage type, no borders.',
  shikiTheme: 'gruvbox-dark-medium',

  colors: {
    bg: '#0A0D14',
    bgAlt: '#12161F',
    // Halogen falloff: a warm pool at the top edge dying into the dark.
    surface:
      'linear-gradient(178deg, rgba(255,150,50,0.09) 0%, rgba(255,150,50,0.03) 22%, rgba(18,22,31,0.92) 70%)',
    codeBg:
      'linear-gradient(178deg, rgba(255,150,50,0.06) 0%, rgba(10,13,20,0.95) 40%)',
    // Borderless: this is only used where a hairline is unavoidable.
    border: 'rgba(154, 163, 173, 0.16)',
    text: '#F0E4D0',
    textMuted: '#8B939D',
    accent: '#FF8C21',
    accentAlt: '#9AA3AD',
    positive: '#8FB663',
    negative: '#E2543F',
    diffAddBg: 'rgba(143, 182, 99, 0.14)',
    diffRemoveBg: 'rgba(226, 84, 63, 0.14)',
    dimOpacity: 0.34,
    highlightBg: 'rgba(255, 140, 33, 0.13)',
  },

  backdrop: {
    // One lamp, high and slightly off-centre, falling off fast.
    css: `
      radial-gradient(90% 45% at 62% 6%, rgba(255, 150, 55, 0.20) 0%, rgba(255, 150, 55, 0) 62%),
      radial-gradient(120% 60% at 30% 96%, rgba(40, 52, 70, 0.55) 0%, rgba(40, 52, 70, 0) 60%),
      linear-gradient(172deg, #12161F 0%, #0A0D14 52%, #05070B 100%)
    `,
    // Heavier grain than the other themes — this one wants to feel photographed.
    grain: 0.26,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield: this theme's backdrop carries its own texture.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  glass: { enabled: false, blurPx: 0, saturate: 1, hairline: 'transparent' },

  decor: {
    kind: 'stencil',
    // Workshop signage marks. Decoration only, never content.
    //
    // Katakana was in the brief and is deliberately NOT here: every Japanese
    // webfont on Google Fonts is split into ~120 unicode-range chunks, so
    // pulling one in for two ornamental glyphs costs ~100 network requests on
    // every render. Add `@remotion/google-fonts/NotoSansJP` with
    // `subsets: ['japanese']` and append the glyphs here if that trade is
    // worth it — everything else about the theme already supports it.
    glyphs: ['07', 'A-12', '±0.5', 'REV.C', '03', 'NO.4', '12V', 'B/2'],
    color: '#9AA3AD',
    opacity: 0.34,
    fontFamily: '"Stardos Stencil", monospace',
    // "Occasional" — roughly one panel in three.
    frequency: 0.34,
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
    display: '"Oswald", "Barlow Condensed", sans-serif',
    body: '"Barlow Condensed", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
    weightDisplay: 600,
    weightBody: 400,
    weightMono: 500,
    size: {
      // Condensed faces set narrow, so they carry a larger size comfortably.
      title: 128,
      subtitle: 56,
      heading: 84,
      body: 52,
      code: 40,
      label: 30,
      caption: 62,
    },
    lineHeight: { tight: 1.0, normal: 1.32, code: 1.62 },
    letterSpacing: { display: '0.005em', body: '0.01em', label: '0.28em' },
    labelTransform: 'uppercase',
  },

  shape: {
    radiusSm: 2,
    radiusMd: 4,
    radiusLg: 6,
    // No borders. The halogen falloff does the work.
    borderWidth: 0,
    shadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(255, 140, 33, 0.06)',
    shadowStrong: '0 44px 120px rgba(0, 0, 0, 0.82), 0 0 90px rgba(255, 140, 33, 0.10)',
    glow: '0 0 60px rgba(255, 140, 33, 0.30)',
  },

  draw: {
    // Heavy marker on a workshop wall: thick continuous lines, no lattice.
    strokeWidth: 5,
    dotRadius: 30,
    dotStyle: 'solid',
    trailStyle: 'line',
    trailFade: 0.2,
    gridStyle: 'none',
    gridColor: 'transparent',
    tagStyle: 'plain',
    arrowHead: 32,
  },

  motion: {
    // Weight: heavy mass, hard damping, no overshoot. Arrives and settles.
    enter: { damping: 30, mass: 1.9, stiffness: 105, overshootClamping: false, durationInFrames: 26 },
    pop: { damping: 26, mass: 1.5, stiffness: 145, overshootClamping: false, durationInFrames: 20 },
    soft: { damping: 36, mass: 2.4, stiffness: 70, overshootClamping: false, durationInFrames: 38 },
    fadeFrames: 9,
    staggerFrames: 4,
    // Travels further and slower — that reads as mass.
    travelPx: 56,
    stepFrames: 1,
    jitterPx: 0,
    transition: 'fade',
    enterScale: 0.99,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'drop',
      panel: 'drop',
      code: 'unfold',
      callout: 'slideLeft',
      label: 'fade',
      media: 'drop',
    },
    // Heavy: the same mass as the panels, so the camera feels like it is on a rig.
    camera: { damping: 30, mass: 1.9, stiffness: 120, overshootClamping: false, durationInFrames: 24 },
  },

  captions: {
    color: '#F0E4D0',
    bg: 'transparent',
    activeColor: '#FF8C21',
    weight: 500,
    radius: 2,
    paddingX: 26,
    paddingY: 12,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    textShadow: '0 3px 20px rgba(0, 0, 0, 0.9)',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['400', '600'], subsets: ['latin'] });
    loadBody('normal', { weights: ['400', '600'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
    loadStencil('normal', { weights: ['400', '700'], subsets: ['latin'] });
  },
};
