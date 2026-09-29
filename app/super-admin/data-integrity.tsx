/**
 * HealPoint — Super Admin · Smart Healthcare Data Quality & Integrity Center.
 *
 * Production-grade data quality and database integrity console.
 * Strictly factual metrics, stable SHA-256 issue fingerprints, zero fake percentages.
 * Protects clinical records from automated tampering.
 */
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

import { RoleRoute } from "@/components/RoleRoute";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import * as dataQualityService from "@/services/dataQuality";
import type {
  DataIntegrityScan,
  DataQualityIssue,
  DataQualityOverviewData,
  DataQualitySeverity,
} from "@/types";

type ActiveTab =
  | "overview"
  | "issues"
  | "duplicates"
  | "references"
  | "conflicts"
  | "scans";

export default function SuperAdminDataIntegrityScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [overview, setOverview] = useState<DataQualityOverviewData | null>(
    null,
  );
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [scans, setScans] = useState<DataIntegrityScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Scan trigger modal
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState<"full" | "targeted">(
    "full",
  );
  const [selectedTargetCat, setSelectedTargetCat] = useState<string>("all");
  const [triggeringScan, setTriggeringScan] = useState(false);

  // Issue Detail Modal
  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(
    null,
  );
  const [ignoreReason, setIgnoreReason] = useState("");
  const [showIgnorePrompt, setShowIgnorePrompt] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [overviewData, issuesData, scansData] = await Promise.all([
        dataQualityService.getIntegrityOverview(),
        dataQualityService.listIssues({
          severity: severityFilter,
          category: categoryFilter,
          status: statusFilter,
          search: searchQuery,
          limit: 50,
        }),
        dataQualityService.listScanHistory(1, 15),
      ]);
      setOverview(overviewData);
      setIssues(issuesData.issues);
      setScans(scansData.scans);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || "Failed to load data integrity metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter, categoryFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Handle Scan Trigger
  const handleStartScan = async () => {
    setTriggeringScan(true);
    try {
      await dataQualityService.triggerScan(selectedScanType, selectedTargetCat);
      setScanModalVisible(false);
      Alert.alert(
        "Scan Initiated",
        `Integrity scan (${selectedScanType} - ${selectedTargetCat}) has started in background. Refresh in a few moments to see results.`,
        [{ text: "OK", onPress: onRefresh }],
      );
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert(
        "Scan Error",
        e?.message || "Could not trigger integrity scan.",
      );
    } finally {
      setTriggeringScan(false);
    }
  };

  // Handle Safe Repair
  const handleSafeRepair = async (issue: DataQualityIssue) => {
    Alert.alert(
      "Confirm Safe Automated Repair",
      `Execute deterministic repair for "${issue.title}"?\n\nA verified backup will be validated before execution.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Execute Safe Repair",
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await dataQualityService.resolveIssueSafe(
                issue.issueId,
                "Admin manual safe resolution from console",
              );
              Alert.alert(
                "Success",
                res.message || "Issue resolved successfully.",
              );
              setSelectedIssue(null);
              onRefresh();
            } catch (err: unknown) {
              const e = err as { message?: string };
              Alert.alert(
                "Repair Failed",
                e?.message || "Could not execute safe repair.",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // Handle Status Update
  const handleUpdateStatus = async (
    status: "open" | "under_review" | "ignored" | "reopened",
    reason?: string,
  ) => {
    if (!selectedIssue) return;
    setActionLoading(true);
    try {
      await dataQualityService.updateIssueStatus(
        selectedIssue.issueId,
        status,
        reason,
        "Status updated from Super Admin Console",
      );
      setShowIgnorePrompt(false);
      setIgnoreReason("");
      setSelectedIssue(null);
      Alert.alert("Updated", `Issue marked as ${status.replace("_", " ")}.`);
      onRefresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert("Error", e?.message || "Failed to update issue status.");
    } finally {
      setActionLoading(false);
    }
  };

  const getSeverityBadgeVariant = (
    severity: DataQualitySeverity,
  ): BadgeVariant => {
    switch (severity) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "primary";
      case "low":
      case "informational":
      default:
        return "neutral";
    }
  };

  const getStatusBadgeVariant = (status: string): BadgeVariant => {
    switch (status) {
      case "open":
        return "error";
      case "under_review":
        return "warning";
      case "resolved":
        return "success";
      case "ignored":
        return "neutral";
      case "reopened":
        return "error";
      default:
        return "neutral";
    }
  };

  // Filtered views for specific tabs
  const duplicateIssues = issues.filter(
    (i) => i.issueType === "duplicate_candidate",
  );
  const brokenRefIssues = issues.filter(
    (i) =>
      i.issueType === "broken_reference" || i.issueType === "orphaned_data",
  );
  const conflictIssues = issues.filter(
    (i) =>
      i.issueType === "invalid_state" ||
      i.issueType === "conflict" ||
      i.issueType === "quota_inconsistency",
  );

  return (
    <RoleRoute allowedRoles={["super_admin"]}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Palette.text} />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Data Quality & Integrity</Text>
              <Text style={styles.headerSubtitle}>
                Continuous System Verification & Governance
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setScanModalVisible(true)}
              style={styles.scanBtn}
            >
              <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
              <Text style={styles.scanBtnText}>Run Scan</Text>
            </Pressable>
            <Pressable onPress={onRefresh} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={20} color={Palette.primary} />
            </Pressable>
          </View>
        </View>

        {/* Tabs Bar */}
        <View style={styles.tabBarWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {[
              { id: "overview", label: "Overview", icon: "pie-chart-outline" },
              {
                id: "issues",
                label: `Issues (${overview?.totalOpenIssues || 0})`,
                icon: "alert-circle-outline",
              },
              {
                id: "duplicates",
                label: `Duplicates (${duplicateIssues.length})`,
                icon: "copy-outline",
              },
              {
                id: "references",
                label: `Broken Refs (${brokenRefIssues.length})`,
                icon: "link-outline",
              },
              {
                id: "conflicts",
                label: `Conflicts (${conflictIssues.length})`,
                icon: "git-compare-outline",
              },
              { id: "scans", label: "Scan History", icon: "time-outline" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => setActiveTab(tab.id as ActiveTab)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? Palette.primary : Palette.textMuted}
                  />
                  <Text
                    style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Content */}
        {loading && !refreshing ? (
          <Loading label="Inspecting database integrity..." />
        ) : error ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Live Scan In-Progress Banner */}
            {overview?.isScanRunning && (
              <Card style={styles.runningBanner}>
                <View style={styles.runningContent}>
                  <ActivityIndicator size="small" color={Palette.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.runningTitle}>
                      Database Integrity Scan In Progress
                    </Text>
                    <Text style={styles.runningSubtitle}>
                      Analyzing collections across 15 healthcare domains...
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* TAB: OVERVIEW */}
            {activeTab === "overview" && overview && (
              <View style={styles.section}>
                {/* Metric Summary Cards */}
                <Text style={styles.sectionHeader}>
                  Factual Issue Telemetry
                </Text>
                <View style={styles.metricsGrid}>
                  <Card
                    style={[
                      styles.metricCard,
                      { borderLeftColor: "#EF4444", borderLeftWidth: 4 },
                    ]}
                  >
                    <Text style={styles.metricVal}>
                      {overview.criticalCount}
                    </Text>
                    <Text style={styles.metricLabel}>Critical Issues</Text>
                    <Text style={styles.metricSub}>Immediate Risk</Text>
                  </Card>
                  <Card
                    style={[
                      styles.metricCard,
                      { borderLeftColor: "#F59E0B", borderLeftWidth: 4 },
                    ]}
                  >
                    <Text style={styles.metricVal}>{overview.highCount}</Text>
                    <Text style={styles.metricLabel}>High Severity</Text>
                    <Text style={styles.metricSub}>Invalid States</Text>
                  </Card>
                  <Card
                    style={[
                      styles.metricCard,
                      { borderLeftColor: "#3B82F6", borderLeftWidth: 4 },
                    ]}
                  >
                    <Text style={styles.metricVal}>{overview.mediumCount}</Text>
                    <Text style={styles.metricLabel}>Medium Severity</Text>
                    <Text style={styles.metricSub}>Orphans / Stalls</Text>
                  </Card>
                  <Card
                    style={[
                      styles.metricCard,
                      { borderLeftColor: "#10B981", borderLeftWidth: 4 },
                    ]}
                  >
                    <Text style={styles.metricVal}>
                      {overview.totalResolved}
                    </Text>
                    <Text style={styles.metricLabel}>Resolved</Text>
                    <Text style={styles.metricSub}>Verified Fixed</Text>
                  </Card>
                </View>

                {/* Last Scan Summary */}
                {overview.lastScan && (
                  <Card style={styles.infoCard}>
                    <View style={styles.infoCardHeader}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#10B981"
                      />
                      <Text style={styles.infoCardTitle}>
                        Last Integrity Scan
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Scan ID:</Text>
                      <Text style={styles.infoVal}>
                        {overview.lastScan.scanId}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Completed At:</Text>
                      <Text style={styles.infoVal}>
                        {new Date(
                          overview.lastScan.completedAt,
                        ).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Records Examined:</Text>
                      <Text style={styles.infoVal}>
                        {overview.lastScan.totalRecordsScanned.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoKey}>Scan Duration:</Text>
                      <Text style={styles.infoVal}>
                        {overview.lastScan.durationMs} ms
                      </Text>
                    </View>
                  </Card>
                )}

                {/* Domain Distribution */}
                <Text style={[styles.sectionHeader, { marginTop: 16 }]}>
                  Issues By Domain Category
                </Text>
                <Card style={styles.distributionCard}>
                  {Object.keys(overview.categoryBreakdown).length === 0 ? (
                    <Text style={styles.emptyNotice}>
                      No active issues across any domain category.
                    </Text>
                  ) : (
                    Object.entries(overview.categoryBreakdown).map(
                      ([cat, count]) => (
                        <View key={cat} style={styles.distRow}>
                          <Text style={styles.distKey}>
                            {cat.toUpperCase().replace("_", " ")}
                          </Text>
                          <Badge label={String(count)} variant="primary" />
                        </View>
                      ),
                    )
                  )}
                </Card>
              </View>
            )}

            {/* TAB: ISSUES (ALL DETECTED ISSUES) */}
            {activeTab === "issues" && (
              <View style={styles.section}>
                {/* Search & Filter Bar */}
                <View style={styles.filterSection}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search issues, titles, or resource IDs..."
                    placeholderTextColor={Palette.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                  >
                    {["all", "critical", "high", "medium", "low"].map((sev) => (
                      <Pressable
                        key={sev}
                        style={[
                          styles.chip,
                          severityFilter === sev && styles.chipActive,
                        ]}
                        onPress={() => setSeverityFilter(sev)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            severityFilter === sev && styles.chipTextActive,
                          ]}
                        >
                          {sev.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {issues.length === 0 ? (
                  <EmptyState
                    title="No Integrity Issues Found"
                    message="All checked records satisfy schema invariants and relationship constraints."
                  />
                ) : (
                  issues.map((issue) => (
                    <Card key={issue._id} style={styles.issueCard}>
                      <View style={styles.issueHeader}>
                        <View style={styles.badgeRow}>
                          <Badge
                            label={issue.severity.toUpperCase()}
                            variant={getSeverityBadgeVariant(issue.severity)}
                          />
                          <Badge
                            label={issue.category
                              .toUpperCase()
                              .replace("_", " ")}
                            variant="neutral"
                          />
                          <Badge
                            label={issue.status.toUpperCase()}
                            variant={getStatusBadgeVariant(issue.status)}
                          />
                        </View>
                        <Text style={styles.issueIdText}>{issue.issueId}</Text>
                      </View>

                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={styles.issueDesc} numberOfLines={2}>
                        {issue.description}
                      </Text>

                      <View style={styles.resourceMetaRow}>
                        <Text style={styles.metaLabel}>Resource:</Text>
                        <Text style={styles.metaValue}>
                          {issue.resourceType} ({issue.resourceId})
                        </Text>
                      </View>

                      <View style={styles.issueFooter}>
                        <Text style={styles.detectedTime}>
                          Detected:{" "}
                          {new Date(issue.detectedAt).toLocaleDateString()}
                        </Text>
                        <Pressable
                          style={styles.inspectBtn}
                          onPress={() => setSelectedIssue(issue)}
                        >
                          <Text style={styles.inspectBtnText}>
                            Inspect Details
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color={Palette.primary}
                          />
                        </Pressable>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: DUPLICATES (CANDIDATE RECORD A VS B) */}
            {activeTab === "duplicates" && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Candidate Duplicate Records ({duplicateIssues.length})
                </Text>
                <Text style={styles.sectionSub}>
                  Records sharing business identifiers (emails, slugs, gateway
                  payment IDs). Automatic merging is disabled to protect patient
                  clinical identity.
                </Text>

                {duplicateIssues.length === 0 ? (
                  <EmptyState
                    title="Zero Duplicate Candidates"
                    message="No duplicate emails, hospital slugs, or transaction IDs detected."
                  />
                ) : (
                  duplicateIssues.map((issue) => {
                    const evidence = (issue.evidence as any) || {};
                    const candA = evidence.candidateA;
                    const candB = evidence.candidateB;
                    return (
                      <Card key={issue._id} style={styles.duplicateCard}>
                        <View style={styles.issueHeader}>
                          <Badge
                            label={issue.severity.toUpperCase()}
                            variant={getSeverityBadgeVariant(issue.severity)}
                          />
                          <Text style={styles.issueIdText}>
                            {issue.issueId}
                          </Text>
                        </View>
                        <Text style={styles.issueTitle}>{issue.title}</Text>
                        <Text style={styles.issueDesc}>
                          {issue.description}
                        </Text>

                        {/* Candidate Comparison Box */}
                        {candA && candB && (
                          <View style={styles.candComparison}>
                            <View style={styles.candBox}>
                              <Text style={styles.candTitle}>
                                Candidate Record A
                              </Text>
                              <Text style={styles.candVal}>
                                Name: {candA.name || "N/A"}
                              </Text>
                              <Text style={styles.candVal}>
                                ID:{" "}
                                {candA.patientId || candA.docId || candA.hospId}
                              </Text>
                              {candA.createdAt && (
                                <Text style={styles.candDate}>
                                  Created:{" "}
                                  {new Date(
                                    candA.createdAt,
                                  ).toLocaleDateString()}
                                </Text>
                              )}
                            </View>

                            <View style={styles.candBox}>
                              <Text style={styles.candTitle}>
                                Candidate Record B
                              </Text>
                              <Text style={styles.candVal}>
                                Name: {candB.name || "N/A"}
                              </Text>
                              <Text style={styles.candVal}>
                                ID:{" "}
                                {candB.patientId || candB.docId || candB.hospId}
                              </Text>
                              {candB.createdAt && (
                                <Text style={styles.candDate}>
                                  Created:{" "}
                                  {new Date(
                                    candB.createdAt,
                                  ).toLocaleDateString()}
                                </Text>
                              )}
                            </View>
                          </View>
                        )}

                        <View style={styles.issueFooter}>
                          <Button
                            title="Inspect Evidence"
                            variant="outline"
                            onPress={() => setSelectedIssue(issue)}
                          />
                        </View>
                      </Card>
                    );
                  })
                )}
              </View>
            )}

            {/* TAB: BROKEN REFERENCES & ORPHANS */}
            {activeTab === "references" && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Broken References & Orphaned Records ({brokenRefIssues.length}
                  )
                </Text>
                <Text style={styles.sectionSub}>
                  Foreign key references pointing to deleted or non-existent
                  parent records. Records are flagged for administrative
                  investigation without automated deletion.
                </Text>

                {brokenRefIssues.length === 0 ? (
                  <EmptyState
                    title="All Foreign Keys Valid"
                    message="Every appointment, document, prescription, and referral points to existing records."
                  />
                ) : (
                  brokenRefIssues.map((issue) => (
                    <Card key={issue._id} style={styles.issueCard}>
                      <View style={styles.issueHeader}>
                        <Badge
                          label={issue.severity.toUpperCase()}
                          variant={getSeverityBadgeVariant(issue.severity)}
                        />
                        <Badge
                          label={issue.category.toUpperCase().replace("_", " ")}
                          variant="neutral"
                        />
                      </View>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={styles.issueDesc}>{issue.description}</Text>
                      <Button
                        title="Review Reference"
                        variant="outline"
                        onPress={() => setSelectedIssue(issue)}
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: CONFLICTS & INVALID STATES */}
            {activeTab === "conflicts" && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  Invalid States & Lifecycle Collisions ({conflictIssues.length}
                  )
                </Text>
                <Text style={styles.sectionSub}>
                  Impossible state combinations such as Cancelled+Completed,
                  double-booked doctor slots, or subscription quota overflows.
                </Text>

                {conflictIssues.length === 0 ? (
                  <EmptyState
                    title="Lifecycle State Consistent"
                    message="No state machine violations or scheduling slot collisions detected."
                  />
                ) : (
                  conflictIssues.map((issue) => (
                    <Card key={issue._id} style={styles.issueCard}>
                      <View style={styles.issueHeader}>
                        <Badge
                          label={issue.severity.toUpperCase()}
                          variant={getSeverityBadgeVariant(issue.severity)}
                        />
                        <Badge
                          label={issue.issueType
                            .toUpperCase()
                            .replace("_", " ")}
                          variant="neutral"
                        />
                      </View>
                      <Text style={styles.issueTitle}>{issue.title}</Text>
                      <Text style={styles.issueDesc}>{issue.description}</Text>
                      <Button
                        title="Resolve / Inspect"
                        variant="outline"
                        onPress={() => setSelectedIssue(issue)}
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: SCAN HISTORY */}
            {activeTab === "scans" && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Integrity Scan History</Text>
                {scans.length === 0 ? (
                  <EmptyState
                    title="No Scans Logged"
                    message="Trigger a scan using the 'Run Scan' button above."
                  />
                ) : (
                  scans.map((scan) => (
                    <Card key={scan._id} style={styles.scanCard}>
                      <View style={styles.scanCardHeader}>
                        <View>
                          <Text style={styles.scanIdText}>{scan.scanId}</Text>
                          <Text style={styles.scanDate}>
                            {new Date(scan.startedAt).toLocaleString()}
                          </Text>
                        </View>
                        <Badge
                          label={scan.status.toUpperCase()}
                          variant={
                            scan.status === "completed" ? "success" : "error"
                          }
                        />
                      </View>

                      <View style={styles.scanMetricsGrid}>
                        <View style={styles.scanMetricItem}>
                          <Text style={styles.scanMetricVal}>
                            {scan.totalRecordsScanned.toLocaleString()}
                          </Text>
                          <Text style={styles.scanMetricKey}>
                            Records Checked
                          </Text>
                        </View>
                        <View style={styles.scanMetricItem}>
                          <Text
                            style={[
                              styles.scanMetricVal,
                              {
                                color:
                                  scan.criticalCount > 0
                                    ? "#EF4444"
                                    : Palette.text,
                              },
                            ]}
                          >
                            {scan.criticalCount}
                          </Text>
                          <Text style={styles.scanMetricKey}>Critical</Text>
                        </View>
                        <View style={styles.scanMetricItem}>
                          <Text style={styles.scanMetricVal}>
                            {scan.issuesFound}
                          </Text>
                          <Text style={styles.scanMetricKey}>Total Issues</Text>
                        </View>
                        <View style={styles.scanMetricItem}>
                          <Text style={styles.scanMetricVal}>
                            {scan.durationMs} ms
                          </Text>
                          <Text style={styles.scanMetricKey}>Duration</Text>
                        </View>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* TRIGGER SCAN MODAL */}
        <Modal
          visible={scanModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setScanModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Run Database Integrity Scan
                </Text>
                <Pressable onPress={() => setScanModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              <Text style={styles.modalPrompt}>
                Scans evaluate database invariants, foreign keys, states, and
                duplicate records. Executed safely in the background.
              </Text>

              <Text style={styles.fieldLabel}>Scan Mode</Text>
              <View style={styles.modeRow}>
                <Pressable
                  style={[
                    styles.modeChoice,
                    selectedScanType === "full" && styles.modeChoiceActive,
                  ]}
                  onPress={() => setSelectedScanType("full")}
                >
                  <Text
                    style={[
                      styles.modeChoiceText,
                      selectedScanType === "full" &&
                        styles.modeChoiceTextActive,
                    ]}
                  >
                    Full System Scan (All Domains)
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeChoice,
                    selectedScanType === "targeted" && styles.modeChoiceActive,
                  ]}
                  onPress={() => setSelectedScanType("targeted")}
                >
                  <Text
                    style={[
                      styles.modeChoiceText,
                      selectedScanType === "targeted" &&
                        styles.modeChoiceTextActive,
                    ]}
                  >
                    Targeted Domain Scan
                  </Text>
                </Pressable>
              </View>

              {selectedScanType === "targeted" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>Select Domain Category</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 6 }}
                  >
                    {[
                      "appointments",
                      "payments",
                      "doctors",
                      "hospitals",
                      "patients",
                      "documents_ocr",
                      "subscriptions",
                      "consent",
                      "referrals_handover",
                      "notifications",
                      "interoperability",
                      "audit",
                    ].map((cat) => (
                      <Pressable
                        key={cat}
                        style={[
                          styles.catChip,
                          selectedTargetCat === cat && styles.catChipActive,
                        ]}
                        onPress={() => setSelectedTargetCat(cat)}
                      >
                        <Text
                          style={[
                            styles.catChipText,
                            selectedTargetCat === cat &&
                              styles.catChipTextActive,
                          ]}
                        >
                          {cat.toUpperCase().replace("_", " ")}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.modalBtnRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setScanModalVisible(false)}
                />
                <Button
                  title={triggeringScan ? "Initiating..." : "Start Scan"}
                  variant="primary"
                  onPress={handleStartScan}
                  disabled={triggeringScan}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* ISSUE DETAIL & RESOLUTION MODAL */}
        <Modal
          visible={!!selectedIssue}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedIssue(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "85%" }]}>
              {selectedIssue && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>
                        {selectedIssue.title}
                      </Text>
                      <Text style={styles.issueIdText}>
                        {selectedIssue.issueId}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelectedIssue(null)}>
                      <Ionicons name="close" size={24} color={Palette.text} />
                    </Pressable>
                  </View>

                  <View style={[styles.badgeRow, { marginVertical: 8 }]}>
                    <Badge
                      label={selectedIssue.severity.toUpperCase()}
                      variant={getSeverityBadgeVariant(selectedIssue.severity)}
                    />
                    <Badge
                      label={selectedIssue.category
                        .toUpperCase()
                        .replace("_", " ")}
                      variant="neutral"
                    />
                    <Badge
                      label={selectedIssue.status.toUpperCase()}
                      variant={getStatusBadgeVariant(selectedIssue.status)}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Description</Text>
                  <Text style={styles.detailText}>
                    {selectedIssue.description}
                  </Text>

                  <Text style={styles.fieldLabel}>Affected Resource</Text>
                  <Text style={styles.detailCode}>
                    Model: {selectedIssue.resourceType}
                    {"\n"}
                    ID: {selectedIssue.resourceId}
                  </Text>

                  <Text style={styles.fieldLabel}>Evidence Payload</Text>
                  <View style={styles.codeBlock}>
                    <Text style={styles.codeText}>
                      {JSON.stringify(selectedIssue.evidence || {}, null, 2)}
                    </Text>
                  </View>

                  {/* Resolution History if Present */}
                  {selectedIssue.resolution?.action && (
                    <View style={styles.resHistoryBox}>
                      <Text style={styles.resHistoryTitle}>
                        Resolution Record
                      </Text>
                      <Text style={styles.resHistoryText}>
                        Action: {selectedIssue.resolution.action}
                        {"\n"}
                        Resolved At: {selectedIssue.resolution.resolvedAt}
                        {"\n"}
                        Notes: {selectedIssue.resolution.notes || "None"}
                      </Text>
                    </View>
                  )}

                  {/* Ignore Reason Prompt */}
                  {showIgnorePrompt ? (
                    <View style={styles.ignorePromptBox}>
                      <Text style={styles.ignorePromptTitle}>
                        Mandatory Justification for Ignoring
                      </Text>
                      <TextInput
                        style={styles.ignoreInput}
                        placeholder="Explain why this issue is safe to ignore (min 5 chars)..."
                        placeholderTextColor={Palette.textMuted}
                        value={ignoreReason}
                        onChangeText={setIgnoreReason}
                        multiline
                      />
                      <View style={styles.ignoreBtnRow}>
                        <Button
                          title="Back"
                          variant="ghost"
                          onPress={() => setShowIgnorePrompt(false)}
                        />
                        <Button
                          title="Confirm Ignore"
                          variant="danger"
                          onPress={() =>
                            handleUpdateStatus("ignored", ignoreReason)
                          }
                          disabled={
                            ignoreReason.trim().length < 5 || actionLoading
                          }
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actionButtonGroup}>
                      {/* Safe Resolution CTA if Supported */}
                      {selectedIssue.isSafeResolvable &&
                        selectedIssue.status !== "resolved" && (
                          <Button
                            title="Execute Safe Automated Repair"
                            variant="primary"
                            onPress={() => handleSafeRepair(selectedIssue)}
                            disabled={actionLoading}
                          />
                        )}

                      {/* Status Transition Buttons */}
                      {selectedIssue.status === "open" && (
                        <Button
                          title="Mark Under Review"
                          variant="outline"
                          onPress={() => handleUpdateStatus("under_review")}
                          disabled={actionLoading}
                        />
                      )}

                      {selectedIssue.status !== "ignored" &&
                        selectedIssue.status !== "resolved" && (
                          <Button
                            title="Ignore Issue with Reason"
                            variant="ghost"
                            onPress={() => setShowIgnorePrompt(true)}
                            disabled={actionLoading}
                          />
                        )}

                      {selectedIssue.status === "resolved" && (
                        <Button
                          title="Reopen Issue"
                          variant="outline"
                          onPress={() => handleUpdateStatus("reopened")}
                          disabled={actionLoading}
                        />
                      )}
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleRoute>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backBtn: {
    marginRight: Spacing.sm,
    padding: 4,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    gap: 6,
  },
  scanBtnText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 13,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
  },
  tabBarWrapper: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 8,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: Palette.primaryLight,
  },
  tabLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: Palette.primary,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  runningBanner: {
    marginBottom: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  runningContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  runningTitle: {
    ...Typography.bodyMedium,
    color: Palette.primary,
    fontWeight: "700",
  },
  runningSubtitle: {
    ...Typography.caption,
    color: Palette.text,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    ...Typography.h4,
    color: Palette.text,
  },
  sectionSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
  },
  metricVal: {
    ...Typography.h2,
    color: Palette.text,
  },
  metricLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: 2,
  },
  metricSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  infoCard: {
    padding: Spacing.md,
    gap: 8,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoVal: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  distributionCard: {
    padding: Spacing.md,
    gap: 10,
  },
  distRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  distKey: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  emptyNotice: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },
  filterSection: {
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Palette.text,
    ...Typography.bodySmall,
  },
  chipScroll: {
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  issueCard: {
    padding: Spacing.md,
    gap: 6,
    marginBottom: 10,
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  issueIdText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  issueTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  issueDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  resourceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  metaValue: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  issueFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  detectedTime: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  inspectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inspectBtnText: {
    ...Typography.label,
    color: Palette.primary,
    fontSize: 13,
  },
  duplicateCard: {
    padding: Spacing.md,
    gap: 8,
    marginBottom: 12,
  },
  candComparison: {
    gap: 8,
    marginTop: 6,
  },
  candBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 2,
  },
  candTitle: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  candVal: {
    ...Typography.caption,
    color: Palette.text,
  },
  candDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  scanCard: {
    padding: Spacing.md,
    gap: 10,
    marginBottom: 10,
  },
  scanCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scanIdText: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  scanDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  scanMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: 8,
  },
  scanMetricItem: {
    alignItems: "center",
  },
  scanMetricVal: {
    ...Typography.label,
    color: Palette.text,
  },
  scanMetricKey: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalPrompt: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  fieldLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: 6,
  },
  modeRow: {
    gap: 8,
  },
  modeChoice: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modeChoiceActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  modeChoiceText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  modeChoiceTextActive: {
    color: Palette.primary,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: Palette.primary,
  },
  catChipText: {
    ...Typography.caption,
    color: Palette.text,
    fontSize: 11,
  },
  catChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  detailText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  detailCode: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontFamily: "monospace",
  },
  codeBlock: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    maxHeight: 180,
  },
  codeText: {
    ...Typography.caption,
    fontFamily: "monospace",
    color: Palette.text,
    fontSize: 11,
  },
  resHistoryBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: 8,
    gap: 2,
  },
  resHistoryTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  resHistoryText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  ignorePromptBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 8,
    marginTop: 8,
  },
  ignorePromptTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  ignoreInput: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    color: Palette.text,
    minHeight: 60,
    ...Typography.caption,
  },
  ignoreBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButtonGroup: {
    gap: 8,
    marginTop: 12,
  },
});
