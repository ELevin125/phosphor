import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { useLayout } from './LayoutProfile';
import { useTheme } from './ThemeContext';

/**
 * How far the starfield extends past the canvas on each side.
 *
 * The field has to be bigger than the frame or a parallaxing camera drags its
 * edge into shot. This is sized for the largest board move that still reads —
 * roughly two cells at the default parallax.
 */
const STAR_MARGIN = 900;

/**
 * A seeded starfield.
 *
 * Seeded with Remotion's `random`, never `Math.random`: the component tree is
 * re-evaluated every frame, so unseeded randomness would re-roll the entire sky
 * 30 times a second and strobe.
 *
 * Sparkles are the four-point stars from the logo, drawn as two crossed
 * quadratic diamonds rather than a plus sign, so they taper.
 */
const Starfield: React.FC<{ readonly offset: { x: number; y: number } }> = ({ offset }) => {
  const { backdrop } = useTheme();
  const { stars } = backdrop;
  const { canvas } = useLayout();
  if (stars.count <= 0) {
    return null;
  }

  const w = canvas.width + STAR_MARGIN * 2;
  const h = canvas.height + STAR_MARGIN * 2;

  const points = Array.from({ length: stars.count }, (_, i) => {
    const x = random(`star-x-${i}`) * w;
    const y = random(`star-y-${i}`) * h;
    const r = (0.35 + random(`star-r-${i}`) * 0.65) * stars.maxRadius;
    // Small stars stay faint; the few big ones carry the eye.
    const o = 0.25 + random(`star-o-${i}`) * 0.75;
    const sparkle = random(`star-s-${i}`) < stars.sparkleRatio;
    return { x, y, r, o, sparkle, i };
  });

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute',
        left: -STAR_MARGIN + offset.x,
        top: -STAR_MARGIN + offset.y,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      {points.map((p) =>
        p.sparkle ? (
          <path
            key={p.i}
            d={`M ${p.x} ${p.y - p.r * 3.2}
                Q ${p.x + p.r * 0.5} ${p.y - p.r * 0.5} ${p.x + p.r * 3.2} ${p.y}
                Q ${p.x + p.r * 0.5} ${p.y + p.r * 0.5} ${p.x} ${p.y + p.r * 3.2}
                Q ${p.x - p.r * 0.5} ${p.y + p.r * 0.5} ${p.x - p.r * 3.2} ${p.y}
                Q ${p.x - p.r * 0.5} ${p.y - p.r * 0.5} ${p.x} ${p.y - p.r * 3.2} Z`}
            fill={stars.color}
            opacity={p.o}
          />
        ) : (
          <circle key={p.i} cx={p.x} cy={p.y} r={p.r} fill={stars.color} opacity={p.o} />
        ),
      )}
    </svg>
  );
};

/**
 * Deterministic film grain, as an inline SVG turbulence pattern.
 *
 * Two jobs: it stops large smooth gradients banding into visible steps at
 * h264 bitrates, and it gives `backdrop-filter` fine detail to chew on so
 * glass panels read as frosted rather than merely translucent.
 */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Everything painted behind the beats. Flat colour for most themes; layered
 * gradients (or a blurred still) for glass themes that need something to blur.
 */
export const Backdrop: React.FC<{
  /** Camera-driven parallax offset for the starfield. Board layout only. */
  readonly starOffset?: { readonly x: number; readonly y: number };
}> = ({ starOffset }) => {
  const theme = useTheme();
  const { backdrop } = theme;

  return (
    // Exempt from the layout law: the backdrop is meant to fill the frame edge
    // to edge, so measuring its starfield against the content box would report
    // every video as broken. See src/kit/Probe.tsx.
    <AbsoluteFill data-phosphor="decor" style={{ overflow: 'hidden' }}>
      {backdrop.image ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img
            src={staticFile(backdrop.image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // Blurring past the edges avoids a soft vignette of bare
              // background where the blur kernel runs out of pixels.
              filter: `blur(${backdrop.imageBlur}px)`,
              transform: 'scale(1.12)',
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: backdrop.css }} />
      )}

      <Starfield offset={starOffset ?? { x: 0, y: 0 }} />

      {backdrop.veil !== 'transparent' ? (
        <AbsoluteFill style={{ background: backdrop.veil }} />
      ) : null}

      {backdrop.grain > 0 ? (
        <AbsoluteFill
          style={{
            backgroundImage: GRAIN_URL,
            backgroundRepeat: 'repeat',
            opacity: backdrop.grain,
            mixBlendMode: 'overlay',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
