/**
 * HealPoint - Doctor appointments module (doctor app).
 * HealPoint - Doctor Appointments Cockpit & Clinical Roster.
 *
 * Dedicated professional appointment management center for doctors.
 * Filter by Today's Clinic, Upcoming, Pending, and Completed visits.
 * Direct launch into Doctor Clinical Workspace 2.0.
 *
 * Sourced from GET /doctor/panel/:doctorId/appointments with authentic live data.
 */
import React from 'react';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RoleGuard } from '@/components/RoleGuard';
import { ModuleScreen } from '@/components/ui/ModuleScreen';
import { RoleGuard } from "@/components/RoleGuard";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { formatINR } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as doctorPortalService from "@/services/doctor-portal";
import type { Appointment } from "@/types";

type ViewTab = "today" | "upcoming" | "pending" | "completed" | "all";
type ModeFilter = "all" | "clinic" | "video";

export default function DoctorAppointmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const doctorId = user?._id || "";

  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [activeMode, setActiveMode] = useState<ModeFilter>("all");
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    today: 0,
    upcoming: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAppointments = useCallback(
    async (isRefresh = false) => {
      if (!doctorId) {
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        const res = await doctorPortalService.getDoctorAppointmentsList(doctorId, {
          view: activeTab,
          search: search.trim() || undefined,
          consultationType: activeMode === "all" ? undefined : activeMode,
          limit: 50,
        });

        if (res?.success) {
          setAppointments(res.appointments || []);
          if (res.counts) {
            setCounts(res.counts);
          }
        } else {
          setError("Failed to load appointments roster.");
        }
      } catch (err) {
        setError(toErrorMessage(err, "Error fetching appointment list."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [doctorId, activeTab, activeMode, search],
  );

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const getStatusBadge = (appt: Appointment): { label: string; variant: BadgeVariant } => {
    if (appt.status === "completed" || appt.consultationStatus === "completed") {
      return { label: "Completed", variant: "success" };
    }
    if (appt.consultationStatus === "in_progress") {
      return { label: "In Consultation", variant: "warning" };
    }
    if (appt.status === "confirmed") {
      return { label: "Confirmed", variant: "primary" };
    }
    if (appt.status === "pending") {
      return { label: "Pending", variant: "warning" };
    }
    if (appt.status === "cancel") {
      return { label: "Cancelled", variant: "error" };
    }
    return { label: appt.status || "Scheduled", variant: "neutral" };
  };

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    const statusBadge = getStatusBadge(item);
    const patientDisplayName = item.patientName || "Patient";
    const slotDate = item.slotDate || item.date || "Scheduled";
    const slotTime = item.slotTime || item.time || "";
    const isCompleted = item.status === "completed" || item.consultationStatus === "completed";
    const isInProgress = item.consultationStatus === "in_progress";

    return (
      <Card style={styles.appointmentCard}>
        {/* Top Header Row */}
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.patientNameRow}>
              <Text style={styles.patientNameText} numberOfLines={1}>
                {patientDisplayName}
              </Text>
              {item.isFamilyBooking && (
                <Badge label={item.familyRelationship || "Family"} variant="primary" />
              )}
            </View>
            <Text style={styles.patientSubText}>
              {item.patientPhone ? `Phone: ${item.patientPhone} · ` : ""}
              ID: {item.displayAppointmentId || item.appointmentId || item._id.slice(-6).toUpperCase()}
            </Text>
          </View>
          <Badge label={statusBadge.label} variant={statusBadge.variant} />
        </View>

        {/* Schedule & Queue Detail */}
        <View style={styles.scheduleRow}>
          <View style={styles.scheduleItem}>
            <Ionicons name="calendar-outline" size={14} color={Palette.accent} />
            <Text style={styles.scheduleItemText}>{slotDate}</Text>
          </View>
          <View style={styles.scheduleItem}>
            <Ionicons name="time-outline" size={14} color={Palette.accent} />
            <Text style={styles.scheduleItemText}>{slotTime}</Text>
          </View>
          <View style={styles.scheduleItem}>
            <Ionicons
              name={item.consultationType === "video" ? "videocam-outline" : "business-outline"}
              size={14}
              color={Palette.accent}
            />
            <Text style={styles.scheduleItemText}>
              {item.consultationType === "video" ? "Online Meet" : "OPD Visit"}
            </Text>
          </View>
        </View>

        {/* Queue Token & Payment indicator */}
        <View style={styles.metaRow}>
          {item.queueToken ? (
            <View style={styles.tokenPill}>
              <Text style={styles.tokenPillLabel}>Token #{item.queueToken}</Text>
            </View>
          ) : null}

          {item.checkedIn && (
            <View style={styles.checkedInPill}>
              <Ionicons name="checkmark-circle" size={12} color={Palette.success} />
              <Text style={styles.checkedInPillText}>Checked-In at Clinic</Text>
            </View>
          )}

          <Text style={styles.paymentText}>
            {item.payment ? "Paid Online" : item.paymentMethod === "cash" ? "Cash at OPD" : "Unpaid"}
            {item.amount ? ` · ${formatINR(item.amount)}` : ""}
          </Text>
        </View>

        {/* Action Button: Open Clinical Workspace */}
        <View style={styles.cardActionsRow}>
          <Pressable
            onPress={() => router.push(`/doctor/workspace/${item._id}`)}
            style={[
              styles.workspaceBtn,
              isInProgress && styles.workspaceBtnInProgress,
              isCompleted && styles.workspaceBtnCompleted,
            ]}
          >
            <Ionicons
              name={isCompleted ? "eye-outline" : isInProgress ? "pulse" : "medkit-outline"}
              size={16}
              color={isCompleted ? Palette.text : "#fff"}
            />
            <Text
              style={[
                styles.workspaceBtnText,
                isCompleted && styles.workspaceBtnTextCompleted,
              ]}
            >
              {isCompleted
                ? "View Clinical Chart & Rx"
                : isInProgress
                  ? "Resume Active Consultation"
                  : "Open Clinical Workspace"}
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <RoleGuard allowedRoles={["doctor"]}>
      <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.screenHeader}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Appointments & Consultations</Text>
            <Text style={styles.screenSubtitle}>
              {user?.hospitalName ? `${user.hospitalName} · ` : ""}Clinical Workstation
            </Text>
          </View>
          <Pressable onPress={() => loadAppointments(true)} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={Palette.accent} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={16} color={Palette.textMuted} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by patient name, phone, or appointment ID..."
            placeholderTextColor={Palette.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => loadAppointments()}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} style={styles.searchClearBtn}>
              <Ionicons name="close-circle" size={16} color={Palette.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* View Tabs */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => setActiveTab("today")}
            style={[styles.tabItem, activeTab === "today" && styles.tabItemActive]}
          >
            <Text style={[styles.tabItemText, activeTab === "today" && styles.tabItemTextActive]}>
              Today's Clinic ({counts.today || 0})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("upcoming")}
            style={[styles.tabItem, activeTab === "upcoming" && styles.tabItemActive]}
          >
            <Text style={[styles.tabItemText, activeTab === "upcoming" && styles.tabItemTextActive]}>
              Upcoming ({counts.upcoming || 0})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("pending")}
            style={[styles.tabItem, activeTab === "pending" && styles.tabItemActive]}
          >
            <Text style={[styles.tabItemText, activeTab === "pending" && styles.tabItemTextActive]}>
              Pending ({counts.pending || 0})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("completed")}
            style={[styles.tabItem, activeTab === "completed" && styles.tabItemActive]}
          >
            <Text style={[styles.tabItemText, activeTab === "completed" && styles.tabItemTextActive]}>
              Completed ({counts.completed || 0})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("all")}
            style={[styles.tabItem, activeTab === "all" && styles.tabItemActive]}
          >
            <Text style={[styles.tabItemText, activeTab === "all" && styles.tabItemTextActive]}>
              All ({counts.all || 0})
            </Text>
          </Pressable>
        </View>

        {/* Mode Filter Pills */}
        <View style={styles.modeFilterRow}>
          <Pressable
            onPress={() => setActiveMode("all")}
            style={[styles.modePill, activeMode === "all" && styles.modePillActive]}
          >
            <Text style={[styles.modePillText, activeMode === "all" && styles.modePillTextActive]}>
              All Modes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveMode("clinic")}
            style={[styles.modePill, activeMode === "clinic" && styles.modePillActive]}
          >
            <Text style={[styles.modePillText, activeMode === "clinic" && styles.modePillTextActive]}>
              🏥 In-Clinic OPD
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveMode("video")}
            style={[styles.modePill, activeMode === "video" && styles.modePillActive]}
          >
            <Text style={[styles.modePillText, activeMode === "video" && styles.modePillTextActive]}>
              📹 Video Meet
            </Text>
          </Pressable>
        </View>

        {/* Content List */}
        {loading && !refreshing ? (
          <Loading label="Loading appointment roster..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadAppointments()} />
        ) : appointments.length === 0 ? (
          <EmptyState
            title="No Appointments Found"
            message={
              activeTab === "today"
                ? "No clinic appointments scheduled for today yet."
                : "No appointments match your active filter criteria."
            }
          />
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item._id}
            renderItem={renderAppointmentItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadAppointments(true)}
                tintColor={Palette.accent}
              />
            }
          />
        )}
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  screenSubtitle: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    padding: Spacing.xs,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.xs,
    fontSize: 13,
    color: Palette.text,
  },
  searchClearBtn: {
    padding: Spacing.xs,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Palette.accent,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabItemTextActive: {
    color: Palette.accent,
    fontWeight: "700",
  },
  modeFilterRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  modePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modePillActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.accent,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  modePillTextActive: {
    color: Palette.accent,
    fontWeight: "700",
  },
  listContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  appointmentCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  patientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  patientNameText: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  patientSubText: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: 4,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scheduleItemText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  tokenPill: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  tokenPillLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  checkedInPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E2F5E9",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  checkedInPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1F7A44",
  },
  paymentText: {
    fontSize: 11,
    color: Palette.textMuted,
    marginLeft: "auto",
  },
  cardActionsRow: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  workspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.accent,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    gap: 6,
  },
  workspaceBtnInProgress: {
    backgroundColor: Palette.warning,
  },
  workspaceBtnCompleted: {
    backgroundColor: Palette.border,
  },
  workspaceBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  workspaceBtnTextCompleted: {
    color: Palette.text,
  },
});
