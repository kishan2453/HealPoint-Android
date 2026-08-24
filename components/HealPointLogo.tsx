/**
 * HealPoint - premium brand lockup.
 *
 * A refined healthcare identity: a rounded-square mark with a soft two-tone
 * (gradient-like) depth, a white medical cross and a subtle heartbeat accent,
 * paired with the HealPoint wordmark. Used on the splash, welcome, login and
 * sign-up screens so the whole authentication flow shares one consistent,
 * professional identity.
 *
 * The mark is built purely from layered Views — no native gradient dependency.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Shadows, Typography } from '@/constants/theme';

interface HealPointLogoProps {
  /** Size of the square mark in px. Default 72. */
  size?: number;
  /** Render the wordmark next to / below the mark. Default true. */
  showWordmark?: boolean;
  /** Wordmark placement relative to the mark. */
  layout?: 'horizontal' | 'vertical';
  light?: boolean;
  /**
   * Wrap the mark in a soft circular host (used on auth screens for a premium
   * badge presentation). Ignored when `layout` is horizontal.
   */
  badge?: boolean;
}

export function HealPointLogo({
  size = 72,
  showWordmark = true,
  layout = 'vertical',
  light = false,
  badge = false,
}: HealPointLogoProps) {
  const cross = Math.round(size * 0.15); // bar thickness
  const long = Math.round(size * 0.52); // long bar length
  const short = Math.round(size * 0.3); // short bar length
  const radius = Math.round(size * (size >= 72 ? 0.24 : 0.22));

  const brandPrimary = light ? '#3FD4C0' : Palette.primaryDark;
  const brandBase = light ? Palette.white : Palette.text;

  const mark = (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: Palette.primary,
        },
        Shadows.card,
      ]}
      accessibilityLabel="HealPoint logo"
    >
      {/* Soft top-left highlight + deep bottom accent (gradient feel). */}
      <View
        pointerEvents="none"
        style={[styles.highlight, { top: -size * 0.28, left: -size * 0.2, width: size * 0.9, height: size * 0.9 }]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.shade,
          { bottom: -size * 0.32, right: -size * 0.22, width: size * 0.78, height: size * 0.78, backgroundColor: Palette.primaryDark },
        ]}
      />
      <View pointerEvents="none" style={styles.ring} />

      {/* Medical cross (long vertical bar + shorter horizontal bar). */}
      <View style={[styles.crossVertical, { width: cross, height: long, borderRadius: Math.round(cross / 3) }]} />
      <View style={[styles.crossHorizontal, { width: short, height: cross, borderRadius: Math.round(cross / 3) }]} />

      {/* Heartbeat pulse accent crossing the mark. */}
      <View pointerEvents="none" style={styles.pulse}>
        <View style={[styles.pulseSegment, { height: Math.max(2, cross * 0.3), top: size * 0.27 }]} />
        <View style={[styles.pulseSlopeUp, { width: cross * 0.5, height: cross * 0.5, top: size * 0.27 }]} />
        <View style={[styles.pulsePeak, { width: cross * 0.36, height: cross * 0.36, top: size * 0.36 }]} />
        <View style={[styles.pulseSlopeDown, { width: cross * 0.5, height: cross * 0.5, top: size * 0.27 }]} />
        <View style={[styles.pulseSegment, { height: Math.max(2, cross * 0.3), top: size * 0.27 }]} />
      </View>
    </View>
  );

  // Horizontal lockup (drawer / small headers) scales the wordmark to the mark.
  const brandFont = layout === 'horizontal' ? Math.max(18, Math.min(30, Math.round(size * 0.55))) : undefined;

  const wordmark = (
    <View style={styles.wordmark}>
      <Text style={[styles.brand, layout === 'horizontal' && { fontSize: brandFont }, { color: brandBase }]}>
        Heal<Text style={{ color: brandPrimary }}>Point</Text>
      </Text>
      {layout === 'vertical' ? (
        <Text style={[styles.tagline, { color: light ? 'rgba(255,255,255,0.75)' : Palette.textMuted }]}>
          Your health, simplified
        </Text>
      ) : null}
    </View>
  );

  const badgeSize = size + Math.round(size * 0.52);

  return (
    <View
      style={[
        styles.container,
        layout === 'horizontal' ? styles.row : styles.column,
        { gap: layout === 'horizontal' ? Math.round(size * 0.24) : Math.round(size * 0.2) },
      ]}
    >
      {badge && layout !== 'horizontal' ? (
        <View style={[styles.badge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }, Shadows.card]}>
          {mark}
        </View>
      ) : (
        mark
      )}
      {showWordmark ? wordmark : null}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  shade: {
    position: 'absolute',
    borderRadius: 999,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  crossVertical: {
    position: 'absolute',
    backgroundColor: Palette.white,
  },
  crossHorizontal: {
    position: 'absolute',
    backgroundColor: Palette.white,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  pulseSegment: {
    width: 2,
    backgroundColor: Palette.white,
    opacity: 0.95,
  },
  pulseSlopeUp: {
    backgroundColor: Palette.white,
    transform: [{ rotate: '-28deg' }],
    opacity: 0.95,
  },
  pulsePeak: {
    backgroundColor: Palette.white,
    transform: [{ rotate: '28deg' }],
    opacity: 0.95,
  },
  pulseSlopeDown: {
    backgroundColor: Palette.white,
    transform: [{ rotate: '45deg' }],
    opacity: 0.95,
  },
  badge: {
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    alignItems: 'center',
  },
  brand: {
    ...Typography.h1,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tagline: {
    ...Typography.bodySmall,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
