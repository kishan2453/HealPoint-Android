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
import * as caseService from "@/services/cases";
import type {
  HealthcareCase,
  HealthcareCaseKpiSummary,
  HealthcareCaseCategory,
  HealthcareCaseSeverity,
  HealthcareCaseStatus,
} from "@/types";

const AppColors = {
  textPrimary: Palette.text,
  textSecondary: Palette.textMuted,
  textMuted: Palette.textMuted,
};

type StatusTab = "all" | "active" | "escalated" | "sla_breached" | "resolved";

const CATEGORY_OPTIONS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "ALL", label: "All Categories", icon: "apps-outline" },
  {
    key: "APPOINTMENT_BOOKING",
    label: "Appointments",
    icon: "calendar-outline",
  },
  { key: "CLINICAL_WORKFLOW", label: "Clinical", icon: "medkit-outline" },
  { key: "PAYMENT_BILLING", label: "Payments", icon: "card-outline" },
  {
    key: "SUBSCRIPTION_ENTITLEMENT",
    label: "Subscriptions",
    icon: "key-outline",
  },
  {
    key: "PATIENT_CONSENT_PRIVACY",
    label: "Consent/Privacy",
    icon: "shield-checkmark-outline",
  },
  { key: "CLINICAL_REFERRAL", label: "Referrals", icon: "git-network-outline" },
  { key: "DOCUMENT_OCR", label: "OCR & Docs", icon: "document-text-outline" },
  { key: "SECURITY_ACCESS", label: "Security", icon: "lock-closed-outline" },
  {
    key: "INTEGRATION_INTEROP",
    label: "Interoperability",
    icon: "swap-horizontal-outline",
  },
  { key: "FACILITY_OPERATIONS", label: "Operations", icon: "business-outline" },
  { key: "GENERAL_SUPPORT", label: "Support", icon: "help-buoy-outline" },
];

const SEVERITY_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: "ALL", label: "All Severities", color: AppColors.textSecondary },
  { key: "CRITICAL", label: "Critical (2h SLA)", color: "#EF4444" },
  { key: "HIGH", label: "High (6h SLA)", color: "#F59E0B" },
  { key: "MEDIUM", label: "Medium (24h SLA)", color: "#3B82F6" },
  { key: "LOW", label: "Low (72h SLA)", color: "#6B7280" },
];

export default function SuperAdminCasesScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Directory & KPIs
  const [cases, setCases] = useState<HealthcareCase[]>([]);
  const [kpis, setKpis] = useState<HealthcareCaseKpiSummary | null>(null);

  // Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCase, setSelectedCase] = useState<HealthcareCase | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "timeline" | "notes">(
    "overview",
  );

  // Create Case Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<HealthcareCaseCategory>(
    "APPOINTMENT_BOOKING",
  );
  const [createSeverity, setCreateSeverity] =
    useState<HealthcareCaseSeverity>("MEDIUM");
  const [createPaymentId, setCreatePaymentId] = useState("");

  // Action Modals: Note, Escalate, Resolve, Assign
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [submittingEscalate, setSubmittingEscalate] = useState(false);

  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveRootCause, setResolveRootCause] = useState("");
  const [resolveCorrectiveAction, setResolveCorrectiveAction] = useState("");
  const [submittingResolve, setSubmittingResolve] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [kpiRes, casesRes] = await Promise.all([
        caseService.getCaseKpis(),
        caseService.getCases({
          status:
            activeTab === "all"
              ? undefined
              : activeTab === "sla_breached"
                ? "active"
                : activeTab,
          sla: activeTab === "sla_breached" ? "breached" : undefined,
          category: selectedCategory === "ALL" ? undefined : selectedCategory,
          severity: selectedSeverity === "ALL" ? undefined : selectedSeverity,
          search: searchQuery.trim() || undefined,
          limit: 50,
        }),
      ]);
      setKpis(kpiRes);
      setCases(casesRes.cases || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load healthcare cases");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, selectedCategory, selectedSeverity, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openCaseDetails = async (caseItem: HealthcareCase) => {
    setSelectedCase(caseItem);
    setDetailTab("overview");
    setDetailModalVisible(true);
    try {
      const full = await caseService.getCaseById(caseItem._id);
      setSelectedCase(full);
    } catch {
      // Non-fatal, fallback to cached item
    }
  };

  const handleCreateCase = async () => {
    if (!createTitle.trim() || !createDescription.trim()) {
      Alert.alert(
        "Missing Fields",
        "Please provide a title and detailed description.",
      );
      return;
    }
    setCreatingCase(true);
    try {
      const res = await caseService.createCase({
        title: createTitle.trim(),
        description: createDescription.trim(),
        category: createCategory,
        severity: createSeverity,
        paymentId: createPaymentId.trim() || undefined,
      });
      Alert.alert(
        "Case Created",
        `Case ${res.case.caseNumber} has been registered successfully.`,
      );
      setCreateModalVisible(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreatePaymentId("");
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Creation Failed",
        err?.message || "Unable to register case.",
      );
    } finally {
      setCreatingCase(false);
    }
  };

  const handleStatusTransition = async (targetStatus: HealthcareCaseStatus) => {
    if (!selectedCase) return;
    try {
      const updated = await caseService.updateCaseStatus(
        selectedCase._id,
        targetStatus,
        `Status updated to ${targetStatus}`,
      );
      setSelectedCase(updated);
      Alert.alert("Status Updated", `Case status is now ${targetStatus}.`);
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Transition Failed",
        err?.message || "Could not update status.",
      );
    }
  };

  const handleAddNote = async () => {
    if (!selectedCase || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await caseService.addCaseNote(
        selectedCase._id,
        noteText.trim(),
      );
      setSelectedCase(res.case);
      setNoteText("");
      setNoteModalVisible(false);
      Alert.alert("Note Added", "Internal note recorded on case ledger.");
      loadData();
    } catch (err: any) {
      Alert.alert("Failed", err?.message || "Could not append internal note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedCase || !escalateReason.trim()) return;
    setSubmittingEscalate(true);
    try {
      const updated = await caseService.escalateCase(
        selectedCase._id,
        escalateReason.trim(),
      );
      setSelectedCase(updated);
      setEscalateReason("");
      setEscalateModalVisible(false);
      Alert.alert(
        "Case Escalated",
        "Case severity elevated and notification sent to administrators.",
      );
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Escalation Failed",
        err?.message || "Could not escalate case.",
      );
    } finally {
      setSubmittingEscalate(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedCase || !resolveNotes.trim()) {
      Alert.alert("Missing Notes", "Resolution summary is required.");
      return;
    }
    setSubmittingResolve(true);
    try {
      const updated = await caseService.resolveCase(selectedCase._id, {
        resolutionNotes: resolveNotes.trim(),
        rootCause: resolveRootCause.trim() || undefined,
        correctiveAction: resolveCorrectiveAction.trim() || undefined,
      });
      setSelectedCase(updated);
      setResolveNotes("");
      setResolveRootCause("");
      setResolveCorrectiveAction("");
      setResolveModalVisible(false);
      Alert.alert(
        "Case Resolved",
        "Case marked resolved and root-cause analysis recorded.",
      );
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Resolution Failed",
        err?.message || "Could not resolve case.",
      );
    } finally {
      setSubmittingResolve(false);
    }
  };

  const getSeverityBadgeVariant = (
    severity: HealthcareCaseSeverity,
  ): BadgeVariant => {
    switch (severity) {
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
    status: HealthcareCaseStatus,
  ): BadgeVariant => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return "success";
      case "ESCALATED":
        return "error";
      case "IN_PROGRESS":
      case "ASSIGNED":
        return "primary";
      case "WAITING":
      case "TRIAGED":
        return "warning";
      default:
        return "neutral";
    }
  };

  if (loading && !refreshing) {
    return <Loading label="Loading Healthcare Case Center..." fullScreen />;
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
            <Text style={styles.screenTitle}>Healthcare Case Center</Text>
            <Text style={styles.screenSubtitle}>
              Smart Operational Resolution & Incident Engine
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.createButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>New Case</Text>
        </Pressable>
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
            {/* KPI Cards Row */}
            <View style={styles.kpiGrid}>
              <Card style={[styles.kpiCard, { borderLeftColor: "#2F80ED" }]}>
                <Text style={styles.kpiLabel}>Total Active</Text>
                <Text style={styles.kpiValue}>{kpis?.active ?? 0}</Text>
                <Text style={styles.kpiSubtext}>
                  {kpis?.open ?? 0} Open · {kpis?.inProgress ?? 0} In Progress
                </Text>
              </Card>

              <Card style={[styles.kpiCard, { borderLeftColor: "#EF4444" }]}>
                <Text style={styles.kpiLabel}>Critical / Escalated</Text>
                <Text style={[styles.kpiValue, { color: "#EF4444" }]}>
                  {(kpis?.critical ?? 0) + (kpis?.escalated ?? 0)}
                </Text>
                <Text style={styles.kpiSubtext}>
                  {kpis?.critical ?? 0} Critical · {kpis?.escalated ?? 0}{" "}
                  Escalated
                </Text>
              </Card>

              <Card style={[styles.kpiCard, { borderLeftColor: "#F59E0B" }]}>
                <Text style={styles.kpiLabel}>SLA Breached</Text>
                <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>
                  {kpis?.slaBreached ?? 0}
                </Text>
                <Text style={styles.kpiSubtext}>Overdue Response</Text>
              </Card>

              <Card style={[styles.kpiCard, { borderLeftColor: "#10B981" }]}>
                <Text style={styles.kpiLabel}>Resolved Today</Text>
                <Text style={[styles.kpiValue, { color: "#10B981" }]}>
                  {kpis?.resolvedToday ?? 0}
                </Text>
                <Text style={styles.kpiSubtext}>
                  Avg {kpis?.avgResolutionHours ?? 0}h resolution
                </Text>
              </Card>
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Ionicons
                name="search-outline"
                size={20}
                color={AppColors.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by case #, title, payment ID..."
                placeholderTextColor={Palette.textMuted}
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

            {/* Status Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {[
                { key: "all", label: "All Cases" },
                { key: "active", label: "Active" },
                { key: "escalated", label: "Escalated" },
                { key: "sla_breached", label: "SLA Breached" },
                { key: "resolved", label: "Resolved" },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tabButton,
                    activeTab === tab.key && styles.tabButtonActive,
                  ]}
                  onPress={() => setActiveTab(tab.key as StatusTab)}
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

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.filterPill,
                    selectedCategory === cat.key && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={
                      selectedCategory === cat.key
                        ? "#FFFFFF"
                        : AppColors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedCategory === cat.key &&
                        styles.filterPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Severity Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {SEVERITY_OPTIONS.map((sev) => (
                <Pressable
                  key={sev.key}
                  style={[
                    styles.severityPill,
                    selectedSeverity === sev.key && {
                      backgroundColor: sev.color,
                      borderColor: sev.color,
                    },
                  ]}
                  onPress={() => setSelectedSeverity(sev.key)}
                >
                  <View
                    style={[
                      styles.severityDot,
                      { backgroundColor: sev.color },
                      selectedSeverity === sev.key && {
                        backgroundColor: "#FFFFFF",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.severityPillText,
                      selectedSeverity === sev.key && { color: "#FFFFFF" },
                    ]}
                  >
                    {sev.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Cases List */}
            <View style={styles.casesListContainer}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.listSectionTitle}>
                  Incident & Case Directory ({cases.length})
                </Text>
              </View>

              {cases.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Ionicons
                    name="file-tray-full-outline"
                    size={48}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.emptyTitle}>No Cases Found</Text>
                  <Text style={styles.emptySubtitle}>
                    There are no operational cases matching your filter
                    criteria.
                  </Text>
                </Card>
              ) : (
                cases.map((item) => (
                  <Pressable
                    key={item._id}
                    onPress={() => openCaseDetails(item)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                  >
                    <Card style={styles.caseCard}>
                      <View style={styles.caseCardHeader}>
                        <View style={styles.caseNumberBox}>
                          <Text style={styles.caseNumber}>
                            {item.caseNumber}
                          </Text>
                          <Text style={styles.caseCategoryTag}>
                            {item.category.replace(/_/g, " ")}
                          </Text>
                        </View>

                        <View style={styles.badgeRow}>
                          {item.slaBreached && (
                            <Badge variant="error" label="SLA BREACHED" />
                          )}
                          <Badge
                            variant={getSeverityBadgeVariant(item.severity)}
                            label={item.severity}
                          />
                          <Badge
                            variant={getStatusBadgeVariant(item.status)}
                            label={item.status}
                          />
                        </View>
                      </View>

                      <Text style={styles.caseTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.caseDescription} numberOfLines={2}>
                        {item.description}
                      </Text>

                      {/* Linked Entities Chips */}
                      <View style={styles.entitiesRow}>
                        {item.patientId &&
                          typeof item.patientId === "object" && (
                            <View style={styles.entityChip}>
                              <Ionicons
                                name="person-outline"
                                size={12}
                                color={AppColors.textSecondary}
                              />
                              <Text
                                style={styles.entityChipText}
                                numberOfLines={1}
                              >
                                {item.patientId.name}
                              </Text>
                            </View>
                          )}
                        {item.doctorId && typeof item.doctorId === "object" && (
                          <View style={styles.entityChip}>
                            <Ionicons
                              name="medkit-outline"
                              size={12}
                              color={AppColors.textSecondary}
                            />
                            <Text
                              style={styles.entityChipText}
                              numberOfLines={1}
                            >
                              Dr. {item.doctorId.name}
                            </Text>
                          </View>
                        )}
                        {item.paymentId && (
                          <View style={styles.entityChip}>
                            <Ionicons
                              name="card-outline"
                              size={12}
                              color={AppColors.textSecondary}
                            />
                            <Text
                              style={styles.entityChipText}
                              numberOfLines={1}
                            >
                              {item.paymentId}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Footer Info */}
                      <View style={styles.caseCardFooter}>
                        <Text style={styles.footerDate}>
                          Created: {formatDDMMYYYY(item.createdAt)}
                        </Text>
                        <Text style={styles.footerAssignee}>
                          {item.assignedTo?.name
                            ? `Assigned: ${item.assignedTo.name}`
                            : "Unassigned"}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* CASE DETAILS MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          {selectedCase && (
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {selectedCase.caseNumber}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedCase.category.replace(/_/g, " ")} · Source:{" "}
                    {selectedCase.source}
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

              {/* Status & SLA Banner */}
              <View style={styles.modalStatusBanner}>
                <View style={styles.statusBannerLeft}>
                  <Badge
                    variant={getStatusBadgeVariant(selectedCase.status)}
                    label={selectedCase.status}
                  />
                  <Badge
                    variant={getSeverityBadgeVariant(selectedCase.severity)}
                    label={`${selectedCase.severity} Priority`}
                  />
                  {selectedCase.escalated && (
                    <Badge variant="error" label="ESCALATED" />
                  )}
                </View>
                <View style={styles.statusBannerRight}>
                  <Text style={styles.slaDeadlineLabel}>
                    Target SLA: {selectedCase.slaHours}h
                  </Text>
                  <Text
                    style={[
                      styles.slaDeadlineTime,
                      selectedCase.slaBreached && {
                        color: "#EF4444",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {selectedCase.slaBreached
                      ? "SLA BREACHED"
                      : `Due: ${formatDDMMYYYY(selectedCase.slaDeadline)}`}
                  </Text>
                </View>
              </View>

              {/* Sub-Tabs: Overview, Timeline, Internal Notes */}
              <View style={styles.detailTabsRow}>
                <Pressable
                  style={[
                    styles.detailTabBtn,
                    detailTab === "overview" && styles.detailTabBtnActive,
                  ]}
                  onPress={() => setDetailTab("overview")}
                >
                  <Text
                    style={[
                      styles.detailTabText,
                      detailTab === "overview" && styles.detailTabTextActive,
                    ]}
                  >
                    Overview
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.detailTabBtn,
                    detailTab === "timeline" && styles.detailTabBtnActive,
                  ]}
                  onPress={() => setDetailTab("timeline")}
                >
                  <Text
                    style={[
                      styles.detailTabText,
                      detailTab === "timeline" && styles.detailTabTextActive,
                    ]}
                  >
                    Timeline ({selectedCase.timeline?.length ?? 0})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.detailTabBtn,
                    detailTab === "notes" && styles.detailTabBtnActive,
                  ]}
                  onPress={() => setDetailTab("notes")}
                >
                  <Text
                    style={[
                      styles.detailTabText,
                      detailTab === "notes" && styles.detailTabTextActive,
                    ]}
                  >
                    Internal Notes ({selectedCase.internalNotes?.length ?? 0})
                  </Text>
                </Pressable>
              </View>

              {/* Modal Body */}
              <ScrollView contentContainerStyle={styles.modalScrollBody}>
                {detailTab === "overview" && (
                  <View style={styles.overviewSection}>
                    <Text style={styles.overviewTitle}>
                      {selectedCase.title}
                    </Text>
                    <Text style={styles.overviewDescription}>
                      {selectedCase.description}
                    </Text>

                    {/* Context Cards */}
                    <Card style={styles.contextCard}>
                      <Text style={styles.contextHeading}>
                        Linked Healthcare Context
                      </Text>

                      <View style={styles.contextRow}>
                        <Text style={styles.contextLabel}>Assigned Staff:</Text>
                        <Text style={styles.contextValue}>
                          {selectedCase.assignedTo?.name
                            ? `${selectedCase.assignedTo.name} (${selectedCase.assignedTo.role})`
                            : "Unassigned"}
                        </Text>
                      </View>

                      {selectedCase.hospitalId &&
                        typeof selectedCase.hospitalId === "object" && (
                          <View style={styles.contextRow}>
                            <Text style={styles.contextLabel}>Hospital:</Text>
                            <Text style={styles.contextValue}>
                              {selectedCase.hospitalId.name}
                            </Text>
                          </View>
                        )}

                      {selectedCase.patientId &&
                        typeof selectedCase.patientId === "object" && (
                          <View style={styles.contextRow}>
                            <Text style={styles.contextLabel}>Patient:</Text>
                            <Text style={styles.contextValue}>
                              {selectedCase.patientId.name} (
                              {selectedCase.patientId.email || "No email"})
                            </Text>
                          </View>
                        )}

                      {selectedCase.doctorId &&
                        typeof selectedCase.doctorId === "object" && (
                          <View style={styles.contextRow}>
                            <Text style={styles.contextLabel}>Doctor:</Text>
                            <Text style={styles.contextValue}>
                              Dr. {selectedCase.doctorId.name} (
                              {selectedCase.doctorId.specialization ||
                                selectedCase.doctorId.specialty ||
                                "General"}
                              )
                            </Text>
                          </View>
                        )}

                      {selectedCase.appointmentId &&
                        typeof selectedCase.appointmentId === "object" && (
                          <View style={styles.contextRow}>
                            <Text style={styles.contextLabel}>
                              Appointment:
                            </Text>
                            <Text style={styles.contextValue}>
                              {selectedCase.appointmentId.appointmentDate ||
                                selectedCase.appointmentId.date}{" "}
                              · {selectedCase.appointmentId.status}
                            </Text>
                          </View>
                        )}

                      {selectedCase.paymentId && (
                        <View style={styles.contextRow}>
                          <Text style={styles.contextLabel}>Payment ID:</Text>
                          <Text style={styles.contextValue}>
                            {selectedCase.paymentId}
                          </Text>
                        </View>
                      )}
                    </Card>

                    {/* Resolution Section if resolved */}
                    {selectedCase.resolutionNotes && (
                      <Card
                        style={[
                          styles.contextCard,
                          { borderLeftColor: "#10B981", borderLeftWidth: 4 },
                        ]}
                      >
                        <Text
                          style={[styles.contextHeading, { color: "#10B981" }]}
                        >
                          Resolution Summary
                        </Text>
                        <Text style={styles.resolutionNotesText}>
                          {selectedCase.resolutionNotes}
                        </Text>
                        {selectedCase.rootCause ? (
                          <View style={{ marginTop: 8 }}>
                            <Text style={styles.contextLabel}>Root Cause:</Text>
                            <Text style={styles.contextValue}>
                              {selectedCase.rootCause}
                            </Text>
                          </View>
                        ) : null}
                        {selectedCase.correctiveAction ? (
                          <View style={{ marginTop: 8 }}>
                            <Text style={styles.contextLabel}>
                              Corrective Action:
                            </Text>
                            <Text style={styles.contextValue}>
                              {selectedCase.correctiveAction}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    )}
                  </View>
                )}

                {detailTab === "timeline" && (
                  <View style={styles.timelineSection}>
                    {selectedCase.timeline?.map((event, idx) => (
                      <View key={event._id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineContent}>
                          <View style={styles.timelineHeaderRow}>
                            <Text style={styles.timelineEventTitle}>
                              {event.event.replace(/_/g, " ")}
                            </Text>
                            <Text style={styles.timelineTimestamp}>
                              {formatDDMMYYYY(event.timestamp)}
                            </Text>
                          </View>
                          {event.note ? (
                            <Text style={styles.timelineNote}>
                              {event.note}
                            </Text>
                          ) : null}
                          {event.performedBy?.name ? (
                            <Text style={styles.timelineAuthor}>
                              By: {event.performedBy.name} (
                              {event.performedBy.role})
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {detailTab === "notes" && (
                  <View style={styles.notesSection}>
                    <Pressable
                      style={styles.addNotePromptBtn}
                      onPress={() => setNoteModalVisible(true)}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.addNotePromptText}>
                        Add Internal Note
                      </Text>
                    </Pressable>

                    {selectedCase.internalNotes?.length === 0 ? (
                      <Text style={styles.noNotesText}>
                        No internal notes logged yet.
                      </Text>
                    ) : (
                      selectedCase.internalNotes?.map((n, idx) => (
                        <Card key={n._id || idx} style={styles.noteCard}>
                          <View style={styles.noteHeader}>
                            <Text style={styles.noteAuthor}>
                              {n.author?.name || "Staff"} (
                              {n.author?.role || "Admin"})
                            </Text>
                            <Text style={styles.noteTime}>
                              {formatDDMMYYYY(n.createdAt)}
                            </Text>
                          </View>
                          <Text style={styles.noteBody}>{n.note}</Text>
                        </Card>
                      ))
                    )}
                  </View>
                )}
              </ScrollView>

              {/* Action Bar Footer */}
              <View style={styles.modalActionBar}>
                {selectedCase.status !== "RESOLVED" &&
                  selectedCase.status !== "CLOSED" && (
                    <>
                      <Pressable
                        style={[
                          styles.actionBtn,
                          { backgroundColor: "#F59E0B" },
                        ]}
                        onPress={() => setEscalateModalVisible(true)}
                      >
                        <Ionicons
                          name="alert-circle-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.actionBtnText}>Escalate</Text>
                      </Pressable>

                      {selectedCase.status === "OPEN" && (
                        <Pressable
                          style={[
                            styles.actionBtn,
                            { backgroundColor: "#2F80ED" },
                          ]}
                          onPress={() => handleStatusTransition("IN_PROGRESS")}
                        >
                          <Ionicons
                            name="play-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                          <Text style={styles.actionBtnText}>Investigate</Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={[
                          styles.actionBtn,
                          { backgroundColor: "#10B981" },
                        ]}
                        onPress={() => setResolveModalVisible(true)}
                      >
                        <Ionicons
                          name="checkmark-done-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.actionBtnText}>Resolve</Text>
                      </Pressable>
                    </>
                  )}

                {selectedCase.status === "RESOLVED" && (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: "#6B7280" }]}
                    onPress={() => handleStatusTransition("CLOSED")}
                  >
                    <Ionicons
                      name="archive-outline"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionBtnText}>Close Ticket</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* CREATE CASE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Register Healthcare Case</Text>
              <Pressable onPress={() => setCreateModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={20}
                  color={AppColors.textPrimary}
                />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Appointment double booking slot conflict"
                placeholderTextColor={Palette.textMuted}
                value={createTitle}
                onChangeText={setCreateTitle}
              />

              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {CATEGORY_OPTIONS.filter((c) => c.key !== "ALL").map((c) => (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.filterPill,
                      createCategory === c.key && styles.filterPillActive,
                    ]}
                    onPress={() =>
                      setCreateCategory(c.key as HealthcareCaseCategory)
                    }
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        createCategory === c.key && styles.filterPillTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Severity *</Text>
              <View style={styles.severityRow}>
                {(
                  [
                    "LOW",
                    "MEDIUM",
                    "HIGH",
                    "CRITICAL",
                  ] as HealthcareCaseSeverity[]
                ).map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.severitySelector,
                      createSeverity === s && styles.severitySelectorActive,
                    ]}
                    onPress={() => setCreateSeverity(s)}
                  >
                    <Text
                      style={[
                        styles.severitySelectorText,
                        createSeverity === s &&
                          styles.severitySelectorTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Detailed Description *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { height: 90, textAlignVertical: "top" },
                ]}
                placeholder="Describe the clinical or operational issue..."
                placeholderTextColor={Palette.textMuted}
                multiline
                numberOfLines={4}
                value={createDescription}
                onChangeText={setCreateDescription}
              />

              <Text style={styles.inputLabel}>
                Payment ID / Transaction (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. pay_N23xYwZ99"
                placeholderTextColor={Palette.textMuted}
                value={createPaymentId}
                onChangeText={setCreatePaymentId}
              />
            </ScrollView>

            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCreateModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={creatingCase ? "Registering..." : "Submit Case"}
                onPress={handleCreateCase}
                loading={creatingCase}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD NOTE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Add Staff Internal Note</Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 100, textAlignVertical: "top" },
              ]}
              placeholder="Record investigation notes, doctor callbacks, or findings..."
              placeholderTextColor={Palette.textMuted}
              multiline
              value={noteText}
              onChangeText={setNoteText}
            />
            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setNoteModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={submittingNote ? "Saving..." : "Add Note"}
                onPress={handleAddNote}
                loading={submittingNote}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ESCALATE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={escalateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEscalateModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={[styles.dialogTitle, { color: "#EF4444" }]}>
              Escalate Case
            </Text>
            <Text style={styles.dialogSubtitle}>
              Escalating will raise priority to HIGH and notify platform
              management.
            </Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 90, textAlignVertical: "top" },
              ]}
              placeholder="Reason for immediate escalation..."
              placeholderTextColor={Palette.textMuted}
              multiline
              value={escalateReason}
              onChangeText={setEscalateReason}
            />
            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEscalateModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={
                  submittingEscalate ? "Escalating..." : "Confirm Escalation"
                }
                variant="danger"
                onPress={handleEscalate}
                loading={submittingEscalate}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* RESOLVE CASE MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogCard, { maxHeight: 520 }]}>
            <Text style={[styles.dialogTitle, { color: "#10B981" }]}>
              Resolve Case
            </Text>

            <ScrollView>
              <Text style={styles.inputLabel}>Resolution Summary *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { height: 80, textAlignVertical: "top" },
                ]}
                placeholder="Action taken to address the issue..."
                placeholderTextColor={Palette.textMuted}
                multiline
                value={resolveNotes}
                onChangeText={setResolveNotes}
              />

              <Text style={styles.inputLabel}>
                Root Cause Analysis (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Doctor schedule discrepancy, network delay"
                placeholderTextColor={Palette.textMuted}
                value={resolveRootCause}
                onChangeText={setResolveRootCause}
              />

              <Text style={styles.inputLabel}>
                Corrective / Preventive Action (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Updated buffer intervals in slot generator"
                placeholderTextColor={Palette.textMuted}
                value={resolveCorrectiveAction}
                onChangeText={setResolveCorrectiveAction}
              />
            </ScrollView>

            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setResolveModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={
                  submittingResolve ? "Resolving..." : "Complete Resolution"
                }
                onPress={handleResolve}
                loading={submittingResolve}
                style={{ flex: 1, marginLeft: 8, backgroundColor: "#10B981" }}
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
  },
  createButtonText: {
    ...Typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: 4,
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
    color: Palette.textMuted,
    fontSize: 11,
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
  severityPill: {
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
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  severityPillText: {
    ...Typography.caption,
    color: AppColors.textSecondary,
    fontWeight: "600",
  },
  casesListContainer: {
    marginTop: Spacing.xs,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  listSectionTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
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
  caseCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  caseCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  caseNumberBox: {
    flex: 1,
  },
  caseNumber: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  caseCategoryTag: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  caseTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  caseDescription: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.xs,
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
  caseCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  footerDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  footerAssignee: {
    ...Typography.caption,
    color: AppColors.textSecondary,
    fontWeight: "600",
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
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  statusBannerLeft: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
  },
  statusBannerRight: {
    alignItems: "flex-end",
  },
  slaDeadlineLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  slaDeadlineTime: {
    ...Typography.caption,
    color: AppColors.textPrimary,
    fontWeight: "600",
  },
  detailTabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  detailTabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  detailTabBtnActive: {
    borderBottomColor: Palette.primary,
  },
  detailTabText: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    fontWeight: "600",
  },
  detailTabTextActive: {
    color: Palette.primary,
  },
  modalScrollBody: {
    padding: Spacing.md,
  },
  overviewSection: {
    gap: Spacing.sm,
  },
  overviewTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
  },
  overviewDescription: {
    ...Typography.body,
    color: AppColors.textSecondary,
    lineHeight: 22,
  },
  contextCard: {
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  contextHeading: {
    ...Typography.body,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  contextLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  contextValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: AppColors.textPrimary,
    flex: 1,
    textAlign: "right",
    marginLeft: Spacing.sm,
  },
  resolutionNotesText: {
    ...Typography.body,
    color: AppColors.textPrimary,
    lineHeight: 20,
  },

  // Timeline
  timelineSection: {
    paddingLeft: Spacing.sm,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    position: "relative",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
    marginTop: 4,
    marginRight: Spacing.sm,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timelineEventTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  timelineTimestamp: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  timelineNote: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  timelineAuthor: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },

  // Notes
  notesSection: {
    gap: Spacing.sm,
  },
  addNotePromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primary,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  addNotePromptText: {
    ...Typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: 6,
  },
  noNotesText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  noteCard: {
    padding: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  noteAuthor: {
    ...Typography.caption,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  noteTime: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  noteBody: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },

  // Modal Action Bar
  modalActionBar: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  actionBtnText: {
    ...Typography.bodySmall,
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: 4,
  },

  // Dialog Overlay
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
  dialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  dialogTitle: {
    ...Typography.h3,
    color: AppColors.textPrimary,
  },
  dialogSubtitle: {
    ...Typography.bodySmall,
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginTop: Spacing.xs,
    marginBottom: 4,
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
  severityRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  severitySelector: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    alignItems: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  severitySelectorActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  severitySelectorText: {
    ...Typography.caption,
    fontWeight: "700",
    color: AppColors.textSecondary,
  },
  severitySelectorTextActive: {
    color: "#FFFFFF",
  },
  dialogActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
});
