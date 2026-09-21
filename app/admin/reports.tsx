/**
 * HealPoint - Hospital Admin · Reports & Analytics.
 * Pulls REAL analytics data from getHospitalAdminDashboard API endpoint.
 * No fabricated data, purely server-derived hospital trends.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { StatCard } from "@/components/admin/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatINR } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type { HospitalAdminDashboardResponse } from "@/types";

export default function AdminReportsScreen() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<HospitalAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminService.getHospitalAdminDashboard();
      setData(res);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load analytics data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dashboard = data?.dashboard;
  const totals = dashboard?.totals;
  const monthly = dashboard?.monthly || [];
  const weekly = dashboard?.weekly || [];

  const maxMonthlyRevenue = Math.max(
    1,
    ...monthly.map((m: any) => Number(m.value) || 0),
  );
  const maxWeeklyApps = Math.max(
    1,
    ...weekly.map((w: any) => Number(w.value) || 0),
  );

  return (
    <AdminModuleScreen
      title="Reports & Analytics"
      subtitle="Insights across your hospital"
      allowedRoles={["admin", "super_admin"]}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.grid}>
          <StatCard
            label="Total Bookings"
            value={(totals as any)?.totalAppointments || 0}
            icon="calendar-outline"
            accent="#2F80ED"
          />
          <StatCard
            label="Completed Visits"
            value={totals?.completed || 0}
            icon="checkmark-done-outline"
            accent="#0E9F8E"
          />
          <StatCard
            label="Total Revenue"
            value={formatINR(totals?.revenue || 0)}
            icon="wallet-outline"
            accent="#2E9E5B"
          />
          <StatCard
            label="Active Doctors"
            value={(totals as any)?.availableDoctors || 0}
            icon="medkit-outline"
            accent="#7B61FF"
          />
        </View>

        {monthly.length > 0 ? (
          <Card padded style={styles.chartCard}>
            <Text style={styles.chartTitle}>Monthly Revenue Trend</Text>
            <View style={styles.chartContainer}>
              {monthly.map((m: any, i: number) => {
                const heightPct = Math.max(
                  5,
                  Math.round(
                    ((Number(m.value) || 0) / maxMonthlyRevenue) * 100,
                  ),
                );
                return (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValueTop} numberOfLines={1}>
                      {Number(m.value) > 0
                        ? `₹` +
                          (Number(m.value) > 1000
                            ? (Number(m.value) / 1000).toFixed(1) + "k"
                            : m.value)
                        : "0"}
                    </Text>
                    <View style={styles.barVerticalTrack}>
                      <View
                        style={[
                          styles.barVerticalFill,
                          {
                            height: `${heightPct}%` as `${number}%`,
                            backgroundColor: "#2E9E5B",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabelBottom}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {weekly.length > 0 ? (
          <Card padded style={styles.chartCard}>
            <Text style={styles.chartTitle}>Weekly Appointments Trend</Text>
            <View style={styles.chartContainer}>
              {weekly.map((w: any, i: number) => {
                const heightPct = Math.max(
                  5,
                  Math.round(((Number(w.value) || 0) / maxWeeklyApps) * 100),
                );
                return (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValueTop}>{w.value}</Text>
                    <View style={styles.barVerticalTrack}>
                      <View
                        style={[
                          styles.barVerticalFill,
                          {
                            height: `${heightPct}%` as `${number}%`,
                            backgroundColor: "#2F80ED",
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabelBottom}>{w.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {!loading && monthly.length === 0 && weekly.length === 0 ? (
          <EmptyState
            title="No analytics data"
            message="We need more historical data to generate charts."
          />
        ) : null}
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  sectionTitle: { ...Typography.h4, color: Palette.text },
  chartCard: { gap: Spacing.md, paddingTop: Spacing.lg },
  chartTitle: { ...Typography.label, color: Palette.textMuted },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
    marginTop: Spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  barValueTop: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.text,
    textAlign: "center",
  },
  barVerticalTrack: {
    width: 24,
    height: 120,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barVerticalFill: {
    width: "100%",
    borderRadius: Radius.pill,
  },
  barLabelBottom: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
});
