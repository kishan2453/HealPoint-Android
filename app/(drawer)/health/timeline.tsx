/**
 * HealPoint — Smart Patient Health & Care Timeline 2.0
 *
 * A flagship patient-side personal healthcare journey unifying 100% authentic data:
 * Appointment -> Payment -> Doctor Acceptance -> Hospital QR Check-in -> OPD Queue Token
 * -> Consultation -> Digital Prescription -> Lab Reports -> Follow-up Advice -> Re-booking.
 *
 * Strictly Patient-side, with full family member isolation and zero duplicate records.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import {
  subscribeToAppointmentSync,
  subscribeToClinicalDocSync,
} from "@/services/socket";
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
  { key: "documents", label: "Documents", icon: "folder-outline" },
  { key: "followups", label: "Follow-ups", icon: "refresh-outline" },
  { key: "reviews", label: "Reviews", icon: "star-outline" },
];

const AI_QUICK_PROMPTS = [
  {
    label: "Last visit summary",
    prompt: "Summarize what happened in my last doctor consultation.",
  },
  {
    label: "Recent medications",
    prompt: "Show my current active prescriptions and medications prescribed.",
  },
  {
    label: "Next care steps",
    prompt:
      "What do I need to prepare or do next for my upcoming healthcare appointments?",
  },
  {
    label: "Follow-up due?",
    prompt: "Check if my doctor advised any pending follow-up visits or tests.",
  },
];

export default function HealthTimelineScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { user } = useAuth();

  const [activeFilter, setActiveFilter] = useState<TimelineFilterType>("all");
  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    memberId || "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<PatientTimelineEvent[]>([]);
  const [summary, setSummary] = useState<PatientTimelineSummary | null>(null);
  const [expandedJourneyIds, setExpandedJourneyIds] = useState<
    Record<string, boolean>
  >({});
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
            familyMemberId: familyMemberFilter,
            page: targetPage,
            limit: 20,
          });

        if (append) {
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newOnes = (res.events || []).filter(
              (e) => !existingIds.has(e.id),
            );
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
    [activeFilter, familyMemberFilter],
  );

  useScreenFocus(
    useCallback(() => {
      loadTimeline(1, false);
    }, [loadTimeline]),
    20_000,
  );

  useEffect(() => {
    loadTimeline(1, false);
  }, [activeFilter, familyMemberFilter, user?._id]);

  // Real-time cross-portal sync: automatically refresh when appointments or clinical docs update
  useEffect(() => {
    if (!user?._id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        loadTimeline(1, false);
      }, 300);
    };

    const unsubAppt = subscribeToAppointmentSync(() => trigger());
    const unsubDoc = subscribeToClinicalDocSync(() => trigger());

    return () => {
      if (timer) clearTimeout(timer);
      unsubAppt();
      unsubDoc();
    };
  }, [user?._id, loadTimeline]);

  const onRefresh = () => {
    loadTimeline(1, false, true);
  };

  const onLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    loadTimeline(page + 1, true);
  };

  const handleActionPress = (action: PatientTimelineAction) => {
    try {
      if (action.params && Object.keys(action.params).length > 0) {
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

  const handleAiPromptPress = (prompt: string) => {
    router.push({
      pathname: "/ai-assistant" as never,
      params: { initialPrompt: prompt },
    });
  };

  // Filtered by Search Query
  const displayedEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase().trim();
    return events.filter((ev) => {
      const matchTitle = ev.title?.toLowerCase().includes(q);
      const matchDesc = ev.description?.toLowerCase().includes(q);
      const matchDoc = ev.doctor?.name?.toLowerCase().includes(q);
      const matchHosp = ev.hospital?.name?.toLowerCase().includes(q);
      const matchDetails = ev.details?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchDoc || matchHosp || matchDetails;
    });
  }, [events, searchQuery]);

  // 1. SMART CURRENT STATUS CARD
  const renderSmartStatusCard = () => {
    const status = summary?.smartCurrentStatus;
    if (!status) return null;

    const isAlert =
      status.key === "in_queue" ||
      status.key === "ready_checkin" ||
      status.key === "consultation_available";

    return (
      <View
        style={[styles.smartStatusCard, isAlert && styles.smartStatusCardAlert]}
      >
        <View style={styles.smartStatusHeader}>
          <View style={styles.smartStatusIconWrap}>
            <Ionicons
              name={
                status.key === "in_queue"
                  ? "people"
                  : status.key === "ready_checkin"
                    ? "qr-code"
                    : status.key === "consultation_available"
                      ? "videocam"
                      : status.key === "waiting_doctor"
                        ? "hourglass-outline"
                        : status.key === "prescription_ready"
                          ? "document-text"
                          : "shield-checkmark"
              }
              size={20}
              color={
                status.key === "in_queue"
                  ? "#0284C7"
                  : status.key === "ready_checkin"
                    ? "#16A34A"
                    : Palette.primary
              }
            />
          </View>
          <View style={styles.smartStatusTitleCol}>
            <Text style={styles.smartStatusLabel}>Active Care Status</Text>
            <Text style={styles.smartStatusTitle}>{status.title}</Text>
          </View>
          <Badge label={status.badgeLabel} variant={status.badgeVariant} />
        </View>

        <Text style={styles.smartStatusDesc}>{status.description}</Text>

        {status.queueToken ? (
          <View style={styles.queueTokenBanner}>
            <View style={styles.queueTokenLeft}>
              <Text style={styles.queueTokenPrefix}>OPD Token</Text>
              <Text style={styles.queueTokenNum}>{status.queueToken}</Text>
            </View>
            <Text style={styles.queueTokenStatus}>
              Status:{" "}
              {(status.queueStatus || "waiting")
                .replace(/_/g, " ")
                .toUpperCase()}
            </Text>
          </View>
        ) : null}

        {status.actionLabel && status.actionRoute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.actionLabel}
            onPress={() => {
              if (
                status.actionParams &&
                Object.keys(status.actionParams).length > 0
              ) {
                router.push({
                  pathname: status.actionRoute as never,
                  params: status.actionParams,
                });
              } else {
                router.push(status.actionRoute as never);
              }
            }}
            style={({ pressed }) => [
              styles.smartStatusActionBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.smartStatusActionText}>
              {status.actionLabel}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    );
  };

  // 2. RECENT HEALTH ACTIVITY STRIP
  const renderRecentActivityStrip = () => {
    const act = summary?.recentActivity;
    if (!act) return null;
    const hasAny =
      act.latestAppointment ||
      act.latestPrescription ||
      act.latestReport ||
      act.latestDocument;
    if (!hasAny) return null;

    return (
      <View style={styles.recentActivityWrap}>
        <View style={styles.recentActivityHeader}>
          <Text style={styles.recentActivityHeading}>
            Recent Health Highlights
          </Text>
          <Pressable onPress={() => router.push("/health-wallet" as never)}>
            <Text style={styles.walletLinkText}>Open Health Wallet ›</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentStripScroll}
        >
          {act.latestAppointment && (
            <Pressable
              style={styles.recentMiniCard}
              onPress={() =>
                router.push({
                  pathname: "/appointment/[id]" as never,
                  params: { id: act.latestAppointment?.id },
                })
              }
            >
              <View
                style={[styles.recentMiniIcon, { backgroundColor: "#EFF6FF" }]}
              >
                <Ionicons name="calendar" size={16} color="#0284C7" />
              </View>
              <Text style={styles.recentMiniTag}>Latest Visit</Text>
              <Text style={styles.recentMiniTitle} numberOfLines={1}>
                {act.latestAppointment.doctorName}
              </Text>
              <Text style={styles.recentMiniSub}>
                {formatDDMMYYYY(act.latestAppointment.date)}
              </Text>
            </Pressable>
          )}

          {act.latestPrescription && (
            <Pressable
              style={styles.recentMiniCard}
              onPress={() => router.push("/health/prescriptions" as never)}
            >
              <View
                style={[styles.recentMiniIcon, { backgroundColor: "#F0F9FF" }]}
              >
                <Ionicons name="document-text" size={16} color="#0284C7" />
              </View>
              <Text style={styles.recentMiniTag}>Digital Rx</Text>
              <Text style={styles.recentMiniTitle} numberOfLines={1}>
                {act.latestPrescription.doctor?.name || "Active Prescription"}
              </Text>
              <Text style={styles.recentMiniSub}>
                {act.latestPrescription.prescriptionDetails?.medicinesCount ||
                  1}{" "}
                Meds
              </Text>
            </Pressable>
          )}

          {act.latestReport && (
            <Pressable
              style={styles.recentMiniCard}
              onPress={() => router.push("/health/reports" as never)}
            >
              <View
                style={[styles.recentMiniIcon, { backgroundColor: "#ECFDF5" }]}
              >
                <Ionicons name="bar-chart" size={16} color="#059669" />
              </View>
              <Text style={styles.recentMiniTag}>Lab Result</Text>
              <Text style={styles.recentMiniTitle} numberOfLines={1}>
                {act.latestReport.title}
              </Text>
              <Text style={styles.recentMiniSub}>
                {formatDDMMYYYY(act.latestReport.date)}
              </Text>
            </Pressable>
          )}

          {act.latestDocument && (
            <Pressable
              style={styles.recentMiniCard}
              onPress={() => router.push("/health/records" as never)}
            >
              <View
                style={[styles.recentMiniIcon, { backgroundColor: "#F3F4F6" }]}
              >
                <Ionicons name="folder-open" size={16} color="#4B5563" />
              </View>
              <Text style={styles.recentMiniTag}>Document</Text>
              <Text style={styles.recentMiniTitle} numberOfLines={1}>
                {act.latestDocument.title}
              </Text>
              <Text style={styles.recentMiniSub}>
                {act.latestDocument.category || "Record"}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    );
  };

  // 3. CONTEXTUAL AI ASSISTANT PROMPTS
  const renderAiPromptsBar = () => (
    <View style={styles.aiBarContainer}>
      <View style={styles.aiBarHeader}>
        <Ionicons name="sparkles" size={15} color="#0284C7" />
        <Text style={styles.aiBarTitle}>Ask HealPoint AI About Your Care</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.aiPromptsScroll}
      >
        {AI_QUICK_PROMPTS.map((q, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [styles.aiChip, pressed && styles.pressed]}
            onPress={() => handleAiPromptPress(q.prompt)}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={13}
              color="#0284C7"
            />
            <Text style={styles.aiChipText}>{q.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // 4. MILESTONES SUMMARY METRICS GRID
  const renderSummaryHeader = () => {
    if (!summary) return null;
    return (
      <View style={styles.summaryContainer}>
        {renderSmartStatusCard()}
        {renderRecentActivityStrip()}
        {renderAiPromptsBar()}

        {/* Milestone Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}
            >
              <Ionicons name="git-commit" size={16} color="#2563EB" />
            </View>
            <Text style={styles.metricVal}>{summary.totalEvents || 0}</Text>
            <Text style={styles.metricName}>Milestones</Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#F0FDF4" }]}
            >
              <Ionicons name="medkit" size={16} color="#16A34A" />
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
              <Ionicons name="document-text" size={16} color="#0284C7" />
            </View>
            <Text style={styles.metricVal}>
              {summary.totalPrescriptions || 0}
            </Text>
            <Text style={styles.metricName}>Digital Rx</Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}
            >
              <Ionicons name="bar-chart" size={16} color="#059669" />
            </View>
            <Text style={styles.metricVal}>{summary.totalReports || 0}</Text>
            <Text style={styles.metricName}>Lab Reports</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search milestones, doctor, medication, tests..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  // Render Filter Tabs
  const renderFilterTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScrollView}
      contentContainerStyle={styles.tabsContainer}
    >
      {FILTER_TABS.map((tab) => {
        const isActive = activeFilter === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => {
              setActiveFilter(tab.key);
              setPage(1);
            }}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={isActive ? "#FFFFFF" : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabButtonText,
                isActive && styles.tabButtonTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // Render Individual Timeline Event
  const renderTimelineItem = ({
    item,
    index,
  }: {
    item: PatientTimelineEvent;
    index: number;
  }) => {
    const isLast = index === displayedEvents.length - 1;
    const isAppointment =
      item.eventType === "appointment" || item.eventType === "hospital_checkin";
    const isJourneyExpanded = Boolean(expandedJourneyIds[item.id]);

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
            {item.doctor?.name && (
              <View style={styles.metaRow}>
                <View style={styles.metaDocAvatar}>
                  <Ionicons name="person" size={12} color="#0284C7" />
                </View>
                <View style={styles.metaTexts}>
                  <Text style={styles.metaDocName} numberOfLines={1}>
                    {formatDoctorName(item.doctor.name, "Attending Physician")}
                    {item.doctor.qualification
                      ? ` (${item.doctor.qualification})`
                      : ""}
                  </Text>
                  <Text style={styles.metaHospName} numberOfLines={1}>
                    {item.hospital?.name || "HealPoint Partner Hospital"}
                    {item.hospital?.city ? ` • ${item.hospital.city}` : ""}
                  </Text>
                </View>
              </View>
            )}

            {/* Details Box */}
            {item.details && (
              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>{item.details}</Text>
              </View>
            )}

            {/* In-Clinic Queue Highlight */}
            {item.queueDetails?.token ? (
              <View style={styles.queueTokenMiniRow}>
                <Ionicons name="ticket-outline" size={14} color="#0284C7" />
                <Text style={styles.queueTokenMiniText}>
                  Queue Token: {item.queueDetails.token} • Status:{" "}
                  {(item.queueDetails.status || "waiting").toUpperCase()}
                </Text>
              </View>
            ) : null}

            {/* Care Journey Lifecycle Stages Accordion */}
            {isAppointment && item.appointmentId && (
              <View style={styles.careJourneyBox}>
                <Pressable
                  style={styles.careJourneyToggle}
                  onPress={() =>
                    setExpandedJourneyIds((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                >
                  <View style={styles.careJourneyToggleLeft}>
                    <Ionicons
                      name="git-network-outline"
                      size={14}
                      color={Palette.primary}
                    />
                    <Text style={styles.careJourneyToggleText}>
                      Smart Care Journey Stages
                    </Text>
                  </View>
                  <Ionicons
                    name={isJourneyExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={Palette.textMuted}
                  />
                </Pressable>

                {isJourneyExpanded && (
                  <View style={styles.journeyStagesRow}>
                    {[
                      { label: "Booked", done: true },
                      { label: "Payment", done: true },
                      { label: "Confirmed", done: item.status !== "cancelled" },
                      {
                        label: "Check-In",
                        done: Boolean(
                          item.queueDetails?.token ||
                          item.eventType === "hospital_checkin",
                        ),
                      },
                      {
                        label: "Consultation",
                        done: item.status === "completed",
                      },
                      {
                        label: "Digital Rx",
                        done: item.status === "completed",
                      },
                    ].map((st, sIdx) => (
                      <View key={sIdx} style={styles.journeyStageItem}>
                        <View
                          style={[
                            styles.journeyStageDot,
                            st.done && styles.journeyStageDotDone,
                          ]}
                        >
                          {st.done ? (
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#FFFFFF"
                            />
                          ) : (
                            <View style={styles.journeyStageInnerDot} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.journeyStageText,
                            st.done && styles.journeyStageTextDone,
                          ]}
                        >
                          {st.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
                <Text style={styles.timelinePillText}>Care Journey 2.0</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              Personal Health Story & Milestones
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Continuity Graph"
            onPress={() => router.push("/health/continuity-graph" as never)}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="git-branch-outline"
              size={18}
              color={Palette.primary}
            />
          </Pressable>
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

      {/* Family Member Isolation Filter */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={setFamilyMemberFilter}
      />

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
          data={displayedEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderTimelineItem}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          ListHeaderComponent={
            <>
              {renderSummaryHeader()}
              {renderFilterTabs()}
            </>
          }
          ListEmptyComponent={
            <EmptyState
              title={
                searchQuery ? "No Matching Milestones" : "No Milestones Found"
              }
              message={
                searchQuery
                  ? `No events matching "${searchQuery}". Clear search or switch filter.`
                  : activeFilter === "all"
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
            ) : displayedEvents.length > 0 ? (
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
    marginTop: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  summaryContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },

  /* Smart Current Care Status Card */
  smartStatusCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  smartStatusCardAlert: {
    borderColor: "#38BDF8",
    backgroundColor: "#F0F9FF",
  },
  smartStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  smartStatusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  smartStatusTitleCol: {
    flex: 1,
  },
  smartStatusLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0284C7",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  smartStatusTitle: {
    ...Typography.h4,
    color: Palette.text,
    fontSize: 15,
  },
  smartStatusDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
    marginVertical: Spacing.xs,
  },
  queueTokenBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  queueTokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  queueTokenPrefix: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  queueTokenNum: {
    ...Typography.h4,
    color: Palette.primary,
    fontWeight: "700",
  },
  queueTokenStatus: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#0284C7",
  },
  smartStatusActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primary,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  smartStatusActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  /* Recent Health Highlights Strip */
  recentActivityWrap: {
    marginVertical: Spacing.xs,
  },
  recentActivityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
    paddingHorizontal: 2,
  },
  recentActivityHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletLinkText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  recentStripScroll: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  recentMiniCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minWidth: 120,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  recentMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  recentMiniTag: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  recentMiniTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  recentMiniSub: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },

  /* AI Contextual Prompts */
  aiBarContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  aiBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.xs,
    marginBottom: 4,
  },
  aiBarTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
  },
  aiPromptsScroll: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xxs,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  aiChipText: {
    fontSize: 11,
    color: "#0369A1",
    fontWeight: "500",
  },

  /* Metrics Grid */
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  metricVal: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  metricName: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 1,
  },

  /* Search Bar */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
    padding: 0,
  },

  /* Tabs */
  tabsScrollView: {
    marginVertical: Spacing.xs,
  },
  tabsContainer: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabButtonActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabButtonText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },

  /* Timeline Row */
  timelineRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
  },
  spineColumn: {
    width: 32,
    alignItems: "center",
  },
  spineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    borderWidth: 2,
    borderColor: Palette.surface,
    ...Shadows.sm,
  },
  spineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Palette.border,
    marginVertical: 2,
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
    ...Typography.caption,
    color: Palette.textMuted,
  },
  eventTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  eventDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  metaDocAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  metaTexts: {
    flex: 1,
  },
  metaDocName: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  metaHospName: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  detailsBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  detailsText: {
    ...Typography.caption,
    color: Palette.text,
    lineHeight: 16,
  },
  queueTokenMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  queueTokenMiniText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#0284C7",
  },

  /* Care Journey Stages Accordion */
  careJourneyBox: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  careJourneyToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  careJourneyToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  careJourneyToggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.primary,
  },
  journeyStagesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: 2,
  },
  journeyStageItem: {
    alignItems: "center",
  },
  journeyStageDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  journeyStageDotDone: {
    backgroundColor: Palette.primary,
  },
  journeyStageInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94A3B8",
  },
  journeyStageText: {
    fontSize: 9,
    color: Palette.textMuted,
  },
  journeyStageTextDone: {
    color: Palette.text,
    fontWeight: "600",
  },

  /* Actions */
  actionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    backgroundColor: "#F0F9FF",
  },
  actionButtonPrimary: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  actionButtonText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#0284C7",
  },
  actionButtonTextPrimary: {
    color: "#FFFFFF",
  },

  /* Footer & Skeletons */
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  footerLoaderText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  loadMoreBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#0284C7",
  },
  timelineEndBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.md,
  },
  timelineEndText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  skeletonWrap: {
    marginTop: Spacing.xs,
  },
  skeletonNode: {
    backgroundColor: "#E2E8F0",
  },
  skeletonCard: {
    gap: Spacing.xs,
  },
  skeletonLineShort: {
    width: "40%",
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
  },
  skeletonLineMed: {
    width: "70%",
    height: 16,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
  },
  skeletonLineLong: {
    width: "90%",
    height: 12,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
  },
});
