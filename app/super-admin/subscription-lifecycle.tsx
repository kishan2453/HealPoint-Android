import { Ionicons } from "@expo/vector-icons";
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
import { formatDDMMYYYY, formatINR } from "@/lib/format";
import * as subscriptionService from "@/services/subscriptions";
import type {
  Subscription,
  SubscriptionReconciliationIssue,
  SubscriptionReconciliationOverview,
} from "@/types";

type ViewTab = "issues" | "active_subs" | "history";

export default function SubscriptionLifecycleScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("issues");

  const [overview, setOverview] =
    useState<SubscriptionReconciliationOverview | null>(null);
  const [issues, setIssues] = useState<SubscriptionReconciliationIssue[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Resolution modal state
  const [selectedIssue, setSelectedIssue] =
    useState<SubscriptionReconciliationIssue | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Auto-repairing state
  const [autoRepairingId, setAutoRepairingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [reconcileRes, subsRes] = await Promise.all([
        subscriptionService.getReconciliationOverview({ status: "all" }),
        subscriptionService.getSubscriptions({ limit: 100 }),
      ]);

      if (reconcileRes && reconcileRes.success) {
        setOverview(reconcileRes.overview);
        setIssues(reconcileRes.issues || []);
      }
      if (subsRes && subsRes.success) {
        setSubscriptions(subsRes.subscriptions || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load revenue protection data");
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

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await subscriptionService.runReconciliationScan();
      if (res && res.success) {
        Alert.alert(
          "Reconciliation Scan Complete",
          `Scanned ${res.scanResults?.totalSubscriptionsScanned || 0} subscriptions.\nDetected ${res.scanResults?.totalIssuesFound || 0} open issues.`,
        );
        loadData();
      }
    } catch (err: any) {
      Alert.alert("Scan Error", err?.message || "Failed to execute scan");
    } finally {
      setScanning(false);
    }
  };

  const handleAutoRepair = async (issue: SubscriptionReconciliationIssue) => {
    Alert.alert(
      "Confirm Safe Auto-Repair",
      `Execute automatic repair for: ${issue.title}?\n\nAction: ${issue.recommendedResolution}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Execute Repair",
          onPress: async () => {
            setAutoRepairingId(issue.issueId);
            try {
              const res = await subscriptionService.executeSafeAutoRepair(
                issue.issueId,
              );
              if (res && res.success) {
                Alert.alert(
                  "Auto-Repair Successful",
                  res.repairNote || "Issue was successfully resolved.",
                );
                loadData();
              }
            } catch (err: any) {
              Alert.alert(
                "Repair Failed",
                err?.message || "Could not auto-repair issue.",
              );
            } finally {
              setAutoRepairingId(null);
            }
          },
        },
      ],
    );
  };

  const openResolutionModal = (issue: SubscriptionReconciliationIssue) => {
    setSelectedIssue(issue);
    setResolutionNotes("");
    if (issue.issueType === "expired_still_active") {
      setResolutionAction("transition_expired");
    } else if (issue.issueType === "payment_verified_sub_inactive") {
      setResolutionAction("activate_verified_subscription");
    } else if (issue.issueType === "quota_entitlement_mismatch") {
      setResolutionAction("recalculate_quota");
    } else {
      setResolutionAction("dismiss");
    }
  };

  const handleSubmitResolution = async () => {
    if (!selectedIssue || !resolutionAction) return;
    setSubmittingResolution(true);
    try {
      const res = await subscriptionService.resolveReconciliationIssue(
        selectedIssue.issueId,
        resolutionAction,
        resolutionNotes,
      );
      if (res && res.success) {
        Alert.alert(
          "Resolution Recorded",
          `Issue was marked as ${res.issue?.status || "resolved"}.`,
        );
        setSelectedIssue(null);
        loadData();
      }
    } catch (err: any) {
      Alert.alert(
        "Resolution Failed",
        err?.message || "Failed to record manual resolution.",
      );
    } finally {
      setSubmittingResolution(false);
    }
  };

  const getSeverityBadgeVariant = (severity: string): BadgeVariant => {
    switch (severity) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status !== "open");

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Loading label="Auditing subscription lifecycle and revenue..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.shieldIconCircle}>
              <Ionicons
                name="shield-checkmark"
                size={22}
                color={Palette.primary}
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>Revenue Protection Center</Text>
              <Text style={styles.headerSubtitle}>
                Subscription Lifecycle & Payment Integrity
              </Text>
            </View>
          </View>
          <Button
            title={scanning ? "Scanning..." : "Run Audit"}
            variant="primary"
            onPress={handleRunScan}
            disabled={scanning}
            loading={scanning}
            icon="scan"
          />
        </View>

        {error ? (
          <ErrorState
            title="Failed to Load Overview"
            message={error}
            onRetry={loadData}
          />
        ) : null}

        {/* FACTUAL METRICS CARDS */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={22}
              color={Palette.success}
            />
            <Text style={styles.metricValue}>
              {overview?.activeCount ?? subscriptions.length}
            </Text>
            <Text style={styles.metricLabel}>Active Subscriptions</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Ionicons name="time-outline" size={22} color={Palette.warning} />
            <Text style={styles.metricValue}>
              {overview?.expiringSoonCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Expiring in 7 Days</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Ionicons
              name="alert-circle-outline"
              size={22}
              color={Palette.error}
            />
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    (overview?.openIssuesCount ?? 0) > 0
                      ? Palette.error
                      : Palette.text,
                },
              ]}
            >
              {overview?.openIssuesCount ?? openIssues.length}
            </Text>
            <Text style={styles.metricLabel}>Open Discrepancies</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Ionicons name="build-outline" size={22} color={Palette.primary} />
            <Text style={styles.metricValue}>
              {overview?.autoRepairedCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Safe Repaired</Text>
          </Card>
        </View>

        {/* TAB NAVIGATION */}
        <View style={styles.tabNav}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "issues" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("issues")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "issues" && styles.tabTextActive,
              ]}
            >
              Open Issues ({openIssues.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "active_subs" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("active_subs")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "active_subs" && styles.tabTextActive,
              ]}
            >
              Subscribers ({subscriptions.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "history" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.tabTextActive,
              ]}
            >
              Audit History ({resolvedIssues.length})
            </Text>
          </Pressable>
        </View>

        {/* TAB CONTENT: OPEN ISSUES */}
        {activeTab === "issues" && (
          <View style={styles.tabSection}>
            {openIssues.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="shield-checkmark"
                  size={42}
                  color={Palette.success}
                />
                <Text style={styles.emptyTitle}>
                  All Subscriptions Synchronized
                </Text>
                <Text style={styles.emptySubtitle}>
                  Zero payment mismatches, quota discrepancies, or unverified
                  entitlements detected.
                </Text>
              </Card>
            ) : (
              openIssues.map((issue) => {
                const isAutoRepairing = autoRepairingId === issue.issueId;

                return (
                  <Card key={issue._id} style={styles.issueCard}>
                    <View style={styles.issueHeader}>
                      <View style={styles.issueHeaderLeft}>
                        <Badge
                          label={issue.severity.toUpperCase()}
                          variant={getSeverityBadgeVariant(issue.severity)}
                        />
                        <Text style={styles.issueIdText}>{issue.issueId}</Text>
                      </View>
                      <Text style={styles.subscriberTypeText}>
                        {issue.subscriberType.toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.issueTitle}>{issue.title}</Text>
                    <Text style={styles.issueSubscriber}>
                      Subscriber:{" "}
                      <Text style={styles.boldText}>
                        {issue.subscriberName}
                      </Text>{" "}
                      · Plan:{" "}
                      <Text style={styles.boldText}>{issue.planKey}</Text>
                    </Text>

                    {/* EVIDENCE SUMMARY */}
                    <View style={styles.evidenceBox}>
                      <Text style={styles.evidenceTitle}>AUDIT EVIDENCE</Text>
                      {Object.entries(issue.evidence || {}).map(
                        ([key, val]) => (
                          <Text key={key} style={styles.evidenceText}>
                            • {key}: {String(val)}
                          </Text>
                        ),
                      )}
                    </View>

                    {/* RECOMMENDED RESOLUTION */}
                    <View style={styles.resolutionBox}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.resolutionText}>
                        {issue.recommendedResolution}
                      </Text>
                    </View>

                    {/* ACTION BUTTONS */}
                    <View style={styles.issueActionRow}>
                      {issue.autoRepairEligible ? (
                        <Button
                          title={
                            isAutoRepairing
                              ? "Repairing..."
                              : "Safe Auto-Repair"
                          }
                          variant="secondary"
                          onPress={() => handleAutoRepair(issue)}
                          disabled={isAutoRepairing}
                          loading={isAutoRepairing}
                          icon="flash"
                        />
                      ) : null}

                      <Button
                        title="Resolve Manually"
                        variant="primary"
                        onPress={() => openResolutionModal(issue)}
                        icon="create-outline"
                      />
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB CONTENT: ACTIVE SUBSCRIBERS */}
        {activeTab === "active_subs" && (
          <View style={styles.tabSection}>
            {subscriptions.map((sub) => {
              const name = sub.hospitalName || sub.planName || "Subscriber";
              const isHospital = Boolean(sub.hospitalId);

              return (
                <Card key={sub._id} style={styles.subscriberCard}>
                  <View style={styles.subscriberHeader}>
                    <View>
                      <Text style={styles.subscriberName}>{name}</Text>
                      <Text style={styles.subscriberTypeLabel}>
                        {isHospital ? "Hospital Account" : "Patient Account"} ·{" "}
                        {sub.billingCycle}
                      </Text>
                    </View>
                    <Badge
                      label={sub.status.toUpperCase()}
                      variant={
                        sub.status === "active"
                          ? "success"
                          : sub.status === "trial"
                            ? "primary"
                            : "error"
                      }
                    />
                  </View>

                  <View style={styles.subscriberMetricsRow}>
                    <View style={styles.subMetric}>
                      <Text style={styles.subMetricLabel}>Plan</Text>
                      <Text style={styles.subMetricVal}>
                        {sub.planSnapshot?.name || sub.planName}
                      </Text>
                    </View>
                    <View style={styles.subMetric}>
                      <Text style={styles.subMetricLabel}>Price</Text>
                      <Text style={styles.subMetricVal}>
                        {formatINR(sub.planSnapshot?.price || sub.amount)}
                      </Text>
                    </View>
                    <View style={styles.subMetric}>
                      <Text style={styles.subMetricLabel}>Quota</Text>
                      <Text style={styles.subMetricVal}>
                        {sub.videoConsultationsUsed || 0} /{" "}
                        {sub.videoConsultationsAllowance ||
                          sub.planSnapshot?.videoConsultationsMonthly ||
                          0}
                      </Text>
                    </View>
                    <View style={styles.subMetric}>
                      <Text style={styles.subMetricLabel}>Expiry</Text>
                      <Text style={styles.subMetricVal}>
                        {sub.expiryDate
                          ? formatDDMMYYYY(sub.expiryDate)
                          : "Never"}
                      </Text>
                    </View>
                  </View>

                  {sub.pendingDowngradePlanKey ? (
                    <View style={styles.downgradeNoticeBox}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={Palette.warning}
                      />
                      <Text style={styles.downgradeNoticeText}>
                        Downgrade scheduled to {sub.pendingDowngradePlanKey} on{" "}
                        {sub.pendingDowngradeDate
                          ? formatDDMMYYYY(sub.pendingDowngradeDate)
                          : "cycle end"}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}

        {/* TAB CONTENT: AUDIT HISTORY */}
        {activeTab === "history" && (
          <View style={styles.tabSection}>
            {resolvedIssues.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="file-tray-outline"
                  size={42}
                  color={Palette.textMuted}
                />
                <Text style={styles.emptyTitle}>No Resolution History</Text>
                <Text style={styles.emptySubtitle}>
                  Resolved or auto-repaired discrepancies will appear here.
                </Text>
              </Card>
            ) : (
              resolvedIssues.map((hist) => (
                <Card key={hist._id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Badge
                      label={hist.status.toUpperCase()}
                      variant={
                        hist.status === "auto_repaired" ? "primary" : "neutral"
                      }
                    />
                    <Text style={styles.historyDate}>
                      {hist.resolvedAt
                        ? formatDDMMYYYY(hist.resolvedAt)
                        : formatDDMMYYYY(hist.updatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.historyTitle}>{hist.title}</Text>
                  <Text style={styles.historyActor}>
                    Resolved By: {hist.resolvedByName || "System Engine"} ·
                    Action: {hist.resolutionAction || "Updated"}
                  </Text>
                  {hist.resolutionNotes ? (
                    <Text style={styles.historyNotes}>
                      {hist.resolutionNotes}
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* MANUAL RESOLUTION MODAL */}
      <Modal
        visible={Boolean(selectedIssue)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedIssue(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resolve Discrepancy</Text>
              <Pressable onPress={() => setSelectedIssue(null)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.modalIssueTitle}>{selectedIssue?.title}</Text>
              <Text style={styles.modalSubtitle}>
                Subscriber: {selectedIssue?.subscriberName} (
                {selectedIssue?.planKey})
              </Text>

              {/* ACTION CHOICES */}
              <Text style={styles.fieldLabel}>Select Resolution Action:</Text>
              <View style={styles.actionChoiceContainer}>
                {selectedIssue?.issueType === "expired_still_active" ? (
                  <Pressable
                    style={[
                      styles.choiceButton,
                      resolutionAction === "transition_expired" &&
                        styles.choiceButtonActive,
                    ]}
                    onPress={() => setResolutionAction("transition_expired")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        resolutionAction === "transition_expired" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      Transition Status to 'Expired'
                    </Text>
                  </Pressable>
                ) : null}

                {selectedIssue?.issueType ===
                "payment_verified_sub_inactive" ? (
                  <Pressable
                    style={[
                      styles.choiceButton,
                      resolutionAction === "activate_verified_subscription" &&
                        styles.choiceButtonActive,
                    ]}
                    onPress={() =>
                      setResolutionAction("activate_verified_subscription")
                    }
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        resolutionAction === "activate_verified_subscription" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      Reactivate with Verified Payment
                    </Text>
                  </Pressable>
                ) : null}

                {selectedIssue?.issueType === "quota_entitlement_mismatch" ? (
                  <Pressable
                    style={[
                      styles.choiceButton,
                      resolutionAction === "recalculate_quota" &&
                        styles.choiceButtonActive,
                    ]}
                    onPress={() => setResolutionAction("recalculate_quota")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        resolutionAction === "recalculate_quota" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      Recalculate Quota to Active Bookings
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.choiceButton,
                    resolutionAction === "dismiss" && styles.choiceButtonActive,
                  ]}
                  onPress={() => setResolutionAction("dismiss")}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      resolutionAction === "dismiss" && styles.choiceTextActive,
                    ]}
                  >
                    Dismiss / Accepted False Positive
                  </Text>
                </Pressable>
              </View>

              {/* NOTES INPUT */}
              <Text style={styles.fieldLabel}>Audit Justification Notes:</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Reason or authorization reference..."
                placeholderTextColor={Palette.textMuted}
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setSelectedIssue(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={submittingResolution ? "Saving..." : "Apply Resolution"}
                variant="primary"
                onPress={handleSubmitResolution}
                disabled={submittingResolution}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
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
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  shieldIconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.sm,
    alignItems: "center",
    gap: Spacing.xs,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Palette.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
  },
  tabNav: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  tabButtonActive: {
    backgroundColor: Palette.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: "#fff",
  },
  tabSection: {
    gap: Spacing.sm,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
  },
  issueCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: Palette.error,
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  issueHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  issueIdText: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  subscriberTypeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primary,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  issueSubscriber: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  boldText: {
    fontWeight: "700",
    color: Palette.text,
  },
  evidenceBox: {
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.xs,
  },
  evidenceTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  evidenceText: {
    fontSize: 12,
    color: Palette.text,
  },
  resolutionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  resolutionText: {
    fontSize: 12,
    color: Palette.primaryDark,
    flex: 1,
  },
  issueActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  subscriberCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  subscriberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subscriberName: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  subscriberTypeLabel: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  subscriberMetricsRow: {
    flexDirection: "row",
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    justifyContent: "space-between",
  },
  subMetric: {
    alignItems: "center",
  },
  subMetricLabel: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  subMetricVal: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  downgradeNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#fffbeb",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  downgradeNoticeText: {
    fontSize: 12,
    color: "#b45309",
  },
  historyCard: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyDate: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  historyActor: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  historyNotes: {
    fontSize: 11,
    color: Palette.text,
    fontStyle: "italic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalCard: {
    maxHeight: "80%",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  modalBody: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  modalIssueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  actionChoiceContainer: {
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  choiceButton: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  choiceButtonActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  choiceText: {
    fontSize: 12,
    color: Palette.text,
  },
  choiceTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: 12,
    color: Palette.text,
    minHeight: 60,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
