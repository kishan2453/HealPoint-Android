/**
 * HealPoint - Secure Consent & Patient Data Access Management Center.
 *
 * Enterprise privacy control layer:
 * - Real-time active and historical consent permissions
 * - Instant revocation and validity extension
 * - Pending access requests from doctors with Approve/Decline
 * - Complete transparent access audit trail (who viewed what, when, and under what authority)
 * - Grant new consent to doctors/hospitals with category scoping
 * - Family member consent delegation
 * - HIPAA/DISHA clinical confidentiality standards
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
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
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as consentService from "@/services/consent";
import * as doctorService from "@/services/doctors";
import * as interopService from "@/services/interoperability";
import type {
  ClinicalAuthorizationRecord,
  ClinicalAuthorizationStatus,
  ClinicalAuthorizationType,
  ConsentCategory,
  Doctor,
  PatientAccessAuditLogResponse,
  PatientConsentRecord,
  PatientConsentsResponse,
  PatientDataAccessLogItem,
  PatientExchangeHistoryItem,
} from "@/types";

type ConsentTab =
  | "clinical"
  | "active"
  | "pending"
  | "audit"
  | "grant"
  | "policy"
  | "exchanges";

const CLINICAL_AUTH_TYPE_META: Record<
  ClinicalAuthorizationType,
  { label: string; desc: string }
> = {
  treatment_care_plan_acknowledgement: {
    label: "Treatment & Care Plan Acknowledgement",
    desc: "Consent for prescribed therapy and clinical regimen",
  },
  online_consultation_acknowledgement: {
    label: "Telehealth & Virtual Care Consent",
    desc: "Teleconsultation modality acknowledgement",
  },
  consultation_acknowledgement: {
    label: "In-Clinic Consultation Care Discussion",
    desc: "In-clinic care plan acknowledgement",
  },
  document_review_authorization: {
    label: "Health Document Review Authorization",
    desc: "Consent to evaluate past external health records",
  },
  follow_up_care_acknowledgement: {
    label: "Follow-Up & Warning Signs Acknowledgement",
    desc: "Red-flag signs & return visit schedule",
  },
};

const CATEGORY_LABELS: Record<
  ConsentCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  medical_records: { label: "Medical Records", icon: "folder-open-outline" },
  prescriptions: { label: "Prescriptions", icon: "document-text-outline" },
  reports: { label: "Lab Reports", icon: "bar-chart-outline" },
  documents: { label: "Wallet Docs", icon: "wallet-outline" },
  vitals: { label: "Vitals History", icon: "pulse-outline" },
  all: { label: "Full Chart", icon: "shield-checkmark-outline" },
};

const DURATION_OPTIONS: Array<{
  key: "24_hours" | "7_days" | "30_days" | "90_days" | "1_year";
  label: string;
}> = [
  { key: "24_hours", label: "24 Hours" },
  { key: "7_days", label: "7 Days" },
  { key: "30_days", label: "30 Days" },
  { key: "90_days", label: "90 Days" },
  { key: "1_year", label: "1 Year" },
];

const PURPOSE_SUGGESTIONS = [
  "Clinical Consultation & Care",
  "Second Opinion Review",
  "Follow-up Treatment",
  "Chronic Condition Monitoring",
  "Routine Health Evaluation",
];

const POLICY_SECTIONS = [
  {
    id: "ownership",
    icon: "person-outline" as const,
    title: "Patient Data Ownership & Rights",
    subtitle: "You are the sole owner of your healthcare data",
    body: "At HealPoint, you retain full ownership of all personal and clinical data. You have the fundamental right to inspect, grant, modify, or permanently revoke doctor access to your medical records at any time.",
  },
  {
    id: "confidentiality",
    icon: "shield-checkmark-outline" as const,
    title: "Doctor-Patient Confidentiality (PHI)",
    subtitle: "Strictly scoped to your chosen care providers",
    body: "Your Protected Health Information (PHI)—including clinical diagnoses, prescribed medications, diagnostic reports, and physician notes—is strictly confidential. It is accessible only by authorized doctors under active patient consent or active clinical encounters.",
  },
  {
    id: "encryption",
    icon: "lock-closed-outline" as const,
    title: "End-to-End Encryption & Device Security",
    subtitle: "Hardware-level keychain encryption",
    body: "All transmissions between HealPoint apps and servers utilize high-grade TLS 1.3 encryption. Mobile authentication sessions are protected using native hardware security modules (iOS Keychain and Android Keystore via SecureStore).",
  },
  {
    id: "audit-trails",
    icon: "document-text-outline" as const,
    title: "Complete Transparency & Access Audit",
    subtitle: "Every single record view is logged and traceable",
    body: "Every clinical read of your health records generates an immutable audit entry. The Access Audit Trail lets you inspect who viewed your records, what category was accessed, and the clinical purpose.",
  },
];

export default function PrivacyScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ConsentTab>("active");
  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>("all");

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [consentsData, setConsentsData] =
    useState<PatientConsentsResponse | null>(null);
  const [auditLogData, setAuditLogData] =
    useState<PatientAccessAuditLogResponse | null>(null);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);

  // Grant Consent Form States
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<
    ConsentCategory[]
  >(["medical_records", "prescriptions", "reports"]);
  const [consentPurpose, setConsentPurpose] = useState(
    "Clinical Consultation & Care",
  );
  const [consentDuration, setConsentDuration] = useState<
    "24_hours" | "7_days" | "30_days" | "90_days" | "1_year"
  >("30_days");
  const [submittingGrant, setSubmittingGrant] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Extend Modal State
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [selectedConsentToExtend, setSelectedConsentToExtend] =
    useState<PatientConsentRecord | null>(null);
  const [selectedExtensionDuration, setSelectedExtensionDuration] = useState<
    "7_days" | "30_days" | "90_days" | "1_year"
  >("30_days");

  // Clinical Authorizations State
  const [clinicalAuthorizations, setClinicalAuthorizations] = useState<
    ClinicalAuthorizationRecord[]
  >([]);
  const [selectedClinicalAuth, setSelectedClinicalAuth] =
    useState<ClinicalAuthorizationRecord | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [declineReasonInput, setDeclineReasonInput] = useState("");
  const [submittingAuthAction, setSubmittingAuthAction] = useState(false);

  // Interoperability External Data Sharing State
  const [interopHistory, setInteropHistory] = useState<
    PatientExchangeHistoryItem[]
  >([]);

  // Load consents data
  const loadConsents = useCallback(async () => {
    try {
      setError("");
      const res = await consentService.getPatientConsents({
        familyMemberId: familyMemberFilter,
      });
      setConsentsData(res);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load consent records."));
    }
  }, [familyMemberFilter]);

  // Load clinical authorizations
  const loadClinicalAuthorizations = useCallback(async () => {
    try {
      const res = await consentService.getPatientClinicalAuthorizations({
        familyMemberId: familyMemberFilter,
      });
      if (res?.success && Array.isArray(res.authorizations)) {
        setClinicalAuthorizations(res.authorizations);
      }
    } catch (err) {
      console.error("Error loading clinical authorizations:", err);
    }
  }, [familyMemberFilter]);

  // Load access audit logs
  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await consentService.getPatientDataAccessAuditLog();
      setAuditLogData(res);
    } catch (err) {
      console.error("Error loading audit log:", err);
    }
  }, []);

  // Load external data sharing history
  const loadInteropHistory = useCallback(async () => {
    try {
      const res = await interopService.getPatientExchangeHistory();
      if (res?.success && Array.isArray(res.exchangeHistory)) {
        setInteropHistory(res.exchangeHistory);
      }
    } catch (err) {
      console.error("Error loading interoperability history:", err);
    }
  }, []);

  // Load doctor catalog for Grant Form
  const loadDoctors = useCallback(async () => {
    try {
      const res = await doctorService.getAllDoctors();
      if (res?.success && Array.isArray(res.doctors)) {
        setDoctorsList(res.doctors);
        if (res.doctors.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(res.doctors[0]._id);
        }
      }
    } catch (err) {
      console.error("Error loading doctors for consent grant:", err);
    }
  }, [selectedDoctorId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadConsents(),
      loadClinicalAuthorizations(),
      loadAuditLogs(),
      loadInteropHistory(),
      loadDoctors(),
    ]);
    setLoading(false);
  }, [
    loadConsents,
    loadClinicalAuthorizations,
    loadAuditLogs,
    loadInteropHistory,
    loadDoctors,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadConsents(),
      loadClinicalAuthorizations(),
      loadAuditLogs(),
      loadInteropHistory(),
    ]);
    setRefreshing(false);
  };

  const handleOpenAuthModal = (auth: ClinicalAuthorizationRecord) => {
    setSelectedClinicalAuth(auth);
    setDeclineReasonInput("");
    setAuthModalVisible(true);
  };

  const handleRespondClinicalAuth = async (decision: "approve" | "decline") => {
    if (!selectedClinicalAuth) return;
    setSubmittingAuthAction(true);
    try {
      const res = await consentService.respondClinicalAuthorization(
        selectedClinicalAuth._id,
        {
          decision,
          declinedReason:
            decision === "decline" ? declineReasonInput.trim() : undefined,
        },
      );
      if (res.success) {
        Alert.alert(
          decision === "approve"
            ? "Care Plan Authorized"
            : "Authorization Declined",
          decision === "approve"
            ? "Your acknowledgement has been recorded and your doctor has been notified."
            : "You have declined this authorization request.",
        );
        setAuthModalVisible(false);
        await loadAll();
      }
    } catch (err) {
      Alert.alert(
        "Action Failed",
        toErrorMessage(err, "Unable to record authorization decision."),
      );
    } finally {
      setSubmittingAuthAction(false);
    }
  };

  const handleRevokeClinicalAuth = (auth: ClinicalAuthorizationRecord) => {
    Alert.alert(
      "Revoke Clinical Authorization",
      `Are you sure you want to revoke authorization for "${auth.clinicalContext?.title || auth.purpose}"? Your consultation records will remain preserved, but this treatment authorization will be marked as revoked.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke Authorization",
          style: "destructive",
          onPress: async () => {
            setActionLoadingId(auth._id);
            try {
              const res = await consentService.revokeClinicalAuthorization(
                auth._id,
                "Revoked by patient via Consent Center",
              );
              if (res.success) {
                Alert.alert(
                  "Authorization Revoked",
                  "The clinical authorization has been marked as revoked.",
                );
                await loadAll();
              }
            } catch (err) {
              Alert.alert(
                "Revocation Failed",
                toErrorMessage(err, "Unable to revoke authorization."),
              );
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  // Revoke Action
  const handleRevoke = (consent: PatientConsentRecord) => {
    const docName =
      typeof consent.doctorId === "object"
        ? consent.doctorId.name
        : consent.doctorName || "care provider";
    Alert.alert(
      "Revoke Health Data Access",
      `Are you sure you want to revoke access granted to Dr. ${docName}? They will no longer be able to view your historical records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke Access",
          style: "destructive",
          onPress: async () => {
            setActionLoadingId(consent._id);
            try {
              const res = await consentService.revokePatientConsent(
                consent._id,
                "Revoked by patient via Consent Center",
              );
              if (res.success) {
                Alert.alert(
                  "Access Revoked",
                  `Dr. ${docName}'s access to your medical records has been terminated.`,
                );
                await loadAll();
              }
            } catch (err) {
              Alert.alert(
                "Revocation Failed",
                toErrorMessage(err, "Unable to revoke access."),
              );
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  // Extend Action
  const handleExtendConfirm = async () => {
    if (!selectedConsentToExtend) return;
    setActionLoadingId(selectedConsentToExtend._id);
    try {
      const res = await consentService.extendConsentExpiry(
        selectedConsentToExtend._id,
        selectedExtensionDuration,
      );
      if (res.success) {
        Alert.alert(
          "Access Extended",
          "The consent validity period has been successfully updated.",
        );
        setExtendModalVisible(false);
        await loadAll();
      }
    } catch (err) {
      Alert.alert(
        "Failed to Extend",
        toErrorMessage(err, "Unable to extend validity."),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Doctor Request Response (Approve / Reject)
  const handleRequestResponse = async (
    consentId: string,
    action: "approve" | "reject",
  ) => {
    setActionLoadingId(consentId);
    try {
      const res = await consentService.respondToConsentRequest(
        consentId,
        action,
        "30_days",
      );
      if (res.success) {
        Alert.alert(
          action === "approve" ? "Access Approved" : "Access Declined",
          action === "approve"
            ? "Doctor has been granted 30-day access to your records."
            : "The doctor's access request was declined.",
        );
        await loadAll();
      }
    } catch (err) {
      Alert.alert(
        "Action Failed",
        toErrorMessage(err, "Could not process request response."),
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Grant New Consent Submit
  const handleGrantSubmit = async () => {
    if (!selectedDoctorId) {
      Alert.alert(
        "Select Doctor",
        "Please select a verified doctor to grant access.",
      );
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert(
        "Select Categories",
        "Please select at least one health data category.",
      );
      return;
    }

    setSubmittingGrant(true);
    try {
      const res = await consentService.grantPatientConsent({
        granteeType: "doctor",
        doctorId: selectedDoctorId,
        dataCategories: selectedCategories,
        purpose: consentPurpose,
        duration: consentDuration,
        familyMemberId:
          familyMemberFilter !== "all" && familyMemberFilter !== "self"
            ? familyMemberFilter
            : undefined,
      });

      if (res.success) {
        Alert.alert(
          "Consent Granted",
          `Access granted successfully to Dr. ${res.consent.doctorName || "Doctor"}.`,
        );
        setActiveTab("active");
        await loadAll();
      }
    } catch (err) {
      Alert.alert(
        "Failed to Grant Consent",
        toErrorMessage(err, "Unable to grant consent."),
      );
    } finally {
      setSubmittingGrant(false);
    }
  };

  const toggleCategory = (cat: ConsentCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const activeConsents = useMemo(() => {
    return (consentsData?.consents || []).filter((c) => c.status === "active");
  }, [consentsData]);

  const pendingRequests = useMemo(() => {
    return (consentsData?.consents || []).filter((c) => c.status === "pending");
  }, [consentsData]);

  const pendingClinicalAuths = useMemo(() => {
    return clinicalAuthorizations.filter((a) => a.status === "pending");
  }, [clinicalAuthorizations]);

  const historicalConsents = useMemo(() => {
    return (consentsData?.consents || []).filter(
      (c) => c.status === "revoked" || c.status === "expired",
    );
  }, [consentsData]);

  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Privacy & Consent Center"
        subtitle="Manage who accesses your healthcare data"
      />

      {/* Family Member Switcher */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={(id) => setFamilyMemberFilter(id)}
      />

      {/* Overview Metric KPI Cards */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricsRow}>
          <Card
            style={[styles.metricCard, { borderLeftColor: Palette.primary }]}
          >
            <View style={styles.metricIconWrap}>
              <Ionicons name="medkit" size={18} color={Palette.primary} />
            </View>
            <View>
              <Text style={styles.metricValue}>
                {clinicalAuthorizations.length}
              </Text>
              <Text style={styles.metricLabel}>Care Authorizations</Text>
            </View>
          </Card>

          <Card
            style={[styles.metricCard, { borderLeftColor: Palette.success }]}
          >
            <View style={styles.metricIconWrap}>
              <Ionicons
                name="shield-checkmark"
                size={18}
                color={Palette.success}
              />
            </View>
            <View>
              <Text style={styles.metricValue}>
                {consentsData?.counts.active ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Data Consents</Text>
            </View>
          </Card>

          <Card
            style={[styles.metricCard, { borderLeftColor: Palette.warning }]}
          >
            <View style={styles.metricIconWrap}>
              <Ionicons name="mail-unread" size={18} color={Palette.warning} />
            </View>
            <View>
              <Text style={styles.metricValue}>
                {(consentsData?.counts.pending ?? 0) +
                  pendingClinicalAuths.length}
              </Text>
              <Text style={styles.metricLabel}>Pending Action</Text>
            </View>
          </Card>

          <Card style={[styles.metricCard, { borderLeftColor: Palette.info }]}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="time" size={18} color={Palette.info} />
            </View>
            <View>
              <Text style={styles.metricValue}>
                {auditLogData?.pagination.total ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Audit Events</Text>
            </View>
          </Card>
        </View>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.tabNavContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "clinical" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("clinical")}
          >
            <Ionicons
              name="medkit-outline"
              size={15}
              color={
                activeTab === "clinical" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "clinical" && styles.tabTextActive,
              ]}
            >
              Clinical Authorizations ({clinicalAuthorizations.length})
            </Text>
            {pendingClinicalAuths.length > 0 ? (
              <View style={styles.badgeIndicator} />
            ) : null}
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "active" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("active")}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={
                activeTab === "active" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "active" && styles.tabTextActive,
              ]}
            >
              Active Consents ({activeConsents.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "pending" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("pending")}
          >
            <Ionicons
              name="mail-outline"
              size={15}
              color={
                activeTab === "pending" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "pending" && styles.tabTextActive,
              ]}
            >
              Requests{" "}
              {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ""}
            </Text>
            {pendingRequests.length > 0 ? (
              <View style={styles.badgeIndicator} />
            ) : null}
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "audit" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("audit")}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={
                activeTab === "audit" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "audit" && styles.tabTextActive,
              ]}
            >
              Access Log
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "grant" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("grant")}
          >
            <Ionicons
              name="add-circle-outline"
              size={15}
              color={
                activeTab === "grant" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "grant" && styles.tabTextActive,
              ]}
            >
              + Grant Access
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "policy" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("policy")}
          >
            <Ionicons
              name="lock-closed-outline"
              size={15}
              color={
                activeTab === "policy" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "policy" && styles.tabTextActive,
              ]}
            >
              Privacy Standards
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "exchanges" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("exchanges")}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={15}
              color={
                activeTab === "exchanges" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "exchanges" && styles.tabTextActive,
              ]}
            >
              Data Sharing ({interopHistory.length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Tab Views */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
      >
        {loading ? (
          <Loading label="Securing clinical permissions..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadAll} />
        ) : null}

        {/* TAB 0: CLINICAL AUTHORIZATIONS */}
        {activeTab === "clinical" && !loading && (
          <View style={styles.tabSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Clinical Consent & Treatment Authorizations
              </Text>
              <Text style={styles.sectionSubtitleText}>
                Appointment-specific acknowledgements, virtual care consents &
                care plans
              </Text>
            </View>

            {clinicalAuthorizations.length === 0 ? (
              <EmptyState
                title="No Clinical Authorizations"
                message="You currently have no clinical authorizations or treatment plan acknowledgements requested for your appointments."
              />
            ) : (
              clinicalAuthorizations.map((auth) => {
                const doc =
                  typeof auth.doctorId === "object" ? auth.doctorId : null;
                const docName = doc?.name || auth.doctorName || "Care Provider";
                const speciality =
                  doc?.speciality || auth.doctorSpeciality || "Physician";
                const hospName = auth.hospitalName || "HealPoint Hospital";
                const appt =
                  typeof auth.appointmentId === "object"
                    ? auth.appointmentId
                    : null;
                const apptDate = appt?.slotDate || "Appointment";
                const apptTime = appt?.slotTime || "";
                const isPending = auth.status === "pending";
                const isApproved = auth.status === "approved";
                const isDeclined = auth.status === "declined";
                const isRevoked = auth.status === "revoked";
                const isExpired = auth.status === "expired";
                const isActing = actionLoadingId === auth._id;

                const statusVariant: BadgeVariant = isApproved
                  ? "success"
                  : isPending
                    ? "warning"
                    : isDeclined
                      ? "error"
                      : "neutral";

                const typeLabels: Record<string, string> = {
                  consultation_acknowledgement: "In-Person Consultation Care",
                  online_consultation_acknowledgement:
                    "Telehealth Virtual Consent",
                  document_review_authorization: "External Document Review",
                  follow_up_care_acknowledgement: "Follow-Up Care Plan",
                  treatment_care_plan_acknowledgement:
                    "Prescribed Treatment Plan",
                };

                return (
                  <Card key={auth._id} style={styles.consentCard}>
                    <View style={styles.consentHeader}>
                      <View
                        style={[
                          styles.docAvatarBox,
                          {
                            backgroundColor: isPending
                              ? "rgba(245, 158, 11, 0.15)"
                              : Palette.primaryLight,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isPending ? "alert-circle" : "medkit"}
                          size={22}
                          color={isPending ? Palette.warning : Palette.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.docNameText}>
                              Dr. {docName}
                            </Text>
                            <Text style={styles.docSpecialityText}>
                              {speciality} · {hospName}
                            </Text>
                          </View>
                          <Badge
                            label={auth.status.toUpperCase()}
                            variant={statusVariant}
                          />
                        </View>
                        <View
                          style={{
                            marginTop: 4,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={Palette.textMuted}
                          />
                          <Text
                            style={{
                              ...Typography.caption,
                              color: Palette.textMuted,
                            }}
                          >
                            {apptDate} {apptTime ? `at ${apptTime}` : ""}
                          </Text>
                          {appt?.appointmentId && (
                            <Text
                              style={{
                                ...Typography.caption,
                                color: Palette.textMuted,
                              }}
                            >
                              (ID: {appt.appointmentId})
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.consentDivider} />

                    <View style={styles.scopeSection}>
                      <Text style={styles.scopeHeading}>
                        {auth.clinicalContext?.title ||
                          typeLabels[auth.authorizationType] ||
                          "Clinical Authorization"}
                      </Text>
                      <Text
                        style={{
                          ...Typography.body,
                          fontSize: 13,
                          color: Palette.text,
                          lineHeight: 18,
                        }}
                      >
                        {auth.clinicalContext?.summary || auth.purpose}
                      </Text>
                      {auth.clinicalContext?.notes ? (
                        <Text
                          style={{
                            ...Typography.caption,
                            color: Palette.textMuted,
                            marginTop: 4,
                            fontStyle: "italic",
                          }}
                        >
                          Notes: {auth.clinicalContext.notes}
                        </Text>
                      ) : null}
                    </View>

                    {isDeclined && auth.declinedReason ? (
                      <View
                        style={{
                          backgroundColor: "#FEE2E2",
                          padding: Spacing.sm,
                          borderRadius: Radius.sm,
                        }}
                      >
                        <Text
                          style={{ ...Typography.caption, color: "#991B1B" }}
                        >
                          Reason for declining: {auth.declinedReason}
                        </Text>
                      </View>
                    ) : null}

                    {isRevoked && auth.revocationReason ? (
                      <View
                        style={{
                          backgroundColor: "#F3F4F6",
                          padding: Spacing.sm,
                          borderRadius: Radius.sm,
                        }}
                      >
                        <Text
                          style={{ ...Typography.caption, color: "#4B5563" }}
                        >
                          Revocation reason: {auth.revocationReason}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.consentFooter}>
                      <View style={styles.expiryRow}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.expiryText}>
                          {isApproved && auth.grantedAt
                            ? `Authorized on ${new Date(auth.grantedAt).toLocaleDateString()}`
                            : isPending && auth.requestDetails?.requestedAt
                              ? `Requested on ${new Date(auth.requestDetails.requestedAt).toLocaleDateString()}`
                              : isDeclined && auth.respondedAt
                                ? `Declined on ${new Date(auth.respondedAt).toLocaleDateString()}`
                                : `Updated on ${new Date(auth.updatedAt).toLocaleDateString()}`}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: Spacing.xs }}>
                        {isPending && (
                          <Button
                            title="Review & Authorize"
                            variant="primary"
                            onPress={() => handleOpenAuthModal(auth)}
                          />
                        )}

                        {isApproved && (
                          <Button
                            title="Revoke"
                            variant="outline"
                            loading={isActing}
                            onPress={() => handleRevokeClinicalAuth(auth)}
                          />
                        )}
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 1: ACTIVE CONSENTS */}
        {activeTab === "active" && !loading && (
          <View style={styles.tabSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Active Care Provider Access
              </Text>
              <Text style={styles.sectionSubtitleText}>
                Doctors authorized to inspect your medical records
              </Text>
            </View>

            {activeConsents.length === 0 ? (
              <EmptyState
                title="No Active Consents"
                message="You have not granted explicit access to any doctor yet. You can grant access whenever you wish to share your health records."
                action={
                  <Button
                    title="Grant Consent"
                    variant="primary"
                    onPress={() => setActiveTab("grant")}
                  />
                }
              />
            ) : (
              activeConsents.map((consent) => {
                const doc =
                  typeof consent.doctorId === "object"
                    ? consent.doctorId
                    : null;
                const docName =
                  doc?.name || consent.doctorName || "Specialist Doctor";
                const speciality =
                  doc?.speciality ||
                  consent.doctorSpeciality ||
                  "Medical Specialist";
                const hospName =
                  consent.hospitalName ||
                  doc?.hospitalName ||
                  "HealPoint Network Hospital";
                const isActing = actionLoadingId === consent._id;

                return (
                  <Card key={consent._id} style={styles.consentCard}>
                    <View style={styles.consentHeader}>
                      <View style={styles.docAvatarBox}>
                        <Ionicons
                          name="medkit"
                          size={20}
                          color={Palette.primary}
                        />
                      </View>
                      <View style={styles.docInfoTexts}>
                        <View style={styles.docTitleRow}>
                          <Text style={styles.docNameText}>Dr. {docName}</Text>
                          <Badge label="Active" variant="success" />
                        </View>
                        <Text style={styles.docSpecialityText}>
                          {speciality} • {hospName}
                        </Text>
                        <Text style={styles.patientScopeText}>
                          Patient:{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {consent.patientName}
                          </Text>{" "}
                          ({consent.patientRelationship})
                        </Text>
                      </View>
                    </View>

                    {/* Purpose */}
                    <View style={styles.purposeBox}>
                      <Text style={styles.purposeLabel}>
                        Authorized Clinical Purpose:
                      </Text>
                      <Text style={styles.purposeText}>{consent.purpose}</Text>
                    </View>

                    {/* Categories Chips */}
                    <View style={styles.categoryPillsWrap}>
                      {consent.dataCategories.map((cat) => {
                        const meta = CATEGORY_LABELS[cat] || {
                          label: cat,
                          icon: "document-text-outline",
                        };
                        return (
                          <View key={cat} style={styles.categoryPill}>
                            <Ionicons
                              name={meta.icon}
                              size={12}
                              color={Palette.primaryDark}
                            />
                            <Text style={styles.categoryPillText}>
                              {meta.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Expiry & Actions Row */}
                    <View style={styles.consentFooter}>
                      <View style={styles.expiryInfo}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.expiryText}>
                          {consent.expiresAt
                            ? `Valid until ${formatDDMMYYYY(consent.expiresAt)}`
                            : "Ongoing Access"}
                        </Text>
                      </View>

                      <View style={styles.actionBtnRow}>
                        <Button
                          title="Extend"
                          variant="outline"
                          disabled={isActing}
                          onPress={() => {
                            setSelectedConsentToExtend(consent);
                            setExtendModalVisible(true);
                          }}
                        />
                        <Button
                          title="Revoke"
                          variant="danger"
                          loading={isActing}
                          onPress={() => handleRevoke(consent)}
                        />
                      </View>
                    </View>
                  </Card>
                );
              })
            )}

            {/* Historical Consents Accordion / List */}
            {historicalConsents.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>
                  Expired & Revoked Consents ({historicalConsents.length})
                </Text>
                {historicalConsents.map((c) => {
                  const doc =
                    typeof c.doctorId === "object" ? c.doctorId : null;
                  const name = doc?.name || c.doctorName || "Care Provider";
                  return (
                    <View key={c._id} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyDocName}>Dr. {name}</Text>
                        <Text style={styles.historyDetails}>
                          {c.status === "revoked"
                            ? "Revoked by patient"
                            : "Expired"}{" "}
                          • {c.dataCategories.join(", ")}
                        </Text>
                      </View>
                      <Badge
                        label={c.status === "revoked" ? "Revoked" : "Expired"}
                        variant={c.status === "revoked" ? "error" : "neutral"}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: PENDING DOCTOR REQUESTS */}
        {activeTab === "pending" && !loading && (
          <View style={styles.tabSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Pending Doctor Requests</Text>
              <Text style={styles.sectionSubtitleText}>
                Specialists who requested access to inspect your health records
              </Text>
            </View>

            {pendingRequests.length === 0 ? (
              <EmptyState
                title="All Clear!"
                message="You have no pending data access requests from doctors."
              />
            ) : (
              pendingRequests.map((req) => {
                const doc =
                  typeof req.doctorId === "object" ? req.doctorId : null;
                const docName = doc?.name || req.doctorName || "Doctor";
                const isActing = actionLoadingId === req._id;

                return (
                  <Card key={req._id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={styles.requestIconBox}>
                        <Ionicons
                          name="mail"
                          size={20}
                          color={Palette.warning}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docNameText}>Dr. {docName}</Text>
                        <Text style={styles.docSpecialityText}>
                          {req.doctorSpeciality || "Specialist"} •{" "}
                          {req.hospitalName || "HealPoint Hospital"}
                        </Text>
                      </View>
                      <Badge label="Requested" variant="warning" />
                    </View>

                    <View style={styles.requestBodyBox}>
                      <Text style={styles.requestPurposeLabel}>
                        Reason for Request:
                      </Text>
                      <Text style={styles.requestPurposeText}>
                        "{req.requestDetails?.requestMessage || req.purpose}"
                      </Text>
                    </View>

                    <View style={styles.categoryPillsWrap}>
                      {req.dataCategories.map((cat) => (
                        <View key={cat} style={styles.categoryPill}>
                          <Ionicons
                            name="lock-open-outline"
                            size={12}
                            color={Palette.primaryDark}
                          />
                          <Text style={styles.categoryPillText}>
                            {cat.replace("_", " ").toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.requestActionRow}>
                      <Button
                        title="Decline"
                        variant="outline"
                        disabled={isActing}
                        onPress={() => handleRequestResponse(req._id, "reject")}
                      />
                      <Button
                        title="Approve (30 Days)"
                        variant="primary"
                        loading={isActing}
                        onPress={() =>
                          handleRequestResponse(req._id, "approve")
                        }
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: ACCESS AUDIT TRAIL */}
        {activeTab === "audit" && !loading && (
          <View style={styles.tabSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Transparent Access Audit Trail
              </Text>
              <Text style={styles.sectionSubtitleText}>
                Every clinical record inspection is cryptographically logged
              </Text>
            </View>

            {!auditLogData || auditLogData.logs.length === 0 ? (
              <EmptyState
                title="No Access Activity Yet"
                message="No external care providers or doctors have accessed your records yet."
              />
            ) : (
              auditLogData.logs.map((log) => {
                const isBreakGlass = log.accessType === "emergency_break_glass";
                const isDenied = log.result === "denied";

                return (
                  <Card
                    key={log._id}
                    style={[
                      styles.auditCard,
                      isBreakGlass && styles.auditCardBreakGlass,
                      isDenied && styles.auditCardDenied,
                    ]}
                  >
                    <View style={styles.auditHeaderRow}>
                      <View style={styles.auditIconTitle}>
                        <Ionicons
                          name={
                            isBreakGlass
                              ? "alert-circle"
                              : isDenied
                                ? "ban"
                                : "checkmark-circle"
                          }
                          size={18}
                          color={
                            isBreakGlass
                              ? Palette.error
                              : isDenied
                                ? Palette.warning
                                : Palette.success
                          }
                        />
                        <Text style={styles.auditAccessorText}>
                          {log.accessorName || "Medical Practitioner"}
                        </Text>
                      </View>
                      <Badge
                        label={
                          isBreakGlass
                            ? "Break-Glass"
                            : isDenied
                              ? "Blocked"
                              : log.accessType === "encounter"
                                ? "Encounter"
                                : "Consent"
                        }
                        variant={
                          isBreakGlass
                            ? "error"
                            : isDenied
                              ? "warning"
                              : "success"
                        }
                      />
                    </View>

                    <Text style={styles.auditDetailText}>
                      Accessed:{" "}
                      <Text style={{ fontWeight: "700" }}>
                        {log.dataCategory.replace("_", " ")}
                      </Text>{" "}
                      • Purpose: {log.purpose}
                    </Text>

                    {isBreakGlass && log.breakGlassJustification && (
                      <View style={styles.breakGlassBox}>
                        <Text style={styles.breakGlassLabel}>
                          Emergency Clinical Justification:
                        </Text>
                        <Text style={styles.breakGlassReason}>
                          "{log.breakGlassJustification}"
                        </Text>
                      </View>
                    )}

                    <Text style={styles.auditTimestamp}>
                      {new Date(log.timestamp).toLocaleString()} • Hospital:{" "}
                      {log.hospitalName || "HealPoint Medical"}
                    </Text>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: GRANT NEW CONSENT */}
        {activeTab === "grant" && !loading && (
          <View style={styles.tabSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Grant Clinical Data Access
              </Text>
              <Text style={styles.sectionSubtitleText}>
                Authorize a trusted doctor to inspect your medical records
              </Text>
            </View>

            <Card style={styles.grantFormCard}>
              {/* Doctor Selector */}
              <Text style={styles.formFieldLabel}>Select Doctor</Text>
              {doctorsList.length === 0 ? (
                <Text style={styles.helperText}>
                  Loading available doctors...
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.doctorChipScroll}
                >
                  {doctorsList.slice(0, 10).map((d) => {
                    const isSelected = selectedDoctorId === d._id;
                    return (
                      <Pressable
                        key={d._id}
                        style={[
                          styles.doctorSelectChip,
                          isSelected && styles.doctorSelectChipActive,
                        ]}
                        onPress={() => setSelectedDoctorId(d._id)}
                      >
                        <Text
                          style={[
                            styles.doctorSelectChipName,
                            isSelected && styles.doctorSelectChipNameActive,
                          ]}
                        >
                          Dr. {d.name}
                        </Text>
                        <Text style={styles.doctorSelectChipSpeciality}>
                          {d.speciality || "Specialist"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Data Categories Checkboxes */}
              <Text style={[styles.formFieldLabel, { marginTop: Spacing.md }]}>
                Select Data to Share
              </Text>
              <View style={styles.checkboxGroup}>
                {(
                  [
                    "medical_records",
                    "prescriptions",
                    "reports",
                    "documents",
                    "vitals",
                  ] as ConsentCategory[]
                ).map((cat) => {
                  const isChecked = selectedCategories.includes(cat);
                  const meta = CATEGORY_LABELS[cat];
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.checkboxRow,
                        isChecked && styles.checkboxRowActive,
                      ]}
                      onPress={() => toggleCategory(cat)}
                    >
                      <Ionicons
                        name={isChecked ? "checkbox" : "square-outline"}
                        size={20}
                        color={isChecked ? Palette.primary : Palette.textMuted}
                      />
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text
                          style={[
                            styles.checkboxTitle,
                            isChecked && styles.checkboxTitleActive,
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Purpose */}
              <Text style={[styles.formFieldLabel, { marginTop: Spacing.md }]}>
                Clinical Purpose
              </Text>
              <TextInput
                style={styles.textInput}
                value={consentPurpose}
                onChangeText={setConsentPurpose}
                placeholder="e.g. Consultation Review, Second Opinion"
                placeholderTextColor={Palette.textMuted}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
              >
                {PURPOSE_SUGGESTIONS.map((p) => (
                  <Pressable
                    key={p}
                    style={styles.suggestionChip}
                    onPress={() => setConsentPurpose(p)}
                  >
                    <Text style={styles.suggestionChipText}>{p}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Duration Selector */}
              <Text style={[styles.formFieldLabel, { marginTop: Spacing.md }]}>
                Consent Duration
              </Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = consentDuration === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.durationChip,
                        isSelected && styles.durationChipActive,
                      ]}
                      onPress={() => setConsentDuration(opt.key)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          isSelected && styles.durationChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Submit Button */}
              <Button
                title="Authorize & Grant Access"
                variant="primary"
                loading={submittingGrant}
                style={{ marginTop: Spacing.xl }}
                onPress={handleGrantSubmit}
              />
            </Card>
          </View>
        )}

        {/* TAB 5: PRIVACY STANDARDS */}
        {activeTab === "policy" && (
          <View style={styles.tabSection}>
            <Card style={styles.heroCard}>
              <View style={styles.heroIconBox}>
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.heroTexts}>
                <View style={styles.heroBadgeRow}>
                  <Badge label="Clinical Grade Privacy" variant="success" />
                  <Badge label="TLS 1.3 Encrypted" variant="primary" />
                </View>
                <Text style={styles.heroTitle}>Your Health Data is Safe</Text>
                <Text style={styles.heroDesc}>
                  HealPoint adheres to modern healthcare data standards (HIPAA &
                  DISHA compliance principles). Your clinical consultations,
                  prescriptions, and identity remain completely private.
                </Text>
              </View>
            </Card>

            {POLICY_SECTIONS.map((section) => (
              <Card key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconWrap}>
                    <Ionicons
                      name={section.icon}
                      size={20}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.sectionHeaderTexts}>
                    <Text style={styles.sectionPolicyTitle}>
                      {section.title}
                    </Text>
                    <Text style={styles.sectionPolicySubtitle}>
                      {section.subtitle}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </Card>
            ))}

            <Card style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.contactTitle}>
                  Data Privacy & Access Inquiries
                </Text>
              </View>
              <Text style={styles.contactDesc}>
                To exercise your data privacy rights, request a copy of your
                records, or permanently delete your patient account, contact our
                Data Protection Officer:
              </Text>
              <Text
                style={styles.contactEmail}
                onPress={() =>
                  Linking.openURL("mailto:privacy@healpoint.app").catch(
                    () => undefined,
                  )
                }
              >
                privacy@healpoint.app
              </Text>
            </Card>
          </View>
        )}

        {/* TAB 7: DATA SHARING / INTEROPERABILITY EXCHANGES */}
        {activeTab === "exchanges" && !loading && (
          <View style={styles.tabSection}>
            <Card style={styles.heroCard}>
              <View style={styles.heroIconBox}>
                <Ionicons
                  name="swap-horizontal"
                  size={24}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.heroTexts}>
                <View style={styles.heroBadgeRow}>
                  <Badge label="Consent-First Release" variant="success" />
                  <Badge label="Zero Secret Leakage" variant="primary" />
                </View>
                <Text style={styles.heroTitle}>
                  External Healthcare Data Sharing
                </Text>
                <Text style={styles.heroDesc}>
                  Every transfer of your health documents, appointments, or
                  prescriptions to and from external hospitals, diagnostic
                  centers, and laboratories is logged below with full
                  transparency.
                </Text>
              </View>
            </Card>

            {interopHistory.length === 0 ? (
              <EmptyState
                title="Zero External Disclosures"
                message="None of your medical records or health documents have been shared with external healthcare systems. Your clinical data remains safely within HealPoint."
              />
            ) : (
              interopHistory.map((item) => (
                <Card key={item.exchangeId} style={styles.consentCard}>
                  <View style={styles.consentHeader}>
                    <View style={styles.docAvatarBox}>
                      <Ionicons
                        name="swap-horizontal"
                        size={20}
                        color={Palette.primary}
                      />
                    </View>
                    <View style={styles.docInfoTexts}>
                      <View style={styles.docTitleRow}>
                        <Text style={styles.docNameText}>
                          {item.recipientOrganization}
                        </Text>
                        <Badge
                          label={item.status.toUpperCase()}
                          variant={
                            item.status === "processed" ||
                            item.status === "accepted"
                              ? "success"
                              : "neutral"
                          }
                        />
                      </View>
                      <Text style={styles.docSpecialityText}>
                        {item.recipientType} •{" "}
                        {item.direction === "inbound"
                          ? "Inbound Ingestion"
                          : "Outbound Disclosure"}
                      </Text>
                      <Text style={styles.patientScopeText}>
                        Transaction:{" "}
                        <Text style={{ fontWeight: "700" }}>
                          {item.exchangeId}
                        </Text>{" "}
                        • {formatDDMMYYYY(item.timestamp)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.categoryPillsWrap}>
                    {item.sharedDataScope.map((scope) => (
                      <View key={scope} style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{scope}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* EXTEND VALIDITY MODAL */}
      <Modal
        visible={extendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExtendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="time" size={24} color={Palette.primary} />
              <Text style={styles.modalTitle}>Extend Access Validity</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Extend Dr. {selectedConsentToExtend?.doctorName || "Doctor"}'s
              permission to access your health records.
            </Text>

            <View style={styles.durationOptionsCol}>
              {(["7_days", "30_days", "90_days", "1_year"] as const).map(
                (d) => {
                  const isSelected = selectedExtensionDuration === d;
                  const label = d.replace("_", " ").toUpperCase();
                  return (
                    <Pressable
                      key={d}
                      style={[
                        styles.modalDurationRow,
                        isSelected && styles.modalDurationRowActive,
                      ]}
                      onPress={() => setSelectedExtensionDuration(d)}
                    >
                      <Ionicons
                        name={
                          isSelected ? "radio-button-on" : "radio-button-off"
                        }
                        size={18}
                        color={isSelected ? Palette.primary : Palette.textMuted}
                      />
                      <Text
                        style={[
                          styles.modalDurationText,
                          isSelected && styles.modalDurationTextActive,
                        ]}
                      >
                        +{label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setExtendModalVisible(false)}
              />
              <Button
                title="Confirm Extension"
                variant="primary"
                onPress={handleExtendConfirm}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* CLINICAL AUTHORIZATION REVIEW & ACTION MODAL */}
      <Modal
        visible={authModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          !submittingAuthAction && setAuthModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="clipboard-outline"
                size={24}
                color={Palette.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Clinical Authorization</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedClinicalAuth?.authorizationType
                    ? CLINICAL_AUTH_TYPE_META[
                        selectedClinicalAuth.authorizationType
                      ]?.label
                    : "Treatment Acknowledgement"}
                </Text>
              </View>
            </View>

            {selectedClinicalAuth && (
              <View style={{ gap: Spacing.sm }}>
                <View style={styles.authInfoCard}>
                  <Text style={styles.authInfoDoc}>
                    Dr.{" "}
                    {typeof selectedClinicalAuth.doctorId === "object" &&
                    selectedClinicalAuth.doctorId
                      ? selectedClinicalAuth.doctorId.name
                      : "Attending Physician"}
                  </Text>
                  <Text style={styles.authInfoHospital}>
                    {typeof selectedClinicalAuth.hospitalId === "object" &&
                    selectedClinicalAuth.hospitalId
                      ? selectedClinicalAuth.hospitalId.name
                      : "Hospital Partner"}
                  </Text>
                </View>

                <View style={styles.authContextBox}>
                  <Text style={styles.authContextTitle}>
                    {selectedClinicalAuth.clinicalContext?.title ||
                      selectedClinicalAuth.purpose}
                  </Text>
                  {!!selectedClinicalAuth.clinicalContext?.summary && (
                    <Text style={styles.authContextSummary}>
                      {selectedClinicalAuth.clinicalContext.summary}
                    </Text>
                  )}
                  {!!selectedClinicalAuth.clinicalContext?.notes && (
                    <Text style={styles.authContextNotes}>
                      {selectedClinicalAuth.clinicalContext.notes}
                    </Text>
                  )}
                  {!!selectedClinicalAuth.clinicalContext?.actionRequired && (
                    <View style={styles.authActionReqBadge}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={14}
                        color={Palette.warning}
                      />
                      <Text style={styles.authActionReqText}>
                        {selectedClinicalAuth.clinicalContext.actionRequired}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Optional Decline Reason Input */}
                <View style={{ marginTop: Spacing.xs }}>
                  <Text style={styles.inputLabel}>
                    Reason (only if declining):
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter reason if declining..."
                    placeholderTextColor={Palette.textMuted}
                    value={declineReasonInput}
                    onChangeText={setDeclineReasonInput}
                    editable={!submittingAuthAction}
                  />
                </View>

                <View style={styles.modalActionRow}>
                  <Button
                    title="Close"
                    variant="outline"
                    disabled={submittingAuthAction}
                    onPress={() => setAuthModalVisible(false)}
                  />
                  <Button
                    title="Decline"
                    variant="danger"
                    loading={submittingAuthAction}
                    onPress={() => handleRespondClinicalAuth("decline")}
                  />
                  <Button
                    title="Authorize"
                    variant="primary"
                    loading={submittingAuthAction}
                    onPress={() => handleRespondClinicalAuth("approve")}
                  />
                </View>
              </View>
            )}
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  metricsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    ...Shadows.card,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    ...Typography.label,
    fontSize: 15,
    color: Palette.text,
  },
  metricLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  tabNavContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  tabScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  tabText: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  badgeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.warning,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  tabSection: {
    gap: Spacing.md,
  },
  sectionHeaderRow: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
  sectionSubtitleText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  consentCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  consentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  docAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  docInfoTexts: {
    flex: 1,
    gap: 2,
  },
  docTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  docNameText: {
    ...Typography.label,
    fontSize: 15,
    color: Palette.text,
  },
  docSpecialityText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "500",
  },
  patientScopeText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  purposeBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 2,
  },
  purposeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  purposeText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  categoryPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  categoryPillText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  consentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
    marginTop: 4,
  },
  expiryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expiryText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  historySection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.sm,
  },
  historySectionTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.textMuted,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  historyDocName: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  historyDetails: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  requestCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.warning,
    ...Shadows.card,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  requestIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  requestBodyBox: {
    backgroundColor: "rgba(234, 179, 8, 0.06)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 2,
  },
  requestPurposeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  requestPurposeText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontStyle: "italic",
  },
  requestActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  auditCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
    ...Shadows.card,
  },
  auditCardBreakGlass: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.error,
    backgroundColor: "rgba(239, 68, 68, 0.03)",
  },
  auditCardDenied: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.warning,
  },
  auditHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  auditIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  auditAccessorText: {
    ...Typography.label,
    fontSize: 14,
    color: Palette.text,
  },
  auditDetailText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 12,
  },
  breakGlassBox: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: Spacing.xs,
    borderRadius: Radius.xs,
    marginTop: 2,
  },
  breakGlassLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.error,
    fontWeight: "700",
  },
  breakGlassReason: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
    fontStyle: "italic",
  },
  auditTimestamp: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 2,
  },
  grantFormCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  formFieldLabel: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
    marginBottom: 4,
  },
  helperText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorChipScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  doctorSelectChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    marginRight: Spacing.xs,
  },
  doctorSelectChipActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  doctorSelectChipName: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
  },
  doctorSelectChipNameActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  doctorSelectChipSpeciality: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  checkboxGroup: {
    gap: Spacing.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  checkboxRowActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  checkboxTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  checkboxTitleActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: Palette.text,
    fontSize: 13,
    backgroundColor: Palette.surface,
  },
  suggestionChip: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginRight: 6,
  },
  suggestionChipText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  durationChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  durationChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  durationChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  durationChipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  heroCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.22)",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTexts: {
    gap: 4,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  heroTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  heroDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  sectionPolicyTitle: {
    ...Typography.label,
    fontSize: 15,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  sectionPolicySubtitle: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "500",
  },
  sectionBody: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 21,
    marginTop: 2,
  },
  contactCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  contactTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  contactDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  contactEmail: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  durationOptionsCol: {
    gap: Spacing.xs,
  },
  modalDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modalDurationRowActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  modalDurationText: {
    ...Typography.label,
    color: Palette.text,
  },
  modalDurationTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  authInfoCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  authInfoDoc: {
    ...Typography.label,
    fontSize: 14,
    color: Palette.text,
  },
  authInfoHospital: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  authContextBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  authContextTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  authContextSummary: {
    ...Typography.bodySmall,
    fontSize: 12,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  authContextNotes: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  authActionReqBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
  },
  authActionReqText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.warning,
    fontWeight: "600",
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    marginBottom: 4,
  },
  consentDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.xs,
  },
  scopeSection: {
    gap: 2,
    marginVertical: 2,
  },
  scopeHeading: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
