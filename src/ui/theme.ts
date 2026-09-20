import { Appearance, useColorScheme } from 'react-native';

/**
 * Design tokens.
 *
 * Money apps get read in bright supermarket aisles and dark restaurants, so
 * both schemes are first-class rather than dark being a tint of light.
 */

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  positive: string;
  warning: string;
  danger: string;
}

const light: Palette = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F5',
  border: '#E2E5EA',
  text: '#11151C',
  textMuted: '#5A6372',
  textFaint: '#8B94A3',
  accent: '#1F6FEB',
  accentText: '#FFFFFF',
  positive: '#12855A',
  warning: '#B26A00',
  danger: '#C0392B',
};

const dark: Palette = {
  bg: '#0B0E13',
  surface: '#151A22',
  surfaceAlt: '#1E242E',
  border: '#2A313D',
  text: '#F2F4F8',
  textMuted: '#A4AEBF',
  textFaint: '#6F7A8C',
  accent: '#4D8DF6',
  accentText: '#08101F',
  positive: '#3ECF8E',
  warning: '#E5A33D',
  danger: '#F2705F',
};

export function palette(): Palette {
  return Appearance.getColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22 } as const;

export const type = {
  display: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

/** Currency formatting used everywhere a dollar figure is shown. */
export function money(n: number, cents = true): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function points(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Palette bound to the live color scheme.
 *
 * Prefer this over `palette()` inside components: `Appearance.getColorScheme()`
 * is read once and will not re-render when the user flips to dark mode.
 */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
