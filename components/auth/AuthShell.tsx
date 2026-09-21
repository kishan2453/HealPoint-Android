/**
 * HealPoint - Premium Responsive Authentication Shell.
 *
 * Shared presentation layer for the auth flow (Welcome, Login, Sign Up,
 * Forgot Password, OTP, Reset Password):
 *  - Safe-area + keyboard-safe scroll on every platform,
 *  - Responsive layout driven by window width (mobile, tablet, desktop split),
 *  - Soft, elegant HD healthcare vector backdrop (mesh lighting, concentric pulse rings, medical crosses),
 *  - Smooth fade-and-rise entrance animation.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { DoctorBrandPanel } from "@/components/doctor/DoctorBrandPanel";
import { Palette, Radius, Shadows, Spacing } from "@/constants/theme";
import {
  AUTH_COLUMN_MAX_WIDTH,
  AUTH_CARD_MAX_WIDTH,
  useResponsiveVariant,
} from "@/lib/responsive";

interface AuthShellProps {
  children: ReactNode;
  scroll?: boolean;
  keyboardShouldPersistTaps?: "always" | "handled" | "never";
  showBack?: boolean;
  splitOnDesktop?: boolean;
  brand?: "patient" | "doctor";
}

export function AuthShell({
  children,
  scroll = true,
  keyboardShouldPersistTaps = "handled",
  showBack = false,
  splitOnDesktop = true,
  brand = "patient",
}: AuthShellProps) {
  const router = useRouter();
  const variant = useResponsiveVariant();
  const isDesktop = variant === "desktop";
  const isTablet = variant === "tablet";

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const useSplit = isDesktop && splitOnDesktop;

  const content = (
    <Animated.View
      style={[styles.content, { opacity, transform: [{ translateY }] }]}
    >
      {useSplit ? (
        <View style={styles.desktopRow}>
          {brand === "doctor" ? <DoctorBrandPanel /> : <AuthBrandPanel />}
          <View style={styles.desktopFormColumn}>{children}</View>
        </View>
      ) : (
        <View
          style={[
            styles.singleColumn,
            isTablet || isDesktop ? styles.cappedColumn : null,
          ]}
        >
          {children}
        </View>
      )}
    </Animated.View>
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* Professionally designed HD healthcare visual background */}
      <View pointerEvents="none" style={styles.decor}>
        {/* Soft ambient lighting meshes */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />
        <View style={styles.ambientGlowCenter} />

        {/* Concentric healthcare pulse rings */}
        <View style={styles.pulseRingOuter} />
        <View style={styles.pulseRingInner} />

        {/* Subtle geometric medical cross watermarks */}
        <View style={styles.crossTopLeft}>
          <View style={styles.crossV1} />
          <View style={styles.crossH1} />
        </View>

        <View style={styles.crossBottomRight}>
          <View style={styles.crossV2} />
          <View style={styles.crossH2} />
        </View>

        <View style={styles.crossMidRight}>
          <View style={styles.crossV3} />
          <View style={styles.crossH3} />
        </View>

        {/* Soft healthcare capsule accents */}
        <View style={styles.pillAccentTop} />
        <View style={styles.pillAccentBottom} />
      </View>

      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/login")
          }
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Palette.text} />
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
    backgroundColor: "#F7FBFA",
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
    justifyContent: "center",
    alignItems: "center",
  },
  singleColumn: {
    width: "100%",
  },
  cappedColumn: {
    maxWidth: AUTH_COLUMN_MAX_WIDTH,
  },
  desktopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 1120,
    gap: Spacing.xxxl,
  },
  desktopFormColumn: {
    flex: 1,
    maxWidth: AUTH_CARD_MAX_WIDTH,
    width: "100%",
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  backButton: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.lg,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  backPressed: {
    opacity: 0.6,
  },
  ambientGlowTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
  },
  ambientGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -120,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  ambientGlowCenter: {
    position: "absolute",
    top: "38%",
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(34, 167, 160, 0.05)",
  },
  pulseRingOuter: {
    position: "absolute",
    top: -70,
    right: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
  },
  pulseRingInner: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.10)",
  },
  crossTopLeft: {
    position: "absolute",
    top: 60,
    left: 28,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.18,
  },
  crossV1: {
    position: "absolute",
    width: 8,
    height: 34,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  crossH1: {
    position: "absolute",
    width: 34,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  crossBottomRight: {
    position: "absolute",
    bottom: 80,
    right: 32,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.12,
  },
  crossV2: {
    position: "absolute",
    width: 10,
    height: 42,
    borderRadius: 5,
    backgroundColor: Palette.primary,
  },
  crossH2: {
    position: "absolute",
    width: 42,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
  },
  crossMidRight: {
    position: "absolute",
    top: "45%",
    right: 18,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.1,
  },
  crossV3: {
    position: "absolute",
    width: 6,
    height: 24,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  crossH3: {
    position: "absolute",
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  pillAccentTop: {
    position: "absolute",
    top: 130,
    right: 60,
    width: 50,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    transform: [{ rotate: "-25deg" }],
  },
  pillAccentBottom: {
    position: "absolute",
    bottom: 150,
    left: 40,
    width: 60,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    transform: [{ rotate: "30deg" }],
  },
});
