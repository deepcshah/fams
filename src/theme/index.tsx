import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-mono';

import { useFamilyStore } from '@/store/familyStore';

import {
  darkPalette,
  lightPalette,
  panelBreakpoint,
  radius,
  space,
  type,
  type Palette,
} from './tokens';

export type Theme = {
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  isDark: boolean;
  /** True once the viewport is wide enough for a side detail panel. */
  wide: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

/** Loads the monospace faces. Returns true once rendering may proceed. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  // On failure we still render; the platform falls back to its own monospace.
  return loaded || error !== null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useFamilyStore((state) => state.settings.colorScheme);
  const { width } = useWindowDimensions();

  const value = useMemo<Theme>(() => {
    const resolved = preference === 'system' ? (systemScheme ?? 'light') : preference;
    const isDark = resolved === 'dark';
    return {
      colors: isDark ? darkPalette : lightPalette,
      space,
      radius,
      type,
      isDark,
      wide: width >= panelBreakpoint,
    };
  }, [preference, systemScheme, width]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}


export * from './tokens';
