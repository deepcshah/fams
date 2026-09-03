import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useFamilyStore } from '@/store/familyStore';

import { darkPalette, generationColor, lightPalette, radius, space, type, type Palette } from './tokens';

export type Theme = {
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  isDark: boolean;
  generationColor: (generation: number) => string;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useFamilyStore((state) => state.settings.colorScheme);

  const value = useMemo<Theme>(() => {
    const resolved = preference === 'system' ? (systemScheme ?? 'light') : preference;
    const isDark = resolved === 'dark';
    const colors = isDark ? darkPalette : lightPalette;
    return {
      colors,
      space,
      radius,
      type,
      isDark,
      generationColor: (generation: number) => generationColor(isDark ? 'dark' : 'light', generation),
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

export * from './tokens';
