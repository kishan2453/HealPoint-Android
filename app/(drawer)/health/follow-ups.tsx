/**
 * HealPoint — Patient Follow-Up & Care Plan Center.
 *
 * Provides patients with a unified view of doctor follow-up recommendations,
 * scheduled recovery visits, linked prescriptions, and lab investigations.
 * Driven 100% by authentic backend data (no mock/dummy records).
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type { PatientFollowUpItem } from "@/types";

type TabFilter = "all" | "pending_booking" | "scheduled" | "completed";

const FILTER_TABS: {
  key: TabFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Plans", icon: "clipboard-outline" },
  {
    key: "pending_booking",
    label: "Due / Action Needed",
    icon: "alert-circle-outline",
  },
  { key: "scheduled", label: "Scheduled", icon: "calendar-outline" },
  {
    key: "completed",
    label: "Completed",
    icon: "checkmark-done-circle-outline",
  },
];

export default function FollowUpsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  const [followUps, setFollowUps] = useState<PatientFollowUpItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadFollowUps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const history = await appointmentService.getPatientMedicalHistory();
      setFollowUps(history.followUps || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load follow-up care plans."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useScreenFocus(loadFollowUps);

  useEffect(() => {
    loadFollowUps();
  }, [userId, loadFollowUps]);

  const onRefresh = () => {
    loadFollowUps(true);
  };

  const filteredItems = useMemo(() => {
    let list = followUps;
    if (activeTab !== "all") {
      list = list.filter((item) => item.status === activeTab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          (item.doctorName || "").toLowerCase().includes(q) ||
          (item.doctorSpecialty || "").toLowerCase().includes(q) ||
          (item.hospitalName || "").toLowerCase().includes(q) ||
          (item.advice || "").toLowerCase().includes(q) ||
          (item.displayAppointmentId &&
            item.displayAppointmentId.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [followUps, activeTab, search]);

  const stats = useMemo(() => {
    const total = followUps.length;
    const pending = followUps.filter(
      (f) => f.status === "pending_booking",
    ).length;
    const scheduled = followUps.filter((f) => f.status === "scheduled").length;
    const completed = followUps.filter((f) => f.status === "completed").length;
    return { total, pending, scheduled, completed };
  }, [followUps]);

  const renderItem = ({ item }: { item: PatientFollowUpItem }) => {
    const isDue = item.status === "pending_booking";
    const isScheduled = item.status === "scheduled";
    const doctorImg = getDoctorImage(
      item.doctorId ? { _id: item.doctorId, name: item.doctorName } : undefined,
    );

    const badgeVariant: BadgeVariant =
      item.statusVariant === "warning"
        ? "warning"
        : item.statusVariant === "success"
          ? "success"
          : item.statusVariant === "primary"
            ? "primary"
            : "neutral";

    const timeframe = item.recommendedTimeframe || item.timeframe;

    return (
      <Card style={styles.card}>
        {/* Header with doctor & status */}
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: doctorImg }}
            style={styles.doctorAvatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {formatDoctorName(item.doctorName, "Doctor")}
            </Text>
            {item.doctorSpecialty ? (
              <Text style={styles.doctorSpecialty} numberOfLines={1}>
                {item.doctorSpecialty}
              </Text>
            ) : null}
            {item.hospitalName ? (
              <View style={styles.hospitalRow}>
                <Ionicons
                  name="business-outline"
                  size={13}
                  color={Palette.textMuted}
                />
                <Text style={styles.hospitalText} numberOfLines={1}>
                  {item.hospitalName}
                </Text>
              </View>
            ) : null}
          </View>
          <Badge label={item.statusLabel || "Plan"} variant={badgeVariant} />
        </View>

        {/* Clinical Advice Callout */}
        <View
          style={[
            styles.adviceContainer,
            isDue && styles.adviceContainerDue,
            isScheduled && styles.adviceContainerScheduled,
          ]}
        >
          <View style={styles.adviceHeaderRow}>
            <Ionicons
              name={isDue ? "calendar-outline" : "chatbox-ellipses-outline"}
              size={16}
              color={isDue ? "#D97706" : Palette.primary}
            />
            <Text
              style={[
                styles.adviceHeaderTitle,
                { color: isDue ? "#92400E" : Palette.primaryDark },
              ]}
            >
              {"Doctor's Care Instructions & Advice"}
            </Text>
          </View>
          <Text style={styles.adviceText}>{item.advice}</Text>

          {timeframe ? (
            <View style={styles.timeframeRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={Palette.textMuted}
              />
              <Text style={styles.timeframeText}>
                Advised timeframe:{" "}
                <Text style={styles.timeframeBold}>{timeframe}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Meta / Badges Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Palette.textMuted}
            />
            <Text style={styles.metaText}>
              Consultation:{" "}
              {formatDDMMYYYY(item.originalVisitDate || item.date || "")}
            </Text>
          </View>
          {item.displayAppointmentId ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="receipt-outline"
                size={14}
                color={Palette.textMuted}
              />
              <Text style={styles.metaText}>{item.displayAppointmentId}</Text>
            </View>
          ) : null}
        </View>

        {/* Connected items: Prescription, Reports */}
        <View style={styles.pillsRow}>
          {item.hasPrescription ? (
            <Pressable
              style={styles.pill}
              onPress={() => router.push("/health/prescriptions")}
            >
              <Ionicons
                name="document-text"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.pillText}>
                Prescription{" "}
                {item.medicinesCount ? `(${item.medicinesCount} meds)` : ""}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={Palette.primary}
              />
            </Pressable>
          ) : null}

          {item.hasReports ? (
            <Pressable
              style={styles.pill}
              onPress={() => router.push("/health/reports")}
            >
              <Ionicons name="bar-chart" size={14} color="#7C3AED" />
              <Text style={[styles.pillText, { color: "#7C3AED" }]}>
                Lab Reports {item.reportsCount ? `(${item.reportsCount})` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#7C3AED" />
            </Pressable>
          ) : null}
        </View>

        {/* Scheduled appointment note if already booked */}
        {isScheduled && item.linkedAppointmentDate ? (
          <View style={styles.scheduledBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.scheduledBannerTitle}>
                Follow-up booked and confirmed
              </Text>
              <Text style={styles.scheduledBannerSub}>
                Slot: {item.linkedAppointmentDate}{" "}
                {item.linkedAppointmentTime
                  ? `at ${item.linkedAppointmentTime}`
                  : ""}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            title="View Visit"
            variant="outline"
            style={styles.actionBtnOutline}
            onPress={() => router.push(`/appointment/${item.appointmentId}`)}
          />

          {isDue && item.doctorId ? (
            <Button
              title="Book Slot"
              variant="primary"
              icon="calendar"
              style={styles.actionBtnPrimary}
              onPress={() => router.push(`/booking/${item.doctorId}`)}
            />
          ) : isScheduled && item.linkedAppointmentId ? (
            <Button
              title="Next Visit"
              variant="primary"
              icon="arrow-forward"
              style={styles.actionBtnPrimary}
              onPress={() =>
                router.push(`/appointment/${item.linkedAppointmentId}`)
              }
            />
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <DrawerToggleButton style={styles.menuBtn} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Follow-Ups & Care Plans</Text>
          <Text style={styles.headerSubtitle}>
            Doctor recommendations & continuous care
          </Text>
        </View>
      </View>

      {/* KPI Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Plans</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#D97706" }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Action Due</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#059669" }]}>
            {stats.scheduled}
          </Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Palette.textMuted }]}>
            {stats.completed}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor, hospital or advice..."
            placeholderTextColor={Palette.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Tab Filter Strip */}
      <View style={styles.tabBar}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive ? Palette.primary : Palette.textMuted}
              />
              <Text
                style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body Content */}
      {loading ? (
        <Loading label="Loading care plans & follow-up recommendations..." />
      ) : error ? (
        <ErrorState
          title="Couldn't load follow-up plans"
          message={error}
          onRetry={() => loadFollowUps(false)}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.appointmentId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Palette.primary]}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={
                activeTab === "pending_booking"
                  ? "No Action Due"
                  : activeTab === "scheduled"
                    ? "No Scheduled Follow-Ups"
                    : activeTab === "completed"
                      ? "No Completed Follow-Ups"
                      : "No Care Plans Yet"
              }
              message={
                activeTab === "pending_booking"
                  ? "You have no outstanding follow-up visits requiring booking right now."
                  : activeTab === "scheduled"
                    ? "No follow-up visits are currently scheduled on your calendar."
                    : "When your doctor recommends a follow-up visit or clinical care plan, it will appear here with instant booking and linked prescriptions."
              }
              action={
                activeTab !== "all" ? (
                  <Button
                    title="View All Plans"
                    variant="outline"
                    onPress={() => setActiveTab("all")}
                  />
                ) : undefined
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  menuBtn: {
    marginRight: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    ...Typography.h3,
    color: Palette.primary,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Palette.background,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
    fontSize: 14,
    padding: 0,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBtnActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  tabBtnText: {
    ...Typography.caption,
    fontWeight: "500",
    color: Palette.textMuted,
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: Palette.primary,
    fontWeight: "600",
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.surfaceAlt,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  hospitalText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    flex: 1,
  },
  adviceContainer: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.border,
  },
  adviceContainerDue: {
    backgroundColor: "#FFFBEB",
    borderLeftColor: "#F59E0B",
  },
  adviceContainerScheduled: {
    backgroundColor: "#F0FDF4",
    borderLeftColor: "#10B981",
  },
  adviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  adviceHeaderTitle: {
    ...Typography.caption,
    fontWeight: "700",
    fontSize: 12,
  },
  adviceText: {
    ...Typography.body,
    color: Palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  timeframeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  timeframeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  timeframeBold: {
    fontWeight: "700",
    color: Palette.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  pillText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  scheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  scheduledBannerTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#065F46",
    fontSize: 13,
  },
  scheduledBannerSub: {
    ...Typography.caption,
    color: "#047857",
    marginTop: 2,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtnOutline: {
    flex: 1,
  },
  actionBtnPrimary: {
    flex: 1,
  },
});
