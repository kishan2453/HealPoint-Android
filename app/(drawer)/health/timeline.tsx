/**
 * HealPoint — Personal Health Timeline & Connected Health History Screen.
 *
 * A production-grade chronological health journey unifying authentic patient data:
 * Appointment -> Payment -> Doctor Consultation -> Digital Prescription -> Medical Report -> Follow-up -> Next Appointment.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
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
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type {
  PatientTimelineAction,
  PatientTimelineEvent,
  PatientTimelineResponse,
  PatientTimelineSummary,
  TimelineFilterType,
} from "@/types";

const FILTER_TABS: {
  key: TimelineFilterType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Milestones", icon: "git-commit-outline" },
  { key: "appointments", label: "Appointments", icon: "calendar-outline" },
  { key: "consultations", label: "Consultations", icon: "medkit-outline" },
  {
    key: "prescriptions",
    label: "Prescriptions",
    icon: "document-text-outline",
  },
  { key: "reports", label: "Lab Reports", icon: "bar-chart-outline" },
  { key: "followups", label: "Follow-ups", icon: "refresh-outline" },
];

export default function HealthTimelineScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeFilter, setActiveFilter] = useState<TimelineFilterType>("all");
  const [events, setEvents] = useState<PatientTimelineEvent[]>([]);
  const [summary, setSummary] = useState<PatientTimelineSummary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadTimeline = useCallback(
    async (targetPage = 1, append = false, isPullRefresh = false) => {
      if (isPullRefresh) setRefreshing(true);
      else if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);

      setError("");
      try {
        const res: PatientTimelineResponse =
          await appointmentService.getPatientHealthTimeline({
            filter: activeFilter,
            page: targetPage,
            limit: 15,
          });

        if (append) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newOnes = res.events.filter((e) => !existingIds.has(e.id));
            return [...prev, ...newOnes];
          });
        } else {
          setEvents(res.events || []);
        }

        if (res.summary) setSummary(res.summary);
        setPage(res.pagination?.page || targetPage);
        setHasMore(Boolean(res.pagination?.hasMore));
      } catch (err) {
        console.error("[HealthTimeline] Failed to load timeline:", err);
        setError(toErrorMessage(err, "Unable to load health timeline."));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeFilter],
  );

  useScreenFocus(
    useCallback(() => {
      loadTimeline(1, false);
    }, [loadTimeline]),
    20_000,
  );

  useEffect(() => {
    loadTimeline(1, false);
  }, [activeFilter, user?._id]);

  const onRefresh = () => {
    loadTimeline(1, false, true);
  };

  const onLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    loadTimeline(page + 1, true);
  };

  const handleActionPress = (action: PatientTimelineAction) => {
    try {
      if (action.route.includes("[id]") && action.params?.id) {
        router.push({
          pathname: action.route as never,
          params: action.params,
        });
      } else if (action.route.startsWith("/")) {
        router.push(action.route as never);
      }
    } catch (err) {
      console.warn("[HealthTimeline] Action navigation failed:", err);
    }
  };

  // Render metric card
  const renderSummaryHeader = () => {
    if (!summary) return null;
    return (
      <View style={styles.summaryContainer}>
        {/* Next Scheduled Care / Upcoming Notice */}
        {summary.nextAppointment && (
          <View style={styles.nextVisitBanner}>
            <View style={styles.nextVisitIconWrap}>
              <Ionicons name="sparkles" size={18} color="#0284C7" />
            </View>
            <View style={styles.nextVisitInfo}>
              <Text style={styles.nextVisitLabel}>Next Scheduled Care</Text>
              <Text style={styles.nextVisitTitle} numberOfLines={1}>
                {summary.nextAppointment.doctorName} •{" "}
                {formatDDMMYYYY(summary.nextAppointment.date)} (
                {summary.nextAppointment.time})
              </Text>
              <Text style={styles.nextVisitSub} numberOfLines={1}>
                {summary.nextAppointment.hospitalName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View next appointment"
              onPress={() =>
                router.push({
                  pathname: "/appointment/[id]" as never,
                  params: { id: summary.nextAppointment?.appointmentId },
                })
              }
              style={({ pressed }) => [
                styles.nextVisitBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.nextVisitBtnText}>View</Text>
              <Ionicons name="chevron-forward" size={14} color="#0284C7" />
            </Pressable>
          </View>
        )}

        {/* Milestone Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}
            >
              <Ionicons name="git-commit" size={18} color="#2563EB" />
            </View>
            <Text style={styles.metricVal}>{summary.totalEvents || 0}</Text>
            <Text style={styles.metricName}>Milestones</Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#F0FDF4" }]}
            >
              <Ionicons name="medkit" size={18} color="#16A34A" />
            </View>
            <Text style={styles.metricVal}>
              {summary.totalConsultations || 0}
            </Text>
            <Text style={styles.metricName}>Consults</Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#F0F9FF" }]}
            >
              <Ionicons name="document-text" size={18} color="#0284C7" />
            </View>
            <Text style={styles.metricVal}>
              {summary.totalPrescriptions || 0}
            </Text>
            <Text style={styles.metricName}>Prescriptions</Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}
            >
              <Ionicons name="bar-chart" size={18} color="#059669" />
            </View>
            <Text style={styles.metricVal}>{summary.totalReports || 0}</Text>
            <Text style={styles.metricName}>Reports</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render Filter Tabs
  const renderFilterTabs = () => (
    <View style={styles.filterTabsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabsScroll}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              onPress={() => {
                setActiveFilter(tab.key);
                setPage(1);
              }}
              style={({ pressed }) => [
                styles.filterTab,
                isActive && styles.filterTabActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? "#0284C7" : "#64748B"}
              />
              <Text
                style={[
                  styles.filterTabText,
                  isActive && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Render Timeline Card Item
  const renderTimelineItem = ({
    item,
    index,
  }: {
    item: PatientTimelineEvent;
    index: number;
  }) => {
    const isLast = index === events.length - 1;
    return (
      <View style={styles.timelineRow}>
        {/* Left Vertical Spine & Node */}
        <View style={styles.spineColumn}>
          <View
            style={[
              styles.spineNode,
              { backgroundColor: item.iconBg || "#EFF6FF" },
            ]}
          >
            <Ionicons
              name={
                (item.icon as keyof typeof Ionicons.glyphMap) || "git-commit"
              }
              size={18}
              color={item.iconColor || "#0284C7"}
            />
          </View>
          {!isLast && <View style={styles.spineLine} />}
        </View>

        {/* Right Event Card */}
        <View style={styles.cardWrapper}>
          <View style={styles.eventCard}>
            {/* Card Header: Timestamp & Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.dateTimeBadge}>
                <Ionicons name="time-outline" size={13} color="#0284C7" />
                <Text style={styles.dateTimeText}>
                  {formatDDMMYYYY(item.date)} • {item.time}
                </Text>
              </View>
              <Badge
                variant={item.badgeVariant as BadgeVariant}
                label={item.badgeLabel}
              />
            </View>

            {/* Title & Description */}
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventDesc}>{item.description}</Text>

            {/* Doctor & Hospital Details */}
            <View style={styles.metaRow}>
              <View style={styles.metaDocAvatar}>
                <Ionicons name="person" size={12} color="#0284C7" />
              </View>
              <View style={styles.metaTexts}>
                <Text style={styles.metaDocName} numberOfLines={1}>
                  {formatDoctorName(item.doctor?.name, "Attending Physician")}
                  {item.doctor?.qualification
                    ? ` (${item.doctor.qualification})`
                    : ""}
                </Text>
                <Text style={styles.metaHospName} numberOfLines={1}>
                  {item.hospital?.name || "HealPoint Clinic"}
                  {item.hospital?.city ? ` • ${item.hospital.city}` : ""}
                </Text>
              </View>
            </View>

            {/* Clinical Highlights / Details Box */}
            {item.details && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>{item.details}</Text>
              </View>
            )}

            {/* Action Buttons */}
            {item.actions && item.actions.length > 0 && (
              <View style={styles.actionsWrap}>
                {item.actions.map((act, actIdx) => {
                  const isPrimary = act.variant === "primary";
                  return (
                    <Pressable
                      key={actIdx}
                      accessibilityRole="button"
                      accessibilityLabel={act.label}
                      onPress={() => handleActionPress(act)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        isPrimary && styles.actionButtonPrimary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={
                          (act.icon as keyof typeof Ionicons.glyphMap) ||
                          "arrow-forward"
                        }
                        size={14}
                        color={isPrimary ? "#FFFFFF" : "#0284C7"}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          isPrimary && styles.actionButtonTextPrimary,
                        ]}
                      >
                        {act.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Skeleton Loader for Timeline
  const renderSkeletonLoader = () => (
    <View style={styles.skeletonWrap}>
      {[1, 2, 3].map((k) => (
        <View key={k} style={styles.timelineRow}>
          <View style={styles.spineColumn}>
            <View style={[styles.spineNode, styles.skeletonNode]} />
            {k < 3 && <View style={styles.spineLine} />}
          </View>
          <View style={styles.cardWrapper}>
            <View style={[styles.eventCard, styles.skeletonCard]}>
              <View style={styles.skeletonLineShort} />
              <View style={styles.skeletonLineMed} />
              <View style={styles.skeletonLineLong} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top App Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Health Timeline</Text>
              <View style={styles.timelinePill}>
                <Text style={styles.timelinePillText}>Personal EMR</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>Chronological Healthcare Story</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask HealPoint AI"
            onPress={() => router.push("/ai-assistant" as never)}
            style={({ pressed }) => [
              styles.headerBtnAi,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="sparkles" size={18} color="#0284C7" />
          </Pressable>
          <DrawerToggleButton />
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSummaryHeader()}
          {renderFilterTabs()}
          {renderSkeletonLoader()}
        </ScrollView>
      ) : error ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ErrorState
            title="Failed to Load Timeline"
            message={error}
            onRetry={() => loadTimeline(1, false)}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderTimelineItem}
          ListHeaderComponent={
            <>
              {renderSummaryHeader()}
              {renderFilterTabs()}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title="No Milestones Found"
              message={
                activeFilter === "all"
                  ? "Your authenticated medical milestones will appear here chronologically as you book visits, complete consultations, and receive prescriptions."
                  : `No records found under ${activeFilter}. Switch filter tab or book an appointment to start your journey.`
              }
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Book an Appointment"
                  onPress={() => router.push("/doctors" as never)}
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      styles.actionButtonTextPrimary,
                    ]}
                  >
                    Book an Appointment
                  </Text>
                </Pressable>
              }
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#0284C7" />
                <Text style={styles.footerLoaderText}>
                  Loading more milestones...
                </Text>
              </View>
            ) : hasMore ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more events"
                onPress={onLoadMore}
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.loadMoreBtnText}>
                  Load Previous Milestones
                </Text>
                <Ionicons name="chevron-down" size={16} color="#0284C7" />
              </Pressable>
            ) : events.length > 0 ? (
              <View style={styles.timelineEndBadge}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color="#94A3B8"
                />
                <Text style={styles.timelineEndText}>
                  End of Verified Health Timeline
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0284C7"
              colors={["#0284C7"]}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl * 2,
  },
  flatListContent: {
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
    ...Shadows.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.background,
  },
  headerBtnAi: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
    fontSize: 18,
    fontWeight: "700",
  },
  timelinePill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  timelinePillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#2563EB",
  },
  headerSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },

  // Summary Metrics Header
  summaryContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  nextVisitBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    gap: Spacing.sm,
  },
  nextVisitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  nextVisitInfo: {
    flex: 1,
  },
  nextVisitLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextVisitTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  nextVisitSub: {
    fontSize: 11,
    color: "#475569",
  },
  nextVisitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  nextVisitBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.xs,
    justifyContent: "space-between",
  },
  metricCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  metricName: {
    fontSize: 11,
    fontWeight: "500",
    color: Palette.textMuted,
    marginTop: 1,
  },

  // Filter Tabs
  filterTabsWrap: {
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.background,
  },
  filterTabsScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterTabActive: {
    backgroundColor: "#F0F9FF",
    borderColor: "#0284C7",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterTabTextActive: {
    color: "#0284C7",
    fontWeight: "700",
  },

  // Timeline Structure
  timelineRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  spineColumn: {
    width: 36,
    alignItems: "center",
  },
  spineNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...Shadows.sm,
    zIndex: 2,
  },
  spineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: -2,
    marginBottom: -2,
  },
  cardWrapper: {
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  eventCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  dateTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13,
    color: "#475569",
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
    marginTop: 4,
  },
  metaDocAvatar: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  metaTexts: {
    flex: 1,
  },
  metaDocName: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  metaHospName: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  detailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.sm,
    padding: Spacing.xs + 2,
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  detailsText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
  },
  actionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F1F5F9",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  actionButtonPrimary: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  actionButtonTextPrimary: {
    color: "#FFFFFF",
  },

  // Skeleton Loader styles
  skeletonWrap: {
    paddingTop: Spacing.sm,
  },
  skeletonNode: {
    backgroundColor: "#E2E8F0",
  },
  skeletonCard: {
    backgroundColor: "#F8FAFC",
  },
  skeletonLineShort: {
    width: "40%",
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: Radius.sm,
    marginBottom: 8,
  },
  skeletonLineMed: {
    width: "70%",
    height: 14,
    backgroundColor: "#E2E8F0",
    borderRadius: Radius.sm,
    marginBottom: 8,
  },
  skeletonLineLong: {
    width: "90%",
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: Radius.sm,
  },

  // Pagination & Footer
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  footerLoaderText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
  },
  timelineEndBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  timelineEndText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.75,
  },
});
