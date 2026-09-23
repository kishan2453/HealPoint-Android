/**
 * HealPoint — Smart Care Journey / Appointment Lifecycle (Production Component)
 *
 * Real visual journey for every appointment deriving 100% of state from MongoDB.
 * Stages:
 *   1. Booked
 *   2. Payment Confirmed
 *   3. Doctor Accepted
 *   4. Hospital Check-In / Virtual Room Entry
 *   5. Consultation
 *   6. Prescription (where applicable)
 *   7. Report (where applicable)
 *   8. Follow-Up (where advised by doctor)
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDDMMYYYY, formatINR } from "@/lib/format";
import { parseRecommendedTimeframe } from "@/lib/followup-intelligence";
import type { Appointment, AppointmentDetails } from "@/types";

export type JourneyStepStatus = "completed" | "current" | "upcoming" | "failed";

export interface JourneyStep {
  id: string;
  title: string;
  status: JourneyStepStatus;
  timestamp?: string;
  description: string;
  actor?: string;
  badgeLabel?: string;
  action?: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    variant?: "primary" | "outline";
  };
}

export interface SmartCareJourneyProps {
  appointment: AppointmentDetails | Appointment;
  compact?: boolean;
  onPayPress?: () => void;
  onCheckInPress?: () => void;
  onJoinMeetPress?: () => void;
  onPrescriptionPress?: () => void;
  onReportsPress?: () => void;
  onFollowUpPress?: () => void;
}

function formatIsoDate(dateVal?: unknown): string | undefined {
  if (!dateVal) return undefined;
  if (
    typeof dateVal !== "string" &&
    typeof dateVal !== "number" &&
    !(dateVal instanceof Date)
  ) {
    return undefined;
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return undefined;
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
  } catch {
    return undefined;
  }
}

export function computeJourneySteps(
  appointment: AppointmentDetails | Appointment,
  callbacks?: {
    onPayPress?: () => void;
    onCheckInPress?: () => void;
    onJoinMeetPress?: () => void;
    onPrescriptionPress?: () => void;
    onReportsPress?: () => void;
    onFollowUpPress?: () => void;
  },
): JourneyStep[] {
  const steps: JourneyStep[] = [];

  const rawStatus =
    "bookingStatus" in appointment && appointment.bookingStatus
      ? appointment.bookingStatus
      : "status" in appointment && appointment.status
        ? appointment.status
        : "pending";
  const status = String(rawStatus).toLowerCase();

  const isCancelled = status === "cancel";
  const isCompleted = status === "completed";
  const isConfirmed = status === "confirmed";
  const isPending = status === "pending";
  const isRescheduled = status === "rescheduled";

  const rawPaymentStatus = String(appointment.paymentStatus || "")
    .trim()
    .toLowerCase();
  const isPaid =
    appointment.payment === true ||
    ["paid", "success", "succeeded", "captured"].includes(rawPaymentStatus);
  const isPaymentFailed = ["failed", "cancelled", "cancel"].includes(
    rawPaymentStatus,
  );
  const amount = Number(appointment.amount || 0);
  const isCash = appointment.paymentMethod === "cash";

  const isVideo = appointment.consultationType === "video";
  const isCheckedIn = Boolean(appointment.checkedIn);

  const slotDateStr =
    "bookingDate" in appointment && appointment.bookingDate
      ? appointment.bookingDate
      : "slotDate" in appointment && appointment.slotDate
        ? appointment.slotDate
        : "";
  const slotTimeStr =
    "bookingTime" in appointment && appointment.bookingTime
      ? appointment.bookingTime
      : "slotTime" in appointment && appointment.slotTime
        ? appointment.slotTime
        : "";

  // 1. STAGE: Booked
  const createdAtFormatted = formatIsoDate(appointment.createdAt);
  const patientDesc = appointment.patientName
    ? ` for ${appointment.patientName}${appointment.familyRelationship && appointment.familyRelationship !== "Self" ? ` (${appointment.familyRelationship})` : ""}`
    : "";
  steps.push({
    id: "booked",
    title: "Appointment Booked",
    status: "completed",
    timestamp: createdAtFormatted,
    description: `Booked${patientDesc} for ${formatDDMMYYYY(slotDateStr)}${slotTimeStr ? ` at ${slotTimeStr}` : ""}`,
    actor: appointment.patientName || "Patient",
    badgeLabel: "Confirmed",
  });

  // 2. STAGE: Payment Confirmed
  if (amount <= 0) {
    steps.push({
      id: "payment",
      title: "Payment Confirmed",
      status: "completed",
      description: "Complimentary consultation — No payment required",
      badgeLabel: "Free",
    });
  } else if (isCash) {
    if (isPaid) {
      steps.push({
        id: "payment",
        title: "Payment Received",
        status: "completed",
        timestamp: formatIsoDate(
          "paidAt" in appointment ? appointment.paidAt : undefined,
        ),
        description: `Cash payment of ${formatINR(amount)} received at hospital reception`,
        badgeLabel: "Paid",
      });
    } else {
      steps.push({
        id: "payment",
        title: "Pay at Clinic",
        status: isCancelled ? "failed" : isConfirmed ? "completed" : "current",
        description: `Pay ${formatINR(amount)} at hospital reception desk upon arrival`,
        badgeLabel: "At Clinic",
      });
    }
  } else {
    // Online Payment
    if (isPaid) {
      steps.push({
        id: "payment",
        title: "Payment Confirmed",
        status: "completed",
        timestamp: formatIsoDate(
          "paidAt" in appointment ? appointment.paidAt : undefined,
        ),
        description: `Online payment of ${formatINR(amount)} successfully verified`,
        badgeLabel: "Paid",
      });
    } else if (isPaymentFailed) {
      steps.push({
        id: "payment",
        title: "Payment Failed",
        status: isCancelled ? "failed" : "failed",
        description: `Online payment of ${formatINR(amount)} was not completed. Please retry.`,
        badgeLabel: "Failed",
        action:
          !isCancelled && callbacks?.onPayPress
            ? {
                label: "Retry Payment",
                icon: "card-outline",
                onPress: callbacks.onPayPress,
                variant: "primary",
              }
            : undefined,
      });
    } else {
      steps.push({
        id: "payment",
        title: "Payment Pending",
        status: isCancelled ? "failed" : "current",
        description: `Online payment of ${formatINR(amount)} is pending verification`,
        badgeLabel: "Pending",
        action:
          !isCancelled && callbacks?.onPayPress
            ? {
                label: "Pay Online Now",
                icon: "card-outline",
                onPress: callbacks.onPayPress,
                variant: "primary",
              }
            : undefined,
      });
    }
  }

  // 3. STAGE: Doctor Accepted / Cancellation / Rescheduled
  if (isCancelled) {
    // Find cancellation reason if recorded in statusHistory
    let cancelReason = "Appointment cancelled";
    if (appointment.statusHistory && Array.isArray(appointment.statusHistory)) {
      const cancelEntry = (
        appointment.statusHistory as Array<{
          status?: string;
          reason?: string;
        }>
      ).find((s) => s.status === "cancel");
      if (cancelEntry?.reason) {
        cancelReason = `Cancelled: ${cancelEntry.reason}`;
      }
    }
    steps.push({
      id: "doctor_acceptance",
      title: "Appointment Cancelled",
      status: "failed",
      description: cancelReason,
      badgeLabel: "Cancelled",
    });
    return steps;
  }

  if (isConfirmed || isCompleted) {
    steps.push({
      id: "doctor_acceptance",
      title: "Doctor Accepted",
      status: "completed",
      description: "Doctor confirmed the scheduled appointment",
      badgeLabel: "Accepted",
    });
  } else if (isRescheduled) {
    steps.push({
      id: "doctor_acceptance",
      title: "Appointment Rescheduled",
      status: "current",
      description: `Rescheduled to ${formatDDMMYYYY(slotDateStr)} at ${slotTimeStr}`,
      badgeLabel: "Rescheduled",
    });
  } else {
    // isPending
    steps.push({
      id: "doctor_acceptance",
      title: "Waiting for Doctor",
      status: "current",
      description: "Your appointment request is awaiting doctor confirmation",
      badgeLabel: "Pending",
    });
  }

  // 4. STAGE: Check-In (In-Person Clinic) or Virtual Room (Online Video)
  if (isVideo) {
    const consultationStatus = appointment.consultationStatus || "waiting";
    const isRoomReady =
      consultationStatus === "ready_to_join" ||
      consultationStatus === "doctor_ready" ||
      consultationStatus === "in_progress";
    const meetUrl = appointment.meetingUrl || "";

    if (isCompleted || consultationStatus === "completed") {
      steps.push({
        id: "check_in",
        title: "Video Room Entry",
        status: "completed",
        description: "Patient attended secure online video consultation",
        badgeLabel: "Attended",
      });
    } else if (isRoomReady && meetUrl) {
      steps.push({
        id: "check_in",
        title: "Video Consultation Ready",
        status: "current",
        description: "The doctor is ready in the consultation room. Join now.",
        badgeLabel: "Room Ready",
        action: callbacks?.onJoinMeetPress
          ? {
              label: "Join Consultation",
              icon: "videocam",
              onPress: callbacks.onJoinMeetPress,
              variant: "primary",
            }
          : undefined,
      });
    } else {
      steps.push({
        id: "check_in",
        title: "Virtual Waiting Room",
        status: isConfirmed ? "current" : "upcoming",
        description:
          "Google Meet link opens automatically at your appointment time",
        badgeLabel: "Waiting",
      });
    }
  } else {
    // Clinic Visit Check-In
    if (isCheckedIn) {
      const checkInFormatted = formatIsoDate(appointment.checkInAt);
      const token = appointment.queueToken || "Assigned";
      const qStatus = (appointment.queueStatus || "waiting").replace("_", " ");
      steps.push({
        id: "check_in",
        title: "Hospital Check-In",
        status: "completed",
        timestamp: checkInFormatted,
        description: `Checked in at reception. Queue Token: #${token} (Queue: ${qStatus})`,
        badgeLabel: `Token #${token}`,
      });
    } else if (isConfirmed) {
      steps.push({
        id: "check_in",
        title: "Check-In Available",
        status: "current",
        description:
          "Show your QR Digital Pass at reception upon arrival at the hospital",
        badgeLabel: "Pass Ready",
        action: callbacks?.onCheckInPress
          ? {
              label: "Digital Hospital Pass",
              icon: "qr-code-outline",
              onPress: callbacks.onCheckInPress,
              variant: "primary",
            }
          : undefined,
      });
    } else {
      steps.push({
        id: "check_in",
        title: "Hospital Check-In",
        status: "upcoming",
        description:
          "Digital Pass becomes active once doctor accepts your booking",
        badgeLabel: "Upcoming",
      });
    }
  }

  // 5. STAGE: Consultation
  const consultationCompletedAtFormatted = formatIsoDate(
    "consultationCompletedAt" in appointment
      ? appointment.consultationCompletedAt
      : undefined,
  );
  if (isCompleted) {
    steps.push({
      id: "consultation",
      title: "Consultation Completed",
      status: "completed",
      timestamp: consultationCompletedAtFormatted,
      description: appointment.patientName
        ? `Clinical consultation for ${appointment.patientName} successfully completed with doctor`
        : "Clinical consultation successfully completed with doctor",
      badgeLabel: "Completed",
    });
  } else if (
    appointment.consultationStatus === "in_progress" ||
    appointment.queueStatus === "in_consultation"
  ) {
    steps.push({
      id: "consultation",
      title: "Consultation in Progress",
      status: "current",
      description: "Currently in active consultation with the doctor",
      badgeLabel: "In Progress",
    });
  } else if (isCheckedIn || (isVideo && isConfirmed)) {
    steps.push({
      id: "consultation",
      title: "Consultation Scheduled",
      status: "current",
      description: isVideo
        ? "Waiting for doctor to initiate video consultation"
        : `Waiting in clinical queue (Token: ${appointment.queueToken || "Assigned"})`,
      badgeLabel: "Up Next",
    });
  } else {
    steps.push({
      id: "consultation",
      title: "Consultation",
      status: "upcoming",
      description: "Doctor consultation begins following check-in verification",
      badgeLabel: "Upcoming",
    });
  }

  // 6. STAGE: Prescription (only show when completed or uploaded)
  const hasPrescription =
    Boolean(appointment.prescription && appointment.prescription.trim()) ||
    Boolean(appointment.medicines && appointment.medicines.length > 0);

  if (hasPrescription) {
    const medCount = appointment.medicines?.length || 0;
    steps.push({
      id: "prescription",
      title: "Prescription Available",
      status: "completed",
      description:
        medCount > 0
          ? `${medCount} medication(s) prescribed with dosage instructions`
          : "Doctor has recorded medical prescription and instructions",
      badgeLabel: "Prescribed",
      action: callbacks?.onPrescriptionPress
        ? {
            label: "View Prescription",
            icon: "document-text-outline",
            onPress: callbacks.onPrescriptionPress,
            variant: "outline",
          }
        : undefined,
    });
  } else if (isCompleted) {
    steps.push({
      id: "prescription",
      title: "Prescription",
      status: "upcoming",
      description: "Prescription not available yet.",
      badgeLabel: "None",
    });
  }

  // 7. STAGE: Diagnostic Medical Reports (only show if reports attached)
  const reportCount = appointment.medicalReports?.length || 0;
  if (reportCount > 0) {
    steps.push({
      id: "report",
      title: "Medical Reports",
      status: "completed",
      description: `${reportCount} diagnostic report(s) attached to this appointment`,
      badgeLabel: `${reportCount} Reports`,
      action: callbacks?.onReportsPress
        ? {
            label: "View Reports",
            icon: "folder-open-outline",
            onPress: callbacks.onReportsPress,
            variant: "outline",
          }
        : undefined,
    });
  }

  // 8. STAGE: Follow-Up & Care Plan (Only show if doctor specifically advised a follow-up)
  const prescriptionFollowUp = (
    appointment as {
      prescriptionInstructions?: { followUpInstructions?: string };
    }
  ).prescriptionInstructions?.followUpInstructions;

  const followUp = (
    appointment.followUpAdvice ||
    prescriptionFollowUp ||
    ""
  ).trim();

  if (followUp) {
    const slotDate =
      "slotDate" in appointment && appointment.slotDate
        ? appointment.slotDate
        : "date" in appointment && appointment.date
          ? appointment.date
          : "";
    const { timeframe, targetDate } = parseRecommendedTimeframe(
      followUp,
      slotDate,
    );
    const badge =
      timeframe && timeframe !== "As Advised" ? timeframe : "Recommended";
    const targetDesc = targetDate ? ` • Target: ~${targetDate}` : "";

    steps.push({
      id: "follow_up",
      title: "Follow-Up Care Plan",
      status: "completed",
      description: `${followUp}${targetDesc}`,
      badgeLabel: badge,
      action: callbacks?.onFollowUpPress
        ? {
            label: "Book Follow-Up",
            icon: "calendar-outline",
            onPress: callbacks.onFollowUpPress,
            variant: "primary",
          }
        : undefined,
    });
  }

  return steps;
}

export function SmartCareJourney({
  appointment,
  compact = false,
  onPayPress,
  onCheckInPress,
  onJoinMeetPress,
  onPrescriptionPress,
  onReportsPress,
  onFollowUpPress,
}: SmartCareJourneyProps) {
  const steps = computeJourneySteps(appointment, {
    onPayPress,
    onCheckInPress,
    onJoinMeetPress,
    onPrescriptionPress,
    onReportsPress,
    onFollowUpPress,
  });

  const currentStepIndex = steps.findIndex((s) => s.status === "current");
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const currentStep =
    currentStepIndex !== -1 ? steps[currentStepIndex] : steps[steps.length - 1];

  // Compact Mode (for Cards or small summary widgets)
  if (compact) {
    const isCancelled = steps.some((s) => s.status === "failed");
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeaderRow}>
          <View style={styles.compactIndicatorWrap}>
            <View
              style={[
                styles.compactPulseDot,
                isCancelled
                  ? styles.bgError
                  : currentStep?.status === "completed"
                    ? styles.bgSuccess
                    : styles.bgPrimary,
              ]}
            />
            <Text style={styles.compactStageTitle} numberOfLines={1}>
              {currentStep?.title || "Care Journey"}
            </Text>
          </View>
          <Text style={styles.compactProgressCount}>
            {completedCount}/{steps.length}
          </Text>
        </View>

        {/* Progress Track Bar */}
        <View style={styles.compactTrack}>
          <View
            style={[
              styles.compactFill,
              isCancelled ? styles.bgError : styles.bgPrimary,
              {
                width: `${Math.round((completedCount / steps.length) * 100)}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.compactDescription} numberOfLines={1}>
          {currentStep?.description}
        </Text>
      </View>
    );
  }

  // Full Vertical Timeline Mode (for Appointment Details)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.brandIconCircle}>
            <Ionicons
              name="git-commit-outline"
              size={20}
              color={Palette.primary}
            />
          </View>
          <View>
            <Text style={styles.title}>Smart Care Journey</Text>
            <Text style={styles.subtitle}>
              Live appointment progress & clinical milestones
            </Text>
          </View>
        </View>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>
            {completedCount} of {steps.length} Done
          </Text>
        </View>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isFailed = step.status === "failed";
          const isUpcoming = step.status === "upcoming";

          return (
            <View key={step.id} style={styles.stepRow}>
              {/* Left Column: Icons and connecting line */}
              <View style={styles.indicatorCol}>
                <View
                  style={[
                    styles.node,
                    isCompleted && styles.nodeCompleted,
                    isCurrent && styles.nodeCurrent,
                    isFailed && styles.nodeFailed,
                    isUpcoming && styles.nodeUpcoming,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : isFailed ? (
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  ) : isCurrent ? (
                    <View style={styles.innerDotCurrent} />
                  ) : (
                    <View style={styles.innerDotUpcoming} />
                  )}
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.connectorLine,
                      isCompleted
                        ? styles.connectorCompleted
                        : styles.connectorUpcoming,
                    ]}
                  />
                )}
              </View>

              {/* Right Column: Step Content */}
              <View
                style={[
                  styles.contentCard,
                  isCurrent && styles.contentCardCurrent,
                  isFailed && styles.contentCardFailed,
                ]}
              >
                <View style={styles.contentHeader}>
                  <Text
                    style={[
                      styles.stepTitle,
                      isCurrent && styles.stepTitleCurrent,
                      isFailed && styles.stepTitleFailed,
                    ]}
                  >
                    {step.title}
                  </Text>
                  {step.badgeLabel && (
                    <View
                      style={[
                        styles.stepBadge,
                        isCompleted && styles.badgeCompleted,
                        isCurrent && styles.badgeCurrent,
                        isFailed && styles.badgeFailed,
                        isUpcoming && styles.badgeUpcoming,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepBadgeText,
                          isCompleted && styles.badgeTextCompleted,
                          isCurrent && styles.badgeTextCurrent,
                          isFailed && styles.badgeTextFailed,
                          isUpcoming && styles.badgeTextUpcoming,
                        ]}
                      >
                        {step.badgeLabel}
                      </Text>
                    </View>
                  )}
                </View>

                {step.timestamp && (
                  <View style={styles.timeRow}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={Palette.textMuted}
                    />
                    <Text style={styles.timestampText}>{step.timestamp}</Text>
                  </View>
                )}

                <Text style={styles.descriptionText}>{step.description}</Text>

                {step.action && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={step.action.label}
                    onPress={step.action.onPress}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      step.action?.variant === "outline"
                        ? styles.actionBtnOutline
                        : styles.actionBtnPrimary,
                      pressed && styles.actionBtnPressed,
                    ]}
                  >
                    <Ionicons
                      name={step.action.icon}
                      size={16}
                      color={
                        step.action.variant === "outline"
                          ? Palette.primary
                          : "#FFFFFF"
                      }
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        step.action.variant === "outline"
                          ? styles.actionBtnTextOutline
                          : styles.actionBtnTextPrimary,
                      ]}
                    >
                      {step.action.label}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  brandIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  progressBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  progressBadgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  timeline: {
    paddingLeft: Spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  indicatorCol: {
    alignItems: "center",
    width: 28,
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  nodeCompleted: {
    backgroundColor: Palette.success,
  },
  nodeCurrent: {
    backgroundColor: Palette.surface,
    borderWidth: 2,
    borderColor: Palette.primary,
  },
  nodeFailed: {
    backgroundColor: Palette.error,
  },
  nodeUpcoming: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  innerDotCurrent: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
  },
  innerDotUpcoming: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.textMuted,
    opacity: 0.3,
  },
  connectorLine: {
    width: 2,
    minHeight: 46,
    flex: 1,
    marginVertical: 2,
  },
  connectorCompleted: {
    backgroundColor: Palette.success,
    opacity: 0.7,
  },
  connectorUpcoming: {
    backgroundColor: Palette.border,
  },
  contentCard: {
    flex: 1,
    marginLeft: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  contentCardCurrent: {
    backgroundColor: "#F9FBFB",
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.primaryLight,
  },
  contentCardFailed: {
    backgroundColor: "#FEF2F2",
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  contentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  stepTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.text,
    flex: 1,
  },
  stepTitleCurrent: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  stepTitleFailed: {
    color: Palette.error,
    fontWeight: "700",
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeCompleted: {
    backgroundColor: "#E8F5E9",
  },
  badgeCurrent: {
    backgroundColor: Palette.primaryLight,
  },
  badgeFailed: {
    backgroundColor: "#FEE2E2",
  },
  badgeUpcoming: {
    backgroundColor: Palette.surfaceAlt,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeTextCompleted: {
    color: Palette.success,
  },
  badgeTextCurrent: {
    color: Palette.primaryDark,
  },
  badgeTextFailed: {
    color: Palette.error,
  },
  badgeTextUpcoming: {
    color: Palette.textMuted,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  descriptionText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  actionBtnPrimary: {
    backgroundColor: Palette.primary,
  },
  actionBtnOutline: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    ...Typography.button,
    fontSize: 13,
  },
  actionBtnTextPrimary: {
    color: "#FFFFFF",
  },
  actionBtnTextOutline: {
    color: Palette.primaryDark,
  },

  // Compact styles
  compactContainer: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactIndicatorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  compactPulseDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  compactStageTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  compactProgressCount: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  compactTrack: {
    height: 4,
    backgroundColor: Palette.border,
    borderRadius: Radius.pill,
    marginVertical: 6,
    overflow: "hidden",
  },
  compactFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  compactDescription: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  bgPrimary: {
    backgroundColor: Palette.primary,
  },
  bgSuccess: {
    backgroundColor: Palette.success,
  },
  bgError: {
    backgroundColor: Palette.error,
  },
});
