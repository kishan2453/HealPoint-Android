/**
 * HealPoint - Consultation History.
 *
 * Professional consultation timeline presenting all patient medical visits and
 * video consultations. Shows attending doctor, hospital, department, diagnosis,
 * clinical notes, prescription availability, reports, and follow-up advice.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type { Appointment } from "@/types";

type ConsultationFilter = "all" | "completed" | "upcoming" | "cancelled";

export default function ConsultationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  const [consultations, setConsultations] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ConsultationFilter>("all");

  const loadConsultations = async () => {
    setError("");
    try {
      const history = await appointmentService.getPatientMedicalHistory();
      setConsultations(history.consultations || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load consultation history."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useScreenFocus(loadConsultations);

  useEffect(() => {
    loadConsultations();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConsultations();
  };

  const filteredItems = useMemo(() => {
    if (filter === "all") return consultations;
    if (filter === "completed") {
      return consultations.filter((c) => c.status === "completed");
    }
    if (filter === "upcoming") {
      return consultations.filter((c) =>
        ["pending", "confirmed", "rescheduled"].includes(c.status),
      );
    }
    if (filter === "cancelled") {
      return consultations.filter((c) =>
        ["cancel", "missed"].includes(c.status),
      );
    }
    return consultations;
  }, [consultations, filter]);

  const getStatusBadge = (
    status: string,
  ): { label: string; variant: BadgeVariant } => {
    switch (status) {
      case "completed":
        return { label: "Completed", variant: "primary" };
      case "confirmed":
        return { label: "Confirmed", variant: "success" };
      case "pending":
        return { label: "Pending", variant: "warning" };
      case "cancel":
        return { label: "Cancelled", variant: "error" };
      case "rescheduled":
        return { label: "Rescheduled", variant: "neutral" };
      default:
        return { label: status, variant: "neutral" };
    }
  };

  const handleOpenDetail = (item: Appointment) => {
    if (item.consultationType === "video") {
      router.push({
        pathname: "/consultation/[id]",
        params: { id: item._id },
      });
    } else {
      router.push({
        pathname: "/appointment/[id]",
        params: { id: item._id },
      });
    }
  };

  const renderConsultationCard = ({ item }: { item: Appointment }) => {
    const doctor =
      typeof item.doctorId === "object" && item.doctorId ? item.doctorId : null;
    const doctorName = formatDoctorName(
      doctor?.name || item.doctorName,
      "Doctor",
    );
    const doctorSpecialty =
      doctor?.speciality ||
      doctor?.department ||
      item.doctorSpecialty ||
      "Specialist";
    const hospitalName =
      typeof item.hospitalId === "object" && item.hospitalId?.name
        ? item.hospitalId.name
        : item.hospitalName || "HealPoint Clinic";

    const badge = getStatusBadge(item.status);
    const hasPrescription = Boolean(
      (item.medicines && item.medicines.length > 0) || item.prescription,
    );
    const reportsCount = Array.isArray(item.medicalReports)
      ? item.medicalReports.length
      : 0;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Consultation with ${doctorName}`}
        onPress={() => handleOpenDetail(item)}
        style={({ pressed }) => [
          styles.cardWrapper,
          pressed && styles.cardPressed,
        ]}
      >
        <Card style={styles.card}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <Image
              source={{ uri: doctor?.image || undefined }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.headerInfo}>
              <Text style={styles.doctorName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Text style={styles.specialty} numberOfLines={1}>
                {doctorSpecialty}
              </Text>
              <Text style={styles.hospital} numberOfLines={1}>
                <Ionicons name="business" size={12} color={Palette.textMuted} />{" "}
                {hospitalName}
              </Text>
            </View>
            <Badge label={badge.label} variant={badge.variant} />
          </View>

          <View style={styles.divider} />

          {/* Date and Type Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.metaText}>
                {formatDDMMYYYY(item.slotDate || item.date || "")}
              </Text>
            </View>
            {item.slotTime ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={Palette.primary}
                />
                <Text style={styles.metaText}>{item.slotTime}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons
                name={
                  item.consultationType === "video" ? "videocam" : "business"
                }
                size={14}
                color={Palette.primaryDark}
              />
              <Text style={styles.typeBadgeText}>
                {item.consultationType === "video"
                  ? "Video Consultation"
                  : "In-Clinic Visit"}
              </Text>
            </View>
          </View>

          {/* Clinical Diagnosis if present */}
          {item.diagnosis ? (
            <View style={styles.diagnosisBox}>
              <Text style={styles.sectionHeading}>DIAGNOSIS</Text>
              <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
            </View>
          ) : null}

          {/* Physician Notes if present */}
          {item.medicalNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.sectionHeading}>CLINICAL SUMMARY</Text>
              <Text style={styles.notesText} numberOfLines={2}>
                {item.medicalNotes}
              </Text>
            </View>
          ) : null}

          {/* Clinical Attachment Indicators */}
          <View style={styles.chipsRow}>
            {item.consultationType === "video" &&
            ["pending", "confirmed", "rescheduled"].includes(item.status) ? (
              <View
                style={[
                  styles.indicatorChip,
                  { backgroundColor: "rgba(14, 159, 142, 0.12)" },
                ]}
              >
                <Ionicons name="videocam" size={13} color={Palette.primary} />
                <Text
                  style={[
                    styles.indicatorChipText,
                    { color: Palette.primaryDark, fontWeight: "700" },
                  ]}
                >
                  {item.meetingUrl
                    ? "Meeting Ready • Tap to Join"
                    : "Waiting Room Ready"}
                </Text>
              </View>
            ) : null}

            {hasPrescription ? (
              <View style={styles.indicatorChip}>
                <Ionicons name="medkit" size={13} color={Palette.primary} />
                <Text style={styles.indicatorChipText}>Prescription Ready</Text>
              </View>
            ) : null}

            {reportsCount > 0 ? (
              <View style={styles.indicatorChip}>
                <Ionicons name="document-attach" size={13} color="#4F46E5" />
                <Text style={styles.indicatorChipText}>
                  {reportsCount} Report{reportsCount === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}

            {item.followUpAdvice ? (
              <View style={styles.indicatorChip}>
                <Ionicons name="alarm-outline" size={13} color="#059669" />
                <Text style={styles.indicatorChipText}>Follow-up Advised</Text>
              </View>
            ) : null}
          </View>

          {/* Chevron footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.viewDetailsLabel}>
              {item.consultationType === "video" &&
              ["pending", "confirmed", "rescheduled"].includes(item.status)
                ? "Enter Video Consultation Room"
                : "View Consultation File"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Palette.primary}
            />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton color={Palette.text} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Consultation History</Text>
            <Text style={styles.subtitle}>
              Past & Upcoming Medical Appointments
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh consultations"
            onPress={onRefresh}
            style={styles.headerActionBtn}
          >
            <Ionicons name="refresh" size={18} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {[
            { key: "all", label: "All Visits" },
            { key: "completed", label: "Completed" },
            { key: "upcoming", label: "Upcoming" },
            { key: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key as ConsultationFilter)}
              style={[
                styles.filterChip,
                filter === tab.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === tab.key && styles.filterTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && !refreshing ? (
        <Loading fullScreen label="Loading consultation records..." />
      ) : error ? (
        <ErrorState
          title="Could Not Load Consultations"
          message={error}
          onRetry={loadConsultations}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item._id}
          renderItem={renderConsultationCard}
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
              title="No Consultations Found"
              message={
                filter !== "all"
                  ? `You have no ${filter} consultations.`
                  : "You have not booked or completed any doctor consultations yet."
              }
              action={
                <Button
                  title="Book a Doctor"
                  onPress={() => router.push("/doctors")}
                />
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
    fontWeight: "800",
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  filterTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
  },
  cardWrapper: {
    borderRadius: Radius.lg,
  },
  cardPressed: {
    opacity: 0.92,
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.border,
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  specialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  typeBadgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  diagnosisBox: {
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  notesBox: {
    backgroundColor: "rgba(14, 159, 142, 0.04)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  sectionHeading: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  diagnosisText: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  notesText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 2,
  },
  indicatorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  indicatorChipText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.text,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    marginTop: Spacing.xs,
  },
  viewDetailsLabel: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
});
