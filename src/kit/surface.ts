import type React from 'react';
import { useTheme } from './ThemeContext';

/**
 * The panel treatment, in one place.
 *
 * Box, Callout and CodePanel all render "a themed panel", and glass has to be
 * applied identically across them or the frosted look falls apart at the seams.
 * Adding a surface treatment means editing this function, not three components.
 */
export const useSurfaceStyle = (opts?: {
  /** Border colour override — used by toned Boxes and Callouts. */
  readonly borderColor?: string;
  /** Use the code-panel fill rather than the generic surface fill. */
  readonly code?: boolean;
  readonly strongShadow?: boolean;
}): React.CSSProperties => {
  const theme = useTheme();
  const { glass, colors, shape } = theme;

  const background = glass.enabled
    ? opts?.code
      ? colors.codeBg
      : colors.surface
    : opts?.code
      ? colors.codeBg
      : colors.surface;

  const base: React.CSSProperties = {
    // Decor overlays position against the panel.
    position: 'relative',
    background,
    border: `${shape.borderWidth}px solid ${opts?.borderColor ?? colors.border}`,
    borderRadius: shape.radiusMd,
    boxShadow: opts?.strongShadow ? shape.shadowStrong : shape.shadow,
  };

  if (!glass.enabled) {
    return base;
  }

  return {
    ...base,
    // The blur is what makes the backdrop read as frosted rather than tinted.
    backdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturate})`,
    WebkitBackdropFilter: `blur(${glass.blurPx}px) saturate(${glass.saturate})`,
    // A bright top edge plus a soft inner glow: how real glass catches light.
    boxShadow: `${opts?.strongShadow ? shape.shadowStrong : shape.shadow}, inset 0 1px 0 ${glass.hairline}`,
  };
};
