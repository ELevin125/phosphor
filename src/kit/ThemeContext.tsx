import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_THEME, getTheme, type Theme, type ThemeSpec, type TypeScale } from '../theme';
import { useLayout } from './LayoutProfile';
import { PROFILES, DEFAULT_PROFILE } from './layout';

/**
 * Resolves a theme's type ratios into pixels for a frame.
 *
 * This is the whole of the profile-aware typography change: a theme says the
 * title is 2.2x body, the profile says what body is, and one multiplication
 * later every component reads `theme.type.size.title` exactly as it always did.
 * See docs/DECISIONS.md#d010.
 */
export const resolveTheme = (spec: ThemeSpec, typeBase: number): Theme => {
  const { scale } = spec.type;
  const size = Object.fromEntries(
    Object.entries(scale).map(([k, ratio]) => [k, Math.round(ratio * typeBase)]),
  ) as unknown as TypeScale;

  return { ...spec, type: { ...spec.type, size } };
};

/**
 * Defaulted rather than left empty, so a component rendered outside a `Stage`
 * — in a test, or the studio's component preview — still has sizes rather than
 * crashing on `undefined`.
 */
const ThemeContext = createContext<Theme>(
  resolveTheme(getTheme(DEFAULT_THEME), PROFILES[DEFAULT_PROFILE].typeBase),
);

export const ThemeProvider: React.FC<{
  readonly theme: ThemeSpec;
  readonly children: React.ReactNode;
}> = ({ theme, children }) => {
  // Reads the profile from context, so this must sit inside `LayoutProvider`.
  // Stage arranges exactly that.
  const { typeBase } = useLayout();
  const resolved = useMemo(() => resolveTheme(theme, typeBase), [theme, typeBase]);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
};

/** Every kit component pulls its visual values from here. */
export const useTheme = (): Theme => useContext(ThemeContext);
