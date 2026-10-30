/**
 * HealPoint - Healthcare design system.
 *
 * Single source of truth for colors, spacing, radius, typography and shadows
 * used across the patient client. Kept dependency-free and platform neutral.
 */
import { Platform, type TextStyle } from "react-native";

// ---------------------------------------------------------------------------
// Base palette
// ---------------------------------------------------------------------------
export const Palette = {
  // Brand (HealPoint Liquid Glass Blue Identity)
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#EFF6FF",
  accent: "#60A5FA",
  accentLight: "#DBEAFE",
  // Neutrals & Glass
  background: "#F8FAFC",
  surface: "rgba(255, 255, 255, 0.90)",
  surfaceAlt: "#F1F5F9",
  elevated: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#64748B",
  border: "rgba(226, 232, 240, 0.8)",
  borderGlass: "rgba(191, 219, 254, 0.45)",
  borderGlassHighlight: "rgba(255, 255, 255, 0.70)",
  divider: "rgba(226, 232, 240, 0.7)",
  // Status
  error: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#2563EB",
  gold: "#F59E0B",
  white: "#FFFFFF",
  black: "#0F172A",
  overlay: "rgba(15, 23, 42, 0.60)",
  facebook: "#1877F2",
  google: "#EA4335",
} as const;

// ---------------------------------------------------------------------------
// Reusable Liquid Glass Surface presets
// ---------------------------------------------------------------------------
export const Glass = {
  level1: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderColor: "rgba(226, 232, 240, 0.70)",
    borderWidth: 1,
  },
  level2: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "rgba(226, 232, 240, 0.85)",
    borderWidth: 1,
  },
  level3: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderColor: "rgba(191, 219, 254, 0.50)",
    borderWidth: 1,
  },
  level4: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(226, 232, 240, 0.90)",
    borderWidth: 1,
  },
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
    tabIconDefault: "#94A3B8",
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
    text: "#F8FAFC",
    background: "#0B1120",
    tint: "#60A5FA",
    icon: "#94A3B8",
    tabIconDefault: "#64748B",
    tabIconSelected: "#60A5FA",
    card: "rgba(15, 23, 42, 0.88)",
    border: "rgba(51, 65, 85, 0.6)",
    primary: "#60A5FA",
    primaryDark: "#3B82F6",
    primaryLight: "#1E293B",
    error: "#F87171",
    success: "#34D399",
    warning: "#FBBF24",
    info: "#60A5FA",
    gold: "#FBBF24",
    muted: "#94A3B8",
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
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "700" } as TextStyle,
  h2: { fontSize: 24, lineHeight: 30, fontWeight: "700" } as TextStyle,
  h3: { fontSize: 20, lineHeight: 26, fontWeight: "600" } as TextStyle,
  h4: { fontSize: 17, lineHeight: 22, fontWeight: "600" } as TextStyle,
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" } as TextStyle,
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "500" } as TextStyle,
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: "400" } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" } as TextStyle,
  label: { fontSize: 14, lineHeight: 18, fontWeight: "600" } as TextStyle,
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600" } as TextStyle,
} as const;

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.02,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }),
  card: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: { elevation: 3 },
    default: {},
  }),
  navbar: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.03,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

// Kept for compatibility with starter files that reference Fonts directly.
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  android: {
    sans: "sans-serif",
    serif: "serif",
    rounded: "sans-serif-medium",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
}) as { sans: string; serif: string; rounded: string; mono: string } & Record<
  string,
  string
>;
