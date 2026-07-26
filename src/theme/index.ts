import { brut } from './brut';
import { cosmic } from './cosmic';
import { debugview } from './debugview';
import { garage } from './garage';
import { gizmo } from './gizmo';
import { midnight } from './midnight';
import { neon } from './neon';
import { nightdrive } from './nightdrive';
import { paper } from './paper';
import { ps1 } from './ps1';
import type { Theme } from './types';

export type { Theme, SpringPreset, Gesture, ThemeGestures } from './types';

export const themes = { neon, paper, brut, midnight, garage, debugview, ps1, cosmic, nightdrive, gizmo } as const;

export type ThemeName = keyof typeof themes;

export const themeNames = Object.keys(themes) as ThemeName[];

/**
 * The theme every composition uses unless it is overridden by the `theme`
 * prop. This is the one-line change that reskins every video.
 */
export const DEFAULT_THEME: ThemeName = 'cosmic';

export const getTheme = (name: ThemeName | undefined): Theme =>
  themes[name ?? DEFAULT_THEME] ?? themes[DEFAULT_THEME];
