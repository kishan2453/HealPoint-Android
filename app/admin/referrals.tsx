/**
 * HealPoint - Hospital Admin · Referral Network & Continuity Exchange.
 * Production-grade inter-hospital referral coordination workflow:
 * - Scoped strictly to logged-in Hospital Admin's facility via backend access control
 * - Real-time statistics: Incoming Total, Pending Review, Accepted, Outgoing Total
 * - Incoming Referral Triage: Department assignment, Doctor assignment, Acceptance/Decline
 * - Patient Consent Gate visibility & protection
 * - Outgoing Referral Tracking: Status across participating network hospitals
 * - Network Directory: Participating partner hospitals
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
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

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import * as adminService from "@/services/admin";
import { toErrorMessage } from "@/services/api";
import {
  acceptNetworkReferral,
  assignReferralDepartment,
  assignReferralDoctor,
  declineNetworkReferral,
  getHospitalIncomingNetworkReferrals,
  getHospitalNetworkStats,
  getHospitalOutgoingNetworkReferrals,
  getNetworkHospitals,
} from "@/services/clinical-referral";
import type {
  ClinicalReferralRecord,
  Doctor,
  HospitalDepartment,
  HospitalNetworkStatsResponse,
  NetworkReferralHospitalItem,
} from "@/types";

type ActiveTab = "incoming" | "outgoing" | "network";

export default function AdminReferralNetworkScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("incoming");
  const [stats, setStats] = useState<HospitalNetworkStatsResponse | null>(null);
  const [incomingReferrals, setIncomingReferrals] = useState<
    ClinicalReferralRecord[]
  >([]);
  const [outgoingReferrals, setOutgoingReferrals] = useState<
    ClinicalReferralRecord[]
  >([]);
  const [networkHospitals, setNetworkHospitals] = useState<
    NetworkReferralHospitalItem[]
  >([]);

  // Triage dependencies
  const [hospitalDepartments, setHospitalDepartments] = useState<
    HospitalDepartment[]
  >([]);
  const [hospitalDoctors, setHospitalDoctors] = useState<Doctor[]>([]);

  // Filtering
  const [incomingFilter, setIncomingFilter] = useState<string>("all");
  const [outgoingFilter, setOutgoingFilter] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modals
  const [selectedReferral, setSelectedReferral] =
    useState<ClinicalReferralRecord | null>(null);
  const [assignDeptModalOpen, setAssignDeptModalOpen] = useState(false);
  const [assignDocModalOpen, setAssignDocModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  // Modal forms
  const [selectedDeptName, setSelectedDeptName] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [
        statsRes,
        incomingRes,
        outgoingRes,
        hospitalsRes,
        deptRes,
        docRes,
      ] = await Promise.all([
        getHospitalNetworkStats().catch(() => null),
        getHospitalIncomingNetworkReferrals({
          networkStatus: incomingFilter !== "all" ? incomingFilter : undefined,
        }).catch(() => ({ referrals: [] })),
        getHospitalOutgoingNetworkReferrals({
          status: outgoingFilter !== "all" ? outgoingFilter : undefined,
        }).catch(() => ({ referrals: [] })),
        getNetworkHospitals().catch(() => ({ hospitals: [] })),
        adminService
          .getHospitalDepartments()
          .catch(() => ({ departments: [] })),
        adminService
          .getHospitalDoctors({ status: "active" })
          .catch(() => ({ doctors: [] })),
      ]);

      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
      setIncomingReferrals(incomingRes.referrals || []);
      setOutgoingReferrals(outgoingRes.referrals || []);
      setNetworkHospitals(hospitalsRes.hospitals || []);
      setHospitalDepartments(deptRes.departments || []);
      setHospitalDoctors(docRes.doctors || []);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [incomingFilter, outgoingFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Actions
  const handleAssignDepartment = async () => {
    if (!selectedReferral || !selectedDeptName.trim()) {
      Alert.alert("Validation", "Please select a department to assign.");
      return;
    }
    setSubmittingAction(true);
    try {
      await assignReferralDepartment(selectedReferral._id, {
        department: selectedDeptName.trim(),
      });
      setActionSuccess("Department successfully assigned to referral case.");
      setAssignDeptModalOpen(false);
      setSelectedReferral(null);
      setSelectedDeptName("");
      loadData();
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedReferral || !selectedDocId) {
      Alert.alert("Validation", "Please select an active doctor to assign.");
      return;
    }
    setSubmittingAction(true);
    try {
      await assignReferralDoctor(selectedReferral._id, {
        doctorId: selectedDocId,
      });
      setActionSuccess("Doctor successfully assigned to referral case.");
      setAssignDocModalOpen(false);
      setSelectedReferral(null);
      setSelectedDocId("");
      loadData();
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAcceptReferral = async (referral: ClinicalReferralRecord) => {
    Alert.alert(
      "Accept Case",
      `Accept incoming referral from ${
        referral.originatingHospitalName || "originating facility"
      }? This will advance the case and enable appointment scheduling.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Accept",
          onPress: async () => {
            try {
              await acceptNetworkReferral(referral._id);
              setActionSuccess("Referral case accepted by receiving hospital.");
              loadData();
            } catch (err) {
              Alert.alert("Error", toErrorMessage(err));
            }
          },
        },
      ],
    );
  };

  const handleDeclineReferral = async () => {
    if (!selectedReferral || !declineReason.trim()) {
      Alert.alert("Validation", "A valid reason for declining is mandatory.");
      return;
    }
    setSubmittingAction(true);
    try {
      await declineNetworkReferral(selectedReferral._id, {
        declineReason: declineReason.trim(),
      });
      setActionSuccess("Referral case has been declined.");
      setDeclineModalOpen(false);
      setSelectedReferral(null);
      setDeclineReason("");
      loadData();
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err));
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return <Badge label="EMERGENCY" variant="error" />;
      case "urgent":
        return <Badge label="URGENT" variant="warning" />;
      case "priority":
        return <Badge label="PRIORITY" variant="primary" />;
      default:
        return <Badge label="ROUTINE" variant="neutral" />;
    }
  };

  const renderConsentBadge = (referral: ClinicalReferralRecord) => {
    const status = referral.patientAuthorization?.status;
    if (status === "approved") {
      return <Badge label="Consent Approved" variant="success" />;
    }
    if (status === "pending") {
      return <Badge label="Consent Pending" variant="warning" />;
    }
    if (status === "declined") {
      return <Badge label="Consent Declined" variant="error" />;
    }
    return <Badge label="Consent Not Required" variant="neutral" />;
  };

  const renderNetworkStatusBadge = (status?: string) => {
    switch (status) {
      case "pending_patient_authorization":
        return <Badge label="Awaiting Consent" variant="warning" />;
      case "pending_receiving_review":
        return <Badge label="Pending Review" variant="warning" />;
      case "department_assigned":
        return <Badge label="Dept Assigned" variant="primary" />;
      case "doctor_assigned":
        return <Badge label="Doctor Assigned" variant="primary" />;
      case "receiving_accepted":
        return <Badge label="Case Accepted" variant="success" />;
      case "appointment_booked":
        return <Badge label="Booked" variant="success" />;
      case "completed":
        return <Badge label="Completed" variant="neutral" />;
      case "receiving_declined":
        return <Badge label="Declined" variant="error" />;
      default:
        return <Badge label={status || "Active"} variant="neutral" />;
    }
  };

  return (
    <AdminModuleScreen
      title="Referral Network"
      subtitle="Inter-Hospital Coordination & Continuity Exchange"
      allowedRoles={["admin", "super_admin"]}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Action Notification Banner */}
        {actionSuccess ? (
          <View style={styles.bannerSuccess}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={Palette.success}
            />
            <Text style={styles.bannerSuccessText}>{actionSuccess}</Text>
            <Pressable onPress={() => setActionSuccess("")}>
              <Ionicons name="close" size={16} color={Palette.success} />
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <View style={{ marginBottom: 8 }}>
            <FormMessage type="error" message={error} />
          </View>
        ) : null}

        {/* KPI Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <StatCard
              label="Incoming Referrals"
              value={stats ? stats.incomingTotal : 0}
              icon="arrow-down-circle-outline"
              accent={Palette.primary}
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Pending Review"
              value={stats ? stats.incomingPendingReview : 0}
              icon="hourglass-outline"
              accent={Palette.warning}
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Accepted Cases"
              value={stats ? stats.incomingAccepted : 0}
              icon="checkmark-circle-outline"
              accent={Palette.success}
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Outgoing Referrals"
              value={stats ? stats.outgoingTotal : 0}
              icon="arrow-up-circle-outline"
              accent={Palette.primaryDark}
            />
          </View>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "incoming" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("incoming")}
          >
            <Ionicons
              name="arrow-down-circle"
              size={16}
              color={
                activeTab === "incoming" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "incoming" && styles.tabTextActive,
              ]}
            >
              Incoming ({incomingReferrals.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "outgoing" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("outgoing")}
          >
            <Ionicons
              name="arrow-up-circle"
              size={16}
              color={
                activeTab === "outgoing" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "outgoing" && styles.tabTextActive,
              ]}
            >
              Outgoing ({outgoingReferrals.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "network" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("network")}
          >
            <Ionicons
              name="business"
              size={16}
              color={
                activeTab === "network" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "network" && styles.tabTextActive,
              ]}
            >
              Partner Hospitals ({networkHospitals.length})
            </Text>
          </Pressable>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Palette.primary} />
            <Text style={styles.loadingText}>
              Loading referral network data...
            </Text>
          </View>
        ) : null}

        {/* TAB 1: INCOMING REFERRALS */}
        {!loading && activeTab === "incoming" ? (
          <View style={styles.section}>
            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}
            >
              {[
                { id: "all", label: "All Cases" },
                { id: "pending_receiving_review", label: "Pending Review" },
                { id: "department_assigned", label: "Dept Assigned" },
                { id: "doctor_assigned", label: "Doctor Assigned" },
                { id: "receiving_accepted", label: "Accepted" },
                { id: "receiving_declined", label: "Declined" },
              ].map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setIncomingFilter(f.id)}
                  style={[
                    styles.filterChip,
                    incomingFilter === f.id && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      incomingFilter === f.id && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {incomingReferrals.length === 0 ? (
              <EmptyState
                title="No Incoming Referrals"
                message="No incoming inter-hospital referral cases found for your facility."
              />
            ) : (
              incomingReferrals.map((referral) => {
                const isConsentPending =
                  referral.patientAuthorization?.status === "pending";
                const isDeclined = referral.status === "declined";
                const isAccepted =
                  referral.networkStatus === "receiving_accepted" ||
                  referral.networkStatus === "appointment_booked" ||
                  referral.networkStatus === "completed";

                return (
                  <Card key={referral._id} style={styles.referralCard}>
                    {/* Referral Header */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardBadgeGroup}>
                        <Badge
                          label={`REF #${referral.referralDisplayId || referral._id.slice(-6).toUpperCase()}`}
                          variant="neutral"
                        />
                        {renderUrgencyBadge(referral.urgency)}
                        {renderNetworkStatusBadge(referral.networkStatus)}
                      </View>
                      {renderConsentBadge(referral)}
                    </View>

                    {/* Route Overview */}
                    <View style={styles.routeBox}>
                      <View style={styles.routeHospitalCol}>
                        <Text style={styles.routeHospitalLabel}>ORIGIN</Text>
                        <Text
                          style={styles.routeHospitalName}
                          numberOfLines={1}
                        >
                          {referral.originatingHospitalName ||
                            "Origin Hospital"}
                        </Text>
                        <Text style={styles.routeDoctorName} numberOfLines={1}>
                          Dr.{" "}
                          {referral.referringDoctorName || "Referring Doctor"}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={Palette.primary}
                        style={styles.routeArrow}
                      />
                      <View style={styles.routeHospitalCol}>
                        <Text style={styles.routeHospitalLabel}>
                          DESTINATION
                        </Text>
                        <Text
                          style={styles.routeHospitalName}
                          numberOfLines={1}
                        >
                          {referral.receivingHospitalName || "Your Hospital"}
                        </Text>
                        <Text style={styles.routeDoctorName} numberOfLines={1}>
                          {referral.receivingDoctorName
                            ? `Dr. ${referral.receivingDoctorName}`
                            : "Doctor Unassigned"}
                        </Text>
                      </View>
                    </View>

                    {/* Patient & Assignment Information */}
                    <View style={styles.infoGrid}>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Patient Name</Text>
                        <Text style={styles.infoVal}>
                          {isConsentPending
                            ? "[Protected: Consent Pending]"
                            : referral.patientName || "Confidential Patient"}
                        </Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Requested Dept</Text>
                        <Text style={styles.infoVal}>
                          {referral.department || "General"}
                        </Text>
                      </View>
                      {referral.assignedByAdmin?.adminName ? (
                        <View style={styles.infoColFull}>
                          <Text style={styles.infoLabel}>Triaged By Admin</Text>
                          <Text style={styles.infoValSub}>
                            {referral.assignedByAdmin.adminName} on{" "}
                            {new Date(
                              referral.assignedByAdmin.assignedAt ||
                                referral.updatedAt,
                            ).toLocaleDateString()}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Clinical Reason & Summary */}
                    <View style={styles.clinicalNotesBox}>
                      <Text style={styles.clinicalNotesLabel}>
                        Reason for Referral
                      </Text>
                      <Text style={styles.clinicalNotesText}>
                        {referral.reasonForReferral}
                      </Text>

                      <Text
                        style={[styles.clinicalNotesLabel, { marginTop: 8 }]}
                      >
                        Clinical Context / Summary
                      </Text>
                      <Text style={styles.clinicalNotesText}>
                        {isConsentPending
                          ? "[Protected: Clinical notes are withheld until the patient authorizes inter-hospital data exchange.]"
                          : referral.clinicalSummary || "No summary provided."}
                      </Text>
                    </View>

                    {/* Decline Reason Banner if declined */}
                    {referral.decline?.declineReason ? (
                      <View style={styles.declineReasonBox}>
                        <Ionicons
                          name="alert-circle"
                          size={16}
                          color={Palette.error}
                        />
                        <Text style={styles.declineReasonText}>
                          Decline Reason: {referral.decline.declineReason}
                        </Text>
                      </View>
                    ) : null}

                    {/* Actions for Receiving Admin */}
                    {!isDeclined && !isAccepted ? (
                      <View style={styles.cardActionsRow}>
                        <Button
                          variant="outline"
                          title={
                            referral.department
                              ? `Dept: ${referral.department}`
                              : "Assign Dept"
                          }
                          onPress={() => {
                            setSelectedReferral(referral);
                            setSelectedDeptName(referral.department || "");
                            setAssignDeptModalOpen(true);
                          }}
                          style={styles.actionBtn}
                        />

                        <Button
                          variant="outline"
                          title={
                            referral.receivingDoctorId
                              ? "Reassign Doctor"
                              : "Assign Doctor"
                          }
                          onPress={() => {
                            setSelectedReferral(referral);
                            setSelectedDocId(
                              typeof referral.receivingDoctorId === "object" &&
                                referral.receivingDoctorId
                                ? referral.receivingDoctorId._id
                                : typeof referral.receivingDoctorId === "string"
                                  ? referral.receivingDoctorId
                                  : "",
                            );
                            setAssignDocModalOpen(true);
                          }}
                          style={styles.actionBtn}
                        />

                        <Button
                          variant="primary"
                          title="Accept Case"
                          onPress={() => handleAcceptReferral(referral)}
                          style={styles.actionBtn}
                        />

                        <Button
                          variant="danger"
                          title="Decline"
                          onPress={() => {
                            setSelectedReferral(referral);
                            setDeclineReason("");
                            setDeclineModalOpen(true);
                          }}
                          style={styles.actionBtn}
                        />
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        ) : null}

        {/* TAB 2: OUTGOING REFERRALS */}
        {!loading && activeTab === "outgoing" ? (
          <View style={styles.section}>
            {outgoingReferrals.length === 0 ? (
              <EmptyState
                title="No Outgoing Referrals"
                message="No outgoing inter-hospital referrals initiated by your doctors yet."
              />
            ) : (
              outgoingReferrals.map((referral) => (
                <Card key={referral._id} style={styles.referralCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardBadgeGroup}>
                      <Badge
                        label={`REF #${referral.referralDisplayId || referral._id.slice(-6).toUpperCase()}`}
                        variant="neutral"
                      />
                      {renderUrgencyBadge(referral.urgency)}
                      {renderNetworkStatusBadge(referral.networkStatus)}
                    </View>
                    {renderConsentBadge(referral)}
                  </View>

                  <View style={styles.routeBox}>
                    <View style={styles.routeHospitalCol}>
                      <Text style={styles.routeHospitalLabel}>SENT FROM</Text>
                      <Text style={styles.routeHospitalName} numberOfLines={1}>
                        {referral.originatingHospitalName || "Your Hospital"}
                      </Text>
                      <Text style={styles.routeDoctorName} numberOfLines={1}>
                        Dr. {referral.referringDoctorName || "Referring Doctor"}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={Palette.primary}
                      style={styles.routeArrow}
                    />
                    <View style={styles.routeHospitalCol}>
                      <Text style={styles.routeHospitalLabel}>SENT TO</Text>
                      <Text style={styles.routeHospitalName} numberOfLines={1}>
                        {referral.receivingHospitalName || "Partner Hospital"}
                      </Text>
                      <Text style={styles.routeDoctorName} numberOfLines={1}>
                        {referral.receivingDoctorName
                          ? `Dr. ${referral.receivingDoctorName}`
                          : "Receiving Team"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Patient</Text>
                      <Text style={styles.infoVal}>
                        {referral.patientName || "Patient"}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={styles.infoLabel}>Target Specialty</Text>
                      <Text style={styles.infoVal}>
                        {referral.targetSpeciality || referral.department}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.clinicalNotesBox}>
                    <Text style={styles.clinicalNotesLabel}>
                      Clinical Reason
                    </Text>
                    <Text style={styles.clinicalNotesText}>
                      {referral.reasonForReferral}
                    </Text>
                  </View>

                  {referral.status === "accepted" ? (
                    <View style={styles.acceptedBanner}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={Palette.success}
                      />
                      <Text style={styles.acceptedBannerText}>
                        Accepted by {referral.receivingHospitalName}. Specialist
                        booking is authorized.
                      </Text>
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}

        {/* TAB 3: PARTNER NETWORK HOSPITALS */}
        {!loading && activeTab === "network" ? (
          <View style={styles.section}>
            {networkHospitals.length === 0 ? (
              <EmptyState
                title="No Network Partners"
                message="No other active verified hospitals found in the continuity exchange network."
              />
            ) : (
              networkHospitals.map((hosp) => (
                <Card key={hosp._id} style={styles.hospitalCard}>
                  <View style={styles.hospitalHeader}>
                    <View style={styles.hospitalAvatar}>
                      <Ionicons
                        name="business"
                        size={24}
                        color={Palette.primary}
                      />
                    </View>
                    <View style={styles.hospitalHeaderInfo}>
                      <Text style={styles.hospitalName}>{hosp.name}</Text>
                      <Text style={styles.hospitalAddress} numberOfLines={1}>
                        {hosp.address || "Verified Healthcare Facility"}
                      </Text>
                    </View>
                    <Badge label="Network Partner" variant="success" />
                  </View>

                  <View style={styles.hospitalStatsRow}>
                    <View style={styles.hospitalStatItem}>
                      <Ionicons
                        name="layers-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.hospitalStatText}>
                        {(hosp.departments || []).length} Departments
                      </Text>
                    </View>
                    <View style={styles.hospitalStatItem}>
                      <Ionicons
                        name="medkit-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.hospitalStatText}>
                        {hosp.totalDoctors || 0} Doctors
                      </Text>
                    </View>
                    <View style={styles.hospitalStatItem}>
                      <Ionicons
                        name="call-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.hospitalStatText}>
                        {hosp.phone || "On File"}
                      </Text>
                    </View>
                  </View>

                  {hosp.departments && hosp.departments.length > 0 ? (
                    <View style={styles.deptPillsRow}>
                      {hosp.departments.slice(0, 5).map((d) => (
                        <View key={d} style={styles.deptPill}>
                          <Text style={styles.deptPillText}>{d}</Text>
                        </View>
                      ))}
                      {hosp.departments.length > 5 ? (
                        <Text style={styles.deptMoreText}>
                          +{hosp.departments.length - 5} more
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* MODAL 1: ASSIGN DEPARTMENT */}
      <Modal
        visible={assignDeptModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignDeptModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Hospital Department</Text>
              <Pressable onPress={() => setAssignDeptModalOpen(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select the appropriate department in your hospital for this
              referral case:
            </Text>

            <ScrollView style={styles.deptListScroll}>
              {hospitalDepartments.map((dept) => {
                const isSelected = selectedDeptName === dept.name;
                return (
                  <Pressable
                    key={dept._id || dept.name}
                    onPress={() => setSelectedDeptName(dept.name)}
                    style={[
                      styles.modalOptionItem,
                      isSelected && styles.modalOptionItemSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        isSelected
                          ? "radio-button-on"
                          : "radio-button-off-outline"
                      }
                      size={20}
                      color={isSelected ? Palette.primary : Palette.textMuted}
                    />
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {dept.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => setAssignDeptModalOpen(false)}
                style={styles.modalBtn}
              />
              <Button
                variant="primary"
                title="Save Department"
                loading={submittingAction}
                onPress={handleAssignDepartment}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: ASSIGN DOCTOR */}
      <Modal
        visible={assignDocModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignDocModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Attending Doctor</Text>
              <Pressable onPress={() => setAssignDocModalOpen(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select an active doctor from your facility to manage this
              referral:
            </Text>

            <ScrollView style={styles.deptListScroll}>
              {hospitalDoctors.map((doc) => {
                const isSelected = selectedDocId === doc._id;
                return (
                  <Pressable
                    key={doc._id}
                    onPress={() => setSelectedDocId(doc._id)}
                    style={[
                      styles.modalOptionItem,
                      isSelected && styles.modalOptionItemSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        isSelected
                          ? "radio-button-on"
                          : "radio-button-off-outline"
                      }
                      size={20}
                      color={isSelected ? Palette.primary : Palette.textMuted}
                    />
                    <View style={styles.modalDocDetails}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          isSelected && styles.modalOptionTextSelected,
                        ]}
                      >
                        Dr. {doc.name}
                      </Text>
                      <Text style={styles.modalDocSub}>
                        {doc.speciality || "General"} ·{" "}
                        {doc.department || "Medical"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => setAssignDocModalOpen(false)}
                style={styles.modalBtn}
              />
              <Button
                variant="primary"
                title="Assign Doctor"
                loading={submittingAction}
                onPress={handleAssignDoctor}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: DECLINE REFERRAL */}
      <Modal
        visible={declineModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclineModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decline Referral Case</Text>
              <Pressable onPress={() => setDeclineModalOpen(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              State the reason for declining this inter-hospital referral (will
              be recorded in continuity timeline):
            </Text>

            <TextInput
              style={styles.reasonInput}
              multiline
              numberOfLines={4}
              placeholder="e.g. Specialized equipment unavailable, no ICU beds, patient requires higher tier trauma center..."
              placeholderTextColor={Palette.textMuted}
              value={declineReason}
              onChangeText={setDeclineReason}
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => setDeclineModalOpen(false)}
                style={styles.modalBtn}
              />
              <Button
                variant="danger"
                title="Confirm Decline"
                loading={submittingAction}
                onPress={handleDeclineReferral}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bannerSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2F5E9",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  bannerSuccessText: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.success,
    fontWeight: "600",
  },
  bannerError: {
    marginBottom: Spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statCol: {
    flex: 1,
    minWidth: 140,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    padding: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Palette.primaryLight,
  },
  tabText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  section: {
    gap: Spacing.md,
  },
  filtersScroll: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  referralCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  cardBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  routeHospitalCol: {
    flex: 1,
  },
  routeHospitalLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  routeHospitalName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  routeDoctorName: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  routeArrow: {
    marginHorizontal: Spacing.sm,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingTop: 4,
  },
  infoCol: {
    flex: 1,
    minWidth: 130,
  },
  infoColFull: {
    width: "100%",
    marginTop: 2,
  },
  infoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoVal: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  infoValSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  clinicalNotesBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
  },
  clinicalNotesLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  clinicalNotesText: {
    ...Typography.bodySmall,
    color: Palette.text,
    marginTop: 2,
    lineHeight: 18,
  },
  declineReasonBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDE8E8",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 6,
  },
  declineReasonText: {
    flex: 1,
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "600",
  },
  acceptedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2F5E9",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 6,
  },
  acceptedBannerText: {
    flex: 1,
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "600",
  },
  cardActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: 8,
  },
  actionBtn: {
    flex: 1,
    minWidth: 110,
  },
  hospitalCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    ...Shadows.sm,
  },
  hospitalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  hospitalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  hospitalHeaderInfo: {
    flex: 1,
  },
  hospitalName: {
    ...Typography.h4,
    fontWeight: "700",
    color: Palette.text,
  },
  hospitalAddress: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  hospitalStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingVertical: 4,
  },
  hospitalStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hospitalStatText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  deptPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  deptPill: {
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  deptPillText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  deptMoreText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    alignSelf: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    ...Typography.h3,
    fontWeight: "700",
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginVertical: Spacing.sm,
  },
  deptListScroll: {
    maxHeight: 260,
    marginVertical: Spacing.xs,
  },
  modalOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  modalOptionItemSelected: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
  },
  modalOptionText: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "500",
  },
  modalOptionTextSelected: {
    color: Palette.primary,
    fontWeight: "700",
  },
  modalDocDetails: {
    flex: 1,
  },
  modalDocSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Palette.text,
    textAlignVertical: "top",
    minHeight: 100,
    marginVertical: Spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
});
