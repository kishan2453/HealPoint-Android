/**
 * HealPoint — Smart Follow-Up & Care Continuity Center.
 *
 * Provides patients with a unified view of doctor follow-up recommendations,
 * scheduled recovery visits, linked prescriptions, lab investigations, and
 * one-tap repeat appointment booking.
 * Driven 100% by authentic backend data (no mock/dummy records).
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as familyService from "@/services/family";
import * as clinicalHandoverService from "@/services/clinical-handover";
import type {
  ClinicalHandoverRecord,
  FamilyMember,
  FollowUpOverviewItem,
} from "@/types";

type TabFilter = "all" | "pending_booking" | "scheduled" | "completed";

const FILTER_TABS: {
  key: TabFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Plans", icon: "clipboard-outline" },
  {
    key: "pending_booking",
    label: "Action Due",
    icon: "alert-circle-outline",
  },
  { key: "scheduled", label: "Scheduled", icon: "calendar-outline" },
  {
    key: "completed",
    label: "Completed",
    icon: "checkmark-done-circle-outline",
  },
];

export default function FollowUpsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  const [followUps, setFollowUps] = useState<FollowUpOverviewItem[]>([]);
  const [handovers, setHandovers] = useState<ClinicalHandoverRecord[]>([]);
  const [centerMode, setCenterMode] = useState<"plans" | "handovers">("plans");
  const [respondingHandover, setRespondingHandover] =
    useState<ClinicalHandoverRecord | null>(null);
  const [respondDecision, setRespondDecision] = useState<
    "approved" | "declined" | null
  >(null);
  const [processingAuth, setProcessingAuth] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadFollowUps = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const queryParams = {
          familyMemberId:
            selectedMemberId === "all" ? undefined : selectedMemberId,
          status: activeTab === "all" ? undefined : activeTab,
        };

        const [response, handoverResponse] = await Promise.all([
          appointmentService.getPatientFollowUps(queryParams),
          clinicalHandoverService
            .getPatientHandovers({
              familyMemberId:
                selectedMemberId === "all" ? undefined : selectedMemberId,
            })
            .catch(() => null),
        ]);

        if (handoverResponse?.success) {
          setHandovers(handoverResponse.handovers || []);
        }

        if (response && response.success) {
          setFollowUps(response.followUps || []);
          if (
            response.patient?.familyMembers &&
            Array.isArray(response.patient.familyMembers)
          ) {
            setFamilyMembers(response.patient.familyMembers);
          }
        } else {
          // Graceful fallback to medical history if needed
          const history = await appointmentService.getPatientMedicalHistory();
          const mapped: FollowUpOverviewItem[] = (history.followUps || []).map(
            (item: any) => ({
              id: item.id || `followup-${item.appointmentId}`,
              appointmentId: item.appointmentId,
              displayAppointmentId:
                item.displayAppointmentId || item.appointmentId,
              doctorId: item.doctorId || "",
              doctorName: item.doctorName || "Doctor",
              doctorSpecialty: item.doctorSpecialty || "Specialist",
              hospitalName: item.hospitalName || "HealPoint Hospital",
              department: item.department || item.doctorSpecialty || "General",
              consultationType: item.consultationType || "clinic",
              originalVisitDate: item.originalVisitDate || item.date || "",
              originalVisitTime: item.originalVisitTime || "",
              originalStatus: "completed",
              patientName: user?.name || "Patient",
              patientRelationship: "Self",
              advice: item.advice || "Follow-up consultation recommended.",
              timeframe:
                item.recommendedTimeframe || item.timeframe || "As Advised",
              targetDate: item.recommendedTargetDate || item.targetDate,
              status: item.status || "pending_booking",
              statusLabel: item.statusLabel || "Follow-Up Advised",
              statusVariant: item.statusVariant || "warning",
              hasPrescription: Boolean(item.hasPrescription),
              medicinesCount: item.medicinesCount || 0,
              hasReports: Boolean(item.hasReports),
              reportsCount: item.reportsCount || 0,
              linkedAppointmentId: item.linkedAppointmentId,
              linkedAppointmentDate: item.linkedAppointmentDate,
              linkedAppointmentTime: item.linkedAppointmentTime,
            }),
          );
          setFollowUps(mapped);
        }
      } catch (err) {
        // Try fallback to medical history before showing error
        try {
          const history = await appointmentService.getPatientMedicalHistory();
          const mapped: FollowUpOverviewItem[] = (history.followUps || []).map(
            (item: any) => ({
              id: item.id || `followup-${item.appointmentId}`,
              appointmentId: item.appointmentId,
              displayAppointmentId:
                item.displayAppointmentId || item.appointmentId,
              doctorId: item.doctorId || "",
              doctorName: item.doctorName || "Doctor",
              doctorSpecialty: item.doctorSpecialty || "Specialist",
              hospitalName: item.hospitalName || "HealPoint Hospital",
              department: item.department || item.doctorSpecialty || "General",
              consultationType: item.consultationType || "clinic",
              originalVisitDate: item.originalVisitDate || item.date || "",
              originalVisitTime: item.originalVisitTime || "",
              originalStatus: "completed",
              patientName: user?.name || "Patient",
              patientRelationship: "Self",
              advice: item.advice || "Follow-up consultation recommended.",
              timeframe:
                item.recommendedTimeframe || item.timeframe || "As Advised",
              targetDate: item.recommendedTargetDate || item.targetDate,
              status: item.status || "pending_booking",
              statusLabel: item.statusLabel || "Follow-Up Advised",
              statusVariant: item.statusVariant || "warning",
              hasPrescription: Boolean(item.hasPrescription),
              medicinesCount: item.medicinesCount || 0,
              hasReports: Boolean(item.hasReports),
              reportsCount: item.reportsCount || 0,
              linkedAppointmentId: item.linkedAppointmentId,
              linkedAppointmentDate: item.linkedAppointmentDate,
              linkedAppointmentTime: item.linkedAppointmentTime,
            }),
          );
          setFollowUps(mapped);
        } catch {
          setError(
            toErrorMessage(
              err,
              "Unable to load follow-up & care continuity plans.",
            ),
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMemberId, activeTab, user?.name],
  );

  useScreenFocus(loadFollowUps);

  useEffect(() => {
    loadFollowUps();
  }, [userId, selectedMemberId, activeTab, loadFollowUps]);

  // Load family members on initial render if user exists
  useEffect(() => {
    if (!userId) return;
    familyService
      .getFamilyMembers(userId)
      .then((members) => {
        if (Array.isArray(members) && members.length > 0) {
          setFamilyMembers(members);
        }
      })
      .catch(() => {});
  }, [userId]);

  const onRefresh = () => {
    loadFollowUps(true);
  };

  const filteredItems = useMemo(() => {
    let list = followUps;
    if (activeTab !== "all") {
      list = list.filter((item) => item.status === activeTab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          (item.doctorName || "").toLowerCase().includes(q) ||
          (item.doctorSpecialty || "").toLowerCase().includes(q) ||
          (item.hospitalName || "").toLowerCase().includes(q) ||
          (item.advice || "").toLowerCase().includes(q) ||
          (item.patientName || "").toLowerCase().includes(q) ||
          (item.diagnosis || "").toLowerCase().includes(q) ||
          (item.displayAppointmentId &&
            item.displayAppointmentId.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [followUps, activeTab, search]);

  const stats = useMemo(() => {
    const total = followUps.length;
    const pending = followUps.filter(
      (f) => f.status === "pending_booking",
    ).length;
    const scheduled = followUps.filter((f) => f.status === "scheduled").length;
    const completed = followUps.filter((f) => f.status === "completed").length;
    return { total, pending, scheduled, completed };
  }, [followUps]);

  const handleBookFollowUp = (item: FollowUpOverviewItem) => {
    if (!item.doctorId) {
      router.push("/(drawer)/doctors" as never);
      return;
    }

    // Video consultation quota alert
    if (item.consultationType === "video" && !item.videoQuotaAvailable) {
      Alert.alert(
        "Video Consultation Benefit",
        "Video follow-ups require an active HealPoint Plus or Family subscription plan. You can book an In-Clinic visit or upgrade your plan.",
        [
          {
            text: "Book Clinic Visit",
            onPress: () => {
              router.push({
                pathname: "/booking/[doctorId]",
                params: {
                  doctorId: item.doctorId,
                  type: "clinic",
                  previousAppointmentId: item.appointmentId,
                  memberId: item.familyMemberId || undefined,
                  source: "rebook",
                },
              });
            },
          },
          {
            text: "View Plans",
            onPress: () => {
              router.push("/(drawer)/subscription");
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }

    router.push({
      pathname: "/booking/[doctorId]",
      params: {
        doctorId: item.doctorId,
        type: item.consultationType || "clinic",
        previousAppointmentId: item.appointmentId,
        memberId: item.familyMemberId || undefined,
        source: "rebook",
      },
    });
  };

  const handleAuthorizeHandover = async (
    handoverId: string,
    decision: "approved" | "declined",
  ) => {
    try {
      setProcessingAuth(true);
      const res =
        await clinicalHandoverService.respondPatientHandoverAuthorization(
          handoverId,
          {
            decision,
            rejectionReason:
              decision === "declined"
                ? "Patient declined care transfer."
                : undefined,
          },
        );
      if (res?.success) {
        Alert.alert(
          decision === "approved"
            ? "Care Transfer Authorized"
            : "Care Transfer Declined",
          decision === "approved"
            ? "Your receiving physician now has verified access to continue your treatment plan."
            : "The care transfer has been declined.",
        );
        setRespondingHandover(null);
        setRespondDecision(null);
        await loadFollowUps(true);
      }
    } catch (err) {
      Alert.alert(
        "Authorization Failed",
        toErrorMessage(err, "Failed to update care transfer authorization."),
      );
    } finally {
      setProcessingAuth(false);
    }
  };

  const renderHandoverItem = ({ item }: { item: ClinicalHandoverRecord }) => {
    const origDoctor = item.originatingDoctorId as unknown as {
      name?: string;
      speciality?: string;
    };
    const recvDoctor = item.receivingDoctorId as unknown as {
      name?: string;
      speciality?: string;
    };

    const isPendingAuth = item.patientAuthorization?.status === "pending";

    const getStatusVariant = (st: string): BadgeVariant => {
      switch (st) {
        case "accepted":
          return "success";
        case "sent":
        case "in_review":
          return "warning";
        case "completed":
          return "primary";
        case "pending_patient_authorization":
          return "warning";
        case "declined":
        case "cancelled":
          return "error";
        default:
          return "neutral";
      }
    };

    const handoverDisplayId =
      item.handoverDisplayId ||
      (item._id ? `HND-${item._id.slice(-6).toUpperCase()}` : "HND-RECORD");
    const handoverTypeLabel = (item.handoverType || "care_transfer")
      .replace(/_/g, " ")
      .toUpperCase();
    const handoverStatusLabel = (item.status || "active")
      .replace(/_/g, " ")
      .toUpperCase();

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.handoverIdText}>{handoverDisplayId}</Text>
            <Text style={styles.handoverTypeText}>{handoverTypeLabel}</Text>
          </View>
          <Badge
            label={handoverStatusLabel}
            variant={getStatusVariant(item.status)}
          />
        </View>

        {/* Transfer Path */}
        <View style={styles.handoverTransferPath}>
          <View style={{ flex: 1 }}>
            <Text style={styles.transferRole}>From Clinician</Text>
            <Text style={styles.transferDoctorName}>
              Dr. {origDoctor?.name || "Doctor"}
            </Text>
            {origDoctor?.speciality ? (
              <Text style={styles.transferSpeciality}>
                {origDoctor.speciality}
              </Text>
            ) : null}
          </View>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={Palette.accent}
            style={{ marginHorizontal: 8 }}
          />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.transferRole}>To Destination</Text>
            <Text style={styles.transferDoctorName}>
              {recvDoctor?.name
                ? `Dr. ${recvDoctor.name}`
                : item.toDepartment
                  ? `Dept: ${item.toDepartment}`
                  : "Pending Assignment"}
            </Text>
            {recvDoctor?.speciality ? (
              <Text style={styles.transferSpeciality}>
                {recvDoctor.speciality}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Reason & Clinical Summary */}
        <View style={{ marginTop: 8 }}>
          <Text style={styles.handoverLabel}>Clinical Reason:</Text>
          <Text style={styles.handoverValue}>
            {item.reasonForHandover || item.reason}
          </Text>
        </View>

        {item.clinicalSummary ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.handoverLabel}>Summary & Instructions:</Text>
            <Text style={styles.handoverValue}>{item.clinicalSummary}</Text>
          </View>
        ) : null}

        {/* Transferred Items */}
        <View style={styles.contextPillsRow}>
          {item.sharedContext?.includeConsultationNotes && (
            <View style={styles.contextPill}>
              <Ionicons
                name="document-text-outline"
                size={12}
                color={Palette.primary}
              />
              <Text style={styles.contextPillText}>Notes</Text>
            </View>
          )}
          {item.sharedContext?.includePrescriptions && (
            <View style={styles.contextPill}>
              <Ionicons
                name="medkit-outline"
                size={12}
                color={Palette.success}
              />
              <Text style={styles.contextPillText}>Prescriptions</Text>
            </View>
          )}
          {item.sharedContext?.includeReports && (
            <View style={styles.contextPill}>
              <Ionicons
                name="folder-outline"
                size={12}
                color={Palette.accent}
              />
              <Text style={styles.contextPillText}>Reports</Text>
            </View>
          )}
          {item.sharedContext?.includeVitals && (
            <View style={styles.contextPill}>
              <Ionicons name="heart-outline" size={12} color={Palette.error} />
              <Text style={styles.contextPillText}>Vitals</Text>
            </View>
          )}
          {item.sharedContext?.includeFollowUpPlan && (
            <View style={styles.contextPill}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={Palette.warning}
              />
              <Text style={styles.contextPillText}>Follow-Up</Text>
            </View>
          )}
        </View>

        {/* Authorization Action Banner */}
        {isPendingAuth ? (
          <View style={styles.patientAuthPromptBox}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={Palette.warning}
              />
              <Text style={styles.patientAuthPromptTitle}>
                Your Authorization Required
              </Text>
            </View>
            <Text style={styles.patientAuthPromptText}>
              Dr. {origDoctor?.name || "Your doctor"} has initiated a care
              handover to Dr.{" "}
              {recvDoctor?.name ||
                item.toDepartment ||
                "the receiving specialist"}
              . Please authorize or decline this transfer.
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button
                title="Authorize Transfer"
                variant="primary"
                fullWidth={false}
                loading={
                  processingAuth &&
                  respondingHandover?._id === item._id &&
                  respondDecision === "approved"
                }
                onPress={() => {
                  setRespondingHandover(item);
                  setRespondDecision("approved");
                  handleAuthorizeHandover(item._id, "approved");
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Decline"
                variant="outline"
                fullWidth={false}
                loading={
                  processingAuth &&
                  respondingHandover?._id === item._id &&
                  respondDecision === "declined"
                }
                onPress={() => {
                  setRespondingHandover(item);
                  setRespondDecision("declined");
                  handleAuthorizeHandover(item._id, "declined");
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : item.patientAuthorization?.status === "approved" ? (
          <View style={styles.authorizedStatusBadge}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={Palette.success}
            />
            <Text style={styles.authorizedStatusText}>
              You authorized this care transfer
            </Text>
          </View>
        ) : item.patientAuthorization?.status === "declined" ? (
          <View style={styles.declinedStatusBadge}>
            <Ionicons name="close-circle" size={14} color={Palette.error} />
            <Text style={styles.declinedStatusText}>
              Care transfer was declined by you
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderItem = ({ item }: { item: FollowUpOverviewItem }) => {
    const isDue = item.status === "pending_booking";
    const isScheduled = item.status === "scheduled";
    const doctorImg = getDoctorImage(
      item.doctorId ? { _id: item.doctorId, name: item.doctorName } : undefined,
    );

    const badgeVariant: BadgeVariant =
      item.statusVariant === "warning"
        ? "warning"
        : item.statusVariant === "success"
          ? "success"
          : item.statusVariant === "primary"
            ? "primary"
            : "neutral";

    const timeframe = item.timeframe;
    const isFamily =
      Boolean(item.familyMemberId) ||
      (item.patientRelationship && item.patientRelationship !== "Self");

    return (
      <Card style={styles.card}>
        {/* Header with doctor & status */}
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: doctorImg }}
            style={styles.doctorAvatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {formatDoctorName(item.doctorName, "Doctor")}
            </Text>
            {item.doctorSpecialty ? (
              <Text style={styles.doctorSpecialty} numberOfLines={1}>
                {item.doctorSpecialty}
              </Text>
            ) : null}
            {item.hospitalName ? (
              <View style={styles.hospitalRow}>
                <Ionicons
                  name="business-outline"
                  size={13}
                  color={Palette.textMuted}
                />
                <Text style={styles.hospitalText} numberOfLines={1}>
                  {item.hospitalName}
                </Text>
              </View>
            ) : null}
          </View>
          <Badge label={item.statusLabel || "Plan"} variant={badgeVariant} />
        </View>

        {/* Patient tag & Consultation Mode badge */}
        <View style={styles.patientTagRow}>
          <View
            style={[
              styles.patientChipTag,
              isFamily && styles.patientChipTagFamily,
            ]}
          >
            <Ionicons
              name={isFamily ? "people-outline" : "person-outline"}
              size={12}
              color={isFamily ? "#7C3AED" : Palette.primary}
            />
            <Text
              style={[
                styles.patientChipTagText,
                isFamily && { color: "#7C3AED" },
              ]}
              numberOfLines={1}
            >
              Patient: {item.patientName || "Self"}
              {item.patientRelationship && item.patientRelationship !== "Self"
                ? ` (${item.patientRelationship})`
                : ""}
            </Text>
          </View>

          <View style={styles.typeBadge}>
            <Ionicons
              name={
                item.consultationType === "video"
                  ? "videocam-outline"
                  : "location-outline"
              }
              size={12}
              color={Palette.textMuted}
            />
            <Text style={styles.typeBadgeText}>
              {item.consultationType === "video" ? "Video" : "In-Clinic"}
            </Text>
          </View>
        </View>

        {/* Clinical Advice Callout */}
        <View
          style={[
            styles.adviceContainer,
            isDue && styles.adviceContainerDue,
            isScheduled && styles.adviceContainerScheduled,
          ]}
        >
          <View style={styles.adviceHeaderRow}>
            <Ionicons
              name={isDue ? "calendar-outline" : "chatbox-ellipses-outline"}
              size={16}
              color={isDue ? "#D97706" : Palette.primary}
            />
            <Text
              style={[
                styles.adviceHeaderTitle,
                { color: isDue ? "#92400E" : Palette.primaryDark },
              ]}
            >
              {"Doctor's Follow-Up Advice & Plan"}
            </Text>
          </View>
          <Text style={styles.adviceText}>{item.advice}</Text>

          <View style={styles.timeframeRow}>
            {timeframe ? (
              <View style={styles.timeframeSubItem}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={Palette.textMuted}
                />
                <Text style={styles.timeframeText}>
                  Advised timeframe:{" "}
                  <Text style={styles.timeframeBold}>{timeframe}</Text>
                </Text>
              </View>
            ) : null}

            {item.targetDate ? (
              <View style={styles.timeframeSubItem}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={Palette.textMuted}
                />
                <Text style={styles.timeframeText}>
                  Target review:{" "}
                  <Text style={styles.timeframeBold}>
                    {formatDDMMYYYY(item.targetDate)}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Meta / Details Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={Palette.textMuted}
            />
            <Text style={styles.metaText}>
              Visit: {formatDDMMYYYY(item.originalVisitDate)}
            </Text>
          </View>
          {item.displayAppointmentId ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="receipt-outline"
                size={13}
                color={Palette.textMuted}
              />
              <Text style={styles.metaText}>{item.displayAppointmentId}</Text>
            </View>
          ) : null}
        </View>

        {/* Connected items: Prescription, Reports, Diagnosis */}
        <View style={styles.pillsRow}>
          {item.hasPrescription ? (
            <Pressable
              style={styles.pill}
              onPress={() => router.push("/health/prescriptions")}
            >
              <Ionicons
                name="document-text"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.pillText}>
                Prescription{" "}
                {item.medicinesCount ? `(${item.medicinesCount} meds)` : ""}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={Palette.primary}
              />
            </Pressable>
          ) : null}

          {item.hasReports ? (
            <Pressable
              style={styles.pill}
              onPress={() => router.push("/health/reports")}
            >
              <Ionicons name="bar-chart" size={14} color="#7C3AED" />
              <Text style={[styles.pillText, { color: "#7C3AED" }]}>
                Lab Reports {item.reportsCount ? `(${item.reportsCount})` : ""}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#7C3AED" />
            </Pressable>
          ) : null}

          {item.diagnosis ? (
            <View style={[styles.pill, styles.pillDiagnosis]}>
              <Ionicons
                name="medkit-outline"
                size={13}
                color={Palette.textMuted}
              />
              <Text style={styles.pillDiagnosisText} numberOfLines={1}>
                {item.diagnosis}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Scheduled appointment note if already booked */}
        {isScheduled && item.linkedAppointmentDate ? (
          <Pressable
            style={styles.scheduledBanner}
            onPress={() => {
              if (item.linkedAppointmentId) {
                router.push(`/appointment/${item.linkedAppointmentId}`);
              }
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.scheduledBannerTitle}>
                Follow-up visit confirmed & scheduled
              </Text>
              <Text style={styles.scheduledBannerSub}>
                Slot: {item.linkedAppointmentDate}{" "}
                {item.linkedAppointmentTime
                  ? `at ${item.linkedAppointmentTime}`
                  : ""}
                {item.linkedDisplayAppointmentId
                  ? ` • ${item.linkedDisplayAppointmentId}`
                  : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#059669" />
          </Pressable>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            title="Original Visit"
            variant="outline"
            style={styles.actionBtnOutline}
            onPress={() => router.push(`/appointment/${item.appointmentId}`)}
          />

          {isDue ? (
            <Button
              title="Book Follow-Up"
              variant="primary"
              icon="calendar"
              style={styles.actionBtnPrimary}
              onPress={() => handleBookFollowUp(item)}
            />
          ) : isScheduled && item.linkedAppointmentId ? (
            <Button
              title="View Next Visit"
              variant="primary"
              icon="arrow-forward"
              style={styles.actionBtnPrimary}
              onPress={() =>
                router.push(`/appointment/${item.linkedAppointmentId}`)
              }
            />
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <DrawerToggleButton style={styles.menuBtn} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Care Continuity Center</Text>
          <Text style={styles.headerSubtitle}>
            Doctor follow-up recommendations & continuous care
          </Text>
        </View>
      </View>

      {/* Quick Access Vault Bar */}
      <View style={styles.vaultBar}>
        <Pressable
          style={styles.vaultBarBtn}
          onPress={() => router.push("/(drawer)/health-wallet" as never)}
        >
          <Ionicons name="wallet-outline" size={14} color={Palette.primary} />
          <Text style={styles.vaultBarBtnText}>Health Wallet</Text>
        </Pressable>
        <View style={styles.vaultBarDivider} />
        <Pressable
          style={styles.vaultBarBtn}
          onPress={() => router.push("/health/timeline")}
        >
          <Ionicons name="git-branch-outline" size={14} color="#7C3AED" />
          <Text style={[styles.vaultBarBtnText, { color: "#7C3AED" }]}>
            Timeline
          </Text>
        </Pressable>
        <View style={styles.vaultBarDivider} />
        <Pressable
          style={styles.vaultBarBtn}
          onPress={() => router.push("/health/records")}
        >
          <Ionicons name="folder-outline" size={14} color="#059669" />
          <Text style={[styles.vaultBarBtnText, { color: "#059669" }]}>
            Records
          </Text>
        </Pressable>
      </View>

      {/* Mode Switcher: Follow-Up Plans vs Care Continuity Transfers */}
      <View style={styles.centerModeRow}>
        <Pressable
          style={[
            styles.centerModeBtn,
            centerMode === "plans" && styles.centerModeBtnActive,
          ]}
          onPress={() => setCenterMode("plans")}
        >
          <Ionicons
            name="calendar"
            size={14}
            color={
              centerMode === "plans" ? Palette.primaryDark : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.centerModeBtnText,
              centerMode === "plans" && styles.centerModeBtnTextActive,
            ]}
          >
            Follow-Up Plans ({followUps.length})
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.centerModeBtn,
            centerMode === "handovers" && styles.centerModeBtnActive,
          ]}
          onPress={() => setCenterMode("handovers")}
        >
          <Ionicons
            name="swap-horizontal"
            size={14}
            color={
              centerMode === "handovers"
                ? Palette.primaryDark
                : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.centerModeBtnText,
              centerMode === "handovers" && styles.centerModeBtnTextActive,
            ]}
          >
            Care Transfers ({handovers.length})
          </Text>
        </Pressable>
      </View>

      {/* Family Member Isolation Selector */}
      {familyMembers.length > 0 ? (
        <View style={styles.familySection}>
          <Text style={styles.familySectionLabel}>Filter By Patient:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.familyScrollContent}
          >
            <Pressable
              style={[
                styles.familyChip,
                selectedMemberId === "all" && styles.familyChipActive,
              ]}
              onPress={() => setSelectedMemberId("all")}
            >
              <Ionicons
                name="people"
                size={13}
                color={
                  selectedMemberId === "all" ? Palette.white : Palette.primary
                }
              />
              <Text
                style={[
                  styles.familyChipText,
                  selectedMemberId === "all" && styles.familyChipTextActive,
                ]}
              >
                All Patients
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.familyChip,
                selectedMemberId === "self" && styles.familyChipActive,
              ]}
              onPress={() => setSelectedMemberId("self")}
            >
              <Ionicons
                name="person"
                size={13}
                color={
                  selectedMemberId === "self" ? Palette.white : Palette.primary
                }
              />
              <Text
                style={[
                  styles.familyChipText,
                  selectedMemberId === "self" && styles.familyChipTextActive,
                ]}
              >
                Self ({user?.name || "Patient"})
              </Text>
            </Pressable>

            {familyMembers.map((member) => {
              const isSelected = selectedMemberId === member._id;
              return (
                <Pressable
                  key={member._id}
                  style={[
                    styles.familyChip,
                    isSelected && styles.familyChipActive,
                  ]}
                  onPress={() => setSelectedMemberId(member._id)}
                >
                  <Ionicons
                    name="person-outline"
                    size={13}
                    color={isSelected ? Palette.white : Palette.text}
                  />
                  <Text
                    style={[
                      styles.familyChipText,
                      isSelected && styles.familyChipTextActive,
                    ]}
                  >
                    {member.name} ({member.relationship})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {centerMode === "plans" && (
        <>
          {/* KPI Stats Strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total Plans</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#D97706" }]}>
                {stats.pending}
              </Text>
              <Text style={styles.statLabel}>Action Due</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: "#059669" }]}>
                {stats.scheduled}
              </Text>
              <Text style={styles.statLabel}>Scheduled</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Palette.textMuted }]}>
                {stats.completed}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by doctor, diagnosis, advice or patient..."
                placeholderTextColor={Palette.textMuted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Palette.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Tab Filter Strip */}
          <View style={styles.tabBar}>
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={isActive ? Palette.primary : Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      isActive && styles.tabBtnTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Body Content */}
      {loading ? (
        <Loading label="Loading care continuity & follow-up recommendations..." />
      ) : error ? (
        <ErrorState
          title="Couldn't load care continuity data"
          message={error}
          onRetry={() => loadFollowUps(false)}
        />
      ) : centerMode === "plans" ? (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.appointmentId}
          renderItem={renderItem}
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
              title={
                activeTab === "pending_booking"
                  ? "No Action Due"
                  : activeTab === "scheduled"
                    ? "No Scheduled Follow-Ups"
                    : activeTab === "completed"
                      ? "No Completed Follow-Ups"
                      : "No Care Plans Yet"
              }
              message={
                activeTab === "pending_booking"
                  ? "You have no outstanding follow-up visits requiring booking right now."
                  : activeTab === "scheduled"
                    ? "No follow-up visits are currently scheduled on your calendar."
                    : "When your doctor recommends a follow-up visit or clinical care plan, it will appear here with instant one-tap booking and linked prescriptions."
              }
              action={
                activeTab !== "all" ? (
                  <Button
                    title="View All Plans"
                    variant="outline"
                    onPress={() => setActiveTab("all")}
                  />
                ) : undefined
              }
            />
          }
        />
      ) : (
        <FlatList
          data={handovers}
          keyExtractor={(item) => item._id}
          renderItem={renderHandoverItem}
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
              title="No Care Transfers Found"
              message="When your physician transfers responsibility for your treatment or initiates an inter-departmental handover, it will appear here for your review and authorization."
            />
          }
        />
      )}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  menuBtn: {
    marginRight: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  vaultBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    justifyContent: "space-around",
  },
  vaultBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  vaultBarBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
    fontSize: 12,
  },
  vaultBarDivider: {
    width: 1,
    height: 16,
    backgroundColor: Palette.border,
  },
  familySection: {
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  familySectionLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "600",
  },
  familyScrollContent: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingBottom: 4,
  },
  familyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  familyChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  familyChipText: {
    ...Typography.caption,
    color: Palette.text,
    fontSize: 12,
    fontWeight: "500",
  },
  familyChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    ...Typography.h3,
    color: Palette.primary,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Palette.background,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
    fontSize: 14,
    padding: 0,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBtnActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  tabBtnText: {
    ...Typography.caption,
    fontWeight: "500",
    color: Palette.textMuted,
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: Palette.primary,
    fontWeight: "600",
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.surfaceAlt,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  hospitalText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    flex: 1,
  },
  patientTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  patientChipTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surfaceAlt,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
  },
  patientChipTagFamily: {
    backgroundColor: "#F3E8FF",
  },
  patientChipTagText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
    fontSize: 11,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Palette.surfaceAlt,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
  },
  typeBadgeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  adviceContainer: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.border,
  },
  adviceContainerDue: {
    backgroundColor: "#FFFBEB",
    borderLeftColor: "#F59E0B",
  },
  adviceContainerScheduled: {
    backgroundColor: "#F0FDF4",
    borderLeftColor: "#10B981",
  },
  adviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  adviceHeaderTitle: {
    ...Typography.caption,
    fontWeight: "700",
    fontSize: 12,
  },
  adviceText: {
    ...Typography.body,
    color: Palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  timeframeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  timeframeSubItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeframeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  timeframeBold: {
    fontWeight: "700",
    color: Palette.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  pillText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  pillDiagnosis: {
    backgroundColor: Palette.surfaceAlt,
    borderColor: Palette.border,
  },
  pillDiagnosisText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
    maxWidth: 160,
  },
  scheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  scheduledBannerTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#065F46",
    fontSize: 13,
  },
  scheduledBannerSub: {
    ...Typography.caption,
    color: "#047857",
    marginTop: 2,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtnOutline: {
    flex: 1,
  },
  actionBtnPrimary: {
    flex: 1,
  },
  centerModeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  centerModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  centerModeBtnActive: {
    backgroundColor: "#EFF6FF",
    borderColor: Palette.primary,
  },
  centerModeBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  centerModeBtnTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  handoverIdText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },
  handoverTypeText: {
    ...Typography.bodyMedium,
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 1,
  },
  handoverTransferPath: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  transferRole: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  transferDoctorName: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  transferSpeciality: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },
  handoverLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  handoverValue: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.text,
    lineHeight: 18,
    marginTop: 2,
  },
  contextPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  contextPillText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.text,
    fontWeight: "600",
  },
  patientAuthPromptBox: {
    marginTop: Spacing.md,
    backgroundColor: "#FFFBEB",
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  patientAuthPromptTitle: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  patientAuthPromptText: {
    ...Typography.caption,
    fontSize: 12,
    color: "#B45309",
    marginTop: 4,
    lineHeight: 16,
  },
  authorizedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: "#F0FDF4",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  authorizedStatusText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: "#166534",
  },
  declinedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: "#FEF2F2",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  declinedStatusText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: "#991B1B",
  },
});
