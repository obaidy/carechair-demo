import {createContext, useContext, useMemo, type ReactNode} from 'react';
import {useUiStore} from '../state/uiStore';
import {makeTheme, type ThemeTokens} from './tokens';

const ThemeContext = createContext<ThemeTokens>(makeTheme('light'));

export function ThemeProvider({children}: {children: ReactNode}) {
  const mode = useUiStore((state) => state.themeMode);
  const value = useMemo(() => makeTheme(mode), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
