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
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import * as changeImpactService from "@/services/changeImpact";
import type {
  ChangeRequest,
  ChangeImpactReport,
  ChangeGovernanceKpis,
  CandidateTargets,
  ChangeType,
  ChangeTargetType,
  ChangeStatus,
  DependencyCountLevel,
  DependencyTreeNode,
} from "@/types";

type FilterTab = "ALL" | "PREVIEWED" | "VALIDATED" | "APPLIED" | "HIGH_IMPACT";

const STATUS_BADGE_VARIANTS: Record<ChangeStatus, BadgeVariant> = {
  PREVIEWED: "neutral",
  VALIDATED: "primary",
  APPROVED: "success",
  APPLIED: "success",
  REJECTED: "error",
  ROLLED_BACK: "warning",
};

const DEPENDENCY_LEVEL_VARIANTS: Record<DependencyCountLevel, BadgeVariant> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "error",
};

export default function ChangeImpactScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core Data
  const [kpis, setKpis] = useState<ChangeGovernanceKpis | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [candidateTargets, setCandidateTargets] =
    useState<CandidateTargets | null>(null);

  // Detail / Impact Inspection Modal
  const [inspectingRequest, setInspectingRequest] =
    useState<ChangeRequest | null>(null);

  // New Change Preview Drawer / Modal
  const [isNewModalVisible, setIsNewModalVisible] = useState(false);
  const [newChangeType, setNewChangeType] = useState<ChangeType>(
    "SUBSCRIPTION_PLAN_CHANGE",
  );
  const [newTargetType, setNewTargetType] =
    useState<ChangeTargetType>("subscription_plan");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [proposedInput, setProposedInput] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [previewingImpact, setPreviewingImpact] = useState(false);
  const [dryRunReport, setDryRunReport] = useState<ChangeImpactReport | null>(
    null,
  );
  const [creatingRequest, setCreatingRequest] = useState(false);

  // Apply Modal
  const [applyingRequest, setApplyingRequest] = useState<ChangeRequest | null>(
    null,
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [executingApply, setExecutingApply] = useState(false);

  // Reject Modal
  const [rejectingRequest, setRejectingRequest] =
    useState<ChangeRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [executingReject, setExecutingReject] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      let statusParam: string | undefined;
      let dependencyLevelParam: string | undefined;

      if (activeTab === "PREVIEWED") statusParam = "PREVIEWED";
      else if (activeTab === "VALIDATED") statusParam = "VALIDATED";
      else if (activeTab === "APPLIED") statusParam = "APPLIED";
      else if (activeTab === "HIGH_IMPACT") dependencyLevelParam = "HIGH";

      const [kpiRes, reqRes, targetRes] = await Promise.all([
        changeImpactService.getChangeGovernanceKpis(),
        changeImpactService.getChangeRequests({
          status: statusParam,
          dependencyCountLevel: dependencyLevelParam,
          search: searchQuery.trim() || undefined,
          limit: 40,
        }),
        changeImpactService.getTargetCandidates(),
      ]);

      setKpis(kpiRes);
      setRequests(reqRes.requests || []);
      setCandidateTargets(targetRes);

      // Pre-select first target if available
      if (targetRes?.subscription_plans?.length && !selectedTargetId) {
        setSelectedTargetId(targetRes.subscription_plans[0].key);
        setProposedInput(
          JSON.stringify(
            {
              monthlyPrice:
                (targetRes.subscription_plans[0].monthlyPrice || 999) + 100,
            },
            null,
            2,
          ),
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load change governance data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery, selectedTargetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectChangeType = (type: ChangeType) => {
    setNewChangeType(type);
    setDryRunReport(null);

    if (type === "SUBSCRIPTION_PLAN_CHANGE") {
      setNewTargetType("subscription_plan");
      const first = candidateTargets?.subscription_plans?.[0];
      if (first) {
        setSelectedTargetId(first.key);
        setProposedInput(
          JSON.stringify({ monthlyPrice: first.monthlyPrice + 100 }, null, 2),
        );
      }
    } else if (type === "DOCTOR_STATUS_CHANGE") {
      setNewTargetType("doctor");
      const first = candidateTargets?.doctors?.[0];
      if (first) {
        setSelectedTargetId(first._id);
        setProposedInput(JSON.stringify({ available: false }, null, 2));
      }
    } else if (type === "HOSPITAL_STATUS_CHANGE") {
      setNewTargetType("hospital");
      const first = candidateTargets?.hospitals?.[0];
      if (first) {
        setSelectedTargetId(first._id);
        setProposedInput(JSON.stringify({ isActive: true }, null, 2));
      }
    } else if (type === "SLA_POLICY_CHANGE") {
      setNewTargetType("service_sla_policy");
      const first = candidateTargets?.sla_policies?.[0];
      if (first) {
        setSelectedTargetId(first.policyKey);
        setProposedInput(
          JSON.stringify(
            { targetDurationMinutes: first.targetDurationMinutes + 10 },
            null,
            2,
          ),
        );
      }
    } else if (type === "AUTOMATION_RULE_CHANGE") {
      setNewTargetType("workflow_automation_rule");
      const first = candidateTargets?.automation_rules?.[0];
      if (first) {
        setSelectedTargetId(first.ruleId);
        setProposedInput(JSON.stringify({ isActive: true }, null, 2));
      }
    }
  };

  const handleRunDryRunPreview = async () => {
    if (!selectedTargetId) {
      Alert.alert("Missing Target", "Please select an entity to evaluate.");
      return;
    }

    let parsedProposed: Record<string, unknown> = {};
    try {
      parsedProposed = proposedInput.trim() ? JSON.parse(proposedInput) : {};
    } catch {
      Alert.alert(
        "Invalid JSON",
        "Please ensure proposed changes are formatted as valid JSON.",
      );
      return;
    }

    try {
      setPreviewingImpact(true);
      const report = await changeImpactService.previewChangeImpact({
        changeType: newChangeType,
        targetType: newTargetType,
        targetId: selectedTargetId,
        proposedState: parsedProposed,
      });
      setDryRunReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impact dry-run failed";
      Alert.alert("Impact Analysis Error", msg);
    } finally {
      setPreviewingImpact(false);
    }
  };

  const handleCreateChangeRequest = async () => {
    if (!selectedTargetId) {
      Alert.alert("Missing Target", "Please select a target entity.");
      return;
    }
    if (!changeReason.trim()) {
      Alert.alert(
        "Justification Required",
        "Please enter an administrative reason for this change.",
      );
      return;
    }

    let parsedProposed: Record<string, unknown> = {};
    try {
      parsedProposed = proposedInput.trim() ? JSON.parse(proposedInput) : {};
    } catch {
      Alert.alert(
        "Invalid JSON",
        "Please format proposed state as valid JSON.",
      );
      return;
    }

    try {
      setCreatingRequest(true);
      await changeImpactService.createChangeRequest({
        changeType: newChangeType,
        targetType: newTargetType,
        targetId: selectedTargetId,
        proposedState: parsedProposed,
        reason: changeReason.trim(),
      });

      Alert.alert("Success", "Change request submitted to governance catalog.");
      setIsNewModalVisible(false);
      setChangeReason("");
      setDryRunReport(null);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create change request";
      Alert.alert("Creation Error", msg);
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleApplyChange = async () => {
    if (!applyingRequest) return;

    try {
      setExecutingApply(true);
      const applied = await changeImpactService.applyChangeRequest(
        applyingRequest.changeId,
        { overrideReason: overrideReason.trim() || undefined },
      );

      Alert.alert(
        "Change Applied",
        `Change ${applied.changeId} has been successfully applied to production.`,
      );
      setApplyingRequest(null);
      setOverrideReason("");
      if (inspectingRequest?.changeId === applied.changeId) {
        setInspectingRequest(applied);
      }
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply change";
      Alert.alert("Application Blocked", msg);
    } finally {
      setExecutingApply(false);
    }
  };

  const handleRejectChange = async () => {
    if (!rejectingRequest) return;
    if (!rejectionReason.trim()) {
      Alert.alert(
        "Rejection Reason Required",
        "Please provide a reason for rejecting this change.",
      );
      return;
    }

    try {
      setExecutingReject(true);
      const rejected = await changeImpactService.rejectChangeRequest(
        rejectingRequest.changeId,
        { reason: rejectionReason.trim() },
      );

      Alert.alert(
        "Change Rejected",
        `Change ${rejected.changeId} has been rejected.`,
      );
      setRejectingRequest(null);
      setRejectionReason("");
      if (inspectingRequest?.changeId === rejected.changeId) {
        setInspectingRequest(rejected);
      }
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reject change";
      Alert.alert("Rejection Error", msg);
    } finally {
      setExecutingReject(false);
    }
  };

  const renderDependencyTreeNode = (node: DependencyTreeNode, level = 0) => {
    return (
      <View
        key={node.id}
        style={[
          styles.treeNodeCard,
          level > 0 && {
            marginLeft: Spacing.md,
            borderLeftWidth: 2,
            borderLeftColor: Palette.border,
          },
        ]}
      >
        <View style={styles.treeNodeHeader}>
          <View style={styles.treeNodeTitleRow}>
            <Ionicons
              name={
                node.category === "active_subscribers"
                  ? "people"
                  : node.category === "doctor_schedule"
                    ? "medkit"
                    : node.category === "appointment_queue"
                      ? "calendar"
                      : node.category === "financial_gateway"
                        ? "card"
                        : node.category === "service_sla"
                          ? "time"
                          : node.category === "workflow_automation"
                            ? "git-network"
                            : "cube"
              }
              size={18}
              color={
                node.severity === "blocking"
                  ? Palette.error
                  : node.severity === "warning"
                    ? Palette.warning
                    : Palette.primary
              }
            />
            <Text style={styles.treeNodeLabel}>{node.label}</Text>
          </View>
          <View style={styles.treeNodeCountBadge}>
            <Text style={styles.treeNodeCountText}>{node.count} affected</Text>
          </View>
        </View>

        {node.description ? (
          <Text style={styles.treeNodeDesc}>{node.description}</Text>
        ) : null}

        {node.children && node.children.length > 0 ? (
          <View style={styles.treeChildrenContainer}>
            {node.children.map((child) =>
              renderDependencyTreeNode(child, level + 1),
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Change Governance</Text>
          <Text style={styles.headerSubtitle}>
            Pre-Change Dependency & Blast-Radius Engine
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={onRefresh}
            style={styles.iconButton}
            accessibilityLabel="Refresh"
          >
            <Ionicons name="refresh" size={20} color={Palette.text} />
          </Pressable>
          <Pressable
            onPress={() => setIsNewModalVisible(true)}
            style={styles.newChangeBtn}
            accessibilityLabel="New Change Evaluation"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.newChangeBtnText}>Evaluate</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* KPI Ribbon */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <View style={styles.kpiIconWrapper}>
              <Ionicons
                name="layers-outline"
                size={20}
                color={Palette.primary}
              />
            </View>
            <Text style={styles.kpiValue}>{kpis?.totalChanges ?? 0}</Text>
            <Text style={styles.kpiLabel}>Total Changes</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[
                styles.kpiIconWrapper,
                { backgroundColor: Palette.surfaceAlt },
              ]}
            >
              <Ionicons name="eye-outline" size={20} color={Palette.text} />
            </View>
            <Text style={styles.kpiValue}>{kpis?.pendingPreviews ?? 0}</Text>
            <Text style={styles.kpiLabel}>Pending Previews</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[
                styles.kpiIconWrapper,
                { backgroundColor: "rgba(239, 68, 68, 0.1)" },
              ]}
            >
              <Ionicons
                name="warning-outline"
                size={20}
                color={Palette.error}
              />
            </View>
            <Text style={[styles.kpiValue, { color: Palette.error }]}>
              {kpis?.highImpactChanges ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>High Impact</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[
                styles.kpiIconWrapper,
                { backgroundColor: "rgba(16, 185, 129, 0.1)" },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={Palette.success}
              />
            </View>
            <Text style={[styles.kpiValue, { color: Palette.success }]}>
              {kpis?.appliedChanges ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Applied</Text>
          </Card>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {(
            [
              { key: "ALL", label: "All Changes" },
              { key: "PREVIEWED", label: "Previewed" },
              { key: "VALIDATED", label: "Validated" },
              { key: "HIGH_IMPACT", label: "High Impact" },
              { key: "APPLIED", label: "Applied" },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabPill,
                activeTab === tab.key && styles.tabPillActive,
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === tab.key && styles.tabPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={Palette.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by target name, change ID, or reason..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Content Section */}
        {loading ? (
          <Loading label="Evaluating dependency impact records..." />
        ) : error ? (
          <ErrorState
            title="Failed to Load Data"
            message={error}
            onRetry={loadData}
          />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No Change Requests Found"
            message="No configuration or policy changes match the active filter. Tap 'Evaluate' to preview a new change."
            action={
              <Button
                title="Evaluate New Change"
                onPress={() => setIsNewModalVisible(true)}
              />
            }
          />
        ) : (
          <View style={styles.requestList}>
            {requests.map((item) => {
              const counts = item.impactReport?.affectedRecordCounts || {};
              const countKeys = Object.keys(counts);

              return (
                <Card key={item.changeId} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.targetInfo}>
                      <Text style={styles.changeIdText}>{item.changeId}</Text>
                      <Text style={styles.targetNameText}>
                        {item.targetName}
                      </Text>
                      <Text style={styles.targetTypeLabel}>
                        Target: {item.targetType.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.badgeColumn}>
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANTS[item.status] || "neutral"
                        }
                        label={item.status}
                      />
                      <View style={{ height: Spacing.xs }} />
                      <Badge
                        variant={
                          DEPENDENCY_LEVEL_VARIANTS[
                            item.dependencyCountLevel
                          ] || "neutral"
                        }
                        label={`${item.dependencyCountLevel} IMPACT`}
                      />
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.reasonText} numberOfLines={2}>
                    <Text style={styles.reasonBold}>Reason: </Text>
                    {item.reason}
                  </Text>

                  {/* Factual Record Counts Strip */}
                  {countKeys.length > 0 ? (
                    <View style={styles.countsStrip}>
                      {countKeys.slice(0, 3).map((k) => (
                        <View key={k} style={styles.countBadge}>
                          <Text style={styles.countNumber}>
                            {counts[k] ?? 0}
                          </Text>
                          <Text style={styles.countLabel}>
                            {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Card Actions */}
                  <View style={styles.cardActions}>
                    <Button
                      title="Inspect Impact"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => setInspectingRequest(item)}
                    />
                    {item.status !== "APPLIED" && item.status !== "REJECTED" ? (
                      <View style={styles.actionButtonGroup}>
                        <Button
                          title="Reject"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() => setRejectingRequest(item)}
                        />
                        <View style={{ width: Spacing.xs }} />
                        <Button
                          title="Apply Safely"
                          variant="primary"
                          fullWidth={false}
                          onPress={() => setApplyingRequest(item)}
                        />
                      </View>
                    ) : (
                      <Text style={styles.appliedTimestamp}>
                        {item.status === "APPLIED"
                          ? `Applied on ${item.appliedAt ? new Date(item.appliedAt).toLocaleDateString() : "date"}`
                          : `Rejected: ${item.rejectionReason || "Admin"}`}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* 1. DEEP IMPACT REPORT MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={!!inspectingRequest}
        animationType="slide"
        transparent
        onRequestClose={() => setInspectingRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Change Impact & Dependency Tree
                </Text>
                <Text style={styles.modalSubtitle}>
                  {inspectingRequest?.changeId} •{" "}
                  {inspectingRequest?.targetName}
                </Text>
              </View>
              <Pressable
                onPress={() => setInspectingRequest(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Meta Banner */}
              <View style={styles.metaBanner}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Badge
                    variant={
                      inspectingRequest
                        ? STATUS_BADGE_VARIANTS[inspectingRequest.status]
                        : "neutral"
                    }
                    label={inspectingRequest?.status || ""}
                  />
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Dependency Level</Text>
                  <Badge
                    variant={
                      inspectingRequest
                        ? DEPENDENCY_LEVEL_VARIANTS[
                            inspectingRequest.dependencyCountLevel
                          ]
                        : "neutral"
                    }
                    label={`${inspectingRequest?.dependencyCountLevel || ""} IMPACT`}
                  />
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Requested By</Text>
                  <Text style={styles.metaValue}>
                    {inspectingRequest?.requestedByName || "Admin"}
                  </Text>
                </View>
              </View>

              {/* Justification Box */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Change Justification</Text>
                <Text style={styles.sectionBodyText}>
                  {inspectingRequest?.reason}
                </Text>
              </View>

              {/* Current vs Proposed State Comparison */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Proposed State Changes</Text>
                <View style={styles.codeComparisonBox}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(
                      inspectingRequest?.proposedState || {},
                      null,
                      2,
                    )}
                  </Text>
                </View>
              </View>

              {/* Validation Checklist */}
              {inspectingRequest?.impactReport?.validationChecks?.length ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    Safety Validation Checks
                  </Text>
                  {inspectingRequest.impactReport.validationChecks.map(
                    (chk) => (
                      <View key={chk.checkId} style={styles.checkRow}>
                        <Ionicons
                          name={
                            chk.passed ? "checkmark-circle" : "alert-circle"
                          }
                          size={20}
                          color={chk.passed ? Palette.success : Palette.error}
                        />
                        <View style={styles.checkTextCol}>
                          <Text style={styles.checkLabel}>{chk.label}</Text>
                          {chk.details ? (
                            <Text style={styles.checkDetails}>
                              {chk.details}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ),
                  )}
                </View>
              ) : null}

              {/* Warnings / Blocking Issues */}
              {inspectingRequest?.impactReport?.warnings?.length ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    Warnings & Recommendations
                  </Text>
                  {inspectingRequest.impactReport.warnings.map((warn, i) => (
                    <View
                      key={i}
                      style={[
                        styles.warningBox,
                        warn.level === "blocking"
                          ? styles.warningBoxBlocking
                          : styles.warningBoxAdvisory,
                      ]}
                    >
                      <View style={styles.warningHeader}>
                        <Ionicons
                          name={
                            warn.level === "blocking"
                              ? "shield-half"
                              : "information-circle"
                          }
                          size={18}
                          color={
                            warn.level === "blocking"
                              ? Palette.error
                              : Palette.warning
                          }
                        />
                        <Text style={styles.warningLevelText}>
                          {warn.level.toUpperCase()} • {warn.category}
                        </Text>
                      </View>
                      <Text style={styles.warningMsg}>{warn.message}</Text>
                      {warn.recommendation ? (
                        <Text style={styles.warningRec}>
                          💡 Recommendation: {warn.recommendation}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Hierarchical Dependency Tree */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Live Dependency Tree & Record Flow
                </Text>
                {inspectingRequest?.impactReport?.dependencyTree?.map((root) =>
                  renderDependencyTreeNode(root, 0),
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {inspectingRequest?.status !== "APPLIED" &&
              inspectingRequest?.status !== "REJECTED" ? (
                <View style={styles.modalFooterActions}>
                  <Button
                    title="Reject"
                    variant="outline"
                    onPress={() => {
                      setRejectingRequest(inspectingRequest);
                    }}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    title="Apply to Production"
                    variant="primary"
                    onPress={() => {
                      setApplyingRequest(inspectingRequest);
                    }}
                    style={{ flex: 2 }}
                  />
                </View>
              ) : (
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setInspectingRequest(null)}
                  style={{ width: "100%" }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 2. NEW CHANGE PREVIEW DRAWER / MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={isNewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsNewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Evaluate New Change</Text>
                <Text style={styles.modalSubtitle}>
                  Dry-run dependency analysis & safe request creation
                </Text>
              </View>
              <Pressable
                onPress={() => setIsNewModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Change Type Selection */}
              <Text style={styles.inputGroupLabel}>Select Change Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.typeSelectionScroll}
              >
                {(
                  [
                    {
                      key: "SUBSCRIPTION_PLAN_CHANGE",
                      label: "Subscription Plan",
                    },
                    { key: "DOCTOR_STATUS_CHANGE", label: "Doctor Status" },
                    { key: "HOSPITAL_STATUS_CHANGE", label: "Hospital Status" },
                    { key: "SLA_POLICY_CHANGE", label: "SLA Policy" },
                    {
                      key: "AUTOMATION_RULE_CHANGE",
                      label: "Automation Rule",
                    },
                  ] as const
                ).map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => handleSelectChangeType(t.key)}
                    style={[
                      styles.typePill,
                      newChangeType === t.key && styles.typePillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        newChangeType === t.key && styles.typePillTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Target Entity Picker */}
              <Text style={styles.inputGroupLabel}>Select Target Entity</Text>
              <View style={styles.targetPickerContainer}>
                {newChangeType === "SUBSCRIPTION_PLAN_CHANGE" &&
                  candidateTargets?.subscription_plans?.map((p) => (
                    <Pressable
                      key={p.key}
                      onPress={() => setSelectedTargetId(p.key)}
                      style={[
                        styles.targetItem,
                        selectedTargetId === p.key && styles.targetItemActive,
                      ]}
                    >
                      <Text style={styles.targetItemTitle}>
                        {p.name} ({p.key.toUpperCase()})
                      </Text>
                      <Text style={styles.targetItemSubtitle}>
                        Monthly: ₹{p.monthlyPrice} • Yearly: ₹{p.yearlyPrice}
                      </Text>
                    </Pressable>
                  ))}

                {newChangeType === "DOCTOR_STATUS_CHANGE" &&
                  candidateTargets?.doctors?.slice(0, 8).map((d) => (
                    <Pressable
                      key={d._id}
                      onPress={() => setSelectedTargetId(d._id)}
                      style={[
                        styles.targetItem,
                        selectedTargetId === d._id && styles.targetItemActive,
                      ]}
                    >
                      <Text style={styles.targetItemTitle}>
                        {d.name} ({d.speciality})
                      </Text>
                      <Text style={styles.targetItemSubtitle}>
                        {d.hospitalName} • Available:{" "}
                        {d.available ? "Yes" : "No"}
                      </Text>
                    </Pressable>
                  ))}

                {newChangeType === "HOSPITAL_STATUS_CHANGE" &&
                  candidateTargets?.hospitals?.slice(0, 8).map((h) => (
                    <Pressable
                      key={h._id}
                      onPress={() => setSelectedTargetId(h._id)}
                      style={[
                        styles.targetItem,
                        selectedTargetId === h._id && styles.targetItemActive,
                      ]}
                    >
                      <Text style={styles.targetItemTitle}>{h.name}</Text>
                      <Text style={styles.targetItemSubtitle}>
                        Plan: {h.subscriptionPlan} •{" "}
                        {h.location?.city || "City"}
                      </Text>
                    </Pressable>
                  ))}

                {newChangeType === "SLA_POLICY_CHANGE" &&
                  candidateTargets?.sla_policies?.slice(0, 8).map((s) => (
                    <Pressable
                      key={s.policyKey}
                      onPress={() => setSelectedTargetId(s.policyKey)}
                      style={[
                        styles.targetItem,
                        selectedTargetId === s.policyKey &&
                          styles.targetItemActive,
                      ]}
                    >
                      <Text style={styles.targetItemTitle}>{s.title}</Text>
                      <Text style={styles.targetItemSubtitle}>
                        Type: {s.serviceType} • Target:{" "}
                        {s.targetDurationMinutes}m
                      </Text>
                    </Pressable>
                  ))}

                {newChangeType === "AUTOMATION_RULE_CHANGE" &&
                  candidateTargets?.automation_rules?.slice(0, 8).map((r) => (
                    <Pressable
                      key={r.ruleId}
                      onPress={() => setSelectedTargetId(r.ruleId)}
                      style={[
                        styles.targetItem,
                        selectedTargetId === r.ruleId &&
                          styles.targetItemActive,
                      ]}
                    >
                      <Text style={styles.targetItemTitle}>{r.name}</Text>
                      <Text style={styles.targetItemSubtitle}>
                        Trigger: {r.triggerEvent} • Active:{" "}
                        {r.isActive ? "Yes" : "No"}
                      </Text>
                    </Pressable>
                  ))}
              </View>

              {/* Proposed State (JSON) */}
              <Text style={styles.inputGroupLabel}>
                Proposed Configuration State (JSON)
              </Text>
              <TextInput
                style={styles.jsonTextArea}
                multiline
                numberOfLines={4}
                value={proposedInput}
                onChangeText={setProposedInput}
                placeholder='{"monthlyPrice": 1299}'
                placeholderTextColor={Palette.textMuted}
              />

              {/* Justification Reason */}
              <Text style={styles.inputGroupLabel}>
                Administrative Justification / Reason *
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Explain the operational rationale for this change..."
                placeholderTextColor={Palette.textMuted}
                value={changeReason}
                onChangeText={setChangeReason}
                multiline
                numberOfLines={2}
              />

              {/* Dry-run action */}
              <View style={{ marginVertical: Spacing.md }}>
                <Button
                  title="Dry-Run Impact Analysis"
                  variant="outline"
                  loading={previewingImpact}
                  onPress={handleRunDryRunPreview}
                />
              </View>

              {/* Dry-Run Result Preview */}
              {dryRunReport ? (
                <View style={styles.dryRunCard}>
                  <View style={styles.dryRunHeader}>
                    <Text style={styles.dryRunTitle}>
                      Dry-Run Evaluation Result
                    </Text>
                    <Badge
                      variant={
                        DEPENDENCY_LEVEL_VARIANTS[
                          dryRunReport.dependencyCountLevel
                        ]
                      }
                      label={`${dryRunReport.dependencyCountLevel} IMPACT`}
                    />
                  </View>

                  <Text style={styles.dryRunSub}>
                    Target: {dryRunReport.targetName}
                  </Text>

                  {/* Factual counts */}
                  <View style={styles.countsStrip}>
                    {Object.entries(
                      dryRunReport.impactReport?.affectedRecordCounts || {},
                    ).map(([k, v]) => (
                      <View key={k} style={styles.countBadge}>
                        <Text style={styles.countNumber}>{v}</Text>
                        <Text style={styles.countLabel}>
                          {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Warnings preview */}
                  {dryRunReport.impactReport?.warnings?.map((w, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.dryRunWarnText,
                        w.level === "blocking" && { color: Palette.error },
                      ]}
                    >
                      • [{w.level.toUpperCase()}] {w.message}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsNewModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Create Change Request"
                variant="primary"
                loading={creatingRequest}
                onPress={handleCreateChangeRequest}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 3. SAFE APPLY CONFIRMATION MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={!!applyingRequest}
        animationType="fade"
        transparent
        onRequestClose={() => setApplyingRequest(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconCircle}>
              <Ionicons
                name="shield-checkmark"
                size={32}
                color={Palette.primary}
              />
            </View>
            <Text style={styles.confirmTitle}>Apply Change Safely?</Text>
            <Text style={styles.confirmDesc}>
              You are applying change{" "}
              <Text style={{ fontWeight: "700" }}>
                {applyingRequest?.changeId}
              </Text>{" "}
              to target{" "}
              <Text style={{ fontWeight: "700" }}>
                {applyingRequest?.targetName}
              </Text>
              . The engine will verify stale preview timestamps and validate
              dependency constraints before updating production data.
            </Text>

            <TextInput
              style={styles.overrideInput}
              placeholder="Override justification (required if blocking dependencies exist)..."
              placeholderTextColor={Palette.textMuted}
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
            />

            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setApplyingRequest(null);
                  setOverrideReason("");
                }}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Confirm & Apply"
                variant="primary"
                loading={executingApply}
                onPress={handleApplyChange}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 4. REJECT MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={!!rejectingRequest}
        animationType="fade"
        transparent
        onRequestClose={() => setRejectingRequest(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View
              style={[
                styles.confirmIconCircle,
                { backgroundColor: "rgba(239, 68, 68, 0.1)" },
              ]}
            >
              <Ionicons name="close-circle" size={32} color={Palette.error} />
            </View>
            <Text style={styles.confirmTitle}>Reject Change Request</Text>
            <Text style={styles.confirmDesc}>
              Rejecting change {rejectingRequest?.changeId}. Please provide a
              reason for the governance audit log.
            </Text>

            <TextInput
              style={styles.overrideInput}
              placeholder="Rejection justification reason..."
              placeholderTextColor={Palette.textMuted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />

            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setRejectingRequest(null);
                  setRejectionReason("");
                }}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Confirm Rejection"
                variant="outline"
                loading={executingReject}
                onPress={handleRejectChange}
                style={{ flex: 2 }}
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
    backgroundColor: Palette.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  newChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  newChangeBtnText: {
    ...Typography.label,
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 12,
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
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  kpiIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  kpiValue: {
    ...Typography.h2,
    color: Palette.text,
  },
  kpiLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  tabsContainer: {
    paddingBottom: Spacing.sm,
  },
  tabPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.sm,
  },
  tabPillActive: {
    backgroundColor: Palette.primary,
  },
  tabPillText: {
    ...Typography.label,
    color: Palette.textMuted,
  },
  tabPillTextActive: {
    color: "#FFFFFF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginVertical: Spacing.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Palette.text,
    paddingVertical: Spacing.xs,
  },
  requestList: {
    marginTop: Spacing.sm,
  },
  requestCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  targetInfo: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  changeIdText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  targetNameText: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: 2,
  },
  targetTypeLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: "flex-end",
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  reasonText: {
    ...Typography.bodySmall,
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  reasonBold: {
    fontWeight: "700",
    color: Palette.textMuted,
  },
  countsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  countBadge: {
    marginRight: Spacing.md,
    paddingVertical: 2,
  },
  countNumber: {
    ...Typography.label,
    color: Palette.primary,
  },
  countLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  actionButtonGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  appliedTimestamp: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "90%",
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.md,
  },
  metaBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  metaItem: {
    alignItems: "center",
  },
  metaLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    marginBottom: 4,
  },
  metaValue: {
    ...Typography.label,
    color: Palette.text,
    fontSize: 12,
  },
  sectionBlock: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
    fontSize: 13,
  },
  sectionBodyText: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 18,
  },
  codeComparisonBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: Palette.primary,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  checkTextCol: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  checkLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
  },
  checkDetails: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  warningBox: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  warningBoxBlocking: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: Palette.error,
  },
  warningBoxAdvisory: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: Palette.warning,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  warningLevelText: {
    ...Typography.label,
    fontSize: 11,
    marginLeft: 4,
    color: Palette.text,
  },
  warningMsg: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontSize: 12,
  },
  warningRec: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
  },
  treeNodeCard: {
    padding: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  treeNodeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  treeNodeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  treeNodeLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    marginLeft: Spacing.xs,
  },
  treeNodeCountBadge: {
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  treeNodeCountText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primary,
  },
  treeNodeDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
    fontSize: 11,
  },
  treeChildrenContainer: {
    marginTop: Spacing.xs,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  modalFooterActions: {
    flexDirection: "row",
  },
  inputGroupLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  typeSelectionScroll: {
    marginBottom: Spacing.xs,
  },
  typePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.xs,
  },
  typePillActive: {
    backgroundColor: Palette.primary,
  },
  typePillText: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.textMuted,
  },
  typePillTextActive: {
    color: "#FFFFFF",
  },
  targetPickerContainer: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
  },
  targetItem: {
    padding: Spacing.xs + 2,
    borderRadius: Radius.xs,
    marginBottom: 2,
  },
  targetItemActive: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  targetItemTitle: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
  },
  targetItemSubtitle: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  jsonTextArea: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontFamily: "monospace",
    fontSize: 12,
    color: Palette.text,
    minHeight: 80,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Palette.text,
    minHeight: 50,
  },
  dryRunCard: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dryRunHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dryRunTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  dryRunSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginVertical: 2,
  },
  dryRunWarnText: {
    ...Typography.caption,
    color: Palette.warning,
    marginTop: 2,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  confirmBox: {
    width: "100%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    ...Shadows.lg,
  },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  confirmTitle: {
    ...Typography.h3,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  confirmDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  overrideInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Palette.text,
    minHeight: 50,
    marginBottom: Spacing.md,
  },
  confirmActions: {
    flexDirection: "row",
    width: "100%",
  },
});
