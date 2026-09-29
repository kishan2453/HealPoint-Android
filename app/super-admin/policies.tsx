/**
 * HealPoint — Super Admin · Smart Healthcare Policy & Rules Engine.
 *
 * Production-grade centralized server-side business-rules engine console.
 * Authoritative rules for Appointment Booking, Cancellation, Rescheduling,
 * Video Consultation Quota Gating, Family Booking, and State Transitions.
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
  Switch,
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
import * as policyService from "@/services/policy";
import type {
  PolicyCategory,
  PolicyDecision,
  PolicyRule,
  PolicyVersionHistory,
} from "@/types";

type ActiveTab = "overview" | "rules" | "simulator" | "history";

export default function SuperAdminPoliciesScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Editor Modal
  const [editingPolicy, setEditingPolicy] = useState<PolicyRule | null>(null);
  const [editorConditionsText, setEditorConditionsText] = useState("");
  const [editorReason, setEditorReason] = useState("");
  const [editorEnabled, setEditorEnabled] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // History & Rollback Modal
  const [selectedHistoryPolicy, setSelectedHistoryPolicy] =
    useState<PolicyRule | null>(null);
  const [policyHistory, setPolicyHistory] = useState<PolicyVersionHistory[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rollbackTarget, setRollbackTarget] =
    useState<PolicyVersionHistory | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [executingRollback, setExecutingRollback] = useState(false);

  // Simulator State
  const [simPolicyKey, setSimPolicyKey] = useState<string>(
    "video_consultation_gating",
  );
  const [simPlan, setSimPlan] = useState<string>("free");
  const [simQuotaRemaining, setSimQuotaRemaining] = useState<string>("0");
  const [simHoursUntilSlot, setSimHoursUntilSlot] = useState<string>("1");
  const [simReschedulesCount, setSimReschedulesCount] = useState<string>("0");
  const [simStatus, setSimStatus] = useState<string>("confirmed");
  const [simTargetStatus, setSimTargetStatus] = useState<string>("completed");
  const [simulating, setSimulating] = useState(false);
  const [simDecision, setSimDecision] = useState<PolicyDecision | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const list = await policyService.listPolicies({
        category: categoryFilter,
        search: searchQuery,
      });
      setPolicies(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load policy rules");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Handle Edit Action
  const handleOpenEdit = (policy: PolicyRule) => {
    setEditingPolicy(policy);
    setEditorConditionsText(JSON.stringify(policy.conditions, null, 2));
    setEditorEnabled(policy.isEnabled);
    setEditorReason("");
  };

  const handleSaveEdit = async () => {
    if (!editingPolicy) return;
    if (!editorReason.trim()) {
      Alert.alert(
        "Justification Required",
        "A mandatory reason must be provided for policy modifications.",
      );
      return;
    }

    let parsedConditions: Record<string, any>;
    try {
      parsedConditions = JSON.parse(editorConditionsText);
    } catch {
      Alert.alert(
        "Invalid JSON",
        "Please ensure the conditions are valid JSON.",
      );
      return;
    }

    try {
      setSavingEdit(true);
      await policyService.updatePolicy(editingPolicy.policyKey, {
        title: editingPolicy.title,
        description: editingPolicy.description,
        isEnabled: editorEnabled,
        conditions: parsedConditions,
        reason: editorReason.trim(),
      });
      Alert.alert(
        "Success",
        "Policy updated successfully and new version published.",
      );
      setEditingPolicy(null);
      loadData();
    } catch (err: any) {
      Alert.alert("Update Failed", err?.message || "Failed to update policy");
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle History & Rollback
  const handleOpenHistory = async (policy: PolicyRule) => {
    setSelectedHistoryPolicy(policy);
    setLoadingHistory(true);
    try {
      const historyList = await policyService.getPolicyHistory(
        policy.policyKey,
      );
      setPolicyHistory(historyList);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message || "Failed to load policy version history",
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!selectedHistoryPolicy || !rollbackTarget) return;
    if (!rollbackReason.trim()) {
      Alert.alert(
        "Reason Required",
        "Please provide a justification reason for rolling back this policy.",
      );
      return;
    }

    try {
      setExecutingRollback(true);
      await policyService.rollbackPolicy(
        selectedHistoryPolicy.policyKey,
        rollbackTarget.version,
        rollbackReason.trim(),
      );
      Alert.alert(
        "Rollback Complete",
        `Policy '${selectedHistoryPolicy.title}' rolled back to version ${rollbackTarget.version} snapshot.`,
      );
      setRollbackTarget(null);
      setRollbackReason("");
      setSelectedHistoryPolicy(null);
      loadData();
    } catch (err: any) {
      Alert.alert(
        "Rollback Failed",
        err?.message || "Failed to rollback policy",
      );
    } finally {
      setExecutingRollback(false);
    }
  };

  // Handle Simulation
  const handleRunSimulation = async () => {
    try {
      setSimulating(true);
      setSimDecision(null);

      const context: Record<string, any> = {};
      if (simPolicyKey === "video_consultation_gating") {
        context.plan = simPlan;
        context.quotaRemaining = Number(simQuotaRemaining) || 0;
      } else if (simPolicyKey === "appointment_cancellation") {
        context.hoursUntilSlot = Number(simHoursUntilSlot) || 0;
        context.status = simStatus;
      } else if (simPolicyKey === "appointment_reschedule") {
        context.hoursUntilSlot = Number(simHoursUntilSlot) || 0;
        context.reschedulesCount = Number(simReschedulesCount) || 0;
        context.status = simStatus;
      } else if (simPolicyKey === "state_transition") {
        context.currentStatus = simStatus;
        context.targetStatus = simTargetStatus;
      } else if (simPolicyKey === "checkin_queue") {
        context.minutesUntilSlot = Number(simHoursUntilSlot) * 60;
        context.status = simStatus;
      }

      const decision = await policyService.simulatePolicy({
        policyKey: simPolicyKey,
        context,
      });
      setSimDecision(decision);
    } catch (err: any) {
      Alert.alert("Simulation Error", err?.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const getCategoryBadgeVariant = (cat: PolicyCategory): BadgeVariant => {
    switch (cat) {
      case "appointments":
        return "primary";
      case "consultations":
        return "primary";
      case "subscriptions":
        return "success";
      case "family":
        return "warning";
      case "privacy":
        return "error";
      case "queue":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <RoleRoute allowedRoles={["super_admin"]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Policy & Rules Engine</Text>
            <Text style={styles.headerSubtitle}>
              Authoritative Server-Side Governance
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            onPress={onRefresh}
            style={styles.iconButton}
          >
            <Ionicons name="refresh" size={20} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "rules" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("rules")}
          >
            <Ionicons
              name="list"
              size={18}
              color={
                activeTab === "rules" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "rules" && styles.tabLabelActive,
              ]}
            >
              Rules ({policies.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "simulator" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("simulator")}
          >
            <Ionicons
              name="flask"
              size={18}
              color={
                activeTab === "simulator" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "simulator" && styles.tabLabelActive,
              ]}
            >
              Simulator
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "overview" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("overview")}
          >
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={
                activeTab === "overview" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "overview" && styles.tabLabelActive,
              ]}
            >
              Invariants
            </Text>
          </Pressable>
        </View>

        {/* Content Body */}
        {loading && !refreshing ? (
          <Loading label="Loading centralized policy engine..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* RULES TAB */}
            {activeTab === "rules" && (
              <View style={styles.section}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={Palette.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search policies by key, title, category..."
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

                {/* Category Filter Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.filterScroll}
                >
                  {[
                    "all",
                    "appointments",
                    "consultations",
                    "subscriptions",
                    "family",
                    "privacy",
                    "queue",
                  ].map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.chip,
                        categoryFilter === cat && styles.chipActive,
                      ]}
                      onPress={() => setCategoryFilter(cat)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          categoryFilter === cat && styles.chipTextActive,
                        ]}
                      >
                        {cat.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Policies List */}
                {policies.length === 0 ? (
                  <EmptyState
                    title="No Policy Rules Found"
                    message="No rules match your filter criteria."
                  />
                ) : (
                  policies.map((p) => (
                    <Card key={p._id || p.policyKey} style={styles.policyCard}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Badge
                            label={p.category.toUpperCase()}
                            variant={getCategoryBadgeVariant(p.category)}
                          />
                          <Badge
                            label={`v${p.version}`}
                            variant={p.isEnabled ? "success" : "neutral"}
                          />
                          {p.scope === "hospital" && (
                            <Badge
                              label="Hospital Override"
                              variant="warning"
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.statusTag,
                            {
                              color: p.isEnabled
                                ? Palette.success
                                : Palette.error,
                            },
                          ]}
                        >
                          {p.isEnabled ? "ACTIVE" : "DISABLED"}
                        </Text>
                      </View>

                      <Text style={styles.policyTitle}>{p.title}</Text>
                      <Text style={styles.policyKeyText}>{p.policyKey}</Text>
                      {p.description ? (
                        <Text style={styles.policyDesc}>{p.description}</Text>
                      ) : null}

                      {/* Conditions Preview */}
                      <View style={styles.conditionsBox}>
                        <Text style={styles.conditionsHeader}>
                          Active Conditions:
                        </Text>
                        <Text style={styles.conditionsText} numberOfLines={4}>
                          {JSON.stringify(p.conditions, null, 2)}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                          Updated by: {p.updatedByName || "System"}
                        </Text>
                        <Text style={styles.metaText}>
                          {p.updatedAt
                            ? new Date(p.updatedAt).toLocaleDateString()
                            : "Standard"}
                        </Text>
                      </View>

                      {/* Actions */}
                      <View style={styles.cardActions}>
                        <Button
                          title="Configure"
                          variant="outline"
                          fullWidth={false}
                          onPress={() => handleOpenEdit(p)}
                        />
                        <View style={{ width: Spacing.sm }} />
                        <Button
                          title="History & Rollback"
                          variant="secondary"
                          fullWidth={false}
                          onPress={() => handleOpenHistory(p)}
                        />
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* SIMULATOR TAB */}
            {activeTab === "simulator" && (
              <View style={styles.section}>
                <Card style={styles.simulatorCard}>
                  <View style={styles.simHeader}>
                    <Ionicons name="flask" size={24} color={Palette.primary} />
                    <View style={{ marginLeft: Spacing.sm }}>
                      <Text style={styles.simTitle}>
                        Interactive Policy Simulator
                      </Text>
                      <Text style={styles.simSubtitle}>
                        Test arbitrary conditions without mutating live data
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>
                    Select Policy to Simulate
                  </Text>
                  <View style={styles.simPickerContainer}>
                    {[
                      {
                        key: "video_consultation_gating",
                        label: "Video Gating & Quota",
                      },
                      {
                        key: "appointment_cancellation",
                        label: "Cancellation Cutoff",
                      },
                      {
                        key: "appointment_reschedule",
                        label: "Reschedule Cutoff & Limits",
                      },
                      {
                        key: "state_transition",
                        label: "State Transition Matrix",
                      },
                      { key: "checkin_queue", label: "Check-In Window" },
                    ].map((item) => (
                      <Pressable
                        key={item.key}
                        style={[
                          styles.simPickerItem,
                          simPolicyKey === item.key &&
                            styles.simPickerItemActive,
                        ]}
                        onPress={() => {
                          setSimPolicyKey(item.key);
                          setSimDecision(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.simPickerText,
                            simPolicyKey === item.key &&
                              styles.simPickerTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Context Inputs based on selected policy */}
                  {simPolicyKey === "video_consultation_gating" && (
                    <View style={styles.simInputsGroup}>
                      <Text style={styles.inputLabel}>Patient Plan Tier</Text>
                      <View style={styles.chipRow}>
                        {["free", "gold", "platinum", "prime"].map((p) => (
                          <Pressable
                            key={p}
                            style={[
                              styles.chip,
                              simPlan === p && styles.chipActive,
                            ]}
                            onPress={() => setSimPlan(p)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                simPlan === p && styles.chipTextActive,
                              ]}
                            >
                              {p.toUpperCase()}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text
                        style={[styles.inputLabel, { marginTop: Spacing.md }]}
                      >
                        Remaining Monthly Video Quota
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={simQuotaRemaining}
                        onChangeText={setSimQuotaRemaining}
                        placeholder="e.g. 0, 1, 4"
                        placeholderTextColor={Palette.textMuted}
                      />
                    </View>
                  )}

                  {(simPolicyKey === "appointment_cancellation" ||
                    simPolicyKey === "appointment_reschedule") && (
                    <View style={styles.simInputsGroup}>
                      <Text style={styles.inputLabel}>
                        Hours Until Scheduled Slot Time
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={simHoursUntilSlot}
                        onChangeText={setSimHoursUntilSlot}
                        placeholder="e.g. 1 (cutoff is 2h for cancel, 4h for reschedule)"
                        placeholderTextColor={Palette.textMuted}
                      />

                      {simPolicyKey === "appointment_reschedule" && (
                        <>
                          <Text
                            style={[
                              styles.inputLabel,
                              { marginTop: Spacing.md },
                            ]}
                          >
                            Past Reschedules Count (Max 3)
                          </Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            value={simReschedulesCount}
                            onChangeText={setSimReschedulesCount}
                            placeholder="e.g. 0, 3"
                            placeholderTextColor={Palette.textMuted}
                          />
                        </>
                      )}

                      <Text
                        style={[styles.inputLabel, { marginTop: Spacing.md }]}
                      >
                        Current Appointment Status
                      </Text>
                      <View style={styles.chipRow}>
                        {["pending", "confirmed", "completed", "cancel"].map(
                          (st) => (
                            <Pressable
                              key={st}
                              style={[
                                styles.chip,
                                simStatus === st && styles.chipActive,
                              ]}
                              onPress={() => setSimStatus(st)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  simStatus === st && styles.chipTextActive,
                                ]}
                              >
                                {st}
                              </Text>
                            </Pressable>
                          ),
                        )}
                      </View>
                    </View>
                  )}

                  {simPolicyKey === "state_transition" && (
                    <View style={styles.simInputsGroup}>
                      <Text style={styles.inputLabel}>Current Status</Text>
                      <TextInput
                        style={styles.textInput}
                        value={simStatus}
                        onChangeText={setSimStatus}
                        placeholder="e.g. completed, confirmed, cancel"
                        placeholderTextColor={Palette.textMuted}
                      />

                      <Text
                        style={[styles.inputLabel, { marginTop: Spacing.md }]}
                      >
                        Target Status Transition
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={simTargetStatus}
                        onChangeText={setSimTargetStatus}
                        placeholder="e.g. in_consultation, completed"
                        placeholderTextColor={Palette.textMuted}
                      />
                    </View>
                  )}

                  <View style={{ marginTop: Spacing.lg }}>
                    <Button
                      title={simulating ? "Evaluating..." : "Run Simulation"}
                      onPress={handleRunSimulation}
                      loading={simulating}
                    />
                  </View>

                  {/* Simulation Result */}
                  {simDecision && (
                    <View
                      style={[
                        styles.decisionBox,
                        {
                          borderColor: simDecision.allowed
                            ? Palette.success
                            : Palette.error,
                          backgroundColor: simDecision.allowed
                            ? "#ecfdf5"
                            : "#fef2f2",
                        },
                      ]}
                    >
                      <View style={styles.decisionHeader}>
                        <Ionicons
                          name={
                            simDecision.allowed
                              ? "checkmark-circle"
                              : "close-circle"
                          }
                          size={24}
                          color={
                            simDecision.allowed
                              ? Palette.success
                              : Palette.error
                          }
                        />
                        <Text
                          style={[
                            styles.decisionOutcome,
                            {
                              color: simDecision.allowed
                                ? Palette.success
                                : Palette.error,
                            },
                          ]}
                        >
                          {simDecision.allowed
                            ? "DECISION: ALLOWED"
                            : "DECISION: BLOCKED"}
                        </Text>
                      </View>

                      <Text style={styles.decisionReasonCode}>
                        Reason Code: {simDecision.reasonCode}
                      </Text>
                      <Text style={styles.decisionMessage}>
                        {simDecision.message}
                      </Text>
                      <Text style={styles.decisionMeta}>
                        Evaluated under Policy: {simDecision.policyKey} (v
                        {simDecision.policyVersion})
                      </Text>
                    </View>
                  )}
                </Card>
              </View>
            )}

            {/* OVERVIEW / INVARIANTS TAB */}
            {activeTab === "overview" && (
              <View style={styles.section}>
                <Card style={styles.invariantCard}>
                  <Text style={styles.invariantTitle}>
                    Platform Invariants & Server Authority
                  </Text>
                  <Text style={styles.invariantSub}>
                    Core non-negotiable rules enforced by HealPoint's Policy
                    Engine:
                  </Text>

                  <View style={styles.bulletItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Palette.success}
                    />
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>
                        Free Clinic Guarantee:
                      </Text>{" "}
                      Patients on the Free tier can ALWAYS book standard
                      in-person clinic visits without any subscription
                      requirement.
                    </Text>
                  </View>

                  <View style={styles.bulletItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Palette.success}
                    />
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>
                        Video Consultation Gating:
                      </Text>{" "}
                      Video visits strictly require an active Gold (4/mo),
                      Platinum (7/mo), or Prime (10/mo) plan with available
                      quota.
                    </Text>
                  </View>

                  <View style={styles.bulletItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Palette.success}
                    />
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>Untrusted Frontend:</Text>{" "}
                      Client payloads claiming quota or subscription state are
                      rejected. Quotas are validated and decremented atomically
                      on the backend.
                    </Text>
                  </View>

                  <View style={styles.bulletItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Palette.success}
                    />
                    <Text style={styles.bulletText}>
                      <Text style={styles.boldText}>
                        Mandatory Audit Trail:
                      </Text>{" "}
                      Every rule mutation requires an explicit operational
                      reason, increments version, and can be rolled back safely.
                    </Text>
                  </View>
                </Card>
              </View>
            )}
          </ScrollView>
        )}

        {/* EDIT / CONFIGURE MODAL */}
        <Modal
          visible={!!editingPolicy}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingPolicy(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Configure: {editingPolicy?.title}
                </Text>
                <Pressable onPress={() => setEditingPolicy(null)}>
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.switchRow}>
                  <Text style={styles.inputLabel}>Rule Enabled</Text>
                  <Switch
                    value={editorEnabled}
                    onValueChange={setEditorEnabled}
                    trackColor={{ false: "#e5e7eb", true: Palette.primary }}
                  />
                </View>

                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Conditions (JSON Configuration)
                </Text>
                <TextInput
                  style={[styles.textInput, styles.codeArea]}
                  multiline
                  value={editorConditionsText}
                  onChangeText={setEditorConditionsText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Mandatory Change Justification Reason *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editorReason}
                  onChangeText={setEditorReason}
                  placeholder="Explain why this policy rule is being modified..."
                  placeholderTextColor={Palette.textMuted}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setEditingPolicy(null)}
                />
                <View style={{ width: Spacing.sm }} />
                <Button
                  title="Publish Version"
                  variant="primary"
                  fullWidth={false}
                  loading={savingEdit}
                  onPress={handleSaveEdit}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* HISTORY & ROLLBACK MODAL */}
        <Modal
          visible={!!selectedHistoryPolicy}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setSelectedHistoryPolicy(null);
            setRollbackTarget(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Version Ledger: {selectedHistoryPolicy?.title}
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedHistoryPolicy(null);
                    setRollbackTarget(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody}>
                {loadingHistory ? (
                  <ActivityIndicator size="small" color={Palette.primary} />
                ) : policyHistory.length === 0 ? (
                  <Text style={styles.emptyHistoryText}>
                    No version history recorded yet.
                  </Text>
                ) : (
                  policyHistory.map((item) => (
                    <Card key={item._id} style={styles.historyCard}>
                      <View style={styles.cardHeader}>
                        <Badge
                          label={`Version ${item.version}`}
                          variant={
                            item.action === "rollback" ? "warning" : "primary"
                          }
                        />
                        <Text style={styles.metaText}>
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.historyReason}>
                        Reason: {item.reason}
                      </Text>
                      <Text style={styles.historyActor}>
                        Actor: {item.actorName} ({item.actorRole})
                      </Text>

                      {/* Rollback Trigger */}
                      {item.version !== selectedHistoryPolicy?.version && (
                        <View style={{ marginTop: Spacing.sm }}>
                          <Button
                            title={`Rollback to v${item.version}`}
                            variant="danger"
                            fullWidth={false}
                            onPress={() => setRollbackTarget(item)}
                          />
                        </View>
                      )}
                    </Card>
                  ))
                )}

                {/* Rollback Prompt */}
                {rollbackTarget && (
                  <View style={styles.rollbackPrompt}>
                    <Text style={styles.rollbackPromptTitle}>
                      Confirm Rollback to Version {rollbackTarget.version}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={rollbackReason}
                      onChangeText={setRollbackReason}
                      placeholder="Mandatory rollback justification reason..."
                      placeholderTextColor={Palette.textMuted}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        marginTop: Spacing.sm,
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        title="Cancel"
                        variant="ghost"
                        fullWidth={false}
                        onPress={() => setRollbackTarget(null)}
                      />
                      <View style={{ width: Spacing.sm }} />
                      <Button
                        title="Confirm & Activate"
                        variant="danger"
                        fullWidth={false}
                        loading={executingRollback}
                        onPress={handleExecuteRollback}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitles: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  iconButton: {
    padding: Spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Palette.primary,
  },
  tabLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginLeft: Spacing.xs,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    marginLeft: Spacing.xs,
    color: Palette.text,
    ...Typography.body,
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: Spacing.xs,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  policyCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusTag: {
    ...Typography.caption,
    fontWeight: "700",
  },
  policyTitle: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  policyKeyText: {
    ...Typography.caption,
    color: Palette.primary,
    fontFamily: "monospace",
    marginBottom: Spacing.xs,
  },
  policyDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginBottom: Spacing.sm,
  },
  conditionsBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  conditionsHeader: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 2,
  },
  conditionsText: {
    ...Typography.caption,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  simulatorCard: {
    padding: Spacing.md,
  },
  simHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  simTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  simSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  simPickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  simPickerItem: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  simPickerItemActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  simPickerText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  simPickerTextActive: {
    color: "#fff",
  },
  simInputsGroup: {
    marginTop: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  textInput: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: Palette.text,
    ...Typography.body,
  },
  codeArea: {
    minHeight: 120,
    fontFamily: "monospace",
    textAlignVertical: "top",
  },
  decisionBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  decisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  decisionOutcome: {
    ...Typography.body,
    fontWeight: "700",
    marginLeft: Spacing.xs,
  },
  decisionReasonCode: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  decisionMessage: {
    ...Typography.body,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  decisionMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  invariantCard: {
    padding: Spacing.lg,
  },
  invariantTitle: {
    ...Typography.h4,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  invariantSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  bulletText: {
    ...Typography.body,
    color: Palette.text,
    flex: 1,
    marginLeft: Spacing.sm,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "85%",
    padding: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
    flex: 1,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  historyReason: {
    ...Typography.bodySmall,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  historyActor: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  emptyHistoryText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    marginVertical: Spacing.lg,
  },
  rollbackPrompt: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "#fef2f2",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.error,
  },
  rollbackPromptTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.error,
    marginBottom: Spacing.xs,
  },
});
