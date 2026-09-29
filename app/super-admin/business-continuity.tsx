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
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import businessContinuityService from "@/services/businessContinuity";
import type {
  ContinuityMode,
  ContinuityOverview,
  CriticalDependency,
  FailoverReadinessStatus,
  RecoveryQueueItem,
  RecoveryRunbook,
  RecoveryVerificationResult,
  ServiceCriticality,
  ServiceOperationalState,
} from "@/types";

type ViewTab = "DEPENDENCIES" | "RUNBOOKS" | "RECOVERY_QUEUE" | "GOVERNANCE";

const STATE_VARIANTS: Record<ServiceOperationalState, BadgeVariant> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  FAILED: "error",
  RECOVERING: "primary",
  UNKNOWN: "neutral",
  NOT_CONFIGURED: "neutral",
};

const READINESS_VARIANTS: Record<FailoverReadinessStatus, BadgeVariant> = {
  READY: "success",
  PARTIAL: "warning",
  NOT_READY: "error",
  NOT_CONFIGURED: "neutral",
  UNKNOWN: "neutral",
};

const CRITICALITY_VARIANTS: Record<ServiceCriticality, BadgeVariant> = {
  CRITICAL: "error",
  HIGH: "warning",
  MEDIUM: "primary",
  LOW: "neutral",
};

const MODE_VARIANTS: Record<ContinuityMode, BadgeVariant> = {
  NORMAL: "success",
  DEGRADED: "warning",
  RECOVERY: "primary",
  READ_ONLY: "error",
  MAINTENANCE: "neutral",
};

export default function BusinessContinuityScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ViewTab>("DEPENDENCIES");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core Data States
  const [overview, setOverview] = useState<ContinuityOverview | null>(null);
  const [dependencies, setDependencies] = useState<CriticalDependency[]>([]);
  const [runbooks, setRunbooks] = useState<RecoveryRunbook[]>([]);
  const [queueItems, setQueueItems] = useState<RecoveryQueueItem[]>([]);

  // Filter States
  const [dependencyFilter, setDependencyFilter] = useState<string>("ALL");
  const [runbookFilter, setRunbookFilter] = useState<string>("ALL");
  const [queueStateFilter, setQueueStateFilter] = useState<string>("ALL");
  const [queueSearch, setQueueSearch] = useState<string>("");

  // Expandable items state
  const [expandedRunbookIds, setExpandedRunbookIds] = useState<
    Record<string, boolean>
  >({});
  const [expandedDepIds, setExpandedDepIds] = useState<Record<string, boolean>>(
    {},
  );

  // Override Modal State
  const [selectedDepForOverride, setSelectedDepForOverride] =
    useState<CriticalDependency | null>(null);
  const [overrideState, setOverrideState] = useState<string>("AUTOMATIC");
  const [overrideNotes, setOverrideNotes] = useState<string>("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Mode Switch Modal State
  const [isModeModalVisible, setIsModeModalVisible] = useState(false);
  const [targetMode, setTargetMode] = useState<ContinuityMode>("NORMAL");
  const [modeReason, setModeReason] = useState("");
  const [submittingMode, setSubmittingMode] = useState(false);

  // Queue Action Modal State
  const [selectedQueueItem, setSelectedQueueItem] =
    useState<RecoveryQueueItem | null>(null);
  const [queueActionType, setQueueActionType] = useState<
    "RETRY" | "REVIEW" | "DISMISS"
  >("RETRY");
  const [queueActionReason, setQueueActionReason] = useState("");
  const [submittingQueueAction, setSubmittingQueueAction] = useState(false);

  // Verification State
  const [verifying, setVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<
    RecoveryVerificationResult[] | null
  >(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [overviewData, depData, runbookData, queueData] = await Promise.all(
        [
          businessContinuityService.getOverview(),
          businessContinuityService.getDependencies(),
          businessContinuityService.getRunbooks(),
          businessContinuityService.getRecoveryQueue({ limit: 50 }),
        ],
      );

      setOverview(overviewData);
      setDependencies(depData || []);
      setRunbooks(runbookData || []);
      setQueueItems(queueData.items || []);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load continuity center data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Handle Service Override Submit
  const handleApplyOverride = async () => {
    if (!selectedDepForOverride) return;
    try {
      setSubmittingOverride(true);
      await businessContinuityService.executeRecoveryAction(
        "SET_SERVICE_OVERRIDE",
        undefined,
        {
          serviceKey: selectedDepForOverride.id,
          manualState: overrideState,
          notes: overrideNotes,
        },
      );
      Alert.alert(
        "Success",
        `Service override updated for ${selectedDepForOverride.name}`,
      );
      setSelectedDepForOverride(null);
      setOverrideNotes("");
      loadData();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to update service override";
      Alert.alert("Error", msg);
    } finally {
      setSubmittingOverride(false);
    }
  };

  // Handle Platform Continuity Mode Change
  const handleChangeMode = async () => {
    if (!modeReason.trim() || modeReason.trim().length < 5) {
      Alert.alert(
        "Validation",
        "Please provide a clear justification reason (min 5 characters).",
      );
      return;
    }
    try {
      setSubmittingMode(true);
      await businessContinuityService.changeContinuityMode({
        mode: targetMode,
        reason: modeReason.trim(),
      });
      Alert.alert(
        "Mode Changed",
        `Platform continuity mode successfully updated to ${targetMode}.`,
      );
      setIsModeModalVisible(false);
      setModeReason("");
      loadData();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to change continuity mode";
      Alert.alert("Error", msg);
    } finally {
      setSubmittingMode(false);
    }
  };

  // Handle Recovery Queue Actions (Retry / Review / Dismiss)
  const handleExecuteQueueAction = async () => {
    if (!selectedQueueItem) return;
    try {
      setSubmittingQueueAction(true);
      let actionType:
        | "RETRY_QUEUE_ITEM"
        | "MARK_MANUAL_REVIEW"
        | "DISMISS_RECOVERY_ITEM" = "RETRY_QUEUE_ITEM";
      if (queueActionType === "REVIEW") actionType = "MARK_MANUAL_REVIEW";
      if (queueActionType === "DISMISS") actionType = "DISMISS_RECOVERY_ITEM";

      await businessContinuityService.executeRecoveryAction(
        actionType,
        selectedQueueItem._id,
        {
          reason: queueActionReason || "Super Admin triage action",
        },
      );

      Alert.alert(
        "Action Executed",
        `Queue action completed for ${selectedQueueItem.eventId}`,
      );
      setSelectedQueueItem(null);
      setQueueActionReason("");
      loadData();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to execute queue action";
      Alert.alert("Error", msg);
    } finally {
      setSubmittingQueueAction(false);
    }
  };

  // Handle Run Live Verification
  const handleRunVerification = async (serviceKey?: string) => {
    try {
      setVerifying(true);
      const res = await businessContinuityService.verifyRecovery(serviceKey);
      setVerificationResults(res.data.results);
      Alert.alert(
        "Verification Complete",
        res.data.allHealthy
          ? "All checked services are HEALTHY and operational."
          : `Verification completed: ${res.data.verifiedCount} services tested.`,
      );
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      Alert.alert("Error", msg);
    } finally {
      setVerifying(false);
    }
  };

  // Filtered Dependencies
  const filteredDependencies = dependencies.filter((dep) => {
    if (dependencyFilter === "CRITICAL") return dep.criticality === "CRITICAL";
    if (dependencyFilter === "DEGRADED_FAILED")
      return (
        dep.operationalState === "DEGRADED" || dep.operationalState === "FAILED"
      );
    if (dependencyFilter === "CORE") return dep.category === "core";
    if (dependencyFilter === "FINANCIAL") return dep.category === "financial";
    if (dependencyFilter === "COMMUNICATION")
      return dep.category === "communication";
    if (dependencyFilter === "AI_MEDIA") return dep.category === "ai_document";
    return true;
  });

  // Filtered Runbooks
  const filteredRunbooks = runbooks.filter((rb) => {
    if (runbookFilter === "CRITICAL") return rb.severity === "CRITICAL";
    if (runbookFilter === "DATABASE") return rb.category === "database";
    if (runbookFilter === "FINANCIAL") return rb.category === "financial";
    if (runbookFilter === "COMMUNICATION")
      return rb.category === "communication";
    if (runbookFilter === "AI_MEDIA") return rb.category === "ai_document";
    if (runbookFilter === "INFRASTRUCTURE")
      return rb.category === "infrastructure";
    return true;
  });

  // Filtered Queue Items
  const filteredQueueItems = queueItems.filter((item) => {
    if (queueStateFilter !== "ALL" && item.state !== queueStateFilter)
      return false;
    if (queueSearch) {
      const q = queueSearch.toLowerCase();
      const matchId = item.eventId?.toLowerCase().includes(q);
      const matchType = item.eventType?.toLowerCase().includes(q);
      const matchErr = item.errorMessage?.toLowerCase().includes(q);
      if (!matchId && !matchType && !matchErr) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Business Continuity</Text>
          <View style={styles.placeholder} />
        </View>
        <Loading label="Probing critical dependencies & continuity status..." />
      </SafeAreaView>
    );
  }

  if (error && !overview) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Business Continuity</Text>
          <View style={styles.placeholder} />
        </View>
        <ErrorState
          title="Continuity Engine Error"
          message={error}
          onRetry={loadData}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Business Continuity</Text>
          <Text style={styles.headerSubtitle}>
            Failover & Resilience Center
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Platform Status Banner */}
        {overview && (
          <Card style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <View style={styles.overviewTitleRow}>
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color={Palette.primary}
                />
                <Text style={styles.overviewTitle}>
                  Platform Operational State
                </Text>
              </View>
              <Badge
                label={overview.currentMode}
                variant={MODE_VARIANTS[overview.currentMode] || "primary"}
              />
            </View>

            <Text style={styles.overviewReason}>{overview.modeReason}</Text>
            <Text style={styles.overviewMeta}>
              Updated by {overview.modeChangedByName} •{" "}
              {new Date(overview.modeChangedAt).toLocaleString()}
            </Text>

            {/* Quick KPI Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiVal}>
                  {overview.kpis.healthyCount}/{overview.kpis.totalDependencies}
                </Text>
                <Text style={styles.kpiLabel}>Healthy Services</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text
                  style={[
                    styles.kpiVal,
                    overview.kpis.degradedCount > 0 && styles.kpiValWarning,
                  ]}
                >
                  {overview.kpis.degradedCount}
                </Text>
                <Text style={styles.kpiLabel}>Degraded</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text
                  style={[
                    styles.kpiVal,
                    overview.kpis.failoverReadyCount > 0 &&
                      styles.kpiValSuccess,
                  ]}
                >
                  {overview.kpis.failoverReadyCount}
                </Text>
                <Text style={styles.kpiLabel}>Failover Ready</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text
                  style={[
                    styles.kpiVal,
                    overview.kpis.pendingRecoveryCount > 0 &&
                      styles.kpiValError,
                  ]}
                >
                  {overview.kpis.pendingRecoveryCount}
                </Text>
                <Text style={styles.kpiLabel}>Recovery Queue</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "DEPENDENCIES" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("DEPENDENCIES")}
          >
            <Ionicons
              name="git-network-outline"
              size={18}
              color={
                activeTab === "DEPENDENCIES"
                  ? Palette.primary
                  : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "DEPENDENCIES" && styles.tabTextActive,
              ]}
            >
              Dependencies ({dependencies.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "RUNBOOKS" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("RUNBOOKS")}
          >
            <Ionicons
              name="book-outline"
              size={18}
              color={
                activeTab === "RUNBOOKS" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "RUNBOOKS" && styles.tabTextActive,
              ]}
            >
              Runbooks ({runbooks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "RECOVERY_QUEUE" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("RECOVERY_QUEUE")}
          >
            <Ionicons
              name="layers-outline"
              size={18}
              color={
                activeTab === "RECOVERY_QUEUE"
                  ? Palette.primary
                  : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "RECOVERY_QUEUE" && styles.tabTextActive,
              ]}
            >
              Queue ({queueItems.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "GOVERNANCE" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("GOVERNANCE")}
          >
            <Ionicons
              name="construct-outline"
              size={18}
              color={
                activeTab === "GOVERNANCE" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "GOVERNANCE" && styles.tabTextActive,
              ]}
            >
              Governance
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: DEPENDENCIES */}
        {activeTab === "DEPENDENCIES" && (
          <View style={styles.tabSection}>
            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {[
                { key: "ALL", label: "All" },
                { key: "CRITICAL", label: "Critical Only" },
                { key: "DEGRADED_FAILED", label: "Degraded / Failed" },
                { key: "CORE", label: "Core" },
                { key: "FINANCIAL", label: "Financial" },
                { key: "COMMUNICATION", label: "Communication" },
                { key: "AI_MEDIA", label: "AI & Documents" },
              ].map((chip) => (
                <Pressable
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    dependencyFilter === chip.key && styles.filterChipActive,
                  ]}
                  onPress={() => setDependencyFilter(chip.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      dependencyFilter === chip.key &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredDependencies.length === 0 ? (
              <EmptyState
                title="No Services Match Filter"
                message="Adjust filter chips to view other services."
              />
            ) : (
              filteredDependencies.map((dep) => {
                const isExpanded = Boolean(expandedDepIds[dep.id]);
                return (
                  <Card key={dep.id} style={styles.depCard}>
                    <Pressable
                      onPress={() =>
                        setExpandedDepIds((prev) => ({
                          ...prev,
                          [dep.id]: !prev[dep.id],
                        }))
                      }
                      style={styles.depHeaderRow}
                    >
                      <View style={styles.depTitleCol}>
                        <View style={styles.depBadgeRow}>
                          <Badge
                            label={dep.operationalState}
                            variant={
                              STATE_VARIANTS[dep.operationalState] || "neutral"
                            }
                          />
                          <Badge
                            label={dep.criticality}
                            variant={
                              CRITICALITY_VARIANTS[dep.criticality] || "neutral"
                            }
                          />
                          {dep.manualOverride !== "AUTOMATIC" && (
                            <Badge
                              label={`OVERRIDE: ${dep.manualOverride}`}
                              variant="warning"
                            />
                          )}
                        </View>
                        <Text style={styles.depName}>{dep.name}</Text>
                        <Text style={styles.depCategory}>
                          Category: {dep.category.toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={Palette.textMuted}
                      />
                    </Pressable>

                    <View style={styles.depPillRow}>
                      <View style={styles.failoverPill}>
                        <Text style={styles.failoverPillLabel}>
                          Failover Readiness:
                        </Text>
                        <Badge
                          label={dep.failoverReadiness}
                          variant={
                            READINESS_VARIANTS[dep.failoverReadiness] ||
                            "neutral"
                          }
                        />
                      </View>
                    </View>

                    {/* Active Incidents Alert */}
                    {dep.activeIncidents && dep.activeIncidents.length > 0 && (
                      <View style={styles.incidentAlertBox}>
                        <Ionicons
                          name="warning"
                          size={18}
                          color={Palette.error}
                        />
                        <Text style={styles.incidentAlertText}>
                          {dep.activeIncidents.length} Active Incident(s)
                          Affecting Service
                        </Text>
                      </View>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <View style={styles.depExpandedContent}>
                        <View style={styles.sectionDivider} />
                        <Text style={styles.subSectionTitle}>
                          Fallback & Failover Protocol
                        </Text>
                        <Text style={styles.fallbackDesc}>
                          {dep.fallbackMechanism.description}
                        </Text>
                        {dep.fallbackMechanism.runbookId ? (
                          <Text style={styles.runbookLinkText}>
                            Linked Runbook: {dep.fallbackMechanism.runbookId}
                          </Text>
                        ) : null}

                        <View style={styles.sectionDivider} />
                        <Text style={styles.subSectionTitle}>
                          Live Health Indicators
                        </Text>
                        {Object.entries(dep.healthIndicators || {}).map(
                          ([k, v]) => (
                            <View key={k} style={styles.indicatorRow}>
                              <Text style={styles.indicatorKey}>{k}:</Text>
                              <Text style={styles.indicatorVal}>
                                {String(v)}
                              </Text>
                            </View>
                          ),
                        )}

                        <View style={styles.depActionRow}>
                          <Button
                            title="Manage Service Override"
                            variant="outline"
                            onPress={() => {
                              setSelectedDepForOverride(dep);
                              setOverrideState(
                                dep.manualOverride || "AUTOMATIC",
                              );
                              setOverrideNotes("");
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: RUNBOOKS */}
        {activeTab === "RUNBOOKS" && (
          <View style={styles.tabSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {[
                { key: "ALL", label: "All (10)" },
                { key: "CRITICAL", label: "Critical" },
                { key: "DATABASE", label: "Database" },
                { key: "FINANCIAL", label: "Financial" },
                { key: "COMMUNICATION", label: "Communication" },
                { key: "AI_MEDIA", label: "AI & Media" },
                { key: "INFRASTRUCTURE", label: "Infrastructure" },
              ].map((chip) => (
                <Pressable
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    runbookFilter === chip.key && styles.filterChipActive,
                  ]}
                  onPress={() => setRunbookFilter(chip.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      runbookFilter === chip.key && styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredRunbooks.map((rb) => {
              const isExpanded = Boolean(expandedRunbookIds[rb.runbookId]);
              return (
                <Card key={rb.runbookId} style={styles.runbookCard}>
                  <Pressable
                    onPress={() =>
                      setExpandedRunbookIds((prev) => ({
                        ...prev,
                        [rb.runbookId]: !prev[rb.runbookId],
                      }))
                    }
                    style={styles.runbookHeaderRow}
                  >
                    <View style={styles.runbookTitleCol}>
                      <View style={styles.runbookBadgeRow}>
                        <Badge label={rb.runbookId} variant="primary" />
                        <Badge
                          label={rb.severity}
                          variant={
                            CRITICALITY_VARIANTS[
                              rb.severity as ServiceCriticality
                            ] || "neutral"
                          }
                        />
                      </View>
                      <Text style={styles.runbookTitle}>{rb.title}</Text>
                      <View style={styles.rtoRpoRow}>
                        <Text style={styles.rtoRpoText}>
                          RTO: {rb.estimatedRTO}
                        </Text>
                        <Text style={styles.rtoRpoDivider}>•</Text>
                        <Text style={styles.rtoRpoText}>
                          RPO: {rb.estimatedRPO}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={Palette.textMuted}
                    />
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.runbookExpanded}>
                      <View style={styles.sectionDivider} />
                      <Text style={styles.subSectionTitle}>
                        Trigger Condition
                      </Text>
                      <Text style={styles.runbookDescText}>
                        {rb.triggerCondition}
                      </Text>

                      <Text
                        style={[
                          styles.subSectionTitle,
                          { marginTop: Spacing.md },
                        ]}
                      >
                        Fallback Behavior
                      </Text>
                      <Text style={styles.runbookDescText}>
                        {rb.fallbackBehavior}
                      </Text>

                      <Text
                        style={[
                          styles.subSectionTitle,
                          { marginTop: Spacing.md },
                        ]}
                      >
                        Safety Preconditions
                      </Text>
                      {rb.safetyPreconditions.map((sc, idx) => (
                        <View key={idx} style={styles.checkListItem}>
                          <Ionicons
                            name="shield-outline"
                            size={16}
                            color={Palette.warning}
                          />
                          <Text style={styles.checkListText}>{sc}</Text>
                        </View>
                      ))}

                      <Text
                        style={[
                          styles.subSectionTitle,
                          { marginTop: Spacing.md },
                        ]}
                      >
                        Actionable Steps
                      </Text>
                      {rb.steps.map((st, idx) => (
                        <View key={idx} style={styles.stepItem}>
                          <View style={styles.stepNumBadge}>
                            <Text style={styles.stepNumText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.stepItemText}>{st}</Text>
                        </View>
                      ))}

                      <Text
                        style={[
                          styles.subSectionTitle,
                          { marginTop: Spacing.md },
                        ]}
                      >
                        Data Consistency Guarantees
                      </Text>
                      <Text style={styles.runbookDescText}>
                        {rb.dataConsistencyGuarantees}
                      </Text>

                      <Text
                        style={[
                          styles.subSectionTitle,
                          { marginTop: Spacing.md },
                        ]}
                      >
                        Post-Recovery Verification
                      </Text>
                      <Text style={styles.runbookDescText}>
                        {rb.postRecoveryVerification}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* TAB 3: RECOVERY QUEUE */}
        {activeTab === "RECOVERY_QUEUE" && (
          <View style={styles.tabSection}>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search event ID, type, or error..."
                placeholderTextColor={Palette.textMuted}
                value={queueSearch}
                onChangeText={setQueueSearch}
              />
              {queueSearch ? (
                <Pressable onPress={() => setQueueSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Palette.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
            >
              {[
                { key: "ALL", label: "All Items" },
                { key: "FAILED", label: "Failed" },
                { key: "RETRYING", label: "Retrying" },
                { key: "MANUAL_REVIEW", label: "Manual Review" },
                { key: "RECOVERED", label: "Recovered" },
              ].map((chip) => (
                <Pressable
                  key={chip.key}
                  style={[
                    styles.filterChip,
                    queueStateFilter === chip.key && styles.filterChipActive,
                  ]}
                  onPress={() => setQueueStateFilter(chip.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      queueStateFilter === chip.key &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredQueueItems.length === 0 ? (
              <EmptyState
                title="Recovery Queue Is Clean"
                message="No failed or quarantined workflow events require administrative intervention."
              />
            ) : (
              filteredQueueItems.map((item) => (
                <Card key={item._id} style={styles.queueCard}>
                  <View style={styles.queueHeaderRow}>
                    <View style={styles.queueBadgeRow}>
                      <Badge
                        label={item.state}
                        variant={
                          item.state === "RECOVERED" ||
                          item.state === "PROCESSED"
                            ? "success"
                            : item.state === "RETRYING"
                              ? "primary"
                              : item.state === "MANUAL_REVIEW"
                                ? "warning"
                                : "error"
                        }
                      />
                      <Badge
                        label={item.failureCategory || "TRANSIENT"}
                        variant="neutral"
                      />
                    </View>
                    <Text style={styles.queueDate}>
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  <Text style={styles.queueEventId}>Event: {item.eventId}</Text>
                  <Text style={styles.queueEventType}>
                    Type: {item.eventType}
                  </Text>

                  {item.errorMessage && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorBoxText} numberOfLines={3}>
                        {item.errorMessage}
                      </Text>
                    </View>
                  )}

                  <View style={styles.queueMetaRow}>
                    <Text style={styles.queueMetaText}>
                      Retries: {item.retryCount} / {item.maxRetries}
                    </Text>
                    {item.idempotencyKey && (
                      <Text style={styles.queueMetaText}>
                        Idempotency: {item.idempotencyKey.slice(0, 14)}...
                      </Text>
                    )}
                  </View>

                  {item.state !== "RECOVERED" && item.state !== "IGNORED" && (
                    <View style={styles.queueActionButtons}>
                      <Button
                        title="Safe Retry"
                        variant="primary"
                        onPress={() => {
                          setSelectedQueueItem(item);
                          setQueueActionType("RETRY");
                          setQueueActionReason(
                            "Super Admin manual replay triggered.",
                          );
                        }}
                      />
                      <Button
                        title="Flag Review"
                        variant="outline"
                        onPress={() => {
                          setSelectedQueueItem(item);
                          setQueueActionType("REVIEW");
                          setQueueActionReason(
                            "Flagged for administrative investigation.",
                          );
                        }}
                      />
                      <Button
                        title="Dismiss"
                        variant="ghost"
                        onPress={() => {
                          setSelectedQueueItem(item);
                          setQueueActionType("DISMISS");
                          setQueueActionReason(
                            "Safe dismissal confirmed by Super Admin.",
                          );
                        }}
                      />
                    </View>
                  )}
                </Card>
              ))
            )}
          </View>
        )}

        {/* TAB 4: GOVERNANCE & VERIFICATION */}
        {activeTab === "GOVERNANCE" && (
          <View style={styles.tabSection}>
            {/* Mode Switch Card */}
            <Card style={styles.govCard}>
              <View style={styles.govCardHeader}>
                <Ionicons
                  name="git-commit-outline"
                  size={24}
                  color={Palette.primary}
                />
                <Text style={styles.govCardTitle}>Continuity Mode Control</Text>
              </View>

              <Text style={styles.govCardDesc}>
                Set platform operational mode to safeguard data integrity and
                patient records during service interruptions.
              </Text>

              <View style={styles.modeOptionList}>
                {(
                  [
                    "NORMAL",
                    "DEGRADED",
                    "RECOVERY",
                    "READ_ONLY",
                    "MAINTENANCE",
                  ] as ContinuityMode[]
                ).map((m) => {
                  const isCurrent = overview?.currentMode === m;
                  return (
                    <Pressable
                      key={m}
                      style={[
                        styles.modeRow,
                        isCurrent && styles.modeRowCurrent,
                      ]}
                      onPress={() => {
                        setTargetMode(m);
                        setModeReason("");
                        setIsModeModalVisible(true);
                      }}
                    >
                      <View style={styles.modeRowLeft}>
                        <Badge label={m} variant={MODE_VARIANTS[m]} />
                        <Text style={styles.modeRowLabel}>
                          {m === "NORMAL" &&
                            "Standard multi-channel healthcare operations."}
                          {m === "DEGRADED" &&
                            "Non-critical fallbacks active; appointments proceed."}
                          {m === "RECOVERY" &&
                            "Automated & manual event replays executing."}
                          {m === "READ_ONLY" &&
                            "Records visible; writes & payments paused."}
                          {m === "MAINTENANCE" &&
                            "Scheduled engineering window in progress."}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          isCurrent ? "checkmark-circle" : "chevron-forward"
                        }
                        size={22}
                        color={isCurrent ? Palette.success : Palette.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Disaster Recovery Verification Card */}
            <Card style={styles.govCard}>
              <View style={styles.govCardHeader}>
                <Ionicons name="pulse" size={24} color={Palette.primary} />
                <Text style={styles.govCardTitle}>
                  Live Recovery Verification
                </Text>
              </View>

              <Text style={styles.govCardDesc}>
                Execute end-to-end operational probes against all 10 critical
                dependencies to confirm failover resolution.
              </Text>

              <Button
                title={
                  verifying
                    ? "Verifying Services..."
                    : "Run Platform Recovery Verification"
                }
                variant="primary"
                loading={verifying}
                disabled={verifying}
                onPress={() => handleRunVerification("ALL")}
              />

              {verificationResults && (
                <View style={styles.verificationList}>
                  <Text style={styles.verificationHeading}>
                    Verification Results:
                  </Text>
                  {verificationResults.map((r) => (
                    <View key={r.serviceKey} style={styles.verificationRow}>
                      <Ionicons
                        name={r.isHealthy ? "checkmark-circle" : "alert-circle"}
                        size={18}
                        color={r.isHealthy ? Palette.success : Palette.error}
                      />
                      <Text style={styles.verificationName}>{r.name}</Text>
                      <Badge
                        label={r.operationalState}
                        variant={
                          STATE_VARIANTS[r.operationalState] || "neutral"
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Disaster Recovery Backup Card */}
            {overview?.lastBackup && (
              <Card style={styles.govCard}>
                <View style={styles.govCardHeader}>
                  <Ionicons
                    name="server-outline"
                    size={24}
                    color={Palette.primary}
                  />
                  <Text style={styles.govCardTitle}>
                    Disaster Recovery Backup
                  </Text>
                </View>

                <View style={styles.backupInfoRow}>
                  <Text style={styles.backupLabel}>Last Snapshot:</Text>
                  <Text style={styles.backupVal}>
                    {overview.lastBackup.timestamp
                      ? new Date(overview.lastBackup.timestamp).toLocaleString()
                      : "No Backup Recorded"}
                  </Text>
                </View>

                <View style={styles.backupInfoRow}>
                  <Text style={styles.backupLabel}>Status:</Text>
                  <Badge
                    label={overview.lastBackup.status}
                    variant={
                      overview.lastBackup.status === "COMPLETED"
                        ? "success"
                        : "warning"
                    }
                  />
                </View>

                {overview.lastBackup.sizeMb && (
                  <View style={styles.backupInfoRow}>
                    <Text style={styles.backupLabel}>Snapshot Size:</Text>
                    <Text style={styles.backupVal}>
                      {overview.lastBackup.sizeMb} MB
                    </Text>
                  </View>
                )}
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL: Service Override */}
      <Modal
        visible={Boolean(selectedDepForOverride)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDepForOverride(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Service State Override</Text>
              <Pressable onPress={() => setSelectedDepForOverride(null)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {selectedDepForOverride && (
              <>
                <Text style={styles.modalSubTitle}>
                  {selectedDepForOverride.name}
                </Text>

                <Text style={styles.inputLabel}>Select Override Mode:</Text>
                <View style={styles.overrideOptionsRow}>
                  {[
                    { key: "AUTOMATIC", label: "Auto Probe" },
                    { key: "FORCE_DEGRADED", label: "Degraded" },
                    { key: "FORCE_FAILOVER", label: "Failover" },
                    { key: "FORCE_MAINTENANCE", label: "Maintenance" },
                  ].map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.overrideOptionChip,
                        overrideState === opt.key &&
                          styles.overrideOptionChipActive,
                      ]}
                      onPress={() => setOverrideState(opt.key)}
                    >
                      <Text
                        style={[
                          styles.overrideOptionText,
                          overrideState === opt.key &&
                            styles.overrideOptionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Operator Notes / Reason:</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Reason for manual service state override..."
                  placeholderTextColor={Palette.textMuted}
                  value={overrideNotes}
                  onChangeText={setOverrideNotes}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalButtonRow}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setSelectedDepForOverride(null)}
                  />
                  <Button
                    title={submittingOverride ? "Applying..." : "Save Override"}
                    variant="primary"
                    loading={submittingOverride}
                    disabled={submittingOverride}
                    onPress={handleApplyOverride}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL: Continuity Mode Switch */}
      <Modal
        visible={isModeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Platform Mode</Text>
              <Pressable onPress={() => setIsModeModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <View style={styles.targetModeRow}>
              <Text style={styles.targetModeLabel}>Target Mode:</Text>
              <Badge label={targetMode} variant={MODE_VARIANTS[targetMode]} />
            </View>

            <Text style={styles.inputLabel}>
              Justification Reason (Required):
            </Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="Explain why the platform continuity mode is changing..."
              placeholderTextColor={Palette.textMuted}
              value={modeReason}
              onChangeText={setModeReason}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setIsModeModalVisible(false)}
              />
              <Button
                title={submittingMode ? "Updating..." : "Confirm Mode Change"}
                variant={
                  targetMode === "READ_ONLY" || targetMode === "MAINTENANCE"
                    ? "danger"
                    : "primary"
                }
                loading={submittingMode}
                disabled={submittingMode}
                onPress={handleChangeMode}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Queue Triage Action */}
      <Modal
        visible={Boolean(selectedQueueItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedQueueItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {queueActionType === "RETRY" && "Safe Event Replay"}
                {queueActionType === "REVIEW" && "Flag for Manual Review"}
                {queueActionType === "DISMISS" && "Quarantine / Dismiss Event"}
              </Text>
              <Pressable onPress={() => setSelectedQueueItem(null)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {selectedQueueItem && (
              <>
                <Text style={styles.modalSubTitle}>
                  Event ID: {selectedQueueItem.eventId}
                </Text>
                <Text style={styles.modalSubMeta}>
                  Type: {selectedQueueItem.eventType}
                </Text>

                <Text style={styles.inputLabel}>
                  Action Reason / Operator Log:
                </Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Enter audit trail justification for this triage action..."
                  placeholderTextColor={Palette.textMuted}
                  value={queueActionReason}
                  onChangeText={setQueueActionReason}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalButtonRow}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    onPress={() => setSelectedQueueItem(null)}
                  />
                  <Button
                    title={
                      submittingQueueAction ? "Executing..." : "Confirm Action"
                    }
                    variant={
                      queueActionType === "DISMISS" ? "danger" : "primary"
                    }
                    loading={submittingQueueAction}
                    disabled={submittingQueueAction}
                    onPress={handleExecuteQueueAction}
                  />
                </View>
              </>
            )}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  backButton: {
    padding: Spacing.xs,
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  placeholder: {
    width: 24,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  overviewCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  overviewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  overviewTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  overviewReason: {
    ...Typography.body,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  overviewMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  kpiGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.md,
  },
  kpiBox: {
    flex: 1,
    alignItems: "center",
  },
  kpiVal: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.primary,
  },
  kpiValWarning: {
    color: Palette.warning,
  },
  kpiValSuccess: {
    color: Palette.success,
  },
  kpiValError: {
    color: Palette.error,
  },
  kpiLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: 4,
    borderRadius: Radius.sm,
  },
  tabButtonActive: {
    backgroundColor: Palette.primaryLight,
  },
  tabText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.primary,
  },
  tabSection: {
    gap: Spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: Spacing.xs,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  filterChipTextActive: {
    color: Palette.surface,
  },
  depCard: {
    padding: Spacing.md,
  },
  depHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  depTitleCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  depBadgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    flexWrap: "wrap",
  },
  depName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  depCategory: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  depPillRow: {
    marginTop: Spacing.sm,
  },
  failoverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  failoverPillLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  incidentAlertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#FDE8EA",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  incidentAlertText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.error,
  },
  depExpandedContent: {
    marginTop: Spacing.sm,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  subSectionTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 4,
  },
  fallbackDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  runbookLinkText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
    marginTop: 4,
  },
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  indicatorKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  indicatorVal: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  depActionRow: {
    marginTop: Spacing.md,
  },
  runbookCard: {
    padding: Spacing.md,
  },
  runbookHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  runbookTitleCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  runbookBadgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  runbookTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  rtoRpoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 4,
  },
  rtoRpoText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  rtoRpoDivider: {
    color: Palette.textMuted,
  },
  runbookExpanded: {
    marginTop: Spacing.sm,
  },
  runbookDescText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  checkListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginVertical: 2,
  },
  checkListText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginVertical: 4,
  },
  stepNumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
    fontSize: 10,
  },
  stepItemText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Palette.text,
    padding: 0,
  },
  queueCard: {
    padding: Spacing.md,
  },
  queueHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  queueBadgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  queueDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  queueEventId: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  queueEventType: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: "#FDE8EA",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.sm,
  },
  errorBoxText: {
    ...Typography.caption,
    color: Palette.error,
    fontFamily: "monospace",
  },
  queueMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: Spacing.xs,
  },
  queueMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  queueActionButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  govCard: {
    padding: Spacing.md,
  },
  govCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  govCardTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  govCardDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  modeOptionList: {
    gap: Spacing.xs,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  modeRowCurrent: {
    borderColor: Palette.success,
    backgroundColor: "#E6F7ED",
  },
  modeRowLeft: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  modeRowLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
  },
  verificationList: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  verificationHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  verificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  verificationName: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
    marginLeft: Spacing.xs,
  },
  backupInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  backupLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  backupVal: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalSubTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.primary,
  },
  modalSubMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  overrideOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  overrideOptionChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  overrideOptionChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  overrideOptionText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  overrideOptionTextActive: {
    color: Palette.surface,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
    textAlignVertical: "top",
  },
  targetModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  targetModeLabel: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
