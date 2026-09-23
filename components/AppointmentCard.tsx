/**
 * HealPoint - appointment card showing real appointment data with
 * Smart Appointment Intelligence & Live Appointment Status.
 *
 * Booking status, relative timing, check-in availability, and a single
 * deterministic next-action CTA are unified cleanly.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { deriveAppointmentIntelligence } from "@/lib/appointment-intelligence";
import { SmartCareJourney } from "@/components/SmartCareJourney";
import type { Appointment, AppointmentStatus } from "@/types";

const STATUS_BADGE: Record<
  AppointmentStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed: { label: "Completed", variant: "primary" },
  cancel: { label: "Cancelled", variant: "error" },
  rescheduled: { label: "Rescheduled", variant: "neutral" },
  missed: { label: "Missed", variant: "error" },
};

function doctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === "object" && "name" in doctor)
    return formatDoctorName(doctor.name);
  if (appointment.doctorName) return formatDoctorName(appointment.doctorName);
  return "Doctor";
}

function doctorSpecialty(appointment: Appointment): string | null {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === "object") {
    return (
      (doctor as { speciality?: string }).speciality ||
      (doctor as { department?: string }).department ||
      null
    );
  }
  return null;
}

function extractDoctorId(appointment: Appointment): string | null {
  const doctor = appointment.doctorId;
  if (!doctor) return null;
  if (typeof doctor === "string") return doctor;
  if (typeof doctor === "object" && "_id" in doctor && doctor._id)
    return String(doctor._id);
  return null;
}

function hospitalName(appointment: Appointment): string | null {
  if (appointment.hospitalName) return appointment.hospitalName;
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === "object" && "hospitalName" in doctor) {
    return (doctor as { hospitalName?: string }).hospitalName || null;
  }
  return null;
}

function consultationAppointment(
  appointment: Appointment,
): { label: string; icon: keyof typeof Ionicons.glyphMap } | null {
  switch (appointment.consultationType) {
    case "video":
      return { label: "Video consultation", icon: "videocam-outline" };
    case "clinic":
      return { label: "Clinic visit", icon: "business-outline" };
    default:
      return null;
  }
}

interface AppointmentCardProps {
  appointment: Appointment;
  onReviewPress?: (appointment: Appointment) => void;
}

function AppointmentCardRaw({
  appointment,
  onReviewPress,
}: AppointmentCardProps) {
  const router = useRouter();
  const intelligence = deriveAppointmentIntelligence(appointment);

  const status = (appointment.status || "pending") as AppointmentStatus;
  const consultation = consultationAppointment(appointment);
  const hospital = hospitalName(appointment);
  const specialty = doctorSpecialty(appointment);
  const amount = Number(appointment.amount || 0);
  const doctorId = extractDoctorId(appointment);

  const open = () =>
    router.push({
      pathname: "/appointment/[id]",
      params: { id: appointment._id },
    });

  const openPayment = () =>
    router.push({
      pathname: "/payment/[appointmentId]",
      params: { appointmentId: appointment._id },
    });

  const handleNextActionPress = () => {
    const act = intelligence.nextAction;
    switch (act.key) {
      case "PAY_NOW":
        openPayment();
        break;
      case "CHECK_IN_NOW":
      case "VIEW_PASS":
        router.push({
          pathname: "/appointment/pass/[id]",
          params: { id: appointment._id },
        });
        break;
      case "JOIN_CONSULTATION":
      case "WAITING_ROOM":
        router.push({
          pathname: "/consultation/[id]",
          params: { id: appointment._id },
        });
        break;
      case "VIEW_PRESCRIPTION":
        router.push("/health/prescriptions");
        break;
      case "VIEW_REPORT":
        router.push("/health/reports");
        break;
      case "BOOK_FOLLOWUP":
        if (doctorId) {
          router.push({
            pathname: "/booking/[doctorId]",
            params: { doctorId },
          });
        } else {
          router.push("/doctors");
        }
        break;
      case "VIEW_QUEUE":
      case "WAITING_DOCTOR":
      case "IN_CONSULTATION":
      case "VIEW_DETAILS":
      default:
        open();
        break;
    }
  };

  const isCompleted = status === "completed";
  const isCancelled = status === "cancel" || status === "missed";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${doctorName(appointment)}, ${intelligence.timeContext.relativeLabel}. ${intelligence.currentStatus.label}. ${intelligence.paymentStatus.label}.`}
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* ---- Doctor + hospital + booking status ---- */}
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={
              appointment.consultationType === "video" ? "videocam" : "calendar"
            }
            size={22}
            color={Palette.primary}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.doctor} numberOfLines={1}>
            {doctorName(appointment)}
          </Text>
          {specialty ? (
            <Text style={styles.specialty} numberOfLines={1}>
              {specialty}
            </Text>
          ) : null}
          {hospital ? (
            <Text style={styles.hospital} numberOfLines={1}>
              {hospital}
            </Text>
          ) : null}
        </View>
        <Badge
          label={intelligence.currentStatus.label}
          variant={intelligence.currentStatus.variant}
        />
      </View>

      {/* ---- Relative Date / time + appointment timing pill ---- */}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={15} color={Palette.primary} />
        <Text style={styles.dateText}>
          {intelligence.timeContext.relativeLabel}
        </Text>
        {intelligence.timeContext.isToday ? (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>TODAY</Text>
          </View>
        ) : null}
      </View>

      {/* ---- Tags & Live Indicators (Mode, Check-In, Queue) ---- */}
      <View style={styles.tagsRow}>
        {consultation ? (
          <View style={styles.typeRow}>
            <Ionicons
              name={consultation.icon}
              size={13}
              color={Palette.primaryDark}
            />
            <Text style={styles.typeText}>{consultation.label}</Text>
          </View>
        ) : null}

        {appointment.patientName &&
        (appointment.familyMemberId ||
          (appointment.familyRelationship &&
            appointment.familyRelationship !== "Self")) ? (
          <View style={styles.patientBadge}>
            <Ionicons name="people" size={11} color={Palette.primary} />
            <Text style={styles.patientBadgeText} numberOfLines={1}>
              {appointment.patientName} (
              {appointment.familyRelationship || "Family"})
            </Text>
          </View>
        ) : null}

        {!isCompleted && !isCancelled ? (
          <View
            style={[
              styles.statusPill,
              intelligence.checkInStatus.isCheckedIn &&
                styles.statusPillSuccess,
              intelligence.checkInStatus.isAvailable && styles.statusPillActive,
            ]}
          >
            <Ionicons
              name={
                intelligence.checkInStatus.isCheckedIn
                  ? "checkmark-circle"
                  : intelligence.checkInStatus.isAvailable
                    ? "qr-code"
                    : "information-circle-outline"
              }
              size={12}
              color={
                intelligence.checkInStatus.isCheckedIn
                  ? "#059669"
                  : intelligence.checkInStatus.isAvailable
                    ? Palette.primaryDark
                    : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.statusPillText,
                intelligence.checkInStatus.isCheckedIn &&
                  styles.statusPillTextSuccess,
                intelligence.checkInStatus.isAvailable &&
                  styles.statusPillTextActive,
              ]}
            >
              {intelligence.checkInStatus.badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Smart Care Journey Compact Progress */}
      <SmartCareJourney appointment={appointment} compact />

      <View style={styles.divider} />

      {/* ---- Fee + separate payment chip ---- */}
      <View style={styles.paymentRow}>
        {amount > 0 ? (
          <View style={styles.feeBlock}>
            <Text style={styles.fee}>{formatINR(amount)}</Text>
            <Text style={styles.feeCaption}>Consultation fee</Text>
          </View>
        ) : (
          <View style={styles.feeBlock}>
            <Text style={styles.fee}>Free</Text>
            <Text style={styles.feeCaption}>No consultation fee</Text>
          </View>
        )}
        <Badge
          label={intelligence.paymentStatus.label}
          variant={intelligence.paymentStatus.variant}
        />
      </View>

      {/* ---- Primary Smart Next Action CTA ---- */}
      <View style={styles.nextActionWrap}>
        <Button
          title={intelligence.nextAction.label}
          variant={intelligence.nextAction.variant}
          icon={intelligence.nextAction.icon}
          style={styles.nextActionButton}
          onPress={handleNextActionPress}
        />
      </View>

      {/* ---- Secondary Actions for Completed consultations ---- */}
      {isCompleted ? (
        <View style={styles.completedActionRow}>
          {appointment.isReviewed ? (
            <View
              style={[
                styles.reviewedBadge,
                doctorId ? styles.completedBtn : null,
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={15}
                color={Palette.primaryDark}
              />
              <Text style={styles.reviewedBadgeText}>Reviewed ★</Text>
            </View>
          ) : (
            <Button
              title="Rate Visit"
              variant="outline"
              icon="star-outline"
              style={styles.completedBtn}
              onPress={() => {
                if (onReviewPress) {
                  onReviewPress(appointment);
                } else {
                  open();
                }
              }}
            />
          )}
          {doctorId ? (
            <Button
              title="Book Again"
              variant="secondary"
              icon="calendar-outline"
              style={styles.completedBtn}
              onPress={() =>
                router.push({
                  pathname: "/booking/[doctorId]",
                  params: { doctorId },
                })
              }
            />
          ) : null}
        </View>
      ) : null}

      {/* ---- Secondary Shortcuts for Active visits ---- */}
      {!isCompleted &&
      !isCancelled &&
      intelligence.nextAction.key !== "VIEW_DETAILS" ? (
        <View style={styles.secondaryShortcutsRow}>
          <Pressable
            hitSlop={6}
            onPress={open}
            style={({ pressed }) => [
              styles.secondaryLink,
              pressed && styles.linkPressed,
            ]}
          >
            <Text style={styles.secondaryLinkText}>Full Details</Text>
            <Ionicons
              name="chevron-forward"
              size={13}
              color={Palette.primaryDark}
            />
          </Pressable>

          {appointment.consultationType !== "video" && (
            <Pressable
              hitSlop={6}
              onPress={() =>
                router.push({
                  pathname: "/appointment/pass/[id]",
                  params: { id: appointment._id },
                })
              }
              style={({ pressed }) => [
                styles.secondaryLink,
                pressed && styles.linkPressed,
              ]}
            >
              <Ionicons
                name="card-outline"
                size={13}
                color={Palette.primaryDark}
              />
              <Text style={styles.secondaryLinkText}>Hospital Pass</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

export const AppointmentCard = React.memo(AppointmentCardRaw);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  doctor: {
    ...Typography.label,
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
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xs,
  },
  dateText: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  todayPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayPillText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
    letterSpacing: 0.5,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  typeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  patientBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${Palette.primary}15`,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${Palette.primary}30`,
  },
  patientBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.primary,
    fontWeight: "600",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surfaceAlt || "#F8FAFC",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  statusPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  statusPillSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusPillText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  statusPillTextActive: {
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  statusPillTextSuccess: {
    color: "#047857",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.xs,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  feeBlock: {
    gap: 2,
    flexShrink: 1,
  },
  fee: {
    ...Typography.h4,
    color: Palette.text,
  },
  feeCaption: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  nextActionWrap: {
    marginTop: Spacing.xs,
  },
  nextActionButton: {
    width: "100%",
    minHeight: 44,
  },
  completedActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  completedBtn: {
    flex: 1,
    minHeight: 42,
  },
  reviewedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.20)",
  },
  reviewedBadgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  secondaryShortcutsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.xs,
  },
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  linkPressed: {
    opacity: 0.6,
  },
  secondaryLinkText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
});
