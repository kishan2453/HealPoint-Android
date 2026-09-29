import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import * as slaService from "@/services/sla";
import type {
  PatientServiceSla,
  PatientServiceSlaKpiSummary,
  ServiceSlaPolicy,
  ServiceSlaType,
  ServiceSlaSeverity,
  ServiceSlaStatus,
} from "@/types";

const AppColors = {
  textPrimary: Palette.text,
  textSecondary: Palette.textMuted,
  textMuted: Palette.textMuted,
};

type SlaTab =
  | "all"
  | "active"
  | "warning"
  | "breached"
  | "escalated"
  | "resolved"
  | "policies";

const SERVICE_TYPE_FILTERS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "ALL", label: "All Services", icon: "apps-outline" },
  {
    key: "APPOINTMENT_CONFIRMATION",
    label: "Confirmation",
    icon: "calendar-outline",
  },
  { key: "DOCTOR_ACCEPTANCE", label: "Doctor Review", icon: "medkit-outline" },
  { key: "CHECKIN_QUEUE", label: "Queue Waiting", icon: "hourglass-outline" },
  {
    key: "ONLINE_CONSULTATION_JOIN",
    label: "Video Join",
    icon: "videocam-outline",
  },
  {
    key: "PRESCRIPTION_PREPARATION",
    label: "Prescription",
    icon: "receipt-outline",
  },
  {
    key: "REPORT_DELIVERY",
    label: "Lab Reports",
    icon: "document-text-outline",
  },
  { key: "REFERRAL_HANDOVER", label: "Referrals", icon: "git-network-outline" },
  { key: "PAYMENT_RECONCILIATION", label: "Payments", icon: "card-outline" },
  {
    key: "SUBSCRIPTION_RESOLUTION",
    label: "Subscriptions",
    icon: "key-outline",
  },
  { key: "DOCUMENT_OCR_PROCESSING", label: "OCR Docs", icon: "scan-outline" },
  {
    key: "PATIENT_SUPPORT_RESOLUTION",
    label: "Support",
    icon: "help-buoy-outline",
  },
];

export default function SuperAdminSlaScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SlaTab>("all");
  const [selectedService, setSelectedService] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Directory, KPIs & Policies
  const [records, setRecords] = useState<PatientServiceSla[]>([]);
  const [kpis, setKpis] = useState<PatientServiceSlaKpiSummary | null>(null);
  const [policies, setPolicies] = useState<ServiceSlaPolicy[]>([]);

  // Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSla, setSelectedSla] = useState<PatientServiceSla | null>(
    null,
  );

  // Manual Escalation Dialog
  const [escalateDialogVisible, setEscalateDialogVisible] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [submittingEscalate, setSubmittingEscalate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError("");
      if (activeTab === "policies") {
        const polList = await slaService.getSlaPolicies();
        setPolicies(polList || []);
      } else {
        const [kpiRes, recRes] = await Promise.all([
          slaService.getSlaKpis(),
          slaService.getSlaRecords({
            status: activeTab === "all" ? undefined : activeTab,
            serviceType:
              selectedService === "ALL" ? undefined : selectedService,
            search: searchQuery.trim() || undefined,
            limit: 50,
          }),
        ]);
        setKpis(kpiRes);
        setRecords(recRes.records || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load service SLAs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, selectedService, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openSlaDetails = async (item: PatientServiceSla) => {
    setSelectedSla(item);
    setDetailModalVisible(true);
    try {
      const full = await slaService.getSlaById(item._id);
      setSelectedSla(full);
    } catch {
      // Non-fatal
    }
  };

  const handleEscalateConfirm = async () => {
    if (!selectedSla || !escalateReason.trim()) return;
    setSubmittingEscalate(true);
    try {
      const updated = await slaService.manualEscalateSla(
        selectedSla._id,
        escalateReason.trim(),
      );
      setSelectedSla(updated);
      setEscalateReason("");
      setEscalateDialogVisible(false);
      Alert.alert(
        "SLA Escalated",
        `SLA promoted to ${updated.escalationState}. Responsible administrators notified.`,
      );
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Escalation Failed",
        err?.message || "Could not escalate SLA.",
      );
    } finally {
      setSubmittingEscalate(false);
    }
  };

  const getStatusBadgeVariant = (status: ServiceSlaStatus): BadgeVariant => {
    switch (status) {
      case "RESOLVED":
        return "success";
      case "BREACHED":
      case "ESCALATED":
        return "error";
      case "WARNING":
        return "warning";
      case "WITHIN_SLA":
      case "STARTED":
        return "primary";
      default:
        return "neutral";
    }
  };

  const getSeverityBadgeVariant = (sev: ServiceSlaSeverity): BadgeVariant => {
    switch (sev) {
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

  if (loading && !refreshing) {
    return <Loading label="Loading Patient Service SLAs..." fullScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={AppColors.textPrimary}
            />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.screenTitle}>Patient Service SLAs</Text>
            <Text style={styles.screenSubtitle}>
              Automated Service-Time Tracking & Escalation Engine
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : (
          <>
            {/* KPI Cards Row (when not in policies tab) */}
            {activeTab !== "policies" && (
              <View style={styles.kpiGrid}>
                <Card style={[styles.kpiCard, { borderLeftColor: "#2F80ED" }]}>
                  <Text style={styles.kpiLabel}>Active Workflows</Text>
                  <Text style={styles.kpiValue}>{kpis?.active ?? 0}</Text>
                  <Text style={styles.kpiSubtext}>
                    {kpis?.withinSla ?? 0} on track · {kpis?.warning ?? 0} in
                    warning
                  </Text>
                </Card>

                <Card style={[styles.kpiCard, { borderLeftColor: "#EF4444" }]}>
                  <Text style={styles.kpiLabel}>Breached SLAs</Text>
                  <Text style={[styles.kpiValue, { color: "#EF4444" }]}>
                    {kpis?.breached ?? 0}
                  </Text>
                  <Text style={styles.kpiSubtext}>Overdue Response</Text>
                </Card>

                <Card style={[styles.kpiCard, { borderLeftColor: "#F59E0B" }]}>
                  <Text style={styles.kpiLabel}>Escalated</Text>
                  <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>
                    {kpis?.escalated ?? 0}
                  </Text>
                  <Text style={styles.kpiSubtext}>Action Required</Text>
                </Card>

                <Card style={[styles.kpiCard, { borderLeftColor: "#10B981" }]}>
                  <Text style={styles.kpiLabel}>Resolved Today</Text>
                  <Text style={[styles.kpiValue, { color: "#10B981" }]}>
                    {kpis?.resolvedToday ?? 0}
                  </Text>
                  <Text style={styles.kpiSubtext}>
                    Avg {kpis?.avgResolutionMinutes ?? 0}m turnaround
                  </Text>
                </Card>
              </View>
            )}

            {/* Status & Views Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {[
                { key: "all", label: "All SLAs" },
                { key: "active", label: "Active" },
                { key: "warning", label: "Warning" },
                { key: "breached", label: "Breached" },
                { key: "escalated", label: "Escalated" },
                { key: "resolved", label: "Resolved" },
                { key: "policies", label: "Active Policies" },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tabButton,
                    activeTab === tab.key && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(tab.key as SlaTab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.key && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Content for Policies View */}
            {activeTab === "policies" ? (
              <View style={styles.policiesContainer}>
                <Text style={styles.sectionHeaderTitle}>
                  Configured Healthcare SLA Policies ({policies.length})
                </Text>
                {policies.map((p) => (
                  <Card key={p._id} style={styles.policyCard}>
                    <View style={styles.policyHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.policyTitle}>{p.title}</Text>
                        <Text style={styles.policyKey}>{p.policyKey}</Text>
                      </View>
                      <Badge
                        variant={getSeverityBadgeVariant(p.severity)}
                        label={p.severity}
                      />
                    </View>

                    <Text style={styles.policyDesc}>{p.description}</Text>

                    <View style={styles.policyMetricsRow}>
                      <View style={styles.policyMetric}>
                        <Text style={styles.policyMetricLabel}>Target</Text>
                        <Text style={styles.policyMetricValue}>
                          {p.targetDurationMinutes} min
                        </Text>
                      </View>
                      <View style={styles.policyMetric}>
                        <Text style={styles.policyMetricLabel}>Warning</Text>
                        <Text style={styles.policyMetricValue}>
                          {p.warningThresholdMinutes} min
                        </Text>
                      </View>
                      <View style={styles.policyMetric}>
                        <Text style={styles.policyMetricLabel}>Escalation</Text>
                        <Text style={styles.policyMetricValue}>
                          {p.escalationThresholdMinutes} min
                        </Text>
                      </View>
                      <View style={styles.policyMetric}>
                        <Text style={styles.policyMetricLabel}>Scope</Text>
                        <Text style={styles.policyMetricValue}>
                          {p.scope.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.patientTemplateBox}>
                      <Text style={styles.patientTemplateHeading}>
                        Patient Display Template:
                      </Text>
                      <Text style={styles.patientTemplateText}>
                        "{p.patientMessageTemplate}"
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <>
                {/* Search Input */}
                <View style={styles.searchBar}>
                  <Ionicons
                    name="search-outline"
                    size={20}
                    color={AppColors.textSecondary}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by SLA #, entity ID..."
                    placeholderTextColor={AppColors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={loadData}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={AppColors.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>

                {/* Service Type Filter Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterPillsRow}
                >
                  {SERVICE_TYPE_FILTERS.map((s) => (
                    <Pressable
                      key={s.key}
                      style={[
                        styles.filterPill,
                        selectedService === s.key && styles.filterPillActive,
                      ]}
                      onPress={() => setSelectedService(s.key)}
                    >
                      <Ionicons
                        name={s.icon}
                        size={14}
                        color={
                          selectedService === s.key
                            ? "#FFFFFF"
                            : AppColors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.filterPillText,
                          selectedService === s.key &&
                            styles.filterPillTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* SLA Records Directory */}
                <View style={styles.recordsListContainer}>
                  <Text style={styles.sectionHeaderTitle}>
                    Operational SLA Records ({records.length})
                  </Text>

                  {records.length === 0 ? (
                    <Card style={styles.emptyCard}>
                      <Ionicons
                        name="timer-outline"
                        size={48}
                        color={AppColors.textMuted}
                      />
                      <Text style={styles.emptyTitle}>
                        No SLA Records Found
                      </Text>
                      <Text style={styles.emptySubtitle}>
                        No operational workflows match the selected filter
                        criteria.
                      </Text>
                    </Card>
                  ) : (
                    records.map((item) => (
                      <Pressable
                        key={item._id}
                        onPress={() => openSlaDetails(item)}
                        style={({ pressed }) => [
                          { opacity: pressed ? 0.9 : 1 },
                        ]}
                      >
                        <Card style={styles.slaCard}>
                          <View style={styles.slaCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.slaNumber}>
                                {item.slaNumber}
                              </Text>
                              <Text style={styles.slaServiceType}>
                                {item.serviceType.replace(/_/g, " ")}
                              </Text>
                            </View>

                            <View style={styles.badgeRow}>
                              <Badge
                                variant={getStatusBadgeVariant(item.status)}
                                label={item.status}
                              />
                              <Badge
                                variant={getSeverityBadgeVariant(item.severity)}
                                label={item.severity}
                              />
                              {item.escalationState !== "NONE" && (
                                <Badge
                                  variant="error"
                                  label={item.escalationState}
                                />
                              )}
                            </View>
                          </View>

                          {/* Patient Display Message */}
                          <Text
                            style={styles.patientStatusMessage}
                            numberOfLines={2}
                          >
                            Patient Status: "{item.patientFriendlyStatus}"
                          </Text>

                          {/* Entities chips */}
                          <View style={styles.entitiesRow}>
                            <View style={styles.entityChip}>
                              <Ionicons
                                name="layers-outline"
                                size={12}
                                color={AppColors.textSecondary}
                              />
                              <Text style={styles.entityChipText}>
                                {item.entityType.toUpperCase()}: {item.entityId}
                              </Text>
                            </View>

                            {item.patientId &&
                              typeof item.patientId === "object" && (
                                <View style={styles.entityChip}>
                                  <Ionicons
                                    name="person-outline"
                                    size={12}
                                    color={AppColors.textSecondary}
                                  />
                                  <Text style={styles.entityChipText}>
                                    {item.patientId.name}
                                  </Text>
                                </View>
                              )}

                            {item.doctorId &&
                              typeof item.doctorId === "object" && (
                                <View style={styles.entityChip}>
                                  <Ionicons
                                    name="medkit-outline"
                                    size={12}
                                    color={AppColors.textSecondary}
                                  />
                                  <Text style={styles.entityChipText}>
                                    Dr. {item.doctorId.name}
                                  </Text>
                                </View>
                              )}
                          </View>

                          {/* Footer */}
                          <View style={styles.slaCardFooter}>
                            <Text style={styles.footerTimeText}>
                              Target: {formatDDMMYYYY(item.targetDeadline)}
                            </Text>
                            <Text
                              style={[
                                styles.footerTimeText,
                                item.isBreached && {
                                  color: "#EF4444",
                                  fontWeight: "700",
                                },
                              ]}
                            >
                              {item.status === "RESOLVED"
                                ? `Resolved in ${item.actualDurationMinutes ?? 0}m`
                                : item.isBreached
                                  ? "BREACHED"
                                  : "WITHIN SLA"}
                            </Text>
                          </View>
                        </Card>
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* SLA DETAIL MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          {selectedSla && (
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedSla.slaNumber}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedSla.serviceType.replace(/_/g, " ")} ·{" "}
                    {selectedSla.policyKey}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={AppColors.textPrimary}
                  />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalScrollBody}>
                {/* Status Banners */}
                <View style={styles.modalStatusBanner}>
                  <Badge
                    variant={getStatusBadgeVariant(selectedSla.status)}
                    label={selectedSla.status}
                  />
                  <Badge
                    variant={getSeverityBadgeVariant(selectedSla.severity)}
                    label={`${selectedSla.severity} Priority`}
                  />
                  {selectedSla.escalationState !== "NONE" && (
                    <Badge
                      variant="error"
                      label={`Escalated: ${selectedSla.escalationState}`}
                    />
                  )}
                </View>

                {/* Timing Breakdown Card */}
                <Card style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>
                    Authoritative SLA Timing
                  </Text>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Started At:</Text>
                    <Text style={styles.metricValue}>
                      {formatDDMMYYYY(selectedSla.startedAt)}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Target Deadline:</Text>
                    <Text style={styles.metricValue}>
                      {formatDDMMYYYY(selectedSla.targetDeadline)}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>
                      Warning Threshold Time:
                    </Text>
                    <Text style={styles.metricValue}>
                      {formatDDMMYYYY(selectedSla.warningTime)}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>
                      Escalation Threshold Time:
                    </Text>
                    <Text style={styles.metricValue}>
                      {formatDDMMYYYY(selectedSla.escalationTime)}
                    </Text>
                  </View>

                  {selectedSla.resolvedAt && (
                    <View style={styles.metricRow}>
                      <Text style={[styles.metricLabel, { color: "#10B981" }]}>
                        Resolved At:
                      </Text>
                      <Text style={[styles.metricValue, { color: "#10B981" }]}>
                        {formatDDMMYYYY(selectedSla.resolvedAt)} (
                        {selectedSla.actualDurationMinutes} mins)
                      </Text>
                    </View>
                  )}
                </Card>

                {/* Patient Display Card */}
                <Card
                  style={[
                    styles.detailCard,
                    { borderLeftColor: Palette.primary, borderLeftWidth: 4 },
                  ]}
                >
                  <Text style={styles.detailCardTitle}>Safe Patient View</Text>
                  <Text style={styles.patientViewText}>
                    "{selectedSla.patientFriendlyStatus}"
                  </Text>
                </Card>

                {/* Linked Case Integration */}
                {selectedSla.linkedCaseId &&
                  typeof selectedSla.linkedCaseId === "object" && (
                    <Card
                      style={[
                        styles.detailCard,
                        { borderLeftColor: "#EF4444", borderLeftWidth: 4 },
                      ]}
                    >
                      <Text
                        style={[styles.detailCardTitle, { color: "#EF4444" }]}
                      >
                        Linked Operational Case
                      </Text>
                      <Text style={styles.caseRefText}>
                        Case Number: {selectedSla.linkedCaseId.caseNumber}
                      </Text>
                      <Text style={styles.caseRefText}>
                        Status: {selectedSla.linkedCaseId.status} · Priority:{" "}
                        {selectedSla.linkedCaseId.severity}
                      </Text>
                    </Card>
                  )}

                {/* Escalation History */}
                <Card style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>
                    Escalation Ledger (
                    {selectedSla.escalationHistory?.length ?? 0})
                  </Text>
                  {selectedSla.escalationHistory?.length === 0 ? (
                    <Text style={styles.emptySubtext}>
                      No escalations triggered yet.
                    </Text>
                  ) : (
                    selectedSla.escalationHistory.map((esc, i) => (
                      <View key={esc._id || i} style={styles.escItem}>
                        <View style={styles.escHeader}>
                          <Badge variant="error" label={esc.level} />
                          <Text style={styles.escTime}>
                            {formatDDMMYYYY(esc.escalatedAt)}
                          </Text>
                        </View>
                        <Text style={styles.escTarget}>
                          Target: {esc.escalatedToRole || "Admin"}
                        </Text>
                        {esc.reason ? (
                          <Text style={styles.escReason}>{esc.reason}</Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </Card>

                {/* Timeline */}
                <Card style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>
                    Lifecycle Audit Events
                  </Text>
                  {selectedSla.timeline?.map((evt, i) => (
                    <View key={evt._id || i} style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineEvtTitle}>
                          {evt.event.replace(/_/g, " ")}
                        </Text>
                        <Text style={styles.timelineEvtNote}>{evt.note}</Text>
                        <Text style={styles.timelineEvtTime}>
                          {formatDDMMYYYY(evt.timestamp)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </ScrollView>

              {/* Action Bar */}
              {selectedSla.status !== "RESOLVED" &&
                selectedSla.status !== "CANCELLED" && (
                  <View style={styles.modalActionBar}>
                    <Button
                      title="Escalate SLA"
                      variant="danger"
                      onPress={() => setEscalateDialogVisible(true)}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MANUAL ESCALATE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={escalateDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEscalateDialogVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={[styles.dialogTitle, { color: "#EF4444" }]}>
              Escalate Patient SLA
            </Text>
            <Text style={styles.dialogSubtitle}>
              Promote this SLA to the next escalation tier and notify
              responsible administrative personnel.
            </Text>

            <TextInput
              style={[
                styles.textInput,
                { height: 90, textAlignVertical: "top" },
              ]}
              placeholder="Reason for manual service escalation..."
              placeholderTextColor={AppColors.textMuted}
              multiline
              value={escalateReason}
              onChangeText={setEscalateReason}
            />

            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEscalateDialogVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={
                  submittingEscalate ? "Escalating..." : "Confirm Escalation"
                }
                variant="danger"
                onPress={handleEscalateConfirm}
                loading={submittingEscalate}
                style={{ flex: 1, marginLeft: 8 }}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  screenTitle: {
    ...Typography.h2,
    color: AppColors.textPrimary,
  },
  screenSubtitle: {
    ...Typography.caption,
    color: AppColors.textSecondary,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  kpiCard: {
    width: "48%",
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
  },
  kpiLabel: {
    ...Typography.caption,
    color: AppColors.textSecondary,
    fontWeight: "600",
  },
  kpiValue: {
    ...Typography.h1,
    color: AppColors.textPrimary,
    marginVertical: 2,
  },
  kpiSubtext: {
    ...Typography.caption,
    color: AppColors.textMuted,
    fontSize: 11,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  tabButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: Spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabText: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.xs,
    ...Typography.body,
    color: AppColors.textPrimary,
  },
  filterPillsRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: Spacing.xs,
  },
  filterPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterPillText: {
    ...Typography.caption,
    color: AppColors.textSecondary,
    fontWeight: "600",
    marginLeft: 4,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  sectionHeaderTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  recordsListContainer: {
    marginTop: Spacing.xs,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  slaCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  slaCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  slaNumber: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  slaServiceType: {
    ...Typography.body,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  patientStatusMessage: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    fontStyle: "italic",
    marginVertical: 4,
  },
  entitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 4,
  },
  entityChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  entityChipText: {
    ...Typography.caption,
    color: AppColors.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  slaCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  footerTimeText: {
    ...Typography.caption,
    color: AppColors.textMuted,
  },

  // Policies View
  policiesContainer: {
    gap: Spacing.sm,
  },
  policyCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  policyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  policyTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  policyKey: {
    ...Typography.caption,
    color: AppColors.textMuted,
    fontSize: 11,
  },
  policyDesc: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  policyMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  policyMetric: {
    alignItems: "center",
  },
  policyMetricLabel: {
    ...Typography.caption,
    color: AppColors.textMuted,
    fontSize: 10,
  },
  policyMetricValue: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginTop: 2,
  },
  patientTemplateBox: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  patientTemplateHeading: {
    ...Typography.caption,
    fontWeight: "600",
    color: AppColors.textMuted,
  },
  patientTemplateText: {
    ...Typography.caption,
    color: Palette.primary,
    fontStyle: "italic",
    marginTop: 2,
  },

  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    ...Typography.h2,
    color: AppColors.textPrimary,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: AppColors.textSecondary,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalStatusBanner: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    padding: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalScrollBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailCard: {
    padding: Spacing.md,
  },
  detailCardTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metricLabel: {
    ...Typography.bodySmall,
    color: AppColors.textMuted,
  },
  metricValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: AppColors.textPrimary,
  },
  patientViewText: {
    ...Typography.body,
    color: Palette.primary,
    fontStyle: "italic",
    lineHeight: 22,
  },
  caseRefText: {
    ...Typography.bodySmall,
    color: AppColors.textPrimary,
    marginBottom: 2,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: AppColors.textMuted,
    fontStyle: "italic",
  },
  escItem: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  escHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  escTime: {
    ...Typography.caption,
    color: AppColors.textMuted,
    fontSize: 10,
  },
  escTarget: {
    ...Typography.caption,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  escReason: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginTop: 5,
    marginRight: Spacing.sm,
  },
  timelineEvtTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  timelineEvtNote: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
  },
  timelineEvtTime: {
    ...Typography.caption,
    color: AppColors.textMuted,
    fontSize: 10,
  },
  modalActionBar: {
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },

  // Dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  dialogCard: {
    width: "100%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  dialogTitle: {
    ...Typography.h3,
    marginBottom: 4,
  },
  dialogSubtitle: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    ...Typography.body,
    color: AppColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  dialogActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
});
