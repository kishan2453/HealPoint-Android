/**
 * HealPoint — Smart Patient Care Follow-Up & Continuity Center.
 *
 * Flagship patient-facing care continuity hub built exclusively on real HealPoint data:
 * - Current REAL Care State banner (Consultation Completed, Prescription Available,
 *   Report Pending, Follow-Up Scheduled, Follow-Up Required, Referral Pending, No Active Follow-Up)
 * - Deterministic Smart Next Action CTA banner based on authentic care progression
 * - Post-Consultation Journey visualization (Consultation Completed -> Prescription -> Report -> Follow-Up -> Re-Booking -> Continued Care)
 * - Strict Family Healthcare isolation & switcher
 * - Detailed Follow-Up Plan cards with doctor, hospital, department, diagnosis, advice, prescriptions, reports, referrals & handovers
 * - Follow-up booking & smart re-booking with current live slot availability
 * - Prescription connection with one-tap "Set Reminder" shortcut
 * - Report connection & factual "Report Pending" status tracking
 * - Specialist Referrals & patient-safe Clinical Handover management
 * - Direct integration with Digital Health Wallet, Health Timeline & AI Healthcare Assistant
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
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
import * as clinicalHandoverService from "@/services/clinical-handover";
import * as clinicalReferralService from "@/services/clinical-referral";
import * as familyService from "@/services/family";
import {
  subscribeToAppointmentSync,
  subscribeToClinicalDocSync,
} from "@/services/socket";
import type {
  CareContinuityOverview,
  ClinicalHandoverRecord,
  ClinicalReferralRecord,
  FamilyMember,
  FollowUpOverviewItem,
} from "@/types";

type TabFilter = "all" | "action_due" | "scheduled" | "completed" | "referrals";

const FILTER_TABS: {
  key: TabFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Plans", icon: "clipboard-outline" },
  { key: "action_due", label: "Action Due", icon: "alert-circle-outline" },
  { key: "scheduled", label: "Scheduled", icon: "calendar-outline" },
  {
    key: "completed",
    label: "Completed",
    icon: "checkmark-done-circle-outline",
  },
  { key: "referrals", label: "Referrals", icon: "git-network-outline" },
];

const AI_SUGGESTION_CHIPS = [
  "What happened after my last consultation?",
  "Do I have a follow-up scheduled?",
  "Show my latest prescription instructions",
  "Is my diagnostic report ready?",
  "Do I have any specialist referral?",
];

export default function CareContinuityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId?: string }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [followUps, setFollowUps] = useState<FollowUpOverviewItem[]>([]);
  const [referrals, setReferrals] = useState<ClinicalReferralRecord[]>([]);
  const [handovers, setHandovers] = useState<ClinicalHandoverRecord[]>([]);
  const [continuityOverview, setContinuityOverview] =
    useState<CareContinuityOverview | null>(null);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Referral authorization modal state
  const [authReferral, setAuthReferral] =
    useState<ClinicalReferralRecord | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  // Load continuity and follow-up data
  const loadCareContinuity = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const queryParams = {
          familyMemberId:
            selectedMemberId === "all" ? undefined : selectedMemberId,
          status:
            activeTab === "all" || activeTab === "referrals"
              ? undefined
              : activeTab === "action_due"
                ? "pending_booking"
                : (activeTab as any),
        };

        const [followUpRes, referralRes, handoverRes] = await Promise.all([
          appointmentService.getPatientFollowUps(queryParams),
          clinicalReferralService
            .getPatientReferrals({
              familyMemberId:
                selectedMemberId === "all" ? undefined : selectedMemberId,
            })
            .catch(() => null),
          clinicalHandoverService
            .getPatientHandovers({
              familyMemberId:
                selectedMemberId === "all" ? undefined : selectedMemberId,
            })
            .catch(() => null),
        ]);

        if (followUpRes && followUpRes.success) {
          setFollowUps(followUpRes.followUps || []);
          if (followUpRes.continuityOverview) {
            setContinuityOverview(followUpRes.continuityOverview);
          }
          if (
            followUpRes.patient?.familyMembers &&
            Array.isArray(followUpRes.patient.familyMembers)
          ) {
            setFamilyMembers(followUpRes.patient.familyMembers);
          }
        }

        if (referralRes && referralRes.success) {
          setReferrals(referralRes.referrals || []);
        }

        if (handoverRes && handoverRes.success) {
          setHandovers(handoverRes.handovers || []);
        }
      } catch (err) {
        setError(
          toErrorMessage(
            err,
            "Unable to retrieve care follow-up & continuity data.",
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMemberId, activeTab],
  );

  useScreenFocus(loadCareContinuity);

  useEffect(() => {
    loadCareContinuity();
  }, [userId, selectedMemberId, activeTab, loadCareContinuity]);

  // Real-time cross-portal sync: automatically refresh when appointments or documents update
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        loadCareContinuity();
      }, 300);
    };

    const unsubAppt = subscribeToAppointmentSync(() => trigger());
    const unsubDoc = subscribeToClinicalDocSync(() => trigger());

    return () => {
      if (timer) clearTimeout(timer);
      unsubAppt();
      unsubDoc();
    };
  }, [userId, loadCareContinuity]);

  // Load family members on initial render
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
    loadCareContinuity(true);
  };

  // Handle referral patient authorization (approve / decline)
  const handleReferralAuth = async (decision: "approved" | "declined") => {
    if (!authReferral) return;
    try {
      setAuthorizing(true);
      const res =
        await clinicalReferralService.respondPatientReferralAuthorization(
          authReferral._id,
          {
            decision,
            decisionNotes:
              decision === "approved"
                ? "Authorized by patient via Care Continuity Center"
                : "Declined by patient",
          },
        );
      if (res.success) {
        Alert.alert(
          "Referral Updated",
          decision === "approved"
            ? "Specialist referral has been authorized successfully."
            : "Referral has been declined.",
        );
        setAuthReferral(null);
        loadCareContinuity(true);
      }
    } catch (err) {
      Alert.alert(
        "Update Failed",
        toErrorMessage(err, "Could not update referral authorization."),
      );
    } finally {
      setAuthorizing(false);
    }
  };

  // Filtered follow-up items
  const filteredFollowUps = useMemo(() => {
    let list = followUps;

    // Filter by specific appointmentId param if deep linked
    if (params.appointmentId) {
      const match = list.filter(
        (f) => String(f.appointmentId) === String(params.appointmentId),
      );
      if (match.length > 0) list = match;
    }

    if (activeTab === "action_due") {
      list = list.filter(
        (f) => f.status === "pending_booking" || f.reportStatus === "pending",
      );
    } else if (activeTab === "scheduled") {
      list = list.filter((f) => f.status === "scheduled");
    } else if (activeTab === "completed") {
      list = list.filter((f) => f.status === "completed");
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.doctorName.toLowerCase().includes(q) ||
          f.doctorSpecialty.toLowerCase().includes(q) ||
          f.hospitalName.toLowerCase().includes(q) ||
          f.advice.toLowerCase().includes(q) ||
          (f.diagnosis || "").toLowerCase().includes(q) ||
          f.displayAppointmentId.toLowerCase().includes(q),
      );
    }

    return list;
  }, [followUps, activeTab, search, params.appointmentId]);

  // Derived current care state
  const activeCareState =
    continuityOverview?.activeState ||
    (followUps.some((f) => f.status === "pending_booking")
      ? "Follow-Up Required"
      : followUps.some((f) => f.status === "scheduled")
        ? "Follow-Up Scheduled"
        : followUps.some((f) => f.hasPrescription)
          ? "Prescription Available"
          : "No Active Follow-Up");

  const smartNextAction = continuityOverview?.smartNextAction || {
    key: "VIEW_PRESCRIPTION",
    label: "Explore Health Locker",
    description:
      "Access your verified medical prescriptions, reports & records",
    variant: "primary" as const,
    icon: "folder-open-outline" as const,
    route: "/(drawer)/health/prescriptions",
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ---------------- App Bar ---------------- */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <DrawerToggleButton />
          <View>
            <Text style={styles.appBarTitle}>Care Continuity</Text>
            <Text style={styles.appBarSubtitle}>
              Follow-ups, Prescriptions & Recovery
            </Text>
          </View>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => router.push("/ai-assistant")}
          style={styles.aiHeaderBtn}
        >
          <Ionicons name="sparkles" size={17} color={Palette.primary} />
          <Text style={styles.aiHeaderBtnText}>AI Help</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
      >
        {/* ---------------- Family Member Selector ---------------- */}
        {familyMembers.length > 0 ? (
          <View style={styles.familyBarWrap}>
            <FamilyMemberFilterBar
              selectedMemberId={selectedMemberId}
              onSelectMember={setSelectedMemberId}
            />
          </View>
        ) : null}

        {/* ---------------- 1. Current REAL Care State Banner ---------------- */}
        <Card padded style={styles.careStateCard}>
          <View style={styles.careStateRow}>
            <View
              style={[
                styles.careStateIconBox,
                activeCareState === "Follow-Up Required"
                  ? { backgroundColor: "#FEF3C7" }
                  : activeCareState === "Follow-Up Scheduled"
                    ? { backgroundColor: "#ECFDF5" }
                    : activeCareState === "Referral Pending"
                      ? { backgroundColor: "#EEF2FF" }
                      : { backgroundColor: "#E0F2FE" },
              ]}
            >
              <Ionicons
                name={
                  activeCareState === "Follow-Up Required"
                    ? "alert-circle"
                    : activeCareState === "Follow-Up Scheduled"
                      ? "calendar"
                      : activeCareState === "Referral Pending"
                        ? "git-network"
                        : activeCareState === "Prescription Available"
                          ? "document-text"
                          : activeCareState === "Report Pending"
                            ? "hourglass"
                            : "checkmark-circle"
                }
                size={24}
                color={
                  activeCareState === "Follow-Up Required"
                    ? "#D97706"
                    : activeCareState === "Follow-Up Scheduled"
                      ? "#059669"
                      : activeCareState === "Referral Pending"
                        ? "#4F46E5"
                        : Palette.primaryDark
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.stateBadgeRow}>
                <Text style={styles.stateSubtitle}>Current Care State</Text>
                <Badge
                  label={activeCareState}
                  variant={
                    activeCareState === "Follow-Up Required"
                      ? "warning"
                      : activeCareState === "Follow-Up Scheduled"
                        ? "success"
                        : activeCareState === "Referral Pending"
                          ? "primary"
                          : "neutral"
                  }
                />
              </View>
              <Text style={styles.stateTitle}>
                {activeCareState === "Follow-Up Required"
                  ? "Follow-Up Consultation Recommended"
                  : activeCareState === "Follow-Up Scheduled"
                    ? "Follow-Up Visit is Scheduled"
                    : activeCareState === "Prescription Available"
                      ? "Prescription & Medication Guidance Ready"
                      : activeCareState === "Report Pending"
                        ? "Diagnostic Reports Being Finalized"
                        : activeCareState === "Referral Pending"
                          ? "Specialist Referral in Progress"
                          : activeCareState === "Consultation Completed"
                            ? "Consultation Completed Successfully"
                            : "Your Healthcare Journey is Up to Date"}
              </Text>
            </View>
          </View>

          {/* ---------------- Post-Consultation Visual Journey ---------------- */}
          <View style={styles.journeyWrap}>
            <Text style={styles.journeyHeaderLabel}>
              Post-Consultation Journey
            </Text>
            <View style={styles.journeyStepsRow}>
              {[
                {
                  key: "consultation",
                  label: "Consultation",
                  done: true,
                },
                {
                  key: "prescription",
                  label: "Prescription",
                  done: followUps.some((f) => f.hasPrescription),
                },
                {
                  key: "report",
                  label: "Report",
                  done: followUps.some((f) => f.hasReports),
                },
                {
                  key: "followup",
                  label: "Follow-Up",
                  done: followUps.some(
                    (f) => f.status === "scheduled" || f.status === "completed",
                  ),
                },
                {
                  key: "continuity",
                  label: "Continued Care",
                  done: followUps.some((f) => f.status === "completed"),
                },
              ].map((step, idx, arr) => (
                <React.Fragment key={step.key}>
                  <View style={styles.journeyStepItem}>
                    <View
                      style={[
                        styles.journeyDot,
                        step.done
                          ? styles.journeyDotDone
                          : styles.journeyDotPending,
                      ]}
                    >
                      <Ionicons
                        name={step.done ? "checkmark" : "ellipse"}
                        size={step.done ? 10 : 6}
                        color={step.done ? "#FFFFFF" : Palette.textMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.journeyStepText,
                        step.done && styles.journeyStepTextDone,
                      ]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {idx < arr.length - 1 ? (
                    <View
                      style={[
                        styles.journeyLine,
                        step.done && arr[idx + 1].done
                          ? styles.journeyLineDone
                          : styles.journeyLinePending,
                      ]}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ---------------- Deterministic Smart Next Action CTA ---------------- */}
          {smartNextAction.key !== "NO_ACTION" ? (
            <View style={styles.nextActionContainer}>
              <View style={styles.nextActionTextWrap}>
                <Ionicons
                  name={smartNextAction.icon as any}
                  size={18}
                  color={Palette.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextActionHeading}>
                    Recommended Next Action
                  </Text>
                  <Text style={styles.nextActionSubtext}>
                    {smartNextAction.description}
                  </Text>
                </View>
              </View>
              <Button
                title={smartNextAction.label}
                variant={smartNextAction.variant}
                icon={smartNextAction.icon as any}
                onPress={() => {
                  if (smartNextAction.route) {
                    if (smartNextAction.params) {
                      router.push({
                        pathname: smartNextAction.route as any,
                        params: smartNextAction.params,
                      });
                    } else {
                      router.push(smartNextAction.route as any);
                    }
                  }
                }}
                style={{ marginTop: Spacing.xs }}
              />
            </View>
          ) : null}
        </Card>

        {/* ---------------- AI Assistant Contextual Chips ---------------- */}
        <View style={styles.aiChipsSection}>
          <Text style={styles.sectionCaption}>Ask AI Healthcare Assistant</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiChipsScroll}
          >
            {AI_SUGGESTION_CHIPS.map((chip, idx) => (
              <Pressable
                key={idx}
                onPress={() =>
                  router.push({
                    pathname: "/ai-assistant",
                    params: { initialPrompt: chip },
                  })
                }
                style={({ pressed }) => [
                  styles.aiChip,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={13}
                  color={Palette.primary}
                />
                <Text style={styles.aiChipText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ---------------- Filter Tabs & Search Bar ---------------- */}
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
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
                    size={15}
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
          </ScrollView>
        </View>

        {/* Search input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor, hospital, diagnosis, advice..."
            placeholderTextColor={Palette.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {search.trim().length > 0 ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={17}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* ---------------- Content Area ---------------- */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={styles.loadingText}>
              Loading care continuity records...
            </Text>
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => loadCareContinuity(false)}
          />
        ) : activeTab === "referrals" ? (
          /* ---------------- Referrals & Handovers Tab ---------------- */
          <View style={styles.referralsContainer}>
            <Text style={styles.subSectionTitle}>
              Specialist Referrals ({referrals.length})
            </Text>
            {referrals.length === 0 ? (
              <EmptyState
                title="No Referrals Found"
                message="No specialist referrals have been initiated for this profile."
              />
            ) : (
              referrals.map((refItem) => (
                <Card key={refItem._id} padded style={styles.referralCard}>
                  <View style={styles.referralHeader}>
                    <View style={styles.referralIconBox}>
                      <Ionicons
                        name="git-network"
                        size={20}
                        color={Palette.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.referralIdRow}>
                        <Text style={styles.referralDisplayId}>
                          {refItem.referralDisplayId || "Referral"}
                        </Text>
                        <Badge
                          label={refItem.status
                            .replace(/_/g, " ")
                            .toUpperCase()}
                          variant={
                            refItem.status === "accepted" ||
                            refItem.status === "completed"
                              ? "success"
                              : refItem.status ===
                                  "pending_patient_authorization"
                                ? "warning"
                                : "primary"
                          }
                        />
                      </View>
                      <Text style={styles.referralSpecialty}>
                        {refItem.department} Specialist
                      </Text>
                    </View>
                  </View>

                  <View style={styles.referralDetailBlock}>
                    <Text style={styles.referralDoctorRow}>
                      <Text style={styles.boldLabel}>Referring Doctor: </Text>
                      {refItem.referringDoctorName || "Consulting Physician"}
                    </Text>
                    {refItem.receivingDoctorName ? (
                      <Text style={styles.referralDoctorRow}>
                        <Text style={styles.boldLabel}>Specialist: </Text>
                        {refItem.receivingDoctorName}
                      </Text>
                    ) : null}
                    <Text style={styles.referralDoctorRow}>
                      <Text style={styles.boldLabel}>Hospital: </Text>
                      {refItem.receivingHospitalName ||
                        refItem.hospitalName ||
                        "HealPoint Medical Network"}
                    </Text>
                    {refItem.reasonForReferral || refItem.clinicalSummary ? (
                      <Text style={styles.referralReasonText}>
                        "{refItem.reasonForReferral || refItem.clinicalSummary}"
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.referralActionRow}>
                    {refItem.status === "pending_patient_authorization" ? (
                      <Button
                        title="Review Authorization"
                        variant="primary"
                        icon="shield-checkmark"
                        onPress={() => setAuthReferral(refItem)}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Button
                        title="View Referral Details"
                        variant="outline"
                        icon="open-outline"
                        onPress={() =>
                          router.push("/(drawer)/health/referrals")
                        }
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>
                </Card>
              ))
            )}

            {/* Clinical Handovers Section */}
            <Text style={[styles.subSectionTitle, { marginTop: Spacing.lg }]}>
              Clinical Continuity Handovers ({handovers.length})
            </Text>
            {handovers.length === 0 ? (
              <EmptyState
                title="No Handovers"
                message="No internal doctor-to-doctor clinical handovers found."
              />
            ) : (
              handovers.map((hItem) => (
                <Card key={hItem._id} padded style={styles.handoverCard}>
                  <View style={styles.handoverHeader}>
                    <Ionicons
                      name="swap-horizontal"
                      size={18}
                      color={Palette.primary}
                    />
                    <Text style={styles.handoverTitle}>
                      {hItem.handoverDisplayId || "Handover"}
                    </Text>
                    <Badge
                      label={hItem.status.replace(/_/g, " ").toUpperCase()}
                      variant={
                        hItem.status === "completed"
                          ? "success"
                          : hItem.status === "accepted"
                            ? "primary"
                            : "neutral"
                      }
                    />
                  </View>
                  <Text style={styles.handoverMeta}>
                    From{" "}
                    {typeof hItem.originatingDoctorId === "object"
                      ? hItem.originatingDoctorId?.name
                      : hItem.senderDoctorName || "Attending Doctor"}{" "}
                    to{" "}
                    {typeof hItem.receivingDoctorId === "object"
                      ? hItem.receivingDoctorId?.name
                      : hItem.recipientDoctorName || "Continuity Specialist"}
                  </Text>
                  {hItem.reasonForHandover || hItem.clinicalSummary ? (
                    <Text style={styles.handoverSummaryText}>
                      "{hItem.reasonForHandover || hItem.clinicalSummary}"
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : filteredFollowUps.length === 0 ? (
          <EmptyState
            title="No Care Continuity Plans"
            message={
              search.trim()
                ? "No records match your search filter."
                : "No follow-ups or pending actions found for this profile."
            }
          />
        ) : (
          /* ---------------- Follow-Up Plans Cards ---------------- */
          filteredFollowUps.map((item) => {
            const hasLinked = Boolean(item.linkedAppointmentId);
            const isCompleted = item.status === "completed";

            return (
              <Card key={item.id} padded style={styles.followUpCard}>
                {/* Header: Doctor & Hospital */}
                <View style={styles.cardHeaderRow}>
                  <Image
                    source={{
                      uri: getDoctorImage({
                        _id: item.doctorId,
                        image: item.doctorImage,
                      }),
                    }}
                    style={styles.doctorThumb}
                    contentFit="cover"
                  />
                  <View style={styles.cardDoctorTexts}>
                    <Text style={styles.doctorNameText} numberOfLines={1}>
                      {formatDoctorName(item.doctorName, "Doctor")}
                    </Text>
                    <Text style={styles.doctorSpecText} numberOfLines={1}>
                      {item.doctorSpecialty} • {item.department}
                    </Text>
                    <Text style={styles.hospitalText} numberOfLines={1}>
                      <Ionicons
                        name="business-outline"
                        size={12}
                        color={Palette.textMuted}
                      />{" "}
                      {item.hospitalName}
                    </Text>
                  </View>
                  <Badge
                    label={item.statusLabel}
                    variant={item.statusVariant}
                  />
                </View>

                {/* Patient & Date Context */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="person-outline"
                      size={13}
                      color={Palette.primary}
                    />
                    <Text style={styles.metaText}>{item.patientName}</Text>
                    {item.patientRelationship &&
                    item.patientRelationship !== "Self" ? (
                      <Text style={styles.relText}>
                        ({item.patientRelationship})
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="time-outline"
                      size={13}
                      color={Palette.primary}
                    />
                    <Text style={styles.metaText}>
                      Visit: {formatDDMMYYYY(item.originalVisitDate)}
                    </Text>
                  </View>
                </View>

                {/* Doctor's Advice Box */}
                <View style={styles.adviceBox}>
                  <View style={styles.adviceHeaderRow}>
                    <Ionicons
                      name="medical-outline"
                      size={15}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.adviceLabel}>
                      Doctor's Follow-Up Advice
                    </Text>
                    <Badge
                      label={`Timeframe: ${item.timeframe}`}
                      variant="neutral"
                    />
                  </View>
                  <Text style={styles.adviceText}>{item.advice}</Text>
                  {item.targetDate ? (
                    <Text style={styles.targetDateText}>
                      Target Date: {formatDDMMYYYY(item.targetDate)}
                    </Text>
                  ) : null}
                </View>

                {/* Connected Prescriptions & Reports Bar */}
                <View style={styles.recordsConnectionBar}>
                  {item.hasPrescription ? (
                    <View style={styles.connectionChip}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.connectionChipText}>
                        Prescription Ready ({item.medicinesCount} meds)
                      </Text>
                    </View>
                  ) : null}

                  {item.hasReports ? (
                    <View style={styles.connectionChip}>
                      <Ionicons
                        name="flask-outline"
                        size={14}
                        color="#0284C7"
                      />
                      <Text style={styles.connectionChipText}>
                        Reports Available ({item.reportsCount})
                      </Text>
                    </View>
                  ) : item.reportStatus === "pending" ? (
                    <View
                      style={[
                        styles.connectionChip,
                        { backgroundColor: "#FEF3C7" },
                      ]}
                    >
                      <Ionicons
                        name="hourglass-outline"
                        size={14}
                        color="#D97706"
                      />
                      <Text
                        style={[
                          styles.connectionChipText,
                          { color: "#B45309" },
                        ]}
                      >
                        Report Pending
                      </Text>
                    </View>
                  ) : null}

                  {item.referral ? (
                    <View
                      style={[
                        styles.connectionChip,
                        { backgroundColor: "#EEF2FF" },
                      ]}
                    >
                      <Ionicons
                        name="git-network-outline"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text
                        style={[
                          styles.connectionChipText,
                          { color: "#4338CA" },
                        ]}
                      >
                        Referral: {item.referral.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Linked Appointment Status if already booked */}
                {hasLinked ? (
                  <View style={styles.linkedBox}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.linkedTitle}>
                        Follow-Up Visit Linked:{" "}
                        {item.linkedDisplayAppointmentId ||
                          item.linkedAppointmentId}
                      </Text>
                      {item.linkedAppointmentDate ? (
                        <Text style={styles.linkedDate}>
                          Scheduled:{" "}
                          {formatDDMMYYYY(item.linkedAppointmentDate)}{" "}
                          {item.linkedAppointmentTime || ""}
                        </Text>
                      ) : null}
                    </View>
                    <Badge
                      label={
                        item.linkedAppointmentStatus
                          ? item.linkedAppointmentStatus.toUpperCase()
                          : "BOOKED"
                      }
                      variant="success"
                    />
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.cardActionsRow}>
                  {!hasLinked && !isCompleted ? (
                    <Button
                      title="Book Follow-Up Slot"
                      variant="primary"
                      icon="calendar-outline"
                      onPress={() => {
                        if (item.doctorId) {
                          router.push({
                            pathname: "/booking/[doctorId]",
                            params: {
                              doctorId: item.doctorId,
                              originalAppointmentId: item.appointmentId,
                            },
                          });
                        } else {
                          router.push("/doctors");
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  ) : isCompleted && item.isEligibleForRebook ? (
                    <Button
                      title="Book Again"
                      variant="primary"
                      icon="repeat"
                      onPress={() => {
                        if (item.doctorId) {
                          router.push({
                            pathname: "/booking/[doctorId]",
                            params: {
                              doctorId: item.doctorId,
                              originalAppointmentId: item.appointmentId,
                            },
                          });
                        } else {
                          router.push("/doctors");
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  ) : hasLinked ? (
                    <Button
                      title="View Scheduled Visit"
                      variant="primary"
                      icon="eye-outline"
                      onPress={() =>
                        router.push({
                          pathname: "/appointment/[id]",
                          params: { id: item.linkedAppointmentId! },
                        })
                      }
                      style={{ flex: 1 }}
                    />
                  ) : null}

                  {item.hasPrescription ? (
                    <Button
                      title="Prescription"
                      variant="outline"
                      icon="document-text-outline"
                      onPress={() =>
                        router.push("/(drawer)/health/prescriptions")
                      }
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>

                {/* Secondary Links Row */}
                <View style={styles.cardSecondaryLinks}>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      router.push({
                        pathname: "/appointment/[id]",
                        params: { id: item.appointmentId },
                      })
                    }
                    style={styles.secondaryLinkBtn}
                  >
                    <Text style={styles.secondaryLinkText}>
                      Original Visit Details
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={Palette.primary}
                    />
                  </Pressable>

                  {item.hasPrescription ? (
                    <Pressable
                      hitSlop={6}
                      onPress={() =>
                        router.push("/(drawer)/health/prescriptions")
                      }
                      style={styles.secondaryLinkBtn}
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={13}
                        color={Palette.primary}
                      />
                      <Text style={styles.secondaryLinkText}>Set Reminder</Text>
                    </Pressable>
                  ) : null}

                  {item.hasReports ? (
                    <Pressable
                      hitSlop={6}
                      onPress={() => router.push("/(drawer)/health/reports")}
                      style={styles.secondaryLinkBtn}
                    >
                      <Ionicons
                        name="flask-outline"
                        size={13}
                        color={Palette.primary}
                      />
                      <Text style={styles.secondaryLinkText}>View Reports</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}

        {/* ---------------- Health Locker Shortcuts ---------------- */}
        <View style={styles.healthLockerSection}>
          <Text style={styles.subSectionTitle}>Health Locker Shortcuts</Text>
          <View style={styles.lockerGrid}>
            <Pressable
              onPress={() => router.push("/health-wallet")}
              style={styles.lockerTile}
            >
              <View style={[styles.lockerIcon, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons
                  name="wallet-outline"
                  size={20}
                  color={Palette.primary}
                />
              </View>
              <Text style={styles.lockerLabel}>Health Wallet</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/health/timeline")}
              style={styles.lockerTile}
            >
              <View style={[styles.lockerIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="git-commit-outline" size={20} color="#059669" />
              </View>
              <Text style={styles.lockerLabel}>Care Timeline</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(drawer)/health/prescriptions")}
              style={styles.lockerTile}
            >
              <View style={[styles.lockerIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#D97706"
                />
              </View>
              <Text style={styles.lockerLabel}>Prescriptions</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(drawer)/health/reports")}
              style={styles.lockerTile}
            >
              <View style={[styles.lockerIcon, { backgroundColor: "#F3E8FF" }]}>
                <Ionicons name="flask-outline" size={20} color="#7E22CE" />
              </View>
              <Text style={styles.lockerLabel}>Lab Reports</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* ---------------- Referral Authorization Modal ---------------- */}
      <Modal
        visible={Boolean(authReferral)}
        transparent
        animationType="slide"
        onRequestClose={() => setAuthReferral(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Specialist Referral Consent</Text>
              <Pressable onPress={() => setAuthReferral(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.modalBodyText}>
              Dr. {authReferral?.referringDoctorName || "Your doctor"} has
              created a specialist referral to{" "}
              <Text style={{ fontWeight: "700" }}>
                {authReferral?.department}
              </Text>{" "}
              at{" "}
              {authReferral?.receivingHospitalName ||
                authReferral?.hospitalName ||
                "HealPoint Medical Center"}
              .
            </Text>

            {authReferral?.reasonForReferral ||
            authReferral?.clinicalSummary ? (
              <View style={styles.modalReasonBox}>
                <Text style={styles.modalReasonLabel}>Clinical Reason:</Text>
                <Text style={styles.modalReasonContent}>
                  {authReferral.reasonForReferral ||
                    authReferral.clinicalSummary}
                </Text>
              </View>
            ) : null}

            <Text style={styles.modalFootnote}>
              By authorizing, relevant clinical documents will be securely
              routed to the specialist team.
            </Text>

            <View style={styles.modalActionButtons}>
              <Button
                title="Authorize Referral"
                variant="primary"
                icon="checkmark-circle-outline"
                loading={authorizing}
                disabled={authorizing}
                onPress={() => handleReferralAuth("approved")}
                style={{ flex: 1 }}
              />
              <Button
                title="Decline"
                variant="outline"
                disabled={authorizing}
                onPress={() => handleReferralAuth("declined")}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  appBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  appBarTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  appBarSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  aiHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(14, 159, 142, 0.10)",
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.20)",
  },
  aiHeaderBtnText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  familyBarWrap: {
    marginBottom: Spacing.xs,
  },

  // Care State Card
  careStateCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  careStateRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  careStateIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  stateSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    fontSize: 10,
  },
  stateTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },

  // Post Consultation Journey
  journeyWrap: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  journeyHeaderLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    fontSize: 11,
  },
  journeyStepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journeyStepItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 50,
  },
  journeyDot: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDotDone: {
    backgroundColor: Palette.primary,
  },
  journeyDotPending: {
    backgroundColor: Palette.surfaceAlt || "#F1F5F9",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  journeyStepText: {
    fontSize: 9,
    color: Palette.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  journeyStepTextDone: {
    color: Palette.text,
    fontWeight: "700",
  },
  journeyLine: {
    flex: 1,
    height: 2,
    marginTop: -14,
  },
  journeyLineDone: {
    backgroundColor: Palette.primary,
  },
  journeyLinePending: {
    backgroundColor: Palette.divider,
  },

  // Deterministic Next Action Box
  nextActionContainer: {
    marginTop: Spacing.md,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.18)",
    gap: Spacing.xs,
  },
  nextActionTextWrap: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  nextActionHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    fontSize: 11,
    textTransform: "uppercase",
  },
  nextActionSubtext: {
    ...Typography.bodySmall,
    color: Palette.text,
  },

  // AI chips
  aiChipsSection: {
    gap: Spacing.xs,
  },
  sectionCaption: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  aiChipsScroll: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  aiChipText: {
    ...Typography.caption,
    color: Palette.text,
    fontSize: 11,
  },

  // Tabs
  tabsWrap: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 3,
  },
  tabsScroll: {
    gap: 4,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: "rgba(14, 159, 142, 0.12)",
  },
  tabBtnText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  tabBtnTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 40,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Palette.text,
  },

  // Follow-Up Card
  followUpCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  doctorThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  cardDoctorTexts: {
    flex: 1,
    gap: 2,
  },
  doctorNameText: {
    ...Typography.h4,
    fontSize: 15,
    color: Palette.text,
  },
  doctorSpecText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  hospitalText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  relText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  // Advice
  adviceBox: {
    backgroundColor: Palette.surfaceAlt || "#F8FAFC",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  adviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adviceLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    fontSize: 11,
  },
  adviceText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontStyle: "italic",
  },
  targetDateText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
    fontSize: 11,
  },

  // Records connection bar
  recordsConnectionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  connectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
  },
  connectionChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#166534",
  },

  // Linked visit
  linkedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#ECFDF5",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  linkedTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#065F46",
  },
  linkedDate: {
    ...Typography.caption,
    color: "#047857",
    fontSize: 11,
  },

  // Actions
  cardActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 2,
  },
  cardSecondaryLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  secondaryLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  secondaryLinkText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },

  // Referrals
  referralsContainer: {
    gap: Spacing.md,
  },
  subSectionTitle: {
    ...Typography.h4,
    fontSize: 15,
    color: Palette.text,
  },
  referralCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  referralHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(14, 159, 142, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  referralIdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  referralDisplayId: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  referralSpecialty: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  referralDetailBlock: {
    backgroundColor: Palette.surfaceAlt || "#F8FAFC",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 3,
  },
  referralDoctorRow: {
    ...Typography.caption,
    color: Palette.text,
  },
  boldLabel: {
    fontWeight: "700",
    color: Palette.textMuted,
  },
  referralReasonText: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.text,
    marginTop: 2,
  },
  referralActionRow: {
    marginTop: 2,
  },

  // Handover card
  handoverCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 4,
  },
  handoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  handoverTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  handoverMeta: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  handoverSummaryText: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.text,
    marginTop: 2,
  },

  // Health Locker Shortcuts
  healthLockerSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  lockerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  lockerTile: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 6,
  },
  lockerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  lockerLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },

  // Loading
  loadingBox: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalBodyText: {
    ...Typography.bodyMedium,
    color: Palette.text,
    lineHeight: 20,
  },
  modalReasonBox: {
    backgroundColor: Palette.surfaceAlt || "#F8FAFC",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 2,
  },
  modalReasonLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  modalReasonContent: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontStyle: "italic",
  },
  modalFootnote: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
