/**
 * Design tokens.
 *
 * The language is archival: a near-monochrome paper-grey canvas, photographs
 * as the only real colour, and a single muted sage for anything actionable.
 * Names, dates and section labels are set in letterspaced uppercase monospace
 * — the typographic move that makes the whole thing read like a catalogued
 * family archive rather than an org chart.
 */

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  canvas: string;
  /** Faint band dividing one generation row from the next. */
  canvasBand: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  danger: string;
  dangerSoft: string;
  /** Hairline used for every connector on the tree canvas. */
  line: string;
  /** Abstract place tiles. */
  placeBg: string;
  placeLand: string;
  placePin: string;
  overlay: string;
  lightbox: string;
  shadow: string;
};

export const lightPalette: Palette = {
  scheme: 'light',
  bg: '#F0EFED',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F6F4',
  surfaceSunken: '#E8E7E4',
  canvas: '#EFEEEC',
  canvasBand: 'rgba(23, 23, 20, 0.019)',
  text: '#1A1A18',
  textMuted: '#8B8A84',
  textFaint: '#B5B3AD',
  border: '#E3E2DE',
  borderStrong: '#D1CFC9',
  accent: '#6B8D57',
  accentSoft: 'rgba(107, 141, 87, 0.12)',
  accentText: '#FFFFFF',
  danger: '#A8453C',
  dangerSoft: 'rgba(168, 69, 60, 0.11)',
  line: '#CBC9C3',
  placeBg: '#DEEFD6',
  placeLand: '#A4DD91',
  placePin: '#1F3D18',
  overlay: 'rgba(26, 26, 24, 0.32)',
  lightbox: 'rgba(12, 12, 11, 0.94)',
  shadow: '#3B3A33',
};

export const darkPalette: Palette = {
  scheme: 'dark',
  bg: '#131312',
  bgElevated: '#1D1D1B',
  surface: '#1C1C1A',
  surfaceAlt: '#242422',
  surfaceSunken: '#0E0E0D',
  canvas: '#141413',
  canvasBand: 'rgba(240, 238, 230, 0.022)',
  text: '#F1F0EB',
  textMuted: '#93918A',
  textFaint: '#6B6962',
  border: '#2C2C29',
  borderStrong: '#3F3E3A',
  accent: '#9CBE85',
  accentSoft: 'rgba(156, 190, 133, 0.15)',
  accentText: '#141A10',
  danger: '#D98078',
  dangerSoft: 'rgba(217, 128, 120, 0.15)',
  line: '#3B3A36',
  placeBg: '#1E2419',
  placeLand: '#466F39',
  placePin: '#D4EFC8',
  overlay: 'rgba(0, 0, 0, 0.6)',
  lightbox: 'rgba(0, 0, 0, 0.95)',
  shadow: '#000000',
};

/** Exact font files, since fontWeight does not select a face on native. */
export const fonts = {
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

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
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Two families on purpose: monospace carries identity (names, dates, labels),
 * the system sans carries anything someone wrote in prose.
 */
export const type = {
  // Monospace — identity and metadata.
  nameXL: { fontFamily: fonts.monoMedium, fontSize: 23, lineHeight: 29, letterSpacing: 1.8, textTransform: 'uppercase' },
  nameLG: { fontFamily: fonts.monoMedium, fontSize: 17, lineHeight: 23, letterSpacing: 1.3, textTransform: 'uppercase' },
  nameSM: { fontFamily: fonts.monoMedium, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.5, textTransform: 'uppercase' },
  data: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, letterSpacing: 1.1 },
  dataSM: { fontFamily: fonts.mono, fontSize: 8.5, lineHeight: 12, letterSpacing: 0.4 },
  sectionLabel: { fontFamily: fonts.monoMedium, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' },
  relation: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  year: { fontFamily: fonts.monoSemiBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.8 },
  yearSM: { fontFamily: fonts.monoSemiBold, fontSize: 9, lineHeight: 12, letterSpacing: 0.3 },

  // System sans — prose.
  display: { fontSize: 27, lineHeight: 33, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '650' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 13.5, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: '400' },
} as const;

/** Screens stop growing past this so the web build never reads like a stretched phone app. */
export const contentMaxWidth = 760;

/** Above this the person detail becomes a side panel instead of a bottom sheet. */
export const panelBreakpoint = 900;
export const detailPanelWidth = 404;
