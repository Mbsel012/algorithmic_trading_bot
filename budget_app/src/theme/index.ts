/** Colour, spacing and type scales. One place to restyle the whole app. */

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  positive: string;
  negative: string;
  warning: string;
  overlay: string;
  tabBar: string;
  track: string;
};

const light: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  border: '#E2E6EC',
  text: '#0F1720',
  textMuted: '#5A6674',
  textFaint: '#8E99A6',
  primary: '#16A34A',
  primaryText: '#FFFFFF',
  positive: '#16A34A',
  negative: '#DC2626',
  warning: '#D97706',
  overlay: 'rgba(15, 23, 32, 0.45)',
  tabBar: '#FFFFFF',
  track: '#E6EAF0',
};

const dark: Palette = {
  background: '#0F1720',
  surface: '#18212C',
  surfaceAlt: '#1F2A37',
  border: '#2A3644',
  text: '#F2F5F8',
  textMuted: '#9BA8B6',
  textFaint: '#6B7887',
  primary: '#22C55E',
  primaryText: '#08130C',
  positive: '#4ADE80',
  negative: '#F87171',
  warning: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#131C25',
  track: '#26313D',
};

export const palettes = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 30,
  display: 38,
} as const;

export type Theme = {
  colors: Palette;
  dark: boolean;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
};

export function makeTheme(isDark: boolean): Theme {
  return { colors: isDark ? dark : light, dark: isDark, spacing, radius, fontSize };
}
