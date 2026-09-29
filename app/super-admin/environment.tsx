/**
 * HealPoint - Super Admin Data Migration & Environment Management Center.
 *
 * Professional environment lifecycle, configuration health, and controlled
 * database migrations console for Super Admins.
 * Connects directly to backend /environment endpoints.
 * Zero secret leakage, zero fake metadata, zero accidental production data overwrite.
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
import * as migrationService from "@/services/migration";
import type {
  DatabaseCollectionStatus,
  DataMigrationRecord,
  EnvironmentOverviewResponse,
  MigrationPreviewResponse,
  RegisteredMigration,
} from "@/types";

type ActiveTab =
  | "overview"
  | "config_health"
  | "migrations"
  | "history"
  | "database";

function formatBytes(bytes: number = 0): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "Never";
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return isoString;
  }
}

export default function EnvironmentMigrationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [overview, setOverview] = useState<EnvironmentOverviewResponse | null>(
    null,
  );
  const [migrations, setMigrations] = useState<RegisteredMigration[]>([]);
  const [history, setHistory] = useState<DataMigrationRecord[]>([]);
  const [collections, setCollections] = useState<DatabaseCollectionStatus[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Action states
  const [executingVersion, setExecutingVersion] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<
    MigrationPreviewResponse["preview"] | null
  >(null);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [overviewRes, migrationsRes, historyRes, collectionsRes] =
        await Promise.all([
          migrationService.getEnvironmentOverview(),
          migrationService.getRegisteredMigrations(),
          migrationService.getMigrationHistory({ limit: 20 }),
          migrationService
            .getDatabaseCollections()
            .catch(() => ({ collections: [] })),
        ]);

      setOverview(overviewRes);
      setMigrations(migrationsRes.migrations || []);
      setHistory(historyRes.history || []);
      setCollections(collectionsRes.collections || []);
    } catch (err) {
      setError(
        toErrorMessage(
          err,
          "Failed to load environment and migration metadata",
        ),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler: Preview Migration
  const handlePreviewMigration = async (version: string) => {
    setPreviewLoading(true);
    try {
      const res = await migrationService.previewMigration(version);
      setPreviewData(res.preview);
    } catch (err) {
      Alert.alert(
        "Preview Failed",
        toErrorMessage(err, "Unable to inspect migration"),
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handler: Execute Migration
  const handleExecuteMigration = (version: string, name: string) => {
    const isProd = overview?.environment === "production";
    Alert.alert(
      `Execute Migration: ${version}`,
      `${name}\n\nTarget Environment: ${overview?.environment.toUpperCase()}${
        isProd
          ? "\n\n⚠️ PRODUCTION SAFETY: Requires a verified database backup created in the last 24 hours."
          : "\n\nOperation runs idempotently with an atomic database concurrency lock."
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Execute Migration",
          style: isProd ? "destructive" : "default",
          onPress: async () => {
            setExecutingVersion(version);
            try {
              const res = await migrationService.executeMigration(version);
              Alert.alert(
                "Migration Complete",
                `${res.message}\n\n${res.summary || "All operations completed successfully."}`,
              );
              loadData(true);
            } catch (err) {
              Alert.alert(
                "Migration Failed",
                toErrorMessage(err, "Execution halted"),
              );
            } finally {
              setExecutingVersion(null);
            }
          },
        },
      ],
    );
  };

  const envColor =
    overview?.environment === "production"
      ? Palette.error
      : overview?.environment === "staging"
        ? Palette.warning
        : Palette.primary;

  return (
    <RoleRoute allowedRoles={["super_admin"]}>
      <View style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerIconCircle,
                { backgroundColor: `${Palette.primary}1F` },
              ]}
            >
              <Ionicons name="git-branch" size={24} color={Palette.primary} />
            </View>
            <View style={styles.headerTexts}>
              <Text style={styles.title}>Environment & Migrations</Text>
              <Text style={styles.subtitle}>
                Configuration Health, Idempotent Migrations & Safeguards
              </Text>
            </View>
          </View>
          <DrawerToggleButton />
        </View>

        {/* Global Operational Status Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusBannerLeft}>
            <View style={[styles.statusDot, { backgroundColor: envColor }]} />
            <Text style={styles.statusBannerTitle}>
              Environment: {(overview?.environment || "Unknown").toUpperCase()}
            </Text>
            <Badge
              label={overview?.environment || "dev"}
              variant={
                overview?.environment === "production"
                  ? "error"
                  : overview?.environment === "staging"
                    ? "warning"
                    : "primary"
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh environment data"
            onPress={() => loadData(true)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.refreshBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="refresh" size={18} color={Palette.text} />
          </Pressable>
        </View>

        {/* Environment Mismatch Warning (if any) */}
        {overview?.mismatches && overview.mismatches.length > 0 ? (
          <View style={styles.mismatchBanner}>
            <Ionicons name="warning" size={20} color={Palette.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mismatchTitle}>
                Environment Mismatch Detected
              </Text>
              <Text style={styles.mismatchDesc}>
                {overview.mismatches[0].message}
              </Text>
              <Text style={styles.mismatchRec}>
                Action: {overview.mismatches[0].recommendation}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tab Selector */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {[
              { id: "overview", label: "Overview", icon: "cube-outline" },
              {
                id: "config_health",
                label: "Config Health",
                icon: "pulse-outline",
              },
              {
                id: "migrations",
                label: "Migrations",
                icon: "git-commit-outline",
              },
              { id: "history", label: "History", icon: "time-outline" },
              {
                id: "database",
                label: "Database / Collections",
                icon: "server-outline",
              },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as ActiveTab)}
                  style={[styles.tabButton, active && styles.activeTabButton]}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={active ? Palette.primary : Palette.textMuted}
                  />
                  <Text
                    style={[styles.tabLabel, active && styles.activeTabLabel]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <Loading label="Loading environment & migration metadata..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadData()} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
              />
            }
          >
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <View style={styles.tabContent}>
                <View style={styles.grid}>
                  <Card style={styles.statCard}>
                    <View style={styles.statCardHeader}>
                      <Ionicons
                        name="desktop-outline"
                        size={20}
                        color={Palette.primary}
                      />
                      <Text style={styles.statLabel}>Active Environment</Text>
                    </View>
                    <Text style={[styles.statValue, { color: envColor }]}>
                      {(overview?.environment || "Dev").toUpperCase()}
                    </Text>
                    <Text style={styles.statSub}>
                      Safe API Base: {overview?.safeApiBaseUrl || "/api/v1"}
                    </Text>
                  </Card>

                  <Card style={styles.statCard}>
                    <View style={styles.statCardHeader}>
                      <Ionicons
                        name="layers-outline"
                        size={20}
                        color="#2F80ED"
                      />
                      <Text style={styles.statLabel}>Platform Version</Text>
                    </View>
                    <Text style={styles.statValue}>
                      v{overview?.application.backendVersion || "1.0.0"}
                    </Text>
                    <Text style={styles.statSub}>
                      Node {overview?.application.nodeVersion} •{" "}
                      {overview?.application.platform}
                    </Text>
                  </Card>

                  <Card style={styles.statCard}>
                    <View style={styles.statCardHeader}>
                      <Ionicons
                        name="server-outline"
                        size={20}
                        color="#2E9E5B"
                      />
                      <Text style={styles.statLabel}>Database Cluster</Text>
                    </View>
                    <Text style={styles.statValue}>
                      {overview?.database.provider || "MongoDB"}
                    </Text>
                    <Text style={styles.statSub}>
                      {overview?.database.hostType} •{" "}
                      {overview?.database.driver}
                    </Text>
                  </Card>

                  <Card style={styles.statCard}>
                    <View style={styles.statCardHeader}>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color="#E89A3C"
                      />
                      <Text style={styles.statLabel}>Secret Protection</Text>
                    </View>
                    <Text style={styles.statValue}>Active</Text>
                    <Text style={styles.statSub}>
                      Zero credentials or keys serialized in API responses
                    </Text>
                  </Card>
                </View>

                {/* Production Safeguard Notice */}
                <Card style={styles.guardrailCard}>
                  <View style={styles.guardrailHeader}>
                    <Ionicons
                      name="shield-half"
                      size={22}
                      color={Palette.primary}
                    />
                    <Text style={styles.guardrailTitle}>
                      HealPoint Environment Guardrails
                    </Text>
                  </View>
                  <Text style={styles.guardrailText}>
                    • Production medical records, patients, and prescriptions
                    are NEVER copied to development automatically.
                  </Text>
                  <Text style={styles.guardrailText}>
                    • Migrations run idempotently with an atomic database lock
                    preventing race conditions.
                  </Text>
                  <Text style={styles.guardrailText}>
                    • Production migrations require a completed database backup
                    within the last 24 hours.
                  </Text>
                </Card>

                {/* Quick Migration Summary */}
                <Text style={styles.sectionHeader}>
                  Registered Migrations Summary
                </Text>
                <Card style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Total Registered Migrations:
                    </Text>
                    <Text style={styles.summaryVal}>{migrations.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Completed in this Environment:
                    </Text>
                    <Text
                      style={[styles.summaryVal, { color: Palette.success }]}
                    >
                      {
                        migrations.filter((m) => m.status === "completed")
                          .length
                      }
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Pending Execution:</Text>
                    <Text
                      style={[styles.summaryVal, { color: Palette.warning }]}
                    >
                      {migrations.filter((m) => m.status === "pending").length}
                    </Text>
                  </View>
                </Card>
              </View>
            )}

            {/* TAB 2: CONFIGURATION HEALTH */}
            {activeTab === "config_health" && (
              <View style={styles.tabContent}>
                <Card style={styles.infoBannerCard}>
                  <Ionicons
                    name="lock-closed"
                    size={24}
                    color={Palette.primary}
                  />
                  <View style={styles.infoBannerTexts}>
                    <Text style={styles.infoBannerTitle}>
                      Strict Secret Redaction Standard
                    </Text>
                    <Text style={styles.infoBannerDesc}>
                      Configuration health validates credential presence,
                      format, and subsystem responsiveness without ever
                      revealing or logging actual secret values.
                    </Text>
                  </View>
                </Card>

                <Text style={styles.sectionHeader}>
                  Core Subsystems Configuration Status
                </Text>
                <View style={styles.configGrid}>
                  {(overview?.configurationHealth || []).map((cfg) => (
                    <Card key={cfg.key} style={styles.configCard}>
                      <View style={styles.configHeader}>
                        <View style={styles.configHeaderLeft}>
                          <Ionicons
                            name={
                              cfg.isHealthy
                                ? "checkmark-circle"
                                : "alert-circle"
                            }
                            size={22}
                            color={
                              cfg.isHealthy ? Palette.success : Palette.error
                            }
                          />
                          <View>
                            <Text style={styles.configTitle}>
                              {cfg.subsystem}
                            </Text>
                            <Text style={styles.configDetail}>
                              {cfg.detail}
                            </Text>
                          </View>
                        </View>
                        <Badge
                          label={cfg.status.toUpperCase()}
                          variant={cfg.isHealthy ? "success" : "error"}
                        />
                      </View>
                    </Card>
                  ))}
                </View>
              </View>
            )}

            {/* TAB 3: MIGRATIONS */}
            {activeTab === "migrations" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>
                  Registered Idempotent Migrations ({migrations.length})
                </Text>

                {migrations.map((mig) => {
                  const isCompleted = mig.status === "completed";
                  const isRunning = executingVersion === mig.version;
                  return (
                    <Card key={mig.version} style={styles.migrationCard}>
                      <View style={styles.migrationHeader}>
                        <View style={styles.migrationHeaderLeft}>
                          <View style={styles.versionPill}>
                            <Text style={styles.versionText}>
                              {mig.version}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.migrationName}>{mig.name}</Text>
                            <Text style={styles.migrationCategory}>
                              Category: {mig.category.toUpperCase()} • Risk:{" "}
                              {mig.riskLevel.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Badge
                          label={isCompleted ? "COMPLETED" : "PENDING"}
                          variant={isCompleted ? "success" : "neutral"}
                        />
                      </View>

                      <Text style={styles.migrationDesc}>
                        {mig.description}
                      </Text>

                      <View style={styles.collectionsBox}>
                        <Text style={styles.collectionsLabel}>
                          Affected Collections:
                        </Text>
                        <View style={styles.collectionChips}>
                          {mig.affectedCollections.map((col) => (
                            <View key={col} style={styles.colChip}>
                              <Text style={styles.colChipText}>{col}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {isCompleted && mig.executedAt ? (
                        <Text style={styles.executedDate}>
                          Completed on: {formatDate(mig.executedAt)} (
                          {mig.durationMs ? `${mig.durationMs}ms` : "—"})
                        </Text>
                      ) : null}

                      <View style={styles.migrationActions}>
                        <Button
                          title="Preview"
                          variant="outline"
                          loading={previewLoading}
                          onPress={() => handlePreviewMigration(mig.version)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          title={
                            isCompleted
                              ? "Re-Run (Idempotent)"
                              : "Execute Migration"
                          }
                          variant={isCompleted ? "secondary" : "primary"}
                          loading={isRunning}
                          onPress={() =>
                            handleExecuteMigration(mig.version, mig.name)
                          }
                          style={{ flex: 1.5 }}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}

            {/* TAB 4: HISTORY */}
            {activeTab === "history" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>
                  Migration History ({history.length})
                </Text>

                {history.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Ionicons
                      name="time-outline"
                      size={38}
                      color={Palette.textMuted}
                    />
                    <Text style={styles.emptyTitle}>
                      No Migrations Executed Yet
                    </Text>
                    <Text style={styles.emptyDesc}>
                      Run registered migrations from the Migrations tab to
                      initialize database state.
                    </Text>
                  </Card>
                ) : (
                  history.map((hist) => (
                    <Card key={hist._id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <View>
                          <Text style={styles.historyId}>
                            {hist.migrationId}
                          </Text>
                          <Text style={styles.historyName}>
                            {hist.version} • {hist.name}
                          </Text>
                        </View>
                        <Badge
                          label={hist.status.toUpperCase()}
                          variant={
                            hist.status === "completed"
                              ? "success"
                              : hist.status === "failed"
                                ? "error"
                                : "warning"
                          }
                        />
                      </View>

                      <View style={styles.historyMetaRow}>
                        <Text style={styles.historyMeta}>
                          Duration:{" "}
                          {hist.durationMs ? `${hist.durationMs}ms` : "—"}
                        </Text>
                        <Text style={styles.historyMeta}>
                          Records: {hist.recordsAffected}
                        </Text>
                        <Text style={styles.historyMeta}>
                          Actor: {hist.actor?.name || "System"}
                        </Text>
                      </View>

                      {hist.errorSummary ? (
                        <Text style={styles.historyError}>
                          Error: {hist.errorSummary}
                        </Text>
                      ) : null}

                      <Text style={styles.historyDate}>
                        Started: {formatDate(hist.startedAt)}
                      </Text>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB 5: DATABASE & INDEX STATUS */}
            {activeTab === "database" && (
              <View style={styles.tabContent}>
                <Card style={styles.infoBannerCard}>
                  <Ionicons name="server" size={24} color={Palette.primary} />
                  <View style={styles.infoBannerTexts}>
                    <Text style={styles.infoBannerTitle}>
                      Live Database Schema & Collections
                    </Text>
                    <Text style={styles.infoBannerDesc}>
                      Real-time inventory of MongoDB collections, document
                      counts, storage sizing, and index allocations across all
                      registered application domains.
                    </Text>
                  </View>
                </Card>

                <Text style={styles.sectionHeader}>
                  MongoDB Collections ({collections.length})
                </Text>

                {collections.map((col) => (
                  <Card key={col.name} style={styles.collectionCard}>
                    <View style={styles.collectionHeader}>
                      <View style={styles.collectionLeft}>
                        <Ionicons
                          name="folder-open"
                          size={20}
                          color={Palette.primary}
                        />
                        <Text style={styles.collectionName}>{col.name}</Text>
                      </View>
                      <Badge label={`${col.count} docs`} variant="primary" />
                    </View>

                    <View style={styles.collectionStatsRow}>
                      <View style={styles.colStat}>
                        <Text style={styles.colStatLabel}>Size</Text>
                        <Text style={styles.colStatVal}>
                          {formatBytes(col.sizeBytes)}
                        </Text>
                      </View>
                      <View style={styles.colStat}>
                        <Text style={styles.colStatLabel}>Indexes</Text>
                        <Text style={styles.colStatVal}>
                          {col.indexesCount}
                        </Text>
                      </View>
                    </View>

                    {col.indexNames && col.indexNames.length > 0 ? (
                      <View style={styles.indexBox}>
                        <Text style={styles.indexLabel}>Active Indexes:</Text>
                        <Text style={styles.indexList}>
                          {col.indexNames.join(", ")}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Modal: Migration Preview */}
        <Modal
          visible={Boolean(previewData)}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewData(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="git-commit" size={24} color={Palette.primary} />
                <Text style={styles.modalTitle}>Migration Preview</Text>
              </View>

              {previewData ? (
                <ScrollView style={{ maxHeight: 420 }}>
                  <Text style={styles.previewSub}>
                    Version: {previewData.version}
                  </Text>
                  <Text style={styles.previewSub}>
                    Name: {previewData.name}
                  </Text>
                  <Text style={styles.previewSub}>
                    Target Environment:{" "}
                    {previewData.targetEnvironment.toUpperCase()}
                  </Text>
                  <Text style={styles.previewSub}>
                    Category: {previewData.category.toUpperCase()} • Risk:{" "}
                    {previewData.riskLevel.toUpperCase()}
                  </Text>

                  <View style={styles.guardrailBox}>
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color={Palette.success}
                    />
                    <Text style={styles.guardrailBoxText}>
                      {previewData.safetyNotice}
                    </Text>
                  </View>

                  <Text style={styles.previewSectionTitle}>
                    Affected Collections (
                    {previewData.affectedCollections.length})
                  </Text>
                  <View style={styles.collectionChips}>
                    {previewData.affectedCollections.map((c) => (
                      <View key={c} style={styles.colChip}>
                        <Text style={styles.colChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.previewSectionTitle}>Description</Text>
                  <Text style={styles.previewDesc}>
                    {previewData.description}
                  </Text>
                </ScrollView>
              ) : null}

              <Button
                title="Close Preview"
                variant="primary"
                onPress={() => setPreviewData(null)}
                style={{ marginTop: Spacing.md }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </RoleRoute>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTexts: { flex: 1 },
  title: { ...Typography.h3, color: Palette.text },
  subtitle: { ...Typography.caption, color: Palette.textMuted },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  statusBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusBannerTitle: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.border,
  },
  pressed: { opacity: 0.7 },
  mismatchBanner: {
    flexDirection: "row",
    gap: Spacing.sm,
    backgroundColor: `${Palette.error}14`,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${Palette.error}33`,
  },
  mismatchTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.error,
  },
  mismatchDesc: { ...Typography.caption, color: Palette.text },
  mismatchRec: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "600",
    marginTop: 2,
  },
  tabsContainer: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabsScroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  activeTabButton: { backgroundColor: `${Palette.primary}1F` },
  tabLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  activeTabLabel: { color: Palette.primary, fontWeight: "700" },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  tabContent: { gap: Spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  statCard: { flex: 1, minWidth: 150, gap: 4 },
  statCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  statValue: { ...Typography.h3, color: Palette.text },
  statSub: { ...Typography.caption, color: Palette.textMuted, fontSize: 11 },
  guardrailCard: { backgroundColor: `${Palette.primary}0D`, gap: 6 },
  guardrailHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  guardrailTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.primary,
  },
  guardrailText: { ...Typography.caption, color: Palette.text, lineHeight: 18 },
  sectionHeader: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  summaryCard: { gap: Spacing.xs },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  summaryVal: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  infoBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: `${Palette.primary}0D`,
    borderColor: `${Palette.primary}33`,
  },
  infoBannerTexts: { flex: 1, gap: 2 },
  infoBannerTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  infoBannerDesc: { ...Typography.caption, color: Palette.textMuted },
  configGrid: { gap: Spacing.xs },
  configCard: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  configHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  configHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  configTitle: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  configDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  migrationCard: { gap: Spacing.sm },
  migrationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  migrationHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  versionPill: {
    backgroundColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  versionText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    fontSize: 11,
  },
  migrationName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  migrationCategory: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  migrationDesc: { ...Typography.caption, color: Palette.text, lineHeight: 18 },
  collectionsBox: { gap: 4 },
  collectionsLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
    fontSize: 11,
  },
  collectionChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  colChip: {
    backgroundColor: Palette.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  colChipText: { ...Typography.caption, fontSize: 10, color: Palette.text },
  executedDate: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "600",
    fontSize: 11,
  },
  migrationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyTitle: { ...Typography.body, fontWeight: "600", color: Palette.text },
  emptyDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  historyCard: { gap: Spacing.xs },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyId: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  historyName: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  historyMetaRow: { flexDirection: "row", gap: Spacing.md, marginVertical: 2 },
  historyMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  historyError: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "600",
    fontSize: 11,
  },
  historyDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  collectionCard: { gap: Spacing.xs },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  collectionName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  collectionStatsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    paddingVertical: 2,
  },
  colStat: { flexDirection: "row", gap: 4 },
  colStatLabel: { ...Typography.caption, color: Palette.textMuted },
  colStatVal: { ...Typography.caption, fontWeight: "700", color: Palette.text },
  indexBox: {
    backgroundColor: Palette.background,
    padding: Spacing.xs,
    borderRadius: Radius.xs,
  },
  indexLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
    fontSize: 10,
  },
  indexList: { ...Typography.caption, color: Palette.text, fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 450,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalTitle: { ...Typography.h3, color: Palette.text },
  previewSub: { ...Typography.caption, color: Palette.textMuted },
  guardrailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: `${Palette.success}14`,
    padding: Spacing.xs,
    borderRadius: Radius.xs,
    marginVertical: Spacing.xs,
  },
  guardrailBoxText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "600",
    flex: 1,
  },
  previewSectionTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.sm,
  },
  previewDesc: { ...Typography.caption, color: Palette.text, lineHeight: 18 },
});
