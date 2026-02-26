import type {ThemeMode} from '../types/models';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999
} as const;

export const typography = {
  h1: {fontSize: 30, lineHeight: 36, fontWeight: '800' as const},
  h2: {fontSize: 24, lineHeight: 30, fontWeight: '800' as const},
  h3: {fontSize: 19, lineHeight: 24, fontWeight: '700' as const},
  body: {fontSize: 15, lineHeight: 21, fontWeight: '500' as const},
  bodySm: {fontSize: 13, lineHeight: 18, fontWeight: '500' as const},
  caption: {fontSize: 12, lineHeight: 16, fontWeight: '600' as const}
};

const lightColors = {
  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceSoft: '#F0F4FF',
  text: '#0B1220',
  textMuted: '#516079',
  border: '#E3EAF6',
  primary: '#1B4FCB',
  primarySoft: '#F0F4FF',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
  tabIcon: '#7B8AA6',
  shadow: '#0B1E3C',
  status: {
    confirmed: '#1B4FCB',
    pending: '#F59E0B',
    completed: '#16A34A',
    no_show: '#DC2626',
    canceled: '#64748B',
    blocked: '#334155'
  }
};

const darkColors = {
  background: '#0B1220',
  surface: '#111A2D',
  surfaceSoft: '#16233A',
  text: '#EAF1FC',
  textMuted: '#9BA9C3',
  border: '#22324E',
  primary: '#5A8BFF',
  primarySoft: '#1A2A4C',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#4ADE80',
  tabIcon: '#8EA0BD',
  shadow: '#000000',
  status: {
    confirmed: '#5A8BFF',
    pending: '#FBBF24',
    completed: '#4ADE80',
    no_show: '#F87171',
    canceled: '#94A3B8',
    blocked: '#64748B'
  }
};

export const shadows = {
  card: {
    shadowColor: '#0B1E3C',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 2
  }
};

export type ThemeTokens = {
  mode: ThemeMode;
  colors: typeof lightColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

export function makeTheme(mode: ThemeMode): ThemeTokens {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography
  };
}
