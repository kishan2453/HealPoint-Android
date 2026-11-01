/**
 * HealPoint - My Appointments (patient).
 *
 * Real appointment data from the backend (`/appointment/get-user-appointments`
 * scoped to the logged-in user) split into Upcoming / Today / Completed /
 * Cancelled tabs. Includes skeleton loading, a friendly error + retry state,
 * pull-to-refresh, family member filter chips, and a "Book an appointment" CTA
 * that routes into the real booking flow. Tapping a card opens the appointment
 * details screen, where the existing cancel / reschedule / pay actions live.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppointmentCard } from "@/components/AppointmentCard";
import { AppointmentListSkeleton } from "@/components/AppointmentCardSkeleton";
import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { PatientBottomNav } from "@/components/PatientBottomNav";
import { ReviewModal } from "@/components/ReviewModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments } from "@/hooks/use-appointments";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import * as familyService from "@/services/family";
import type { Appointment, FamilyMember } from "@/types";

type Tab = "upcoming" | "today" | "completed" | "cancelled";

const SEGMENTS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "upcoming", label: "Upcoming", icon: "calendar-outline" },
  { key: "today", label: "Today", icon: "today-outline" },
  { key: "completed", label: "Completed", icon: "checkmark-circle-outline" },
  { key: "cancelled", label: "Cancelled", icon: "close-circle-outline" },
];

export default function AppointmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [reviewApt, setReviewApt] = useState<Appointment | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");

  const {
    appointments,
    upcoming,
    today,
    completed,
    cancelled,
    loading,
    error,
    refetch,
  } = useAppointments();

  const loadFamily = useCallback(async () => {
    if (!user?._id) return;
    try {
      const list = await familyService.getFamilyMembers(user._id);
      setFamilyMembers(list);
    } catch {
      // Graceful fallback
    }
  }, [user?._id]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refetch(), loadFamily()]);
    } finally {
      setRefreshing(false);
    }
  };

  useScreenFocus(() => {
    refetch();
    loadFamily();
  }, 30_000);

  const filterByMember = useCallback(
    (list: Appointment[]) => {
      if (selectedMemberId === "all") return list;
      if (selectedMemberId === "self") {
        return list.filter(
          (a) => !a.familyMemberId || a.familyRelationship === "Self"
        );
      }
      return list.filter((a) => a.familyMemberId === selectedMemberId);
    },
    [selectedMemberId]
  );

  const filteredUpcoming = useMemo(
    () => filterByMember(upcoming),
    [filterByMember, upcoming]
  );
  const filteredToday = useMemo(
    () => filterByMember(today),
    [filterByMember, today]
  );
  const filteredCompleted = useMemo(
    () => filterByMember(completed),
    [filterByMember, completed]
  );
  const filteredCancelled = useMemo(
    () => filterByMember(cancelled),
    [filterByMember, cancelled]
  );
  const filteredAppointments = useMemo(
    () => filterByMember(appointments),
    [filterByMember, appointments]
  );

  const countFor = (key: Tab) =>
    key === "upcoming"
      ? filteredUpcoming.length
      : key === "today"
      ? filteredToday.length
      : key === "completed"
      ? filteredCompleted.length
      : filteredCancelled.length;

  const data =
    tab === "upcoming"
      ? filteredUpcoming
      : tab === "today"
      ? filteredToday
      : tab === "completed"
      ? filteredCompleted
      : filteredCancelled;

  const total = filteredAppointments.length;
  const upcomingTotal = filteredUpcoming.length + filteredToday.length;

  const activeMemberObj = useMemo(() => {
    if (selectedMemberId === "all" || selectedMemberId === "self") return null;
    return familyMembers.find((m) => m._id === selectedMemberId) || null;
  }, [familyMembers, selectedMemberId]);

  const subtitle = useMemo(() => {
    const scopeLabel =
      selectedMemberId === "all"
        ? "All Family"
        : selectedMemberId === "self"
        ? "Myself"
        : activeMemberObj?.name || "Dependent";

    if (total > 0) {
      return `${scopeLabel} · ${total} booking${total === 1 ? "" : "s"}${
        upcomingTotal > 0 ? ` (${upcomingTotal} upcoming)` : ""
      }`;
    }
    return `Track and manage ${scopeLabel.toLowerCase()} bookings`;
  }, [selectedMemberId, activeMemberObj?.name, total, upcomingTotal]);

  const empty = emptyStateFor(tab);
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Palette.primary}
    />
  );

  return (
    <View style={styles.safe}>
      <DrawerHeader title="My Appointments" subtitle={subtitle} />

      {/* Segment Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        <View style={styles.tabs}>
          {SEGMENTS.map((segment) => {
            const active = tab === segment.key;
            return (
              <Pressable
                key={segment.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${segment.label}, ${countFor(
                  segment.key
                )} appointments`}
                onPress={() => setTab(segment.key)}
                style={({ pressed }) => [
                  styles.tab,
                  active && styles.tabActive,
                  pressed && styles.tabPressed,
                ]}
              >
                <Ionicons
                  name={segment.icon}
                  size={16}
                  color={active ? Palette.white : Palette.textMuted}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {segment.label} ({countFor(segment.key)})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Family Member Filter Bar */}
      {familyMembers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.familyScroll}
          contentContainerStyle={styles.familyContent}
        >
          <Pressable
            onPress={() => setSelectedMemberId("all")}
            style={[
              styles.familyChip,
              selectedMemberId === "all" && styles.familyChipActive,
            ]}
          >
            <Ionicons
              name="people"
              size={14}
              color={selectedMemberId === "all" ? Palette.white : Palette.primary}
            />
            <Text
              style={[
                styles.familyChipText,
                selectedMemberId === "all" && styles.familyChipTextActive,
              ]}
            >
              All Family ({appointments.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedMemberId("self")}
            style={[
              styles.familyChip,
              selectedMemberId === "self" && styles.familyChipActive,
            ]}
          >
            <Ionicons
              name="person"
              size={14}
              color={
                selectedMemberId === "self"
                  ? Palette.white
                  : Palette.textSecondary
              }
            />
            <Text
              style={[
                styles.familyChipText,
                selectedMemberId === "self" && styles.familyChipTextActive,
              ]}
            >
              Myself (
              {
                appointments.filter(
                  (a) => !a.familyMemberId || a.familyRelationship === "Self"
                ).length
              }
              )
            </Text>
          </Pressable>

          {familyMembers.map((m) => {
            const isSelected = selectedMemberId === m._id;
            const count = appointments.filter(
              (a) => a.familyMemberId === m._id
            ).length;
            return (
              <Pressable
                key={m._id}
                onPress={() => setSelectedMemberId(m._id)}
                style={[
                  styles.familyChip,
                  isSelected && styles.familyChipActive,
                ]}
              >
                <Ionicons
                  name="heart"
                  size={13}
                  color={isSelected ? Palette.white : "#EC4899"}
                />
                <Text
                  style={[
                    styles.familyChipText,
                    isSelected && styles.familyChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {m.name} ({m.relationship}) [{count}]
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <AppointmentListSkeleton count={4} />
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <ErrorState message={error} onRetry={refetch} />
        </ScrollView>
      ) : data.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            title={empty.title}
            message={empty.message}
            action={
              empty.cta ? (
                <Button
                  title={empty.cta}
                  icon="add-circle-outline"
                  onPress={() => router.push("/doctors")}
                />
              ) : undefined
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              onReviewPress={(apt) => setReviewApt(apt)}
            />
          )}
          refreshControl={refreshControl}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={styles.listFooter} />}
          initialNumToRender={8}
          windowSize={7}
        />
      )}

      {reviewApt ? (
        <ReviewModal
          visible={Boolean(reviewApt)}
          doctorId={
            typeof reviewApt.doctorId === "object" && reviewApt.doctorId
              ? String((reviewApt.doctorId as { _id?: string })._id || "")
              : String(reviewApt.doctorId || "")
          }
          doctorName={
            typeof reviewApt.doctorId === "object" && reviewApt.doctorId
              ? (reviewApt.doctorId as { name?: string }).name
              : "Doctor"
          }
          appointmentId={String(reviewApt._id)}
          hospitalId={
            typeof reviewApt.hospitalId === "object" && reviewApt.hospitalId
              ? String((reviewApt.hospitalId as { _id?: string })._id || "")
              : typeof reviewApt.hospitalId === "string"
              ? reviewApt.hospitalId
              : undefined
          }
          hospitalName={reviewApt.hospitalName}
          onClose={() => setReviewApt(null)}
          onSuccess={() => {
            setReviewApt(null);
            refetch();
          }}
        />
      ) : null}

      <PatientBottomNav activeTab="appointments" />
    </View>
  );
}

function emptyStateFor(tab: Tab): {
  title: string;
  message: string;
  cta?: string;
} {
  switch (tab) {
    case "upcoming":
      return {
        title: "No appointments yet",
        message:
          "Book a consultation with a trusted doctor and it will appear here.",
        cta: "Book an appointment",
      };
    case "today":
      return {
        title: "No appointments today",
        message: "Your appointments for today will appear here.",
        cta: "Browse doctors",
      };
    case "completed":
      return {
        title: "No completed appointments",
        message: "Appointments you complete will show up here.",
      };
    case "cancelled":
    default:
      return {
        title: "No cancelled appointments",
        message: "Cancelled or missed appointments will appear here.",
      };
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  tabs: {
    flexDirection: "row",
    gap: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.50)",
    padding: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Palette.primary,
  },
  tabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  tabText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: Palette.white,
  },
  familyScroll: {
    flexGrow: 0,
    marginTop: 4,
  },
  familyContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  familyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.70)",
    borderRadius: Radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  familyChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  familyChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  familyChipTextActive: {
    color: Palette.white,
  },
  stateContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: Spacing.md,
  },
  listFooter: {
    height: 95,
  },
});
