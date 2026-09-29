/**
 * HealPoint - Super Admin · System Reliability & Observability Center.
 *
 * Provides real-time health diagnostics across all 12 platform subsystems,
 * live API telemetry, incident detection & resolution, and correlation-traced
 * operational error exploration.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatISODate } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as observabilityService from "@/services/observability";
import { subscribeToNotificationSync } from "@/services/socket";
import type {
  ApiTelemetrySummary,
  ServiceHealthItem,
  SystemErrorLogItem,
  SystemHealthResponse,
  SystemIncident,
} from "@/types";

type ObservabilityTab = "services" | "telemetry" | "incidents" | "errors";

const TABS: {
  id: ObservabilityTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "services", label: "Services", icon: "hardware-chip-outline" },
  { id: "telemetry", label: "Telemetry", icon: "stats-chart-outline" },
  { id: "incidents", label: "Incidents", icon: "alert-circle-outline" },
  { id: "errors", label: "Error Logs", icon: "bug-outline" },
];

function statusColor(status?: string): {
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  const s = String(status || "").toLowerCase();
  if (s === "operational" || s === "healthy" || s === "resolved") {
    return {
      color: Palette.success,
      bg: "rgba(46, 158, 91, 0.12)",
      icon: "checkmark-circle",
    };
  }
  if (
    s === "attention required" ||
    s === "degraded" ||
    s === "acknowledged" ||
    s === "medium"
  ) {
    return { color: "#D97706", bg: "rgba(217, 119, 6, 0.12)", icon: "warning" };
  }
  if (
    s === "unavailable" ||
    s === "critical" ||
    s === "high" ||
    s === "detected"
  ) {
    return {
      color: Palette.error,
      bg: "rgba(239, 68, 68, 0.12)",
      icon: "close-circle",
    };
  }
  return {
    color: Palette.textMuted,
    bg: "rgba(95, 111, 108, 0.12)",
    icon: "help-circle",
  };
}

export default function ReliabilityCenterScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ObservabilityTab>("services");

  // Health data
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(
    null,
  );
  const [telemetryData, setTelemetryData] =
    useState<ApiTelemetrySummary | null>(null);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [errors, setErrors] = useState<SystemErrorLogItem[]>([]);

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Incidents filter
  const [incidentFilter, setIncidentFilter] = useState<
    "all" | "active" | "resolved"
  >("active");

  // Error search
  const [errorSearch, setErrorSearch] = useState("");

  // Resolve Modal State
  const [resolveTarget, setResolveTarget] = useState<SystemIncident | null>(
    null,
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg("");
    try {
      const [hRes, tRes, iRes, eRes] = await Promise.all([
        observabilityService.getSystemHealth(),
        observabilityService
          .getApiTelemetry()
          .catch(() => ({ success: false, telemetry: null })),
        observabilityService.getSystemIncidents({ status: "all", limit: 30 }),
        observabilityService.getSystemErrors({ limit: 40 }),
      ]);

      if (hRes.success) setHealthData(hRes);
      if (tRes.telemetry) setTelemetryData(tRes.telemetry);
      if (iRes.incidents) setIncidents(iRes.incidents);
      if (eRes.errors) setErrors(eRes.errors);
    } catch (err) {
      setErrorMsg(
        toErrorMessage(err, "Failed to load system reliability data."),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time socket updates for newly detected incidents
  useEffect(() => {
    const unsubscribe = subscribeToNotificationSync((notif: any) => {
      if (notif?.type === "system_alert" || notif?.category === "security") {
        loadData(true);
      }
    });
    return unsubscribe;
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleAcknowledge = async (incident: SystemIncident) => {
    try {
      await observabilityService.acknowledgeIncident(
        incident.incidentId || incident._id,
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === incident.incidentId
            ? { ...i, status: "acknowledged" }
            : i,
        ),
      );
    } catch (err) {
      setErrorMsg(toErrorMessage(err, "Failed to acknowledge incident."));
    }
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    setResolveError("");
    try {
      await observabilityService.resolveIncident(
        resolveTarget.incidentId || resolveTarget._id,
        resolutionNotes,
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === resolveTarget.incidentId
            ? { ...i, status: "resolved", resolutionNotes }
            : i,
        ),
      );
      setResolveTarget(null);
      setResolutionNotes("");
    } catch (err) {
      setResolveError(toErrorMessage(err, "Failed to resolve incident."));
    } finally {
      setResolving(false);
    }
  };

  const filteredIncidents = useMemo(() => {
    if (incidentFilter === "active") {
      return incidents.filter(
        (i) => i.status !== "resolved" && i.status !== "closed",
      );
    }
    if (incidentFilter === "resolved") {
      return incidents.filter(
        (i) => i.status === "resolved" || i.status === "closed",
      );
    }
    return incidents;
  }, [incidents, incidentFilter]);

  const filteredErrors = useMemo(() => {
    const q = errorSearch.trim().toLowerCase();
    if (!q) return errors;
    return errors.filter(
      (e) =>
        e.route.toLowerCase().includes(q) ||
        e.sanitizedMessage.toLowerCase().includes(q) ||
        (e.correlationId && e.correlationId.toLowerCase().includes(q)),
    );
  }, [errors, errorSearch]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Palette.primary}
    />
  );

  return (
    <RoleRoute allowedRoles={["super_admin"]}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Reliability Center</Text>
            <Text style={styles.headerSubtitle}>
              System Health & Observability
            </Text>
          </View>

          {healthData ? (
            <View
              style={[
                styles.overallBadge,
                { backgroundColor: statusColor(healthData.overallStatus).bg },
              ]}
            >
              <Ionicons
                name={statusColor(healthData.overallStatus).icon}
                size={13}
                color={statusColor(healthData.overallStatus).color}
              />
              <Text
                style={[
                  styles.overallBadgeText,
                  { color: statusColor(healthData.overallStatus).color },
                ]}
              >
                {healthData.overallStatus}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            onPress={() => onRefresh()}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={Palette.primaryDark}
            />
          </Pressable>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const badgeCount =
                tab.id === "incidents"
                  ? incidents.filter((i) => i.status !== "resolved").length
                  : 0;

              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveTab(tab.id)}
                  style={({ pressed }) => [
                    styles.tabChip,
                    active && styles.tabChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? Palette.white : Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabChipText,
                      active && styles.tabChipTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {badgeCount > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{badgeCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab Body */}
        {loading ? (
          <Loading label="Inspecting platform diagnostics..." />
        ) : errorMsg ? (
          <ScrollView
            contentContainerStyle={styles.centerContainer}
            refreshControl={refreshControl}
          >
            <ErrorState message={errorMsg} onRetry={() => loadData()} />
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            {/* 1. SERVICES TAB */}
            {activeTab === "services" && (
              <ScrollView
                contentContainerStyle={styles.contentList}
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
              >
                {/* Summary Row */}
                {healthData ? (
                  <View style={styles.statsSummaryGrid}>
                    <View style={styles.summaryStatItem}>
                      <Text style={styles.summaryStatNum}>
                        {healthData.servicesCount}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Subsystems</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <Text
                        style={[
                          styles.summaryStatNum,
                          { color: Palette.success },
                        ]}
                      >
                        {healthData.operationalCount}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Operational</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <Text
                        style={[styles.summaryStatNum, { color: "#D97706" }]}
                      >
                        {healthData.degradedCount}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Degraded</Text>
                    </View>
                    <View style={styles.summaryStatItem}>
                      <Text
                        style={[
                          styles.summaryStatNum,
                          { color: Palette.error },
                        ]}
                      >
                        {healthData.unavailableCount}
                      </Text>
                      <Text style={styles.summaryStatLabel}>Down</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.sectionHeader}>
                  Platform Subsystem Health
                </Text>

                {healthData?.services?.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}

                <View style={{ height: Spacing.xl }} />
              </ScrollView>
            )}

            {/* 2. TELEMETRY TAB */}
            {activeTab === "telemetry" && (
              <ScrollView
                contentContainerStyle={styles.contentList}
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
              >
                {telemetryData ? (
                  <>
                    <Text style={styles.sectionHeader}>
                      Live API Performance Metrics
                    </Text>
                    <View style={styles.telemetryGrid}>
                      <Card style={styles.metricCard}>
                        <Text style={styles.metricVal}>
                          {telemetryData.totalRequests}
                        </Text>
                        <Text style={styles.metricLbl}>Total Requests</Text>
                      </Card>
                      <Card style={styles.metricCard}>
                        <Text
                          style={[styles.metricVal, { color: Palette.success }]}
                        >
                          {telemetryData.successRequests}
                        </Text>
                        <Text style={styles.metricLbl}>2xx/3xx Success</Text>
                      </Card>
                      <Card style={styles.metricCard}>
                        <Text style={[styles.metricVal, { color: "#D97706" }]}>
                          {telemetryData.clientErrors}
                        </Text>
                        <Text style={styles.metricLbl}>4xx Client Errors</Text>
                      </Card>
                      <Card style={styles.metricCard}>
                        <Text
                          style={[styles.metricVal, { color: Palette.error }]}
                        >
                          {telemetryData.serverErrors}
                        </Text>
                        <Text style={styles.metricLbl}>5xx Server Errors</Text>
                      </Card>
                      <Card style={styles.metricCard}>
                        <Text style={styles.metricVal}>
                          {telemetryData.avgLatencyMs}ms
                        </Text>
                        <Text style={styles.metricLbl}>Avg Latency</Text>
                      </Card>
                      <Card style={styles.metricCard}>
                        <Text style={styles.metricVal}>
                          {telemetryData.p95LatencyMs}ms
                        </Text>
                        <Text style={styles.metricLbl}>P95 Latency</Text>
                      </Card>
                    </View>

                    {/* Status Code Distribution */}
                    <Text
                      style={[styles.sectionHeader, { marginTop: Spacing.lg }]}
                    >
                      HTTP Status Code Distribution
                    </Text>
                    <Card style={styles.distributionCard}>
                      <View style={styles.distributionRow}>
                        {Object.entries(telemetryData.statusDistribution).map(
                          ([code, count]) => {
                            const num = Number(code);
                            const color =
                              num < 400
                                ? Palette.success
                                : num < 500
                                  ? "#D97706"
                                  : Palette.error;
                            return (
                              <View key={code} style={styles.distributionPill}>
                                <Text
                                  style={[styles.distributionCode, { color }]}
                                >
                                  {code}
                                </Text>
                                <Text style={styles.distributionCount}>
                                  {count} reqs
                                </Text>
                              </View>
                            );
                          },
                        )}
                      </View>
                    </Card>

                    {/* Active Routes */}
                    {telemetryData.topRoutes?.length ? (
                      <>
                        <Text
                          style={[
                            styles.sectionHeader,
                            { marginTop: Spacing.lg },
                          ]}
                        >
                          Top Request Routes
                        </Text>
                        {telemetryData.topRoutes.map((r) => (
                          <Card key={r.path} style={styles.routeCard}>
                            <View style={styles.routeHeader}>
                              <Text style={styles.routePath}>{r.path}</Text>
                              <Text style={styles.routeLatency}>
                                {r.avgLatencyMs}ms
                              </Text>
                            </View>
                            <View style={styles.routeFooter}>
                              <Text style={styles.routeDetail}>
                                {r.requests} requests
                              </Text>
                              <Text
                                style={[
                                  styles.routeDetail,
                                  r.errors > 0 && { color: Palette.error },
                                ]}
                              >
                                {r.errors} errors ({r.errorRatePct}%)
                              </Text>
                            </View>
                          </Card>
                        ))}
                      </>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    title="No telemetry collected yet"
                    message="Make API requests to start observing response times and error rates."
                  />
                )}
                <View style={{ height: Spacing.xl }} />
              </ScrollView>
            )}

            {/* 3. INCIDENTS TAB */}
            {activeTab === "incidents" && (
              <View style={styles.flex}>
                <View style={styles.filterBar}>
                  {(["active", "resolved", "all"] as const).map((filter) => (
                    <Pressable
                      key={filter}
                      onPress={() => setIncidentFilter(filter)}
                      style={[
                        styles.subFilterChip,
                        incidentFilter === filter && styles.subFilterChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subFilterText,
                          incidentFilter === filter &&
                            styles.subFilterTextActive,
                        ]}
                      >
                        {filter.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {filteredIncidents.length === 0 ? (
                  <ScrollView
                    contentContainerStyle={styles.centerContainer}
                    refreshControl={refreshControl}
                  >
                    <EmptyState
                      title="No incidents detected"
                      message="All platform services are running without active operational alerts."
                    />
                  </ScrollView>
                ) : (
                  <FlatList
                    data={filteredIncidents}
                    keyExtractor={(item) => item.incidentId || item._id}
                    renderItem={({ item }) => (
                      <IncidentCard
                        incident={item}
                        onAcknowledge={() => handleAcknowledge(item)}
                        onResolve={() => {
                          setResolveTarget(item);
                          setResolutionNotes("");
                          setResolveError("");
                        }}
                      />
                    )}
                    refreshControl={refreshControl}
                    contentContainerStyle={styles.contentList}
                    ItemSeparatorComponent={() => (
                      <View style={styles.separator} />
                    )}
                  />
                )}
              </View>
            )}

            {/* 4. ERRORS TAB */}
            {activeTab === "errors" && (
              <View style={styles.flex}>
                <View style={styles.searchWrap}>
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={Palette.textMuted}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by route, correlation ID, or message..."
                    placeholderTextColor={Palette.textMuted}
                    value={errorSearch}
                    onChangeText={setErrorSearch}
                  />
                  {errorSearch ? (
                    <Pressable onPress={() => setErrorSearch("")} hitSlop={6}>
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={Palette.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>

                {filteredErrors.length === 0 ? (
                  <ScrollView
                    contentContainerStyle={styles.centerContainer}
                    refreshControl={refreshControl}
                  >
                    <EmptyState
                      title="No error logs captured"
                      message="Recent operations completed cleanly without 4xx/5xx exceptions."
                    />
                  </ScrollView>
                ) : (
                  <FlatList
                    data={filteredErrors}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => <ErrorLogCard errorItem={item} />}
                    refreshControl={refreshControl}
                    contentContainerStyle={styles.contentList}
                    ItemSeparatorComponent={() => (
                      <View style={styles.separator} />
                    )}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* Incident Resolution Modal */}
        <Modal
          visible={Boolean(resolveTarget)}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setResolveTarget(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Resolve Incident</Text>
              <Text style={styles.modalSubtitle}>
                {resolveTarget?.incidentId}: {resolveTarget?.title}
              </Text>

              {resolveError ? (
                <FormMessage type="error" message={resolveError} />
              ) : null}

              <Text style={styles.inputLabel}>Resolution Notes</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={3}
                placeholder="Explain the fix or root cause..."
                placeholderTextColor={Palette.textMuted}
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setResolveTarget(null)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Mark Resolved"
                  variant="primary"
                  loading={resolving}
                  onPress={submitResolve}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleRoute>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------
function ServiceCard({ service }: { service: ServiceHealthItem }) {
  const visual = statusColor(service.status);
  return (
    <Card style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceTitleGroup}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.serviceCategory}>{service.category}</Text>
        </View>
        <View
          style={[styles.serviceStatusPill, { backgroundColor: visual.bg }]}
        >
          <Ionicons name={visual.icon} size={12} color={visual.color} />
          <Text style={[styles.serviceStatusText, { color: visual.color }]}>
            {service.status}
          </Text>
        </View>
      </View>

      <View style={styles.serviceDetails}>
        {service.latencyMs !== undefined ? (
          <Text style={styles.serviceLatency}>Ping: {service.latencyMs}ms</Text>
        ) : null}
        {service.details ? (
          <View style={styles.detailsList}>
            {Object.entries(service.details).map(([k, v]) => (
              <Text key={k} style={styles.detailItem} numberOfLines={1}>
                <Text style={{ fontWeight: "700" }}>{k}:</Text> {String(v)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function IncidentCard({
  incident,
  onAcknowledge,
  onResolve,
}: {
  incident: SystemIncident;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const sevVisual = statusColor(incident.severity);
  const isResolved =
    incident.status === "resolved" || incident.status === "closed";
  const isAcknowledged = incident.status === "acknowledged";

  return (
    <Card
      style={[
        styles.incidentCard,
        { borderLeftColor: sevVisual.color, borderLeftWidth: 4 },
      ]}
    >
      <View style={styles.incidentHeader}>
        <View style={styles.incidentIdRow}>
          <Text style={styles.incidentId}>{incident.incidentId}</Text>
          <View style={[styles.badgePill, { backgroundColor: sevVisual.bg }]}>
            <Text style={[styles.badgePillText, { color: sevVisual.color }]}>
              {incident.severity.toUpperCase()}
            </Text>
          </View>
          <View
            style={[
              styles.badgePill,
              { backgroundColor: "rgba(14, 159, 142, 0.1)" },
            ]}
          >
            <Text
              style={[styles.badgePillText, { color: Palette.primaryDark }]}
            >
              {incident.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.incidentTime}>
          {formatISODate(incident.lastSeenAt)}
        </Text>
      </View>

      <Text style={styles.incidentTitle}>{incident.title}</Text>
      {incident.affectedOperation ? (
        <Text style={styles.incidentOperation}>
          Endpoint: {incident.affectedOperation}
        </Text>
      ) : null}

      {incident.lastErrorSnippet ? (
        <View style={styles.snippetWrap}>
          <Text style={styles.snippetText} numberOfLines={2}>
            {incident.lastErrorSnippet}
          </Text>
        </View>
      ) : null}

      {incident.correlationIds?.length ? (
        <View style={styles.correlationWrap}>
          <Ionicons
            name="git-commit-outline"
            size={12}
            color={Palette.textMuted}
          />
          <Text style={styles.correlationText} numberOfLines={1}>
            ID: {incident.correlationIds[0]}
          </Text>
        </View>
      ) : null}

      {!isResolved ? (
        <View style={styles.incidentActions}>
          {!isAcknowledged ? (
            <Button
              title="Acknowledge"
              variant="outline"
              onPress={onAcknowledge}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            title="Resolve Incident"
            variant="primary"
            onPress={onResolve}
            style={{ flex: 1 }}
          />
        </View>
      ) : incident.resolutionNotes ? (
        <Text style={styles.resolutionNotes}>
          Resolved: {incident.resolutionNotes}
        </Text>
      ) : null}
    </Card>
  );
}

function ErrorLogCard({ errorItem }: { errorItem: SystemErrorLogItem }) {
  const isServer = errorItem.statusCode >= 500;
  return (
    <Card style={styles.errorCard}>
      <View style={styles.errorTop}>
        <View style={styles.methodStatusWrap}>
          <Text style={styles.methodText}>{errorItem.method}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isServer
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(217, 119, 6, 0.1)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusCode,
                { color: isServer ? Palette.error : "#D97706" },
              ]}
            >
              {errorItem.statusCode}
            </Text>
          </View>
        </View>
        <Text style={styles.errorCategory}>{errorItem.errorCategory}</Text>
      </View>

      <Text style={styles.errorRoute}>{errorItem.route}</Text>
      <Text style={styles.errorMessage} numberOfLines={3}>
        {errorItem.sanitizedMessage}
      </Text>

      <View style={styles.errorMeta}>
        <Text style={styles.errorTime}>
          {formatISODate(errorItem.occurredAt)}
        </Text>
        {errorItem.correlationId ? (
          <View style={styles.correlationChip}>
            <Ionicons
              name="link-outline"
              size={11}
              color={Palette.primaryDark}
            />
            <Text style={styles.correlationIdText}>
              {errorItem.correlationId}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  centerContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  overallBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  overallBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  tabBar: {
    paddingBottom: Spacing.sm,
  },
  tabScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: Palette.error,
    borderRadius: Radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  contentList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.sm,
  },
  sectionHeader: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginVertical: Spacing.sm,
  },
  statsSummaryGrid: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryStatItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryStatNum: {
    ...Typography.h4,
    color: Palette.text,
  },
  summaryStatLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  serviceCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  serviceTitleGroup: {
    flex: 1,
  },
  serviceName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  serviceCategory: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  serviceStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  serviceStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  serviceDetails: {
    marginTop: Spacing.xs,
  },
  serviceLatency: {
    fontSize: 11,
    color: Palette.primaryDark,
    fontWeight: "600",
    marginBottom: 4,
  },
  detailsList: {
    gap: 2,
  },
  detailItem: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  metricCard: {
    width: "48%",
    padding: Spacing.md,
    alignItems: "center",
  },
  metricVal: {
    ...Typography.h3,
    color: Palette.text,
  },
  metricLbl: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  distributionCard: {
    padding: Spacing.md,
  },
  distributionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  distributionPill: {
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  distributionCode: {
    fontSize: 12,
    fontWeight: "700",
  },
  distributionCount: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  routeCard: {
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routePath: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  routeLatency: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  routeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  routeDetail: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  filterBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  subFilterChip: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  subFilterChipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  subFilterText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  subFilterTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  incidentCard: {
    padding: Spacing.md,
  },
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  incidentIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  incidentId: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  incidentTime: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  incidentTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 4,
  },
  incidentOperation: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  snippetWrap: {
    backgroundColor: Palette.background,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: 6,
  },
  snippetText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: Palette.textMuted,
  },
  correlationWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  correlationText: {
    fontSize: 10,
    color: Palette.textMuted,
    fontFamily: "monospace",
  },
  incidentActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  resolutionNotes: {
    ...Typography.caption,
    color: Palette.success,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    marginLeft: Spacing.xs,
  },
  errorCard: {
    padding: Spacing.md,
  },
  errorTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  methodStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  methodText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  statusCode: {
    fontSize: 11,
    fontWeight: "700",
  },
  errorCategory: {
    fontSize: 11,
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  errorRoute: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  errorMessage: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  errorMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  errorTime: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  correlationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  correlationIdText: {
    fontSize: 10,
    color: Palette.primaryDark,
    fontFamily: "monospace",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  notesInput: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    fontSize: 13,
    color: Palette.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
