/**
 * HealPoint - Hospital Admin Interoperability & Secure Exchange Center.
 *
 * Scoped strictly to the logged-in Hospital Admin's facility.
 * Enforces hospital isolation, patient consent gates, and structured healthcare export.
 */
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

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { toErrorMessage } from "@/services/api";
import * as interopService from "@/services/interoperability";
import type {
  ExchangeDirection,
  ExchangeStatus,
  ExternalHealthcareSystem,
  InteroperabilityExchange,
} from "@/types";

type HospitalInteropTab = "all" | "inbound" | "outbound" | "export";

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Never";
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return isoString;
  }
}

export default function HospitalInteroperabilityScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HospitalInteropTab>("all");
  const [exchanges, setExchanges] = useState<InteroperabilityExchange[]>([]);
  const [systems, setSystems] = useState<ExternalHealthcareSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Export package form
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [patientIdInput, setPatientIdInput] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "reports",
    "appointments",
  ]);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    exchangeId: string;
    patientName?: string;
    recordsCount?: number;
  } | null>(null);

  const loadData = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [exRes, sysRes] = await Promise.all([
          interopService.getHospitalExchanges({ limit: 40 }),
          interopService
            .getSystemRegistry()
            .catch(() => ({ success: true, systems: [], count: 0 })),
        ]);

        if (exRes?.exchanges) setExchanges(exRes.exchanges);
        if (sysRes?.systems) {
          setSystems(
            sysRes.systems.filter((s) => s.connectionStatus !== "disabled"),
          );
          if (sysRes.systems.length > 0 && !selectedSystemId) {
            setSelectedSystemId(sysRes.systems[0]._id);
          }
        }
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedSystemId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredExchanges = exchanges.filter((ex) => {
    if (activeTab === "inbound") return ex.direction === "inbound";
    if (activeTab === "outbound") return ex.direction === "outbound";
    return true;
  });

  const handleExportSubmit = async () => {
    if (!selectedSystemId || !patientIdInput.trim()) {
      Alert.alert(
        "Missing Fields",
        "Please select an external system and specify the Patient ID.",
      );
      return;
    }

    setExporting(true);
    setExportResult(null);

    try {
      const res = await interopService.exportHospitalPackage({
        externalSystemId: selectedSystemId,
        patientId: patientIdInput.trim(),
        dataScope: selectedScopes,
      });

      if (res.success) {
        Alert.alert(
          "Export Authorized",
          `Exchange ${res.exchangeId} completed successfully with verified consent.`,
        );
        setExportResult({
          exchangeId: res.exchangeId,
          patientName: res.payloadPreview?.patientName,
          recordsCount: res.payloadPreview?.recordsCount,
        });
        loadData(true);
      } else {
        Alert.alert(
          "Export Denied",
          res.message || "Consent verification failed or data access blocked.",
        );
      }
    } catch (err) {
      Alert.alert("Export Error", toErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      if (selectedScopes.length === 1) return; // Keep at least one
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const getStatusBadge = (status: ExchangeStatus) => {
    switch (status) {
      case "processed":
      case "accepted":
        return <Badge label={status.toUpperCase()} variant="success" />;
      case "conflict":
        return <Badge label="CONFLICT" variant="warning" />;
      case "failed":
      case "rejected":
        return <Badge label={status.toUpperCase()} variant="error" />;
      default:
        return <Badge label={status.toUpperCase()} variant="primary" />;
    }
  };

  return (
    <AdminModuleScreen
      title="Interoperability Exchange"
      subtitle="Hospital Partner Data Exchange & Inbound Clinical Feeds"
      allowedRoles={["admin", "super_admin"]}
    >
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: Spacing.xxl * 2,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Top Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === "all" && styles.tabBtnActive]}
            onPress={() => setActiveTab("all")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "all" && styles.tabTextActive,
              ]}
            >
              All ({exchanges.length})
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "inbound" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("inbound")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "inbound" && styles.tabTextActive,
              ]}
            >
              Incoming Feeds
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "outbound" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("outbound")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "outbound" && styles.tabTextActive,
              ]}
            >
              Outgoing Packages
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "export" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("export")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "export" && styles.tabTextActive,
              ]}
            >
              Export Package
            </Text>
          </Pressable>
        </View>

        {/* Tab: Export Package */}
        {activeTab === "export" ? (
          <View style={styles.exportSection}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={22}
                  color={Palette.primary}
                />
                <Text style={styles.cardTitle}>Authorized Clinical Export</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Export patient clinical package to an authorized partner
                facility. Verifies active patient consent before release.
              </Text>

              <Text style={styles.label}>Target Healthcare Partner</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.partnerScroll}
              >
                {systems.map((s) => (
                  <Pressable
                    key={s._id}
                    style={[
                      styles.partnerChip,
                      selectedSystemId === s._id && styles.partnerChipActive,
                    ]}
                    onPress={() => setSelectedSystemId(s._id)}
                  >
                    <Text
                      style={[
                        styles.partnerChipText,
                        selectedSystemId === s._id &&
                          styles.partnerChipTextActive,
                      ]}
                    >
                      {s.name} ({s.systemType})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.label}>Patient Object ID</Text>
              <TextInput
                style={styles.input}
                value={patientIdInput}
                onChangeText={setPatientIdInput}
                placeholder="e.g. 660f89bc7e23a45612345678"
                placeholderTextColor={Palette.textMuted}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Authorized Data Scope Selection</Text>
              <View style={styles.scopeSelectionGrid}>
                {[
                  { key: "reports", label: "Diagnostic Reports" },
                  { key: "appointments", label: "Encounter History" },
                  { key: "prescriptions", label: "Medication Regimen" },
                  { key: "documents", label: "Uploaded Documents" },
                  { key: "referrals", label: "Referral Summaries" },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.scopeCheckItem,
                      selectedScopes.includes(item.key) &&
                        styles.scopeCheckItemActive,
                    ]}
                    onPress={() => toggleScope(item.key)}
                  >
                    <Ionicons
                      name={
                        selectedScopes.includes(item.key)
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={18}
                      color={
                        selectedScopes.includes(item.key)
                          ? Palette.primary
                          : Palette.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.scopeCheckText,
                        selectedScopes.includes(item.key) &&
                          styles.scopeCheckTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {exportResult && (
                <View style={styles.exportSuccessBanner}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Palette.success}
                  />
                  <View style={{ marginLeft: Spacing.sm }}>
                    <Text style={styles.successTitle}>
                      Export Completed Successfully
                    </Text>
                    <Text style={styles.successDesc}>
                      Exchange: {exportResult.exchangeId} • Patient:{" "}
                      {exportResult.patientName} • {exportResult.recordsCount}{" "}
                      records
                    </Text>
                  </View>
                </View>
              )}

              <Button
                title={
                  exporting
                    ? "Verifying Consent & Exporting..."
                    : "Execute Authorized Export"
                }
                onPress={handleExportSubmit}
                disabled={exporting}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          </View>
        ) : (
          /* Tab: Exchanges List */
          <View style={styles.listSection}>
            {filteredExchanges.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={40}
                  color={Palette.textMuted}
                />
                <Text style={styles.emptyTitle}>No Exchanges Recorded</Text>
                <Text style={styles.emptySubtitle}>
                  Inbound feeds and outbound data transfers for this facility
                  will appear here.
                </Text>
              </Card>
            ) : (
              filteredExchanges.map((ex) => (
                <Card key={ex._id} style={styles.exchangeCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exchangeIdText}>{ex.exchangeId}</Text>
                      <Text style={styles.partnerText}>
                        {ex.direction.toUpperCase()} • {ex.systemName}
                      </Text>
                    </View>
                    {getStatusBadge(ex.status)}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaKey}>Subject</Text>
                      <Text style={styles.metaVal}>
                        {ex.patientName || "System / Unbound"}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaKey}>Resource</Text>
                      <Text style={styles.metaVal}>{ex.resourceType}</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaKey}>Consent</Text>
                      <Text style={styles.metaVal}>
                        {ex.consentVerified ? "Enforced" : "None"}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaKey}>Date</Text>
                      <Text style={styles.metaVal}>
                        {formatDate(ex.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {ex.errorMessage ? (
                    <View style={styles.errorNotice}>
                      <Text style={styles.errorText}>{ex.errorMessage}</Text>
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    padding: Spacing.xs,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.md,
  },
  tabBtnActive: {
    backgroundColor: Palette.primary,
  },
  tabText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  exportSection: {
    marginBottom: Spacing.xl,
  },
  listSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  card: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Palette.text,
    marginLeft: Spacing.xs,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  partnerScroll: {
    marginBottom: Spacing.sm,
  },
  partnerChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  partnerChipActive: {
    backgroundColor: `${Palette.primary}15`,
    borderColor: Palette.primary,
  },
  partnerChipText: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  partnerChipTextActive: {
    color: Palette.primary,
  },
  input: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.text,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  scopeSelectionGrid: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  scopeCheckItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
  },
  scopeCheckItemActive: {
    backgroundColor: `${Palette.primary}10`,
  },
  scopeCheckText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    marginLeft: Spacing.sm,
  },
  scopeCheckTextActive: {
    color: Palette.text,
    fontWeight: "600",
  },
  exportSuccessBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Palette.success}15`,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  successTitle: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.success,
  },
  successDesc: {
    fontSize: Typography.caption.fontSize,
    color: Palette.text,
    marginTop: 2,
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
  emptySubtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  exchangeCard: {
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  exchangeIdText: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "700",
    color: Palette.primary,
  },
  partnerText: {
    fontSize: Typography.caption.fontSize,
    color: Palette.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  metaCol: {
    flex: 1,
  },
  metaKey: {
    fontSize: 10,
    color: Palette.textMuted,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  metaVal: {
    fontSize: Typography.caption.fontSize,
    color: Palette.text,
    fontWeight: "600",
    marginTop: 2,
  },
  errorNotice: {
    backgroundColor: `${Palette.error}10`,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  errorText: {
    fontSize: 11,
    color: Palette.error,
  },
});
