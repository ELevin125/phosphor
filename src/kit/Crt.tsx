import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CANVAS } from './layout';
import { useTheme } from './ThemeContext';

/** Evenly spaced steps for `feFuncX type="discrete"`. */
const discreteTable = (levels: number): string =>
  Array.from({ length: levels }, (_, i) => (i / (levels - 1)).toFixed(4)).join(' ');

export const CRT_FILTER_ID = 'crt-quantize';

/**
 * SVG filter definitions for the low-resolution look.
 *
 * `feFlood` + `feComposite` + `feTile` is the standard SVG mosaic: flood one
 * block, keep a single source pixel through it, then tile that block across
 * the surface. It is the only way to genuinely pixelate DOM content — CSS
 * `image-rendering` only affects bitmaps, so it cannot touch live text.
 *
 * `feComponentTransfer` with discrete tables then crushes each channel to a
 * fixed number of steps, which is what produces real 15-bit-style banding
 * rather than a colour overlay pretending to be it.
 */
export const CrtFilters: React.FC = () => {
  const { crt } = useTheme();
  if (!crt.enabled) {
    return null;
  }

  const px = Math.max(1, crt.pixelSize);
  const table = crt.posterizeLevels > 1 ? discreteTable(crt.posterizeLevels) : null;

  return (
    <svg
      width={0}
      height={0}
      style={{ position: 'absolute', pointerEvents: 'none' }}
      aria-hidden
    >
      <defs>
        <filter
          id={CRT_FILTER_ID}
          x="0"
          y="0"
          width={CANVAS.width}
          height={CANVAS.height}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          {crt.pixelSize > 0 ? (
            <>
              <feFlood x={px / 2} y={px / 2} width="1" height="1" result="dot" />
              <feComposite in="dot" width={px} height={px} result="cell" />
              <feTile in="cell" result="grid" />
              <feComposite in="SourceGraphic" in2="grid" operator="in" result="sampled" />
              <feMorphology in="sampled" operator="dilate" radius={px / 2} result="blocks" />
            </>
          ) : (
            <feOffset in="SourceGraphic" dx="0" dy="0" result="blocks" />
          )}

          {table ? (
            <feComponentTransfer in="blocks">
              <feFuncR type="discrete" tableValues={table} />
              <feFuncG type="discrete" tableValues={table} />
              <feFuncB type="discrete" tableValues={table} />
            </feComponentTransfer>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
};

/**
 * Scanlines, phosphor grille, vignette and dither — drawn ON TOP of the
 * quantised content and deliberately not filtered themselves. Pixelating a
 * scanline would only blur it.
 */
export const CrtOverlay: React.FC = () => {
  const { crt } = useTheme();
  if (!crt.enabled) {
    return null;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 900 }}>
      {crt.scanlineOpacity > 0 ? (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(
              0deg,
              rgba(0,0,0,${crt.scanlineOpacity}) 0px,
              rgba(0,0,0,${crt.scanlineOpacity}) ${crt.scanlineHeight / 2}px,
              rgba(0,0,0,0) ${crt.scanlineHeight / 2}px,
              rgba(0,0,0,0) ${crt.scanlineHeight}px
            )`,
          }}
        />
      ) : null}

      {crt.apertureOpacity > 0 ? (
        <AbsoluteFill
          style={{
            // Vertical RGB stripes: an aperture grille, seen up close.
            background: `repeating-linear-gradient(
              90deg,
              rgba(255,0,0,${crt.apertureOpacity}) 0px,
              rgba(0,255,0,${crt.apertureOpacity}) 1px,
              rgba(0,0,255,${crt.apertureOpacity}) 2px,
              rgba(0,0,0,0) 3px
            )`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}

      {crt.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(120% 85% at 50% 50%,
              rgba(0,0,0,0) 45%,
              rgba(0,0,0,${crt.vignette * 0.5}) 78%,
              rgba(0,0,0,${crt.vignette}) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
