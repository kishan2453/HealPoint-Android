/**
 * HealPoint — Smart Referral & Specialist Routing Center.
 *
 * Patient-facing hub for doctor-directed referrals, specialist routing,
 * patient authorization, and one-tap linked appointment booking.
 * Driven 100% by authentic backend data (no mock/dummy records).
 */
import { Ionicons } from "@expo/vector-icons";
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
import { formatDDMMYYYY } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as clinicalReferralService from "@/services/clinical-referral";
import * as familyService from "@/services/family";
import type {
  ClinicalReferralRecord,
  FamilyMember,
  ReferralStatus,
} from "@/types";

type TabFilter =
  | "all"
  | "action_due"
  | "ready_to_book"
  | "booked"
  | "completed";

const FILTER_TABS: {
  key: TabFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Referrals", icon: "git-network-outline" },
  {
    key: "action_due",
    label: "Action Due",
    icon: "shield-checkmark-outline",
  },
  {
    key: "ready_to_book",
    label: "Ready to Book",
    icon: "calendar-outline",
  },
  {
    key: "booked",
    label: "Booked",
    icon: "checkmark-circle-outline",
  },
  {
    key: "completed",
    label: "Completed",
    icon: "checkmark-done-outline",
  },
];

export default function ReferralsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  const [referrals, setReferrals] = useState<ClinicalReferralRecord[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [processingAuth, setProcessingAuth] = useState(false);

  const loadReferrals = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const res = await clinicalReferralService.getPatientReferrals({
          familyMemberId:
            selectedMemberId === "all" ? undefined : selectedMemberId,
        });

        if (res?.success) {
          setReferrals(res.referrals || []);
        } else {
          setReferrals([]);
        }
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load specialist referrals."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMemberId],
  );

  useScreenFocus(loadReferrals);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  // Load family members
  useEffect(() => {
    if (!userId) return;
    familyService
      .getFamilyMembers(userId)
      .then((members) => {
        if (Array.isArray(members)) setFamilyMembers(members);
      })
      .catch(() => {});
  }, [userId]);

  const onRefresh = () => {
    loadReferrals(true);
  };

  const handleAuthorize = async (
    referralId: string,
    decision: "approved" | "declined",
  ) => {
    try {
      setRespondingId(referralId);
      setProcessingAuth(true);

      const res =
        await clinicalReferralService.respondPatientReferralAuthorization(
          referralId,
          {
            decision,
            decisionNotes:
              decision === "declined"
                ? "Patient declined referral authorization."
                : undefined,
          },
        );

      if (res?.success) {
        Alert.alert(
          decision === "approved" ? "Referral Authorized" : "Referral Declined",
          decision === "approved"
            ? "Your referral has been sent to the specialist for review."
            : "Referral has been declined and recorded in history.",
        );
        await loadReferrals(true);
      }
    } catch (err) {
      Alert.alert(
        "Authorization Failed",
        toErrorMessage(err, "Unable to update referral authorization."),
      );
    } finally {
      setProcessingAuth(false);
      setRespondingId(null);
    }
  };

  const handleBookSpecialist = (item: ClinicalReferralRecord) => {
    const targetDocId =
      typeof item.receivingDoctorId === "object" && item.receivingDoctorId
        ? item.receivingDoctorId._id
        : typeof item.receivingDoctorId === "string"
          ? item.receivingDoctorId
          : "";

    if (!targetDocId) {
      Alert.alert(
        "Specialist Assignment Pending",
        "This referral was routed to the department pool. Please check back once a specialist clinician accepts your case, or contact the clinic reception.",
      );
      return;
    }

    router.push({
      pathname: "/booking/[doctorId]",
      params: {
        doctorId: targetDocId,
        referralId: item._id,
        memberId: item.familyMemberId || undefined,
        source: "referral",
      },
    });
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    let list = referrals;

    if (activeTab === "action_due") {
      list = list.filter(
        (r) =>
          r.status === "pending_patient_authorization" ||
          r.patientAuthorization?.status === "pending",
      );
    } else if (activeTab === "ready_to_book") {
      list = list.filter(
        (r) => r.status === "accepted" || r.status === "appointment_pending",
      );
    } else if (activeTab === "booked") {
      list = list.filter(
        (r) =>
          r.status === "appointment_booked" ||
          r.status === "consultation_completed",
      );
    } else if (activeTab === "completed") {
      list = list.filter((r) => r.status === "completed");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const refDoc =
          typeof r.referringDoctorId === "object"
            ? r.referringDoctorId?.name || ""
            : "";
        const recvDoc =
          typeof r.receivingDoctorId === "object"
            ? r.receivingDoctorId?.name || ""
            : "";
        const dept = r.department || "";
        const reason = r.reasonForReferral || "";
        const id = r.referralDisplayId || "";
        return (
          refDoc.toLowerCase().includes(q) ||
          recvDoc.toLowerCase().includes(q) ||
          dept.toLowerCase().includes(q) ||
          reason.toLowerCase().includes(q) ||
          id.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [referrals, activeTab, search]);

  // Statistics Strip
  const stats = useMemo(() => {
    const total = referrals.length;
    const actionDue = referrals.filter(
      (r) =>
        r.status === "pending_patient_authorization" ||
        r.patientAuthorization?.status === "pending",
    ).length;
    const readyToBook = referrals.filter(
      (r) => r.status === "accepted" || r.status === "appointment_pending",
    ).length;
    const booked = referrals.filter(
      (r) =>
        r.status === "appointment_booked" ||
        r.status === "consultation_completed" ||
        r.status === "completed",
    ).length;
    return { total, actionDue, readyToBook, booked };
  }, [referrals]);

  const getStatusVariant = (st: ReferralStatus): BadgeVariant => {
    switch (st) {
      case "accepted":
      case "appointment_pending":
        return "success";
      case "appointment_booked":
      case "consultation_completed":
      case "completed":
        return "primary";
      case "pending_patient_authorization":
      case "sent":
      case "in_review":
        return "warning";
      case "declined":
      case "cancelled":
      case "expired":
        return "error";
      default:
        return "neutral";
    }
  };

  const getUrgencyVariant = (urgency: string): BadgeVariant => {
    switch (urgency) {
      case "stat_emergency":
        return "error";
      case "urgent":
        return "warning";
      default:
        return "neutral";
    }
  };

  const renderItem = ({ item }: { item: ClinicalReferralRecord }) => {
    const origDoctor =
      typeof item.referringDoctorId === "object"
        ? item.referringDoctorId
        : null;
    const recvDoctor =
      typeof item.receivingDoctorId === "object"
        ? item.receivingDoctorId
        : null;

    const isPendingAuth =
      item.status === "pending_patient_authorization" ||
      item.patientAuthorization?.status === "pending";
    const isReadyToBook =
      item.status === "accepted" || item.status === "appointment_pending";
    const isBooked =
      item.status === "appointment_booked" ||
      item.status === "consultation_completed" ||
      Boolean(item.linkedAppointmentId);

    const linkedAppt =
      typeof item.linkedAppointmentId === "object"
        ? item.linkedAppointmentId
        : null;

    const referralDisplayId =
      item.referralDisplayId ||
      (item._id ? `REF-${item._id.slice(-6).toUpperCase()}` : "REF-RECORD");

    return (
      <Card style={styles.card}>
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.referralIdText}>{referralDisplayId}</Text>
              {item.referralType === "inter_hospital" && (
                <Badge label="HOSPITAL EXCHANGE" variant="primary" />
              )}
            </View>
            <Text style={styles.departmentText}>{item.department}</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Badge
              label={item.urgency.replace(/_/g, " ").toUpperCase()}
              variant={getUrgencyVariant(item.urgency)}
            />
            <Badge
              label={item.status.replace(/_/g, " ").toUpperCase()}
              variant={getStatusVariant(item.status)}
            />
          </View>
        </View>

        {/* Specialist & Hospital Routing Pathway */}
        <View style={styles.routingPath}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pathRole}>Referring Physician</Text>
            <Text style={styles.doctorName}>
              Dr. {origDoctor?.name || item.referringDoctorName || "Physician"}
            </Text>
            {item.originatingHospitalName ? (
              <Text style={styles.doctorSpeciality}>
                {item.originatingHospitalName}
              </Text>
            ) : origDoctor?.speciality ? (
              <Text style={styles.doctorSpeciality}>
                {origDoctor.speciality}
              </Text>
            ) : null}
          </View>

          <Ionicons
            name="arrow-forward"
            size={16}
            color={Palette.primary}
            style={{ marginHorizontal: 8 }}
          />

          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.pathRole}>
              {item.referralType === "inter_hospital"
                ? "Receiving Facility"
                : "Target Specialist"}
            </Text>
            <Text style={styles.doctorName}>
              {recvDoctor?.name
                ? `Dr. ${recvDoctor.name}`
                : item.receivingHospitalName
                  ? item.receivingHospitalName
                  : `Dept of ${item.department}`}
            </Text>
            <Text style={styles.doctorSpeciality}>
              {recvDoctor?.speciality ||
                (item.receivingHospitalName
                  ? `Dept of ${item.department}`
                  : item.department)}
            </Text>
          </View>
        </View>

        {/* Reason for Referral */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.fieldLabel}>Clinical Indication:</Text>
          <Text style={styles.fieldValue}>{item.reasonForReferral}</Text>
        </View>

        {item.clinicalSummary ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.fieldLabel}>Summary & Diagnostic Context:</Text>
            <Text style={styles.fieldValue}>{item.clinicalSummary}</Text>
          </View>
        ) : null}

        {/* Shared Context Badges */}
        <View style={styles.contextPillsRow}>
          {item.sharedContext?.includeConsultationNotes && (
            <View style={styles.contextPill}>
              <Ionicons
                name="document-text-outline"
                size={12}
                color={Palette.primary}
              />
              <Text style={styles.contextPillText}>Clinical Notes</Text>
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
              <Text style={styles.contextPillText}>Lab Reports</Text>
            </View>
          )}
          {item.sharedContext?.includeVitals && (
            <View style={styles.contextPill}>
              <Ionicons name="heart-outline" size={12} color={Palette.error} />
              <Text style={styles.contextPillText}>Vitals</Text>
            </View>
          )}
        </View>

        {/* Linked Appointment Confirmation Banner */}
        {isBooked && linkedAppt ? (
          <Pressable
            style={styles.bookedBanner}
            onPress={() => {
              if (linkedAppt._id) {
                router.push(`/appointment/${linkedAppt._id}`);
              }
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.bookedBannerTitle}>
                Specialist Appointment Scheduled
              </Text>
              <Text style={styles.bookedBannerSub}>
                Slot: {formatDDMMYYYY(linkedAppt.slotDate)}{" "}
                {linkedAppt.slotTime ? `at ${linkedAppt.slotTime}` : ""}
                {linkedAppt.appointmentId
                  ? ` • #${linkedAppt.appointmentId}`
                  : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#059669" />
          </Pressable>
        ) : null}

        {/* Patient Action Area */}
        {isPendingAuth ? (
          <View style={styles.authPromptBox}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={Palette.warning}
              />
              <Text style={styles.authPromptTitle}>
                Your Referral Authorization Required
              </Text>
            </View>
            <Text style={styles.authPromptText}>
              {item.referralType === "inter_hospital"
                ? `Dr. ${origDoctor?.name || "Your doctor"} from ${item.originatingHospitalName || "your hospital"} has recommended an inter-hospital referral to ${item.receivingHospitalName || "a specialist facility"}. Your authorization is required before your medical records and clinical context are securely disclosed.`
                : `Dr. ${origDoctor?.name || "Your doctor"} has requested a referral to the ${item.department} specialist team. Please authorize this referral so the specialist can review your clinical context.`}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button
                title="Authorize Referral"
                variant="primary"
                fullWidth={false}
                loading={processingAuth && respondingId === item._id}
                onPress={() => handleAuthorize(item._id, "approved")}
                style={{ flex: 1 }}
              />
              <Button
                title="Decline"
                variant="outline"
                fullWidth={false}
                loading={processingAuth && respondingId === item._id}
                onPress={() => handleAuthorize(item._id, "declined")}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : item.referralType === "inter_hospital" &&
          !isPendingAuth &&
          (item.networkStatus === "pending_receiving_review" ||
            item.networkStatus === "department_assigned" ||
            item.networkStatus === "doctor_assigned") ? (
          <View style={styles.networkStatusBanner}>
            <Ionicons
              name="hourglass-outline"
              size={16}
              color={Palette.primaryDark}
            />
            <Text style={styles.networkStatusBannerText}>
              Under review and specialist triage at{" "}
              {item.receivingHospitalName || "receiving facility"}. You will be
              able to book your appointment once accepted.
            </Text>
          </View>
        ) : isReadyToBook ? (
          <View style={styles.actionRow}>
            <Button
              title="Book Specialist Appointment"
              variant="primary"
              icon="calendar"
              fullWidth
              onPress={() => handleBookSpecialist(item)}
            />
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <DrawerToggleButton style={styles.menuBtn} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Specialist Referrals</Text>
          <Text style={styles.headerSubtitle}>
            Doctor-directed routing & continuous specialist care
          </Text>
        </View>
      </View>

      {/* Quick Navigation Strip */}
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
          onPress={() => router.push("/health/follow-ups")}
        >
          <Ionicons name="refresh-outline" size={14} color="#7C3AED" />
          <Text style={[styles.vaultBarBtnText, { color: "#7C3AED" }]}>
            Follow-Ups
          </Text>
        </Pressable>
        <View style={styles.vaultBarDivider} />
        <Pressable
          style={styles.vaultBarBtn}
          onPress={() => router.push("/health/timeline")}
        >
          <Ionicons name="git-branch-outline" size={14} color="#059669" />
          <Text style={[styles.vaultBarBtnText, { color: "#059669" }]}>
            Timeline
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

      {/* KPI Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#D97706" }]}>
            {stats.actionDue}
          </Text>
          <Text style={styles.statLabel}>Action Due</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: Palette.primaryDark }]}>
            {stats.readyToBook}
          </Text>
          <Text style={styles.statLabel}>Ready to Book</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: "#059669" }]}>
            {stats.booked}
          </Text>
          <Text style={styles.statLabel}>Booked</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor, department, reason or ID..."
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

      {/* Filter Tabs */}
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
                style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body List */}
      {loading ? (
        <Loading label="Loading specialist referrals..." />
      ) : error ? (
        <ErrorState
          title="Couldn't load referrals"
          message={error}
          onRetry={() => loadReferrals(false)}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item._id}
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
                activeTab === "action_due"
                  ? "No Actions Due"
                  : activeTab === "ready_to_book"
                    ? "No Referrals Ready to Book"
                    : activeTab === "booked"
                      ? "No Booked Referrals"
                      : "No Referrals Found"
              }
              message={
                activeTab === "action_due"
                  ? "You have no outstanding referrals requiring your authorization right now."
                  : activeTab === "ready_to_book"
                    ? "When a specialist accepts your referral, a direct booking button will appear here."
                    : "When your attending doctor refers you to a hospital department or specialist, it will appear here for your review and direct booking."
              }
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
    justifyContent: "space-between",
  },
  referralIdText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },
  departmentText: {
    ...Typography.bodyMedium,
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 1,
  },
  routingPath: {
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
  pathRole: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  doctorName: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  doctorSpeciality: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },
  fieldLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  fieldValue: {
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
  bookedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  bookedBannerTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#065F46",
    fontSize: 13,
  },
  bookedBannerSub: {
    ...Typography.caption,
    color: "#047857",
    marginTop: 2,
    fontSize: 12,
  },
  authPromptBox: {
    marginTop: Spacing.md,
    backgroundColor: "#FFFBEB",
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  authPromptTitle: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  authPromptText: {
    ...Typography.caption,
    fontSize: 12,
    color: "#B45309",
    marginTop: 4,
    lineHeight: 16,
  },
  networkStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primaryLight,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  networkStatusBannerText: {
    flex: 1,
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: Spacing.md,
  },
});
