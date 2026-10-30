/**
 * HealPoint - reusable card surface.
 */
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

import { Glass, Radius, Shadows } from "@/constants/theme";

interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
  level?: 1 | 2 | 3 | 4;
}

export function Card({
  padded = true,
  elevated = false,
  level = 2,
  style,
  children,
  ...props
}: CardProps) {
  const glassStyle =
    level === 1
      ? styles.level1
      : level === 3
        ? styles.level3
        : level === 4
          ? styles.level4
          : styles.level2;

  return (
    <View
      style={[
        styles.card,
        glassStyle,
        padded && styles.padded,
        elevated && styles.elevated,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  level1: Glass.level1,
  level2: Glass.level2,
  level3: Glass.level3,
  level4: Glass.level4,
  padded: {
    padding: 16,
  },
  elevated: Shadows.card,
});
