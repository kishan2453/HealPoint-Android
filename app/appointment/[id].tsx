/**
 * HealPoint - Appointment Details (Production Premium Experience).
 *
 * Provides real-time clinical visibility:
 *  - Doctor profile, hospital affiliation, and department
 *  - Real-time booking status and payment status
 *  - Real Google Meet online consultation room handoff
 *  - Prescriptions, medications, diagnosis, and medical advice
 *  - Diagnostic medical reports attached to this visit
 *  - Auditable status history and milestone care journey
 *  - Real rescheduling and cancellation actions with slot release
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import { ReviewModal } from "@/components/ReviewModal";
import { QRCodeCanvas } from "@/components/ui/QRCodeCanvas";
import { SmartCareJourney } from "@/components/SmartCareJourney";
import * as checkInService from "@/services/checkin";
import {
  subscribeToAppointmentSync,
  subscribeToQueueSync,
} from "@/services/socket";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import {
  consultationStatusLabel,
  meetingStatusLabel,
  openGoogleMeetUrl,
} from "@/lib/meet";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as consultationService from "@/services/consultations";
import * as subscriptionService from "@/services/subscriptions";
import type { AppointmentDetails } from "@/types";
import { deriveAppointmentIntelligence } from "@/lib/appointment-intelligence";

const CANCELABLE = ["pending", "confirmed", "rescheduled"];

function statusBadge(status?: string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", variant: "success" };
    case "pending":
      return { label: "Pending Approval", variant: "warning" };
    case "rescheduled":
      return { label: "Rescheduled", variant: "neutral" };
    case "completed":
      return { label: "Completed", variant: "primary" };
    case "cancel":
      return { label: "Cancelled", variant: "error" };
    case "missed":
      return { label: "Missed", variant: "error" };
    default:
      return { label: status || "Unknown", variant: "neutral" };
  }
}

function paymentStatusLabel(paymentStatus?: string, paid?: boolean): string {
  if (paid) return "Paid";
  switch ((paymentStatus || "").trim().toLowerCase()) {
    case "success":
    case "paid":
    case "succeeded":
    case "captured":
      return "Paid";
    case "failed":
      return "Payment Failed";
    case "cancelled":
    case "cancel":
      return "Payment Cancelled";
    case "refunded":
      return "Refunded";
    case "pending":
    case "online_pending":
      return "Payment Pending";
    case "cash_pending":
      return "Pay at Clinic";
    default:
      return "Unpaid";
  }
}

function paymentStatusVariant(
  paymentStatus?: string,
  paid?: boolean,
): BadgeVariant {
  if (paid) return "success";
  switch ((paymentStatus || "").trim().toLowerCase()) {
    case "success":
    case "paid":
    case "succeeded":
    case "captured":
      return "success";
    case "failed":
      return "error";
    case "cancelled":
    case "cancel":
    case "refunded":
      return "neutral";
    case "pending":
    case "online_pending":
      return "warning";
    default:
      return "primary";
  }
}

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [meetError, setMeetError] = useState("");
  const [meetSubscriptionRequired, setMeetSubscriptionRequired] =
    useState(false);
  const [joiningMeet, setJoiningMeet] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);

  // Smart QR Check-In and Live Queue State
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [queueData, setQueueData] =
    useState<checkInService.PatientQueueStatusResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await appointmentService.getUserAppointmentDetails(id);
      setAppointment(res.appointmentDetails);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load appointment details."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadQueueStatus = useCallback(async () => {
    if (!id) return;
    setQueueLoading(true);
    try {
      const res = await checkInService.getPatientQueueStatus(id);
      if (res.success) {
        setQueueData(res);
      }
    } catch {
      // Background non-blocking update
    } finally {
      setQueueLoading(false);
    }
  }, [id]);

  const handleOpenQR = async () => {
    if (!id) return;
    setQrModalVisible(true);
    setQrLoading(true);
    setQrError("");
    try {
      const res = await checkInService.getAppointmentQR(id);
      if (res.success && res.token) {
        setQrToken(res.token);
      } else {
        setQrError(res.message || "Unable to generate check-in QR code.");
      }
    } catch (e) {
      setQrError(toErrorMessage(e, "Failed to load appointment check-in QR."));
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (appointment?.checkedIn) {
      loadQueueStatus();
    }
  }, [appointment?.checkedIn, loadQueueStatus]);

  useScreenFocus(() => {
    load();
    if (appointment?.checkedIn) {
      loadQueueStatus();
    }
  });

  // Real-time cross-portal sync for this specific appointment
  useEffect(() => {
    if (!id) return;

    const unsubAppt = subscribeToAppointmentSync((payload) => {
      if (String(payload.appointmentId) === String(id)) {
        load();
      }
    });

    const unsubQueue = subscribeToQueueSync((payload) => {
      if (String(payload.appointmentId) === String(id)) {
        load();
        loadQueueStatus();
      }
    });

    return () => {
      unsubAppt();
      unsubQueue();
    };
  }, [id, load, loadQueueStatus]);

  const status = appointment?.bookingStatus;
  const isActionable = Boolean(status && CANCELABLE.includes(status));

  const rawPaymentStatus = (appointment?.paymentStatus || "")
    .trim()
    .toLowerCase();
  const isPaid =
    appointment?.payment === true ||
    ["success", "paid", "succeeded", "captured"].includes(rawPaymentStatus);
  const payAttemptFailed = ["failed", "cancelled"].includes(rawPaymentStatus);
  const canPayOnline =
    isActionable && !isPaid && Number(appointment?.amount || 0) > 0;

  const openReschedule = () => {
    if (!id) return;
    router.push({ pathname: "/appointment/reschedule/[id]", params: { id } });
  };

  const openCancel = () => {
    setCancelVisible(true);
  };

  const confirmCancel = async () => {
    if (!id) return;
    setCancelling(true);
    setActionMessage("");
    try {
      await appointmentService.cancelAppointment(id);
      setCancelVisible(false);
      setActionMessage(
        "Your appointment has been cancelled. The slot has been released.",
      );
      await load();
    } catch (err) {
      setActionMessage(
        toErrorMessage(
          err,
          "Unable to cancel the appointment. Please try again.",
        ),
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleJoinMeet = async () => {
    if (!id || joiningMeet) return;
    setMeetError("");
    setMeetSubscriptionRequired(false);
    setJoiningMeet(true);
    try {
      // 1. Verify patient video consultation subscription entitlement
      const entitlement = await subscriptionService
        .getPatientSubscriptionEntitlement()
        .catch(() => null);
      if (entitlement && !entitlement.isEligibleForVideoConsultation) {
        setMeetSubscriptionRequired(true);
        setMeetError(entitlement.message);
        return;
      }

      // 2. Authorize with backend — enforces patient ownership, payment & timing rules
      const res = await consultationService.getPatientMeetingLink(id);
      if (!res.allowed || !res.meetingUrl) {
        if (
          res.subscriptionCode === "subscription_required" ||
          res.subscriptionCode === "quota_exhausted"
        ) {
          setMeetSubscriptionRequired(true);
        }
        setMeetError(
          res.message ||
            "Video meeting link has not been generated yet. The attending doctor will provide the link before the appointment.",
        );
        return;
      }

      // 3. Open verified Google Meet URL
      const success = openGoogleMeetUrl(res.meetingUrl);
      if (!success) {
        setMeetError(
          "Unable to open Google Meet. Please ensure a web browser or Google Meet app is available.",
        );
      }
    } catch (err) {
      setMeetError(
        toErrorMessage(
          err,
          "Unable to join the consultation right now. Please try again.",
        ),
      );
    } finally {
      setJoiningMeet(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading appointment details..." />
      </SafeAreaView>
    );
  }

  if (error || !appointment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || "Appointment not found."} />
      </SafeAreaView>
    );
  }

  // Intelligence layer: derives current status, next action, check-in, queue, and time context
  // from the real appointment state — appointment is guaranteed non-null here.
  const intelligence = deriveAppointmentIntelligence(appointment);
  const badge = intelligence.currentStatus;

  const isVideo = appointment.consultationType === "video";
  const hasValidMeet =
    isVideo &&
    Boolean(appointment.meetingUrl) &&
    /^https:\/\/meet\.google\.com\//i.test(appointment.meetingUrl || "");
  const isEligibleToJoin =
    hasValidMeet && status !== "cancel" && status !== "missed";

  const hasClinicalNotes = Boolean(
    appointment.diagnosis ||
    appointment.prescription ||
    appointment.followUpAdvice ||
    (appointment.medicines && appointment.medicines.length > 0),
  );

  const resolvedDoctorId =
    typeof appointment.doctorId === "object" && appointment.doctorId
      ? String((appointment.doctorId as { _id?: string })._id || "")
      : String(appointment.doctorId || "");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(drawer)/appointments")
            }
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Appointment Details</Text>
            <Text style={styles.headerSubtitle}>
              Ref #{appointment.appointmentId || appointment.mongoAppointmentId}
            </Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} />
        </View>

        {actionMessage ? (
          <FormMessage
            type={
              actionMessage.toLowerCase().includes("cancelled")
                ? "info"
                : "error"
            }
            message={actionMessage}
          />
        ) : null}

        {/* ---- Smart Appointment Status Banner (intelligence layer) ---- */}
        {intelligence.currentStatus.description ? (
          <Card padded style={styles.smartStatusCard}>
            <View style={styles.smartStatusRow}>
              <View
                style={[
                  styles.smartStatusIcon,
                  intelligence.checkInStatus.isCheckedIn &&
                    !isVideo && {
                      backgroundColor: "#ECFDF5",
                    },
                  intelligence.nextAction.key === "PAY_NOW" && {
                    backgroundColor: "#FEF3C7",
                  },
                  intelligence.nextAction.key === "JOIN_CONSULTATION" && {
                    backgroundColor: "#EEF2FF",
                  },
                ]}
              >
                <Ionicons
                  name={
                    intelligence.nextAction.key === "PAY_NOW"
                      ? "card-outline"
                      : intelligence.nextAction.key === "CHECK_IN_NOW"
                        ? "qr-code-outline"
                        : intelligence.nextAction.key === "JOIN_CONSULTATION"
                          ? "videocam-outline"
                          : intelligence.nextAction.key === "WAITING_ROOM"
                            ? "chatbubbles-outline"
                            : intelligence.checkInStatus.isCheckedIn
                              ? "checkmark-circle-outline"
                              : "information-circle-outline"
                  }
                  size={20}
                  color={
                    intelligence.nextAction.key === "PAY_NOW"
                      ? "#D97706"
                      : intelligence.nextAction.key === "JOIN_CONSULTATION"
                        ? "#4F46E5"
                        : intelligence.checkInStatus.isCheckedIn
                          ? "#059669"
                          : Palette.primaryDark
                  }
                />
              </View>
              <View style={styles.smartStatusTexts}>
                <Text style={styles.smartStatusLabel}>
                  {intelligence.nextAction.key !== "VIEW_DETAILS"
                    ? "Next Action"
                    : "Appointment Status"}
                </Text>
                <Text style={styles.smartStatusDescription}>
                  {intelligence.currentStatus.description}
                </Text>
                {intelligence.timeContext.relativeLabel &&
                intelligence.timeContext.relativeLabel !== "" ? (
                  <Text style={styles.smartStatusTime}>
                    {intelligence.timeContext.relativeLabel}
                  </Text>
                ) : null}
              </View>
            </View>
            {intelligence.nextAction.key !== "VIEW_DETAILS" ? (
              <Button
                title={intelligence.nextAction.label}
                icon={intelligence.nextAction.icon}
                variant={intelligence.nextAction.variant}
                style={{ marginTop: Spacing.sm }}
                onPress={() => {
                  const act = intelligence.nextAction;
                  switch (act.key) {
                    case "PAY_NOW":
                      if (!id) return;
                      router.push({
                        pathname: "/payment/[appointmentId]",
                        params: { appointmentId: id },
                      });
                      break;
                    case "CHECK_IN_NOW":
                    case "VIEW_PASS":
                      if (!id) return;
                      router.push({
                        pathname: "/appointment/pass/[id]",
                        params: { id },
                      });
                      break;
                    case "JOIN_CONSULTATION":
                      handleJoinMeet();
                      break;
                    case "WAITING_ROOM":
                      if (!id) return;
                      router.push({
                        pathname: "/consultation/[id]",
                        params: { id: appointment._id || id },
                      });
                      break;
                    case "VIEW_PRESCRIPTION":
                      router.push("/(drawer)/health/prescriptions");
                      break;
                    case "VIEW_REPORT":
                      router.push("/(drawer)/health/reports");
                      break;
                    default:
                      break;
                  }
                }}
              />
            ) : null}
          </Card>
        ) : null}

        {/* Primary Information Card */}
        <Card padded style={styles.mainCard}>
          <View style={styles.doctorHeader}>
            <View style={styles.doctorAvatarBox}>
              <Ionicons name="person" size={28} color={Palette.primary} />
            </View>
            <View style={styles.doctorHeaderInfo}>
              <Text style={styles.doctorName}>
                {formatDoctorName(
                  appointment.doctorName,
                  "Attending Physician",
                )}
              </Text>
              <Text style={styles.doctorSpecialty}>
                {appointment.doctorSpecialty ||
                  appointment.doctorDepartment ||
                  "General Healthcare"}
              </Text>
              <Text style={styles.hospitalName}>
                <Ionicons name="business" size={12} color={Palette.textMuted} />{" "}
                {appointment.hospitalName || "Affiliated Medical Center"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Date & Time Highlights */}
          <View style={styles.dateTimeGrid}>
            <View style={styles.dateTimeTile}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={Palette.primary}
              />
              <View>
                <Text style={styles.tileLabel}>Date</Text>
                <Text style={styles.tileValue}>
                  {formatDDMMYYYY(appointment.bookingDate)}
                </Text>
              </View>
            </View>
            <View style={styles.dateTimeTile}>
              <Ionicons name="time-outline" size={18} color={Palette.primary} />
              <View>
                <Text style={styles.tileLabel}>Time Slot</Text>
                <Text style={styles.tileValue}>{appointment.bookingTime}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Consultation Type & Patient Details */}
          <View style={styles.infoRow}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "medkit-outline"}
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.infoLabel}>Consultation</Text>
            <Badge
              label={isVideo ? "Video Consultation" : "In-Person Clinic Visit"}
              variant={isVideo ? "primary" : "neutral"}
            />
          </View>

          {/* Patient Identity */}
          <View style={styles.infoRow}>
            <Ionicons
              name={
                appointment.familyMemberId ? "people-outline" : "person-outline"
              }
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.infoLabel}>Patient</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flexShrink: 1,
              }}
            >
              <Text style={styles.infoValue}>
                {appointment.patientName || "Account Holder"}
              </Text>
              {appointment.familyRelationship &&
              appointment.familyRelationship !== "Self" ? (
                <Badge
                  label={appointment.familyRelationship}
                  variant="primary"
                />
              ) : null}
            </View>
          </View>

          {appointment.patientPhone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={Palette.primary} />
              <Text style={styles.infoLabel}>Patient Phone</Text>
              <Text style={styles.infoValue}>{appointment.patientPhone}</Text>
            </View>
          ) : null}

          {appointment.doctorPhone ? (
            <View style={styles.infoRow}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={Palette.primary}
              />
              <Text style={styles.infoLabel}>Clinic Contact</Text>
              <Pressable
                onPress={() =>
                  Linking.openURL(`tel:${appointment.doctorPhone}`)
                }
              >
                <Text style={styles.linkValue}>{appointment.doctorPhone}</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* ---------------- Smart Care Journey (Production Visual Lifecycle) ---------------- */}
        <SmartCareJourney
          appointment={appointment}
          onPayPress={() =>
            router.push({
              pathname: "/payment/[appointmentId]",
              params: { appointmentId: appointment._id || id || "" },
            })
          }
          onCheckInPress={handleOpenQR}
          onJoinMeetPress={handleJoinMeet}
          onReportsPress={() => router.push("/(drawer)/health/reports")}
          onFollowUpPress={() => {
            if (resolvedDoctorId) {
              router.push({
                pathname: "/booking/[doctorId]",
                params: { doctorId: resolvedDoctorId },
              });
            }
          }}
        />

        {/* ---------------- Smart QR Check-In & Live Queue Section ---------------- */}
        {appointment.checkedIn ? (
          <Card padded style={styles.queueCard}>
            <View style={styles.queueHeader}>
              <View style={styles.queueHeaderLeft}>
                <View style={styles.queueBadgeRow}>
                  <Badge label="✓ Checked In" variant="success" />
                  <Text style={styles.queueTimeText}>
                    {appointment.checkInAt
                      ? new Date(appointment.checkInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Today"}
                  </Text>
                </View>
                <Text style={styles.queueTitle}>Live Patient Queue</Text>
              </View>
              <Pressable
                onPress={() => {
                  loadQueueStatus();
                  load();
                }}
                disabled={queueLoading}
                style={({ pressed }) => [
                  styles.queueRefreshBtn,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
              >
                {queueLoading ? (
                  <ActivityIndicator size="small" color={Palette.primary} />
                ) : (
                  <Ionicons name="refresh" size={18} color={Palette.primary} />
                )}
              </Pressable>
            </View>

            {/* Token & Stats Row */}
            <View style={styles.queueStatsRow}>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenBoxLabel}>YOUR TOKEN</Text>
                <Text style={styles.tokenBoxValue}>
                  {queueData?.queueToken || appointment.queueToken || "—"}
                </Text>
              </View>

              <View style={styles.queueStatBox}>
                <Text style={styles.queueStatLabel}>CURRENT SERVING</Text>
                <Text style={styles.queueStatValue}>
                  {queueData?.currentServingToken || "In Session"}
                </Text>
              </View>

              <View style={styles.queueStatBox}>
                <Text style={styles.queueStatLabel}>PATIENTS AHEAD</Text>
                <Text style={styles.queueStatValue}>
                  {queueData?.patientsAhead ?? 0}
                </Text>
              </View>
            </View>

            {/* Queue State Banner */}
            {(queueData?.queueStatus || appointment.queueStatus) ===
            "called" ? (
              <View style={styles.calledBanner}>
                <Ionicons name="megaphone" size={20} color="#b45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.calledBannerTitle}>Doctor is Ready!</Text>
                  <Text style={styles.calledBannerSubtitle}>
                    Please proceed to the consultation room now.
                  </Text>
                </View>
              </View>
            ) : (queueData?.queueStatus || appointment.queueStatus) ===
              "in_consultation" ? (
              <View style={styles.inProgressBanner}>
                <Ionicons name="medical" size={20} color={Palette.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inProgressBannerTitle}>
                    Consultation in Progress
                  </Text>
                  <Text style={styles.inProgressBannerSubtitle}>
                    You are currently with the doctor.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.waitingBanner}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Palette.textMuted}
                />
                <Text style={styles.waitingBannerText}>
                  Please wait in the OPD lounge. Queue position updates live.
                </Text>
              </View>
            )}

            <Button
              title="View Digital Hospital Pass"
              variant="outline"
              icon="card-outline"
              onPress={() =>
                router.push({
                  pathname: "/appointment/pass/[id]" as any,
                  params: { id: String(id) },
                })
              }
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : appointment.bookingStatus === "confirmed" ? (
          <Card padded style={styles.qrBannerCard}>
            <View style={styles.qrBannerContent}>
              <View style={styles.qrBannerIconBox}>
                <Ionicons
                  name="card-outline"
                  size={26}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.qrBannerTextWrap}>
                <Text style={styles.qrBannerTitle}>Digital Hospital Pass</Text>
                <Text style={styles.qrBannerSubtitle}>
                  Access your official admission pass, department routing, and
                  secure check-in QR for{" "}
                  {appointment.hospitalName || "the hospital"}.
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.sm,
              }}
            >
              <Button
                title="View Hospital Pass"
                variant="primary"
                icon="card-outline"
                onPress={() =>
                  router.push({
                    pathname: "/appointment/pass/[id]" as any,
                    params: { id: String(id) },
                  })
                }
                style={{ flex: 1 }}
              />
              <Button
                title="Quick QR"
                variant="outline"
                icon="qr-code-outline"
                onPress={handleOpenQR}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : null}

        {/* ---------------- Online Video Consultation Section ---------------- */}
        {isVideo ? (
          <Card padded style={styles.meetCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="videocam" size={20} color={Palette.primary} />
              <Text style={styles.sectionTitle}>Online Video Consultation</Text>
            </View>

            <View style={styles.meetBadgesRow}>
              <Badge
                label={`Meeting: ${meetingStatusLabel(appointment.meetingStatus)}`}
                variant={
                  appointment.meetingStatus === "ready" ||
                  appointment.meetingStatus === "started"
                    ? "success"
                    : "neutral"
                }
              />
              <Badge
                label={`Status: ${consultationStatusLabel(appointment.consultationStatus)}`}
                variant={
                  appointment.consultationStatus === "in_progress"
                    ? "success"
                    : appointment.consultationStatus === "doctor_ready" ||
                        appointment.consultationStatus === "ready_to_join"
                      ? "primary"
                      : "warning"
                }
              />
            </View>

            {isEligibleToJoin ? (
              <View style={styles.meetActiveBox}>
                <Text style={styles.meetActiveText}>
                  Your private Google Meet room is ready. Join the consultation
                  when your doctor begins, or enter the waiting room to track
                  real-time status.
                </Text>
                <View style={styles.meetActionButtons}>
                  <Button
                    title={
                      joiningMeet
                        ? "Launching Google Meet..."
                        : "Join Google Meet Consultation"
                    }
                    icon="videocam"
                    loading={joiningMeet}
                    disabled={joiningMeet}
                    onPress={handleJoinMeet}
                    style={styles.joinMeetBtn}
                  />
                  <Button
                    title="Enter Consultation Waiting Room"
                    variant="outline"
                    icon="chatbubbles-outline"
                    onPress={() => {
                      if (!id) return;
                      router.push({
                        pathname: "/consultation/[id]",
                        params: { id: appointment._id || id },
                      });
                    }}
                    style={styles.roomMeetBtn}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.meetPendingContainer}>
                <View style={styles.meetPendingBox}>
                  <Ionicons
                    name="time-outline"
                    size={24}
                    color={Palette.primaryDark}
                  />
                  <Text style={styles.meetPendingText}>
                    The attending physician will generate and share your
                    verified Google Meet link prior to consultation time.
                  </Text>
                </View>
                <Button
                  title="Open Consultation Room & Care Journey"
                  variant="outline"
                  icon="open-outline"
                  onPress={() => {
                    if (!id) return;
                    router.push({
                      pathname: "/consultation/[id]",
                      params: { id: appointment._id || id },
                    });
                  }}
                  style={{ marginTop: Spacing.sm }}
                />
              </View>
            )}

            {meetError ? (
              <FormMessage type="warning" message={meetError} />
            ) : null}

            {meetSubscriptionRequired ? (
              <Button
                title="Upgrade Subscription Plan"
                variant="primary"
                icon="shield-checkmark"
                onPress={() => router.push("/subscription")}
                style={{ marginTop: Spacing.sm }}
              />
            ) : null}
          </Card>
        ) : null}

        {/* ---------------- Payment Details Card ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Billing & Payment</Text>
          </View>

          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Consultation Fee</Text>
            <Text style={styles.billingAmount}>
              {formatINR(appointment.amount)}
            </Text>
          </View>

          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Payment Mode</Text>
            <Text style={styles.billingValue}>
              {appointment.paymentMethod === "online"
                ? "Online (Razorpay)"
                : "Pay at Clinic (Cash / UPI)"}
            </Text>
          </View>

          <View style={styles.billingRow}>
            <Text style={styles.billingLabel}>Payment Status</Text>
            <Badge
              label={paymentStatusLabel(
                appointment.paymentStatus,
                appointment.payment,
              )}
              variant={paymentStatusVariant(
                appointment.paymentStatus,
                appointment.payment,
              )}
            />
          </View>

          {appointment.razorpayPaymentId ? (
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Razorpay Payment ID</Text>
              <Text style={styles.billingCode}>
                {appointment.razorpayPaymentId}
              </Text>
            </View>
          ) : null}

          {canPayOnline ? (
            <View style={styles.payActionWrap}>
              <Button
                title={
                  payAttemptFailed
                    ? "Retry Online Payment · Razorpay"
                    : "Pay Consultation Fee Online"
                }
                icon="card"
                onPress={() => {
                  if (!id) return;
                  router.push({
                    pathname: "/payment/[appointmentId]",
                    params: { appointmentId: id },
                  });
                }}
              />
            </View>
          ) : null}
        </Card>

        {/* ---------------- Clinical Consultation & Rx Section ---------------- */}
        {hasClinicalNotes ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>
                Clinical Notes & Prescription
              </Text>
            </View>

            {appointment.diagnosis ? (
              <View style={styles.clinicalBox}>
                <Text style={styles.clinicalLabel}>Primary Assessment</Text>
                <Text style={styles.clinicalValue}>
                  {appointment.diagnosis}
                </Text>
              </View>
            ) : null}

            {appointment.followUpAdvice ? (
              <View style={styles.clinicalBox}>
                <Text style={styles.clinicalLabel}>Doctor Recommendations</Text>
                <Text style={styles.clinicalValue}>
                  {appointment.followUpAdvice}
                </Text>
              </View>
            ) : null}

            {appointment.medicines && appointment.medicines.length > 0 ? (
              <View style={styles.medicinesSection}>
                <Text style={styles.clinicalLabel}>Prescribed Medications</Text>
                {appointment.medicines.map((med, idx) => (
                  <View key={idx} style={styles.medItem}>
                    <Ionicons
                      name="medical"
                      size={14}
                      color={Palette.primary}
                    />
                    <View style={styles.medDetails}>
                      <Text style={styles.medName}>{med.name}</Text>
                      <Text style={styles.medMeta}>
                        {[med.dosage, med.frequency, med.duration]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                      {med.instructions ? (
                        <Text style={styles.medInstructions}>
                          {med.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.sm,
              }}
            >
              <Button
                title="View Prescriptions"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => router.push("/(drawer)/health/prescriptions")}
              />
              <Button
                title="Health Records"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => router.push("/(drawer)/health/records")}
              />
            </View>
          </Card>
        ) : null}

        {/* ---------------- Diagnostic Reports Attached ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="folder-open-outline"
              size={20}
              color={Palette.primary}
            />
            <Text style={styles.sectionTitle}>
              Diagnostic Reports ({appointment.medicalReports?.length || 0})
            </Text>
          </View>
          {appointment.medicalReports &&
          appointment.medicalReports.length > 0 ? (
            appointment.medicalReports.map((report, idx) => (
              <Pressable
                key={idx}
                style={styles.reportRow}
                onPress={() => {
                  if (report.url) {
                    Linking.openURL(report.url).catch(() => {});
                  }
                }}
              >
                <Ionicons
                  name="document-attach"
                  size={20}
                  color={Palette.primaryDark}
                />
                <View style={styles.reportInfo}>
                  <Text style={styles.reportName}>{report.name}</Text>
                  {report.type ? (
                    <Text style={styles.reportType}>{report.type}</Text>
                  ) : null}
                </View>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={Palette.primary}
                />
              </Pressable>
            ))
          ) : (
            <Text
              style={{
                ...Typography.caption,
                color: Palette.textMuted,
                fontStyle: "italic",
                marginVertical: 4,
              }}
            >
              No diagnostic reports attached to this appointment.
            </Text>
          )}
          <View style={{ marginTop: Spacing.xs }}>
            <Button
              title="Manage Reports & Upload"
              variant="outline"
              onPress={() => router.push("/(drawer)/health/reports")}
            />
          </View>
        </Card>

        {/* ---------------- Status History Timeline ---------------- */}
        {appointment.statusHistory && appointment.statusHistory.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="git-commit-outline"
                size={20}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Status Timeline</Text>
            </View>
            <View style={styles.timeline}>
              {appointment.statusHistory.map((item, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  {idx < appointment.statusHistory!.length - 1 ? (
                    <View style={styles.timelineLine} />
                  ) : null}
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineTitleRow}>
                      <Text style={styles.timelineStatus}>
                        {item.status.toUpperCase()}
                      </Text>
                      {item.changedAt ? (
                        <Text style={styles.timelineDate}>
                          {formatDDMMYYYY(item.changedAt)}
                        </Text>
                      ) : null}
                    </View>
                    {item.reason ? (
                      <Text style={styles.timelineReason}>{item.reason}</Text>
                    ) : null}
                    {item.actor ? (
                      <Text style={styles.timelineActor}>
                        Updated by: {item.actor}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Review & Feedback Card ---------------- */}
        {appointment.bookingStatus === "completed" ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name={appointment.isReviewed ? "checkmark-circle" : "star"}
                size={20}
                color={appointment.isReviewed ? Palette.primary : Palette.gold}
              />
              <Text style={styles.sectionTitle}>
                {appointment.isReviewed
                  ? "Consultation Reviewed"
                  : "Rate Your Experience"}
              </Text>
            </View>
            <Text style={styles.reviewBodyText}>
              {appointment.isReviewed
                ? "You have already submitted verified feedback for this consultation. Thank you for contributing to healthcare transparency on HealPoint."
                : `How was your consultation with ${formatDoctorName(appointment.doctorName, "your doctor")}? Your review helps other patients choose the right care.`}
            </Text>
            {!appointment.isReviewed ? (
              <Button
                title="Rate & Write Review"
                variant="outline"
                icon="star-outline"
                onPress={() => setReviewVisible(true)}
                style={{ marginTop: Spacing.sm }}
              />
            ) : null}
          </Card>
        ) : null}

        {/* ---------------- Action Controls ---------------- */}
        {isActionable ? (
          <View style={styles.actionButtonsWrap}>
            <Button
              title="Reschedule Appointment"
              variant="secondary"
              icon="calendar-outline"
              onPress={openReschedule}
            />
            <Button
              title="Cancel Appointment"
              variant="outline"
              icon="close-circle-outline"
              onPress={() => setCancelVisible(true)}
            />
          </View>
        ) : status === "completed" && resolvedDoctorId ? (
          <View style={styles.actionButtonsWrap}>
            <Button
              title={`Book Follow-up with ${formatDoctorName(appointment.doctorName, "Doctor")}`}
              variant="primary"
              icon="calendar"
              onPress={() =>
                router.push({
                  pathname: "/booking/[doctorId]",
                  params: { doctorId: resolvedDoctorId },
                })
              }
            />
          </View>
        ) : null}

        <ConfirmDialog
          visible={cancelVisible}
          title="Cancel Appointment?"
          message={`Are you sure you want to cancel your appointment with ${formatDoctorName(appointment.doctorName, "this doctor")} on ${formatDDMMYYYY(appointment.bookingDate)} at ${appointment.bookingTime}? The reserved slot will immediately be released for other patients.`}
          confirmLabel="Yes, Cancel"
          cancelLabel="Keep Appointment"
          tone="danger"
          loading={cancelling}
          onConfirm={confirmCancel}
          onCancel={() => setCancelVisible(false)}
        />

        <ReviewModal
          visible={reviewVisible}
          doctorId={
            typeof appointment.doctorId === "object" && appointment.doctorId
              ? String((appointment.doctorId as { _id?: string })._id || "")
              : String(appointment.doctorId || "")
          }
          doctorName={formatDoctorName(appointment.doctorName)}
          appointmentId={String(appointment._id)}
          hospitalId={
            typeof appointment.hospitalId === "object" && appointment.hospitalId
              ? String((appointment.hospitalId as { _id?: string })._id || "")
              : String(appointment.hospitalId || "")
          }
          hospitalName={appointment.hospitalName || "HealPoint Hospital"}
          onClose={() => setReviewVisible(false)}
          onSuccess={() => {
            setReviewVisible(false);
            load();
          }}
        />

        {/* ---------------- Appointment QR Modal ---------------- */}
        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQrModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.qrModalCard}>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setQrModalVisible(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>

              <View style={styles.qrModalHeader}>
                <Text style={styles.qrModalBrand}>HealPoint Check-In</Text>
                <Text style={styles.qrModalSub}>Present at Reception Desk</Text>
              </View>

              <View style={styles.qrInfoGrid}>
                <View style={styles.qrInfoCol}>
                  <Text style={styles.qrInfoLabel}>DOCTOR</Text>
                  <Text style={styles.qrInfoVal} numberOfLines={1}>
                    {formatDoctorName(appointment.doctorName, "Doctor")}
                  </Text>
                </View>
                <View style={styles.qrInfoCol}>
                  <Text style={styles.qrInfoLabel}>HOSPITAL</Text>
                  <Text style={styles.qrInfoVal} numberOfLines={1}>
                    {appointment.hospitalName || "Hospital"}
                  </Text>
                </View>
              </View>

              <View style={styles.qrInfoGrid}>
                <View style={styles.qrInfoCol}>
                  <Text style={styles.qrInfoLabel}>DATE & TIME</Text>
                  <Text style={styles.qrInfoVal}>
                    {formatDDMMYYYY(appointment.bookingDate)} •{" "}
                    {appointment.bookingTime}
                  </Text>
                </View>
                <View style={styles.qrInfoCol}>
                  <Text style={styles.qrInfoLabel}>APPOINTMENT ID</Text>
                  <Text style={styles.qrInfoVal}>
                    {appointment.appointmentId ||
                      appointment.mongoAppointmentId}
                  </Text>
                </View>
              </View>

              <View style={styles.qrCodeBox}>
                {qrLoading ? (
                  <View style={styles.qrLoadingBox}>
                    <ActivityIndicator size="large" color={Palette.primary} />
                    <Text style={styles.qrLoadingText}>
                      Generating secure QR...
                    </Text>
                  </View>
                ) : qrError ? (
                  <View style={styles.qrLoadingBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={32}
                      color={Palette.error}
                    />
                    <Text style={styles.qrErrorText}>{qrError}</Text>
                  </View>
                ) : qrToken ? (
                  <QRCodeCanvas
                    value={qrToken}
                    size={200}
                    color="#0f172a"
                    backgroundColor="#ffffff"
                  />
                ) : null}
              </View>

              <View style={styles.qrStatusTag}>
                <View style={styles.qrStatusDot} />
                <Text style={styles.qrStatusTagText}>Ready for Check-In</Text>
              </View>

              <Text style={styles.qrFooterNote}>
                Encrypted with server signature. No private medical records or
                passwords are stored in this QR.
              </Text>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  mainCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
    ...Shadows.card,
    gap: Spacing.sm,
  },
  // Smart appointment status banner card
  smartStatusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    ...Shadows.card,
    gap: Spacing.xs,
  },
  smartStatusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  smartStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  smartStatusTexts: {
    flex: 1,
    gap: 2,
  },
  smartStatusLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  smartStatusDescription: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    lineHeight: 20,
  },
  smartStatusTime: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
    marginTop: 2,
  },

  doctorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  doctorAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.h4,
    color: Palette.text,
  },
  doctorSpecialty: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  hospitalName: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.xs,
  },
  dateTimeGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  dateTimeTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  tileLabel: {
    fontSize: 10,
    color: Palette.textMuted,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  tileValue: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    width: 110,
  },
  infoValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    flex: 1,
  },
  linkValue: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  sectionTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
  reviewBodyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  meetCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
    backgroundColor: "rgba(226, 246, 242, 0.3)",
    ...Shadows.card,
    gap: Spacing.sm,
  },
  meetBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  meetActiveBox: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  meetActiveText: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  meetActionButtons: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  joinMeetBtn: {
    width: "100%",
  },
  roomMeetBtn: {
    width: "100%",
  },
  meetPendingContainer: {
    gap: Spacing.xs,
  },
  meetPendingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginTop: Spacing.xs,
  },
  meetPendingText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  billingLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  billingAmount: {
    ...Typography.h4,
    color: Palette.primaryDark,
    fontWeight: "800",
  },
  billingValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  billingCode: {
    ...Typography.caption,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
  payActionWrap: {
    paddingTop: Spacing.xs,
  },
  clinicalBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
  },
  clinicalLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clinicalValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  medicinesSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  medItem: {
    flexDirection: "row",
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  medDetails: {
    flex: 1,
    gap: 2,
  },
  medName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  medMeta: {
    ...Typography.caption,
    color: Palette.primaryDark,
  },
  medInstructions: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  reportInfo: {
    flex: 1,
  },
  reportName: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  reportType: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  timeline: {
    paddingLeft: Spacing.sm,
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    gap: Spacing.md,
    position: "relative",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
    marginTop: 5,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 15,
    bottom: -15,
    width: 2,
    backgroundColor: "rgba(14, 159, 142, 0.2)",
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineStatus: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  timelineDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  timelineReason: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  timelineActor: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  actionButtonsWrap: {
    gap: Spacing.sm,
  },
  // QR Banner Card
  qrBannerCard: {
    backgroundColor: "#f0fdfa",
    borderColor: "rgba(14, 159, 142, 0.25)",
    borderWidth: 1,
    gap: Spacing.sm,
  },
  qrBannerContent: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  qrBannerIconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  qrBannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  qrBannerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  // Live Queue Card
  queueCard: {
    backgroundColor: Palette.surface,
    borderColor: Palette.primaryLight,
    borderWidth: 1.5,
    gap: Spacing.md,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  queueHeaderLeft: {
    gap: 4,
  },
  queueBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  queueTimeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  queueTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  queueRefreshBtn: {
    padding: 8,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  queueStatsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tokenBox: {
    flex: 1.2,
    backgroundColor: Palette.primaryDark,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenBoxLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "rgba(255, 255, 255, 0.75)",
  },
  tokenBoxValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
  },
  queueStatBox: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  queueStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: Palette.textMuted,
    textAlign: "center",
  },
  queueStatValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
    marginTop: 2,
  },
  calledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#b45309",
  },
  calledBannerTitle: {
    ...Typography.body,
    fontWeight: "800",
    color: "#92400e",
  },
  calledBannerSubtitle: {
    ...Typography.caption,
    color: "#b45309",
    fontWeight: "600",
  },
  inProgressBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: "#f0fdfa",
    borderLeftWidth: 4,
    borderLeftColor: Palette.primary,
  },
  inProgressBannerTitle: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  inProgressBannerSubtitle: {
    ...Typography.caption,
    color: Palette.primary,
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.xs,
  },
  waitingBannerText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  // QR Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadows.card,
  },
  modalCloseBtn: {
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 10,
    padding: 6,
  },
  qrModalHeader: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  qrModalBrand: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  qrModalSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  qrInfoGrid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  qrInfoCol: {
    flex: 1,
  },
  qrInfoLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  qrInfoVal: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  qrCodeBox: {
    marginVertical: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
    minWidth: 220,
  },
  qrLoadingBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  qrLoadingText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  qrErrorText: {
    ...Typography.caption,
    color: Palette.error,
    textAlign: "center",
  },
  qrStatusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: Spacing.sm,
  },
  qrStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  qrStatusTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46",
  },
  qrFooterNote: {
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 14,
  },
});
