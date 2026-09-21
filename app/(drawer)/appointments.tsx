/**
 * HealPoint - My Appointments (patient).
 *
 * Real appointment data from the backend (`/appointment/get-user-appointments`
 * scoped to the logged-in user) split into Upcoming / Today / Completed /
 * Cancelled tabs. Includes skeleton loading, a friendly error + retry state,
 * pull-to-refresh, and a "Book an appointment" CTA that routes into the real
 * booking flow. Tapping a card opens the appointment details screen, where the
 * existing cancel / reschedule / pay actions live.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { ReviewModal } from "@/components/ReviewModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAppointments } from "@/hooks/use-appointments";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import type { Appointment } from "@/types";

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
  const [tab, setTab] = useState<Tab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [reviewApt, setReviewApt] = useState<Appointment | null>(null);
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh on focus (throttled) so a freshly booked/cancelled/rescheduled/paid
  // appointment appears without a manual reload — but focus-hopping must not
  // re-download the list every time.
  useScreenFocus(() => {
    refetch();
  }, 30_000);

  const countFor = (key: Tab) =>
    key === "upcoming"
      ? upcoming.length
      : key === "today"
        ? today.length
        : key === "completed"
          ? completed.length
          : cancelled.length;

  const data =
    tab === "upcoming"
      ? upcoming
      : tab === "today"
        ? today
        : tab === "completed"
          ? completed
          : cancelled;

  const total = appointments.length;
  const upcomingTotal = upcoming.length + today.length;
  const subtitle =
    total > 0
      ? `${total} booking${total === 1 ? "" : "s"}${upcomingTotal > 0 ? ` · ${upcomingTotal} upcoming` : ""}`
      : "Track and manage your bookings";

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
                accessibilityLabel={`${segment.label}, ${countFor(segment.key)} appointments`}
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
    paddingBottom: Spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
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
    height: Spacing.xxl,
  },
});
