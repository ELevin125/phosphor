import { loadFont as loadDisplay } from '@remotion/google-fonts/ChakraPetch';
import { loadFont as loadMono } from '@remotion/google-fonts/SpaceMono';
import type { Theme } from './types';

/**
 * PS1 — a fifth-generation console on a CRT.
 *
 * Deliberately NOT the hacker-terminal palette. The base is a bruised
 * indigo-violet (CRT black never reaches black), text is bone rather than
 * white, and the accent is amber-gold with a dusty cyan second. Warm-on-violet
 * is the part that keeps it out of both "matrix" and "synthwave" territory.
 *
 * The low-res look is real, not a filter pretending: content is genuinely
 * pixelated and colour-quantised to 8 steps per channel via SVG (see
 * `kit/Crt.tsx`), then scanlines and an aperture grille are drawn on top
 * unfiltered.
 *
 * Type is angular game-UI, not a pixel font — Chakra Petch reads as a console
 * menu without resorting to 8-bit cosplay. Space Mono for code keeps the
 * era-correct quirk.
 *
 * Motion is the other half of the character:
 *  - `stepFrames: 3` holds every animated value for 3 frames, giving the
 *    choppy ~10fps look of a console dropping frames.
 *  - `jitterPx: 0.9` adds constant sub-pixel wobble — PS1 had no subpixel
 *    precision, so geometry visibly swam.
 *  - `travelPx: 0` with `enterScale: 0.7` means things punch in by SCALING
 *    rather than sliding. Sliding is the elegant, safe option; this isn't.
 *  - `transition: 'wipe'` replaces the cross-dissolve with a hard edge sweep.
 */
export const ps1: Theme = {
  name: 'ps1',
  description: 'Fifth-gen console on a CRT. Amber-gold on bruised violet, real pixelation, choppy stepped motion.',
  shikiTheme: 'vesper',

  colors: {
    bg: '#15101F',
    bgAlt: '#1F1830',
    surface: '#241C38',
    codeBg: '#191227',
    border: '#5B4A85',
    // Bone, not white — a CRT never resolves clean white.
    text: '#EDE4D8',
    textMuted: '#9587B3',
    accent: '#FFC93C',
    accentAlt: '#5AC8E0',
    // Mint rather than the usual terminal green.
    positive: '#7FD4A3',
    negative: '#FF5C77',
    diffAddBg: 'rgba(127, 212, 163, 0.16)',
    diffRemoveBg: 'rgba(255, 92, 119, 0.16)',
    dimOpacity: 0.36,
    highlightBg: 'rgba(255, 201, 60, 0.16)',
  },

  backdrop: {
    // Deliberately almost flat. Posterising to 8 levels turns a broad radial
    // gradient into a few enormous hard-edged discs — it reads as a rendering
    // fault, not a CRT. A shallow vertical ramp bands into horizontal steps
    // instead, which is what limited colour depth actually looked like.
    css: 'linear-gradient(180deg, #1D1630 0%, #15101F 60%, #100B1C 100%)',
    // High grain on purpose: this is the dither. Noise applied BEFORE the
    // quantiser breaks the bands up, exactly as ordered dithering did on
    // hardware that could not afford the colour depth.
    grain: 0.22,
    image: null,
    imageBlur: 40,
    veil: 'transparent',
    // No starfield: this theme's backdrop carries its own texture.
    stars: { count: 0, color: 'transparent', sparkleRatio: 0, maxRadius: 0, parallax: 0 },
  },

  glass: { enabled: false, blurPx: 0, saturate: 1, hairline: 'transparent' },

  decor: {
    kind: 'stencil',
    // Console-menu furniture: slot numbers, region codes, disc labels.
    glyphs: ['SLOT 1', 'NTSC', 'DISC 1', '▸ MEM', 'BLOCK 04', 'SCE'],
    color: '#5AC8E0',
    opacity: 0.42,
    fontFamily: '"Space Mono", ui-monospace, monospace',
    frequency: 0.4,
  },

  crt: {
    enabled: true,
    // 2px blocks. 3 is more characterful but starts eating code — at 3,
    // "struct" renders closer to "struot". Push it up for footage-led videos
    // where nothing has to be read letter by letter.
    pixelSize: 2,
    // Eight steps: still visibly banded, but without ringing the backdrop
    // gradients into hard concentric bands.
    posterizeLevels: 8,
    scanlineOpacity: 0.22,
    scanlineHeight: 4,
    apertureOpacity: 0.05,
    vignette: 0.24,
    ditherOpacity: 0,
  },

  type: {
    // Angular console-menu type. Explicitly not a pixel font.
    display: '"Chakra Petch", sans-serif',
    body: '"Chakra Petch", sans-serif',
    mono: '"Space Mono", ui-monospace, monospace',
    weightDisplay: 700,
    weightBody: 500,
    weightMono: 700,
    size: {
      title: 116,
      subtitle: 48,
      heading: 76,
      body: 44,
      // Space Mono is wide; code comes down a step to compensate.
      code: 36,
      label: 26,
      caption: 54,
    },
    lineHeight: { tight: 1.02, normal: 1.34, code: 1.62 },
    letterSpacing: { display: '0.01em', body: '0.01em', label: '0.2em' },
    labelTransform: 'uppercase',
  },

  shape: {
    // Console UI is square and chunky.
    radiusSm: 0,
    radiusMd: 0,
    radiusLg: 0,
    borderWidth: 3,
    shadow: '0 0 0 1px rgba(0,0,0,0.6), 8px 8px 0 rgba(0,0,0,0.55)',
    shadowStrong: '0 0 0 1px rgba(0,0,0,0.7), 12px 12px 0 rgba(0,0,0,0.65)',
    glow: '0 0 40px rgba(255, 201, 60, 0.35)',
  },

  draw: {
    // Chunky and low-fidelity, to survive the mosaic filter: thin geometry
    // disappears entirely once it is quantised to 2px blocks.
    strokeWidth: 4,
    dotRadius: 30,
    dotStyle: 'solid',
    trailStyle: 'ghosts',
    trailFade: 0.25,
    gridStyle: 'none',
    gridColor: 'transparent',
    tagStyle: 'boxed',
    arrowHead: 30,
  },

  motion: {
    // Punchy and slightly overshooting — these SCALE in, they do not slide.
    enter: { damping: 13, mass: 0.7, stiffness: 200, overshootClamping: false, durationInFrames: 12 },
    pop: { damping: 9, mass: 0.5, stiffness: 280, overshootClamping: false, durationInFrames: 9 },
    soft: { damping: 20, mass: 1, stiffness: 110, overshootClamping: false, durationInFrames: 20 },
    fadeFrames: 3,
    staggerFrames: 2,
    // No travel at all. Scale is the entrance.
    travelPx: 0,
    stepFrames: 3,
    jitterPx: 0.9,
    transition: 'wipe',
    enterScale: 0.7,
    // Gesture per element role — see `Gesture` in theme/types.ts.
    gestures: {
      title: 'stamp',
      panel: 'pop',
      code: 'swipe',
      callout: 'pop',
      label: 'snap',
      media: 'pop',
    },
    // Fast and stepped — `stepFrames` quantises it, so the pan visibly ratchets.
    camera: { damping: 15, mass: 0.7, stiffness: 210, overshootClamping: false, durationInFrames: 12 },
  },

  captions: {
    color: '#EDE4D8',
    bg: 'rgba(21, 16, 31, 0.78)',
    activeColor: '#FFC93C',
    weight: 600,
    radius: 0,
    paddingX: 24,
    paddingY: 12,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
    emphasiseActive: true,
  },

  loadFonts: () => {
    loadDisplay('normal', { weights: ['500', '700'], subsets: ['latin'] });
    loadMono('normal', { weights: ['400', '700'], subsets: ['latin'] });
  },
};
