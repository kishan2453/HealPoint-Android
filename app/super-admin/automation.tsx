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
  Switch,
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
import * as workflowService from "@/services/workflowAutomation";
import type {
  WorkflowAutomationRule,
  WorkflowAutomationExecution,
  WorkflowAutomationStats,
  WorkflowSimulationResult,
  WorkflowExecutionStatus,
} from "@/types";

type ActiveTab = "rules" | "executions" | "failed" | "simulate";

const STATUS_BADGE_VARIANTS: Record<WorkflowExecutionStatus, BadgeVariant> = {
  SUCCEEDED: "success",
  RUNNING: "primary",
  QUEUED: "neutral",
  RETRYING: "warning",
  FAILED: "error",
  DEAD_LETTER: "error",
};

const SIMULATION_PRESETS = [
  { eventType: "appointment_completed", label: "Consultation Complete" },
  { eventType: "prescription_finalized", label: "Prescription Finalized" },
  { eventType: "payment_verified", label: "Payment Verified" },
  { eventType: "sla_breach_detected", label: "SLA Breach Detected" },
  { eventType: "referral_created", label: "Referral Created" },
  { eventType: "recovery_resolved", label: "Recovery Resolved" },
];

export default function WorkflowAutomationScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [metrics, setMetrics] = useState<WorkflowAutomationStats | null>(null);
  const [rules, setRules] = useState<WorkflowAutomationRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowAutomationExecution[]>(
    [],
  );
  const [failedExecutions, setFailedExecutions] = useState<
    WorkflowAutomationExecution[]
  >([]);

  // Simulation state
  const [selectedEventType, setSelectedEventType] = useState(
    "appointment_completed",
  );
  const [simEntityId, setSimEntityId] = useState("sim_appt_991");
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<WorkflowSimulationResult | null>(null);

  // Detail Modal state
  const [selectedExecution, setSelectedExecution] =
    useState<WorkflowAutomationExecution | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [metricsRes, rulesRes, execRes, failedRes] = await Promise.all([
        workflowService.getAutomationMetrics(),
        workflowService.getAutomationRules({ limit: 50 }),
        workflowService.getAutomationExecutions({ limit: 40 }),
        workflowService.getAutomationExecutions({
          status: "DEAD_LETTER",
          limit: 30,
        }),
      ]);

      setMetrics(metricsRes);
      setRules(rulesRes.rules || []);
      setExecutions(execRes.executions || []);
      setFailedExecutions(failedRes.executions || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load automation data";
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

  const handleToggleRule = async (rule: WorkflowAutomationRule) => {
    try {
      const res = await workflowService.toggleAutomationRule(rule._id);
      setRules((prev) =>
        prev.map((r) =>
          r._id === rule._id ? { ...r, isEnabled: res.isEnabled } : r,
        ),
      );
      if (metrics) {
        setMetrics({
          ...metrics,
          activeRules: res.isEnabled
            ? metrics.activeRules + 1
            : Math.max(0, metrics.activeRules - 1),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not toggle rule";
      Alert.alert("Rule Toggle Failed", msg);
    }
  };

  const handleManualRetry = async (executionId: string) => {
    try {
      setRetryingId(executionId);
      const updated =
        await workflowService.retryAutomationExecution(executionId);
      Alert.alert("Retry Finished", `Status: ${updated.status}`);
      loadData();
      if (selectedExecution && selectedExecution.executionId === executionId) {
        setSelectedExecution(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Manual retry failed";
      Alert.alert("Retry Failed", msg);
    } finally {
      setRetryingId(null);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setSimulating(true);
      const sim = await workflowService.simulateAutomationEvent({
        eventType: selectedEventType,
        entityId: simEntityId,
        entityType: "simulation_record",
      });
      setSimulationResult(sim);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Dry-run simulation failed";
      Alert.alert("Simulation Error", msg);
    } finally {
      setSimulating(false);
    }
  };

  if (loading && !refreshing) {
    return <Loading label="Loading Workflow Automation Center..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Workflow Automation</Text>
          <Text style={styles.headerSubtitle}>
            HealPoint Event & Action Orchestration
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="refresh" size={22} color={Palette.primary} />
        </Pressable>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Platform Safety Invariants Notice */}
          <View style={styles.safetyCard}>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={Palette.success}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.safetyText}>
              Platform Invariants Active: Strict SHA-256 Idempotency • Anti-Loop
              Guard (Max Depth 5) • Zero Autonomous Medical Prescription Changes
            </Text>
          </View>

          {/* KPI Ribbon */}
          {metrics && (
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>
                  {metrics.activeRules}/{metrics.totalRules}
                </Text>
                <Text style={styles.kpiLabel}>Active Rules</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{metrics.totalExecutions}</Text>
                <Text style={styles.kpiLabel}>Total Executions</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.success }]}>
                  {metrics.successRate}%
                </Text>
                <Text style={styles.kpiLabel}>Success Rate</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text
                  style={[
                    styles.kpiValue,
                    {
                      color:
                        metrics.deadLetter > 0 ? Palette.error : Palette.text,
                    },
                  ]}
                >
                  {metrics.deadLetter}
                </Text>
                <Text style={styles.kpiLabel}>Dead-Letter</Text>
              </Card>
            </View>
          )}

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[
                styles.tabButton,
                activeTab === "rules" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("rules")}
            >
              <Ionicons
                name="git-branch-outline"
                size={16}
                color={
                  activeTab === "rules" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "rules" && styles.tabTextActive,
                ]}
              >
                Rules ({rules.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === "executions" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("executions")}
            >
              <Ionicons
                name="pulse-outline"
                size={16}
                color={
                  activeTab === "executions"
                    ? Palette.primary
                    : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "executions" && styles.tabTextActive,
                ]}
              >
                Executions
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === "failed" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("failed")}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={
                  activeTab === "failed" ? Palette.error : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "failed" && styles.tabTextActive,
                ]}
              >
                Review ({failedExecutions.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                activeTab === "simulate" && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab("simulate")}
            >
              <Ionicons
                name="flask-outline"
                size={16}
                color={
                  activeTab === "simulate" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "simulate" && styles.tabTextActive,
                ]}
              >
                Dry-Run
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: RULES MANAGEMENT */}
          {activeTab === "rules" && (
            <View style={styles.tabSection}>
              {rules.length === 0 ? (
                <EmptyState
                  title="No Automation Rules"
                  message="No rules currently configured in this environment."
                  action={<Button title="Reload Rules" onPress={loadData} />}
                />
              ) : (
                rules.map((rule) => (
                  <Card key={rule._id} style={styles.ruleCard}>
                    <View style={styles.ruleCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.ruleIdRow}>
                          <Text style={styles.ruleIdText}>{rule.ruleId}</Text>
                          <Badge
                            variant={
                              rule.scope === "global" ? "primary" : "neutral"
                            }
                            label={rule.scope.toUpperCase()}
                          />
                        </View>
                        <Text style={styles.ruleNameText}>{rule.name}</Text>
                      </View>
                      <Switch
                        value={rule.isEnabled}
                        onValueChange={() => handleToggleRule(rule)}
                        trackColor={{
                          false: Palette.border,
                          true: Palette.primary,
                        }}
                      />
                    </View>

                    {rule.description ? (
                      <Text style={styles.ruleDescText}>
                        {rule.description}
                      </Text>
                    ) : null}

                    {/* Trigger Event & Priority */}
                    <View style={styles.triggerBadgeRow}>
                      <View style={styles.pillBox}>
                        <Ionicons
                          name="flash-outline"
                          size={12}
                          color={Palette.primary}
                        />
                        <Text style={styles.pillText}>
                          Trigger: {rule.triggerEvent}
                        </Text>
                      </View>
                      <View style={styles.pillBox}>
                        <Ionicons
                          name="flag-outline"
                          size={12}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.pillText}>
                          Priority: {rule.priority}
                        </Text>
                      </View>
                      <View style={styles.pillBox}>
                        <Ionicons
                          name="repeat-outline"
                          size={12}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.pillText}>
                          Retries: {rule.maxRetries}
                        </Text>
                      </View>
                    </View>

                    {/* Action Pipeline Steps */}
                    <View style={styles.actionChainBox}>
                      <Text style={styles.actionChainTitle}>
                        Action Chain ({rule.actions.length}):
                      </Text>
                      {rule.actions.map((act, idx) => (
                        <View
                          key={act._id || idx}
                          style={styles.actionStepItem}
                        >
                          <Text style={styles.stepNum}>{idx + 1}.</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.stepTarget}>
                              [{act.targetModule}] → {act.actionType}
                            </Text>
                            {act.description ? (
                              <Text style={styles.stepDesc}>
                                {act.description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 2: EXECUTIONS TRACE */}
          {activeTab === "executions" && (
            <View style={styles.tabSection}>
              {executions.length === 0 ? (
                <EmptyState
                  title="No Execution Traces"
                  message="Execution records will appear here as system events trigger automation rules."
                />
              ) : (
                executions.map((item) => (
                  <Pressable
                    key={item._id}
                    onPress={() => setSelectedExecution(item)}
                    style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                  >
                    <Card style={styles.execCard}>
                      <View style={styles.execHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.execIdText}>
                            {item.executionId}
                          </Text>
                          <Text style={styles.execRuleName}>
                            {item.ruleName || item.ruleId}
                          </Text>
                        </View>
                        <Badge
                          variant={
                            STATUS_BADGE_VARIANTS[item.status] || "neutral"
                          }
                          label={item.status}
                        />
                      </View>

                      <View style={styles.execMetaRow}>
                        <Text style={styles.execMetaLabel}>Event:</Text>
                        <Text style={styles.execMetaValue}>
                          {item.eventType}
                        </Text>
                        <Text
                          style={[
                            styles.execMetaLabel,
                            { marginLeft: Spacing.sm },
                          ]}
                        >
                          Depth:
                        </Text>
                        <Text style={styles.execMetaValue}>
                          {item.executionDepth}
                        </Text>
                        <Text
                          style={[
                            styles.execMetaLabel,
                            { marginLeft: Spacing.sm },
                          ]}
                        >
                          Duration:
                        </Text>
                        <Text style={styles.execMetaValue}>
                          {item.executionDurationMs}ms
                        </Text>
                      </View>

                      <View style={styles.idempotencyRow}>
                        <Ionicons
                          name="key-outline"
                          size={12}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.idempotencyText} numberOfLines={1}>
                          Key: {item.idempotencyKey}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* TAB 3: FAILED & DEAD LETTER REVIEW */}
          {activeTab === "failed" && (
            <View style={styles.tabSection}>
              {failedExecutions.length === 0 ? (
                <Card style={styles.allClearCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={40}
                    color={Palette.success}
                  />
                  <Text style={styles.allClearTitle}>
                    Dead-Letter Queue Clean
                  </Text>
                  <Text style={styles.allClearSub}>
                    Zero stalled or dead-letter workflow executions require
                    administrative intervention.
                  </Text>
                </Card>
              ) : (
                failedExecutions.map((item) => (
                  <Card
                    key={item._id}
                    style={[styles.execCard, { borderColor: Palette.error }]}
                  >
                    <View style={styles.execHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.execIdText}>
                          {item.executionId}
                        </Text>
                        <Text style={styles.execRuleName}>
                          {item.ruleName || item.ruleId}
                        </Text>
                      </View>
                      <Badge variant="error" label={item.status} />
                    </View>

                    <View style={styles.errorBox}>
                      <Text style={styles.errorTypeHeader}>
                        Classification: {item.errorType || "UNKNOWN"}
                      </Text>
                      <Text style={styles.errorDetailsText}>
                        {typeof item.errorDetails === "string"
                          ? item.errorDetails
                          : JSON.stringify(
                              item.errorDetails || "No additional error info",
                            )}
                      </Text>
                    </View>

                    <View style={styles.failedActionRow}>
                      <Text style={styles.retryCountText}>
                        Retried: {item.retryCount}/{item.maxRetries}
                      </Text>
                      <Button
                        title={
                          retryingId === item.executionId
                            ? "Retrying..."
                            : "Retry Now"
                        }
                        onPress={() => handleManualRetry(item.executionId)}
                        disabled={retryingId === item.executionId}
                        fullWidth={false}
                        variant="secondary"
                      />
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 4: DRY-RUN SIMULATION STUDIO */}
          {activeTab === "simulate" && (
            <View style={styles.tabSection}>
              <Card style={styles.simCard}>
                <Text style={styles.simTitle}>
                  Workflow Event Simulation Studio
                </Text>
                <Text style={styles.simSub}>
                  Simulate incoming healthcare events across the rules engine
                  without modifying database records or alerting real patients.
                </Text>

                <Text style={styles.inputLabel}>Select Event Type Preset:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.presetScroll}
                >
                  {SIMULATION_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.eventType}
                      style={[
                        styles.presetChip,
                        selectedEventType === preset.eventType &&
                          styles.presetChipActive,
                      ]}
                      onPress={() => setSelectedEventType(preset.eventType)}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          selectedEventType === preset.eventType &&
                            styles.presetChipTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Simulation Entity ID:</Text>
                <TextInput
                  value={simEntityId}
                  onChangeText={setSimEntityId}
                  style={styles.textInput}
                  placeholder="e.g. appt_live_992"
                />

                <Button
                  title={
                    simulating
                      ? "Evaluating Rules..."
                      : "Run Dry-Run Simulation"
                  }
                  onPress={handleRunSimulation}
                  loading={simulating}
                  style={{ marginTop: Spacing.md }}
                />
              </Card>

              {/* Simulation Result Output */}
              {simulationResult && (
                <Card style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Ionicons
                      name="checkmark-done-circle"
                      size={24}
                      color={Palette.success}
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.resultTitle}>Simulation Results</Text>
                      <Text style={styles.resultSub}>
                        {simulationResult.matchingRuleCount} of{" "}
                        {simulationResult.rulesEvaluated} rules matched in{" "}
                        {simulationResult.simulationDurationMs}ms
                      </Text>
                    </View>
                  </View>

                  {simulationResult.simulationSteps.map((step, idx) => (
                    <View key={step.ruleId || idx} style={styles.simStepBox}>
                      <View style={styles.simStepHeader}>
                        <Text style={styles.simStepRule}>{step.ruleName}</Text>
                        <Badge
                          variant={step.conditionPassed ? "success" : "neutral"}
                          label={step.conditionPassed ? "MATCHED" : "SKIPPED"}
                        />
                      </View>

                      <Text style={styles.simStepKey}>
                        Projected Idempotency Key:{" "}
                        {step.idempotencyKey.substring(0, 16)}...
                      </Text>

                      {step.projectedActions.map((act, aIdx) => (
                        <View key={aIdx} style={styles.projectedActionRow}>
                          <Ionicons
                            name="arrow-forward"
                            size={12}
                            color={Palette.primary}
                          />
                          <Text style={styles.projectedActionText}>
                            [{act.targetModule}] → {act.actionType}
                          </Text>
                        </View>
                      ))}

                      <View style={styles.safetyCheckRow}>
                        <Ionicons
                          name="shield"
                          size={12}
                          color={Palette.success}
                        />
                        <Text style={styles.safetyCheckText}>
                          Safety: No prescription/diagnostic modification • Safe
                          for auto-execution
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Execution Detail Trace Modal */}
      <Modal
        visible={!!selectedExecution}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedExecution(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Execution Trace</Text>
                <Text style={styles.modalSub}>
                  {selectedExecution?.executionId}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedExecution(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {selectedExecution && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Rule:</Text>
                  <Text style={styles.modalValue}>
                    {selectedExecution.ruleName} ({selectedExecution.ruleId})
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Event Type:</Text>
                  <Text style={styles.modalValue}>
                    {selectedExecution.eventType}
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status:</Text>
                  <Badge
                    variant={
                      STATUS_BADGE_VARIANTS[selectedExecution.status] ||
                      "neutral"
                    }
                    label={selectedExecution.status}
                  />
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Execution Depth:</Text>
                  <Text style={styles.modalValue}>
                    {selectedExecution.executionDepth} / 5
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Duration:</Text>
                  <Text style={styles.modalValue}>
                    {selectedExecution.executionDurationMs} ms
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Idempotency Key:</Text>
                  <Text style={[styles.modalValue, { fontSize: 11 }]}>
                    {selectedExecution.idempotencyKey}
                  </Text>
                </View>

                {selectedExecution.errorDetails ? (
                  <View style={styles.modalErrorBox}>
                    <Text style={styles.modalErrorTitle}>
                      Error Details ({selectedExecution.errorType}):
                    </Text>
                    <Text style={styles.modalErrorText}>
                      {typeof selectedExecution.errorDetails === "string"
                        ? selectedExecution.errorDetails
                        : JSON.stringify(selectedExecution.errorDetails)}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.modalActionTitle}>
                  Dispatched Action Results (
                  {selectedExecution.actionResults?.length || 0}):
                </Text>
                {(selectedExecution.actionResults || []).map((act, i) => (
                  <View key={act._id || i} style={styles.modalActionItem}>
                    <View style={styles.modalActionHeader}>
                      <Text style={styles.modalActionModule}>
                        {act.targetModule} → {act.actionType}
                      </Text>
                      <Badge
                        variant={act.status === "SUCCESS" ? "success" : "error"}
                        label={act.status}
                      />
                    </View>
                    {act.error ? (
                      <Text style={styles.modalActionError}>
                        Error: {act.error}
                      </Text>
                    ) : null}
                    <Text style={styles.modalActionDuration}>
                      Duration: {act.durationMs}ms
                    </Text>
                  </View>
                ))}

                {(selectedExecution.status === "FAILED" ||
                  selectedExecution.status === "DEAD_LETTER") && (
                  <Button
                    title={
                      retryingId === selectedExecution.executionId
                        ? "Retrying..."
                        : "Retry Execution"
                    }
                    onPress={() =>
                      handleManualRetry(selectedExecution.executionId)
                    }
                    disabled={retryingId === selectedExecution.executionId}
                    style={{ marginTop: Spacing.lg }}
                  />
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  iconButton: {
    padding: Spacing.xs,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  safetyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    borderLeftColor: Palette.success,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  safetyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
    alignItems: "center",
  },
  kpiValue: {
    ...Typography.h2,
    color: Palette.primary,
    fontWeight: "700",
  },
  kpiLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tabButtonActive: {
    backgroundColor: Palette.background,
  },
  tabText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: Palette.primary,
  },
  tabSection: {
    gap: Spacing.md,
  },
  ruleCard: {
    padding: Spacing.md,
  },
  ruleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ruleIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  ruleIdText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  ruleNameText: {
    ...Typography.h4,
    color: Palette.text,
  },
  ruleDescText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: Spacing.xs,
  },
  triggerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  pillBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  actionChainBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  actionChainTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  actionStepItem: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 4,
  },
  stepNum: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  stepTarget: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  stepDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 11,
  },
  execCard: {
    padding: Spacing.md,
  },
  execHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  execIdText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  execRuleName: {
    ...Typography.h4,
    color: Palette.text,
  },
  execMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  execMetaLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 11,
  },
  execMetaValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    fontSize: 11,
    marginLeft: 2,
  },
  idempotencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
  },
  idempotencyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 10,
    flex: 1,
  },
  allClearCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  allClearTitle: {
    ...Typography.h3,
    color: Palette.text,
    marginTop: Spacing.md,
  },
  allClearSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  errorTypeHeader: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "700",
  },
  errorDetailsText: {
    ...Typography.bodySmall,
    color: "#991B1B",
    fontSize: 11,
    marginTop: 2,
  },
  failedActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  retryCountText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  simCard: {
    padding: Spacing.lg,
  },
  simTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  simSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 4,
  },
  inputLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  presetScroll: {
    marginBottom: Spacing.sm,
  },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  presetChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: Palette.primary,
  },
  presetChipText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  presetChipTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  textInput: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.bodyMedium,
    color: Palette.text,
  },
  resultCard: {
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Palette.success,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  resultSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  simStepBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  simStepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  simStepRule: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  simStepKey: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  projectedActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  projectedActionText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  safetyCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  safetyCheckText: {
    ...Typography.bodySmall,
    color: Palette.success,
    fontSize: 10,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Palette.overlay,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  modalBody: {
    paddingVertical: Spacing.md,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  modalLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  modalValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  modalErrorBox: {
    backgroundColor: "#FEE2E2",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.sm,
  },
  modalErrorTitle: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "700",
  },
  modalErrorText: {
    ...Typography.bodySmall,
    color: "#991B1B",
    fontSize: 11,
    marginTop: 2,
  },
  modalActionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  modalActionItem: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  modalActionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalActionModule: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  modalActionError: {
    ...Typography.bodySmall,
    color: Palette.error,
    fontSize: 11,
    marginTop: 2,
  },
  modalActionDuration: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
