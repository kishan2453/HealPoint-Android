/**
 * HealPoint - Patient Health Records & EMR Overview.
 *
 * Professional healthcare medical record summary aggregating real backend data:
 * consultations, clinical diagnoses, digital prescriptions, lab reports,
 * physician notes, and follow-up care.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
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
import type {
  Appointment,
  PatientDiagnosisItem,
  PatientFollowUpItem,
  PatientMedicalHistoryResponse,
  PatientReportItem,
} from "@/types";

type RecordTab =
  | "timeline"
  | "diagnoses"
  | "prescriptions"
  | "reports"
  | "followups";

export default function HealthRecordsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<PatientMedicalHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<RecordTab>("timeline");

  const loadRecords = async () => {
    setError("");
    try {
      const res = await appointmentService.getPatientMedicalHistory();
      setData(res);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load medical records."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useScreenFocus(loadRecords, 15_000);

  useEffect(() => {
    loadRecords();
  }, [user?._id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRecords();
  };

  const statusBadgeVariant = (status?: string): BadgeVariant => {
    switch (status) {
      case "completed":
        return "primary";
      case "confirmed":
        return "success";
      case "pending":
        return "warning";
      case "cancel":
        return "error";
      default:
        return "neutral";
    }
  };

  const consultations = data?.consultations || [];
  const prescriptions = data?.prescriptions || [];
  const reports = data?.reports || [];
  const diagnoses = data?.diagnoses || [];
  const followUps = data?.followUps || [];

  const timelineEvents = useMemo(() => {
    const events: {
      id: string;
      type: "visit" | "prescription" | "report" | "diagnosis" | "followup";
      title: string;
      subtitle: string;
      date: string;
      timestamp: number;
      badgeLabel: string;
      badgeVariant: BadgeVariant;
      icon: keyof typeof Ionicons.glyphMap;
      iconBg: string;
      iconColor: string;
      doctorName?: string;
      hospitalName?: string;
      details?: string;
      url?: string;
      routePath?: string;
      routeParams?: Record<string, string>;
      actionLabel?: string;
    }[] = [];

    const parseTime = (dateStr?: string, createdAt?: string): number => {
      if (createdAt) {
        const t = new Date(createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (!dateStr) return 0;
      const m = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(dateStr.trim());
      if (m) {
        const [, dd, mm, yyyy] = m;
        return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
      }
      const t = new Date(dateStr).getTime();
      return isNaN(t) ? 0 : t;
    };

    // 1. Past & current consultations
    for (const appt of consultations) {
      const docName = formatDoctorName(
        typeof appt.doctorId === "object" && appt.doctorId?.name
          ? appt.doctorId.name
          : appt.doctorName,
        "Consulting Physician",
      );
      const hospName =
        typeof appt.hospitalId === "object" && appt.hospitalId?.name
          ? appt.hospitalId.name
          : appt.hospitalName || "HealPoint Clinic";
      const time = parseTime(appt.slotDate || appt.date, appt.createdAt);

      events.push({
        id: `visit-${appt._id}`,
        type: "visit",
        title: `${docName} Consultation`,
        subtitle: `${hospName} • ${appt.consultationType === "video" ? "Video Consultation" : "In-Clinic Visit"}`,
        date: formatDDMMYYYY(appt.slotDate || appt.date || ""),
        timestamp: time,
        badgeLabel: appt.statusLabel || appt.status || "Visit",
        badgeVariant: statusBadgeVariant(appt.status),
        icon: appt.consultationType === "video" ? "videocam" : "calendar",
        iconBg: appt.consultationType === "video" ? "#F5F3FF" : "#EEF2FF",
        iconColor:
          appt.consultationType === "video" ? "#7C3AED" : Palette.primary,
        doctorName: docName,
        hospitalName: hospName,
        details: appt.diagnosis
          ? `Diagnosis: ${appt.diagnosis}`
          : appt.medicalNotes || undefined,
        routePath: "/appointment/[id]",
        routeParams: { id: appt._id },
        actionLabel: "View Visit Details",
      });
    }

    // 2. Prescriptions
    for (const p of prescriptions) {
      const docName = formatDoctorName(
        p.doctor?.name ||
          (typeof p.doctorId === "object" && p.doctorId?.name
            ? p.doctorId.name
            : null) ||
          p.doctorName,
        "Attending Doctor",
      );
      const hospName = p.hospitalName || "HealPoint Clinic";
      const time = parseTime(p.date || p.slotDate, p.createdAt);

      const medSummary =
        p.medicines && p.medicines.length > 0
          ? `${p.medicines.length} medication${p.medicines.length === 1 ? "" : "s"} prescribed`
          : p.prescription || "Digital prescription issued";

      events.push({
        id: `rx-${p._id}`,
        type: "prescription",
        title: `Prescription by ${docName}`,
        subtitle: `${hospName} • Clinical Medication Plan`,
        date: formatDDMMYYYY(p.date || p.slotDate || ""),
        timestamp: time,
        badgeLabel: "Prescription",
        badgeVariant: "success",
        icon: "medkit",
        iconBg: "#FEF3C7",
        iconColor: "#D97706",
        doctorName: docName,
        hospitalName: hospName,
        details: p.diagnosis
          ? `For: ${p.diagnosis} • ${medSummary}`
          : medSummary,
        routePath: "/(drawer)/health/prescriptions",
        actionLabel: "Open Prescription",
      });
    }

    // 3. Diagnostic Reports
    for (const r of reports) {
      const time = parseTime(r.date || r.uploadedAt, r.uploadedAt);
      events.push({
        id: `report-${r._id}`,
        type: "report",
        title: r.name || "Diagnostic Lab Report",
        subtitle: `${r.category || r.type || "Diagnostic Test"} • ${r.doctorName ? formatDoctorName(r.doctorName) : "Clinical Lab"}`,
        date: formatDDMMYYYY(r.date || r.uploadedAt || ""),
        timestamp: time,
        badgeLabel: "Lab Report",
        badgeVariant: "primary",
        icon: "document-text",
        iconBg: "#E0F2FE",
        iconColor: "#0284C7",
        doctorName: r.doctorName,
        details: r.notes || (r.filename ? `File: ${r.filename}` : undefined),
        url: r.url,
        routePath: "/health/reports",
        actionLabel: r.url ? "Open Document" : "View Lab Reports",
      });
    }

    // 4. Clinical Diagnoses
    for (let i = 0; i < diagnoses.length; i++) {
      const d = diagnoses[i];
      const time = parseTime(d.date);
      events.push({
        id: `diag-${i}-${d.appointmentId}`,
        type: "diagnosis",
        title: `Diagnosis: ${d.diagnosis}`,
        subtitle: `Recorded by ${formatDoctorName(d.doctorName, "Specialist")}`,
        date: formatDDMMYYYY(d.date),
        timestamp: time,
        badgeLabel: "Clinical Diagnosis",
        badgeVariant: "warning",
        icon: "pulse",
        iconBg: "#ECFDF5",
        iconColor: "#059669",
        doctorName: d.doctorName,
        routePath: "/appointment/[id]",
        routeParams: { id: d.appointmentId },
        actionLabel: "View Related Visit",
      });
    }

    // 5. Follow-ups
    for (let i = 0; i < followUps.length; i++) {
      const f = followUps[i];
      const time = parseTime(f.date);
      events.push({
        id: `fu-${i}-${f.appointmentId}`,
        type: "followup",
        title: `Follow-up Care Plan`,
        subtitle: `Advised by ${formatDoctorName(f.doctorName, "Specialist")}`,
        date: formatDDMMYYYY(f.date),
        timestamp: time,
        badgeLabel: "Follow-up",
        badgeVariant: "neutral",
        icon: "return-up-forward",
        iconBg: "#F0FDF4",
        iconColor: "#15803D",
        details: f.advice,
        doctorName: f.doctorName,
        routePath: "/appointment/[id]",
        routeParams: { id: f.appointmentId },
        actionLabel: "View Appointment",
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [consultations, prescriptions, reports, diagnoses, followUps]);

  const hasAnyRecord =
    consultations.length > 0 ||
    prescriptions.length > 0 ||
    reports.length > 0 ||
    diagnoses.length > 0 ||
    followUps.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Background Vector Art */}
      <View pointerEvents="none" style={styles.screenDecor}>
        <View style={styles.screenGlowTop} />
        <View style={styles.screenGlowBottom} />
        <View style={styles.screenCross}>
          <View style={styles.crossBarV} />
          <View style={styles.crossBarH} />
        </View>
      </View>

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton color={Palette.text} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Health Records</Text>
            <Text style={styles.subtitle}>Personal EMR & Clinical History</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh records"
            onPress={onRefresh}
            style={styles.headerActionBtn}
          >
            <Ionicons name="refresh" size={18} color={Palette.primary} />
          </Pressable>
        </View>
      </View>

      {loading && !refreshing ? (
        <Loading fullScreen label="Loading health records..." />
      ) : error ? (
        <ErrorState
          title="Records Unavailable"
          message={error}
          onRetry={loadRecords}
        />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Palette.primary]}
              tintColor={Palette.primary}
            />
          }
        >
          {/* Patient Header Identity Card */}
          <Card style={styles.patientCard}>
            <View style={styles.patientCardRow}>
              <View style={styles.patientIconCircle}>
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color={Palette.white}
                />
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>
                  {user?.name || "Verified Patient"}
                </Text>
                <Text style={styles.patientMeta}>
                  {user?.phone
                    ? `+91 ${user.phone}`
                    : user?.email || "Patient Profile"}
                </Text>
              </View>
              <Badge label="EMR Active" variant="primary" />
            </View>
          </Card>

          {/* Health Timeline Callout Banner */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Chronological Health Timeline"
            onPress={() => router.push("/health/timeline" as never)}
            style={({ pressed }) => [
              styles.timelineBanner,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.timelineBannerLeft}>
              <View style={styles.timelineBannerIconWrap}>
                <Ionicons name="time" size={20} color="#0284C7" />
              </View>
              <View style={styles.timelineBannerTexts}>
                <Text style={styles.timelineBannerTitle}>
                  Personal Health Timeline
                </Text>
                <Text style={styles.timelineBannerSub}>
                  Chronological care milestones & health history
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0284C7" />
          </Pressable>

          {/* Quick Metrics Strip */}
          <View style={styles.metricGrid}>
            <Pressable
              onPress={() => setActiveTab("timeline")}
              style={[
                styles.metricTile,
                activeTab === "timeline" && styles.metricTileActive,
              ]}
            >
              <Ionicons
                name="calendar"
                size={20}
                color={
                  activeTab === "timeline"
                    ? Palette.primaryDark
                    : Palette.primary
                }
              />
              <Text style={styles.metricNum}>{consultations.length}</Text>
              <Text style={styles.metricLabel}>Visits</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("prescriptions")}
              style={[
                styles.metricTile,
                activeTab === "prescriptions" && styles.metricTileActive,
              ]}
            >
              <Ionicons
                name="medkit"
                size={20}
                color={
                  activeTab === "prescriptions"
                    ? Palette.primaryDark
                    : Palette.accent
                }
              />
              <Text style={styles.metricNum}>{prescriptions.length}</Text>
              <Text style={styles.metricLabel}>Prescriptions</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("reports")}
              style={[
                styles.metricTile,
                activeTab === "reports" && styles.metricTileActive,
              ]}
            >
              <Ionicons
                name="document-text"
                size={20}
                color={
                  activeTab === "reports" ? Palette.primaryDark : "#4F46E5"
                }
              />
              <Text style={styles.metricNum}>{reports.length}</Text>
              <Text style={styles.metricLabel}>Reports</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("diagnoses")}
              style={[
                styles.metricTile,
                activeTab === "diagnoses" && styles.metricTileActive,
              ]}
            >
              <Ionicons
                name="pulse"
                size={20}
                color={
                  activeTab === "diagnoses" ? Palette.primaryDark : "#059669"
                }
              />
              <Text style={styles.metricNum}>{diagnoses.length}</Text>
              <Text style={styles.metricLabel}>Diagnoses</Text>
            </Pressable>
          </View>

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsTrack}
          >
            <Pressable
              onPress={() => setActiveTab("timeline")}
              style={[
                styles.tabPill,
                activeTab === "timeline" && styles.tabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "timeline" && styles.tabPillTextActive,
                ]}
              >
                Health Timeline ({timelineEvents.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("diagnoses")}
              style={[
                styles.tabPill,
                activeTab === "diagnoses" && styles.tabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "diagnoses" && styles.tabPillTextActive,
                ]}
              >
                Diagnoses ({diagnoses.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("prescriptions")}
              style={[
                styles.tabPill,
                activeTab === "prescriptions" && styles.tabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "prescriptions" && styles.tabPillTextActive,
                ]}
              >
                Prescriptions ({prescriptions.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("reports")}
              style={[
                styles.tabPill,
                activeTab === "reports" && styles.tabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "reports" && styles.tabPillTextActive,
                ]}
              >
                Reports ({reports.length})
              </Text>
            </Pressable>

            {followUps.length > 0 && (
              <Pressable
                onPress={() => setActiveTab("followups")}
                style={[
                  styles.tabPill,
                  activeTab === "followups" && styles.tabPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    activeTab === "followups" && styles.tabPillTextActive,
                  ]}
                >
                  Follow-ups ({followUps.length})
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {!hasAnyRecord ? (
            <EmptyState
              title="No Medical Records Yet"
              message="Your electronic medical record will automatically populate when you complete appointments, receive doctor prescriptions, or upload diagnostic reports."
              action={
                <Button
                  title="Book Consultation"
                  onPress={() => router.push("/doctors")}
                />
              }
            />
          ) : (
            <View style={styles.sectionBody}>
              {/* TAB: TIMELINE */}
              {activeTab === "timeline" && (
                <View style={styles.timelineList}>
                  {timelineEvents.length === 0 ? (
                    <EmptyState
                      title="No Health Events Recorded"
                      message="Your unified health timeline will automatically show past visits, prescriptions, lab reports, clinical diagnoses, and doctor follow-up advice."
                    />
                  ) : (
                    timelineEvents.map((ev) => (
                      <Card key={ev.id} style={styles.recordCard}>
                        <View style={styles.recordCardTop}>
                          <View
                            style={[
                              styles.eventIconCircle,
                              { backgroundColor: ev.iconBg },
                            ]}
                          >
                            <Ionicons
                              name={ev.icon}
                              size={18}
                              color={ev.iconColor}
                            />
                          </View>
                          <View style={styles.eventTitleWrap}>
                            <Text style={styles.doctorName} numberOfLines={1}>
                              {ev.title}
                            </Text>
                            <Text
                              style={styles.departmentName}
                              numberOfLines={1}
                            >
                              {ev.subtitle}
                            </Text>
                          </View>
                          <Badge
                            label={ev.badgeLabel}
                            variant={ev.badgeVariant}
                          />
                        </View>

                        <View style={styles.recordDateRow}>
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={Palette.textMuted}
                          />
                          <Text style={styles.recordDateText}>{ev.date}</Text>
                        </View>

                        {/* Details snippet if available */}
                        {ev.details ? (
                          <View style={styles.diagnosisSnippet}>
                            <Text style={styles.snippetLabel}>DETAILS</Text>
                            <Text style={styles.snippetValue} numberOfLines={3}>
                              {ev.details}
                            </Text>
                          </View>
                        ) : null}

                        {/* Action CTA */}
                        <View style={styles.cardFooter}>
                          <Button
                            title={ev.actionLabel || "View Details"}
                            variant="outline"
                            onPress={() => {
                              if (ev.url) {
                                Linking.openURL(ev.url).catch(() => {});
                              } else if (ev.routePath) {
                                if (ev.routeParams) {
                                  router.push({
                                    pathname: ev.routePath as any,
                                    params: ev.routeParams,
                                  });
                                } else {
                                  router.push(ev.routePath as any);
                                }
                              }
                            }}
                          />
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              )}

              {/* TAB: DIAGNOSES */}
              {activeTab === "diagnoses" && (
                <View style={styles.tabContent}>
                  {diagnoses.length === 0 ? (
                    <EmptyState
                      title="No Diagnoses On Record"
                      message="No medical conditions or clinical diagnoses have been formally recorded by your attending doctors."
                    />
                  ) : (
                    diagnoses.map((item, idx) => (
                      <Card
                        key={`${item.diagnosis}-${idx}`}
                        style={styles.diagnosisCard}
                      >
                        <View style={styles.diagnosisIconBox}>
                          <Ionicons
                            name="pulse-outline"
                            size={22}
                            color="#059669"
                          />
                        </View>
                        <View style={styles.diagnosisInfo}>
                          <Text style={styles.diagnosisTitle}>
                            {item.diagnosis}
                          </Text>
                          <Text style={styles.diagnosisMeta}>
                            Diagnosed by {item.doctorName || "Doctor"} on{" "}
                            {formatDDMMYYYY(item.date)}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Open visit for diagnosis"
                          onPress={() =>
                            router.push({
                              pathname: "/appointment/[id]",
                              params: { id: item.appointmentId },
                            })
                          }
                          style={styles.arrowIconBtn}
                        >
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={Palette.textMuted}
                          />
                        </Pressable>
                      </Card>
                    ))
                  )}
                </View>
              )}

              {/* TAB: PRESCRIPTIONS */}
              {activeTab === "prescriptions" && (
                <View style={styles.tabContent}>
                  {prescriptions.length === 0 ? (
                    <EmptyState
                      title="No Digital Prescriptions"
                      message="No medical prescriptions have been issued for your profile yet."
                      action={
                        <Button
                          title="Book Consultation"
                          onPress={() => router.push("/doctors")}
                        />
                      }
                    />
                  ) : (
                    prescriptions.map((p) => {
                      const docName =
                        p.doctor?.name ||
                        (typeof p.doctorId === "object" && p.doctorId?.name) ||
                        p.doctorName ||
                        "Attending Doctor";
                      const docSpec =
                        p.doctor?.speciality ||
                        (typeof p.doctorId === "object" &&
                          p.doctorId?.speciality) ||
                        p.doctorSpecialty ||
                        "Consultant";
                      return (
                        <Card key={p._id} style={styles.prescriptionCard}>
                          <View style={styles.recordCardTop}>
                            <View style={styles.rxIconBox}>
                              <Ionicons
                                name="medkit-outline"
                                size={20}
                                color={Palette.primary}
                              />
                            </View>
                            <View style={styles.eventTitleWrap}>
                              <Text style={styles.doctorName}>
                                {formatDoctorName(docName, "Attending Doctor")}
                              </Text>
                              <Text style={styles.departmentName}>
                                {docSpec} •{" "}
                                {p.hospitalName || "HealPoint Clinic"}
                              </Text>
                            </View>
                            <Badge label="Issued" variant="success" />
                          </View>

                          <Text style={styles.recordDateText}>
                            Date: {formatDDMMYYYY(p.date || "")}
                          </Text>

                          {p.diagnosis ? (
                            <View style={styles.diagnosisSnippet}>
                              <Text style={styles.snippetLabel}>
                                FOR CONDITION
                              </Text>
                              <Text style={styles.snippetValue}>
                                {p.diagnosis}
                              </Text>
                            </View>
                          ) : null}

                          {/* Medicines preview */}
                          {p.medicines && p.medicines.length > 0 ? (
                            <View style={styles.medicinesPreview}>
                              <Text style={styles.snippetLabel}>
                                MEDICATIONS ({p.medicines.length})
                              </Text>
                              {p.medicines.map((m, mIdx) => (
                                <View
                                  key={mIdx}
                                  style={styles.medicinePreviewRow}
                                >
                                  <Ionicons
                                    name="medical"
                                    size={13}
                                    color={Palette.primary}
                                  />
                                  <Text style={styles.medPreviewName}>
                                    {m.name}
                                  </Text>
                                  <Text style={styles.medPreviewDose}>
                                    {m.dosage ? `(${m.dosage})` : ""}{" "}
                                    {m.frequency || ""}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : p.prescription ? (
                            <View style={styles.notesSnippet}>
                              <Text style={styles.snippetLabel}>
                                PRESCRIPTION NOTES
                              </Text>
                              <Text
                                style={styles.snippetValue}
                                numberOfLines={3}
                              >
                                {p.prescription}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.cardFooter}>
                            <Button
                              title="Open Full Prescription"
                              onPress={() =>
                                router.push("/(drawer)/health/prescriptions")
                              }
                            />
                          </View>
                        </Card>
                      );
                    })
                  )}
                </View>
              )}

              {/* TAB: REPORTS */}
              {activeTab === "reports" && (
                <View style={styles.tabContent}>
                  {reports.length === 0 ? (
                    <EmptyState
                      title="No Diagnostic Reports"
                      message="No lab, radiology, or medical reports have been uploaded to your health profile."
                    />
                  ) : (
                    reports.map((rep) => (
                      <Card key={rep._id} style={styles.reportCard}>
                        <View style={styles.reportRow}>
                          <View style={styles.reportIconCircle}>
                            <Ionicons
                              name="document-text"
                              size={22}
                              color="#4F46E5"
                            />
                          </View>
                          <View style={styles.reportInfo}>
                            <Text style={styles.reportTitle} numberOfLines={1}>
                              {rep.name}
                            </Text>
                            <Text style={styles.reportMeta}>
                              {rep.type} •{" "}
                              {formatDDMMYYYY(rep.date || rep.uploadedAt || "")}
                            </Text>
                            <Text style={styles.reportDoctor}>
                              {rep.doctorName
                                ? formatDoctorName(rep.doctorName)
                                : "Clinical Lab"}
                            </Text>
                          </View>
                          <Button
                            title="Open"
                            variant="outline"
                            onPress={() => {
                              if (rep.url) {
                                Linking.openURL(rep.url).catch(() => {});
                              }
                            }}
                          />
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              )}

              {/* TAB: FOLLOWUPS */}
              {activeTab === "followups" && (
                <View style={styles.tabContent}>
                  {followUps.length === 0 ? (
                    <EmptyState
                      title="No Pending Follow-ups"
                      message="You do not have any pending doctor follow-up instructions."
                    />
                  ) : (
                    followUps.map((f, idx) => (
                      <Card key={idx} style={styles.followUpCard}>
                        <View style={styles.followUpIconCircle}>
                          <Ionicons
                            name="alarm-outline"
                            size={20}
                            color="#059669"
                          />
                        </View>
                        <View style={styles.followUpBody}>
                          <Text style={styles.followUpDoctor}>
                            {formatDoctorName(f.doctorName, "Specialist")}{" "}
                            Recommendation
                          </Text>
                          <Text style={styles.followUpAdvice}>{f.advice}</Text>
                          <Text style={styles.followUpDate}>
                            Advised on {formatDDMMYYYY(f.date)}
                          </Text>
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  screenGlowTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  screenGlowBottom: {
    position: "absolute",
    bottom: -150,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(20, 184, 166, 0.06)",
  },
  screenCross: {
    position: "absolute",
    top: 60,
    right: 24,
    width: 40,
    height: 40,
    opacity: 0.12,
  },
  crossBarV: {
    position: "absolute",
    left: 17,
    top: 0,
    width: 6,
    height: 40,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  crossBarH: {
    position: "absolute",
    top: 17,
    left: 0,
    height: 6,
    width: 40,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  patientCard: {
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  patientCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  patientIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  patientMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  metricGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricTile: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  metricTileActive: {
    borderColor: Palette.primary,
    backgroundColor: "rgba(14, 159, 142, 0.05)",
  },
  metricNum: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "800",
    marginTop: Spacing.xs,
  },
  metricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    marginTop: 2,
  },
  tabsScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  tabsTrack: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  tabPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabPillText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabPillTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  sectionBody: {
    gap: Spacing.md,
  },
  timelineList: {
    gap: Spacing.md,
  },
  recordCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  recordCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  eventIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  eventTitleWrap: {
    flex: 1,
  },
  doctorName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  departmentName: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  recordDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  recordDateText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  consultTypeTag: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  diagnosisSnippet: {
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  notesSnippet: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  snippetLabel: {
    ...Typography.caption,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: "800",
    color: Palette.primaryDark,
    marginBottom: 2,
  },
  snippetValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "500",
  },
  featureChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  featureChipText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  cardFooter: {
    marginTop: Spacing.sm,
  },
  tabContent: {
    gap: Spacing.md,
  },
  diagnosisCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  diagnosisIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  diagnosisInfo: {
    flex: 1,
  },
  diagnosisTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  diagnosisMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  arrowIconBtn: {
    padding: Spacing.xs,
  },
  prescriptionCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  rxIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  medicinesPreview: {
    backgroundColor: "rgba(14, 159, 142, 0.04)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  medicinePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  medPreviewName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  medPreviewDose: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  reportCard: {
    padding: Spacing.md,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  reportIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  reportMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  reportDoctor: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
    marginTop: 1,
  },
  followUpCard: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.md,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  followUpIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  followUpBody: {
    flex: 1,
    gap: 2,
  },
  followUpDoctor: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  followUpAdvice: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 18,
    marginTop: 2,
  },
  followUpDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
  },
  timelineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  timelineBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  timelineBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineBannerTexts: {
    flex: 1,
  },
  timelineBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0369A1",
  },
  timelineBannerSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
