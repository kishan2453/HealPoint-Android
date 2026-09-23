/**
 * HealPoint — Family Member Filter Bar.
 *
 * Horizontal selector allowing patients to filter medical records, prescriptions,
 * lab reports, and health timelines by:
 *   - "All Records" (Combined view)
 *   - "Myself" (Strictly the account holder's personal history)
 *   - "[Member Name] ([Relationship])" (Strictly that specific dependent's records)
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import * as familyService from "@/services/family";
import type { FamilyMember } from "@/types";

export interface FamilyMemberFilterBarProps {
  selectedMemberId: string; // "all" | "self" | specific memberId
  onSelectMember: (memberId: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function FamilyMemberFilterBar({
  selectedMemberId,
  onSelectMember,
  style,
}: FamilyMemberFilterBarProps) {
  const { user } = useAuth();
  const userId = user?._id || "";
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    if (!userId) return;
    familyService
      .getFamilyMembers(userId)
      .then(setMembers)
      .catch(() => {});
  }, [userId]);

  // If no family members are added, do not clutter the screen
  if (members.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All Filter */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedMemberId === "all" }}
          onPress={() => onSelectMember("all")}
          style={[styles.chip, selectedMemberId === "all" && styles.chipActive]}
        >
          <Ionicons
            name="layers-outline"
            size={14}
            color={
              selectedMemberId === "all" ? Palette.white : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.chipText,
              selectedMemberId === "all" && styles.chipTextActive,
            ]}
          >
            All Family
          </Text>
        </Pressable>

        {/* Myself */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedMemberId === "self" }}
          onPress={() => onSelectMember("self")}
          style={[
            styles.chip,
            selectedMemberId === "self" && styles.chipActive,
          ]}
        >
          <Ionicons
            name="person"
            size={14}
            color={
              selectedMemberId === "self" ? Palette.white : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.chipText,
              selectedMemberId === "self" && styles.chipTextActive,
            ]}
          >
            Myself ({user?.name ? user.name.split(" ")[0] : "Me"})
          </Text>
        </Pressable>

        {/* Individual Family Members */}
        {members.map((m) => {
          const active = selectedMemberId === m._id;
          return (
            <Pressable
              key={m._id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelectMember(m._id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <View
                style={[
                  styles.memberInitial,
                  active && styles.memberInitialActive,
                ]}
              >
                <Text
                  style={[
                    styles.memberInitialText,
                    active && styles.memberInitialTextActive,
                  ]}
                >
                  {m.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {m.name} ({m.relationship})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingVertical: Spacing.xs + 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    fontSize: 13,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  chipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  memberInitial: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: `${Palette.primary}25`,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitialActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  memberInitialText: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primary,
  },
  memberInitialTextActive: {
    color: Palette.white,
  },
});
