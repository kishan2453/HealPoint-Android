/**
 * HealPoint - small status/priority badge.
 */
import React from "react";
import { StyleSheet, Text, StyleProp, TextStyle } from "react-native";

import { Palette, Radius, Spacing, Typography } from "@/constants/theme";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "neutral";

export type { BadgeVariant };

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<TextStyle>;
}

const palette: Record<
  BadgeVariant,
  { bg: string; text: string; border: string }
> = {
  primary: {
    bg: Palette.primaryLight,
    text: Palette.primaryDark,
    border: "rgba(191, 219, 254, 0.75)",
  },
  success: {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "rgba(167, 243, 208, 0.75)",
  },
  warning: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "rgba(253, 230, 138, 0.75)",
  },
  error: {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "rgba(254, 202, 202, 0.75)",
  },
  neutral: {
    bg: "#F1F5F9",
    text: Palette.textMuted,
    border: "rgba(226, 232, 240, 0.85)",
  },
};

export function Badge({ label, variant = "neutral", style }: BadgeProps) {
  const colors = palette[variant];
  return (
    <Text
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          color: colors.text,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...Typography.caption,
    fontWeight: "600",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    overflow: "hidden",
  },
});
