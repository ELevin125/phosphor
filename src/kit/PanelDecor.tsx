import React from 'react';
import { random } from 'remotion';
import { useTheme } from './ThemeContext';

/**
 * Ornament drawn inside a themed panel.
 *
 * Purely decorative: which mark appears (and whether one appears at all) is
 * chosen by a seeded RNG, so nothing here may ever carry information the
 * viewer needs. `random()` is Remotion's seeded generator rather than
 * `Math.random` — the same panel must decorate identically on every frame or
 * the mark will flicker for the whole render.
 */
export const PanelDecor: React.FC<{
  /** Stable per-panel string. Same seed = same mark, every frame. */
  readonly seed?: string;
}> = ({ seed = 'panel' }) => {
  const theme = useTheme();
  const { decor } = theme;

  if (decor.kind === 'none') {
    return null;
  }

  if (decor.kind === 'stencil') {
    // "Occasional", per the theme's frequency — not on every panel.
    if (random(`${seed}-show`) > decor.frequency) {
      return null;
    }
    const glyph =
      decor.glyphs[Math.floor(random(`${seed}-glyph`) * decor.glyphs.length)] ??
      decor.glyphs[0];

    return (
      <span
        style={{
          position: 'absolute',
          top: 14,
          right: 20,
          zIndex: 2,
          pointerEvents: 'none',
          color: decor.color,
          opacity: decor.opacity,
          fontFamily: decor.fontFamily ?? theme.type.mono,
          fontSize: theme.type.size.label,
          letterSpacing: '0.22em',
          userSelect: 'none',
        }}
      >
        {glyph}
      </span>
    );
  }

  // 'bounds' — corner brackets plus a coordinate readout, on everything,
  // including things that plainly do not need a bounding box.
  const len = 20;
  const w = 2;
  const corner = (v: 'top' | 'bottom', h: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [v]: -1,
    [h]: -1,
    width: len,
    height: len,
    [`border${v === 'top' ? 'Top' : 'Bottom'}`]: `${w}px solid ${decor.color}`,
    [`border${h === 'left' ? 'Left' : 'Right'}`]: `${w}px solid ${decor.color}`,
    opacity: decor.opacity,
    pointerEvents: 'none',
    zIndex: 2,
  });

  const x = Math.floor(random(`${seed}-x`) * 512);
  const y = Math.floor(random(`${seed}-y`) * 512);

  return (
    <>
      <div style={corner('top', 'left')} />
      <div style={corner('top', 'right')} />
      <div style={corner('bottom', 'left')} />
      <div style={corner('bottom', 'right')} />
      <span
        style={{
          position: 'absolute',
          bottom: 6,
          right: 10,
          zIndex: 2,
          pointerEvents: 'none',
          color: decor.color,
          opacity: decor.opacity,
          fontFamily: decor.fontFamily ?? theme.type.mono,
          fontSize: 20,
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}
      >
        {`x:${x} y:${y}`}
      </span>
    </>
  );
};
