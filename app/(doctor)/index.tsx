/**
 * HealPoint - Doctor Command Center & Live Clinic Pulse.
 *
 * Professional doctor landing dashboard with:
 * - Live OPD Queue & Clinic Pulse metrics
 * - Active Consultation Spotlight (with 1-tap Clinical Workspace launch)
 * - Quick clinical navigation shortcuts
 * - Today's Live Patient Queue list with token management
 *
 * 100% authentic backend data via doctorPanelController.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RoleGuard } from "@/components/RoleGuard";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Spacing,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { toErrorMessage } from "@/services/api";
import * as doctorPortalService from "@/services/doctor-portal";
import type { DoctorPatientQueueResponse } from "@/types";

export default function DoctorDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const doctorId = user?._id || "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [queueData, setQueueData] = useState<DoctorPatientQueueResponse | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!doctorId) {
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        const res = await doctorPortalService.getDoctorPatientQueue(doctorId);
        if (res?.success) {
          setQueueData(res);
        } else {
          setError("Failed to fetch clinic queue status.");
        }
      } catch (err) {
        setError(toErrorMessage(err, "Could not load doctor dashboard."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [doctorId],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = queueData?.summary;
  const currentConsultation = summary?.currentConsultation;
  const queueList = queueData?.queue || [];

  const handleQueueAction = async (
    appointmentId: string,
    action: "call" | "start" | "complete" | "skip",
  ) => {
    try {
      const res = await doctorPortalService.executeQueueAction(doctorId, appointmentId, action);
      if (res?.success) {
        await loadDashboard(true);
      }
    } catch (err) {
      Alert.alert("Action Failed", toErrorMessage(err, "Could not update queue status."));
    }
  };

  const getStageBadge = (stage?: string): { label: string; variant: BadgeVariant } => {
    switch (stage) {
      case "in_consultation":
        return { label: "In Consultation", variant: "warning" };
      case "checked_in":
        return { label: "Checked In", variant: "success" };
      case "waiting":
        return { label: "Waiting", variant: "primary" };
      case "completed":
        return { label: "Completed", variant: "neutral" };
      case "cancelled":
        return { label: "Cancelled", variant: "error" };
      default:
        return { label: "Scheduled", variant: "neutral" };
    }
  };

  return (
    <RoleGuard allowedRoles={["doctor"]}>
      <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeGreeting}>Welcome back,</Text>
            <Text style={styles.doctorNameText}>Dr. {user?.name || "Doctor"}</Text>
            <Text style={styles.hospitalAffiliation}>
              {user?.hospitalName ? `${user.hospitalName} · ` : ""}OPD Clinical Station
            </Text>
          </View>
          <Pressable onPress={() => router.push("/doctor/profile")} style={styles.profileBadgeBtn}>
            <Ionicons name="medkit" size={20} color={Palette.accent} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDashboard(true)}
              tintColor={Palette.accent}
            />
          }
        >
          {loading && !refreshing ? (
            <Loading label="Syncing live clinic pulse..." />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadDashboard()} />
          ) : (
            <>
              {/* Live OPD Queue Pulse Banner */}
              <View style={styles.pulseBanner}>
                <View style={styles.pulseHeaderRow}>
                  <View style={styles.pulseLiveIndicator}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.pulseLiveText}>TODAY'S CLINIC PULSE</Text>
                  </View>
                  <Text style={styles.pulseDateText}>{summary?.todayDate || "Today"}</Text>
                </View>

                <View style={styles.pulseStatsGrid}>
                  <View style={styles.pulseStatBox}>
                    <Text style={styles.pulseStatNumber}>{summary?.totalToday || 0}</Text>
                    <Text style={styles.pulseStatLabel}>Total Scheduled</Text>
                  </View>
                  <View style={styles.pulseStatBox}>
                    <Text style={[styles.pulseStatNumber, { color: Palette.success }]}>
                      {summary?.checkedInCount || 0}
                    </Text>
                    <Text style={styles.pulseStatLabel}>Checked-In</Text>
                  </View>
                  <View style={styles.pulseStatBox}>
                    <Text style={[styles.pulseStatNumber, { color: Palette.warning }]}>
                      {summary?.inConsultationCount || 0}
                    </Text>
                    <Text style={styles.pulseStatLabel}>In Progress</Text>
                  </View>
                  <View style={styles.pulseStatBox}>
                    <Text style={[styles.pulseStatNumber, { color: Palette.primaryDark }]}>
                      {summary?.completedCount || 0}
                    </Text>
                    <Text style={styles.pulseStatLabel}>Completed</Text>
                  </View>
                </View>
              </View>

              {/* Active Consultation Spotlight Card */}
              {currentConsultation ? (
                <Card style={styles.activeConsultationCard}>
                  <View style={styles.activeHeaderRow}>
                    <View style={styles.activeIconBox}>
                      <Ionicons name="pulse" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeLabel}>ACTIVE CLINICAL SESSION</Text>
                      <Text style={styles.activePatientName}>
                        {currentConsultation.patientName || "Patient"}
                      </Text>
                      <Text style={styles.activePatientMeta}>
                        Token #{currentConsultation.queueToken || "1"} ·{" "}
                        {currentConsultation.slotTime || "In-Progress"}
                      </Text>
                    </View>
                    <Badge label="IN SESSION" variant="warning" />
                  </View>

                  <Pressable
                    onPress={() => router.push(`/doctor/workspace/${currentConsultation._id}`)}
                    style={styles.resumeWorkspaceBtn}
                  >
                    <Ionicons name="medkit" size={16} color="#fff" />
                    <Text style={styles.resumeWorkspaceText}>
                      Resume Doctor Clinical Workspace 2.0
                    </Text>
                  </Pressable>
                </Card>
              ) : null}

              {/* Quick Actions Grid */}
              <View style={styles.quickShortcutsGrid}>
                <Pressable
                  onPress={() => router.push("/doctor/appointments")}
                  style={styles.shortcutCard}
                >
                  <View style={[styles.shortcutIconBox, { backgroundColor: Palette.primaryLight }]}>
                    <Ionicons name="calendar" size={20} color={Palette.primaryDark} />
                  </View>
                  <Text style={styles.shortcutTitle}>Appointments</Text>
                  <Text style={styles.shortcutSub}>View full roster</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/doctor/follow-ups")}
                  style={styles.shortcutCard}
                >
                  <View style={[styles.shortcutIconBox, { backgroundColor: "#E2F5E9" }]}>
                    <Ionicons name="repeat" size={20} color={Palette.success} />
                  </View>
                  <Text style={styles.shortcutTitle}>Follow-Ups</Text>
                  <Text style={styles.shortcutSub}>Care plan adherence</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/doctor/availability")}
                  style={styles.shortcutCard}
                >
                  <View style={[styles.shortcutIconBox, { backgroundColor: "#FDF0DC" }]}>
                    <Ionicons name="time" size={20} color={Palette.warning} />
                  </View>
                  <Text style={styles.shortcutTitle}>Availability</Text>
                  <Text style={styles.shortcutSub}>Slot calendar</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/doctor/profile")}
                  style={styles.shortcutCard}
                >
                  <View style={[styles.shortcutIconBox, { backgroundColor: Palette.border }]}>
                    <Ionicons name="person-circle" size={20} color={Palette.text} />
                  </View>
                  <Text style={styles.shortcutTitle}>Profile</Text>
                  <Text style={styles.shortcutSub}>Hospital credentials</Text>
                </Pressable>
              </View>

              {/* Today's Queue Section */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeading}>Today's Patient Queue</Text>
                  <Text style={styles.sectionSub}>Live queue ordered by visit stage</Text>
                </View>
                <Pressable
                  onPress={() => router.push("/doctor/appointments")}
                  style={styles.seeAllBtn}
                >
                  <Text style={styles.seeAllText}>View Roster</Text>
                  <Ionicons name="chevron-forward" size={14} color={Palette.accent} />
                </Pressable>
              </View>

              {queueList.length === 0 ? (
                <Card style={styles.emptyQueueCard}>
                  <Ionicons name="people-outline" size={32} color={Palette.textMuted} />
                  <Text style={styles.emptyQueueTitle}>No Patients in Queue Today</Text>
                  <Text style={styles.emptyQueueSub}>
                    Scheduled OPD patients will appear here with token numbers and check-in status.
                  </Text>
                </Card>
              ) : (
                queueList.map((item) => {
                  const stageInfo = getStageBadge(item.queueStage);
                  const isCur = item.queueStage === "in_consultation";
                  const isDone = item.queueStage === "completed";

                  return (
                    <Card key={item._id} style={[styles.queueItemCard, isCur && styles.queueItemActive]}>
                      <View style={styles.queueItemTop}>
                        <View style={styles.queueTokenBadge}>
                          <Text style={styles.queueTokenText}>#{item.queueToken || "-"}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <View style={styles.queueNameRow}>
                            <Text style={styles.queuePatientName} numberOfLines={1}>
                              {item.patientName || "Patient"}
                            </Text>
                            {item.isFamilyBooking && (
                              <Badge label={item.familyRelationship || "Family"} variant="primary" />
                            )}
                          </View>
                          <Text style={styles.queueTimeText}>
                            Slot: {item.slotTime || "General OPD"} ·{" "}
                            {item.consultationType === "video" ? "📹 Video" : "🏥 In-Clinic"}
                          </Text>
                        </View>
                        <Badge label={stageInfo.label} variant={stageInfo.variant} />
                      </View>

                      {/* Queue Actions */}
                      <View style={styles.queueActionsRow}>
                        {!isDone && (
                          <Pressable
                            onPress={() => handleQueueAction(item._id, "call")}
                            style={styles.queueCallBtn}
                          >
                            <Ionicons name="megaphone-outline" size={13} color={Palette.accent} />
                            <Text style={styles.queueCallBtnText}>Call</Text>
                          </Pressable>
                        )}

                        <Pressable
                          onPress={() => router.push(`/doctor/workspace/${item._id}`)}
                          style={[styles.queueWorkspaceBtn, isCur && styles.queueWorkspaceBtnActive]}
                        >
                          <Ionicons
                            name="medkit"
                            size={14}
                            color={isCur ? "#fff" : Palette.accent}
                          />
                          <Text
                            style={[
                              styles.queueWorkspaceBtnText,
                              isCur && styles.queueWorkspaceBtnTextActive,
                            ]}
                          >
                            {isDone
                              ? "View Chart"
                              : isCur
                                ? "In Workspace"
                                : "Start Consultation"}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  welcomeGreeting: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  doctorNameText: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.text,
  },
  hospitalAffiliation: {
    fontSize: 11,
    color: Palette.accent,
    fontWeight: "600",
    marginTop: 2,
  },
  profileBadgeBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.md,
  },
  pulseBanner: {
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  pulseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  pulseLiveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.error,
  },
  pulseLiveText: {
    fontSize: 11,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: 0.5,
  },
  pulseDateText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  pulseStatsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulseStatBox: {
    alignItems: "center",
    flex: 1,
  },
  pulseStatNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: Palette.text,
  },
  pulseStatLabel: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  activeConsultationCard: {
    backgroundColor: "#FEF2F2",
    borderColor: Palette.error,
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  activeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  activeIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Palette.error,
    alignItems: "center",
    justifyContent: "center",
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.error,
    letterSpacing: 0.5,
  },
  activePatientName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  activePatientMeta: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  resumeWorkspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.error,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    gap: 6,
  },
  resumeWorkspaceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  quickShortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  shortcutCard: {
    width: "48%",
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "flex-start",
  },
  shortcutIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  shortcutSub: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  sectionSub: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.accent,
  },
  emptyQueueCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  emptyQueueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.sm,
  },
  emptyQueueSub: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  queueItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  queueItemActive: {
    borderColor: Palette.warning,
    borderWidth: 1.5,
  },
  queueItemTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  queueTokenBadge: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  queueTokenText: {
    fontSize: 12,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  queueNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  queueTimeText: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  queueActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  queueCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Palette.accent,
    gap: 4,
  },
  queueCallBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.accent,
  },
  queueWorkspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.xs,
    backgroundColor: Palette.primaryLight,
    gap: 4,
  },
  queueWorkspaceBtnActive: {
    backgroundColor: Palette.warning,
  },
  queueWorkspaceBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.accent,
  },
  queueWorkspaceBtnTextActive: {
    color: "#fff",
  },
});