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
import * as releaseGovernanceService from "@/services/releaseGovernance";
import type {
  ReleaseCandidate,
  ReleaseGate,
  ReleaseGovernanceKpis,
  LiveReadinessReport,
  ReleaseGateStatus,
  ReleaseStatus,
  OverallReadinessLevel,
} from "@/types";

type ViewTab =
  | "LIVE_READINESS"
  | "RELEASE_CANDIDATES"
  | "BLOCKED_ONLY"
  | "WARNINGS_ONLY";

const GATE_STATUS_VARIANTS: Record<ReleaseGateStatus, BadgeVariant> = {
  PASS: "success",
  WARNING: "warning",
  BLOCKED: "error",
  UNKNOWN: "neutral",
  NOT_CONFIGURED: "neutral",
};

const RELEASE_STATUS_VARIANTS: Record<ReleaseStatus, BadgeVariant> = {
  DRAFT: "neutral",
  VALIDATING: "primary",
  REVIEW_REQUIRED: "warning",
  APPROVED: "success",
  READY_FOR_DEPLOYMENT: "primary",
  DEPLOYED: "success",
  REJECTED: "error",
};

export default function ReleaseGovernanceScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ViewTab>("LIVE_READINESS");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [kpis, setKpis] = useState<ReleaseGovernanceKpis | null>(null);
  const [liveReport, setLiveReport] = useState<LiveReadinessReport | null>(
    null,
  );
  const [candidates, setCandidates] = useState<ReleaseCandidate[]>([]);

  // Expanded gate cards state
  const [expandedGateIds, setExpandedGateIds] = useState<
    Record<string, boolean>
  >({});

  // Release Candidate Inspection Modal
  const [inspectingCandidate, setInspectingCandidate] =
    useState<ReleaseCandidate | null>(null);

  // New Release Candidate Snapshot Drawer
  const [isNewSnapshotVisible, setIsNewSnapshotVisible] = useState(false);
  const [newVersion, setNewVersion] = useState("1.0.0");
  const [newEnvironment, setNewEnvironment] = useState<
    "production" | "staging" | "preview"
  >("production");
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // Action states
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApproveModalVisible, setIsApproveModalVisible] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);

  const [deploying, setDeploying] = useState(false);
  const [verifyingPostDeploy, setVerifyingPostDeploy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [kpiRes, liveRes, candidateRes] = await Promise.all([
        releaseGovernanceService.getReleaseGovernanceKpis(),
        releaseGovernanceService.getLiveReadinessReport(),
        releaseGovernanceService.getReleaseCandidates({ limit: 30 }),
      ]);

      setKpis(kpiRes);
      setLiveReport(liveRes);
      setCandidates(candidateRes.candidates || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load release governance data";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleGateExpand = (gateId: string) => {
    setExpandedGateIds((prev) => ({
      ...prev,
      [gateId]: !prev[gateId],
    }));
  };

  const handleCreateSnapshot = async () => {
    if (!newVersion.trim()) {
      Alert.alert(
        "Version Required",
        "Please specify a semver release version (e.g. 1.0.0).",
      );
      return;
    }

    try {
      setCreatingSnapshot(true);
      const created = await releaseGovernanceService.createReleaseCandidate({
        version: newVersion.trim(),
        targetEnvironment: newEnvironment,
        approvalNotes: snapshotNotes.trim(),
      });

      Alert.alert(
        "Release Candidate Created",
        `Snapshot ${created.releaseId} for v${created.version} (${created.targetEnvironment}) has been frozen.`,
      );
      setIsNewSnapshotVisible(false);
      setSnapshotNotes("");
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create release candidate snapshot";
      Alert.alert("Snapshot Error", msg);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleApproveCandidate = async () => {
    if (!inspectingCandidate) return;

    try {
      setApproving(true);
      const approved = await releaseGovernanceService.approveReleaseCandidate(
        inspectingCandidate.releaseId,
        { approvalNotes: approvalNotes.trim() },
      );

      Alert.alert(
        "Release Approved",
        `Release ${approved.version} (${approved.releaseId}) is approved for deployment.`,
      );
      setIsApproveModalVisible(false);
      setApprovalNotes("");
      setInspectingCandidate(approved);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to approve release";
      Alert.alert("Approval Blocked", msg);
    } finally {
      setApproving(false);
    }
  };

  const handleRejectCandidate = async () => {
    if (!inspectingCandidate) return;
    if (!rejectionReason.trim()) {
      Alert.alert(
        "Reason Required",
        "Please enter a justification for rejecting this release.",
      );
      return;
    }

    try {
      setRejecting(true);
      const rejected = await releaseGovernanceService.rejectReleaseCandidate(
        inspectingCandidate.releaseId,
        { rejectionReason: rejectionReason.trim() },
      );

      Alert.alert(
        "Release Rejected",
        `Release candidate ${rejected.releaseId} has been rejected.`,
      );
      setIsRejectModalVisible(false);
      setRejectionReason("");
      setInspectingCandidate(rejected);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reject release";
      Alert.alert("Rejection Error", msg);
    } finally {
      setRejecting(false);
    }
  };

  const handleDeployCandidate = async () => {
    if (!inspectingCandidate) return;

    Alert.alert(
      "Confirm Deployment",
      `Mark release candidate ${inspectingCandidate.version} as deployed to '${inspectingCandidate.targetEnvironment}'?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Deployment",
          style: "default",
          onPress: async () => {
            try {
              setDeploying(true);
              const deployed =
                await releaseGovernanceService.deployReleaseCandidate(
                  inspectingCandidate.releaseId,
                );
              Alert.alert(
                "Deployment Confirmed",
                `Release ${deployed.version} is marked as deployed.`,
              );
              setInspectingCandidate(deployed);
              loadData();
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : "Failed to deploy release";
              Alert.alert("Deployment Error", msg);
            } finally {
              setDeploying(false);
            }
          },
        },
      ],
    );
  };

  const handleRunPostDeploymentVerification = async () => {
    if (!inspectingCandidate) return;

    try {
      setVerifyingPostDeploy(true);
      const verified = await releaseGovernanceService.verifyPostDeployment(
        inspectingCandidate.releaseId,
      );
      Alert.alert(
        "Verification Complete",
        `Post-deployment health status: ${verified.postDeploymentVerification?.status}`,
      );
      setInspectingCandidate(verified);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to run post-deployment check";
      Alert.alert("Verification Error", msg);
    } finally {
      setVerifyingPostDeploy(false);
    }
  };

  // Filter gates based on tab & search
  const filteredGates = (liveReport?.gateResults || []).filter((g) => {
    if (activeTab === "BLOCKED_ONLY" && g.status !== "BLOCKED") return false;
    if (activeTab === "WARNINGS_ONLY" && g.status !== "WARNING") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.evidence.toLowerCase().includes(q) ||
        g.affectedModule.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const readinessState =
    liveReport?.overallReadiness || "ACTION_REQUIRED_WARNINGS";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
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
          <Text style={styles.headerTitle}>Release Governance</Text>
          <Text style={styles.headerSubtitle}>
            Production Readiness & Safe Rollout Console
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
            onPress={() => setIsNewSnapshotVisible(true)}
            style={styles.newReleaseBtn}
            accessibilityLabel="Create Release Snapshot"
          >
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
            <Text style={styles.newReleaseBtnText}>Freeze RC</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Overall Readiness Banner */}
        <View
          style={[
            styles.bannerContainer,
            readinessState === "READY_TO_RELEASE"
              ? styles.bannerReady
              : readinessState === "RELEASE_BLOCKED"
                ? styles.bannerBlocked
                : styles.bannerWarning,
          ]}
        >
          <View style={styles.bannerIconWrapper}>
            <Ionicons
              name={
                readinessState === "READY_TO_RELEASE"
                  ? "shield-checkmark"
                  : readinessState === "RELEASE_BLOCKED"
                    ? "alert-circle"
                    : "warning"
              }
              size={28}
              color={
                readinessState === "READY_TO_RELEASE"
                  ? Palette.success
                  : readinessState === "RELEASE_BLOCKED"
                    ? Palette.error
                    : Palette.warning
              }
            />
          </View>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>
              {readinessState === "READY_TO_RELEASE"
                ? "Platform Ready for Deployment"
                : readinessState === "RELEASE_BLOCKED"
                  ? "Production Release Blocked"
                  : "Action Recommended (Advisory Warnings)"}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {readinessState === "RELEASE_BLOCKED"
                ? `${liveReport?.gateSummary?.blocked || 0} critical blocker(s) prevent release approval.`
                : readinessState === "ACTION_REQUIRED_WARNINGS"
                  ? `${liveReport?.gateSummary?.warnings || 0} warning(s) and ${liveReport?.gateSummary?.notConfigured || 0} unconfigured integration(s) require review.`
                  : "All verified gates passed. Zero critical anomalies detected."}
            </Text>
          </View>
        </View>

        {/* 5-Metric KPI Ribbon */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiNumber}>
              {liveReport?.gateSummary?.total ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Total Gates</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiNumber, { color: Palette.success }]}>
              {liveReport?.gateSummary?.passed ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Passed</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiNumber, { color: Palette.warning }]}>
              {liveReport?.gateSummary?.warnings ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Warnings</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiNumber, { color: Palette.error }]}>
              {liveReport?.gateSummary?.blocked ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Blocked</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiNumber, { color: Palette.textMuted }]}>
              {liveReport?.gateSummary?.notConfigured ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>Unset</Text>
          </Card>
        </View>

        {/* Navigation Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {(
            [
              { key: "LIVE_READINESS", label: "Live Readiness Gates" },
              { key: "BLOCKED_ONLY", label: "Blocked Only" },
              { key: "WARNINGS_ONLY", label: "Warnings Only" },
              { key: "RELEASE_CANDIDATES", label: "Release Candidates" },
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
            placeholder="Search gates, modules, or evidence..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
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
          <Loading label="Evaluating production readiness evidence..." />
        ) : error ? (
          <ErrorState
            title="Failed to Load Data"
            message={error}
            onRetry={loadData}
          />
        ) : activeTab === "RELEASE_CANDIDATES" ? (
          // ==========================================
          // RELEASE CANDIDATE SNAPSHOTS LIST
          // ==========================================
          candidates.length === 0 ? (
            <EmptyState
              title="No Release Candidates"
              message="No release snapshots have been frozen yet. Tap 'Freeze RC' to record a release candidate."
              action={
                <Button
                  title="Freeze Release Candidate"
                  onPress={() => setIsNewSnapshotVisible(true)}
                />
              }
            />
          ) : (
            <View style={styles.candidateList}>
              {candidates.map((rc) => (
                <Card key={rc.releaseId} style={styles.candidateCard}>
                  <View style={styles.candidateHeader}>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateVersion}>v{rc.version}</Text>
                      <Text style={styles.candidateId}>{rc.releaseId}</Text>
                      <Text style={styles.candidateEnv}>
                        Environment: {rc.targetEnvironment.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.candidateBadges}>
                      <Badge
                        variant={
                          RELEASE_STATUS_VARIANTS[rc.status] || "neutral"
                        }
                        label={rc.status}
                      />
                      <View style={{ height: 4 }} />
                      <Badge
                        variant={
                          rc.overallReadiness === "READY_TO_RELEASE"
                            ? "success"
                            : rc.overallReadiness === "RELEASE_BLOCKED"
                              ? "error"
                              : "warning"
                        }
                        label={rc.overallReadiness.replace(/_/g, " ")}
                      />
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.candidateGateMiniSummary}>
                    <Text style={styles.miniSummaryText}>
                      Gates: {rc.gateSummary?.passed || 0} Passed •{" "}
                      <Text style={{ color: Palette.warning }}>
                        {rc.gateSummary?.warnings || 0} Warn
                      </Text>{" "}
                      •{" "}
                      <Text style={{ color: Palette.error }}>
                        {rc.gateSummary?.blocked || 0} Block
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.candidateActions}>
                    <Button
                      title="Inspect Snapshot"
                      variant="outline"
                      fullWidth={false}
                      onPress={() => setInspectingCandidate(rc)}
                    />
                    <Text style={styles.candidateDate}>
                      {new Date(rc.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )
        ) : // ==========================================
        // LIVE READINESS GATES LIST
        // ==========================================
        filteredGates.length === 0 ? (
          <EmptyState
            title="No Matching Gates"
            message="No readiness checks match your current filter."
          />
        ) : (
          <View style={styles.gatesList}>
            {filteredGates.map((gate) => {
              const isExpanded = expandedGateIds[gate.gateId];

              return (
                <Card key={gate.gateId} style={styles.gateCard}>
                  <Pressable
                    onPress={() => toggleGateExpand(gate.gateId)}
                    style={styles.gateCardHeader}
                  >
                    <View style={styles.gateTitleRow}>
                      <Ionicons
                        name={
                          gate.status === "PASS"
                            ? "checkmark-circle"
                            : gate.status === "BLOCKED"
                              ? "close-circle"
                              : gate.status === "WARNING"
                                ? "alert-circle"
                                : "help-circle"
                        }
                        size={22}
                        color={
                          gate.status === "PASS"
                            ? Palette.success
                            : gate.status === "BLOCKED"
                              ? Palette.error
                              : gate.status === "WARNING"
                                ? Palette.warning
                                : Palette.textMuted
                        }
                        style={styles.gateStatusIcon}
                      />
                      <View style={styles.gateTitleCol}>
                        <Text style={styles.gateName}>{gate.name}</Text>
                        <Text style={styles.gateCategoryText}>
                          Area: {gate.category.toUpperCase()} • Module:{" "}
                          {gate.affectedModule}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.gateStatusBadgeCol}>
                      <Badge
                        variant={GATE_STATUS_VARIANTS[gate.status]}
                        label={gate.status}
                      />
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={Palette.textMuted}
                        style={{ marginTop: 4 }}
                      />
                    </View>
                  </Pressable>

                  {/* Expandable Details */}
                  {isExpanded ? (
                    <View style={styles.gateDetails}>
                      <View style={styles.divider} />

                      <Text style={styles.detailHeading}>Factual Evidence</Text>
                      <Text style={styles.detailEvidenceText}>
                        {gate.evidence}
                      </Text>

                      {gate.recommendedAction ? (
                        <View style={styles.recommendationBox}>
                          <Text style={styles.detailHeading}>
                            💡 Recommended Action
                          </Text>
                          <Text style={styles.detailRecText}>
                            {gate.recommendedAction}
                          </Text>
                        </View>
                      ) : null}

                      {gate.dependencyRef ? (
                        <Text style={styles.dependencyRefText}>
                          Ref: {gate.dependencyRef}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* 1. NEW RELEASE CANDIDATE SNAPSHOT DRAWER */}
      {/* ========================================================= */}
      <Modal
        visible={isNewSnapshotVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsNewSnapshotVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Freeze Release Candidate</Text>
                <Text style={styles.modalSubtitle}>
                  Create point-in-time readiness snapshot
                </Text>
              </View>
              <Pressable
                onPress={() => setIsNewSnapshotVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.inputGroupLabel}>
                Target Semver Version *
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 1.0.0"
                placeholderTextColor={Palette.textMuted}
                value={newVersion}
                onChangeText={setNewVersion}
              />

              <Text style={styles.inputGroupLabel}>Target Environment</Text>
              <View style={styles.envSelectionRow}>
                {(["production", "staging", "preview"] as const).map((env) => (
                  <Pressable
                    key={env}
                    onPress={() => setNewEnvironment(env)}
                    style={[
                      styles.envPill,
                      newEnvironment === env && styles.envPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.envPillText,
                        newEnvironment === env && styles.envPillTextActive,
                      ]}
                    >
                      {env.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputGroupLabel}>
                Release / Approval Notes
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe changes, migrations, or release objectives..."
                placeholderTextColor={Palette.textMuted}
                value={snapshotNotes}
                onChangeText={setSnapshotNotes}
                multiline
                numberOfLines={3}
              />

              {/* Current Readiness Snapshot Preview */}
              <View style={styles.snapshotSummaryCard}>
                <Text style={styles.snapshotSummaryTitle}>
                  Live Gate Evaluation Status
                </Text>
                <View style={styles.snapshotSummaryStats}>
                  <Text style={styles.summaryStatItem}>
                    Total: {liveReport?.gateSummary?.total || 0}
                  </Text>
                  <Text
                    style={[styles.summaryStatItem, { color: Palette.success }]}
                  >
                    Passed: {liveReport?.gateSummary?.passed || 0}
                  </Text>
                  <Text
                    style={[styles.summaryStatItem, { color: Palette.warning }]}
                  >
                    Warn: {liveReport?.gateSummary?.warnings || 0}
                  </Text>
                  <Text
                    style={[styles.summaryStatItem, { color: Palette.error }]}
                  >
                    Block: {liveReport?.gateSummary?.blocked || 0}
                  </Text>
                </View>
                {liveReport?.gateSummary?.blocked ? (
                  <Text style={styles.blockNoticeText}>
                    ⚠️ Note: Release will be created in DRAFT state because
                    critical blockers exist.
                  </Text>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsNewSnapshotVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Freeze Snapshot"
                variant="primary"
                loading={creatingSnapshot}
                onPress={handleCreateSnapshot}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 2. INSPECT RELEASE CANDIDATE MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={!!inspectingCandidate}
        animationType="slide"
        transparent
        onRequestClose={() => setInspectingCandidate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Release Candidate: v{inspectingCandidate?.version}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {inspectingCandidate?.releaseId} •{" "}
                  {inspectingCandidate?.targetEnvironment.toUpperCase()}
                </Text>
              </View>
              <Pressable
                onPress={() => setInspectingCandidate(null)}
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
                      inspectingCandidate
                        ? RELEASE_STATUS_VARIANTS[inspectingCandidate.status]
                        : "neutral"
                    }
                    label={inspectingCandidate?.status || ""}
                  />
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Readiness</Text>
                  <Badge
                    variant={
                      inspectingCandidate?.overallReadiness ===
                      "READY_TO_RELEASE"
                        ? "success"
                        : inspectingCandidate?.overallReadiness ===
                            "RELEASE_BLOCKED"
                          ? "error"
                          : "warning"
                    }
                    label={
                      inspectingCandidate?.overallReadiness.replace(
                        /_/g,
                        " ",
                      ) || ""
                    }
                  />
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Config Fingerprint</Text>
                  <Text style={styles.fingerprintCode}>
                    {inspectingCandidate?.configurationFingerprint || "N/A"}
                  </Text>
                </View>
              </View>

              {/* Rollback Readiness Panel */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Rollback Readiness & Safety
                </Text>
                <View style={styles.rollbackCard}>
                  <Text style={styles.rollbackItemText}>
                    • Strategy:{" "}
                    {inspectingCandidate?.rollbackReadiness?.rollbackStrategy}
                  </Text>
                  <Text style={styles.rollbackItemText}>
                    • Backup Prerequisite:{" "}
                    {inspectingCandidate?.rollbackReadiness
                      ?.backupPrerequisiteMet
                      ? "✅ Verified Snapshot Available"
                      : "⚠️ No Recent Backup Recorded"}
                  </Text>
                  <Text style={styles.rollbackItemText}>
                    • Mobile Limitations:{" "}
                    {
                      inspectingCandidate?.rollbackReadiness
                        ?.mobileRollbackLimitations
                    }
                  </Text>
                </View>
              </View>

              {/* Post-Deployment Verification Section */}
              {inspectingCandidate?.status === "DEPLOYED" ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>
                    Post-Deployment Verification
                  </Text>
                  <View style={styles.postDeployCard}>
                    <Text style={styles.postDeployStatus}>
                      Status:{" "}
                      {inspectingCandidate.postDeploymentVerification?.status ||
                        "PENDING VERIFICATION"}
                    </Text>
                    {inspectingCandidate.postDeploymentVerification
                      ?.verifiedAt ? (
                      <Text style={styles.postDeployTime}>
                        Verified on:{" "}
                        {new Date(
                          inspectingCandidate.postDeploymentVerification
                            .verifiedAt,
                        ).toLocaleString()}
                      </Text>
                    ) : null}
                    <View style={{ marginTop: Spacing.sm }}>
                      <Button
                        title="Run Post-Deploy Health Check"
                        variant="outline"
                        loading={verifyingPostDeploy}
                        onPress={handleRunPostDeploymentVerification}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Gate Results Summary */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Frozen Gate Evaluations (
                  {inspectingCandidate?.gateResults?.length || 0})
                </Text>
                {inspectingCandidate?.gateResults?.map((gate) => (
                  <View key={gate.gateId} style={styles.snapshotGateRow}>
                    <Ionicons
                      name={
                        gate.status === "PASS"
                          ? "checkmark-circle"
                          : gate.status === "BLOCKED"
                            ? "close-circle"
                            : "alert-circle"
                      }
                      size={18}
                      color={
                        gate.status === "PASS"
                          ? Palette.success
                          : gate.status === "BLOCKED"
                            ? Palette.error
                            : Palette.warning
                      }
                      style={{ marginRight: Spacing.xs }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.snapshotGateName}>{gate.name}</Text>
                      <Text style={styles.snapshotGateEv}>{gate.evidence}</Text>
                    </View>
                    <Badge
                      variant={GATE_STATUS_VARIANTS[gate.status]}
                      label={gate.status}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Modal Actions Footer */}
            <View style={styles.modalFooter}>
              {inspectingCandidate?.status === "REVIEW_REQUIRED" ||
              inspectingCandidate?.status === "DRAFT" ? (
                <View style={styles.actionRow}>
                  <Button
                    title="Reject"
                    variant="outline"
                    onPress={() => setIsRejectModalVisible(true)}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    title="Approve Release"
                    variant="primary"
                    disabled={inspectingCandidate.gateSummary?.blocked > 0}
                    onPress={() => setIsApproveModalVisible(true)}
                    style={{ flex: 2 }}
                  />
                </View>
              ) : inspectingCandidate?.status === "APPROVED" ? (
                <Button
                  title="Mark Deployed to Production"
                  variant="primary"
                  loading={deploying}
                  onPress={handleDeployCandidate}
                />
              ) : (
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setInspectingCandidate(null)}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 3. APPROVAL MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={isApproveModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsApproveModalVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconCircle}>
              <Ionicons
                name="checkmark-circle"
                size={32}
                color={Palette.success}
              />
            </View>
            <Text style={styles.confirmTitle}>Approve Release Candidate</Text>
            <Text style={styles.confirmDesc}>
              Authorizing release {inspectingCandidate?.version} for deployment
              to {inspectingCandidate?.targetEnvironment}.
            </Text>

            <TextInput
              style={styles.confirmInput}
              placeholder="Approval comments or authorization references..."
              placeholderTextColor={Palette.textMuted}
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              multiline
            />

            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsApproveModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Confirm Approval"
                variant="primary"
                loading={approving}
                onPress={handleApproveCandidate}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 4. REJECTION MODAL */}
      {/* ========================================================= */}
      <Modal
        visible={isRejectModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsRejectModalVisible(false)}
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
            <Text style={styles.confirmTitle}>Reject Release Candidate</Text>
            <Text style={styles.confirmDesc}>
              Rejecting release candidate {inspectingCandidate?.releaseId}.
            </Text>

            <TextInput
              style={styles.confirmInput}
              placeholder="Rejection justification (required)..."
              placeholderTextColor={Palette.textMuted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />

            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsRejectModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Confirm Rejection"
                variant="danger"
                loading={rejecting}
                onPress={handleRejectCandidate}
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
  newReleaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  newReleaseBtnText: {
    ...Typography.label,
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 12,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
  },
  bannerReady: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderLeftColor: Palette.success,
  },
  bannerBlocked: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderLeftColor: Palette.error,
  },
  bannerWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderLeftColor: Palette.warning,
  },
  bannerIconWrapper: {
    marginRight: Spacing.md,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  bannerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  kpiCard: {
    width: "18.5%",
    padding: Spacing.xs + 2,
    alignItems: "center",
  },
  kpiNumber: {
    ...Typography.h3,
    color: Palette.text,
  },
  kpiLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 2,
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
  gatesList: {
    marginTop: Spacing.xs,
  },
  gateCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  gateCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: Spacing.sm,
  },
  gateStatusIcon: {
    marginRight: Spacing.sm,
  },
  gateTitleCol: {
    flex: 1,
  },
  gateName: {
    ...Typography.h4,
    color: Palette.text,
    fontSize: 14,
  },
  gateCategoryText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  gateStatusBadgeCol: {
    alignItems: "flex-end",
  },
  gateDetails: {
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  detailHeading: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    marginBottom: 2,
  },
  detailEvidenceText: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  recommendationBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.xs,
  },
  detailRecText: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  dependencyRefText: {
    ...Typography.caption,
    fontSize: 10,
    fontFamily: "monospace",
    color: Palette.primary,
    marginTop: Spacing.xs,
  },
  candidateList: {
    marginTop: Spacing.xs,
  },
  candidateCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  candidateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  candidateInfo: {
    flex: 1,
  },
  candidateVersion: {
    ...Typography.h3,
    color: Palette.text,
  },
  candidateId: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
    marginTop: 2,
  },
  candidateEnv: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  candidateBadges: {
    alignItems: "flex-end",
  },
  candidateGateMiniSummary: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs + 2,
    borderRadius: Radius.xs,
    marginBottom: Spacing.sm,
  },
  miniSummaryText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.text,
  },
  candidateActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  candidateDate: {
    ...Typography.caption,
    color: Palette.textMuted,
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
  inputGroupLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Palette.text,
  },
  envSelectionRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  envPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.xs,
  },
  envPillActive: {
    backgroundColor: Palette.primary,
  },
  envPillText: {
    ...Typography.label,
    fontSize: 11,
    color: Palette.textMuted,
  },
  envPillTextActive: {
    color: "#FFFFFF",
  },
  textArea: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.bodySmall,
    color: Palette.text,
    minHeight: 60,
  },
  snapshotSummaryCard: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  snapshotSummaryTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: 4,
  },
  snapshotSummaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStatItem: {
    ...Typography.caption,
    fontWeight: "700",
  },
  blockNoticeText: {
    ...Typography.caption,
    color: Palette.error,
    marginTop: Spacing.xs,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
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
  fingerprintCode: {
    fontFamily: "monospace",
    fontSize: 11,
    color: Palette.primary,
    fontWeight: "700",
  },
  sectionBlock: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  rollbackCard: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  rollbackItemText: {
    ...Typography.caption,
    color: Palette.text,
    lineHeight: 18,
    marginBottom: 2,
  },
  postDeployCard: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  postDeployStatus: {
    ...Typography.label,
    color: Palette.text,
  },
  postDeployTime: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  snapshotGateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs + 2,
    borderRadius: Radius.xs,
    marginBottom: 4,
  },
  snapshotGateName: {
    ...Typography.label,
    fontSize: 11,
    color: Palette.text,
  },
  snapshotGateEv: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  actionRow: {
    flexDirection: "row",
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
    backgroundColor: "rgba(16, 185, 129, 0.1)",
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
  confirmInput: {
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
