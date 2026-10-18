import { createContext, useContext, type ReactNode } from 'react';

import { darkTheme } from './dark';
import { lightTheme, type Theme } from './light';

const ThemeContext = createContext<Theme>(lightTheme);

type ThemeProviderProps = {
  scheme?: 'light' | 'dark';
  children: ReactNode;
};

export function ThemeProvider({ scheme = 'light', children }: ThemeProviderProps) {
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
