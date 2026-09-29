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
import * as eventRecoveryService from "@/services/eventRecovery";
import type {
  EventRecoveryRecord,
  EventRecoveryKpis,
  EventReplayValidationResult,
  EventRecoveryState,
  EventFailureCategory,
} from "@/types";

type FilterTab = "ALL" | "FAILED" | "MANUAL_REVIEW" | "RETRYABLE" | "RECOVERED";

const STATE_BADGE_VARIANTS: Record<EventRecoveryState, BadgeVariant> = {
  RECEIVED: "neutral",
  PROCESSED: "success",
  FAILED: "error",
  RETRYING: "warning",
  RECOVERED: "success",
  MANUAL_REVIEW: "warning",
  REPLAYED: "primary",
  IGNORED: "neutral",
};

const CATEGORY_BADGE_VARIANTS: Record<EventFailureCategory, BadgeVariant> = {
  TRANSIENT: "warning",
  BUSINESS_STATE_CONFLICT: "error",
  AUTHORIZATION_FAILURE: "error",
  DATA_INTEGRITY_FAILURE: "error",
  EXTERNAL_SERVICE_FAILURE: "warning",
  DUPLICATE: "primary",
  UNKNOWN: "neutral",
};

export default function EventRecoveryScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [kpis, setKpis] = useState<EventRecoveryKpis | null>(null);
  const [events, setEvents] = useState<EventRecoveryRecord[]>([]);

  // Inspection Modal state
  const [inspectingEvent, setInspectingEvent] =
    useState<EventRecoveryRecord | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<EventReplayValidationResult | null>(null);

  // Replay Execution Modal state
  const [replayingEvent, setReplayingEvent] =
    useState<EventRecoveryRecord | null>(null);
  const [replayReason, setReplayReason] = useState("");
  const [replayActionType, setReplayActionType] = useState("RETRY_EVENT");
  const [executingReplay, setExecutingReplay] = useState(false);

  // Manual Review Modal state
  const [reviewingEvent, setReviewingEvent] =
    useState<EventRecoveryRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const stateParam =
        activeTab === "ALL"
          ? undefined
          : activeTab === "RETRYABLE"
            ? "FAILED"
            : activeTab;

      const [kpisRes, eventsRes] = await Promise.all([
        eventRecoveryService.getEventRecoveryKpis(),
        eventRecoveryService.getRecoveryEvents({
          state: stateParam,
          failureCategory: activeTab === "RETRYABLE" ? "TRANSIENT" : undefined,
          search: searchQuery.trim() || undefined,
          limit: 40,
        }),
      ]);

      setKpis(kpisRes);
      setEvents(eventsRes.events || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load recovery events";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await eventRecoveryService.syncFailedExecutions();
    } catch {
      // Best effort sync
    }
    loadData();
  }, [loadData]);

  const handleInspect = async (item: EventRecoveryRecord) => {
    try {
      setInspectingEvent(item);
      setValidating(true);
      setValidationResult(null);

      const [detailRes, valRes] = await Promise.all([
        eventRecoveryService.getRecoveryEventById(item.recoveryId),
        eventRecoveryService.validateEventReplay(item.recoveryId),
      ]);

      setInspectingEvent(detailRes);
      setValidationResult(valRes);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Validation inspection failed";
      Alert.alert("Inspection Error", msg);
    } finally {
      setValidating(false);
    }
  };

  const handleOpenReplayModal = (item: EventRecoveryRecord) => {
    setReplayingEvent(item);
    setReplayReason("");
    setReplayActionType(
      item.failureCategory === "DUPLICATE" ? "MARK_RECOVERED" : "RETRY_EVENT",
    );
  };

  const handleExecuteReplay = async () => {
    if (!replayingEvent) return;
    if (!replayReason.trim()) {
      Alert.alert(
        "Reason Required",
        "Please provide an explicit reason for this replay attempt.",
      );
      return;
    }

    try {
      setExecutingReplay(true);
      const res = await eventRecoveryService.executeEventReplay(
        replayingEvent.recoveryId,
        {
          reason: replayReason.trim(),
          actionType: replayActionType,
        },
      );

      Alert.alert(
        res.success ? "Recovery Successful" : "Recovery Finished",
        `Outcome: ${res.state}. Action executed: ${replayActionType}`,
      );

      setReplayingEvent(null);
      if (inspectingEvent?.recoveryId === replayingEvent.recoveryId) {
        setInspectingEvent(res.recovery);
      }
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Replay execution failed";
      Alert.alert("Replay Failed", msg);
    } finally {
      setExecutingReplay(false);
    }
  };

  const handleSaveManualReview = async () => {
    if (!reviewingEvent) return;
    if (!reviewNotes.trim()) {
      Alert.alert(
        "Notes Required",
        "Please describe the reason for manual review routing.",
      );
      return;
    }

    try {
      setSavingReview(true);
      await eventRecoveryService.markEventManualReview(
        reviewingEvent.recoveryId,
        {
          notes: reviewNotes.trim(),
          reason: reviewNotes.trim(),
        },
      );

      Alert.alert("Success", "Event routed to MANUAL_REVIEW queue.");
      setReviewingEvent(null);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed routing to manual review";
      Alert.alert("Error", msg);
    } finally {
      setSavingReview(false);
    }
  };

  const handleLinkIncident = async (item: EventRecoveryRecord) => {
    try {
      await eventRecoveryService.linkEventIncidentCase(item.recoveryId, {
        title: `Failed Event: ${item.eventType}`,
        severity: "medium",
        description: `Operational event failure: ${item.failureReason || "Workflow execution failed"}`,
      });
      Alert.alert(
        "Incident Linked",
        "Created and linked system incident ticket.",
      );
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to link incident";
      Alert.alert("Error", msg);
    }
  };

  if (loading && !refreshing) {
    return <Loading label="Loading Event Replay & Recovery Center..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Event Replay & Recovery</Text>
          <Text style={styles.headerSubtitle}>
            Safety Verification, Idempotent Recovery & Audit Trail
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="sync" size={22} color={Palette.primary} />
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
          {/* Safety Compliance Banner */}
          <View style={styles.safetyCard}>
            <Ionicons
              name="shield-checkmark"
              size={22}
              color={Palette.success}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.safetyText}>
              Safety Invariants Active: 9-Step Verification • Concurrency Lease
              Lock • Zero Duplicate Financial/Clinical Mutations • Mandatory
              Audit Reason
            </Text>
          </View>

          {/* Operational KPI Ribbon */}
          {kpis && (
            <View style={styles.kpiGrid}>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.error }]}>
                  {kpis.totalFailed}
                </Text>
                <Text style={styles.kpiLabel}>Failed Events</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.warning }]}>
                  {kpis.manualReview}
                </Text>
                <Text style={styles.kpiLabel}>Manual Review</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.info }]}>
                  {kpis.retryable}
                </Text>
                <Text style={styles.kpiLabel}>Retryable</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.success }]}>
                  {kpis.recovered}
                </Text>
                <Text style={styles.kpiLabel}>Recovered</Text>
              </Card>
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: Palette.text }]}>
                  {kpis.criticalFailures}
                </Text>
                <Text style={styles.kpiLabel}>Critical</Text>
              </Card>
            </View>
          )}

          {/* Tab Filter Row */}
          <View style={styles.tabsRow}>
            {(
              [
                "ALL",
                "FAILED",
                "MANUAL_REVIEW",
                "RETRYABLE",
                "RECOVERED",
              ] as FilterTab[]
            ).map((tab) => (
              <Pressable
                key={tab}
                style={[
                  styles.tabButton,
                  activeTab === tab && styles.tabButtonActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "MANUAL_REVIEW"
                    ? "Review"
                    : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Palette.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by eventId, correlationId, entityId..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={loadData}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Palette.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Event Cards List */}
          {events.length === 0 ? (
            <EmptyState
              title="No Recovery Events"
              message="No failed or review-pending events match the current filter."
              action={<Button title="Sync Executions" onPress={onRefresh} />}
            />
          ) : (
            events.map((item) => (
              <Card key={item._id} style={styles.eventCard}>
                {/* Header */}
                <View style={styles.eventCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.idRow}>
                      <Text style={styles.recoveryIdText}>
                        {item.recoveryId}
                      </Text>
                      <Badge
                        variant={STATE_BADGE_VARIANTS[item.state] || "neutral"}
                        label={item.state}
                      />
                    </View>
                    <Text style={styles.eventTypeTitle}>{item.eventType}</Text>
                  </View>
                  <Badge
                    variant={
                      CATEGORY_BADGE_VARIANTS[item.failureCategory] || "neutral"
                    }
                    label={item.failureCategory.replace(/_/g, " ")}
                  />
                </View>

                {/* Error Summary */}
                {item.failureReason ? (
                  <View style={styles.failureBox}>
                    <Ionicons
                      name="warning-outline"
                      size={14}
                      color={Palette.error}
                    />
                    <Text style={styles.failureReasonText} numberOfLines={2}>
                      {item.failureReason}
                    </Text>
                  </View>
                ) : null}

                {/* Entity & Metadata Row */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Entity:</Text>
                  <Text style={styles.metaVal}>
                    {item.entityType || "general"} (
                    {item.entityId ? item.entityId.substring(0, 14) : "N/A"})
                  </Text>
                  <Text style={[styles.metaLabel, { marginLeft: Spacing.md }]}>
                    Replays:
                  </Text>
                  <Text style={styles.metaVal}>
                    {item.replayCount} / {item.maxReplays}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Correlation ID:</Text>
                  <Text style={[styles.metaVal, { fontSize: 11 }]}>
                    {item.correlationId || "N/A"}
                  </Text>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.actionRow}>
                  <Button
                    title="Inspect & Validate"
                    onPress={() => handleInspect(item)}
                    variant="outline"
                    fullWidth={false}
                  />

                  {item.state !== "RECOVERED" && (
                    <Button
                      title="Safe Replay"
                      onPress={() => handleOpenReplayModal(item)}
                      variant="primary"
                      fullWidth={false}
                    />
                  )}

                  {item.state === "FAILED" && (
                    <Button
                      title="Review"
                      onPress={() => {
                        setReviewingEvent(item);
                        setReviewNotes("");
                      }}
                      variant="ghost"
                      fullWidth={false}
                    />
                  )}

                  {!item.linkedIncidentId && (
                    <Button
                      title="Incident"
                      onPress={() => handleLinkIncident(item)}
                      variant="ghost"
                      fullWidth={false}
                    />
                  )}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* MODAL 1: INSPECTION & SAFETY VALIDATION */}
      <Modal
        visible={!!inspectingEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectingEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Event Inspection & Safety Report
                </Text>
                <Text style={styles.modalSub}>
                  {inspectingEvent?.recoveryId}
                </Text>
              </View>
              <Pressable onPress={() => setInspectingEvent(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {inspectingEvent && (
              <ScrollView style={styles.modalBody}>
                {/* Event Details */}
                <Card style={styles.inspectSectionCard}>
                  <Text style={styles.sectionHeader}>Event Overview</Text>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Event Type:</Text>
                    <Text style={styles.inspectValue}>
                      {inspectingEvent.eventType}
                    </Text>
                  </View>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Event ID:</Text>
                    <Text style={styles.inspectValue}>
                      {inspectingEvent.eventId}
                    </Text>
                  </View>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Current State:</Text>
                    <Badge
                      variant={
                        STATE_BADGE_VARIANTS[inspectingEvent.state] || "neutral"
                      }
                      label={inspectingEvent.state}
                    />
                  </View>
                  <View style={styles.inspectRow}>
                    <Text style={styles.inspectLabel}>Failure Category:</Text>
                    <Badge
                      variant={
                        CATEGORY_BADGE_VARIANTS[
                          inspectingEvent.failureCategory
                        ] || "neutral"
                      }
                      label={inspectingEvent.failureCategory}
                    />
                  </View>
                </Card>

                {/* Live Verified Business State */}
                <Card
                  style={[
                    styles.inspectSectionCard,
                    { borderLeftWidth: 4, borderLeftColor: Palette.info },
                  ]}
                >
                  <Text style={styles.sectionHeader}>
                    Verified Real-World Business State
                  </Text>
                  <Text style={styles.inspectSub}>
                    Live database verification of the affected entity:
                  </Text>
                  {inspectingEvent.currentBusinessState ? (
                    <View style={styles.jsonBox}>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(
                          inspectingEvent.currentBusinessState,
                          null,
                          2,
                        )}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.inspectSub}>
                      No active entity state returned.
                    </Text>
                  )}
                </Card>

                {/* 9 Safety Validation Checks */}
                <Card
                  style={[
                    styles.inspectSectionCard,
                    { borderLeftWidth: 4, borderLeftColor: Palette.success },
                  ]}
                >
                  <Text style={styles.sectionHeader}>
                    9-Step Replay Safety Validation
                  </Text>
                  {validating ? (
                    <Loading
                      label="Running safety validation pipeline..."
                      fullScreen={false}
                    />
                  ) : validationResult ? (
                    <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
                      <View style={styles.valRow}>
                        <Ionicons
                          name={
                            validationResult.eligible
                              ? "checkmark-circle"
                              : "alert-circle"
                          }
                          size={18}
                          color={
                            validationResult.eligible
                              ? Palette.success
                              : Palette.error
                          }
                        />
                        <Text style={styles.valText}>
                          Replay Eligible:{" "}
                          {validationResult.eligible ? "YES" : "NO"}
                        </Text>
                      </View>

                      {validationResult.duplicateDetected && (
                        <View style={styles.duplicateWarningBox}>
                          <Ionicons
                            name="shield"
                            size={16}
                            color={Palette.error}
                          />
                          <Text style={styles.duplicateWarningText}>
                            DUPLICATE DETECTED: The underlying entity
                            transaction already succeeded in the database. Blind
                            replay is blocked to protect financial & medical
                            data.
                          </Text>
                        </View>
                      )}

                      <View style={styles.valRow}>
                        <Ionicons
                          name="key"
                          size={16}
                          color={Palette.textMuted}
                        />
                        <Text style={[styles.valText, { fontSize: 11 }]}>
                          SHA-256 Token:{" "}
                          {validationResult.idempotencyKey.substring(0, 16)}...
                        </Text>
                      </View>

                      <View style={styles.valRow}>
                        <Ionicons
                          name="arrow-forward-circle"
                          size={16}
                          color={Palette.primary}
                        />
                        <Text style={styles.valText}>
                          Recommended Action: {validationResult.suggestedAction}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </Card>

                {/* Replay History Timeline */}
                <Card style={styles.inspectSectionCard}>
                  <Text style={styles.sectionHeader}>
                    Immutable Replay Audit History (
                    {inspectingEvent.replays.length})
                  </Text>
                  {inspectingEvent.replays.length === 0 ? (
                    <Text
                      style={[styles.inspectSub, { marginTop: Spacing.xs }]}
                    >
                      No replay attempts executed yet.
                    </Text>
                  ) : (
                    inspectingEvent.replays.map((rep, idx) => (
                      <View key={rep._id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.timelineActor}>
                            {rep.actorName}
                          </Text>
                          <Text style={styles.timelineDate}>
                            {new Date(rep.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Text style={styles.timelineReason}>
                          Reason: "{rep.reason}"
                        </Text>
                        <View style={styles.timelineFooter}>
                          <Text style={styles.timelineAction}>
                            Action: {rep.actionAttempted}
                          </Text>
                          <Text style={styles.timelineState}>
                            {rep.previousState} → {rep.currentState}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </Card>

                {/* Bottom Action inside Inspection */}
                <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                  <Button
                    title="Proceed to Safe Replay"
                    onPress={() => {
                      const ev = inspectingEvent;
                      setInspectingEvent(null);
                      handleOpenReplayModal(ev);
                    }}
                  />
                  <Button
                    title="Close"
                    variant="outline"
                    onPress={() => setInspectingEvent(null)}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: SAFE REPLAY EXECUTION CONFIRMATION */}
      <Modal
        visible={!!replayingEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setReplayingEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Authorized Event Replay</Text>
                <Text style={styles.modalSub}>
                  {replayingEvent?.recoveryId}
                </Text>
              </View>
              <Pressable onPress={() => setReplayingEvent(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {replayingEvent && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.warningBox}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={Palette.info}
                  />
                  <Text style={styles.warningText}>
                    Replay acquires a temporary 60s concurrency lock and
                    validates that no duplicate appointments, orders, or
                    prescriptions are created.
                  </Text>
                </View>

                <Text style={styles.inputTitle}>Select Recovery Action:</Text>
                <View style={styles.actionTypeRow}>
                  <Pressable
                    style={[
                      styles.actionTypeOption,
                      replayActionType === "RETRY_EVENT" &&
                        styles.actionTypeOptionActive,
                    ]}
                    onPress={() => setReplayActionType("RETRY_EVENT")}
                  >
                    <Text
                      style={[
                        styles.actionTypeOptionText,
                        replayActionType === "RETRY_EVENT" &&
                          styles.actionTypeOptionTextActive,
                      ]}
                    >
                      Safe Replay Workflow
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionTypeOption,
                      replayActionType === "MARK_RECOVERED" &&
                        styles.actionTypeOptionActive,
                    ]}
                    onPress={() => setReplayActionType("MARK_RECOVERED")}
                  >
                    <Text
                      style={[
                        styles.actionTypeOptionText,
                        replayActionType === "MARK_RECOVERED" &&
                          styles.actionTypeOptionTextActive,
                      ]}
                    >
                      Mark Recovered (State Verified)
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.inputTitle}>
                  Operator Reason for Recovery{" "}
                  <Text style={{ color: Palette.error }}>*</Text>:
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. Verified payment webhook arrived late; safe notification retry requested."
                  value={replayReason}
                  onChangeText={setReplayReason}
                />

                <Button
                  title={
                    executingReplay
                      ? "Executing Safe Recovery..."
                      : "Confirm & Execute Recovery"
                  }
                  onPress={handleExecuteReplay}
                  loading={executingReplay}
                  style={{ marginTop: Spacing.lg }}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: MANUAL REVIEW ROUTING */}
      <Modal
        visible={!!reviewingEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewingEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Route to Manual Review</Text>
                <Text style={styles.modalSub}>
                  {reviewingEvent?.recoveryId}
                </Text>
              </View>
              <Pressable onPress={() => setReviewingEvent(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            {reviewingEvent && (
              <View style={styles.modalBody}>
                <Text style={styles.inputTitle}>Operational Review Notes:</Text>
                <TextInput
                  style={styles.reasonInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Specify findings, missing consent, or required supervisor intervention..."
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                />

                <Button
                  title={
                    savingReview ? "Routing..." : "Route Event to Manual Review"
                  }
                  onPress={handleSaveManualReview}
                  loading={savingReview}
                  style={{ marginTop: Spacing.lg }}
                />
              </View>
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
    marginBottom: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: "30%",
    padding: Spacing.md,
    alignItems: "center",
  },
  kpiValue: {
    ...Typography.h2,
    fontWeight: "700",
  },
  kpiLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
    fontSize: 11,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 11,
  },
  tabTextActive: {
    color: Palette.primary,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    ...Typography.bodyMedium,
    color: Palette.text,
  },
  eventCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  eventCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  recoveryIdText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
  },
  eventTypeTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  failureBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
  },
  failureReasonText: {
    ...Typography.bodySmall,
    color: "#991B1B",
    fontSize: 11,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  metaLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 11,
  },
  metaVal: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    fontSize: 11,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
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
    maxHeight: "90%",
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
  inspectSectionCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    ...Typography.h4,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  inspectSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 12,
  },
  inspectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  inspectLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  inspectValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  jsonBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Palette.text,
  },
  valRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  duplicateWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: 4,
  },
  duplicateWarningText: {
    ...Typography.bodySmall,
    color: "#991B1B",
    fontSize: 11,
    flex: 1,
  },
  timelineItem: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineActor: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  timelineDate: {
    ...Typography.bodySmall,
    fontSize: 10,
    color: Palette.textMuted,
  },
  timelineReason: {
    ...Typography.bodySmall,
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  timelineFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timelineAction: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.primary,
  },
  timelineState: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  warningText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 11,
    flex: 1,
  },
  inputTitle: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  actionTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionTypeOption: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: "center",
  },
  actionTypeOptionActive: {
    borderColor: Palette.primary,
    backgroundColor: "#EFF6FF",
  },
  actionTypeOptionText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  actionTypeOptionTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  reasonInput: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.bodyMedium,
    color: Palette.text,
    textAlignVertical: "top",
    minHeight: 80,
  },
});
