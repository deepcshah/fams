/**
 * Design tokens. The palette is warm and paper-like rather than the usual
 * cool product blue — a family tree should read like an heirloom document.
 */

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  canvas: string;
  canvasGrid: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  sage: string;
  sageSoft: string;
  danger: string;
  dangerSoft: string;
  line: string;
  lineSoft: string;
  overlay: string;
  shadow: string;
};

export const lightPalette: Palette = {
  scheme: 'light',
  bg: '#FAF6F0',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F2EBE1',
  surfaceSunken: '#EFE7DB',
  canvas: '#F6F1E9',
  canvasGrid: 'rgba(120, 104, 84, 0.10)',
  text: '#1B1713',
  textMuted: '#6E6559',
  textFaint: '#9C9184',
  border: '#E5DCCF',
  borderStrong: '#D3C7B5',
  accent: '#A9502C',
  accentSoft: 'rgba(169, 80, 44, 0.12)',
  accentText: '#FFFFFF',
  sage: '#4F7059',
  sageSoft: 'rgba(79, 112, 89, 0.14)',
  danger: '#A32F2F',
  dangerSoft: 'rgba(163, 47, 47, 0.12)',
  line: '#C3B5A0',
  lineSoft: '#DCD2C2',
  overlay: 'rgba(27, 23, 19, 0.35)',
  shadow: '#4A3D2C',
};

export const darkPalette: Palette = {
  scheme: 'dark',
  bg: '#141210',
  bgElevated: '#1D1A16',
  surface: '#1E1B17',
  surfaceAlt: '#272220',
  surfaceSunken: '#100E0C',
  canvas: '#16130F',
  canvasGrid: 'rgba(233, 216, 190, 0.07)',
  text: '#F4EEE4',
  textMuted: '#A79C8D',
  textFaint: '#7A7061',
  border: '#332C25',
  borderStrong: '#463C31',
  accent: '#E0855A',
  accentSoft: 'rgba(224, 133, 90, 0.16)',
  accentText: '#20150F',
  sage: '#8FB39A',
  sageSoft: 'rgba(143, 179, 154, 0.16)',
  danger: '#E28080',
  dangerSoft: 'rgba(226, 128, 128, 0.16)',
  line: '#4E4438',
  lineSoft: '#3A322A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

/** Per-generation accents, used for the ribbon on each card. */
export const generationHues = {
  light: ['#8C6239', '#4F7059', '#5B6B8C', '#8A5670', '#7A6A3D', '#4C7079'],
  dark: ['#C79A6B', '#8FB39A', '#93A3C4', '#C08FA5', '#B5A472', '#7FA8B2'],
} as const;

export function generationColor(scheme: 'light' | 'dark', generation: number): string {
  const hues = generationHues[scheme];
  return hues[((generation % hues.length) + hues.length) % hues.length];
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, lineHeight: 35, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '650' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8 },
} as const;

/** Screens stop growing past this so the web build never reads like a stretched phone app. */
export const contentMaxWidth = 760;
