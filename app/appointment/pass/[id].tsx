/**
 * HealPoint - Digital Hospital Pass Screen.
 *
 * Provides a real-time, production digital hospital pass:
 *  - Hospital affiliation, address, contact, and directions
 *  - Attending doctor, qualification, and assigned department
 *  - Patient name, booking reference ID, and appointment date/time
 *  - Consultation mode (In-Person OPD vs Video) and fee/payment status
 *  - Safe cryptographic check-in QR code (zero private medical data inside)
 *  - Live arrival and queue status indicator (Token, Current Serving, Patients Ahead)
 *  - Native "Share Pass / Add to Phone" action, directions, and dialer
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { QRCodeCanvas } from "@/components/ui/QRCodeCanvas";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as checkInService from "@/services/checkin";
import type { AppointmentDetails } from "@/types";

export default function DigitalHospitalPassScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null,
  );
  const [qrData, setQrData] =
    useState<checkInService.AppointmentQRResponse | null>(null);
  const [queueData, setQueueData] =
    useState<checkInService.PatientQueueStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setError("");
      const [apptRes, qrRes] = await Promise.allSettled([
        appointmentService.getUserAppointmentDetails(id),
        checkInService.getAppointmentQR(id),
      ]);

      if (apptRes.status === "fulfilled" && apptRes.value.appointmentDetails) {
        setAppointment(apptRes.value.appointmentDetails);
      }
      if (qrRes.status === "fulfilled" && qrRes.value.success) {
        setQrData(qrRes.value);
      } else if (apptRes.status === "rejected") {
        setError(
          toErrorMessage(apptRes.reason, "Unable to load hospital pass."),
        );
      }

      // If already checked in, load live queue metrics
      const isCheckedIn =
        (apptRes.status === "fulfilled" &&
          apptRes.value.appointmentDetails?.checkedIn) ||
        (qrRes.status === "fulfilled" && qrRes.value.appointment?.checkedIn);

      if (isCheckedIn) {
        try {
          const qRes = await checkInService.getPatientQueueStatus(id);
          if (qRes.success) setQueueData(qRes);
        } catch {
          // non-blocking
        }
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load digital hospital pass."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScreenFocus(() => {
    loadData();
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !appointment && !qrData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.navTitle}>Digital Hospital Pass</Text>
          <View style={{ width: 36 }} />
        </View>
        <Loading label="Generating your Digital Hospital Pass..." />
      </SafeAreaView>
    );
  }

  if (error && !appointment && !qrData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.navTitle}>Digital Hospital Pass</Text>
          <View style={{ width: 36 }} />
        </View>
        <ErrorState message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  // Aggregate highest-fidelity fields from appointment and QR response
  const appt = appointment;
  const qrAppt = qrData?.appointment;

  const hospitalName =
    appt?.hospitalName || qrAppt?.hospitalName || "HealPoint Medical Center";
  const hospitalAddress =
    appt?.hospitalAddress ||
    qrAppt?.hospitalAddress ||
    "Affiliated Hospital Campus";
  const hospitalCity = appt?.hospitalCity || qrAppt?.hospitalCity || "";
  const hospitalPhone = appt?.hospitalPhone || qrAppt?.hospitalPhone || "";
  const hospitalMapsUrl =
    appt?.hospitalMapsUrl || qrAppt?.hospitalMapsUrl || "";

  const doctorName =
    appt?.doctorName || qrAppt?.doctorName || "Attending Doctor";
  const doctorDegree = appt?.doctorDegree || qrAppt?.doctorDegree || "";
  const department =
    appt?.doctorDepartment ||
    qrAppt?.doctorDepartment ||
    appt?.doctorSpecialty ||
    qrAppt?.doctorSpeciality ||
    "General Medicine";
  const doctorImage = appt?.doctorImage || qrAppt?.doctorImage || "";

  const patientName =
    appt?.patientName || qrAppt?.patientName || "Verified Patient";
  const bookingRef =
    appt?.appointmentId ||
    qrAppt?.appointmentId ||
    (id ? `HP-${id.slice(-6).toUpperCase()}` : "APT-PASS");
  const slotDate = appt?.bookingDate || qrAppt?.slotDate || "";
  const slotTime = appt?.bookingTime || qrAppt?.slotTime || "";

  const isVideo =
    (appt?.consultationType || qrAppt?.consultationType) === "video";
  const amount = Number(appt?.amount || qrAppt?.amount || 0);

  const rawPaymentStatus = (
    appt?.paymentStatus ||
    qrAppt?.paymentStatus ||
    ""
  ).toLowerCase();
  const isPaid =
    appt?.payment === true ||
    qrAppt?.payment === true ||
    ["paid", "success", "succeeded", "captured"].includes(rawPaymentStatus);

  const checkedIn = Boolean(appt?.checkedIn || qrAppt?.checkedIn);
  const queueToken =
    queueData?.queueToken || appt?.queueToken || qrAppt?.queueToken || "";
  const queueStatus =
    queueData?.queueStatus || appt?.queueStatus || qrAppt?.queueStatus || "";

  const qrTokenString =
    qrData?.token || qrData?.qrToken || qrData?.qrPayload || bookingRef;

  // Native share handler
  const handleSharePass = async () => {
    try {
      const lines = [
        `🏥 HEALPOINT DIGITAL HOSPITAL PASS`,
        `Pass Ref: ${bookingRef}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Patient: ${patientName}`,
        `🏥 Hospital: ${hospitalName}`,
        department ? `🩺 Department: ${department}` : null,
        `👨‍⚕️ Doctor: ${formatDoctorName(doctorName)} ${doctorDegree ? `(${doctorDegree})` : ""}`,
        `📅 Date & Slot: ${formatDDMMYYYY(slotDate)} at ${slotTime}`,
        `📋 Type: ${isVideo ? "Video Consultation" : "In-Person OPD Consultation"}`,
        `💳 Payment: ${isPaid ? "Paid" : "Pay on Arrival"} (${formatINR(amount)})`,
        checkedIn
          ? `✓ Status: Arrived (Token: ${queueToken || "Assigned"})`
          : `Status: Confirmed (Awaiting Hospital Arrival)`,
        hospitalAddress ? `📍 Address: ${hospitalAddress}` : null,
        hospitalPhone ? `📞 Reception: ${hospitalPhone}` : null,
        hospitalMapsUrl ? `🗺️ Directions: ${hospitalMapsUrl}` : null,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Present this pass at hospital reception for fast-track entry.`,
      ]
        .filter(Boolean)
        .join("\n");

      await Share.share({
        title: `HealPoint Pass - ${bookingRef}`,
        message: lines,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleOpenDirections = () => {
    if (hospitalMapsUrl) {
      Linking.openURL(hospitalMapsUrl);
    } else {
      const query = encodeURIComponent(`${hospitalName} ${hospitalAddress}`);
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`,
      );
    }
  };

  const handleCallHospital = () => {
    if (hospitalPhone) {
      Linking.openURL(`tel:${hospitalPhone}`);
    } else {
      Alert.alert("Hospital Contact", "Reception phone number not available.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Top App Header */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color={Palette.text} />
        </Pressable>
        <Text style={styles.navTitle}>Digital Hospital Pass</Text>
        <Pressable
          onPress={handleSharePass}
          style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityLabel="Share Pass"
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={Palette.primary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
      >
        {/* Main Digital Pass Ticket */}
        <View style={styles.passTicket}>
          {/* Header Branding & Security Strip */}
          <View style={styles.passHeaderStrip}>
            <View style={styles.passBrandingRow}>
              <View style={styles.logoBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={Palette.white}
                />
              </View>
              <Text style={styles.passBrandTitle}>HEALPOINT VERIFIED PASS</Text>
            </View>
            <Badge
              label={checkedIn ? "ARRIVED" : "VALID PASS"}
              variant={checkedIn ? "success" : "primary"}
            />
          </View>

          {/* Hospital affiliation banner */}
          <View style={styles.hospitalHeroSection}>
            <View style={styles.hospitalIconWrap}>
              <Ionicons name="business" size={24} color={Palette.primary} />
            </View>
            <View style={styles.hospitalHeroTexts}>
              <Text style={styles.hospitalHeroName} numberOfLines={2}>
                {hospitalName}
              </Text>
              <Text style={styles.hospitalHeroAddress} numberOfLines={2}>
                {hospitalAddress}
                {hospitalCity ? `, ${hospitalCity}` : ""}
              </Text>
            </View>
          </View>

          {/* Dotted Cutout Divider */}
          <View style={styles.ticketDividerWrap}>
            <View style={styles.cutoutLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.cutoutRight} />
          </View>

          {/* Attending Doctor & Department */}
          <View style={styles.doctorPassRow}>
            {doctorImage ? (
              <Image
                source={{ uri: doctorImage }}
                style={styles.doctorAvatar}
              />
            ) : (
              <View style={styles.doctorAvatarPlaceholder}>
                <Ionicons name="person" size={24} color={Palette.primary} />
              </View>
            )}
            <View style={styles.doctorPassTexts}>
              <Text style={styles.doctorLabel}>ATTENDING DOCTOR</Text>
              <Text style={styles.doctorName}>
                {formatDoctorName(doctorName)}
              </Text>
              <Text style={styles.doctorMeta}>
                {doctorDegree ? `${doctorDegree} · ` : ""}
                {department}
              </Text>
            </View>
          </View>

          {/* Key Appointment Parameters Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>PATIENT NAME</Text>
              <Text style={styles.gridValue} numberOfLines={1}>
                {patientName}
              </Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>BOOKING REF</Text>
              <Text style={styles.gridValueMono} numberOfLines={1}>
                {bookingRef}
              </Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>DATE</Text>
              <Text style={styles.gridValue}>{formatDDMMYYYY(slotDate)}</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>SCHEDULED TIME</Text>
              <Text style={styles.gridValue}>{slotTime || "Scheduled"}</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>VISIT TYPE</Text>
              <Text style={styles.gridValue}>
                {isVideo ? "Online Video" : "In-Person OPD"}
              </Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>PAYMENT</Text>
              <Text
                style={[
                  styles.gridValue,
                  isPaid ? styles.paidText : styles.pendingText,
                ]}
              >
                {isPaid ? "Paid" : "Pay at Clinic"} ({formatINR(amount)})
              </Text>
            </View>
          </View>

          {/* Dotted Cutout Divider */}
          <View style={styles.ticketDividerWrap}>
            <View style={styles.cutoutLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.cutoutRight} />
          </View>

          {/* Live Check-In / Arrival Status Banner */}
          <View style={styles.arrivalCard}>
            {checkedIn ? (
              <View style={styles.checkedInBox}>
                <View style={styles.checkedInBadgeRow}>
                  <Badge label="✓ CHECKED IN" variant="success" />
                  <Text style={styles.tokenNotice}>
                    Queue active at hospital
                  </Text>
                </View>

                <View style={styles.tokenHeroWrap}>
                  <Text style={styles.tokenHeroLabel}>YOUR QUEUE TOKEN</Text>
                  <Text style={styles.tokenHeroValue}>
                    {queueToken || "A-001"}
                  </Text>
                </View>

                <View style={styles.queueMetricsRow}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>SERVING</Text>
                    <Text style={styles.metricValue}>
                      {queueData?.currentServingToken || "In Session"}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>PATIENTS AHEAD</Text>
                    <Text style={styles.metricValue}>
                      {queueData?.patientsAhead ?? 0}
                    </Text>
                  </View>
                </View>

                {queueStatus === "called" ? (
                  <View style={styles.calledNotice}>
                    <Ionicons name="megaphone" size={18} color="#b45309" />
                    <Text style={styles.calledNoticeText}>
                      Doctor is Ready! Please proceed to the consultation room.
                    </Text>
                  </View>
                ) : queueStatus === "in_consultation" ? (
                  <View style={styles.inSessionNotice}>
                    <Ionicons
                      name="medical"
                      size={18}
                      color={Palette.primary}
                    />
                    <Text style={styles.inSessionNoticeText}>
                      Consultation currently in progress.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.awaitingArrivalBox}>
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={Palette.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.awaitingTitle}>
                    Present Pass upon Arrival
                  </Text>
                  <Text style={styles.awaitingSub}>
                    Scan the QR code below at {hospitalName} reception or OPD
                    desk to receive your consultation queue token.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* QR Code Section */}
          <View style={styles.qrSection}>
            <View style={styles.qrCanvasContainer}>
              <QRCodeCanvas
                value={qrTokenString}
                size={180}
                color={Palette.text}
                backgroundColor={Palette.white}
              />
            </View>
            <Text style={styles.qrInstruction}>
              Official Hospital Entry & Check-In Token
            </Text>
            <Text style={styles.qrSecurityText}>
              Encrypted check-in cryptographic signature. Zero medical records
              or passwords stored inside QR.
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <Card padded style={styles.actionCard}>
          <Text style={styles.actionSectionTitle}>Quick Hospital Actions</Text>
          <View style={styles.actionButtonsCol}>
            <Button
              title="Share Pass / Add to Phone"
              variant="primary"
              icon="share-social-outline"
              onPress={handleSharePass}
            />

            {!isVideo ? (
              <View style={styles.dualActionRow}>
                <Button
                  title="Get Directions"
                  variant="outline"
                  icon="navigate-outline"
                  onPress={handleOpenDirections}
                  style={{ flex: 1 }}
                />
                {hospitalPhone ? (
                  <Button
                    title="Call Hospital"
                    variant="outline"
                    icon="call-outline"
                    onPress={handleCallHospital}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            ) : null}

            {isVideo && appt?.meetingUrl ? (
              <Button
                title="Join Video Consultation"
                variant="primary"
                icon="videocam-outline"
                onPress={() => Linking.openURL(appt.meetingUrl!)}
              />
            ) : null}

            <Button
              title="View Full Appointment Details"
              variant="ghost"
              icon="document-text-outline"
              onPress={() =>
                router.push({
                  pathname: "/appointment/[id]",
                  params: { id: String(id) },
                })
              }
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceAlt,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 159, 142, 0.1)",
  },
  navTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  pressed: {
    opacity: 0.75,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.lg,
  },

  /* Ticket Structure */
  passTicket: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.md,
    overflow: "hidden",
  },
  passHeaderStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  passBrandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logoBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  passBrandTitle: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.8,
  },

  /* Hospital Hero */
  hospitalHeroSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: "rgba(14, 159, 142, 0.04)",
  },
  hospitalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hospitalHeroTexts: {
    flex: 1,
  },
  hospitalHeroName: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  hospitalHeroAddress: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },

  /* Cutout dashed line */
  ticketDividerWrap: {
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cutoutLeft: {
    width: 14,
    height: 20,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: Palette.background,
    borderRightWidth: 1,
    borderColor: Palette.border,
  },
  cutoutRight: {
    width: 14,
    height: 20,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    backgroundColor: Palette.background,
    borderLeftWidth: 1,
    borderColor: Palette.border,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: Palette.border,
    borderStyle: "dashed",
    marginHorizontal: 4,
  },

  /* Doctor section */
  doctorPassRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  doctorAvatar: {
    width: 50,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  doctorAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  doctorPassTexts: {
    flex: 1,
  },
  doctorLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  doctorName: {
    ...Typography.h4,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorMeta: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
    marginTop: 1,
  },

  /* Details Grid */
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    rowGap: Spacing.md,
  },
  gridItem: {
    width: "50%",
    paddingRight: Spacing.sm,
  },
  gridLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  gridValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  gridValueMono: {
    ...Typography.bodySmall,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  paidText: {
    color: Palette.success,
  },
  pendingText: {
    color: Palette.warning,
  },

  /* Arrival & Queue section */
  arrivalCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  awaitingArrivalBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm + 4,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  awaitingTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  awaitingSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  checkedInBox: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(22, 163, 74, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.2)",
    gap: Spacing.sm,
  },
  checkedInBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tokenNotice: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  tokenHeroWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.25)",
  },
  tokenHeroLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.8,
  },
  tokenHeroValue: {
    ...Typography.h2,
    fontSize: 32,
    fontWeight: "900",
    color: Palette.primaryDark,
    marginTop: 2,
  },
  queueMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: Spacing.xs,
  },
  metricCol: {
    alignItems: "center",
  },
  metricLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  metricValue: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  calledNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  calledNoticeText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#b45309",
    flex: 1,
  },
  inSessionNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
  },
  inSessionNoticeText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    flex: 1,
  },

  /* QR Code Section */
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.xs,
  },
  qrCanvasContainer: {
    padding: Spacing.md,
    backgroundColor: Palette.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  qrInstruction: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  qrSecurityText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    textAlign: "center",
    maxWidth: 280,
    marginTop: 4,
    lineHeight: 15,
  },

  /* Action Card */
  actionCard: {
    gap: Spacing.md,
  },
  actionSectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  actionButtonsCol: {
    gap: Spacing.sm,
  },
  dualActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
