import React, { createContext, useContext } from 'react';
import { DEFAULT_THEME, getTheme, type Theme } from '../theme';

const ThemeContext = createContext<Theme>(getTheme(DEFAULT_THEME));

export const ThemeProvider: React.FC<{
  readonly theme: Theme;
  readonly children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

/** Every kit component pulls its visual values from here. */
export const useTheme = (): Theme => useContext(ThemeContext);
