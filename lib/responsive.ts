/**
 * HealPoint - responsive layout helpers.
 *
 * Breakpoints are based on the actual rendered window/device width (never
 * user-agent sniffing), so the same layout rules apply on web, tablets and
 * phones. The auth flow uses these to keep forms centred and width-capped so
 * inputs and cards never stretch across an entire desktop screen.
 */
import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  /** Tablets, large phones in landscape and small desktop windows. */
  tablet: 768,
  /** True desktop / wide laptop viewports. */
  desktop: 1024,
} as const;

export type ResponsiveVariant = 'mobile' | 'tablet' | 'desktop';

export function variantForWidth(width: number): ResponsiveVariant {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

/** Reactive layout variant for the current window width. */
export function useResponsiveVariant(): ResponsiveVariant {
  const { width } = useWindowDimensions();
  return variantForWidth(width);
}

/**
 * Max width of the auth form card. Keeps input fields thumb-friendly on phones
 * while preventing them from turning into full-browser-width fields on desktop.
 */
export const AUTH_CARD_MAX_WIDTH = 460;

/**
 * Max width of the auth column on tablet / centred desktop layouts. Wider than
 * the card so the card (with its own cap) stays comfortably centred inside it.
 */
export const AUTH_COLUMN_MAX_WIDTH = 520;
