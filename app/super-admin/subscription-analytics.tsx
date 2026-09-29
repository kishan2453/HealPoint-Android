import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
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
import { formatINR } from "@/lib/format";
import * as subscriptionService from "@/services/subscriptions";
import type {
  CohortMetric,
  PlanPerformanceMetric,
  SubscriptionAnalyticsResponse,
} from "@/types";

type TimeframePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "this_year"
  | "all";
type ActiveTab =
  | "overview"
  | "plans"
  | "monthly_yearly"
  | "cohorts"
  | "video_anomalies";

const TIMEFRAME_OPTIONS: Array<{ key: TimeframePreset; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "this_month", label: "This Month" },
  { key: "this_year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default function SubscriptionAnalyticsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState<TimeframePreset>("30d");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [data, setData] = useState<SubscriptionAnalyticsResponse | null>(null);

  const loadAnalytics = useCallback(
    async (bypassCache = false) => {
      setError("");
      try {
        const res = await subscriptionService.getSubscriptionAnalytics({
          timeframe,
          refresh: bypassCache,
        });
        if (res && res.success) {
          setData(res);
        } else {
          setError("Failed to fetch analytics data");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load subscription analytics");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe],
  );

  useEffect(() => {
    setLoading(true);
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics(true);
  }, [loadAnalytics]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csvString =
        await subscriptionService.exportSubscriptionAnalyticsCSV({
          timeframe,
        });
      if (csvString) {
        await Share.share({
          title: `HealPoint-Subscription-Analytics-${timeframe}.csv`,
          message: csvString,
        });
      }
    } catch (err: any) {
      Alert.alert(
        "Export Failed",
        err?.message || "Could not export analytics CSV",
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Loading label="Computing subscription & cohort intelligence..." />
      </SafeAreaView>
    );
  }

  const kpis = data?.kpis;
  const revenue = data?.revenue;
  const planPerformance = data?.planPerformance || [];
  const funnel = data?.conversionFunnel;
  const my = data?.monthlyVsYearly;
  const cohorts = data?.cohorts || [];
  const churn = data?.churn;
  const retention = data?.retention;
  const video = data?.videoUtilization;
  const anomalies = data?.anomalies;

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
        {/* HEADER BAR */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="analytics" size={22} color={Palette.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Subscription Intelligence</Text>
              <Text style={styles.headerSubtitle}>
                Real Performance, Retention & Cohorts
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Button
              title="CSV"
              variant="outline"
              onPress={handleExportCSV}
              disabled={exporting}
              icon="download-outline"
            />
            <Button
              title=""
              variant="secondary"
              onPress={() => onRefresh()}
              icon="refresh"
            />
          </View>
        </View>

        {/* TIMEFRAME PRESET CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeframeRow}
        >
          {TIMEFRAME_OPTIONS.map((item) => {
            const isSelected = timeframe === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTimeframe(item.key)}
                style={[
                  styles.timeframeChip,
                  isSelected && styles.timeframeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeframeChipText,
                    isSelected && styles.timeframeChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FRESHNESS & RANGE STATUS */}
        <View style={styles.freshnessBar}>
          <View style={styles.freshnessBadgeRow}>
            <View style={styles.liveIndicator} />
            <Text style={styles.freshnessText}>
              {data?.freshness === "cached"
                ? `Cached (${data?.cachedSecondsAgo || 0}s ago)`
                : "Real-time Verified Data"}
            </Text>
          </View>
          <Text style={styles.freshnessRange}>
            Denominator: {kpis?.totalRegisteredUsers || 0} Registered Users
          </Text>
        </View>

        {error ? (
          <ErrorState
            title="Analytics Unavailable"
            message={error}
            onRetry={() => loadAnalytics(true)}
          />
        ) : null}

        {/* TOP KPI OVERVIEW CARDS */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Active Paid Subs</Text>
              <Ionicons name="people" size={16} color={Palette.primary} />
            </View>
            <Text style={styles.kpiValue}>
              {kpis?.activePaidSubscribers || 0}
            </Text>
            <Text style={styles.kpiSub}>
              {kpis?.activeMonthlySubscribers || 0} Mo ·{" "}
              {kpis?.activeYearlySubscribers || 0} Yr
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Verified Revenue</Text>
              <Ionicons name="cash" size={16} color={Palette.success} />
            </View>
            <Text style={[styles.kpiValue, { color: Palette.success }]}>
              {formatINR(kpis?.verifiedRevenuePeriod || 0)}
            </Text>
            <Text style={styles.kpiSub}>
              ARPU: {formatINR(kpis?.arpu || 0)}
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>New Activations</Text>
              <Ionicons name="sparkles" size={16} color={Palette.primaryDark} />
            </View>
            <Text style={styles.kpiValue}>
              {kpis?.newSubscriptionsPeriod || 0}
            </Text>
            <Text style={styles.kpiSub}>In selected period</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Renewals</Text>
              <Ionicons name="repeat" size={16} color={Palette.accent} />
            </View>
            <Text style={styles.kpiValue}>{kpis?.renewalsPeriod || 0}</Text>
            <Text style={styles.kpiSub}>
              Expirations: {kpis?.expiredSubscriptionsPeriod || 0}
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Period Churn</Text>
              <Ionicons name="exit-outline" size={16} color={Palette.error} />
            </View>
            <Text style={[styles.kpiValue, { color: Palette.error }]}>
              {churn?.churnRatePct || 0}%
            </Text>
            <Text style={styles.kpiSub}>
              Retention: {retention?.retentionRatePct || 0}%
            </Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>Failed Payments</Text>
              <Ionicons name="alert-circle" size={16} color={Palette.warning} />
            </View>
            <Text style={[styles.kpiValue, { color: Palette.warning }]}>
              {kpis?.failedPaymentsPeriodCount || 0}
            </Text>
            <Text style={styles.kpiSub}>
              {formatINR(kpis?.failedPaymentsPeriodAmount || 0)} lost
            </Text>
          </Card>
        </View>

        {/* SECTION TABS */}
        <View style={styles.tabNav}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "overview" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("overview")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "overview" && styles.tabTextActive,
              ]}
            >
              Overview & Funnel
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "plans" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("plans")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "plans" && styles.tabTextActive,
              ]}
            >
              Plans (8)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "monthly_yearly" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("monthly_yearly")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "monthly_yearly" && styles.tabTextActive,
              ]}
            >
              Mo vs Yr
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "cohorts" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("cohorts")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "cohorts" && styles.tabTextActive,
              ]}
            >
              Cohorts
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === "video_anomalies" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("video_anomalies")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "video_anomalies" && styles.tabTextActive,
              ]}
            >
              Usage & Integrity
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: OVERVIEW & FUNNEL */}
        {activeTab === "overview" && (
          <View style={styles.tabSection}>
            {/* REVENUE TREND */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Verified Revenue Trend</Text>
                  <Text style={styles.cardSub}>
                    Strictly paid payments within timeframe
                  </Text>
                </View>
                <Badge
                  label={formatINR(revenue?.verifiedRevenuePeriod || 0)}
                  variant="success"
                />
              </View>

              {revenue?.revenueTrend && revenue.revenueTrend.length > 0 ? (
                <View style={styles.trendList}>
                  {revenue.revenueTrend.map((t) => (
                    <View key={t.date} style={styles.trendRow}>
                      <Text style={styles.trendDate}>{t.date}</Text>
                      <View style={styles.trendBarContainer}>
                        <View
                          style={[
                            styles.trendBarFill,
                            {
                              width: `${Math.min(
                                Math.round(
                                  (t.revenue /
                                    Math.max(
                                      ...revenue.revenueTrend.map(
                                        (x) => x.revenue,
                                      ),
                                      1,
                                    )) *
                                    100,
                                ),
                                100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendVal}>
                        {formatINR(t.revenue)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyTrendBox}>
                  <Text style={styles.emptyTrendText}>
                    No verified revenue transactions recorded in this timeframe.
                  </Text>
                </View>
              )}
            </Card>

            {/* CONVERSION FUNNEL */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>
                    Subscription Conversion Funnel
                  </Text>
                  <Text style={styles.cardSub}>
                    Factual audit across registration, payment & activation
                  </Text>
                </View>
                <Badge
                  label={`${funnel?.freeToPaidConversionRatePct || 0}% Free→Paid`}
                  variant="primary"
                />
              </View>

              <View style={styles.funnelContainer}>
                {funnel?.stages.map((st, idx) => (
                  <View key={st.stage} style={styles.funnelStageBox}>
                    <View style={styles.funnelStageLeft}>
                      <View style={styles.funnelIndexBadge}>
                        <Text style={styles.funnelIndexText}>{idx + 1}</Text>
                      </View>
                      <View>
                        <Text style={styles.funnelStageTitle}>{st.stage}</Text>
                        <Text style={styles.funnelStageNotes}>{st.notes}</Text>
                      </View>
                    </View>

                    <View style={styles.funnelStageRight}>
                      {st.status === "untracked" ? (
                        <Badge label="Data not available" variant="neutral" />
                      ) : (
                        <Text style={styles.funnelCountText}>
                          {st.count ?? 0}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* TAB 2: PLAN PERFORMANCE */}
        {activeTab === "plans" && (
          <View style={styles.tabSection}>
            <View style={styles.planNoticeBox}>
              <Ionicons
                name="information-circle"
                size={16}
                color={Palette.primary}
              />
              <Text style={styles.planNoticeText}>
                Factual comparison across the 5 Monthly plans, 2 Yearly plans,
                and Free baseline. Neutral metrics without arbitrary ranking.
              </Text>
            </View>

            {planPerformance.map((plan: PlanPerformanceMetric) => (
              <Card key={plan.key} style={styles.planCard}>
                <View style={styles.planCardHeader}>
                  <View>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Badge
                        label={plan.billingInterval.toUpperCase()}
                        variant={
                          plan.billingInterval === "yearly"
                            ? "primary"
                            : plan.billingInterval === "monthly"
                              ? "neutral"
                              : "neutral"
                        }
                      />
                    </View>
                    <Text style={styles.planPrice}>
                      {plan.catalogPrice === 0
                        ? "₹0 (Free Baseline)"
                        : `${formatINR(plan.catalogPrice)} / ${plan.billingInterval}`}
                    </Text>
                  </View>

                  <View style={styles.planSubCountBadge}>
                    <Text style={styles.planSubCountNum}>
                      {plan.activeSubscribers}
                    </Text>
                    <Text style={styles.planSubCountLabel}>Active</Text>
                  </View>
                </View>

                <View style={styles.planMetricsGrid}>
                  <View style={styles.planMetricItem}>
                    <Text style={styles.planMetricLabel}>New Purchases</Text>
                    <Text style={styles.planMetricVal}>
                      {plan.newPurchasesPeriod}
                    </Text>
                  </View>
                  <View style={styles.planMetricItem}>
                    <Text style={styles.planMetricLabel}>Renewals</Text>
                    <Text style={styles.planMetricVal}>
                      {plan.renewalsPeriod}
                    </Text>
                  </View>
                  <View style={styles.planMetricItem}>
                    <Text style={styles.planMetricLabel}>Cancellations</Text>
                    <Text style={styles.planMetricVal}>
                      {plan.cancellationsPeriod}
                    </Text>
                  </View>
                  <View style={styles.planMetricItem}>
                    <Text style={styles.planMetricLabel}>Verified Rev</Text>
                    <Text
                      style={[styles.planMetricVal, { color: Palette.success }]}
                    >
                      {formatINR(plan.verifiedRevenue)}
                    </Text>
                  </View>
                </View>

                {/* VIDEO CONSULTATION QUOTA PROGRESS */}
                {plan.videoQuotaPerUser > 0 ? (
                  <View style={styles.planQuotaBox}>
                    <View style={styles.quotaHeaderRow}>
                      <Text style={styles.quotaTitle}>
                        Video Consultation Quota
                      </Text>
                      <Text style={styles.quotaValText}>
                        {plan.totalQuotaUsed} / {plan.totalQuotaAllocated}{" "}
                        visits ({plan.videoUtilizationRate}%)
                      </Text>
                    </View>
                    <View style={styles.quotaBarTrack}>
                      <View
                        style={[
                          styles.quotaBarFill,
                          {
                            width: `${Math.min(plan.videoUtilizationRate, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}

        {/* TAB 3: MONTHLY VS YEARLY COMPARISON */}
        {activeTab === "monthly_yearly" && (
          <View style={styles.tabSection}>
            <Card style={styles.sectionCard}>
              <Text style={styles.cardTitle}>
                Monthly vs Yearly Distribution
              </Text>
              <Text style={styles.cardSub}>
                Objective comparison based strictly on active subscribers and
                verified revenue.
              </Text>

              {/* SUBSCRIBERS SPLIT BAR */}
              <View style={styles.splitSection}>
                <View style={styles.splitHeaderRow}>
                  <Text style={styles.splitTitle}>
                    Subscribers Distribution
                  </Text>
                  <Text style={styles.splitLegend}>
                    Monthly ({my?.monthly.subscribersSharePct}%) · Yearly (
                    {my?.yearly.subscribersSharePct}%)
                  </Text>
                </View>
                <View style={styles.splitBar}>
                  <View
                    style={[
                      styles.splitBarSegment,
                      {
                        backgroundColor: Palette.primary,
                        flex: Math.max(my?.monthly.activeSubscribers || 0, 1),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.splitBarSegment,
                      {
                        backgroundColor: Palette.gold,
                        flex: Math.max(my?.yearly.activeSubscribers || 0, 1),
                      },
                    ]}
                  />
                </View>
              </View>

              {/* REVENUE SPLIT BAR */}
              <View style={styles.splitSection}>
                <View style={styles.splitHeaderRow}>
                  <Text style={styles.splitTitle}>Revenue Distribution</Text>
                  <Text style={styles.splitLegend}>
                    Monthly ({my?.monthly.revenueSharePct}%) · Yearly (
                    {my?.yearly.revenueSharePct}%)
                  </Text>
                </View>
                <View style={styles.splitBar}>
                  <View
                    style={[
                      styles.splitBarSegment,
                      {
                        backgroundColor: Palette.success,
                        flex: Math.max(my?.monthly.verifiedRevenue || 0, 1),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.splitBarSegment,
                      {
                        backgroundColor: Palette.primaryDark,
                        flex: Math.max(my?.yearly.verifiedRevenue || 0, 1),
                      },
                    ]}
                  />
                </View>
              </View>

              {/* COMPARISON METRICS TABLE */}
              <View style={styles.comparisonTable}>
                <View style={styles.comparisonHeaderRow}>
                  <Text style={[styles.comparisonTh, { flex: 2 }]}>Metric</Text>
                  <Text style={styles.comparisonTh}>Monthly</Text>
                  <Text style={styles.comparisonTh}>Yearly</Text>
                </View>

                <View style={styles.comparisonTr}>
                  <Text
                    style={[
                      styles.comparisonTd,
                      { flex: 2, fontWeight: "600" },
                    ]}
                  >
                    Active Subscribers
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.monthly.activeSubscribers || 0}
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.yearly.activeSubscribers || 0}
                  </Text>
                </View>

                <View style={styles.comparisonTr}>
                  <Text
                    style={[
                      styles.comparisonTd,
                      { flex: 2, fontWeight: "600" },
                    ]}
                  >
                    Verified Revenue
                  </Text>
                  <Text
                    style={[styles.comparisonTd, { color: Palette.success }]}
                  >
                    {formatINR(my?.monthly.verifiedRevenue || 0)}
                  </Text>
                  <Text
                    style={[styles.comparisonTd, { color: Palette.success }]}
                  >
                    {formatINR(my?.yearly.verifiedRevenue || 0)}
                  </Text>
                </View>

                <View style={styles.comparisonTr}>
                  <Text
                    style={[
                      styles.comparisonTd,
                      { flex: 2, fontWeight: "600" },
                    ]}
                  >
                    Avg Membership Length
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.monthly.averageDurationDays || 30} days
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.yearly.averageDurationDays || 365} days
                  </Text>
                </View>

                <View style={styles.comparisonTr}>
                  <Text
                    style={[
                      styles.comparisonTd,
                      { flex: 2, fontWeight: "600" },
                    ]}
                  >
                    Video Quota Utilization
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.monthly.videoUtilizationPct || 0}%
                  </Text>
                  <Text style={styles.comparisonTd}>
                    {my?.yearly.videoUtilizationPct || 0}%
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* TAB 4: COHORT INTELLIGENCE */}
        {activeTab === "cohorts" && (
          <View style={styles.tabSection}>
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Activation Cohort Matrix</Text>
                  <Text style={styles.cardSub}>
                    Subscribers grouped by month of initial subscription
                    activation
                  </Text>
                </View>
              </View>

              {/* DEFINITION CALLOUT */}
              <View style={styles.definitionBox}>
                <Text style={styles.definitionTitle}>RETENTION DEFINITION</Text>
                <Text style={styles.definitionBody}>
                  {retention?.definition ||
                    "Percentage of cohort subscribers who maintained an active subscription 30+ days after activation."}
                </Text>
              </View>

              {cohorts.length === 0 ? (
                <View style={styles.emptyTrendBox}>
                  <Text style={styles.emptyTrendText}>
                    No activation cohort data found in the current database.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.cohortTable}>
                    <View style={styles.cohortHeaderRow}>
                      <Text style={[styles.cohortTh, { width: 90 }]}>
                        Cohort
                      </Text>
                      <Text style={[styles.cohortTh, { width: 75 }]}>
                        Activated
                      </Text>
                      <Text style={[styles.cohortTh, { width: 90 }]}>
                        Active 30d+
                      </Text>
                      <Text style={[styles.cohortTh, { width: 95 }]}>
                        Retention %
                      </Text>
                      <Text style={[styles.cohortTh, { width: 75 }]}>
                        Renewed
                      </Text>
                      <Text style={[styles.cohortTh, { width: 75 }]}>
                        Expired
                      </Text>
                      <Text style={[styles.cohortTh, { width: 75 }]}>
                        Cancelled
                      </Text>
                    </View>

                    {cohorts.map((c: CohortMetric) => (
                      <View key={c.cohortMonth} style={styles.cohortRow}>
                        <Text
                          style={[
                            styles.cohortTd,
                            { width: 90, fontWeight: "700" },
                          ]}
                        >
                          {c.cohortMonth}
                        </Text>
                        <Text style={[styles.cohortTd, { width: 75 }]}>
                          {c.activated}
                        </Text>
                        <Text style={[styles.cohortTd, { width: 90 }]}>
                          {c.activeAfter30Days}
                        </Text>
                        <Text
                          style={[
                            styles.cohortTd,
                            {
                              width: 95,
                              fontWeight: "700",
                              color:
                                c.retention30dRate >= 70
                                  ? Palette.success
                                  : c.retention30dRate >= 40
                                    ? Palette.warning
                                    : Palette.text,
                            },
                          ]}
                        >
                          {c.retention30dRate}%
                        </Text>
                        <Text style={[styles.cohortTd, { width: 75 }]}>
                          {c.renewed}
                        </Text>
                        <Text
                          style={[
                            styles.cohortTd,
                            { width: 75, color: Palette.error },
                          ]}
                        >
                          {c.expired}
                        </Text>
                        <Text
                          style={[
                            styles.cohortTd,
                            { width: 75, color: Palette.textMuted },
                          ]}
                        >
                          {c.cancelled}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Card>
          </View>
        )}

        {/* TAB 5: USAGE & INTEGRITY */}
        {activeTab === "video_anomalies" && (
          <View style={styles.tabSection}>
            {/* VIDEO QUOTA UTILIZATION */}
            <Card style={styles.sectionCard}>
              <Text style={styles.cardTitle}>
                Video Consultation Utilization
              </Text>
              <Text style={styles.cardSub}>
                Platform-wide teleconsultation quota consumption
              </Text>

              <View style={styles.videoQuotaGrid}>
                <View style={styles.videoQuotaItem}>
                  <Text style={styles.videoQuotaNum}>
                    {video?.totalIncludedQuota || 0}
                  </Text>
                  <Text style={styles.videoQuotaLabel}>Included Quota</Text>
                </View>
                <View style={styles.videoQuotaItem}>
                  <Text
                    style={[styles.videoQuotaNum, { color: Palette.primary }]}
                  >
                    {video?.totalConsumedQuota || 0}
                  </Text>
                  <Text style={styles.videoQuotaLabel}>Consumed</Text>
                </View>
                <View style={styles.videoQuotaItem}>
                  <Text
                    style={[styles.videoQuotaNum, { color: Palette.success }]}
                  >
                    {video?.totalRemainingQuota || 0}
                  </Text>
                  <Text style={styles.videoQuotaLabel}>Remaining</Text>
                </View>
                <View style={styles.videoQuotaItem}>
                  <Text style={styles.videoQuotaNum}>
                    {video?.overallUtilizationPct || 0}%
                  </Text>
                  <Text style={styles.videoQuotaLabel}>Utilization Rate</Text>
                </View>
              </View>

              <View style={styles.quotaDistributionRow}>
                <View style={styles.quotaDistItem}>
                  <Text style={styles.quotaDistNum}>
                    {video?.subscribersQuotaExhausted || 0}
                  </Text>
                  <Text style={styles.quotaDistLabel}>
                    Users 100% Exhausted
                  </Text>
                </View>
                <View style={styles.quotaDistItem}>
                  <Text style={styles.quotaDistNum}>
                    {video?.subscribersZeroUsage || 0}
                  </Text>
                  <Text style={styles.quotaDistLabel}>
                    Users 0% Consultations
                  </Text>
                </View>
              </View>
            </Card>

            {/* INTEGRITY & RECONCILIATION ANOMALIES */}
            <Card style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>
                    Revenue & Quota Anomalies
                  </Text>
                  <Text style={styles.cardSub}>
                    Live feed from Smart Revenue Protection & Data Quality
                  </Text>
                </View>
                <Badge
                  label={`${anomalies?.totalOpenIssues || 0} Open`}
                  variant={anomalies?.totalOpenIssues ? "error" : "success"}
                />
              </View>

              <View style={styles.anomalySummaryBox}>
                <Text style={styles.anomalySummaryText}>
                  {anomalies?.criticalCount || 0} Critical ·{" "}
                  {anomalies?.highCount || 0} High ·{" "}
                  {video?.quotaAnomaliesCount || 0} Quota Anomalies Detected
                </Text>
                <Button
                  title="Open Revenue Protection Center"
                  variant="primary"
                  onPress={() =>
                    router.push("/super-admin/subscription-lifecycle")
                  }
                  icon="shield-checkmark"
                />
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
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
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerIconCircle: {
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  timeframeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  timeframeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  timeframeChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  timeframeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  timeframeChipTextActive: {
    color: "#fff",
  },
  freshnessBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  freshnessBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.success,
  },
  freshnessText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  freshnessRange: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
    gap: 4,
  },
  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Palette.text,
  },
  kpiSub: {
    fontSize: 11,
    color: Palette.textMuted,
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
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: "#fff",
  },
  tabSection: {
    gap: Spacing.md,
  },
  sectionCard: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  cardSub: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  trendList: {
    gap: Spacing.xs,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  trendDate: {
    width: 75,
    fontSize: 11,
    color: Palette.textMuted,
  },
  trendBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    backgroundColor: Palette.success,
    borderRadius: Radius.pill,
  },
  trendVal: {
    width: 75,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.text,
    textAlign: "right",
  },
  emptyTrendBox: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyTrendText: {
    fontSize: 12,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  funnelContainer: {
    gap: Spacing.sm,
  },
  funnelStageBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  funnelStageLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  funnelIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  funnelIndexText: {
    fontSize: 11,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  funnelStageTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  funnelStageNotes: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  funnelStageRight: {
    alignItems: "flex-end",
  },
  funnelCountText: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.primary,
  },
  planNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  planNoticeText: {
    fontSize: 12,
    color: Palette.primaryDark,
    flex: 1,
  },
  planCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  planName: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  planPrice: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  planSubCountBadge: {
    alignItems: "center",
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  planSubCountNum: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.primary,
  },
  planSubCountLabel: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  planMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  planMetricItem: {
    alignItems: "center",
  },
  planMetricLabel: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  planMetricVal: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  planQuotaBox: {
    gap: 4,
    marginTop: Spacing.xs,
  },
  quotaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quotaTitle: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  quotaValText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },
  quotaBarTrack: {
    height: 6,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  quotaBarFill: {
    height: "100%",
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
  },
  splitSection: {
    gap: 4,
  },
  splitHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  splitLegend: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  splitBar: {
    height: 12,
    flexDirection: "row",
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  splitBarSegment: {
    height: "100%",
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
    marginTop: Spacing.xs,
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
  },
  comparisonTh: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: Palette.textMuted,
  },
  comparisonTr: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    padding: Spacing.sm,
  },
  comparisonTd: {
    flex: 1,
    fontSize: 12,
    color: Palette.text,
  },
  definitionBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: 2,
  },
  definitionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  definitionBody: {
    fontSize: 11,
    color: Palette.text,
  },
  cohortTable: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  cohortHeaderRow: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
  },
  cohortTh: {
    fontSize: 11,
    fontWeight: "800",
    color: Palette.textMuted,
  },
  cohortRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    padding: Spacing.sm,
  },
  cohortTd: {
    fontSize: 12,
    color: Palette.text,
  },
  videoQuotaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  videoQuotaItem: {
    alignItems: "center",
  },
  videoQuotaNum: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.text,
  },
  videoQuotaLabel: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  quotaDistributionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  quotaDistItem: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
  },
  quotaDistNum: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  quotaDistLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    textAlign: "center",
  },
  anomalySummaryBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
    alignItems: "center",
  },
  anomalySummaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.error,
  },
});
