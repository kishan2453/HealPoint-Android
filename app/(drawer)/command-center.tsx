/**
 * HealPoint — Smart Care Command Center Screen.
 *
 * Flagship Intelligent Healthcare Cockpit for the patient:
 * Evaluates real-time patient signals to surface:
 * "What does this patient need to know or do RIGHT NOW?"
 *
 * Sections:
 * 1. Cockpit Header with live WebSocket sync indicator.
 * 2. Multi-Patient Family Care Switcher.
 * 3. Hero Care Pulse Cockpit Card (Dynamic operational status & top CTA).
 * 4. "What Should I Do Now?" Priority Action Queue.
 * 5. Active Visit Care Journey Lifecycle Tracker (Booked → Check-in → Queue → Consult → Rx).
 * 6. Live Queue & Appointment Delay Intelligence.
 * 7. Actionable Today's Medication Schedule (Inline "Mark Taken" & "Snooze").
 * 8. Smart Follow-Up & Continuity Recommendations.
 * 9. Digital Health Wallet Snapshot.
 * 10. AI Healthcare Assistant Quick Cockpit.
 * 11. Calm Wellness State & Smart Discovery.
 *
 * 100% Real Backend Data — Zero fabricated health metrics or diagnosis.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
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
import {
  deriveCareCommandSnapshot,
  type CareCommandAction,
  type CareCommandSnapshot,
  type CareJourneyStep,
} from "@/lib/care-command-center";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import * as appointmentService from "@/services/appointments";
import {
  subscribeToAppointmentSync,
  subscribeToQueueSync,
} from "@/services/socket";
import * as walletService from "@/services/wallet";
import type {
  Appointment,
  FollowUpOverviewItem,
  TodayMedicationDose,
} from "@/types";

export default function CareCommandCenterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ memberId?: string }>();
  const { user } = useAuth();
  const userId = user?._id || "";
  const userName = user?.name ? user.name.split(" ")[0] : "Patient";

  // Multi-patient family filter state
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    params.memberId || "all",
  );

  // Core appointment & health overview hooks
  const {
    appointments,
    loading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointments();

  const {
    metrics: healthMetrics,
    recentReport,
    recentPrescription,
    loading: overviewLoading,
    refresh: refreshOverview,
  } = useHealthOverview();

  // Medication reminders & Follow-ups state
  const [todayDoses, setTodayDoses] = useState<TodayMedicationDose[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpOverviewItem[]>([]);
  const [walletCounts, setWalletCounts] = useState<{
    prescriptions: number;
    reports: number;
    records: number;
    passes: number;
    total: number;
  }>({
    prescriptions: 0,
    reports: 0,
    records: 0,
    passes: 0,
    total: 0,
  });

  const [loadingExtras, setLoadingExtras] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(
    null,
  );
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Just now");

  // Fetch Medication Reminders, Follow-ups, and Wallet Counts
  const loadExtras = useCallback(
    async (isBackground = false) => {
      if (!userId) {
        setLoadingExtras(false);
        return;
      }
      if (!isBackground) setLoadingExtras(true);

      const memberFilter =
        selectedMemberId === "all" ? undefined : selectedMemberId;

      try {
        const [remindersRes, followUpsRes, walletCountsRes] =
          await Promise.allSettled([
            appointmentService.getPatientMedicationReminders({
              familyMemberId: memberFilter,
            }),
            appointmentService.getPatientFollowUps({
              familyMemberId: memberFilter,
            }),
            walletService.getHealthWalletCounts(memberFilter),
          ]);

        if (
          remindersRes.status === "fulfilled" &&
          remindersRes.value?.success
        ) {
          setTodayDoses(remindersRes.value.todayReminders || []);
        }

        if (
          followUpsRes.status === "fulfilled" &&
          followUpsRes.value?.success
        ) {
          setFollowUps(followUpsRes.value.followUps || []);
        }

        if (walletCountsRes.status === "fulfilled" && walletCountsRes.value) {
          const counts = walletCountsRes.value;
          setWalletCounts({
            prescriptions: counts.prescriptions || 0,
            reports: counts.reports || 0,
            records: counts.records || 0,
            passes: counts.passes || 0,
            total: counts.total || 0,
          });
        }

        const now = new Date();
        setLastSyncedTime(
          `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
        );
      } catch (err) {
        console.warn("Failed to load command center extras:", err);
      } finally {
        setLoadingExtras(false);
      }
    },
    [userId, selectedMemberId],
  );

  // Sync when screen gains focus or selected member changes
  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  useScreenFocus(() => {
    loadExtras(true);
  }, 10_000);

  // Real-time socket sync
  useEffect(() => {
    if (!userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refetchAppointments();
        loadExtras(true);
      }, 400);
    };

    const unsubscribeAppt = subscribeToAppointmentSync((payload) => {
      if (!payload.userId || String(payload.userId) === String(userId)) {
        triggerSync();
      }
    });

    const unsubscribeQueue = subscribeToQueueSync((payload) => {
      if (!payload.userId || String(payload.userId) === String(userId)) {
        triggerSync();
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeAppt();
      unsubscribeQueue();
    };
  }, [userId, refetchAppointments, loadExtras]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchAppointments(),
      refreshOverview(),
      loadExtras(true),
    ]);
    setRefreshing(false);
  };

  // Filter appointments for the selected member
  const filteredAppointments = useMemo(() => {
    if (selectedMemberId === "all") return appointments;
    if (selectedMemberId === "self") {
      return appointments.filter(
        (a) => !a.familyMemberId || !a.isFamilyBooking,
      );
    }
    return appointments.filter((a) => a.familyMemberId === selectedMemberId);
  }, [appointments, selectedMemberId]);

  // Priority Snapshot evaluation
  const snapshot: CareCommandSnapshot = useMemo(() => {
    return deriveCareCommandSnapshot({
      userId,
      userName,
      appointments: filteredAppointments,
      todayDoses,
      followUps,
      recentReports: recentReport ? [recentReport] : [],
      walletCount: walletCounts.total,
      selectedMemberId,
    });
  }, [
    userId,
    userName,
    filteredAppointments,
    todayDoses,
    followUps,
    recentReport,
    walletCounts.total,
    selectedMemberId,
  ]);

  // Handle inline medication action
  const handleMedicationAction = async (
    dose: TodayMedicationDose,
    action: "taken" | "snoozed",
  ) => {
    if (actionInProgressId) return;
    setActionInProgressId(dose.reminderId);

    try {
      await appointmentService.recordMedicationAction(dose.reminderId, {
        action,
        scheduledDate: dose.scheduledDate,
        scheduledTime: dose.scheduledTime,
      });

      // Update state locally for instant snappy feedback
      setTodayDoses((prev) =>
        prev.map((d) =>
          d.reminderId === dose.reminderId ? { ...d, status: action } : d,
        ),
      );

      if (action === "taken") {
        Alert.alert(
          "Medication Recorded",
          `Marked ${dose.medicineName} (${dose.dosage}) as taken. Keep up the great adherence!`,
        );
      } else {
        Alert.alert(
          "Dose Snoozed",
          `Snoozed ${dose.medicineName}. We'll remind you again shortly.`,
        );
      }

      // Re-sync backend in background
      loadExtras(true);
    } catch (err) {
      Alert.alert(
        "Action Failed",
        "Could not update medication status. Please check your network and try again.",
      );
    } finally {
      setActionInProgressId(null);
    }
  };

  const getTimeGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const isInitialLoading =
    (appointmentsLoading || overviewLoading || loadingExtras) &&
    appointments.length === 0;

  if (isInitialLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <DrawerToggleButton />
          <Text style={styles.headerTitle}>Care Command Center</Text>
          <View style={{ width: 40 }} />
        </View>
        <Loading label="Syncing Live Healthcare Cockpit..." />
      </SafeAreaView>
    );
  }

  const {
    pulse,
    primaryAction,
    secondaryActions,
    activeAppointment,
    activeAppointmentIntel,
    journeyStages,
    pendingDosesToday,
    completedDosesToday,
    pendingFollowUps,
    upcomingAppointments,
    metrics,
  } = snapshot;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      {/* 1. Header with Live Sync Indicator */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DrawerToggleButton />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Care Command</Text>
            <View style={styles.liveSyncBadge}>
              <View
                style={[styles.liveDot, { backgroundColor: pulse.pulseColor }]}
              />
              <Text style={styles.liveSyncText}>
                Live Sync • {lastSyncedTime}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.refreshButtonPressed,
          ]}
          onPress={handleRefresh}
          accessibilityLabel="Refresh Command Center"
        >
          <Ionicons name="sync-outline" size={20} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Palette.primary]}
            tintColor={Palette.primary}
          />
        }
      >
        {/* 2. Multi-Patient Family Care Switcher */}
        <View style={styles.familyBarContainer}>
          <FamilyMemberFilterBar
            selectedMemberId={selectedMemberId}
            onSelectMember={(id) => setSelectedMemberId(id)}
          />
        </View>

        {/* 3. Hero Healthcare Cockpit Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.greetingBox}>
              <Text style={styles.greetingText}>
                {getTimeGreeting()}, {userName} 👋
              </Text>
              <Text style={styles.heroSubtext}>{pulse.headline}</Text>
            </View>

            <View
              style={[
                styles.pulseIndicator,
                { backgroundColor: `${pulse.pulseColor}15` },
              ]}
            >
              <View
                style={[styles.pulseDot, { backgroundColor: pulse.pulseColor }]}
              />
              <Text style={[styles.pulseLabel, { color: pulse.pulseColor }]}>
                {pulse.badgeLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.heroDescription}>{pulse.subheadline}</Text>

          {/* Primary Action Button if Actionable */}
          {primaryAction && (
            <View style={styles.heroActionBox}>
              <Button
                title={primaryAction.ctaLabel}
                variant={primaryAction.variant}
                icon={primaryAction.icon}
                onPress={() => router.push(primaryAction.route as never)}
                style={styles.heroActionButton}
              />
            </View>
          )}

          {/* Cockpit Status Metrics Strip */}
          <View style={styles.cockpitStrip}>
            <View style={styles.cockpitMetricItem}>
              <Text style={styles.cockpitMetricValue}>
                {metrics.todayAppointmentsCount}
              </Text>
              <Text style={styles.cockpitMetricLabel}>Today's Visits</Text>
            </View>
            <View style={styles.cockpitDivider} />
            <View style={styles.cockpitMetricItem}>
              <Text
                style={[
                  styles.cockpitMetricValue,
                  metrics.pendingDosesCount > 0 && { color: "#F59E0B" },
                ]}
              >
                {metrics.pendingDosesCount}
              </Text>
              <Text style={styles.cockpitMetricLabel}>Doses Due</Text>
            </View>
            <View style={styles.cockpitDivider} />
            <View style={styles.cockpitMetricItem}>
              <Text style={styles.cockpitMetricValue}>
                {metrics.pendingFollowUpsCount}
              </Text>
              <Text style={styles.cockpitMetricLabel}>Follow-Ups</Text>
            </View>
            <View style={styles.cockpitDivider} />
            <View style={styles.cockpitMetricItem}>
              <Text style={styles.cockpitMetricValue}>
                {walletCounts.prescriptions + walletCounts.reports}
              </Text>
              <Text style={styles.cockpitMetricLabel}>Rx & Reports</Text>
            </View>
          </View>
        </Card>

        {/* 4. Priority Action Queue ("What Should I Do Now?") */}
        {secondaryActions.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>What Should I Do Now?</Text>
              </View>
              <Badge label="Prioritized" variant="primary" />
            </View>

            {secondaryActions.map((action) => (
              <Card key={action.id} style={styles.actionCard}>
                <View style={styles.actionCardContent}>
                  <View style={styles.actionIconBox}>
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </View>
                </View>

                <Button
                  title={action.ctaLabel}
                  variant={action.variant}
                  onPress={() => router.push(action.route as never)}
                  style={styles.actionCardButton}
                />
              </Card>
            ))}
          </View>
        )}

        {/* 5. Active Visit Care Journey Lifecycle Tracker */}
        {activeAppointment && journeyStages.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="git-commit-outline"
                  size={18}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>Today's Care Journey</Text>
              </View>
              <Text style={styles.sectionMeta}>
                {activeAppointment.slotTime || activeAppointment.slotDate}
              </Text>
            </View>

            <Card style={styles.journeyCard}>
              <View style={styles.journeyDoctorHeader}>
                <View style={styles.journeyDoctorAvatar}>
                  <Ionicons
                    name={
                      activeAppointment.consultationType === "video"
                        ? "videocam"
                        : "medical"
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.journeyDoctorInfo}>
                  <Text style={styles.journeyDoctorName}>
                    {formatDoctorName(
                      typeof activeAppointment.doctorId === "object" &&
                        activeAppointment.doctorId?.name
                        ? activeAppointment.doctorId.name
                        : activeAppointment.doctorName,
                      "Doctor",
                    )}
                  </Text>
                  <Text style={styles.journeyHospitalName}>
                    {typeof activeAppointment.hospitalId === "object" &&
                    activeAppointment.hospitalId?.name
                      ? activeAppointment.hospitalId.name
                      : activeAppointment.hospitalName || "HealPoint Clinic"}
                  </Text>
                </View>
                <Badge
                  label={
                    activeAppointmentIntel?.currentStatus.label ||
                    activeAppointment.status
                  }
                  variant={
                    activeAppointmentIntel?.currentStatus.variant || "primary"
                  }
                />
              </View>

              <View style={styles.journeyStepsContainer}>
                {journeyStages.map((step, idx) => {
                  const isCompleted = step.status === "completed";
                  const isCurrent = step.status === "current";
                  const isLast = idx === journeyStages.length - 1;

                  return (
                    <View key={step.key} style={styles.journeyStepRow}>
                      <View style={styles.stepIndicatorColumn}>
                        <View
                          style={[
                            styles.stepNode,
                            isCompleted && styles.stepNodeCompleted,
                            isCurrent && styles.stepNodeCurrent,
                          ]}
                        >
                          {isCompleted ? (
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#FFFFFF"
                            />
                          ) : (
                            <View
                              style={[
                                styles.stepInnerDot,
                                isCurrent && styles.stepInnerDotCurrent,
                              ]}
                            />
                          )}
                        </View>
                        {!isLast && (
                          <View
                            style={[
                              styles.stepConnector,
                              isCompleted && styles.stepConnectorCompleted,
                            ]}
                          />
                        )}
                      </View>

                      <View style={styles.stepDetailsColumn}>
                        <View style={styles.stepTitleRow}>
                          <Text
                            style={[
                              styles.stepLabel,
                              isCurrent && styles.stepLabelCurrent,
                            ]}
                          >
                            {step.label}
                          </Text>
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>
                                Active Stage
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.stepDescription}>
                          {step.description}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Quick Actions for active appointment */}
              <View style={styles.journeyFooterActions}>
                <Button
                  title="View Pass & Token"
                  variant="outline"
                  icon="qr-code-outline"
                  onPress={() =>
                    router.push(
                      `/appointment/pass/${activeAppointment._id}` as never,
                    )
                  }
                  style={styles.journeyFooterBtn}
                />
                <Button
                  title="Appointment Details"
                  variant="secondary"
                  icon="document-text-outline"
                  onPress={() =>
                    router.push(
                      `/appointment/${activeAppointment._id}` as never,
                    )
                  }
                  style={styles.journeyFooterBtn}
                />
              </View>
            </Card>
          </View>
        )}

        {/* 6. Today's Actionable Medication Schedule */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="medkit-outline"
                size={18}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Today's Medications</Text>
            </View>
            <Pressable
              onPress={() => router.push("/health/prescriptions" as never)}
            >
              <Text style={styles.sectionActionText}>View Prescriptions</Text>
            </Pressable>
          </View>

          {todayDoses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={32}
                color={Palette.success}
              />
              <Text style={styles.emptyCardTitle}>No Medications Due</Text>
              <Text style={styles.emptyCardText}>
                You have no scheduled doses pending for today.
              </Text>
            </Card>
          ) : (
            todayDoses.map((dose) => {
              const isTaken = dose.status === "taken";
              const isPending =
                dose.status === "pending" || dose.status === "snoozed";
              const isLoading = actionInProgressId === dose.reminderId;

              return (
                <Card
                  key={`${dose.reminderId}-${dose.scheduledTime}`}
                  style={[
                    styles.medicationCard,
                    isTaken && styles.medicationCardTaken,
                  ]}
                >
                  <View style={styles.medicationHeader}>
                    <View style={styles.medicationLeft}>
                      <View
                        style={[
                          styles.medicationIconBox,
                          isTaken && styles.medicationIconBoxTaken,
                        ]}
                      >
                        <Ionicons
                          name={isTaken ? "checkmark" : "medkit"}
                          size={18}
                          color={isTaken ? Palette.success : Palette.primary}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.medicineName,
                            isTaken && styles.medicineNameTaken,
                          ]}
                        >
                          {dose.medicineName}
                        </Text>
                        <Text style={styles.medicineDetails}>
                          {dose.dosage} • {dose.timing || "Scheduled"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.medicationTimeBox}>
                      <Text style={styles.medicationTime}>
                        {dose.scheduledTime}
                      </Text>
                      <Badge
                        label={isTaken ? "Taken" : dose.status}
                        variant={isTaken ? "success" : "warning"}
                      />
                    </View>
                  </View>

                  {/* Inline Action Controls */}
                  {isPending && (
                    <View style={styles.medicationActionRow}>
                      <Button
                        title="Mark Taken"
                        variant="primary"
                        icon="checkmark-circle-outline"
                        loading={isLoading}
                        onPress={() => handleMedicationAction(dose, "taken")}
                        style={styles.medActionBtn}
                      />
                      <Button
                        title="Snooze"
                        variant="outline"
                        loading={isLoading}
                        onPress={() => handleMedicationAction(dose, "snoozed")}
                        style={styles.medActionBtn}
                      />
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </View>

        {/* 7. Smart Follow-Up & Continuity */}
        {pendingFollowUps.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons
                  name="repeat-outline"
                  size={18}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>Recommended Follow-Ups</Text>
              </View>
              <Pressable
                onPress={() => router.push("/health/follow-ups" as never)}
              >
                <Text style={styles.sectionActionText}>View All</Text>
              </Pressable>
            </View>

            {pendingFollowUps.slice(0, 2).map((fu) => (
              <Card key={fu.id} style={styles.followUpCard}>
                <View style={styles.followUpHeader}>
                  <View style={styles.fuIconBox}>
                    <Ionicons name="calendar" size={20} color="#8B5CF6" />
                  </View>
                  <View style={styles.fuInfo}>
                    <Text style={styles.fuDoctorName}>{fu.doctorName}</Text>
                    <Text style={styles.fuSpecialty}>{fu.department}</Text>
                  </View>
                  <Badge label="Action Needed" variant="warning" />
                </View>

                <Text style={styles.fuAdvice}>"{fu.advice}"</Text>

                <View style={styles.fuFooter}>
                  <Text style={styles.fuTimeframe}>
                    Advised: {fu.timeframe || "Soon"}
                  </Text>
                  <Button
                    title="Book Slot"
                    variant="primary"
                    onPress={() =>
                      router.push(
                        (fu.doctorId
                          ? `/booking/${fu.doctorId}`
                          : "/health/follow-ups") as never,
                      )
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 8. Digital Health Wallet Quick Snapshot */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="wallet-outline"
                size={18}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Digital Health Vault</Text>
            </View>
            <Pressable onPress={() => router.push("/health-wallet" as never)}>
              <Text style={styles.sectionActionText}>Open Wallet</Text>
            </Pressable>
          </View>

          <View style={styles.walletGrid}>
            <Pressable
              style={styles.walletItem}
              onPress={() => router.push("/health/prescriptions" as never)}
            >
              <View
                style={[
                  styles.walletIconCircle,
                  { backgroundColor: "#EFF6FF" },
                ]}
              >
                <Ionicons name="document-text" size={20} color="#2563EB" />
              </View>
              <Text style={styles.walletValue}>
                {walletCounts.prescriptions}
              </Text>
              <Text style={styles.walletLabel}>Prescriptions</Text>
            </Pressable>

            <Pressable
              style={styles.walletItem}
              onPress={() => router.push("/health/reports" as never)}
            >
              <View
                style={[
                  styles.walletIconCircle,
                  { backgroundColor: "#F0FDF4" },
                ]}
              >
                <Ionicons name="bar-chart" size={20} color="#16A34A" />
              </View>
              <Text style={styles.walletValue}>{walletCounts.reports}</Text>
              <Text style={styles.walletLabel}>Diagnostic Reports</Text>
            </Pressable>

            <Pressable
              style={styles.walletItem}
              onPress={() => router.push("/health/records" as never)}
            >
              <View
                style={[
                  styles.walletIconCircle,
                  { backgroundColor: "#FAF5FF" },
                ]}
              >
                <Ionicons name="folder-open" size={20} color="#9333EA" />
              </View>
              <Text style={styles.walletValue}>{walletCounts.records}</Text>
              <Text style={styles.walletLabel}>EMR Records</Text>
            </Pressable>

            <Pressable
              style={styles.walletItem}
              onPress={() => router.push("/health-wallet" as never)}
            >
              <View
                style={[
                  styles.walletIconCircle,
                  { backgroundColor: "#FFF7ED" },
                ]}
              >
                <Ionicons name="qr-code" size={20} color="#EA580C" />
              </View>
              <Text style={styles.walletValue}>{walletCounts.passes}</Text>
              <Text style={styles.walletLabel}>Digital Passes</Text>
            </Pressable>
          </View>
        </View>

        {/* 9. AI Healthcare Assistant Quick Cockpit */}
        <View style={styles.sectionContainer}>
          <Card style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.aiHeaderText}>
                <Text style={styles.aiTitle}>HealPoint AI Assistant</Text>
                <Text style={styles.aiSubtitle}>
                  Instant triage, consultation readiness, and guidance
                </Text>
              </View>
            </View>

            <View style={styles.aiChipsRow}>
              <Pressable
                style={styles.aiChip}
                onPress={() =>
                  router.push({
                    pathname: "/ai-assistant",
                    params: { q: "Explain my latest prescription" },
                  } as never)
                }
              >
                <Ionicons
                  name="help-circle-outline"
                  size={14}
                  color={Palette.primary}
                />
                <Text style={styles.aiChipText}>Explain my prescription</Text>
              </Pressable>

              <Pressable
                style={styles.aiChip}
                onPress={() =>
                  router.push({
                    pathname: "/ai-assistant",
                    params: { q: "What should I prepare for my doctor visit?" },
                  } as never)
                }
              >
                <Ionicons
                  name="clipboard-outline"
                  size={14}
                  color={Palette.primary}
                />
                <Text style={styles.aiChipText}>Pre-visit checklist</Text>
              </Pressable>

              <Pressable
                style={styles.aiChip}
                onPress={() =>
                  router.push({
                    pathname: "/ai-assistant",
                    params: { q: "Find an available doctor today" },
                  } as never)
                }
              >
                <Ionicons
                  name="search-outline"
                  size={14}
                  color={Palette.primary}
                />
                <Text style={styles.aiChipText}>Find available doctor</Text>
              </Pressable>
            </View>
          </Card>
        </View>

        {/* 10. Smart Discovery & Shortcuts */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Smart Discovery</Text>
          <View style={styles.discoveryRow}>
            <Pressable
              style={styles.discoveryCard}
              onPress={() => router.push("/doctors" as never)}
            >
              <Ionicons
                name="person-add-outline"
                size={22}
                color={Palette.primary}
              />
              <Text style={styles.discoveryTitle}>Find Doctors</Text>
              <Text style={styles.discoverySubtitle}>Verified specialists</Text>
            </Pressable>

            <Pressable
              style={styles.discoveryCard}
              onPress={() => router.push("/hospitals" as never)}
            >
              <Ionicons name="business-outline" size={22} color="#0284C7" />
              <Text style={styles.discoveryTitle}>Hospitals</Text>
              <Text style={styles.discoverySubtitle}>Compare & visit</Text>
            </Pressable>

            <Pressable
              style={styles.discoveryCard}
              onPress={() => router.push("/health/goals" as never)}
            >
              <Ionicons name="trophy-outline" size={22} color="#F59E0B" />
              <Text style={styles.discoveryTitle}>Health Goals</Text>
              <Text style={styles.discoverySubtitle}>Adherence track</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerTitleContainer: {
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "700",
  },
  liveSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveSyncText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    opacity: 0.7,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  familyBarContainer: {
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: `${Palette.primary}25`,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  greetingBox: {
    flex: 1,
  },
  greetingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  heroSubtext: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "700",
    marginTop: 2,
  },
  pulseIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseLabel: {
    ...Typography.caption,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  heroDescription: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  heroActionBox: {
    marginTop: Spacing.lg,
  },
  heroActionButton: {
    width: "100%",
  },
  cockpitStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cockpitMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  cockpitMetricValue: {
    ...Typography.h3,
    color: Palette.primary,
    fontWeight: "800",
  },
  cockpitMetricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cockpitDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  sectionContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  sectionMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  sectionActionText: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "600",
  },
  actionCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  actionCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  actionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  actionCardButton: {
    alignSelf: "flex-end",
  },
  journeyCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  journeyDoctorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    marginBottom: Spacing.lg,
  },
  journeyDoctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDoctorInfo: {
    flex: 1,
  },
  journeyDoctorName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  journeyHospitalName: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  journeyStepsContainer: {
    paddingLeft: Spacing.xs,
  },
  journeyStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepIndicatorColumn: {
    alignItems: "center",
    width: 28,
  },
  stepNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNodeCompleted: {
    backgroundColor: Palette.primary,
  },
  stepNodeCurrent: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
    borderWidth: 2,
  },
  stepInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.textMuted,
  },
  stepInnerDotCurrent: {
    backgroundColor: Palette.primary,
  },
  stepConnector: {
    width: 2,
    height: 44,
    backgroundColor: Palette.border,
  },
  stepConnectorCompleted: {
    backgroundColor: Palette.primary,
  },
  stepDetailsColumn: {
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepLabel: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  stepLabelCurrent: {
    color: Palette.text,
    fontWeight: "700",
  },
  currentBadge: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  currentBadgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontSize: 10,
    fontWeight: "700",
  },
  stepDescription: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  journeyFooterActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  journeyFooterBtn: {
    flex: 1,
  },
  medicationCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  medicationCardTaken: {
    opacity: 0.75,
    backgroundColor: Palette.background,
  },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  medicationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  medicationIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  medicationIconBoxTaken: {
    backgroundColor: "#DCFCE7",
  },
  medicineName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  medicineNameTaken: {
    textDecorationLine: "line-through",
    color: Palette.textMuted,
  },
  medicineDetails: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  medicationTimeBox: {
    alignItems: "flex-end",
    gap: 4,
  },
  medicationTime: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  medicationActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  medActionBtn: {
    flex: 1,
  },
  followUpCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  followUpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  fuIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  fuInfo: {
    flex: 1,
  },
  fuDoctorName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  fuSpecialty: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  fuAdvice: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontStyle: "italic",
    marginTop: Spacing.sm,
  },
  fuFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  fuTimeframe: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  walletGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  walletItem: {
    flex: 1,
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  walletIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  walletValue: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  walletLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  aiCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: `${Palette.primary}30`,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  aiAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiHeaderText: {
    flex: 1,
  },
  aiTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  aiSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  aiChipsRow: {
    flexDirection: "column",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  aiChipText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  discoveryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  discoveryCard: {
    flex: 1,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
  },
  discoveryTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  discoverySubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  emptyCardTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.sm,
  },
  emptyCardText: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
