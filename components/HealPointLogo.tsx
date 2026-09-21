/**
 * HealPoint - Premium Brand Lockup & Healthcare Identity.
 *
 * A modern, authoritative healthcare emblem: a rounded squircle in HealPoint teal
 * housing a surgical white medical cross, unified with a central precision focal
 * "Point" aperture and vitality accents, paired with the geometric HealPoint wordmark.
 *
 * Used across the patient mobile app, splash screen, welcome, auth headers, and drawer.
 * Built purely from lightweight, performant React Native Views.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Palette, Shadows, Typography } from "@/constants/theme";

interface HealPointLogoProps {
  /** Size of the square mark in px. Default 72. */
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
  // Proportions scaled to `size`
  const radius = Math.round(size * 0.25);
  const crossW = Math.round(size * 0.22); // arm thickness
  const crossL = Math.round(size * 0.62); // arm length
  const barRadius = Math.max(2, Math.round(crossW * 0.28));

  const aperture = Math.round(crossW * 1.36);
  const beacon = Math.round(aperture * 0.45);

  const brandPrimary = light ? "#3FD4C0" : Palette.primary;
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
      {/* Specular top-left illumination & depth accent */}
      <View
        pointerEvents="none"
        style={[
          styles.specular,
          {
            top: -size * 0.25,
            left: -size * 0.2,
            width: size * 0.85,
            height: size * 0.85,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.shade,
          {
            bottom: -size * 0.3,
            right: -size * 0.2,
            width: size * 0.8,
            height: size * 0.8,
            backgroundColor: Palette.primaryDark,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.borderRing} />

      {/* Balanced Medical Cross (Vertical & Horizontal Arms) */}
      <View
        style={[
          styles.crossArm,
          {
            width: crossW,
            height: crossL,
            borderRadius: barRadius,
          },
        ]}
      />
      <View
        style={[
          styles.crossArm,
          {
            width: crossL,
            height: crossW,
            borderRadius: barRadius,
          },
        ]}
      />

      {/* Inbound & Outbound Vitality Groove Channels */}
      <View
        pointerEvents="none"
        style={[
          styles.vitalityLine,
          {
            width: Math.round(crossL * 0.76),
            height: Math.max(2, Math.round(crossW * 0.16)),
            backgroundColor: Palette.primary,
          },
        ]}
      />

      {/* Central Precision Focal "Point" Aperture */}
      <View
        style={[
          styles.aperture,
          {
            width: aperture,
            height: aperture,
            borderRadius: aperture / 2,
            backgroundColor: Palette.primary,
          },
        ]}
      >
        {/* Core Beacon Point */}
        <View
          style={[
            styles.beacon,
            {
              width: beacon,
              height: beacon,
              borderRadius: beacon / 2,
              backgroundColor: Palette.white,
            },
          ]}
        />
      </View>
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
        Heal<Text style={{ color: brandPrimary }}>Point</Text>
      </Text>
      {layout === "vertical" ? (
        <Text
          style={[
            styles.tagline,
            { color: light ? "rgba(255,255,255,0.78)" : Palette.textMuted },
          ]}
        >
          HEALTHCARE SERVICES
        </Text>
      ) : (
        <Text
          style={[
            styles.taglineHorizontal,
            { color: light ? "rgba(255,255,255,0.72)" : Palette.textMuted },
          ]}
        >
          Care & Appointments
        </Text>
      )}
    </View>
  );

  const badgeSize = size + Math.round(size * 0.48);

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
    position: "relative",
  },
  specular: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  shade: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.5,
  },
  borderRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  crossArm: {
    position: "absolute",
    backgroundColor: Palette.white,
  },
  vitalityLine: {
    position: "absolute",
    borderRadius: 2,
    opacity: 0.85,
  },
  aperture: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  beacon: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  badge: {
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
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
    letterSpacing: 1.8,
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
