/**
 * HealPoint — Super Admin · Health Data Portability & Export Monitoring Console.
 *
 * Provides platform-wide observability and security governance over:
 * - Real-time export compilation metrics
 * - Active / expired / failed job distributions
 * - External share lifecycle & revocation monitoring
 * - Data minimization and storage security policy verification
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
import * as healthExportService from "@/services/healthExport";
import type { HealthExportJob, SuperAdminExportMonitoringData } from "@/types";

export default function SuperAdminExportMonitoringScreen() {
  const router = useRouter();
  const [data, setData] = useState<SuperAdminExportMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMonitoring = useCallback(async () => {
    try {
      setError(null);
      const res = await healthExportService.getSuperAdminExportMonitoring();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load export monitoring metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMonitoring();
  }, [loadMonitoring]);

  const renderStatusBadge = (status: string) => {
    let variant: BadgeVariant = "neutral";
    if (status === "ready") variant = "success";
    if (status === "preparing" || status === "requested") variant = "warning";
    if (status === "downloaded") variant = "primary";
    if (status === "failed") variant = "error";
    if (status === "expired") variant = "neutral";
    return <Badge label={status.toUpperCase()} variant={variant} />;
  };

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
              <Text style={styles.headerTitle}>
                Export Security & Monitoring
              </Text>
              <Text style={styles.headerSubtitle}>
                Health Data Portability Governance
              </Text>
            </View>
          </View>
          <Pressable onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={Palette.primary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Palette.primary]}
            />
          }
        >
          {loading ? (
            <Loading label="Aggregating platform export telemetry..." />
          ) : error ? (
            <ErrorState
              title="Telemetry Error"
              message={error}
              onRetry={loadMonitoring}
            />
          ) : !data ? null : (
            <>
              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>TOTAL EXPORTS</Text>
                  <Text style={styles.metricValue}>
                    {data.metrics.totalExports}
                  </Text>
                  <Text style={styles.metricSub}>All-time compiled</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>READY PACKAGES</Text>
                  <Text
                    style={[styles.metricValue, { color: Palette.success }]}
                  >
                    {data.metrics.readyExports}
                  </Text>
                  <Text style={styles.metricSub}>Active for download</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>PREPARING / QUEUED</Text>
                  <Text
                    style={[styles.metricValue, { color: Palette.warning }]}
                  >
                    {data.metrics.preparingExports}
                  </Text>
                  <Text style={styles.metricSub}>Compiling in background</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>EXPIRED EXPORTS</Text>
                  <Text style={styles.metricValue}>
                    {data.metrics.expiredExports}
                  </Text>
                  <Text style={styles.metricSub}>Past 72h retention</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>ACTIVE SHARES</Text>
                  <Text
                    style={[styles.metricValue, { color: Palette.primary }]}
                  >
                    {data.metrics.activeShares}
                  </Text>
                  <Text style={styles.metricSub}>Active external links</Text>
                </Card>

                <Card style={styles.metricCard}>
                  <Text style={styles.metricLabel}>REVOKED SHARES</Text>
                  <Text style={[styles.metricValue, { color: Palette.error }]}>
                    {data.metrics.revokedShares}
                  </Text>
                  <Text style={styles.metricSub}>Revoked by patients</Text>
                </Card>
              </View>

              {/* Security Policy & Governance Settings */}
              <Card style={styles.policyCard}>
                <View style={styles.policyHeader}>
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={Palette.primary}
                  />
                  <Text style={styles.policyTitle}>
                    Security & Privacy Governance
                  </Text>
                </View>
                <Text style={styles.policyDesc}>
                  Configured policies strictly enforced on all patient-initiated
                  export jobs.
                </Text>

                <View style={styles.policyList}>
                  <View style={styles.policyItem}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={styles.policyTextCol}>
                      <Text style={styles.policyKey}>Retention Window</Text>
                      <Text style={styles.policyVal}>
                        {data.securityConfig.defaultRetentionHours} hours
                        (Automatic cleanup after expiry)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.policyItem}>
                    <Ionicons
                      name="speedometer-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={styles.policyTextCol}>
                      <Text style={styles.policyKey}>Rate Limiting</Text>
                      <Text style={styles.policyVal}>
                        Max {data.securityConfig.maxDailyExportsPerPatient}{" "}
                        export compilation requests / 24h per patient
                      </Text>
                    </View>
                  </View>

                  <View style={styles.policyItem}>
                    <Ionicons
                      name="download-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={styles.policyTextCol}>
                      <Text style={styles.policyKey}>Download Cap</Text>
                      <Text style={styles.policyVal}>
                        Max {data.securityConfig.maxDownloadsPerPackage}{" "}
                        downloads per compiled export package
                      </Text>
                    </View>
                  </View>

                  <View style={styles.policyItem}>
                    <Ionicons
                      name="finger-print-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={styles.policyTextCol}>
                      <Text style={styles.policyKey}>Data Integrity</Text>
                      <Text style={styles.policyVal}>
                        SHA-256 cryptographic checksum verified on generation
                        and download
                      </Text>
                    </View>
                  </View>

                  <View style={styles.policyItem}>
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <View style={styles.policyTextCol}>
                      <Text style={styles.policyKey}>Family Isolation</Text>
                      <Text style={styles.policyVal}>
                        Dependents strictly isolated; parent accounts cannot
                        export mismatched member records
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/* Recent Export Jobs Audit Trail */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Recent Platform Export Jobs
                </Text>
                <Badge
                  label={`${data.recentJobs.length} Jobs Logged`}
                  variant="neutral"
                />
              </View>

              {data.recentJobs.length === 0 ? (
                <EmptyState
                  title="No Export Jobs"
                  message="No export activity has been requested across the platform yet."
                />
              ) : (
                data.recentJobs.map((job) => (
                  <Card key={job._id} style={styles.jobCard}>
                    <View style={styles.jobHeader}>
                      <View>
                        <Text style={styles.jobExportId}>{job.exportId}</Text>
                        <Text style={styles.jobPatient}>
                          Patient: {job.patientName}{" "}
                          {job.familyMemberName
                            ? `(Dep: ${job.familyMemberName})`
                            : ""}
                        </Text>
                      </View>
                      {renderStatusBadge(job.status)}
                    </View>

                    <View style={styles.jobMetaRow}>
                      <Badge
                        label={job.format.toUpperCase()}
                        variant="neutral"
                      />
                      <Text style={styles.jobMetaText}>
                        {job.recordsSummary?.totalRecords || 0} Records
                      </Text>
                      {job.fileSize ? (
                        <Text style={styles.jobMetaText}>
                          {(job.fileSize / 1024).toFixed(1)} KB
                        </Text>
                      ) : null}
                      <Text style={styles.jobMetaText}>
                        Downloads: {job.downloadCount}/{job.maxDownloads}
                      </Text>
                    </View>

                    <View style={styles.jobFooter}>
                      <Text style={styles.jobDate}>
                        Created: {new Date(job.createdAt).toLocaleString()}
                      </Text>
                      <Text style={styles.jobDate}>
                        Expires: {new Date(job.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>

                    {job.checksum && (
                      <Text style={styles.checksumText}>
                        SHA-256: {job.checksum.slice(0, 24)}...
                      </Text>
                    )}
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  refreshBtn: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: "46%",
    padding: Spacing.md,
    gap: 2,
  },
  metricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  metricValue: {
    ...Typography.h2,
    color: Palette.text,
    fontWeight: "700",
  },
  metricSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  policyCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  policyTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  policyDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  policyList: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  policyTextCol: {
    flex: 1,
  },
  policyKey: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  policyVal: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  jobCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobExportId: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
  },
  jobPatient: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  jobMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: 4,
  },
  jobMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  jobFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  jobDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  checksumText: {
    fontSize: 10,
    color: Palette.textMuted,
    fontFamily: "monospace",
    marginTop: 2,
  },
});
