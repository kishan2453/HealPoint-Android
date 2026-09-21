/**
 * HealPoint - compact stat card for admin dashboards.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Card } from "@/components/ui/Card";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  hint?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accent = Palette.primary,
  hint,
}: StatCardProps) {
  const { width } = useWindowDimensions();
  // Responsive: if screen is very small, use 48% width to force 2-column wrapping
  const cardWidth = width < 500 ? "48%" : 180;

  return (
    <Card
      style={[
        styles.card,
        { minWidth: cardWidth as any, flex: width < 500 ? 0 : 1 },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${accent}14` }]}>
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    gap: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: Palette.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Palette.border + "60",
  },
  content: {
    flex: 1,
    gap: 0,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    ...Typography.h3,
    fontSize: 22,
    color: Palette.text,
  },
  label: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  hint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.success,
    fontWeight: "600",
    marginTop: 2,
  },
});
