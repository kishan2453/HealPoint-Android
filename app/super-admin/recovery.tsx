import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDDMMYYYY } from "@/lib/format";
import * as recoveryService from "@/services/recovery";
import type {
  ServiceRecovery,
  ServiceRecoveryKpiSummary,
  ServiceRecoveryType,
  ServiceRecoveryStatus,
  ServiceRecoveryPriority,
  ServiceRecoveryResolutionType,
  PatientSatisfactionLevel,
} from "@/types";

type RecoveryTab =
  | "all"
  | "action_required"
  | "in_progress"
  | "escalated"
  | "resolved";

const RECOVERY_TYPE_FILTERS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "ALL", label: "All Types", icon: "apps-outline" },
  {
    key: "APPOINTMENT_RECOVERY",
    label: "Appointment",
    icon: "calendar-outline",
  },
  {
    key: "ONLINE_CONSULTATION_RECOVERY",
    label: "Video Consult",
    icon: "videocam-outline",
  },
  { key: "PAYMENT_RECOVERY", label: "Payment/Refund", icon: "card-outline" },
  { key: "SUBSCRIPTION_RECOVERY", label: "Subscription", icon: "key-outline" },
  {
    key: "PRESCRIPTION_REPORT_RECOVERY",
    label: "Prescription/Report",
    icon: "receipt-outline",
  },
  {
    key: "HOSPITAL_OPERATIONAL_RECOVERY",
    label: "Operations",
    icon: "business-outline",
  },
  {
    key: "SUPPORT_ESCALATION_RECOVERY",
    label: "Support Escalation",
    icon: "help-buoy-outline",
  },
];

export default function SuperAdminRecoveryScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<RecoveryTab>("all");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Directory & KPIs
  const [records, setRecords] = useState<ServiceRecovery[]>([]);
  const [kpis, setKpis] = useState<ServiceRecoveryKpiSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Details
  const [selectedRecovery, setSelectedRecovery] =
    useState<ServiceRecovery | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Action Execution Modal
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<string>(
    "RESCHEDULE_APPOINTMENT",
  );
  const [actionPayload, setActionPayload] = useState<Record<string, any>>({});
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Resolve & Close Modal
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolutionType, setResolutionType] =
    useState<ServiceRecoveryResolutionType>("RESCHEDULE");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [satisfaction, setSatisfaction] =
    useState<PatientSatisfactionLevel>("SATISFIED");
  const [patientFeedback, setPatientFeedback] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  // Internal Note Modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchKpis = useCallback(async () => {
    try {
      const data = await recoveryService.getRecoveryKpis();
      setKpis(data);
    } catch (err: any) {
      console.warn("Failed to load recovery KPIs:", err?.message);
    }
  }, []);

  const fetchRecords = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        const statusParam =
          activeTab === "all"
            ? undefined
            : activeTab === "action_required"
              ? "ACTION_REQUIRED"
              : activeTab === "in_progress"
                ? "ACTION_IN_PROGRESS"
                : activeTab === "escalated"
                  ? "ESCALATED"
                  : "RESOLVED";

        const res = await recoveryService.getRecoveryRecords({
          page: isRefresh ? 1 : page,
          limit: 20,
          status: statusParam,
          recoveryType: selectedType === "ALL" ? undefined : selectedType,
          search: searchQuery.trim() || undefined,
        });

        if (res?.success) {
          setRecords(res.records);
          setPage(res.page);
          setTotalPages(res.totalPages);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load service recovery records");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, selectedType, searchQuery, page],
  );

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleRefresh = () => {
    setPage(1);
    fetchKpis();
    fetchRecords(true);
  };

  const openActionModal = (
    recovery: ServiceRecovery,
    defaultAction: string,
  ) => {
    setSelectedRecovery(recovery);
    setActionType(defaultAction);
    setActionPayload({});
    setActionModalVisible(true);
  };

  const handleExecuteAction = async () => {
    if (!selectedRecovery) return;
    try {
      setActionSubmitting(true);
      const updated = await recoveryService.executeAction(
        selectedRecovery._id,
        {
          actionType: actionType as any,
          payload: actionPayload,
        },
      );
      Alert.alert(
        "Action Executed",
        "The recovery action was completed successfully.",
      );
      setActionModalVisible(false);
      setSelectedRecovery(updated);
      fetchKpis();
      fetchRecords();
    } catch (err: any) {
      Alert.alert(
        "Action Failed",
        err?.message || "Could not complete recovery action",
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const openResolveModal = (recovery: ServiceRecovery) => {
    setSelectedRecovery(recovery);
    setResolutionType("RESCHEDULE");
    setResolutionSummary("");
    setSatisfaction("SATISFIED");
    setPatientFeedback("");
    setResolveModalVisible(true);
  };

  const handleResolveAndClose = async () => {
    if (!selectedRecovery) return;
    if (!resolutionSummary.trim()) {
      Alert.alert(
        "Summary Required",
        "Please describe how the issue was resolved.",
      );
      return;
    }
    try {
      setResolveSubmitting(true);
      const updated = await recoveryService.resolveAndClose(
        selectedRecovery._id,
        {
          resolutionType,
          resolutionSummary: resolutionSummary.trim(),
          patientSatisfaction: satisfaction,
          patientFeedback: patientFeedback.trim(),
        },
      );
      Alert.alert(
        "Recovery Closed",
        `Recovery ${updated.recoveryNumber} resolved and closed. Linked cases and SLAs updated.`,
      );
      setResolveModalVisible(false);
      setSelectedRecovery(updated);
      fetchKpis();
      fetchRecords();
    } catch (err: any) {
      Alert.alert(
        "Closure Failed",
        err?.message || "Failed to close recovery record",
      );
    } finally {
      setResolveSubmitting(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!selectedRecovery) return;
    if (!internalNoteText.trim()) {
      Alert.alert("Note Required", "Please enter internal staff note content.");
      return;
    }
    try {
      setNoteSubmitting(true);
      const updated = await recoveryService.updateRecovery(
        selectedRecovery._id,
        {
          internalNote: internalNoteText.trim(),
        },
      );
      Alert.alert("Note Added", "Internal confidential note saved.");
      setInternalNoteText("");
      setNoteModalVisible(false);
      setSelectedRecovery(updated);
      fetchRecords();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add internal note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const getPriorityBadgeVariant = (
    priority: ServiceRecoveryPriority,
  ): BadgeVariant => {
    switch (priority) {
      case "CRITICAL":
        return "error";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "primary";
      default:
        return "neutral";
    }
  };

  const getStatusBadgeVariant = (
    status: ServiceRecoveryStatus,
  ): BadgeVariant => {
    switch (status) {
      case "CLOSED":
      case "RESOLVED":
        return "success";
      case "ACTION_IN_PROGRESS":
        return "primary";
      case "ACTION_REQUIRED":
      case "ESCALATED":
        return "error";
      case "WAITING_FOR_PATIENT":
      case "WAITING_FOR_HOSPITAL":
        return "warning";
      default:
        return "neutral";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>
              Service Recovery & Resolution
            </Text>
            <Text style={styles.headerSubtitle}>
              Active Resolution & Corrective Action Center
            </Text>
          </View>
          <Pressable
            onPress={handleRefresh}
            style={styles.refreshButton}
            accessibilityRole="button"
          >
            <Ionicons name="reload-outline" size={20} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Palette.textMuted} />
          <TextInput
            placeholder="Search by REC#, title, patient name..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => fetchRecords()}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* KPI Dashboard Cards */}
        {kpis && (
          <View style={styles.kpiContainer}>
            <View style={styles.kpiRow}>
              <Card
                style={[
                  styles.kpiCard,
                  { borderColor: Palette.accent, borderLeftWidth: 4 },
                ]}
              >
                <Text style={styles.kpiValue}>{kpis.activeCount}</Text>
                <Text style={styles.kpiLabel}>Active Recoveries</Text>
                <Text style={styles.kpiSub}>Action required / in progress</Text>
              </Card>
              <Card
                style={[
                  styles.kpiCard,
                  { borderColor: Palette.success, borderLeftWidth: 4 },
                ]}
              >
                <Text style={[styles.kpiValue, { color: Palette.success }]}>
                  {kpis.resolutionRate}%
                </Text>
                <Text style={styles.kpiLabel}>Resolution Rate</Text>
                <Text style={styles.kpiSub}>{kpis.resolved} resolved</Text>
              </Card>
            </View>
            <View style={styles.kpiRow}>
              <Card
                style={[
                  styles.kpiCard,
                  { borderColor: Palette.info, borderLeftWidth: 4 },
                ]}
              >
                <Text style={styles.kpiValue}>{kpis.avgRecoveryMinutes}m</Text>
                <Text style={styles.kpiLabel}>Avg Recovery Time</Text>
                <Text style={styles.kpiSub}>Across all services</Text>
              </Card>
              <Card
                style={[
                  styles.kpiCard,
                  { borderColor: Palette.warning, borderLeftWidth: 4 },
                ]}
              >
                <Text style={[styles.kpiValue, { color: Palette.warning }]}>
                  {kpis.satisfactionRate}%
                </Text>
                <Text style={styles.kpiLabel}>Patient Satisfaction</Text>
                <Text style={styles.kpiSub}>Post-resolution rating</Text>
              </Card>
            </View>
          </View>
        )}

        {/* Tab Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {(
            [
              { key: "all", label: "All Recoveries" },
              { key: "action_required", label: "Action Required" },
              { key: "in_progress", label: "In Progress" },
              { key: "escalated", label: "Escalated" },
              { key: "resolved", label: "Resolved / Closed" },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === tab.key && styles.tabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Service Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeFilterScroll}
        >
          {RECOVERY_TYPE_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setSelectedType(f.key)}
              style={[
                styles.typeChip,
                selectedType === f.key && styles.typeChipActive,
              ]}
            >
              <Ionicons
                name={f.icon}
                size={14}
                color={
                  selectedType === f.key ? Palette.white : Palette.textMuted
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === f.key && styles.typeChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Content State */}
        {loading && !refreshing ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={handleRefresh} />
        ) : records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={64}
              color={Palette.success}
            />
            <Text style={styles.emptyTitle}>All Recoveries Clear</Text>
            <Text style={styles.emptyText}>
              No service recovery records match the selected filter criteria.
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {records.map((rec) => (
              <Card key={rec._id} style={styles.recordCard}>
                {/* Header row */}
                <View style={styles.recordHeader}>
                  <View style={styles.recordHeaderLeft}>
                    <Text style={styles.recNumber}>{rec.recoveryNumber}</Text>
                    <Badge
                      label={rec.priority}
                      variant={getPriorityBadgeVariant(rec.priority)}
                    />
                  </View>
                  <Badge
                    label={rec.status.replace(/_/g, " ")}
                    variant={getStatusBadgeVariant(rec.status)}
                  />
                </View>

                {/* Title & Type */}
                <Text style={styles.recordTitle}>{rec.title}</Text>
                <View style={styles.typeBadgeRow}>
                  <Ionicons
                    name="bandage-outline"
                    size={14}
                    color={Palette.primary}
                  />
                  <Text style={styles.typeBadgeText}>
                    {rec.recoveryType.replace(/_/g, " ")}
                  </Text>
                </View>

                {/* Patient & Provider Meta */}
                <View style={styles.metaBox}>
                  {rec.patientName ? (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.metaText}>
                        Patient:{" "}
                        <Text style={styles.metaBold}>{rec.patientName}</Text>
                        {rec.patientPhone ? ` • ${rec.patientPhone}` : ""}
                      </Text>
                    </View>
                  ) : null}

                  {rec.doctorName ? (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="medkit-outline"
                        size={14}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.metaText}>
                        Doctor:{" "}
                        <Text style={styles.metaBold}>
                          Dr. {rec.doctorName}
                        </Text>
                      </Text>
                    </View>
                  ) : null}

                  {rec.hospitalName ? (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.metaText}>
                        Hospital: {rec.hospitalName}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Root cause */}
                {rec.rootCauseDescription ? (
                  <View style={styles.rootCauseBox}>
                    <Text style={styles.rootCauseLabel}>
                      ROOT CAUSE ({rec.rootCauseCategory}):
                    </Text>
                    <Text style={styles.rootCauseText}>
                      {rec.rootCauseDescription}
                    </Text>
                  </View>
                ) : null}

                {/* Action Evidence */}
                {rec.actionEvidence && (
                  <View style={styles.evidenceBox}>
                    <Text style={styles.evidenceLabel}>ACTION EVIDENCE:</Text>
                    {rec.actionEvidence.newSlotDate && (
                      <Text style={styles.evidenceItem}>
                        • Rescheduled Slot: {rec.actionEvidence.newSlotDate} at{" "}
                        {rec.actionEvidence.newSlotTime}
                      </Text>
                    )}
                    {rec.actionEvidence.razorpayRefundId && (
                      <Text style={styles.evidenceItem}>
                        • Razorpay Refund ID:{" "}
                        {rec.actionEvidence.razorpayRefundId}
                      </Text>
                    )}
                    {rec.actionEvidence.reconciledPaymentStatus && (
                      <Text style={styles.evidenceItem}>
                        • Reconciled Status:{" "}
                        {rec.actionEvidence.reconciledPaymentStatus}
                      </Text>
                    )}
                    {rec.actionEvidence.consultationMeetingUrl && (
                      <Text style={styles.evidenceItem}>
                        • Consult Link:{" "}
                        {rec.actionEvidence.consultationMeetingUrl}
                      </Text>
                    )}
                    {rec.actionEvidence.quotaRestoredCount ? (
                      <Text style={styles.evidenceItem}>
                        • Quota Restored: +
                        {rec.actionEvidence.quotaRestoredCount} video
                        consultations
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Patient Friendly Status Reassurance */}
                <View style={styles.patientReassuranceBox}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={Palette.info}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.patientReassuranceTitle}>
                      Patient Reassurance View:
                    </Text>
                    <Text style={styles.patientReassuranceText}>
                      {rec.patientFriendlyStatus}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                {rec.status !== "CLOSED" && (
                  <View style={styles.actionsBar}>
                    {rec.recoveryType === "APPOINTMENT_RECOVERY" && (
                      <Button
                        title="Reschedule"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          openActionModal(rec, "RESCHEDULE_APPOINTMENT")
                        }
                        style={styles.actionBtn}
                      />
                    )}

                    {rec.recoveryType === "PAYMENT_RECOVERY" && (
                      <Button
                        title="Reconcile/Refund"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          openActionModal(rec, "RECONCILE_PAYMENT")
                        }
                        style={styles.actionBtn}
                      />
                    )}

                    {rec.recoveryType === "ONLINE_CONSULTATION_RECOVERY" && (
                      <Button
                        title="Reconnect Video"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          openActionModal(rec, "RECONNECT_CONSULTATION")
                        }
                        style={styles.actionBtn}
                      />
                    )}

                    <Button
                      title="Add Note"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => {
                        setSelectedRecovery(rec);
                        setNoteModalVisible(true);
                      }}
                      style={styles.actionBtn}
                    />

                    <Button
                      title="Resolve & Close"
                      variant="primary"
                      fullWidth={false}
                      onPress={() => openResolveModal(rec)}
                      style={styles.actionBtn}
                    />
                  </View>
                )}

                {/* Bottom Bar: Timeline inspection */}
                <View style={styles.recordFooter}>
                  <Text style={styles.createdDate}>
                    Initiated: {formatDDMMYYYY(rec.createdAt)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSelectedRecovery(rec);
                      setDetailsModalVisible(true);
                    }}
                    style={styles.viewTimelineLink}
                  >
                    <Text style={styles.viewTimelineText}>
                      View Details & Timeline
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={Palette.primary}
                    />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Execution Modal */}
      <Modal
        visible={actionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Execute Recovery Action: {actionType.replace(/_/g, " ")}
              </Text>
              <Pressable onPress={() => setActionModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {actionType === "RESCHEDULE_APPOINTMENT" && (
                <View style={styles.modalForm}>
                  <Text style={styles.inputLabel}>
                    New Slot Date (DD-MM-YYYY or YYYY-MM-DD)*
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 30-09-2026"
                    value={actionPayload.slotDate || ""}
                    onChangeText={(val) =>
                      setActionPayload((p) => ({ ...p, slotDate: val }))
                    }
                  />

                  <Text style={styles.inputLabel}>
                    New Slot Time (HH:MM AM/PM)*
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 10:30 AM"
                    value={actionPayload.slotTime || ""}
                    onChangeText={(val) =>
                      setActionPayload((p) => ({ ...p, slotTime: val }))
                    }
                  />

                  <Text style={styles.inputLabel}>Reschedule Reason</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Reason for slot adjustment"
                    value={actionPayload.reason || ""}
                    onChangeText={(val) =>
                      setActionPayload((p) => ({ ...p, reason: val }))
                    }
                  />
                </View>
              )}

              {actionType === "RECONCILE_PAYMENT" && (
                <View style={styles.modalForm}>
                  <Text style={styles.inputLabel}>
                    Razorpay Payment / Order ID
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. pay_XXXXX or order_XXXXX"
                    value={actionPayload.paymentId || ""}
                    onChangeText={(val) =>
                      setActionPayload((p) => ({ ...p, paymentId: val }))
                    }
                  />

                  <Pressable
                    style={styles.toggleRow}
                    onPress={() =>
                      setActionPayload((p) => ({
                        ...p,
                        triggerRefund: !p.triggerRefund,
                      }))
                    }
                  >
                    <Ionicons
                      name={
                        actionPayload.triggerRefund
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={22}
                      color={Palette.primary}
                    />
                    <Text style={styles.toggleLabel}>
                      Execute verified refund via Razorpay
                    </Text>
                  </Pressable>

                  {actionPayload.triggerRefund && (
                    <View>
                      <Text style={styles.inputLabel}>Refund Reason</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g. Doctor cancelled / system service recovery"
                        value={actionPayload.reason || ""}
                        onChangeText={(val) =>
                          setActionPayload((p) => ({ ...p, reason: val }))
                        }
                      />
                    </View>
                  )}
                </View>
              )}

              {actionType === "RECONNECT_CONSULTATION" && (
                <View style={styles.modalForm}>
                  <Text style={styles.inputLabel}>
                    Google Meet URL (optional)
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={actionPayload.meetingUrl || ""}
                    onChangeText={(val) =>
                      setActionPayload((p) => ({ ...p, meetingUrl: val }))
                    }
                  />
                  <Text style={styles.inputHelp}>
                    If omitted, the existing room URL will be re-validated and
                    participants alerted.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setActionModalVisible(false)}
                disabled={actionSubmitting}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Execute"
                variant="primary"
                fullWidth={false}
                onPress={handleExecuteAction}
                loading={actionSubmitting}
                disabled={actionSubmitting}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Resolve & Close Modal */}
      <Modal
        visible={resolveModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Resolve & Close Service Recovery
              </Text>
              <Pressable onPress={() => setResolveModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Resolution Outcome Type*</Text>
              <View style={styles.optionsWrap}>
                {(
                  [
                    "RESCHEDULE",
                    "REFUND",
                    "CREDIT_BENEFIT",
                    "CONSULT_RECONNECTED",
                    "CLINICAL_ESCALATION",
                    "APOLOGY_EXPLANATION",
                    "SERVICE_RESTORED",
                  ] as const
                ).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setResolutionType(t)}
                    style={[
                      styles.choiceChip,
                      resolutionType === t && styles.choiceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        resolutionType === t && styles.choiceChipTextActive,
                      ]}
                    >
                      {t.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Resolution Summary*</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70, textAlignVertical: "top" },
                ]}
                placeholder="Explain the concrete resolution taken for this patient..."
                value={resolutionSummary}
                onChangeText={setResolutionSummary}
                multiline
              />

              <Text style={styles.inputLabel}>
                Patient Satisfaction Assessment
              </Text>
              <View style={styles.optionsWrap}>
                {(
                  [
                    "SATISFIED",
                    "NEUTRAL",
                    "DISSATISFIED",
                    "PENDING_SURVEY",
                    "UNREACHABLE",
                  ] as const
                ).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSatisfaction(s)}
                    style={[
                      styles.choiceChip,
                      satisfaction === s && styles.choiceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        satisfaction === s && styles.choiceChipTextActive,
                      ]}
                    >
                      {s.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                Patient Feedback / Comments (optional)
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Feedback recorded from phone call or chat..."
                value={patientFeedback}
                onChangeText={setPatientFeedback}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setResolveModalVisible(false)}
                disabled={resolveSubmitting}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Confirm Resolution"
                variant="primary"
                fullWidth={false}
                onPress={handleResolveAndClose}
                loading={resolveSubmitting}
                disabled={resolveSubmitting}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Internal Note Modal */}
      <Modal
        visible={noteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Confidential Staff Note</Text>
              <Pressable onPress={() => setNoteModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>
            <Text style={styles.inputHelp}>
              This note is internal to hospital & super admins only. It will
              never be shown to the patient.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { height: 90, textAlignVertical: "top", marginTop: 12 },
              ]}
              placeholder="Record investigation notes, doctor feedback, or coordination steps..."
              value={internalNoteText}
              onChangeText={setInternalNoteText}
              multiline
            />
            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                fullWidth={false}
                onPress={() => setNoteModalVisible(false)}
                disabled={noteSubmitting}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Note"
                variant="primary"
                fullWidth={false}
                onPress={handleAddInternalNote}
                loading={noteSubmitting}
                disabled={noteSubmitting}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Details & Timeline Modal */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedRecovery?.recoveryNumber}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {selectedRecovery?.title}
                </Text>
              </View>
              <Pressable onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingVertical: 12 }}>
              {/* Timeline Section */}
              <Text style={styles.sectionHeader}>Audit Timeline</Text>
              {selectedRecovery?.timeline?.map((evt, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineEventName}>{evt.event}</Text>
                    {evt.note ? (
                      <Text style={styles.timelineNote}>{evt.note}</Text>
                    ) : null}
                    <Text style={styles.timelineTime}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Internal Notes Section */}
              {selectedRecovery?.internalNotes &&
                selectedRecovery.internalNotes.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionHeader}>
                      Confidential Staff Notes
                    </Text>
                    {selectedRecovery.internalNotes.map((n, idx) => (
                      <View key={idx} style={styles.noteItem}>
                        <Text style={styles.noteText}>{n.note}</Text>
                        <Text style={styles.noteAuthor}>
                          By: {n.author?.name || "Staff"} (
                          {n.author?.role || "Admin"}) •{" "}
                          {new Date(n.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

              {/* Executed Actions Section */}
              {selectedRecovery?.actionsExecuted &&
                selectedRecovery.actionsExecuted.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionHeader}>
                      Executed Actions Log
                    </Text>
                    {selectedRecovery.actionsExecuted.map((act, idx) => (
                      <View key={idx} style={styles.actionLogItem}>
                        <Text style={styles.actionLogType}>
                          {act.actionType}
                        </Text>
                        <Badge
                          label={act.outcome}
                          variant={
                            act.outcome === "SUCCESS" ? "success" : "error"
                          }
                        />
                        <Text style={styles.actionLogDetails}>
                          {act.details}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Close Details"
                variant="primary"
                fullWidth={true}
                onPress={() => setDetailsModalVisible(false)}
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
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Palette.text,
    marginLeft: Spacing.xs,
    paddingVertical: 4,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  kpiContainer: {
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Palette.text,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 2,
  },
  tabScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tabButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabButtonActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textMuted,
  },
  tabButtonTextActive: {
    color: Palette.white,
    fontWeight: "600",
  },
  typeFilterScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  typeChipActive: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  typeChipText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  typeChipTextActive: {
    color: Palette.white,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 260,
  },
  recordsList: {
    gap: Spacing.md,
  },
  recordCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  recordHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  recNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 4,
  },
  typeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: Palette.primary,
  },
  metaBox: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Palette.text,
  },
  metaBold: {
    fontWeight: "600",
  },
  rootCauseBox: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
    backgroundColor: "#FFF8F0",
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.warning,
  },
  rootCauseLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.warning,
  },
  rootCauseText: {
    fontSize: 11,
    color: Palette.text,
    marginTop: 2,
  },
  evidenceBox: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
    backgroundColor: "#F0F9FF",
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.info,
  },
  evidenceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.info,
  },
  evidenceItem: {
    fontSize: 11,
    color: Palette.text,
    marginTop: 2,
  },
  patientReassuranceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F4F6F9",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  patientReassuranceTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  patientReassuranceText: {
    fontSize: 12,
    color: Palette.text,
    marginTop: 2,
  },
  actionsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  actionBtn: {
    flexGrow: 1,
  },
  recordFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  createdDate: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  viewTimelineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewTimelineText: {
    fontSize: 11,
    color: Palette.primary,
    fontWeight: "600",
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
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  modalForm: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  inputHelp: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Palette.text,
    backgroundColor: Palette.background,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  toggleLabel: {
    fontSize: 12,
    color: Palette.text,
    fontWeight: "500",
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  choiceChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  choiceChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  choiceChipText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  choiceChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginTop: 4,
    marginRight: Spacing.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineEventName: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.text,
  },
  timelineNote: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },
  timelineTime: {
    fontSize: 9,
    color: Palette.textMuted,
    marginTop: 2,
  },
  noteItem: {
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  noteText: {
    fontSize: 11,
    color: Palette.text,
  },
  noteAuthor: {
    fontSize: 9,
    color: Palette.textMuted,
    marginTop: 4,
  },
  actionLogItem: {
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  actionLogType: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 2,
  },
  actionLogDetails: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
});
