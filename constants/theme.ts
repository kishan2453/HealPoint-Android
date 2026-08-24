/**
 * HealPoint - Healthcare design system.
 *
 * Single source of truth for colors, spacing, radius, typography and shadows
 * used across the patient client. Kept dependency-free and platform neutral.
 */
import { Platform, type TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Base palette
// ---------------------------------------------------------------------------
export const Palette = {
  // Brand
  primary: '#0E9F8E',
  primaryDark: '#0B857B',
  primaryLight: '#E2F6F2',
  accent: '#22A7A0',
  // Neutrals
  background: '#F4F8F7',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#12211E',
  textMuted: '#5F6F6C',
  border: '#E1EAE7',
  divider: '#EDF2F0',
  // Status
  error: '#D9435B',
  success: '#2E9E5B',
  warning: '#E89A3C',
  info: '#2F80ED',
  gold: '#F2B705',
  white: '#FFFFFF',
  black: '#0B0F0E',
  overlay: 'rgba(9, 20, 18, 0.55)',
  facebook: '#1877F2',
  google: '#EA4335',
} as const;

// ---------------------------------------------------------------------------
// Colors map kept for compatibility with the starter layout/components.
// Each variant maps to the healthcare palette so the whole app is on-theme.
// ---------------------------------------------------------------------------
export const Colors = {
  light: {
    text: Palette.text,
    background: Palette.background,
    tint: Palette.primary,
    icon: Palette.textMuted,
    tabIconDefault: '#94A8A3',
    tabIconSelected: Palette.primary,
    card: Palette.surface,
    border: Palette.border,
    primary: Palette.primary,
    primaryDark: Palette.primaryDark,
    primaryLight: Palette.primaryLight,
    error: Palette.error,
    success: Palette.success,
    warning: Palette.warning,
    info: Palette.info,
    gold: Palette.gold,
    muted: Palette.textMuted,
  },
  dark: {
    text: '#E8EFED',
    background: '#0F1715',
    tint: '#3FD4C0',
    icon: '#9DB0AB',
    tabIconDefault: '#51706A',
    tabIconSelected: '#3FD4C0',
    card: '#16211E',
    border: '#263330',
    primary: '#3FD4C0',
    primaryDark: '#2BB5A3',
    primaryLight: '#123C36',
    error: '#F06B82',
    success: '#46C278',
    warning: '#F0A94A',
    info: '#5AA0F0',
    gold: '#F2C94C',
    muted: '#8BA09B',
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing scale (8pt grid)
// ---------------------------------------------------------------------------
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Typography = {
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700' } as TextStyle,
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '700' } as TextStyle,
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '600' } as TextStyle,
  h4: { fontSize: 17, lineHeight: 22, fontWeight: '600' } as TextStyle,
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' } as TextStyle,
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' } as TextStyle,
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' } as TextStyle,
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' } as TextStyle,
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' } as TextStyle,
} as const;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  }),
  navbar: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

// Kept for compatibility with starter files that reference Fonts directly.
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  android: { sans: 'sans-serif', serif: 'serif', rounded: 'sans-serif-medium', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
}) as { sans: string; serif: string; rounded: string; mono: string } & Record<string, string>;
