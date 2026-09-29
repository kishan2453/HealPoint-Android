/**
 * HealPoint - Floating comparison tray mounted when 1 or more hospitals
 * are selected for comparison.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HospitalImage } from "@/components/HospitalImage";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useHospitalComparison } from "@/hooks/use-hospital-comparison";

export function HospitalCompareTray() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    selectedHospitals,
    selectedIds,
    compareCount,
    canCompare,
    removeHospital,
    clearComparison,
  } = useHospitalComparison();

  if (compareCount === 0) {
    return null;
  }

  const handleCompare = () => {
    if (!canCompare) return;
    const idsParam = selectedIds.join(",");
    router.push({
      pathname: "/hospital/compare" as never,
      params: { ids: idsParam } as never,
    });
  };

  return (
    <View
      style={[
        styles.trayContainer,
        {
          bottom:
            Math.max(insets.bottom, 12) + (Platform.OS === "ios" ? 12 : 8),
        },
      ]}
    >
      <View style={styles.card}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Ionicons
              name="git-compare-outline"
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.titleText}>Compare Hospitals</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{compareCount}/3</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear all selected hospitals"
            onPress={clearComparison}
            hitSlop={8}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        {/* Selected Hospital Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {selectedHospitals.map((h) => (
            <View key={String(h._id)} style={styles.hospitalChip}>
              <View style={styles.chipImgWrap}>
                <HospitalImage
                  hospital={h}
                  style={styles.chipImg}
                  contentFit="cover"
                />
              </View>
              <Text style={styles.chipName} numberOfLines={1}>
                {h.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${h.name} from comparison`}
                onPress={() => removeHospital(String(h._id))}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.chipRemove,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={Palette.textMuted}
                />
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {/* Footer / CTA Row */}
        <View style={styles.actionRow}>
          {canCompare ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Compare ${compareCount} selected hospitals`}
              onPress={handleCompare}
              style={({ pressed }) => [
                styles.compareBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="sparkles" size={16} color={Palette.white} />
              <Text style={styles.compareBtnText}>
                Compare ({compareCount}) Now
              </Text>
              <Ionicons name="arrow-forward" size={16} color={Palette.white} />
            </Pressable>
          ) : (
            <View style={styles.hintWrap}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={Palette.primary}
              />
              <Text style={styles.hintText}>
                Select at least 1 more hospital to compare (max 3)
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trayContainer: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 999,
    elevation: 10,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Palette.primary,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  counterBadge: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  counterText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  clearBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  clearText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.error,
  },
  chipsScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  hospitalChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    gap: 6,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipImgWrap: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    overflow: "hidden",
    backgroundColor: Palette.border,
  },
  chipImg: {
    width: "100%",
    height: "100%",
  },
  chipName: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    flexShrink: 1,
  },
  chipRemove: {
    marginLeft: 2,
  },
  actionRow: {
    marginTop: 2,
  },
  compareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    ...Shadows.card,
  },
  compareBtnText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.white,
  },
  hintWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
  },
  hintText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
