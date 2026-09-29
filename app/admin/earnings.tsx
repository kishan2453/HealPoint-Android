/**
 * HealPoint - Hospital Admin · Smart Hospital Revenue & Financial Intelligence Center.
 * Grounded 100% in authentic verified payment, Razorpay, and appointment data.
 * Zero fabricated numbers, zero mock metrics, strictly scoped to req.hospitalAdmin.hospitalId.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import {
  formatINR,
  formatShortINR,
  generateFinancialCSV,
  getPaymentStatusBadge,
  getSeverityStyle,
} from "@/lib/hospital-finance";
import * as adminService from "@/services/admin";
import { toErrorMessage } from "@/services/api";
import type {
  FinancialReconciliationIssue,
  FinancialTransactionItem,
  HospitalFinancialOverviewResponse,
  RefundLogItem,
} from "@/types";

type ViewTab = "overview" | "ledger" | "refunds" | "reconciliation";
type RangeFilter = "all" | "today" | "week" | "month" | "year";

export default function AdminEarningsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 600;

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [range, setRange] = useState<RangeFilter>("all");
  const [trendMode, setTrendMode] = useState<"daily" | "monthly">("daily");

  // Ledger filters
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Data state
  const [data, setData] = useState<HospitalFinancialOverviewResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTx, setSelectedTx] = useState<FinancialTransactionItem | null>(
    null,
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminService.getHospitalAdminFinancialOverview({
        range,
        search: search.trim() || undefined,
        paymentStatus:
          paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
        paymentMethod:
          paymentMethodFilter !== "all" ? paymentMethodFilter : undefined,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      setError(
        toErrorMessage(err, "Unable to load financial intelligence overview."),
      );
    } finally {
      setLoading(false);
    }
  }, [range, search, paymentStatusFilter, paymentMethodFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle CSV export
  const handleExportCSV = useCallback(async () => {
    if (!data?.transactions || data.transactions.length === 0) {
      Alert.alert(
        "Export CSV",
        "No transactions found to export for the current filters.",
      );
      return;
    }
    try {
      const csvContent = generateFinancialCSV(data.transactions);
      await Share.share({
        title: `${data.hospital.name || "Hospital"} Financial Ledger`,
        message: csvContent,
      });
    } catch (err) {
      Alert.alert(
        "Export Error",
        toErrorMessage(err, "Failed to export financial CSV."),
      );
    }
  }, [data]);

  const summary = data?.summary;
  const paymentDist = data?.paymentDistribution;
  const issues = data?.reconciliationIssues || [];
  const refunds = data?.refundsLog || [];
  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  // Max value for revenue trend bars
  const trendList = useMemo(() => {
    if (trendMode === "daily") {
      return data?.revenueTrends.daily || [];
    }
    return data?.revenueTrends.monthly || [];
  }, [data, trendMode]);

  const maxTrendRevenue = useMemo(() => {
    return Math.max(1, ...trendList.map((t) => t.revenue));
  }, [trendList]);

  // Total payment distribution volume
  const totalDistVolume = useMemo(() => {
    if (!paymentDist) return 1;
    return Math.max(
      1,
      paymentDist.paid.amount +
        paymentDist.cash_pending.amount +
        paymentDist.online_pending.amount +
        paymentDist.refunded.amount +
        paymentDist.failed.amount +
        paymentDist.cancelled_unpaid.amount,
    );
  }, [paymentDist]);

  return (
    <AdminModuleScreen
      title="Financial Intelligence"
      subtitle={`${data?.hospital?.name || "Hospital"} · Verified Revenue & Settlement`}
      allowedRoles={["admin", "super_admin"]}
      loading={loading}
      error={error}
      onRetry={loadData}
      right={
        <View style={styles.headerRightRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
            onPress={handleExportCSV}
            style={styles.exportBtn}
          >
            <Ionicons
              name="download-outline"
              size={16}
              color={Palette.primary}
            />
            {!isCompact && <Text style={styles.exportBtnText}>Export CSV</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh Data"
            onPress={loadData}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh-outline" size={18} color={Palette.text} />
          </Pressable>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Time Range Selector */}
        <View style={styles.rangeSelectorRow}>
          <Text style={styles.rangeLabel}>Period:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rangeScroll}
          >
            {(
              [
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "year", label: "This Year" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setRange(opt.id);
                  setPage(1);
                }}
                style={[
                  styles.rangePill,
                  range === opt.id && styles.rangePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.rangePillText,
                    range === opt.id && styles.rangePillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Primary KPIs Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Verified Revenue"
            value={formatINR(summary?.totalVerifiedRevenue ?? 0)}
            icon="cash-outline"
            accent="#10B981"
            hint={`${summary?.paidAppointmentsCount ?? 0} paid bookings`}
          />
          <StatCard
            label="Online Gateway"
            value={formatINR(summary?.onlineRevenue ?? 0)}
            icon="card-outline"
            accent="#06B6D4"
            hint={`${summary?.onlineCount ?? 0} transactions`}
          />
          <StatCard
            label="Desk Cash"
            value={formatINR(summary?.cashRevenue ?? 0)}
            icon="wallet-outline"
            accent="#3B82F6"
            hint={`${summary?.cashCount ?? 0} collections`}
          />
          <StatCard
            label="Pending Receivables"
            value={formatINR(summary?.pendingRevenue ?? 0)}
            icon="time-outline"
            accent="#F59E0B"
            hint={`${summary?.pendingAppointmentsCount ?? 0} visits`}
          />
          <StatCard
            label="Refunds Issued"
            value={formatINR(summary?.refundedAmount ?? 0)}
            icon="refresh-circle-outline"
            accent="#8B5CF6"
            hint={`${summary?.refundedCount ?? 0} cases`}
          />
        </View>

        {/* Secondary Metrics Bar */}
        <Card style={styles.secondaryMetricsCard}>
          <View style={styles.secondaryMetricCol}>
            <Text style={styles.secondaryMetricLabel}>Avg Order Value</Text>
            <Text style={styles.secondaryMetricValue}>
              {formatINR(summary?.averageOrderValue ?? 0)}
            </Text>
          </View>
          <View style={styles.secondaryMetricDivider} />
          <View style={styles.secondaryMetricCol}>
            <Text style={styles.secondaryMetricLabel}>Total Bookings</Text>
            <Text style={styles.secondaryMetricValue}>
              {summary?.totalAppointmentsCount ?? 0}
            </Text>
          </View>
          <View style={styles.secondaryMetricDivider} />
          <View style={styles.secondaryMetricCol}>
            <Text style={styles.secondaryMetricLabel}>Payment Ratio</Text>
            <Text style={styles.secondaryMetricValue}>
              {summary?.totalAppointmentsCount
                ? `${Math.round(((summary?.paidAppointmentsCount ?? 0) / summary.totalAppointmentsCount) * 100)}%`
                : "0%"}
            </Text>
          </View>
          <View style={styles.secondaryMetricDivider} />
          <View style={styles.secondaryMetricCol}>
            <Text style={styles.secondaryMetricLabel}>Failed Gateway</Text>
            <Text
              style={[styles.secondaryMetricValue, { color: Palette.error }]}
            >
              {summary?.failedCount ?? 0}
            </Text>
          </View>
        </Card>

        {/* Tab Navigation */}
        <View style={styles.tabNavRow}>
          <Pressable
            onPress={() => setActiveTab("overview")}
            style={[
              styles.tabBtn,
              activeTab === "overview" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="pie-chart-outline"
              size={16}
              color={
                activeTab === "overview" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "overview" && styles.tabBtnTextActive,
              ]}
            >
              Overview
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("ledger")}
            style={[
              styles.tabBtn,
              activeTab === "ledger" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="receipt-outline"
              size={16}
              color={
                activeTab === "ledger" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "ledger" && styles.tabBtnTextActive,
              ]}
            >
              Ledger
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("refunds")}
            style={[
              styles.tabBtn,
              activeTab === "refunds" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={16}
              color={
                activeTab === "refunds" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "refunds" && styles.tabBtnTextActive,
              ]}
            >
              Refunds ({refunds.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("reconciliation")}
            style={[
              styles.tabBtn,
              activeTab === "reconciliation" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={
                activeTab === "reconciliation"
                  ? Palette.primary
                  : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "reconciliation" && styles.tabBtnTextActive,
              ]}
            >
              Reconciliation
            </Text>
            {issues.length > 0 && (
              <View style={styles.issueCountBadge}>
                <Text style={styles.issueCountBadgeText}>{issues.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Tab 1: Overview & Analytics */}
        {activeTab === "overview" && (
          <View style={styles.viewContent}>
            {/* Payment Status Distribution Card */}
            <Card padded style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>
                    Payment Status Distribution
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Breakdown by financial settlement state
                  </Text>
                </View>
                <Badge label="Verified Ledger" variant="success" />
              </View>

              {paymentDist && (
                <View style={styles.distBarsContainer}>
                  {/* Distribution Bar */}
                  <View style={styles.stackedBar}>
                    {paymentDist.paid.amount > 0 && (
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            backgroundColor: "#10B981",
                            flex: paymentDist.paid.amount / totalDistVolume,
                          },
                        ]}
                      />
                    )}
                    {paymentDist.cash_pending.amount > 0 && (
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            backgroundColor: "#F59E0B",
                            flex:
                              paymentDist.cash_pending.amount / totalDistVolume,
                          },
                        ]}
                      />
                    )}
                    {paymentDist.online_pending.amount > 0 && (
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            backgroundColor: "#06B6D4",
                            flex:
                              paymentDist.online_pending.amount /
                              totalDistVolume,
                          },
                        ]}
                      />
                    )}
                    {paymentDist.refunded.amount > 0 && (
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            backgroundColor: "#8B5CF6",
                            flex: paymentDist.refunded.amount / totalDistVolume,
                          },
                        ]}
                      />
                    )}
                    {paymentDist.failed.amount > 0 && (
                      <View
                        style={[
                          styles.stackedSegment,
                          {
                            backgroundColor: "#EF4444",
                            flex: paymentDist.failed.amount / totalDistVolume,
                          },
                        ]}
                      />
                    )}
                  </View>

                  {/* Status Pills Grid */}
                  <View style={styles.distPillsGrid}>
                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#10B981" }]}
                      />
                      <Text style={styles.distPillLabel}>Verified Paid</Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.paid.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.paid.count} visits)
                      </Text>
                    </View>

                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#F59E0B" }]}
                      />
                      <Text style={styles.distPillLabel}>Cash Pending</Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.cash_pending.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.cash_pending.count} visits)
                      </Text>
                    </View>

                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#06B6D4" }]}
                      />
                      <Text style={styles.distPillLabel}>Online Pending</Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.online_pending.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.online_pending.count} visits)
                      </Text>
                    </View>

                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#8B5CF6" }]}
                      />
                      <Text style={styles.distPillLabel}>Refunded</Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.refunded.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.refunded.count} visits)
                      </Text>
                    </View>

                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#EF4444" }]}
                      />
                      <Text style={styles.distPillLabel}>Failed Online</Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.failed.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.failed.count} visits)
                      </Text>
                    </View>

                    <View style={styles.distPill}>
                      <View
                        style={[styles.distDot, { backgroundColor: "#64748B" }]}
                      />
                      <Text style={styles.distPillLabel}>
                        Cancelled (Unpaid)
                      </Text>
                      <Text style={styles.distPillValue}>
                        {formatINR(paymentDist.cancelled_unpaid.amount)}
                      </Text>
                      <Text style={styles.distPillCount}>
                        ({paymentDist.cancelled_unpaid.count} visits)
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Card>

            {/* Revenue Trends Card */}
            <Card padded style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Revenue Trends</Text>
                  <Text style={styles.cardSubtitle}>
                    {trendMode === "daily"
                      ? "Daily collection history (14 Days)"
                      : "Monthly historical trajectory"}
                  </Text>
                </View>
                <View style={styles.trendToggleRow}>
                  <Pressable
                    onPress={() => setTrendMode("daily")}
                    style={[
                      styles.trendToggleBtn,
                      trendMode === "daily" && styles.trendToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.trendToggleBtnText,
                        trendMode === "daily" &&
                          styles.trendToggleBtnTextActive,
                      ]}
                    >
                      Daily
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTrendMode("monthly")}
                    style={[
                      styles.trendToggleBtn,
                      trendMode === "monthly" && styles.trendToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.trendToggleBtnText,
                        trendMode === "monthly" &&
                          styles.trendToggleBtnTextActive,
                      ]}
                    >
                      Monthly
                    </Text>
                  </Pressable>
                </View>
              </View>

              {trendList.length === 0 || maxTrendRevenue <= 1 ? (
                <EmptyState
                  title="No Revenue In This Period"
                  message="Verified booking collections will plot here automatically."
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScroll}
                >
                  <View style={styles.chartBarsRow}>
                    {trendList.map((item, idx) => {
                      const pct = Math.max(
                        6,
                        Math.round((item.revenue / maxTrendRevenue) * 100),
                      );
                      const isZero = item.revenue === 0;
                      return (
                        <View key={idx} style={styles.chartCol}>
                          <Text style={styles.chartBarValueText}>
                            {item.revenue > 0
                              ? formatShortINR(item.revenue)
                              : ""}
                          </Text>
                          <View style={styles.chartBarTrack}>
                            <View
                              style={[
                                styles.chartBarFill,
                                {
                                  height: `${pct}%`,
                                  backgroundColor: isZero
                                    ? "#334155"
                                    : Palette.primary,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={styles.chartBarLabelText}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          <Text style={styles.chartBarCountText}>
                            {item.paidCount} paid
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </Card>

            {/* Department Revenue Breakdown */}
            <Card padded style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Department Revenue</Text>
                  <Text style={styles.cardSubtitle}>
                    Verified revenue generated by hospital departments
                  </Text>
                </View>
              </View>

              {data?.departmentBreakdown &&
              data.departmentBreakdown.length > 0 ? (
                <View style={styles.deptList}>
                  {data.departmentBreakdown.map((dept, index) => {
                    const topRev =
                      data.departmentBreakdown[0]?.totalVerifiedRevenue || 1;
                    const pct = Math.max(
                      4,
                      Math.round((dept.totalVerifiedRevenue / topRev) * 100),
                    );
                    return (
                      <View key={index} style={styles.deptRow}>
                        <View style={styles.deptInfoRow}>
                          <View style={styles.deptNameCol}>
                            <Text style={styles.deptName}>
                              {dept.department}
                            </Text>
                            <Text style={styles.deptMeta}>
                              {dept.paidAppointments} paid of{" "}
                              {dept.totalAppointments} visits
                            </Text>
                          </View>
                          <Text style={styles.deptRevenue}>
                            {formatINR(dept.totalVerifiedRevenue)}
                          </Text>
                        </View>
                        <View style={styles.deptBarTrack}>
                          <View
                            style={[styles.deptBarFill, { width: `${pct}%` }]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <EmptyState
                  title="No Department Collections"
                  message="Department revenue figures will populate as appointments are booked."
                />
              )}
            </Card>

            {/* Doctor Revenue Breakdown */}
            <Card padded style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Doctor Revenue Breakdown</Text>
                  <Text style={styles.cardSubtitle}>
                    Gross verified revenue generated per practicing doctor
                  </Text>
                </View>
              </View>

              {/* Factual compliance note: no invented percentage */}
              <View style={styles.complianceNoticeBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#60A5FA"
                />
                <Text style={styles.complianceNoticeText}>
                  Revenue-share configuration not available (displaying gross
                  booking revenue generated).
                </Text>
              </View>

              {data?.doctorBreakdown && data.doctorBreakdown.length > 0 ? (
                <View style={styles.doctorList}>
                  {data.doctorBreakdown.map((doc, index) => (
                    <View key={index} style={styles.doctorRow}>
                      <View style={styles.doctorAvatarCircle}>
                        <Text style={styles.doctorAvatarText}>
                          {doc.doctorName
                            ? doc.doctorName.charAt(0).toUpperCase()
                            : "D"}
                        </Text>
                      </View>
                      <View style={styles.doctorInfoCol}>
                        <Text style={styles.doctorName}>{doc.doctorName}</Text>
                        <Text style={styles.doctorSpeciality}>
                          {doc.speciality} · {doc.department}
                        </Text>
                        <Text style={styles.doctorStatsMeta}>
                          {doc.paidAppointments} paid (
                          {doc.completedAppointments} completed)
                        </Text>
                      </View>
                      <View style={styles.doctorRevenueCol}>
                        <Text style={styles.doctorRevenueValue}>
                          {formatINR(doc.totalVerifiedRevenue)}
                        </Text>
                        <Text style={styles.doctorFeeHint}>
                          Fee: ₹{doc.doctorFees}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState
                  title="No Doctor Collections"
                  message="Doctor performance will appear here once verified bookings are processed."
                />
              )}
            </Card>

            {/* Consultation Mode Split */}
            <Card padded style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Consultation Mode Split</Text>
              <Text style={styles.cardSubtitle}>
                Physical OPD vs Online Video Care
              </Text>

              <View style={styles.modeSplitGrid}>
                <View style={styles.modeSplitCard}>
                  <View style={styles.modeIconCircle}>
                    <Ionicons
                      name="business-outline"
                      size={22}
                      color="#10B981"
                    />
                  </View>
                  <Text style={styles.modeTitle}>In-Person Clinic OPD</Text>
                  <Text style={styles.modeRevenue}>
                    {formatINR(
                      data?.consultationModeBreakdown?.clinic?.revenue ?? 0,
                    )}
                  </Text>
                  <Text style={styles.modeCount}>
                    {data?.consultationModeBreakdown?.clinic?.paidCount ?? 0}{" "}
                    paid visits (
                    {data?.consultationModeBreakdown?.clinic?.count ?? 0} total)
                  </Text>
                </View>

                <View style={styles.modeSplitCard}>
                  <View
                    style={[
                      styles.modeIconCircle,
                      { backgroundColor: "#06B6D41A" },
                    ]}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={22}
                      color="#06B6D4"
                    />
                  </View>
                  <Text style={styles.modeTitle}>
                    Online Video Consultation
                  </Text>
                  <Text style={styles.modeRevenue}>
                    {formatINR(
                      data?.consultationModeBreakdown?.video?.revenue ?? 0,
                    )}
                  </Text>
                  <Text style={styles.modeCount}>
                    {data?.consultationModeBreakdown?.video?.paidCount ?? 0}{" "}
                    paid calls (
                    {data?.consultationModeBreakdown?.video?.count ?? 0} total)
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Tab 2: Transactions Ledger */}
        {activeTab === "ledger" && (
          <View style={styles.viewContent}>
            {/* Search and Filters Bar */}
            <Card padded style={styles.filterCard}>
              <View style={styles.searchRow}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={Palette.textMuted}
                />
                <TextInput
                  value={search}
                  onChangeText={(val) => {
                    setSearch(val);
                    setPage(1);
                  }}
                  placeholder="Search patient, doctor, appointment #, payment ID..."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.searchInput}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")}>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                )}
              </View>

              {/* Status Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsScroll}
              >
                <Text style={styles.filterChipLabel}>Status:</Text>
                {[
                  "all",
                  "paid",
                  "cash_pending",
                  "online_pending",
                  "refunded",
                  "failed",
                ].map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => {
                      setPaymentStatusFilter(st);
                      setPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      paymentStatusFilter === st && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        paymentStatusFilter === st &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {st.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Method Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsScroll}
              >
                <Text style={styles.filterChipLabel}>Method:</Text>
                {["all", "cash", "online"].map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setPaymentMethodFilter(m);
                      setPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      paymentMethodFilter === m && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        paymentMethodFilter === m &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {m.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Card>

            {/* Transactions List */}
            {transactions.length === 0 ? (
              <EmptyState
                title="No Transactions Found"
                message="No appointment payments matched the active filters or search terms."
              />
            ) : (
              <View style={styles.txList}>
                {transactions.map((tx) => {
                  const badge = getPaymentStatusBadge(
                    tx.paymentStatus,
                    tx.isVerifiedPaid,
                  );
                  return (
                    <Card key={tx._id} padded style={styles.txCard}>
                      <View style={styles.txHeaderRow}>
                        <View style={styles.txIdBadge}>
                          <Text style={styles.txIdText}>
                            {tx.displayAppointmentId}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: badge.bg,
                              borderColor: badge.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: badge.text },
                            ]}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.txDetailsGrid}>
                        <View style={styles.txDetailCol}>
                          <Text style={styles.txDetailLabel}>Patient</Text>
                          <Text style={styles.txDetailValue} numberOfLines={1}>
                            {tx.patient.name}
                          </Text>
                          <Text style={styles.txDetailSub}>
                            {tx.patient.phone}
                          </Text>
                        </View>

                        <View style={styles.txDetailCol}>
                          <Text style={styles.txDetailLabel}>Doctor</Text>
                          <Text style={styles.txDetailValue} numberOfLines={1}>
                            {tx.doctor.name}
                          </Text>
                          <Text style={styles.txDetailSub}>
                            {tx.doctor.department}
                          </Text>
                        </View>

                        <View style={styles.txDetailCol}>
                          <Text style={styles.txDetailLabel}>Date & Time</Text>
                          <Text style={styles.txDetailValue}>
                            {tx.slotDate}
                          </Text>
                          <Text style={styles.txDetailSub}>{tx.slotTime}</Text>
                        </View>

                        <View style={styles.txDetailCol}>
                          <Text style={styles.txDetailLabel}>Amount</Text>
                          <Text style={styles.txAmountValue}>
                            {formatINR(tx.amount)}
                          </Text>
                          <Text style={styles.txDetailSub}>
                            {tx.paymentMethod.toUpperCase()} ·{" "}
                            {tx.consultationType.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {tx.razorpayPaymentId ? (
                        <View style={styles.txGatewayRefRow}>
                          <Ionicons
                            name="card-outline"
                            size={13}
                            color={Palette.textMuted}
                          />
                          <Text style={styles.txGatewayRefText}>
                            Ref: {tx.razorpayPaymentId}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.txActionRow}>
                        <Button
                          title="View Financial Breakdown"
                          variant="secondary"
                          icon="document-text-outline"
                          onPress={() => setSelectedTx(tx)}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
              <View style={styles.paginationRow}>
                <Button
                  title="Previous"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={styles.pageBtn}
                />
                <Text style={styles.paginationText}>
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total)
                </Text>
                <Button
                  title="Next"
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onPress={() => setPage((p) => p + 1)}
                  style={styles.pageBtn}
                />
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Refunds Log */}
        {activeTab === "refunds" && (
          <View style={styles.viewContent}>
            <Card padded style={styles.refundsSummaryBanner}>
              <View style={styles.refundsIconCircle}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={24}
                  color="#8B5CF6"
                />
              </View>
              <View style={styles.refundsSummaryInfo}>
                <Text style={styles.refundsSummaryTitle}>
                  Verified Refunds Audit Trail
                </Text>
                <Text style={styles.refundsSummaryText}>
                  Total {refunds.length} refund cases amounting to{" "}
                  {formatINR(summary?.refundedAmount ?? 0)}. All refunds are
                  synchronized with Razorpay gateway identifiers.
                </Text>
              </View>
            </Card>

            {refunds.length === 0 ? (
              <EmptyState
                title="Zero Refunds Recorded"
                message="Your hospital currently has no refunded bookings. All visits are either active, completed, or settled without refunds."
              />
            ) : (
              <View style={styles.refundsList}>
                {refunds.map((refItem: RefundLogItem) => (
                  <Card key={refItem._id} padded style={styles.refundCard}>
                    <View style={styles.refundHeaderRow}>
                      <View>
                        <Text style={styles.refundApptId}>
                          {refItem.displayAppointmentId}
                        </Text>
                        <Text style={styles.refundDate}>
                          Slot Date: {refItem.slotDate}
                        </Text>
                      </View>
                      <View style={styles.refundAmountBadge}>
                        <Text style={styles.refundAmountText}>
                          {formatINR(refItem.amount)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.refundMetaGrid}>
                      <View style={styles.refundMetaCol}>
                        <Text style={styles.refundMetaLabel}>Patient</Text>
                        <Text style={styles.refundMetaVal}>
                          {refItem.patientName}
                        </Text>
                        <Text style={styles.refundMetaSub}>
                          {refItem.patientPhone}
                        </Text>
                      </View>

                      <View style={styles.refundMetaCol}>
                        <Text style={styles.refundMetaLabel}>
                          Doctor & Wing
                        </Text>
                        <Text style={styles.refundMetaVal}>
                          {refItem.doctorName}
                        </Text>
                        <Text style={styles.refundMetaSub}>
                          {refItem.doctorDepartment}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.refundGatewayBox}>
                      <View style={styles.refundGatewayRow}>
                        <Text style={styles.refundGatewayKey}>
                          Razorpay Refund ID:
                        </Text>
                        <Text style={styles.refundGatewayVal}>
                          {refItem.razorpayRefundId}
                        </Text>
                      </View>
                      <View style={styles.refundGatewayRow}>
                        <Text style={styles.refundGatewayKey}>
                          Payment Ref:
                        </Text>
                        <Text style={styles.refundGatewayVal}>
                          {refItem.razorpayPaymentId}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab 4: Reconciliation Center */}
        {activeTab === "reconciliation" && (
          <View style={styles.viewContent}>
            {/* Real-time Audit Header */}
            <Card padded style={styles.auditHeaderCard}>
              <View style={styles.auditHeaderRow}>
                <View style={styles.auditPulseCircle}>
                  <Ionicons
                    name={
                      issues.length > 0
                        ? "warning-outline"
                        : "shield-checkmark-outline"
                    }
                    size={22}
                    color={issues.length > 0 ? "#F59E0B" : "#10B981"}
                  />
                </View>
                <View style={styles.auditHeaderTextCol}>
                  <Text style={styles.auditHeaderTitle}>
                    {issues.length > 0
                      ? `${issues.length} Financial Discrepancies Flagged`
                      : "Audit Status: All Clear (0 Discrepancies)"}
                  </Text>
                  <Text style={styles.auditHeaderSubtitle}>
                    {issues.length > 0
                      ? "Cross-referencing payment records, Razorpay IDs, and consultation statuses."
                      : "Every verified payment, appointment status, and refund match the hospital ledger perfectly."}
                  </Text>
                </View>
              </View>
            </Card>

            {/* List of Anomalies */}
            {issues.length === 0 ? (
              <EmptyState
                title="Ledger Reconciled Perfectly"
                message="No paid unconfirmed visits, uncollected completed consults, or abandoned gateway checkouts found."
              />
            ) : (
              <View style={styles.issuesList}>
                {issues.map(
                  (issue: FinancialReconciliationIssue, idx: number) => {
                    const sevStyle = getSeverityStyle(issue.severity);
                    return (
                      <Card
                        key={idx}
                        padded
                        style={[
                          styles.issueCard,
                          { borderColor: sevStyle.border },
                        ]}
                      >
                        <View style={styles.issueHeaderRow}>
                          <View
                            style={[
                              styles.issueSeverityBadge,
                              { backgroundColor: sevStyle.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.issueSeverityBadgeText,
                                { color: sevStyle.text },
                              ]}
                            >
                              {issue.severity.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.issueApptRef}>
                            {issue.displayAppointmentId}
                          </Text>
                        </View>

                        <Text style={styles.issueTitle}>{issue.title}</Text>
                        <Text style={styles.issueDesc}>
                          {issue.description}
                        </Text>

                        <View style={styles.issueContextGrid}>
                          <View style={styles.issueContextCol}>
                            <Text style={styles.issueContextKey}>Patient</Text>
                            <Text style={styles.issueContextVal}>
                              {issue.patientName}
                            </Text>
                          </View>
                          <View style={styles.issueContextCol}>
                            <Text style={styles.issueContextKey}>Doctor</Text>
                            <Text style={styles.issueContextVal}>
                              {issue.doctorName}
                            </Text>
                          </View>
                          <View style={styles.issueContextCol}>
                            <Text style={styles.issueContextKey}>Amount</Text>
                            <Text style={styles.issueContextVal}>
                              {formatINR(issue.amount)}
                            </Text>
                          </View>
                          <View style={styles.issueContextCol}>
                            <Text style={styles.issueContextKey}>Date</Text>
                            <Text style={styles.issueContextVal}>
                              {issue.slotDate}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.issueResolutionBox}>
                          <Ionicons
                            name="construct-outline"
                            size={14}
                            color="#94A3B8"
                          />
                          <Text style={styles.issueResolutionText}>
                            {issue.issueType ===
                              "PAID_BUT_PENDING_CONFIRMATION" &&
                              "Action: Confirm visit in Appointments so patient is queued."}
                            {issue.issueType === "COMPLETED_UNPAID" &&
                              "Action: Record collected desk cash or request patient payment."}
                            {issue.issueType === "ONLINE_CHECKOUT_ABANDONED" &&
                              "Action: Check Razorpay dashboard or cancel unpaid past slot."}
                            {issue.issueType ===
                              "REFUND_STATUS_INCONSISTENCY" &&
                              "Action: Update appointment status to Cancelled to sync with refund."}
                            {issue.issueType === "DUPLICATE_PAYMENT_REF" &&
                              "Action: Review multiple bookings sharing identical Razorpay payment ID."}
                          </Text>
                        </View>
                      </Card>
                    );
                  },
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Transaction Detail Modal */}
      <Modal
        visible={selectedTx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Financial Ledger Details</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedTx?.displayAppointmentId}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close Details"
                onPress={() => setSelectedTx(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {selectedTx && (
                <View style={styles.modalBody}>
                  {/* Status Banner */}
                  <View style={styles.modalStatusBanner}>
                    <Text style={styles.modalStatusAmount}>
                      {formatINR(selectedTx.amount)}
                    </Text>
                    <Badge
                      label={
                        selectedTx.isVerifiedPaid
                          ? "Verified Paid"
                          : selectedTx.paymentStatus
                      }
                      variant={
                        selectedTx.isVerifiedPaid ? "success" : "warning"
                      }
                    />
                  </View>

                  {/* Patient & Doctor Box */}
                  <View style={styles.modalSectionBox}>
                    <Text style={styles.modalSectionTitle}>
                      Parties Involved
                    </Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Patient:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.patient.name} ({selectedTx.patient.phone})
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Doctor:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.doctor.name} ({selectedTx.doctor.department}
                        )
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Slot:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.slotDate} at {selectedTx.slotTime}
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Mode:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.consultationType === "video"
                          ? "Video Consultation"
                          : "In-Person Clinic"}
                      </Text>
                    </View>
                  </View>

                  {/* Financial Breakdown */}
                  <View style={styles.modalSectionBox}>
                    <Text style={styles.modalSectionTitle}>Fee Breakdown</Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Consultation Fee:</Text>
                      <Text style={styles.modalVal}>
                        {formatINR(
                          selectedTx.billing?.consultationFee ??
                            selectedTx.amount,
                        )}
                      </Text>
                    </View>
                    {Boolean(selectedTx.billing?.serviceFee) && (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalKey}>Service Fee:</Text>
                        <Text style={styles.modalVal}>
                          {formatINR(selectedTx.billing?.serviceFee ?? 0)}
                        </Text>
                      </View>
                    )}
                    {Boolean(selectedTx.billing?.discount) && (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalKey}>Discount:</Text>
                        <Text
                          style={[styles.modalVal, { color: Palette.primary }]}
                        >
                          - {formatINR(selectedTx.billing?.discount ?? 0)}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.modalRow, styles.modalTotalRow]}>
                      <Text style={styles.modalTotalKey}>Total Amount:</Text>
                      <Text style={styles.modalTotalVal}>
                        {formatINR(selectedTx.amount)}
                      </Text>
                    </View>
                  </View>

                  {/* Gateway Verification */}
                  <View style={styles.modalSectionBox}>
                    <Text style={styles.modalSectionTitle}>
                      Payment & Gateway References
                    </Text>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Method:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.paymentMethod.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Status:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.paymentStatus}
                      </Text>
                    </View>
                    {selectedTx.razorpayPaymentId ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalKey}>
                          Razorpay Payment ID:
                        </Text>
                        <Text style={[styles.modalVal, styles.monoText]}>
                          {selectedTx.razorpayPaymentId}
                        </Text>
                      </View>
                    ) : null}
                    {selectedTx.razorpayOrderId ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalKey}>Razorpay Order ID:</Text>
                        <Text style={[styles.modalVal, styles.monoText]}>
                          {selectedTx.razorpayOrderId}
                        </Text>
                      </View>
                    ) : null}
                    {selectedTx.razorpayRefundId ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalKey}>Razorpay Refund ID:</Text>
                        <Text style={[styles.modalVal, styles.monoText]}>
                          {selectedTx.razorpayRefundId}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.modalRow}>
                      <Text style={styles.modalKey}>Recorded At:</Text>
                      <Text style={styles.modalVal}>
                        {selectedTx.paidAt
                          ? new Date(selectedTx.paidAt).toLocaleString()
                          : new Date(selectedTx.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Security Note */}
                  <View style={styles.securityBox}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={14}
                      color="#10B981"
                    />
                    <Text style={styles.securityText}>
                      Signatures and sensitive API secrets are secured
                      server-side and never transmitted.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Close"
                variant="secondary"
                onPress={() => setSelectedTx(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: `${Palette.primary}1A`,
  },
  exportBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
  },
  rangeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rangeLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  rangeScroll: {
    gap: Spacing.xs,
  },
  rangePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  rangePillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  rangePillText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  rangePillTextActive: {
    color: Palette.white,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  secondaryMetricsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  secondaryMetricCol: {
    flex: 1,
    alignItems: "center",
  },
  secondaryMetricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  secondaryMetricValue: {
    ...Typography.label,
    fontWeight: "700",
    color: Palette.text,
  },
  secondaryMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  tabNavRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  tabBtnActive: {
    backgroundColor: `${Palette.primary}1A`,
  },
  tabBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabBtnTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  issueCountBadge: {
    backgroundColor: Palette.error,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  issueCountBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  viewContent: {
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Palette.surface,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  cardTitle: {
    ...Typography.label,
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  distBarsContainer: {
    gap: Spacing.md,
  },
  stackedBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Palette.background,
    overflow: "hidden",
    flexDirection: "row",
  },
  stackedSegment: {
    height: 12,
  },
  distPillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  distPill: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  distDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  distPillLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  distPillValue: {
    ...Typography.label,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  distPillCount: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  trendToggleRow: {
    flexDirection: "row",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: 2,
  },
  trendToggleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  trendToggleBtnActive: {
    backgroundColor: Palette.surface,
  },
  trendToggleBtnText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  trendToggleBtnTextActive: {
    color: Palette.text,
    fontWeight: "700",
  },
  chartScroll: {
    paddingVertical: Spacing.sm,
  },
  chartBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
    height: 160,
    paddingTop: Spacing.md,
  },
  chartCol: {
    width: 52,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBarValueText: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
    marginBottom: 4,
  },
  chartBarTrack: {
    width: 24,
    height: 100,
    backgroundColor: Palette.background,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBarFill: {
    width: "100%",
    borderRadius: 6,
  },
  chartBarLabelText: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.text,
    marginTop: 6,
  },
  chartBarCountText: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
  },
  deptList: {
    gap: Spacing.sm,
  },
  deptRow: {
    gap: 4,
  },
  deptInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deptNameCol: {
    gap: 2,
  },
  deptName: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  deptMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  deptRevenue: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  deptBarTrack: {
    height: 6,
    backgroundColor: Palette.background,
    borderRadius: 3,
    overflow: "hidden",
  },
  deptBarFill: {
    height: 6,
    backgroundColor: Palette.primary,
    borderRadius: 3,
  },
  complianceNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#1E293B",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    borderLeftColor: "#60A5FA",
  },
  complianceNoticeText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#94A3B8",
    flex: 1,
  },
  doctorList: {
    gap: Spacing.sm,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  doctorAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Palette.primary}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorAvatarText: {
    ...Typography.label,
    color: Palette.primary,
    fontWeight: "700",
  },
  doctorInfoCol: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  doctorSpeciality: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorStatsMeta: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  doctorRevenueCol: {
    alignItems: "flex-end",
  },
  doctorRevenueValue: {
    ...Typography.body,
    fontWeight: "700",
    color: "#10B981",
  },
  doctorFeeHint: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  modeSplitGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modeSplitCard: {
    flex: 1,
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
    gap: 4,
  },
  modeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10B9811A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modeTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    textAlign: "center",
  },
  modeRevenue: {
    ...Typography.label,
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  modeCount: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
  },
  filterCard: {
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    ...Typography.body,
    color: Palette.text,
  },
  filterChipsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  filterChipLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    marginRight: 4,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: `${Palette.primary}20`,
    borderColor: Palette.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  filterChipTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  txList: {
    gap: Spacing.sm,
  },
  txCard: {
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  txHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  txIdBadge: {
    backgroundColor: Palette.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  txIdText: {
    ...Typography.caption,
    fontWeight: "700",
    fontFamily: "monospace",
    color: Palette.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
  },
  txDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  txDetailCol: {
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
  },
  txDetailLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  txDetailValue: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  txAmountValue: {
    ...Typography.body,
    fontWeight: "700",
    color: "#10B981",
  },
  txDetailSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  txGatewayRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  txGatewayRefText: {
    ...Typography.caption,
    fontFamily: "monospace",
    fontSize: 11,
    color: Palette.textMuted,
  },
  txActionRow: {
    marginTop: Spacing.xs,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  pageBtn: {
    minWidth: 80,
  },
  paginationText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  refundsSummaryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Palette.surface,
  },
  refundsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8B5CF620",
    alignItems: "center",
    justifyContent: "center",
  },
  refundsSummaryInfo: {
    flex: 1,
    gap: 2,
  },
  refundsSummaryTitle: {
    ...Typography.label,
    fontWeight: "700",
    color: Palette.text,
  },
  refundsSummaryText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  refundsList: {
    gap: Spacing.sm,
  },
  refundCard: {
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  refundHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refundApptId: {
    ...Typography.body,
    fontWeight: "700",
    fontFamily: "monospace",
    color: Palette.text,
  },
  refundDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  refundAmountBadge: {
    backgroundColor: "#8B5CF620",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  refundAmountText: {
    ...Typography.label,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  refundMetaGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  refundMetaCol: {
    flex: 1,
    gap: 2,
  },
  refundMetaLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  refundMetaVal: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  refundMetaSub: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  refundGatewayBox: {
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: 4,
  },
  refundGatewayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  refundGatewayKey: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
  },
  refundGatewayVal: {
    ...Typography.caption,
    fontSize: 11,
    fontFamily: "monospace",
    color: Palette.text,
  },
  auditHeaderCard: {
    backgroundColor: Palette.surface,
  },
  auditHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  auditPulseCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  auditHeaderTextCol: {
    flex: 1,
    gap: 2,
  },
  auditHeaderTitle: {
    ...Typography.label,
    fontWeight: "700",
    color: Palette.text,
  },
  auditHeaderSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  issuesList: {
    gap: Spacing.sm,
  },
  issueCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  issueHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  issueSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  issueSeverityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  issueApptRef: {
    ...Typography.caption,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
  issueTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  issueDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  issueContextGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    marginVertical: 4,
  },
  issueContextCol: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 1,
  },
  issueContextKey: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  issueContextVal: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  issueResolutionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  issueResolutionText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontStyle: "italic",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    ...Typography.label,
    fontWeight: "700",
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: Spacing.md,
  },
  modalBody: {
    gap: Spacing.md,
  },
  modalStatusBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  modalStatusAmount: {
    ...Typography.h2,
    fontSize: 24,
    fontWeight: "800",
    color: "#10B981",
  },
  modalSectionBox: {
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  modalSectionTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalVal: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  modalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  modalTotalKey: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  modalTotalVal: {
    ...Typography.body,
    fontWeight: "800",
    color: "#10B981",
  },
  monoText: {
    fontFamily: "monospace",
  },
  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#064E3B20",
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  securityText: {
    ...Typography.caption,
    fontSize: 10,
    color: "#059669",
    flex: 1,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
});
