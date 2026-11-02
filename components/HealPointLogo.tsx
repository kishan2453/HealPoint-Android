/**
 * HealPoint - Premium Brand Lockup & Healthcare Identity.
 *
 * Uses the official 3D HealPoint healthcare brand emblem:
 * A glossy heart symbol formed by caring hands, doctor silhouettes, and medical cross,
 * paired with the vibrant HealPoint wordmark and vitality slogan.
 *
 * Used across the patient mobile app, splash screen, welcome, auth headers, and drawer.
 */
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Palette, Shadows, Typography } from "@/constants/theme";

interface HealPointLogoProps {
  /** Size of the logo emblem in px. Default 72. */
  size?: number;
  /** Render the wordmark next to / below the mark. Default true. */
  showWordmark?: boolean;
  /** Wordmark placement relative to the mark. */
  layout?: "horizontal" | "vertical";
  /** Light mode for rendering on dark backgrounds. */
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
  layout = "vertical",
  light = false,
  badge = false,
}: HealPointLogoProps) {
  const radius = Math.round(size * 0.22);
  const brandPrimary = light ? "#60A5FA" : Palette.primary;
  const brandBase = light ? Palette.white : Palette.text;

  const mark = (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: Palette.white,
        },
        Shadows.card,
      ]}
      accessibilityLabel="HealPoint logo"
    >
      <Image
        source={require("@/assets/images/logo.png")}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="contain"
      />
    </View>
  );

  // Horizontal lockup (drawer / small headers) scales the wordmark
  const brandFont =
    layout === "horizontal"
      ? Math.max(18, Math.min(28, Math.round(size * 0.52)))
      : undefined;

  const wordmark = (
    <View
      style={[
        styles.wordmark,
        layout === "horizontal" && styles.wordmarkHorizontal,
      ]}
    >
      <Text
        style={[
          styles.brand,
          layout === "horizontal" && {
            fontSize: brandFont,
            lineHeight: brandFont ? brandFont + 4 : undefined,
          },
          { color: brandBase },
        ]}
      >
        Anand <Text style={{ color: brandPrimary }}>HealPoint</Text>
      </Text>
      {layout === "vertical" ? (
        <Text
          style={[
            styles.tagline,
            { color: light ? "rgba(255,255,255,0.78)" : Palette.textMuted },
          ]}
        >
          Your Health, Our Priority
        </Text>
      ) : (
        <Text
          style={[
            styles.taglineHorizontal,
            { color: light ? "rgba(255,255,255,0.72)" : Palette.textMuted },
          ]}
        >
          Healthcare System
        </Text>
      )}
    </View>
  );

  const badgeSize = size + Math.round(size * 0.44);

  return (
    <View
      style={[
        styles.container,
        layout === "horizontal" ? styles.row : styles.column,
        {
          gap:
            layout === "horizontal"
              ? Math.round(size * 0.22)
              : Math.round(size * 0.18),
        },
      ]}
    >
      {badge && layout !== "horizontal" ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
            Shadows.card,
          ]}
        >
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
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  column: {
    flexDirection: "column",
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  badge: {
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(37, 99, 235, 0.18)",
  },
  wordmark: {
    alignItems: "center",
  },
  wordmarkHorizontal: {
    alignItems: "flex-start",
  },
  brand: {
    ...Typography.h1,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  taglineHorizontal: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: -2,
  },
});
