import { gizmo } from './gizmo';
import type { ThemeSpec } from './types';

export type {
  Theme,
  ThemeSpec,
  TypeScale,
  SpringPreset,
  Gesture,
  ThemeGestures,
} from './types';

/**
 * One theme.
 *
 * There were ten. Nine of them shipped zero videos, and every new token in
 * `types.ts` cost ten hand-written blocks to add — which is the tax that made
 * profile-aware type sizing (and therefore landscape) expensive enough to keep
 * putting off.
 *
 * The token contract in `types.ts` stays exactly as it was. It is what keeps
 * visual values out of `src/kit` and `projects`, and it is what a second theme
 * would slot into if one is ever wanted. What went away is the *cross-product*
 * — one theme means one composition per project, not ten.
 */
export const themes = { gizmo } as const;

export type ThemeName = keyof typeof themes;

export const themeNames = Object.keys(themes) as ThemeName[];

/** The theme every composition uses unless overridden by the `theme` prop. */
export const DEFAULT_THEME: ThemeName = 'gizmo';

export const getTheme = (name: ThemeName | undefined): ThemeSpec =>
  themes[name ?? DEFAULT_THEME] ?? themes[DEFAULT_THEME];
