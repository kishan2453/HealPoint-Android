/**
 * HealPoint - loading indicator with optional label.
 */
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text } from "react-native";

import { Palette, Spacing, Typography } from "@/constants/theme";

interface LoadingProps {
  label?: string;
  fullScreen?: boolean;
  color?: string;
}

export function Loading({
  label,
  fullScreen = true,
  color = Palette.primary,
}: LoadingProps) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={[
        styles.container,
        fullScreen && styles.fullScreen,
        { opacity: fade },
      ]}
    >
      <ActivityIndicator size="large" color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  fullScreen: {
    flex: 1,
  },
  label: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
});
