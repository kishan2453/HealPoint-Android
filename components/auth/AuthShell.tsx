/**
 * HealPoint - premium responsive authentication shell.
 *
 * Shared presentation layer for the auth flow (Welcome, Login, Sign Up,
 * Forgot Password, OTP, Reset Password):
 *  - safe-area + keyboard-safe scroll on every platform (incl. Android),
 *  - responsive layout driven by the actual window width (NOT user-agent
 *    sniffing) so the same code serves phones, tablets and desktop browsers:
 *      * desktop (>= 1024px): two-column — brand panel left, capped form right
 *      * tablet  (768–1023px): single column, centred, capped width
 *      * mobile  (< 768px): the familiar stacked, full-width mobile form
 *  - a soft teal decorative backdrop for the premium healthcare feel,
 *  - a subtle fade-and-rise entrance animation on mount.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { AUTH_COLUMN_MAX_WIDTH, AUTH_CARD_MAX_WIDTH, useResponsiveVariant } from '@/lib/responsive';

interface AuthShellProps {
  children: ReactNode;
  scroll?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  /** Render a floating back arrow in the top-left (pushed sub-flows). */
  showBack?: boolean;
  /**
   * Desktop layout mode. `true` (default) renders the two-column brand + form
   * split on wide screens. Set to `false` for screens that must stay a single
   * centred column (e.g. the Welcome hero).
   */
  splitOnDesktop?: boolean;
}

export function AuthShell({
  children,
  scroll = true,
  keyboardShouldPersistTaps = 'handled',
  showBack = false,
  splitOnDesktop = true,
}: AuthShellProps) {
  const router = useRouter();
  const variant = useResponsiveVariant();
  const isDesktop = variant === 'desktop';
  const isTablet = variant === 'tablet';

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const useSplit = isDesktop && splitOnDesktop;

  const content = (
    <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
      {useSplit ? (
        <View style={styles.desktopRow}>
          <AuthBrandPanel />
          <View style={styles.desktopFormColumn}>{children}</View>
        </View>
      ) : (
        <View style={[styles.singleColumn, (isTablet || isDesktop) ? styles.cappedColumn : null]}>
          {children}
        </View>
      )}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {/* Decorative teal glows (non-interactive). */}
      <View pointerEvents="none" style={styles.decor}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Palette.text} />
        </Pressable>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{content}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleColumn: {
    width: '100%',
  },
  cappedColumn: {
    maxWidth: AUTH_COLUMN_MAX_WIDTH,
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1120,
    gap: Spacing.xxxl,
  },
  desktopFormColumn: {
    flex: 1,
    maxWidth: AUTH_CARD_MAX_WIDTH,
    width: '100%',
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  backPressed: {
    opacity: 0.6,
  },
  glowTop: {
    position: 'absolute',
    top: -140,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(14, 159, 142, 0.10)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -160,
    left: -130,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(14, 159, 142, 0.08)',
  },
});
