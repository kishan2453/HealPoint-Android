/**
 * HealPoint - horizontal filter chips row used by admin list screens.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Palette, Radius, Spacing, Typography } from "@/constants/theme";

export interface FilterChipOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  options: FilterChipOption[];
  selected: string;
  onSelect: (value: string) => void;
}

export function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  labelActive: {
    color: Palette.white,
  },
});
