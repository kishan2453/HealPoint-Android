/**
 * HealPoint - Consultation Detail & Google Meet Waiting Room.
 *
 * Professional online consultation interface with:
 *  - Real-time waiting room & doctor availability status
 *  - Care Journey timeline tracking consultation lifecycle
 *  - Real Google Meet launch with live backend authorization
 *  - Anti-double-tap loading protection & external link safety
 *  - Payment verification & direct fee settlement CTA
 *  - Digital prescription, diagnosis assessment & prescribed medications
 *  - Integrated post-consultation patient review submission
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReviewModal } from "@/components/ReviewModal";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import {
  consultationStatusLabel,
  meetingStatusLabel,
  openGoogleMeetUrl,
} from "@/lib/meet";
import { toErrorMessage } from "@/services/api";
import * as consultationService from "@/services/consultations";
import * as subscriptionService from "@/services/subscriptions";
import type { CareJourney, PatientConsultationDetail } from "@/types";

function statusBadge(status?: string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", variant: "success" };
    case "pending":
      return { label: "Pending", variant: "warning" };
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

function paymentLabel(c: PatientConsultationDetail): {
  label: string;
  variant: BadgeVariant;
} {
  const raw = (c.paymentStatus || "").trim().toLowerCase();
  if (c.payment === true || raw === "paid" || raw === "success") {
    return { label: "Paid", variant: "success" };
  }
  if (raw === "failed") return { label: "Payment failed", variant: "error" };
  if (raw === "refunded") return { label: "Refunded", variant: "neutral" };
  return { label: "Payment pending", variant: "warning" };
}

function doctorNameOf(c: PatientConsultationDetail): string {
  return formatDoctorName(c.doctor?.name, "Doctor");
}

function doctorSpecialtyOf(c: PatientConsultationDetail): string {
  return c.doctor?.speciality || c.doctor?.department || "Video consultation";
}

function JourneyStep({
  step,
  state,
}: {
  step: { key: string; label: string };
  state: "done" | "current" | "todo";
}) {
  return (
    <View style={styles.journeyStep}>
      <View
        style={[
          styles.journeyDot,
          state === "done" && styles.journeyDotDone,
          state === "current" && styles.journeyDotCurrent,
        ]}
      >
        {state === "done" ? (
          <Ionicons name="checkmark" size={12} color={Palette.white} />
        ) : state === "current" ? (
          <View style={styles.journeyDotInner} />
        ) : null}
      </View>
      <Text
        style={[
          styles.journeyLabel,
          state === "done" && styles.journeyLabelDone,
          state === "current" && styles.journeyLabelCurrent,
        ]}
      >
        {step.label}
      </Text>
    </View>
  );
}

function JourneyTimeline({ journey }: { journey: CareJourney }) {
  const current = Math.min(journey.currentIndex, journey.steps.length - 1);
  return (
    <Card padded style={styles.sectionCard}>
      <View style={styles.journeyHeader}>
        <View style={styles.journeyTitleWrap}>
          <Ionicons
            name="git-commit-outline"
            size={18}
            color={Palette.primary}
          />
          <Text style={styles.sectionTitle}>Consultation Journey</Text>
        </View>
        <Badge
          label={`Step ${current + 1} of ${journey.steps.length}`}
          variant="primary"
        />
      </View>
      <View style={styles.journeyRow}>
        {journey.steps.map((step, index) => {
          const state =
            index < current ? "done" : index === current ? "current" : "todo";
          return <JourneyStep key={step.key} step={step} state={state} />;
        })}
      </View>
    </Card>
  );
}

export default function ConsultationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [consultation, setConsultation] =
    useState<PatientConsultationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSubscriptionRequired, setJoinSubscriptionRequired] =
    useState(false);
  const [joining, setJoining] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const res = await consultationService.getUserConsultation(String(id));
        setConsultation(res.consultation);
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load this consultation."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useScreenFocus(() => {
    load();
  });

  useEffect(() => {
    load();
  }, [load]);

  const handleJoinMeeting = async () => {
    if (!id || joining) return;
    setJoining(true);
    setJoinError("");
    setJoinSubscriptionRequired(false);
    try {
      // 1. Verify patient video consultation subscription entitlement
      const entitlement = await subscriptionService
        .getPatientSubscriptionEntitlement()
        .catch(() => null);
      if (entitlement && !entitlement.isEligibleForVideoConsultation) {
        setJoinSubscriptionRequired(true);
        setJoinError(entitlement.message);
        return;
      }

      // 2. Authorize with backend — enforces participant ownership, payment & time window
      const res = await consultationService.getPatientMeetingLink(String(id));
      if (!res.allowed || !res.meetingUrl) {
        if (
          res.subscriptionCode === "subscription_required" ||
          res.subscriptionCode === "quota_exhausted"
        ) {
          setJoinSubscriptionRequired(true);
        }
        setJoinError(
          res.message ||
            "Video meeting link is not ready yet. Please try again shortly.",
        );
        return;
      }

      // 3. Open external Google Meet safely
      const opened = openGoogleMeetUrl(res.meetingUrl);
      if (!opened) {
        setJoinError(
          "Unable to open Google Meet. Please ensure a web browser or Google Meet app is available.",
        );
      }
    } catch (err) {
      setJoinError(
        toErrorMessage(
          err,
          "Unable to join the consultation right now. Please verify your connection.",
        ),
      );
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Loading label="Opening your consultation..." />
      </SafeAreaView>
    );
  }

  if (error || !consultation) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ErrorState
          message={error || "Consultation not found."}
          onRetry={() => load()}
        />
      </SafeAreaView>
    );
  }

  const badge = statusBadge(consultation.status);
  const pay = paymentLabel(consultation);
  const meetingStatus = consultation.meetingStatus || "not_created";
  const consultStatus = consultation.consultationStatus || "waiting";
  const joinAllowed = consultation.join?.allowed === true;
  const joinReason = consultation.join?.reason;
  const isCompleted =
    consultation.status === "completed" || consultStatus === "completed";
  const isCancelled =
    consultation.status === "cancel" || consultation.status === "missed";
  const isPaid =
    consultation.payment === true ||
    ["paid", "success", "succeeded", "captured"].includes(
      (consultation.paymentStatus || "").toLowerCase(),
    );
  const isActionable = ["pending", "confirmed", "rescheduled"].includes(
    consultation.status,
  );
  const needsPayment =
    isActionable && !isPaid && Number(consultation.amount || 0) > 0;

  const hasPrescription = Boolean(
    consultation.prescription ||
    consultation.diagnosis ||
    consultation.followUpAdvice ||
    (consultation.medicines && consultation.medicines.length > 0),
  );
  const doctorImage = getDoctorImage(consultation.doctor || undefined);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ---------------- Top Header Bar ---------------- */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/consultations")
          }
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Palette.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Online Consultation</Text>
          <Text style={styles.headerSubtitle}>
            {consultation.appointmentId || "Video Visit"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh status"
          onPress={() => load(true)}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="refresh" size={18} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
      >
        {/* ---------------- Doctor & Facility Card ---------------- */}
        <Card padded style={styles.doctorCard}>
          <View style={styles.doctorRow}>
            <Image
              source={{ uri: doctorImage }}
              style={styles.doctorAvatar}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.doctorBody}>
              <View style={styles.doctorTitleRow}>
                <Text style={styles.doctorName} numberOfLines={1}>
                  {doctorNameOf(consultation)}
                </Text>
                <Badge label={badge.label} variant={badge.variant} />
              </View>
              <Text style={styles.doctorSpecialty}>
                {doctorSpecialtyOf(consultation)}
              </Text>
              <View style={styles.hospitalRow}>
                <Ionicons
                  name="business-outline"
                  size={14}
                  color={Palette.textMuted}
                />
                <Text style={styles.doctorHospital} numberOfLines={1}>
                  {consultation.hospitalName || "HealPoint Online Care"}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Doctor Meta */}
          <View style={styles.doctorMetaStrip}>
            <View style={styles.metaItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.metaItemText}>
                {formatDDMMYYYY(consultation.slotDate || "")}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Palette.primary} />
              <Text style={styles.metaItemText}>
                {consultation.slotTime || "Scheduled"}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons
                name="videocam-outline"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.metaItemText}>
                {consultation.consultationMode === "instant"
                  ? "Instant"
                  : "Scheduled"}
              </Text>
            </View>
          </View>
        </Card>

        {/* ---------------- Waiting Room Status Strip ---------------- */}
        <Card padded style={styles.waitingCard}>
          <View style={styles.waitingState}>
            <View
              style={[
                styles.waitingIconWrap,
                isCompleted && { backgroundColor: "rgba(14, 159, 142, 0.12)" },
                isCancelled && { backgroundColor: "rgba(217, 67, 91, 0.12)" },
              ]}
            >
              <Ionicons
                name={
                  isCompleted
                    ? "checkmark-circle"
                    : isCancelled
                      ? "close-circle"
                      : consultStatus === "in_progress"
                        ? "pulse"
                        : "videocam"
                }
                size={24}
                color={
                  isCompleted
                    ? Palette.success
                    : isCancelled
                      ? Palette.error
                      : Palette.primary
                }
              />
            </View>
            <View style={styles.waitingStateTexts}>
              <Text style={styles.waitingStateTitle}>
                {isCancelled
                  ? "Consultation Cancelled"
                  : isCompleted
                    ? "Consultation Completed"
                    : consultationStatusLabel(consultStatus)}
              </Text>
              <Text style={styles.waitingStateSubtitle}>
                {isCancelled
                  ? "This video consultation was cancelled. No further action is required."
                  : isCompleted
                    ? "Consultation session has concluded. View prescription and doctor summary below."
                    : consultStatus === "in_progress"
                      ? "The doctor has started your appointment. Please tap Join Google Meet below."
                      : consultStatus === "doctor_ready" ||
                          consultStatus === "ready_to_join"
                        ? "The doctor is in the consultation room. Ready to begin."
                        : "Please wait in this room. Your doctor will generate the meeting link prior to the appointment."}
              </Text>
            </View>
          </View>
        </Card>

        {/* ---------------- Payment Warning if Required ---------------- */}
        {needsPayment ? (
          <Card padded style={styles.paymentWarningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="card-outline" size={20} color={Palette.warning} />
              <Text style={styles.warningTitle}>Payment Required</Text>
            </View>
            <Text style={styles.warningBody}>
              Online consultations require payment confirmation before unlocking
              the doctor&apos;s Google Meet video room.
            </Text>
            <Button
              title={`Pay Consultation Fee (${formatINR(consultation.amount)})`}
              icon="lock-closed"
              onPress={() => {
                if (!id) return;
                router.push({
                  pathname: "/payment/[appointmentId]",
                  params: { appointmentId: String(id) },
                });
              }}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : null}

        {/* ---------------- Google Meet Section ---------------- */}
        <Card padded style={styles.meetingCard}>
          <View style={styles.sectionHeading}>
            <Ionicons name="videocam" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Google Meet Consultation</Text>
          </View>

          <View style={styles.meetingBadges}>
            <Badge
              label={`Meeting: ${meetingStatusLabel(meetingStatus)}`}
              variant={meetingStatus === "not_created" ? "neutral" : "primary"}
            />
            <Badge
              label={`Status: ${consultationStatusLabel(consultStatus)}`}
              variant={consultStatus === "in_progress" ? "success" : "warning"}
            />
            <Badge label={pay.label} variant={pay.variant} />
          </View>

          {isCompleted ? (
            <View style={styles.completedNotice}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={Palette.primaryDark}
              />
              <Text style={styles.completedNoticeText}>
                This video consultation was successfully conducted. Review
                clinical findings and prescription details below.
              </Text>
            </View>
          ) : isCancelled ? (
            <View style={styles.cancelledNotice}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={Palette.error}
              />
              <Text style={styles.cancelledNoticeText}>
                This appointment was cancelled. The meeting link is no longer
                active.
              </Text>
            </View>
          ) : joinAllowed && consultation.meetingUrl ? (
            <View style={styles.meetingActions}>
              <Button
                title={
                  joining
                    ? "Connecting to Google Meet..."
                    : "Join Google Meet Consultation"
                }
                variant="primary"
                icon="videocam"
                loading={joining}
                disabled={joining}
                onPress={handleJoinMeeting}
              />
              <Text style={styles.meetingHint}>
                ✓ Verified Google Meet link shared by your attending physician.
                Microphone and camera permissions will be requested by Google
                Meet.
              </Text>
            </View>
          ) : (
            <View style={styles.meetingActions}>
              <Button
                title="Join Google Meet"
                variant="secondary"
                icon="videocam"
                disabled
                onPress={() => undefined}
              />
              <Text style={styles.meetingHint}>
                {joinReason ||
                  "Video meeting link is not ready yet. The doctor will share your verified Google Meet link prior to consultation time."}
              </Text>
            </View>
          )}

          {joinError ? <FormMessage type="error" message={joinError} /> : null}

          {joinSubscriptionRequired ? (
            <Button
              title="Upgrade Subscription Plan"
              variant="primary"
              icon="shield-checkmark"
              onPress={() => router.push("/subscription")}
              style={{ marginTop: Spacing.sm }}
            />
          ) : null}
        </Card>

        {/* ---------------- Care Journey Timeline ---------------- */}
        {consultation.careJourney ? (
          <JourneyTimeline journey={consultation.careJourney} />
        ) : null}

        {/* ---------------- Consultation Details ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={Palette.primary}
            />
            <Text style={styles.sectionTitle}>Appointment Details</Text>
          </View>
          <InfoRow label="Doctor" value={doctorNameOf(consultation)} />
          <InfoRow label="Speciality" value={doctorSpecialtyOf(consultation)} />
          <InfoRow
            label="Hospital / Clinic"
            value={consultation.hospitalName || "HealPoint Health"}
          />
          <InfoRow
            label="Consultation Date"
            value={formatDDMMYYYY(consultation.slotDate || "")}
          />
          <InfoRow
            label="Time Slot"
            value={consultation.slotTime || "Scheduled"}
          />
          <InfoRow
            label="Mode"
            value={
              consultation.consultationMode === "instant"
                ? "Instant Video Consultation"
                : "Scheduled Video Consultation"
            }
          />
          <InfoRow
            label="Booking Reference"
            value={consultation.appointmentId || consultation._id}
          />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Status</Text>
            <Badge label={pay.label} variant={pay.variant} />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Consultation Fee</Text>
            <Text style={styles.infoValue}>
              {formatINR(consultation.amount)}
            </Text>
          </View>
        </Card>

        {/* ---------------- Clinical Prescription & Notes ---------------- */}
        {hasPrescription ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>
                Clinical Notes & Prescription
              </Text>
            </View>

            {consultation.diagnosis ? (
              <View style={styles.clinicalBox}>
                <Text style={styles.clinicalLabel}>Primary Assessment</Text>
                <Text style={styles.clinicalValue}>
                  {consultation.diagnosis}
                </Text>
              </View>
            ) : null}

            {consultation.followUpAdvice ? (
              <View style={styles.clinicalBox}>
                <Text style={styles.clinicalLabel}>
                  Doctor Advice & Follow-up
                </Text>
                <Text style={styles.clinicalValue}>
                  {consultation.followUpAdvice}
                </Text>
              </View>
            ) : null}

            {consultation.medicines && consultation.medicines.length > 0 ? (
              <View style={styles.medicinesWrap}>
                <Text style={styles.clinicalLabel}>Prescribed Medicines</Text>
                {consultation.medicines.map((med, idx) => (
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

            <View style={styles.rxActions}>
              <Button
                title="View Prescriptions"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => router.push("/(drawer)/health/prescriptions")}
              />
              <Button
                title="Medical Records"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => router.push("/(drawer)/health/records")}
              />
            </View>
          </Card>
        ) : null}

        {/* ---------------- Patient Rating & Review Card ---------------- */}
        {isCompleted ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Ionicons
                name={consultation.isReviewed ? "checkmark-circle" : "star"}
                size={20}
                color={consultation.isReviewed ? Palette.primary : Palette.gold}
              />
              <Text style={styles.sectionTitle}>
                {consultation.isReviewed
                  ? "Consultation Reviewed"
                  : "Rate Your Online Consultation"}
              </Text>
            </View>
            <Text style={styles.reviewPromptText}>
              {consultation.isReviewed
                ? "You have already submitted verified feedback for this online consultation. Thank you for supporting healthcare excellence on HealPoint."
                : `How was your video consultation with ${doctorNameOf(consultation)}? Your honest rating guides other patients to the right care.`}
            </Text>
            {!consultation.isReviewed ? (
              <Button
                title="Rate & Review Consultation"
                variant="outline"
                icon="star-outline"
                onPress={() => setReviewModalVisible(true)}
                style={{ marginTop: Spacing.xs }}
              />
            ) : null}
          </Card>
        ) : null}

        {/* ---------------- Healthcare Disclaimer ---------------- */}
        {!isCancelled && !isCompleted ? (
          <Text style={styles.disclaimer}>
            Online consultations are suitable for initial assessments, second
            opinions, and non-emergency medical guidance. In an emergency,
            please visit the nearest hospital emergency room.
          </Text>
        ) : null}
      </ScrollView>

      {/* ---------------- Post-Consultation Review Modal ---------------- */}
      {consultation.doctor?._id ? (
        <ReviewModal
          visible={reviewModalVisible}
          doctorId={String(consultation.doctor._id)}
          doctorName={doctorNameOf(consultation)}
          appointmentId={String(consultation._id)}
          hospitalName={consultation.hospitalName}
          onClose={() => {
            setReviewModalVisible(false);
            load();
          }}
          onSuccess={() => {
            setReviewModalVisible(false);
            load();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  headerTitles: {
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
  doctorCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  doctorBody: {
    flex: 1,
    gap: 2,
  },
  doctorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  doctorName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  doctorHospital: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  doctorMetaStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaItemText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: Palette.border,
  },
  waitingCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  waitingState: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  waitingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  waitingStateTexts: {
    flex: 1,
    gap: 2,
  },
  waitingStateTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  waitingStateSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  paymentWarningCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.3)",
    backgroundColor: "rgba(254, 243, 199, 0.4)",
    gap: Spacing.xs,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  warningTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.warning,
  },
  warningBody: {
    ...Typography.caption,
    color: Palette.text,
    lineHeight: 18,
  },
  meetingCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
    backgroundColor: "rgba(226, 246, 242, 0.3)",
    ...Shadows.card,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
  meetingBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  meetingActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  meetingHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  completedNoticeText: {
    ...Typography.caption,
    color: Palette.text,
    flex: 1,
    lineHeight: 18,
  },
  cancelledNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(217, 67, 91, 0.08)",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(217, 67, 91, 0.2)",
  },
  cancelledNoticeText: {
    ...Typography.caption,
    color: Palette.error,
    flex: 1,
    lineHeight: 18,
  },
  sectionCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  journeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journeyTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  journeyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  journeyStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  journeyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDotDone: {
    backgroundColor: Palette.success,
    borderColor: Palette.success,
  },
  journeyDotCurrent: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  journeyDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  journeyLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  journeyLabelDone: {
    color: Palette.success,
    fontWeight: "600",
  },
  journeyLabelCurrent: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  infoValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
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
  medicinesWrap: {
    gap: Spacing.sm,
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
  rxActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  reviewPromptText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  disclaimer: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    lineHeight: 16,
  },
});
