/**
 * HealPoint - Super Admin Healthcare Interoperability & Secure Data Exchange Center.
 *
 * Enterprise interoperability and healthcare data exchange console for Super Admins.
 * Connects directly to backend /interoperability endpoints.
 * Supports External Systems, Connection Health, Mapping & Validation, Consent-First Gates,
 * Exchange History, Failed Exchanges Recovery, Security & Audit Trail.
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

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { RoleRoute } from "@/components/RoleRoute";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { toErrorMessage } from "@/services/api";
import * as interopService from "@/services/interoperability";
import type {
  ConnectionStatus,
  ExchangeErrorCategory,
  ExchangeResourceType,
  ExchangeStatus,
  ExternalHealthcareSystem,
  ExternalSystemType,
  InteroperabilityExchange,
  InteroperabilityMapping,
  InteroperabilityStats,
} from "@/types";

type InteropTab =
  | "systems"
  | "connections"
  | "exchange"
  | "mappings"
  | "history"
  | "failed"
  | "security";

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Never";
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return isoString;
  }
}

export default function InteroperabilityScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<InteropTab>("systems");
  const [stats, setStats] = useState<InteroperabilityStats | null>(null);
  const [systems, setSystems] = useState<ExternalHealthcareSystem[]>([]);
  const [mappings, setMappings] = useState<InteroperabilityMapping[]>([]);
  const [exchanges, setExchanges] = useState<InteroperabilityExchange[]>([]);
  const [failedExchanges, setFailedExchanges] = useState<
    InteroperabilityExchange[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Action states
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] =
    useState<InteroperabilityExchange | null>(null);

  // New system form state
  const [newSystemKey, setNewSystemKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newType, setNewType] = useState<ExternalSystemType>("Hospital");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newHealthUrl, setNewHealthUrl] = useState("");
  const [newCredential, setNewCredential] = useState("");
  const [submittingSystem, setSubmittingSystem] = useState(false);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [statsRes, systemsRes, mappingsRes, exchangesRes, failedRes] =
        await Promise.all([
          interopService.getInteroperabilityStats().catch(() => null),
          interopService.getSystemRegistry().catch(() => null),
          interopService.getMappings().catch(() => null),
          interopService.getAllExchanges({ limit: 30 }).catch(() => null),
          interopService.getFailedExchanges().catch(() => null),
        ]);

      if (statsRes?.stats) setStats(statsRes.stats);
      if (systemsRes?.systems) setSystems(systemsRes.systems);
      if (mappingsRes?.mappings) setMappings(mappingsRes.mappings);
      if (exchangesRes?.exchanges) setExchanges(exchangesRes.exchanges);
      if (failedRes?.failedExchanges)
        setFailedExchanges(failedRes.failedExchanges);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ping action
  const handlePing = async (systemId: string, systemName: string) => {
    setPingingId(systemId);
    try {
      const res = await interopService.pingExternalSystem(systemId);
      Alert.alert(
        "Ping Result",
        `System: ${systemName}\nStatus: ${res.healthResult.status.toUpperCase()}\nLatency: ${res.healthResult.latencyMs} ms\nMessage: ${res.healthResult.message}`,
      );
      loadData(true);
    } catch (err) {
      Alert.alert("Ping Failed", toErrorMessage(err));
    } finally {
      setPingingId(null);
    }
  };

  // Toggle enable/disable
  const handleToggleStatus = async (system: ExternalHealthcareSystem) => {
    const nextStatus: ConnectionStatus =
      system.connectionStatus === "disabled" ? "configured" : "disabled";
    try {
      await interopService.updateExternalSystem(system._id, {
        connectionStatus: nextStatus,
      });
      Alert.alert(
        "Status Updated",
        `System '${system.name}' is now ${nextStatus}.`,
      );
      loadData(true);
    } catch (err) {
      Alert.alert("Update Failed", toErrorMessage(err));
    }
  };

  // Retry exchange action
  const handleRetry = async (exchangeId: string) => {
    setRetryingId(exchangeId);
    try {
      const res = await interopService.retryExchange(exchangeId);
      Alert.alert("Retry Triggered", res.message || "Exchange retry executed.");
      loadData(true);
    } catch (err) {
      Alert.alert("Retry Failed", toErrorMessage(err));
    } finally {
      setRetryingId(null);
    }
  };

  // Submit register new system
  const handleRegisterSubmit = async () => {
    if (!newSystemKey.trim() || !newName.trim() || !newOrg.trim()) {
      Alert.alert(
        "Validation Error",
        "Please provide System Key, Name, and Organization.",
      );
      return;
    }

    setSubmittingSystem(true);
    try {
      await interopService.registerExternalSystem({
        systemKey: newSystemKey.trim(),
        name: newName.trim(),
        organization: newOrg.trim(),
        systemType: newType,
        endpointUrl: newEndpoint.trim(),
        healthCheckUrl: newHealthUrl.trim(),
        rawCredential: newCredential.trim(),
      });

      Alert.alert(
        "Success",
        "External healthcare system registered successfully.",
      );
      setShowAddModal(false);
      setNewSystemKey("");
      setNewName("");
      setNewOrg("");
      setNewEndpoint("");
      setNewHealthUrl("");
      setNewCredential("");
      loadData(true);
    } catch (err) {
      Alert.alert("Registration Failed", toErrorMessage(err));
    } finally {
      setSubmittingSystem(false);
    }
  };

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return <Badge label="CONNECTED" variant="success" />;
      case "configured":
        return <Badge label="CONFIGURED" variant="primary" />;
      case "not_configured":
        return <Badge label="NOT CONFIGURED" variant="neutral" />;
      case "failed":
        return <Badge label="FAILED" variant="error" />;
      case "disabled":
        return <Badge label="DISABLED" variant="neutral" />;
      default:
        return <Badge label={String(status).toUpperCase()} variant="neutral" />;
    }
  };

  const getExchangeStatusBadge = (status: ExchangeStatus) => {
    switch (status) {
      case "processed":
      case "accepted":
        return <Badge label={status.toUpperCase()} variant="success" />;
      case "validating":
      case "authorized":
      case "sending":
      case "received":
        return <Badge label={status.toUpperCase()} variant="primary" />;
      case "conflict":
        return <Badge label="CONFLICT" variant="warning" />;
      case "failed":
      case "rejected":
        return <Badge label={status.toUpperCase()} variant="error" />;
      default:
        return <Badge label={status.toUpperCase()} variant="neutral" />;
    }
  };

  return (
    <RoleRoute allowedRoles={["super_admin"]}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <DrawerToggleButton />
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Interoperability Center</Text>
              <Text style={styles.subtitle}>
                Secure Healthcare Data Exchange & External Systems
              </Text>
            </View>
            <Pressable
              onPress={() => setShowAddModal(true)}
              style={styles.addButton}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Register</Text>
            </Pressable>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
          >
            <Pressable
              onPress={() => setActiveTab("systems")}
              style={[
                styles.tabItem,
                activeTab === "systems" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="business-outline"
                size={16}
                color={
                  activeTab === "systems" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "systems" && styles.tabTextActive,
                ]}
              >
                Systems ({systems.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("connections")}
              style={[
                styles.tabItem,
                activeTab === "connections" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="pulse-outline"
                size={16}
                color={
                  activeTab === "connections"
                    ? Palette.primary
                    : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "connections" && styles.tabTextActive,
                ]}
              >
                Connections
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("exchange")}
              style={[
                styles.tabItem,
                activeTab === "exchange" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={
                  activeTab === "exchange" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "exchange" && styles.tabTextActive,
                ]}
              >
                Data Exchange
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("mappings")}
              style={[
                styles.tabItem,
                activeTab === "mappings" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="git-compare-outline"
                size={16}
                color={
                  activeTab === "mappings" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "mappings" && styles.tabTextActive,
                ]}
              >
                Mappings ({mappings.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("history")}
              style={[
                styles.tabItem,
                activeTab === "history" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={
                  activeTab === "history" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "history" && styles.tabTextActive,
                ]}
              >
                History ({exchanges.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("failed")}
              style={[
                styles.tabItem,
                activeTab === "failed" && styles.tabItemActive,
              ]}
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
                  failedExchanges.length > 0 && { color: Palette.error },
                ]}
              >
                Failed ({failedExchanges.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("security")}
              style={[
                styles.tabItem,
                activeTab === "security" && styles.tabItemActive,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={
                  activeTab === "security" ? Palette.primary : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "security" && styles.tabTextActive,
                ]}
              >
                Security & Audit
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {loading ? (
          <Loading label="Loading Interoperability Center..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.contentScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
                tintColor={Palette.primary}
              />
            }
          >
            {/* Top Operational Metrics Banner */}
            {stats && (
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Total Exchanges</Text>
                  <Text style={styles.metricValue}>{stats.totalExchanges}</Text>
                  <Text style={styles.metricSub}>
                    {stats.inboundCount} In / {stats.outboundCount} Out
                  </Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Success Rate</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          stats.successRate >= 90
                            ? Palette.success
                            : Palette.warning,
                      },
                    ]}
                  >
                    {stats.successRate}%
                  </Text>
                  <Text style={styles.metricSub}>
                    {stats.processedCount} Processed
                  </Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Active Systems</Text>
                  <Text style={styles.metricValue}>
                    {stats.activeSystemsCount}
                  </Text>
                  <Text style={styles.metricSub}>Registered Gateways</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Issues / Conflicts</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          stats.failedCount + stats.conflictCount > 0
                            ? Palette.error
                            : Palette.success,
                      },
                    ]}
                  >
                    {stats.failedCount + stats.conflictCount}
                  </Text>
                  <Text style={styles.metricSub}>
                    {stats.conflictCount} Conflicts
                  </Text>
                </View>
              </View>
            )}

            {/* TAB 1: EXTERNAL SYSTEMS REGISTRY */}
            {activeTab === "systems" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Registered External Systems
                  </Text>
                  <Text style={styles.sectionSub}>
                    Official laboratories, hospitals, diagnostic hubs, and EMR
                    gateways
                  </Text>
                </View>

                {systems.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons
                      name="medical-outline"
                      size={48}
                      color={Palette.textMuted}
                    />
                    <Text style={styles.emptyTitle}>
                      No External Systems Registered
                    </Text>
                    <Text style={styles.emptySub}>
                      Register an external healthcare partner using the
                      "Register" button above to enable secure data exchange.
                    </Text>
                  </Card>
                ) : (
                  systems.map((sys) => (
                    <Card key={sys._id} style={styles.systemCard}>
                      <View style={styles.systemCardHeader}>
                        <View style={styles.systemTitleBlock}>
                          <Text style={styles.systemName}>{sys.name}</Text>
                          <Text style={styles.systemMeta}>
                            {sys.organization} • {sys.systemType} • v
                            {sys.integrationVersion}
                          </Text>
                        </View>
                        {getStatusBadge(sys.connectionStatus)}
                      </View>

                      <View style={styles.systemDetailsRow}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailKey}>Key</Text>
                          <Text style={styles.detailVal}>{sys.systemKey}</Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailKey}>Auth</Text>
                          <Text style={styles.detailVal}>
                            {sys.authType.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailKey}>Credential</Text>
                          <Text style={styles.detailVal}>
                            {sys.maskedCredentialPreview}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailKey}>Direction</Text>
                          <Text style={styles.detailVal}>
                            {sys.supportedDirections}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.scopeChipsRow}>
                        {sys.supportedResources.map((res) => (
                          <View key={res} style={styles.scopeChip}>
                            <Text style={styles.scopeChipText}>{res}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.systemActionRow}>
                        <Pressable
                          style={[styles.smallBtn, styles.pingBtn]}
                          onPress={() => handlePing(sys._id, sys.name)}
                          disabled={pingingId === sys._id}
                        >
                          {pingingId === sys._id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons
                                name="pulse"
                                size={14}
                                color="#FFFFFF"
                              />
                              <Text style={styles.smallBtnText}>
                                Health Ping
                              </Text>
                            </>
                          )}
                        </Pressable>

                        <Pressable
                          style={[
                            styles.smallBtn,
                            sys.connectionStatus === "disabled"
                              ? styles.enableBtn
                              : styles.disableBtn,
                          ]}
                          onPress={() => handleToggleStatus(sys)}
                        >
                          <Text style={styles.smallBtnText}>
                            {sys.connectionStatus === "disabled"
                              ? "Enable"
                              : "Disable"}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB 2: CONNECTIONS & HEALTH */}
            {activeTab === "connections" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Connection Management & Connectivity
                  </Text>
                  <Text style={styles.sectionSub}>
                    Live ping metrics, endpoint configurations, and protocol
                    security
                  </Text>
                </View>

                {systems.map((sys) => (
                  <Card key={sys._id} style={styles.systemCard}>
                    <View style={styles.systemCardHeader}>
                      <View>
                        <Text style={styles.systemName}>{sys.name}</Text>
                        <Text style={styles.systemMeta}>
                          {sys.endpointUrl || "No endpoint configured"}
                        </Text>
                      </View>
                      {getStatusBadge(sys.connectionStatus)}
                    </View>

                    {sys.lastHealthCheckResult && (
                      <View style={styles.healthResultBox}>
                        <View style={styles.healthStatusRow}>
                          <Ionicons
                            name={
                              sys.lastHealthCheckResult.status === "healthy"
                                ? "checkmark-circle"
                                : "alert-circle"
                            }
                            size={18}
                            color={
                              sys.lastHealthCheckResult.status === "healthy"
                                ? Palette.success
                                : Palette.warning
                            }
                          />
                          <Text style={styles.healthStatusText}>
                            Result:{" "}
                            {sys.lastHealthCheckResult.status.toUpperCase()} (
                            {sys.lastHealthCheckResult.latencyMs} ms)
                          </Text>
                        </View>
                        <Text style={styles.healthMessage}>
                          {sys.lastHealthCheckResult.message} • Checked:{" "}
                          {formatDate(sys.lastHealthCheckAt)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.systemActionRow}>
                      <Pressable
                        style={[styles.smallBtn, styles.pingBtn]}
                        onPress={() => handlePing(sys._id, sys.name)}
                        disabled={pingingId === sys._id}
                      >
                        {pingingId === sys._id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name="flash-outline"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.smallBtnText}>
                              Test Connection
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* TAB 3: DATA EXCHANGE WORKFLOW */}
            {activeTab === "exchange" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Data Exchange & Scoping Rules
                  </Text>
                  <Text style={styles.sectionSub}>
                    Consent-first data release policy & healthcare resource
                    scoping
                  </Text>
                </View>

                <Card style={styles.policyCard}>
                  <View style={styles.policyHeader}>
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={Palette.primary}
                    />
                    <Text style={styles.policyTitle}>
                      Consent-First Gate Guarantee
                    </Text>
                  </View>
                  <Text style={styles.policyText}>
                    Outbound healthcare data exchanges are strictly validated
                    against active patient consent records. If consent is
                    revoked, expired, or category-unmatched, the exchange
                    transaction is automatically blocked and recorded in the
                    audit log.
                  </Text>

                  <View style={styles.scopeCheckList}>
                    {[
                      {
                        name: "Demographics",
                        desc: "Full name, date of birth, gender, masked telecom",
                      },
                      {
                        name: "Clinical Encounters",
                        desc: "Encounter timestamps, consultation status, specialist",
                      },
                      {
                        name: "Prescriptions",
                        desc: "Medication list, dosages, directions, instructions",
                      },
                      {
                        name: "Diagnostic Reports",
                        desc: "Lab tests, radiology observations, reference ranges",
                      },
                      {
                        name: "Uploaded Documents",
                        desc: "Patient wallet records with cryptographic hashes",
                      },
                      {
                        name: "Referrals",
                        desc: "Originating clinician, clinical reason, target department",
                      },
                    ].map((s) => (
                      <View key={s.name} style={styles.scopeRow}>
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color={Palette.success}
                        />
                        <View style={styles.scopeTextCol}>
                          <Text style={styles.scopeNameText}>{s.name}</Text>
                          <Text style={styles.scopeDescText}>{s.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            )}

            {/* TAB 4: MAPPINGS */}
            {activeTab === "mappings" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Resource Mappings & Schema Validation
                  </Text>
                  <Text style={styles.sectionSub}>
                    Normalized FHIR-compatible schemas for interoperable data
                    transformation
                  </Text>
                </View>

                {mappings.map((m) => (
                  <Card key={m._id} style={styles.systemCard}>
                    <View style={styles.systemCardHeader}>
                      <View>
                        <Text style={styles.systemName}>{m.name}</Text>
                        <Text style={styles.systemMeta}>
                          Resource: {m.resourceType} • Target: {m.systemType} •
                          v{m.version}
                        </Text>
                      </View>
                      <Badge label="ACTIVE" variant="primary" />
                    </View>

                    <View style={styles.fieldsTable}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.colHeader, { flex: 1.2 }]}>
                          HealPoint Field
                        </Text>
                        <Text style={[styles.colHeader, { flex: 0.6 }]}>
                          Dir
                        </Text>
                        <Text style={[styles.colHeader, { flex: 1.2 }]}>
                          External Field
                        </Text>
                        <Text style={[styles.colHeader, { flex: 0.8 }]}>
                          Type
                        </Text>
                      </View>
                      {m.fieldMappings.map((f, i) => (
                        <View key={i} style={styles.tableDataRow}>
                          <Text style={[styles.colData, { flex: 1.2 }]}>
                            {f.healpointField}
                          </Text>
                          <Text style={[styles.colData, { flex: 0.6 }]}>
                            {f.direction === "bidirectional"
                              ? "↔"
                              : f.direction === "outbound"
                                ? "→"
                                : "←"}
                          </Text>
                          <Text style={[styles.colData, { flex: 1.2 }]}>
                            {f.externalField}
                          </Text>
                          <Text style={[styles.colData, { flex: 0.8 }]}>
                            {f.transformType}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* TAB 5: EXCHANGE HISTORY */}
            {activeTab === "history" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Exchange Transactions Ledger
                  </Text>
                  <Text style={styles.sectionSub}>
                    Real-time transaction history for all inbound and outbound
                    clinical data
                  </Text>
                </View>

                {exchanges.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={48}
                      color={Palette.textMuted}
                    />
                    <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                    <Text style={styles.emptySub}>
                      All inbound and outbound exchanges will be automatically
                      logged here.
                    </Text>
                  </Card>
                ) : (
                  exchanges.map((ex) => (
                    <Pressable
                      key={ex._id}
                      onPress={() => setShowDetailModal(ex)}
                    >
                      <Card style={styles.exchangeCard}>
                        <View style={styles.systemCardHeader}>
                          <View>
                            <Text style={styles.exchangeId}>
                              {ex.exchangeId}
                            </Text>
                            <Text style={styles.systemMeta}>
                              {ex.direction.toUpperCase()} • {ex.systemName} •{" "}
                              {ex.resourceType}
                            </Text>
                          </View>
                          {getExchangeStatusBadge(ex.status)}
                        </View>

                        <View style={styles.systemDetailsRow}>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailKey}>Patient</Text>
                            <Text style={styles.detailVal}>
                              {ex.patientName || "System / Unbound"}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailKey}>Consent</Text>
                            <Text style={styles.detailVal}>
                              {ex.consentVerified
                                ? "Verified"
                                : "Bypassed/None"}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailKey}>Records</Text>
                            <Text style={styles.detailVal}>
                              {ex.recordsCount}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={styles.detailKey}>Date</Text>
                            <Text style={styles.detailVal}>
                              {formatDate(ex.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {/* TAB 6: FAILED EXCHANGES RECOVERY */}
            {activeTab === "failed" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Failed Exchanges & Conflict Center
                  </Text>
                  <Text style={styles.sectionSub}>
                    Recover transient failures and review detected healthcare
                    conflicts
                  </Text>
                </View>

                {failedExchanges.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={48}
                      color={Palette.success}
                    />
                    <Text style={styles.emptyTitle}>Zero Failed Exchanges</Text>
                    <Text style={styles.emptySub}>
                      All healthcare exchanges have completed or are operating
                      normally.
                    </Text>
                  </Card>
                ) : (
                  failedExchanges.map((ex) => (
                    <Card key={ex._id} style={styles.failedCard}>
                      <View style={styles.systemCardHeader}>
                        <View>
                          <Text style={styles.exchangeId}>{ex.exchangeId}</Text>
                          <Text style={styles.systemMeta}>
                            Target: {ex.systemName} • Category:{" "}
                            {ex.errorCategory}
                          </Text>
                        </View>
                        {getExchangeStatusBadge(ex.status)}
                      </View>

                      <View style={styles.errorNoticeBox}>
                        <Text style={styles.errorNoticeText}>
                          {ex.errorMessage || "Unknown transmission failure"}
                        </Text>
                      </View>

                      {ex.conflictDetails?.hasConflict && (
                        <View style={styles.conflictBox}>
                          <Text style={styles.conflictTitle}>
                            Conflict Details:
                          </Text>
                          <Text style={styles.conflictItem}>
                            Field: {ex.conflictDetails.conflictingField}
                          </Text>
                          <Text style={styles.conflictItem}>
                            Local: {ex.conflictDetails.localValue}
                          </Text>
                          <Text style={styles.conflictItem}>
                            Incoming: {ex.conflictDetails.incomingValue}
                          </Text>
                        </View>
                      )}

                      <View style={styles.systemActionRow}>
                        <Pressable
                          style={[styles.smallBtn, styles.retryBtn]}
                          onPress={() => handleRetry(ex.exchangeId)}
                          disabled={retryingId === ex.exchangeId}
                        >
                          {retryingId === ex.exchangeId ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons
                                name="refresh"
                                size={14}
                                color="#FFFFFF"
                              />
                              <Text style={styles.smallBtnText}>
                                Retry Exchange ({ex.retryCount}/{ex.maxRetries})
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB 7: SECURITY & AUDIT */}
            {activeTab === "security" && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Security Architecture & Governance
                  </Text>
                  <Text style={styles.sectionSub}>
                    HIPAA/DISHA compliance, data minimization, and audit
                    controls
                  </Text>
                </View>

                <Card style={styles.policyCard}>
                  <View style={styles.policyHeader}>
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={Palette.primary}
                    />
                    <Text style={styles.policyTitle}>
                      Enterprise Security Invariants
                    </Text>
                  </View>

                  <View style={styles.securityCheckList}>
                    {[
                      {
                        title: "Credential Masking & Encrypted Secret Vault",
                        desc: "External API secrets, OAuth client credentials, and webhook HMAC keys are strictly encrypted server-side and never returned to browser/mobile clients.",
                      },
                      {
                        title: "Patient & Family Isolation",
                        desc: "Healthcare records are strictly scoped to the verified patient. Multi-member family accounts cannot cross-pollinate records during exchange.",
                      },
                      {
                        title: "Hospital Isolation Boundaries",
                        desc: "Hospital Administrators have access only to their own hospital's incoming and outgoing exchanges. Platform-wide configuration is restricted to Super Admins.",
                      },
                      {
                        title: "HMAC-SHA256 Webhook Replay Protection",
                        desc: "All incoming webhooks verify cryptographic signatures with a strict 5-minute replay window tolerance.",
                      },
                      {
                        title: "Strict Idempotency & Duplicate Shield",
                        desc: "Composite idempotency keys guarantee that duplicate external transmissions never produce duplicate appointments or clinical records.",
                      },
                    ].map((item, idx) => (
                      <View key={idx} style={styles.securityItem}>
                        <Ionicons
                          name="checkmark-done-circle"
                          size={18}
                          color={Palette.success}
                        />
                        <View style={styles.securityTextCol}>
                          <Text style={styles.securityItemTitle}>
                            {item.title}
                          </Text>
                          <Text style={styles.securityItemDesc}>
                            {item.desc}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            )}
          </ScrollView>
        )}

        {/* Register System Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Register External System</Text>
                <Pressable onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>
                  System Key (e.g. apollo_hospitals, srl_diagnostics)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={newSystemKey}
                  onChangeText={setNewSystemKey}
                  placeholder="apollo_hospitals"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>System Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Apollo Hospitals Central"
                  placeholderTextColor={Palette.textMuted}
                />

                <Text style={styles.inputLabel}>Organization</Text>
                <TextInput
                  style={styles.textInput}
                  value={newOrg}
                  onChangeText={setNewOrg}
                  placeholder="Apollo Health City"
                  placeholderTextColor={Palette.textMuted}
                />

                <Text style={styles.inputLabel}>System Type</Text>
                <View style={styles.typeSelectorRow}>
                  {(
                    [
                      "Hospital",
                      "Laboratory",
                      "Diagnostic Center",
                      "EMR/EHR",
                    ] as ExternalSystemType[]
                  ).map((t) => (
                    <Pressable
                      key={t}
                      style={[
                        styles.typeOption,
                        newType === t && styles.typeOptionActive,
                      ]}
                      onPress={() => setNewType(t)}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          newType === t && styles.typeOptionTextActive,
                        ]}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Endpoint URL (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newEndpoint}
                  onChangeText={setNewEndpoint}
                  placeholder="https://api.externalpartner.org/fhir"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>
                  Health Check URL (Optional)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={newHealthUrl}
                  onChangeText={setNewHealthUrl}
                  placeholder="https://api.externalpartner.org/health"
                  placeholderTextColor={Palette.textMuted}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>
                  API Credential / Secret (Will be masked immediately)
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={newCredential}
                  onChangeText={setNewCredential}
                  placeholder="sk_live_..."
                  placeholderTextColor={Palette.textMuted}
                  secureTextEntry
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowAddModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={
                    submittingSystem ? "Registering..." : "Register System"
                  }
                  onPress={handleRegisterSubmit}
                  disabled={submittingSystem}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Exchange Detail Modal */}
        <Modal
          visible={Boolean(showDetailModal)}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDetailModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Exchange Transaction</Text>
                <Pressable onPress={() => setShowDetailModal(null)}>
                  <Ionicons name="close" size={24} color={Palette.text} />
                </Pressable>
              </View>

              {showDetailModal && (
                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Exchange ID</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.exchangeId}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Direction</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.direction.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>System</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.systemName} ({showDetailModal.systemKey})
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Resource Type</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.resourceType}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Patient Subject</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.patientName || "System / Unbound"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Consent Verified</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.consentVerified
                        ? "Yes (Enforced)"
                        : "No"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Correlation ID</Text>
                    <Text style={styles.detailValText}>
                      {showDetailModal.correlationId}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKeyText}>Created At</Text>
                    <Text style={styles.detailValText}>
                      {formatDate(showDetailModal.createdAt)}
                    </Text>
                  </View>
                  {showDetailModal.errorMessage ? (
                    <View style={styles.errorNoticeBox}>
                      <Text style={styles.errorNoticeText}>
                        {showDetailModal.errorMessage}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
              )}

              <View style={styles.modalFooter}>
                <Button
                  title="Close"
                  onPress={() => setShowDetailModal(null)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </RoleRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    backgroundColor: Palette.surface,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitles: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  title: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  subtitle: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    marginLeft: 4,
  },
  tabContainer: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.xs,
  },
  tabItemActive: {
    backgroundColor: `${Palette.primary}15`,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  tabText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    fontWeight: "600",
    marginLeft: 6,
  },
  tabTextActive: {
    color: Palette.primary,
  },
  contentScroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  metricLabel: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: Typography.h2.fontSize,
    fontWeight: "700",
    color: Palette.text,
    marginVertical: 4,
  },
  metricSub: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
  },
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  sectionSub: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.sm,
  },
  emptySub: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  systemCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.sm,
  },
  systemCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  systemTitleBlock: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  systemName: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  systemMeta: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    marginTop: 2,
  },
  systemDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  detailItem: {
    flex: 1,
  },
  detailKey: {
    fontSize: 10,
    color: Palette.textMuted,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  detailVal: {
    fontSize: Typography.caption.fontSize,
    color: Palette.text,
    fontWeight: "600",
    marginTop: 2,
  },
  scopeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: Spacing.sm,
  },
  scopeChip: {
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  scopeChipText: {
    fontSize: 10,
    color: Palette.textMuted,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  systemActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  smallBtnText: {
    color: "#FFFFFF",
    fontSize: Typography.caption.fontSize,
    fontWeight: "600",
    marginLeft: 4,
  },
  pingBtn: {
    backgroundColor: Palette.primary,
  },
  disableBtn: {
    backgroundColor: Palette.textMuted,
  },
  enableBtn: {
    backgroundColor: Palette.success,
  },
  retryBtn: {
    backgroundColor: Palette.primary,
  },
  healthResultBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  healthStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  healthStatusText: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.text,
    marginLeft: 6,
  },
  healthMessage: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    marginTop: 4,
  },
  policyCard: {
    padding: Spacing.md,
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  policyTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Palette.text,
    marginLeft: Spacing.xs,
  },
  policyText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  scopeCheckList: {
    gap: Spacing.sm,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  scopeTextCol: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  scopeNameText: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  scopeDescText: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
  },
  fieldsTable: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  tableDataRow: {
    flexDirection: "row",
    padding: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  colData: {
    fontSize: 11,
    color: Palette.text,
  },
  exchangeCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.sm,
  },
  exchangeId: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.primary,
  },
  failedCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.error,
    marginBottom: Spacing.sm,
  },
  errorNoticeBox: {
    backgroundColor: `${Palette.error}10`,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  errorNoticeText: {
    fontSize: Typography.caption.fontSize,
    color: Palette.error,
    fontWeight: "600",
  },
  conflictBox: {
    backgroundColor: `${Palette.warning}10`,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  conflictTitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: "700",
    color: Palette.warning,
  },
  conflictItem: {
    fontSize: 11,
    color: Palette.text,
    marginTop: 2,
  },
  securityCheckList: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  securityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  securityTextCol: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  securityItemTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  securityItemDesc: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: 2,
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
    maxHeight: "85%",
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  modalBody: {
    marginBottom: Spacing.md,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputLabel: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.text,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  typeSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginVertical: 4,
  },
  typeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
  },
  typeOptionActive: {
    backgroundColor: Palette.primary,
  },
  typeOptionText: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  typeOptionTextActive: {
    color: "#FFFFFF",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  detailKeyText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
  },
  detailValText: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    color: Palette.text,
  },
});
