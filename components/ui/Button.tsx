/**
 * HealPoint - reusable button. Primary CTA for forms, booking, etc.
 * The primary variant renders a layered "premium" surface (soft top sheen +
 * darker bottom edge) so CTAs feel polished without needing a native gradient.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Palette, Radius, Spacing, Typography } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type IconName = keyof typeof Ionicons.glyphMap;

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** Optional leading icon (Ionicons name) shown before the label. */
  icon?: IconName;
}

const variantColors: Record<
  Variant,
  { bg: string; text: string; border?: string }
> = {
  primary: { bg: Palette.primary, text: Palette.white },
  secondary: { bg: Palette.primaryLight, text: Palette.primaryDark },
  outline: {
    bg: "transparent",
    text: Palette.primary,
    border: Palette.primary,
  },
  ghost: { bg: "transparent", text: Palette.primary },
  danger: { bg: Palette.error, text: Palette.white },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  icon,
}: ButtonProps) {
  const colors = variantColors[variant];
  const isDisabled = disabled || loading;
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border ?? "transparent",
        },
        isPrimary && styles.primaryBase,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {/* Premium sheen for the primary variant (pure layout, no native deps). */}
      {isPrimary ? <View pointerEvents="none" style={styles.sheen} /> : null}
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={colors.text} /> : null}
          <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    overflow: "hidden",
  },
  fullWidth: {
    width: "100%",
  },
  primaryBase: {
    minHeight: 56,
    borderRadius: Radius.md + 2,
    borderTopColor: "rgba(255,255,255,0.28)",
    borderRightColor: Palette.primaryDark,
    borderBottomColor: Palette.primaryDark,
    borderLeftColor: Palette.primaryDark,
    borderWidth: 1,
    borderTopWidth: 2,
    // Layered edge + soft elevation on Android.
    elevation: 4,
    shadowColor: Palette.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderTopLeftRadius: Radius.md + 2,
    borderTopRightRadius: Radius.md + 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...Typography.button,
    textAlign: "center",
    flexShrink: 1,
  },
});
