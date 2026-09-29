/**
 * HealPoint — Smart Health Goals & Wellness Progress Center Screen.
 *
 * Production-ready wellness dashboard connecting real patient records:
 *  - Appointment Adherence
 *  - Medication Reminders Taken
 *  - Follow-Up Consultation Completion
 *  - Health Document & Record Organization
 *
 * STRICT SAFETY BOUNDARY:
 *  - NOT a diagnosis or clinical evaluation system.
 *  - Displays 100% authentic, user-provided or clinician-entered records.
 *  - Calculates factual milestones without fabricating metrics or inferences.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/hooks/use-auth";
import { useHealthOverview } from "@/hooks/use-health-overview";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY } from "@/lib/format";
import {
  calculateGoalProgress,
  computeCareScore,
  GOAL_TYPE_CONFIG,
} from "@/lib/goal-progress";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as goalService from "@/services/health-goals";
import * as walletService from "@/services/wallet";
import type {
  Appointment,
  CreateHealthGoalPayload,
  FollowUpOverviewItem,
  HealthGoal,
  HealthGoalStatus,
  HealthGoalType,
  MedicationReminder,
} from "@/types";

type StatusTab = "all" | "active" | "completed" | "paused";

export default function HealthGoalsScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { user } = useAuth();
  const userId = user?._id || "";

  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>(
    memberId || "all",
  );
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberId) {
      setSelectedMember(memberId);
    }
  }, [memberId]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Real underlying data sources for progress calculation
  const { appointments: userAppointments, upcoming: upcomingAppointments } =
    useAppointments();
  const [followUps, setFollowUps] = useState<FollowUpOverviewItem[]>([]);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);
  const [walletCounts, setWalletCounts] =
    useState<walletService.HealthWalletCounts | null>(null);

  // Health overview for recent real activities and care score
  const { metrics, recentActivities } = useHealthOverview();

  // Create / Edit Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<HealthGoal | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<HealthGoalType>(
    "appointment_adherence",
  );
  const [formTarget, setFormTarget] = useState("3");
  const [formEndDate, setFormEndDate] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Load all authentic health progress data
  const loadData = useCallback(
    async (isPullToRefresh = false) => {
      if (!userId) {
        setLoading(false);
        return;
      }

      if (isPullToRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const familyParam =
          selectedMember === "all" ? undefined : selectedMember;

        const [goalsRes, followUpsRes, remindersRes, walletRes] =
          await Promise.allSettled([
            goalService.getHealthGoals(userId, { familyMemberId: familyParam }),
            appointmentService.getPatientFollowUps({
              familyMemberId: familyParam,
            }),
            appointmentService.getPatientMedicationReminders({
              familyMemberId: familyParam,
            }),
            walletService.getHealthWalletCounts(userId),
          ]);

        if (goalsRes.status === "fulfilled" && goalsRes.value.goals) {
          setGoals(goalsRes.value.goals);
        }
        if (
          followUpsRes.status === "fulfilled" &&
          followUpsRes.value.followUps
        ) {
          setFollowUps(followUpsRes.value.followUps);
        }
        if (
          remindersRes.status === "fulfilled" &&
          remindersRes.value.reminders
        ) {
          setReminders(remindersRes.value.reminders);
        }
        if (walletRes.status === "fulfilled") {
          setWalletCounts(walletRes.value);
        }
      } catch (err) {
        setError(
          toErrorMessage(err, "Failed to load Health Goals & Wellness data."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, selectedMember],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScreenFocus(() => {
    loadData();
  }, 15000);

  // Filter appointments for family member if selected
  const filteredAppointments = useMemo(() => {
    if (selectedMember === "all") return userAppointments;
    if (selectedMember === "self") {
      return userAppointments.filter(
        (a) => !a.familyMemberId || a.familyMemberId === "self",
      );
    }
    return userAppointments.filter((a) => a.familyMemberId === selectedMember);
  }, [userAppointments, selectedMember]);

  // Derived filtered goals for active status tab
  const displayedGoals = useMemo(() => {
    if (activeTab === "all") return goals;
    return goals.filter((g) => g.status === activeTab);
  }, [goals, activeTab]);

  // Care Milestone score
  const careScore = useMemo(() => computeCareScore(metrics), [metrics]);

  // Counts for tabs
  const stats = useMemo(() => {
    return {
      all: goals.length,
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      paused: goals.filter((g) => g.status === "paused").length,
    };
  }, [goals]);

  // Handlers for Goal Actions
  const handleOpenCreateModal = (
    prefillType?: HealthGoalType,
    prefillTarget?: number,
    prefillTitle?: string,
  ) => {
    setEditingGoal(null);
    setFormTitle(
      prefillTitle || (prefillType ? GOAL_TYPE_CONFIG[prefillType].label : ""),
    );
    setFormType(prefillType || "appointment_adherence");
    setFormTarget(prefillTarget ? String(prefillTarget) : "3");
    setFormEndDate("");
    setFormError("");
    setIsModalVisible(true);
  };

  const handleOpenEditModal = (goal: HealthGoal) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormType(goal.goalType);
    setFormTarget(String(goal.target));
    setFormEndDate(goal.endDate || "");
    setFormError("");
    setIsModalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!formTitle.trim()) {
      setFormError("Please enter a goal title.");
      return;
    }
    const targetNum = parseInt(formTarget.trim(), 10);
    if (isNaN(targetNum) || targetNum <= 0) {
      setFormError("Target must be a positive number.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");

    try {
      if (editingGoal) {
        const res = await goalService.updateHealthGoal(
          userId,
          editingGoal._id,
          {
            title: formTitle.trim(),
            target: targetNum,
            endDate: formEndDate.trim() || null,
          },
        );
        if (res.goal) {
          setGoals((prev) =>
            prev.map((g) => (g._id === res.goal._id ? res.goal : g)),
          );
        }
      } else {
        const payload: CreateHealthGoalPayload = {
          title: formTitle.trim(),
          goalType: formType,
          target: targetNum,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: formEndDate.trim() || undefined,
          familyMemberId:
            selectedMember !== "all" && selectedMember !== "self"
              ? selectedMember
              : undefined,
        };
        const res = await goalService.createHealthGoal(userId, payload);
        if (res.goal) {
          setGoals((prev) => [res.goal, ...prev]);
        }
      }
      setIsModalVisible(false);
    } catch (err) {
      setFormError(
        toErrorMessage(err, "Failed to save goal. Please try again."),
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleTogglePause = async (goal: HealthGoal) => {
    const nextStatus: HealthGoalStatus =
      goal.status === "paused" ? "active" : "paused";
    try {
      const res = await goalService.updateHealthGoal(userId, goal._id, {
        status: nextStatus,
      });
      if (res.goal) {
        setGoals((prev) =>
          prev.map((g) => (g._id === res.goal._id ? res.goal : g)),
        );
      }
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err, "Could not update goal status."),
      );
    }
  };

  const handleDeleteGoal = (goal: HealthGoal) => {
    Alert.alert(
      "Delete Health Goal",
      `Are you sure you want to delete "${goal.title}"? Your authentic appointments and medical records will not be altered.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await goalService.deleteHealthGoal(userId, goal._id);
              setGoals((prev) => prev.filter((g) => g._id !== goal._id));
            } catch (err) {
              Alert.alert(
                "Error",
                toErrorMessage(err, "Failed to delete goal."),
              );
            }
          },
        },
      ],
    );
  };

  // Find upcoming event (appointment, follow-up, or reminder)
  const nextAppointment = upcomingAppointments[0];
  const nextFollowUp = followUps.find(
    (fu) => fu.status === "scheduled" || fu.status === "pending_booking",
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DrawerToggleButton />
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Health Goals</Text>
            <Text style={styles.subtitle}>Wellness & Care Progress</Text>
          </View>
        </View>
        <Pressable
          style={styles.newGoalButton}
          onPress={() => handleOpenCreateModal()}
          accessibilityRole="button"
          accessibilityLabel="Add New Health Goal"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.newGoalButtonText}>New Goal</Text>
        </Pressable>
      </View>

      {/* Family Member Filter Bar */}
      <FamilyMemberFilterBar
        selectedMemberId={selectedMember}
        onSelectMember={setSelectedMember}
        style={styles.familyBar}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Safety Disclaimer Banner */}
        <View style={styles.safetyBanner}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={Palette.primary}
          />
          <Text style={styles.safetyBannerText}>
            Factual progress center • Derived strictly from authentic medical
            records • Not a medical diagnosis
          </Text>
        </View>

        {/* Care Milestone & Wellness Progress Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroOverline}>CARE CONTINUITY INDEX</Text>
              <Text style={styles.heroTitle}>Wellness Progress</Text>
            </View>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{careScore}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
          </View>

          <View style={styles.heroStatsGrid}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>
                {metrics.completedConsultations}
              </Text>
              <Text style={styles.heroStatLabel}>Visits Completed</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>{reminders.length}</Text>
              <Text style={styles.heroStatLabel}>Active Reminders</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>
                {walletCounts?.total || metrics.medicalRecordsCount}
              </Text>
              <Text style={styles.heroStatLabel}>Documents Stored</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatNumber}>{stats.completed}</Text>
              <Text style={styles.heroStatLabel}>Goals Achieved</Text>
            </View>
          </View>
        </Card>

        {/* Status Tabs */}
        <View style={styles.tabsRow}>
          {(
            [
              { key: "all", label: `All (${stats.all})` },
              { key: "active", label: `Active (${stats.active})` },
              { key: "completed", label: `Completed (${stats.completed})` },
              { key: "paused", label: `Paused (${stats.paused})` },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
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
        </View>

        {/* Loading / Error / Goals List */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={styles.loadingText}>
              Calculating real progress metrics...
            </Text>
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} />
        ) : displayedGoals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title={
                activeTab === "all"
                  ? "No Health Goals Set"
                  : `No ${activeTab} Goals`
              }
              message={
                activeTab === "all"
                  ? "Track your healthcare milestones factually. Create personal goals for appointments, medication reminders, or medical records."
                  : `You have no ${activeTab} health goals at this time.`
              }
              action={
                <Button
                  title="+ Create Your First Goal"
                  onPress={() => handleOpenCreateModal()}
                />
              }
            />
            {/* Quick Template Starters */}
            {activeTab === "all" && (
              <View style={styles.startersSection}>
                <Text style={styles.startersHeader}>
                  Suggested Personal Goals
                </Text>
                <View style={styles.startersGrid}>
                  <Pressable
                    style={styles.starterChip}
                    onPress={() =>
                      handleOpenCreateModal(
                        "appointment_adherence",
                        3,
                        "Complete 3 Doctor Visits",
                      )
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#2F80ED"
                    />
                    <Text style={styles.starterChipText}>3 Appointments</Text>
                  </Pressable>
                  <Pressable
                    style={styles.starterChip}
                    onPress={() =>
                      handleOpenCreateModal(
                        "medication_adherence",
                        15,
                        "Mark 15 Medication Doses",
                      )
                    }
                  >
                    <Ionicons
                      name="medical-outline"
                      size={16}
                      color="#10B981"
                    />
                    <Text style={styles.starterChipText}>
                      15 Medication Doses
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.starterChip}
                    onPress={() =>
                      handleOpenCreateModal(
                        "followup_completion",
                        2,
                        "Complete 2 Follow-Ups",
                      )
                    }
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color="#9356D6"
                    />
                    <Text style={styles.starterChipText}>2 Follow-Ups</Text>
                  </Pressable>
                  <Pressable
                    style={styles.starterChip}
                    onPress={() =>
                      handleOpenCreateModal(
                        "record_organization",
                        5,
                        "Organize 5 Health Records",
                      )
                    }
                  >
                    <Ionicons
                      name="folder-open-outline"
                      size={16}
                      color="#0284C7"
                    />
                    <Text style={styles.starterChipText}>
                      5 Health Documents
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Card>
        ) : (
          <View style={styles.goalsList}>
            {displayedGoals.map((goal) => {
              const config = GOAL_TYPE_CONFIG[goal.goalType] || {
                label: "Personal Goal",
                icon: "trophy-outline",
                color: Palette.primary,
                description: "",
              };

              const progress = calculateGoalProgress(goal, {
                appointments: filteredAppointments,
                reminders,
                followUps,
                walletCounts,
              });

              const isCompleted =
                goal.status === "completed" || progress.percentage >= 100;
              const isPaused = goal.status === "paused";

              return (
                <Card key={goal._id} style={styles.goalCard}>
                  {/* Top Bar: Icon, Title & Status */}
                  <View style={styles.goalTopRow}>
                    <View
                      style={[
                        styles.goalIconContainer,
                        { backgroundColor: `${config.color}15` },
                      ]}
                    >
                      <Ionicons
                        name={config.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={config.color}
                      />
                    </View>
                    <View style={styles.goalTitleContainer}>
                      <Text style={styles.goalTitleText} numberOfLines={1}>
                        {goal.title}
                      </Text>
                      <Text style={styles.goalTypeSubtitle}>
                        {config.label}
                      </Text>
                    </View>
                    <Badge
                      label={
                        isCompleted
                          ? "Completed"
                          : isPaused
                            ? "Paused"
                            : "Active"
                      }
                      variant={
                        isCompleted
                          ? "success"
                          : isPaused
                            ? "neutral"
                            : "primary"
                      }
                    />
                  </View>

                  {/* Progress Bar & Factual Label */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressNumbersRow}>
                      <Text style={styles.progressFactualLabel}>
                        {progress.label}
                      </Text>
                      <Text
                        style={[
                          styles.progressPercentage,
                          { color: config.color },
                        ]}
                      >
                        {progress.hasEnoughData
                          ? `${progress.percentage}%`
                          : "--"}
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progress.percentage}%`,
                            backgroundColor: isCompleted
                              ? "#10B981"
                              : config.color,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Completion Celebration Badge */}
                  {isCompleted && (
                    <View style={styles.celebrationBanner}>
                      <Ionicons name="sparkles" size={16} color="#059669" />
                      <Text style={styles.celebrationText}>
                        Goal reached: {goal.target} {config.label.toLowerCase()}{" "}
                        milestones achieved!
                      </Text>
                    </View>
                  )}

                  {/* Dates & Actions Row */}
                  <View style={styles.goalFooterRow}>
                    <Text style={styles.goalDatesText}>
                      Started {formatDDMMYYYY(goal.startDate)}
                      {goal.endDate
                        ? ` • Target: ${formatDDMMYYYY(goal.endDate)}`
                        : ""}
                    </Text>
                    <View style={styles.goalActionsRow}>
                      <Pressable
                        style={styles.goalActionIconButton}
                        onPress={() => handleTogglePause(goal)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isPaused ? "Resume Goal" : "Pause Goal"
                        }
                      >
                        <Ionicons
                          name={isPaused ? "play-outline" : "pause-outline"}
                          size={18}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.goalActionIconButton}
                        onPress={() => handleOpenEditModal(goal)}
                        accessibilityRole="button"
                        accessibilityLabel="Edit Goal"
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={18}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.goalActionIconButton}
                        onPress={() => handleDeleteGoal(goal)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete Goal"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#EF4444"
                        />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Upcoming Care Event Integration */}
        {(nextAppointment || nextFollowUp) && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Upcoming Care</Text>
            {nextAppointment ? (
              <Pressable
                style={styles.upcomingCard}
                onPress={() =>
                  router.push(
                    `/appointment/${nextAppointment._id || nextAppointment.appointmentId}` as never,
                  )
                }
              >
                <View style={styles.upcomingLeft}>
                  <View
                    style={[
                      styles.upcomingIconCircle,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Ionicons name="calendar" size={20} color="#2F80ED" />
                  </View>
                  <View>
                    <Text style={styles.upcomingTitle}>Doctor Appointment</Text>
                    <Text style={styles.upcomingSubtitle}>
                      {nextAppointment.doctorName || "Doctor Consultation"} •{" "}
                      {nextAppointment.slotDate ||
                        nextAppointment.date ||
                        "Upcoming"}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Palette.textMuted}
                />
              </Pressable>
            ) : (
              <Pressable
                style={styles.upcomingCard}
                onPress={() => router.push("/health/follow-ups" as never)}
              >
                <View style={styles.upcomingLeft}>
                  <View
                    style={[
                      styles.upcomingIconCircle,
                      { backgroundColor: "#F5F3FF" },
                    ]}
                  >
                    <Ionicons name="refresh" size={20} color="#9356D6" />
                  </View>
                  <View>
                    <Text style={styles.upcomingTitle}>
                      Recommended Follow-Up
                    </Text>
                    <Text style={styles.upcomingSubtitle}>
                      Dr. {nextFollowUp?.doctorName || "Doctor"} •{" "}
                      {nextFollowUp?.timeframe || "Follow-up due"}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Palette.textMuted}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* Recent Health Activity from Real Timeline */}
        {recentActivities.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Health Activity</Text>
              <Pressable
                onPress={() => router.push("/health/timeline" as never)}
              >
                <Text style={styles.viewTimelineLink}>View Timeline</Text>
              </Pressable>
            </View>
            <View style={styles.recentActivitiesList}>
              {recentActivities.slice(0, 3).map((act) => (
                <View key={act.id} style={styles.activityItemRow}>
                  <View
                    style={[
                      styles.activityDot,
                      { backgroundColor: act.tint || Palette.primary },
                    ]}
                  />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{act.title}</Text>
                    <Text style={styles.activityDesc} numberOfLines={1}>
                      {act.description}
                    </Text>
                  </View>
                  <Text style={styles.activityDate}>{act.date}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Connected Health Vault Hubs */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Connected Health Hubs</Text>
          <View style={styles.hubsGrid}>
            <Pressable
              style={styles.hubCard}
              onPress={() => router.push("/health/timeline" as never)}
            >
              <View style={[styles.hubIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="time-outline" size={22} color="#2F80ED" />
              </View>
              <Text style={styles.hubTitle}>Timeline</Text>
              <Text style={styles.hubSub}>Visit History</Text>
            </Pressable>

            <Pressable
              style={styles.hubCard}
              onPress={() => router.push("/health/prescriptions" as never)}
            >
              <View style={[styles.hubIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="medical-outline" size={22} color="#10B981" />
              </View>
              <Text style={styles.hubTitle}>Prescriptions</Text>
              <Text style={styles.hubSub}>Reminders & Rx</Text>
            </Pressable>

            <Pressable
              style={styles.hubCard}
              onPress={() => router.push("/health/records" as never)}
            >
              <View style={[styles.hubIcon, { backgroundColor: "#F0F9FF" }]}>
                <Ionicons
                  name="folder-open-outline"
                  size={22}
                  color="#0284C7"
                />
              </View>
              <Text style={styles.hubTitle}>Records</Text>
              <Text style={styles.hubSub}>Reports & Notes</Text>
            </Pressable>

            <Pressable
              style={styles.hubCard}
              onPress={() => router.push("/health-wallet" as never)}
            >
              <View style={[styles.hubIcon, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons name="wallet-outline" size={22} color="#9356D6" />
              </View>
              <Text style={styles.hubTitle}>Health Wallet</Text>
              <Text style={styles.hubSub}>Passes & Bills</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Create / Edit Goal Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGoal ? "Edit Health Goal" : "Set New Health Goal"}
              </Text>
              <Pressable
                onPress={() => setIsModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Modal"
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBody}
            >
              {/* Goal Title */}
              <Text style={styles.inputLabel}>Goal Title *</Text>
              <TextInput
                style={styles.textInput}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g., Complete 4 routine consultations"
                placeholderTextColor={Palette.textMuted}
              />

              {/* Goal Type Selection (only editable on creation) */}
              {!editingGoal && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Goal Category *</Text>
                  {(
                    [
                      "appointment_adherence",
                      "medication_adherence",
                      "followup_completion",
                      "record_organization",
                    ] as HealthGoalType[]
                  ).map((type) => {
                    const cfg = GOAL_TYPE_CONFIG[type];
                    const isSelected = formType === type;
                    return (
                      <Pressable
                        key={type}
                        style={[
                          styles.typeOptionCard,
                          isSelected && styles.typeOptionCardSelected,
                        ]}
                        onPress={() => setFormType(type)}
                      >
                        <View
                          style={[
                            styles.typeOptionIcon,
                            { backgroundColor: `${cfg.color}15` },
                          ]}
                        >
                          <Ionicons
                            name={cfg.icon as keyof typeof Ionicons.glyphMap}
                            size={18}
                            color={cfg.color}
                          />
                        </View>
                        <View style={styles.typeOptionContent}>
                          <Text style={styles.typeOptionTitle}>
                            {cfg.label}
                          </Text>
                          <Text style={styles.typeOptionDesc}>
                            {cfg.description}
                          </Text>
                        </View>
                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={20}
                          color={isSelected ? Palette.primary : Palette.border}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Target Count */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Target Number (Milestones to complete) *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={formTarget}
                  onChangeText={setFormTarget}
                  keyboardType="number-pad"
                  placeholder="e.g., 3"
                  placeholderTextColor={Palette.textMuted}
                />
              </View>

              {/* Optional End Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Target Date (Optional, YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={formEndDate}
                  onChangeText={setFormEndDate}
                  placeholder="e.g., 2026-12-31"
                  placeholderTextColor={Palette.textMuted}
                />
              </View>

              {formError ? (
                <Text style={styles.modalErrorText}>{formError}</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsModalVisible(false)}
                  style={styles.modalCancelButton}
                />
                <Button
                  title={editingGoal ? "Save Changes" : "Create Goal"}
                  loading={formSubmitting}
                  onPress={handleSaveGoal}
                  style={styles.modalSubmitButton}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitles: {
    marginLeft: Spacing.xs,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  newGoalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  newGoalButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
  },
  familyBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  safetyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: `${Palette.primary}0D`,
    borderWidth: 1,
    borderColor: `${Palette.primary}25`,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  safetyBannerText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    flex: 1,
  },
  heroCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    ...Shadows.sm,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heroOverline: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
    letterSpacing: 0.5,
  },
  heroTitle: {
    ...Typography.h2,
    color: Palette.text,
  },
  scoreCircle: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: `${Palette.primary}12`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "800",
    color: Palette.primary,
  },
  scoreMax: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textMuted,
    marginLeft: 2,
  },
  heroStatsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatNumber: {
    ...Typography.h3,
    color: Palette.text,
  },
  heroStatLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: Palette.border,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  tabButtonActive: {
    backgroundColor: Palette.primary,
  },
  tabButtonText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  emptyCard: {
    padding: Spacing.lg,
  },
  startersSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  startersHeader: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: Spacing.sm,
  },
  startersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  starterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  starterChipText: {
    ...Typography.caption,
    color: Palette.text,
  },
  goalsList: {
    gap: Spacing.md,
  },
  goalCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    ...Shadows.sm,
  },
  goalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitleText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.text,
  },
  goalTypeSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  progressSection: {
    marginTop: Spacing.md,
  },
  progressNumbersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressFactualLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  progressPercentage: {
    ...Typography.caption,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: `${Palette.border}70`,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  celebrationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginTop: Spacing.sm,
  },
  celebrationText: {
    ...Typography.caption,
    fontWeight: "600",
    color: "#059669",
    flex: 1,
  },
  goalFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  goalDatesText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  goalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goalActionIconButton: {
    padding: 6,
    borderRadius: Radius.sm,
  },
  sectionContainer: {
    gap: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.text,
  },
  viewTimelineLink: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  upcomingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  upcomingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  upcomingSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  recentActivitiesList: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  activityItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  activityDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  activityDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  hubsGrid: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  hubCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  hubIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  hubTitle: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    textAlign: "center",
  },
  hubSub: {
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...Typography.label,
    color: Palette.textMuted,
  },
  textInput: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
  },
  typeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  typeOptionCardSelected: {
    borderColor: Palette.primary,
    backgroundColor: `${Palette.primary}0A`,
  },
  typeOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  typeOptionContent: {
    flex: 1,
  },
  typeOptionTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  typeOptionDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalErrorText: {
    ...Typography.caption,
    color: "#EF4444",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalSubmitButton: {
    flex: 1,
  },
});
