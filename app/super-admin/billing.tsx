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

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
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
import { formatDDMMYYYY, formatINR } from "@/lib/format";
import * as subscriptionService from "@/services/subscriptions";
import type {
  BillingOverview,
  SubscriptionInvoice,
  SubscriptionTaxConfig,
} from "@/types";

type TabMode = "invoices" | "tax" | "reconciliation";

export default function SuperAdminSubscriptionBillingScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabMode>("invoices");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Overview Metrics
  const [overview, setOverview] = useState<BillingOverview | null>(null);

  // Invoices Directory
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] =
    useState<SubscriptionInvoice | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);

  // Tax Configuration State
  const [taxConfig, setTaxConfig] = useState<SubscriptionTaxConfig | null>(
    null,
  );
  const [editTaxModalVisible, setEditTaxModalVisible] = useState(false);
  const [editIsEnabled, setEditIsEnabled] = useState(false);
  const [editTaxName, setEditTaxName] = useState("GST");
  const [editTaxRate, setEditTaxRate] = useState("0");
  const [editTaxId, setEditTaxId] = useState("");
  const [editHsnCode, setEditHsnCode] = useState("9993");
  const [editTaxMode, setEditTaxMode] = useState<"exclusive" | "inclusive">(
    "exclusive",
  );
  const [editReason, setEditReason] = useState("");
  const [savingTax, setSavingTax] = useState(false);

  // Reconciliation State
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<{
    totalVerifiedPaymentsChecked: number;
    invoicesBackfilled: number;
    discrepanciesFound: number;
    discrepancies: Array<{
      paymentId: string;
      subscriptionId: string;
      error: string;
    }>;
    status: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [overviewRes, invoicesRes, taxRes] = await Promise.all([
        subscriptionService.getAdminBillingOverview(),
        subscriptionService.getAdminInvoices({
          search: invoiceSearch,
          billingCycle: cycleFilter !== "all" ? cycleFilter : undefined,
        }),
        subscriptionService.getSubscriptionTaxConfig(),
      ]);

      if (overviewRes && overviewRes.metrics) {
        setOverview(overviewRes);
      }
      if (invoicesRes && invoicesRes.invoices) {
        setInvoices(invoicesRes.invoices);
      }
      if (taxRes && taxRes.taxConfig) {
        setTaxConfig(taxRes.taxConfig);
        setEditIsEnabled(taxRes.taxConfig.isEnabled);
        setEditTaxName(taxRes.taxConfig.taxName || "GST");
        setEditTaxRate(String(taxRes.taxConfig.taxRate ?? 0));
        setEditTaxId(taxRes.taxConfig.taxIdentificationNumber || "");
        setEditHsnCode(taxRes.taxConfig.hsnSacCode || "9993");
        setEditTaxMode(taxRes.taxConfig.taxCalculationMode || "exclusive");
      }
    } catch (err: any) {
      setError(
        err?.message || "Failed to load billing and invoice center data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [invoiceSearch, cycleFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveTaxConfig = async () => {
    const rate = parseFloat(editTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert("Validation Error", "Tax rate must be between 0% and 100%.");
      return;
    }
    if (!editReason.trim()) {
      Alert.alert(
        "Audit Requirement",
        "Please provide a reason for updating the platform tax configuration.",
      );
      return;
    }

    setSavingTax(true);
    try {
      const res = await subscriptionService.updateSubscriptionTaxConfig({
        isEnabled: editIsEnabled,
        taxName: editTaxName.trim() || "GST",
        taxRate: rate,
        taxIdentificationNumber: editTaxId.trim(),
        hsnSacCode: editHsnCode.trim() || "9993",
        taxCalculationMode: editTaxMode,
        reason: editReason.trim(),
      });

      if (res && res.success) {
        Alert.alert(
          "Tax Settings Updated",
          `Successfully updated tax rules to Version ${res.taxConfig.version}. Historical invoices remain strictly immutable.`,
        );
        setTaxConfig(res.taxConfig);
        setEditTaxModalVisible(false);
        setEditReason("");
        loadData();
      }
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err?.message || "Could not update tax settings.",
      );
    } finally {
      setSavingTax(false);
    }
  };

  const handleRunReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await subscriptionService.reconcileSubscriptionBilling();
      setReconciliationResult(res);
      if (res.invoicesBackfilled > 0) {
        Alert.alert(
          "Reconciliation Complete",
          `Checked ${res.totalVerifiedPaymentsChecked} verified payments and backfilled ${res.invoicesBackfilled} missing invoices!`,
        );
        loadData();
      } else {
        Alert.alert(
          "Billing Synchronized",
          `All ${res.totalVerifiedPaymentsChecked} verified payments match authoritative invoices. Zero missing documents.`,
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Reconciliation Error",
        err?.message || "Failed to run billing reconciliation.",
      );
    } finally {
      setReconciling(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading Smart Billing & Tax Center..." />
      </SafeAreaView>
    );
  }

  if (error && !overview) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={Palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Subscription Billing & Tax</Text>
          <Text style={styles.headerSubtitle}>
            Smart Invoicing, Compliance & Financial Audit
          </Text>
        </View>
        <Pressable
          style={styles.refreshBtn}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh billing data"
        >
          <Ionicons name="refresh" size={20} color={Palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* KPI Metrics Summary Grid */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name="cash" size={18} color={Palette.primary} />
            </View>
            <Text style={styles.kpiValue}>
              {formatINR(overview?.metrics.totalRevenue || 0)}
            </Text>
            <Text style={styles.kpiLabel}>Verified Invoiced Revenue</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Palette.success}
              />
            </View>
            <Text style={styles.kpiValue}>
              {overview?.metrics.totalPaidInvoices || 0}
            </Text>
            <Text style={styles.kpiLabel}>Paid Invoices Issued</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[
                styles.kpiIconWrap,
                {
                  backgroundColor: taxConfig?.isEnabled ? "#EFF6FF" : "#F3F4F6",
                },
              ]}
            >
              <Ionicons
                name="receipt"
                size={18}
                color={
                  taxConfig?.isEnabled ? Palette.primary : Palette.textMuted
                }
              />
            </View>
            <Text
              style={[
                styles.kpiValue,
                {
                  fontSize: 14,
                  color: taxConfig?.isEnabled
                    ? Palette.primary
                    : Palette.textMuted,
                },
              ]}
            >
              {taxConfig?.isEnabled
                ? `${taxConfig.taxName} (${taxConfig.taxRate}%)`
                : "Not Configured"}
            </Text>
            <Text style={styles.kpiLabel}>Active Tax Rule</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View style={[styles.kpiIconWrap, { backgroundColor: "#F5F3FF" }]}>
              <Ionicons name="pie-chart" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.kpiValue}>
              {formatINR(overview?.metrics.averageOrderValue || 0)}
            </Text>
            <Text style={styles.kpiLabel}>Average Order Value</Text>
          </Card>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "invoices" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("invoices")}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={
                activeTab === "invoices" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "invoices" && styles.tabTextActive,
              ]}
            >
              Invoices Directory
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === "tax" && styles.tabBtnActive]}
            onPress={() => setActiveTab("tax")}
          >
            <Ionicons
              name="cog-outline"
              size={16}
              color={activeTab === "tax" ? Palette.primary : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "tax" && styles.tabTextActive,
              ]}
            >
              Tax Configuration
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabBtn,
              activeTab === "reconciliation" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("reconciliation")}
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
                styles.tabText,
                activeTab === "reconciliation" && styles.tabTextActive,
              ]}
            >
              Audit & Sync
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: INVOICES DIRECTORY */}
        {activeTab === "invoices" && (
          <View style={styles.tabContent}>
            {/* Search and Filters */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputBox}>
                <Ionicons name="search" size={16} color={Palette.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search invoice #, subscriber, email, payment ID..."
                  value={invoiceSearch}
                  onChangeText={setInvoiceSearch}
                  placeholderTextColor={Palette.textMuted}
                />
                {invoiceSearch ? (
                  <Pressable onPress={() => setInvoiceSearch("")}>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Cycle Filter Chips */}
            <View style={styles.filterChipRow}>
              {["all", "monthly", "yearly"].map((cycle) => (
                <Pressable
                  key={cycle}
                  style={[
                    styles.filterChip,
                    cycleFilter === cycle && styles.filterChipActive,
                  ]}
                  onPress={() => setCycleFilter(cycle)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      cycleFilter === cycle && styles.filterChipTextActive,
                    ]}
                  >
                    {cycle === "all"
                      ? "All Invoices"
                      : cycle === "monthly"
                        ? "Monthly Plans"
                        : "Yearly Plans"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Invoices List */}
            {invoices.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="document-text-outline"
                  size={40}
                  color={Palette.textMuted}
                />
                <Text style={styles.emptyTitle}>No Invoices Found</Text>
                <Text style={styles.emptySub}>
                  No subscription invoices match your query. Verified payments
                  automatically generate synchronized invoices.
                </Text>
              </Card>
            ) : (
              invoices.map((inv) => (
                <Card key={inv._id} style={styles.invoiceCard}>
                  <View style={styles.invoiceCardTop}>
                    <View>
                      <Text style={styles.invoiceNumber}>
                        {inv.invoiceNumber}
                      </Text>
                      <Text style={styles.invoiceDate}>
                        Issued:{" "}
                        {formatDDMMYYYY(
                          String(inv.paymentDetails?.paidAt || inv.createdAt),
                        )}
                      </Text>
                    </View>
                    <Badge
                      label={String(inv.status).toUpperCase()}
                      variant={inv.status === "paid" ? "success" : "neutral"}
                    />
                  </View>

                  <View style={styles.invoiceSubscriberRow}>
                    <Ionicons
                      name="person-circle-outline"
                      size={18}
                      color={Palette.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoiceSubscriberName}>
                        {inv.subscriberSnapshot.name}
                      </Text>
                      <Text style={styles.invoiceSubscriberEmail}>
                        {inv.subscriberSnapshot.email || "No email provided"} ·{" "}
                        {inv.subscriberSnapshot.subscriberType}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoicePlanDetailsBox}>
                    <View style={styles.invoiceDetailItem}>
                      <Text style={styles.detailLabel}>PLAN</Text>
                      <Text style={styles.detailValue}>
                        {inv.planSnapshot.name} (
                        {inv.planSnapshot.billingInterval})
                      </Text>
                    </View>
                    <View style={styles.invoiceDetailItem}>
                      <Text style={styles.detailLabel}>BASE</Text>
                      <Text style={styles.detailValue}>
                        {formatINR(inv.financials.baseAmount)}
                      </Text>
                    </View>
                    <View style={styles.invoiceDetailItem}>
                      <Text style={styles.detailLabel}>TAX</Text>
                      <Text style={styles.detailValue}>
                        {inv.financials.isTaxApplicable
                          ? `${formatINR(inv.financials.taxAmount)} (${inv.financials.taxRate}%)`
                          : "₹0.00"}
                      </Text>
                    </View>
                    <View style={styles.invoiceDetailItem}>
                      <Text style={styles.detailLabel}>TOTAL PAID</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: Palette.primary, fontWeight: "800" },
                        ]}
                      >
                        {formatINR(inv.financials.totalAmount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoiceCardFooter}>
                    <Text style={styles.gatewayRefText}>
                      Ref: {inv.paymentDetails.razorpayPaymentId}
                    </Text>
                    <Pressable
                      style={styles.viewInvoiceActionBtn}
                      onPress={() => {
                        setSelectedInvoice(inv);
                        setInvoiceModalVisible(true);
                      }}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={14}
                        color={Palette.primary}
                      />
                      <Text style={styles.viewInvoiceActionText}>
                        View Document
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* TAB 2: TAX CONFIGURATION */}
        {activeTab === "tax" && (
          <View style={styles.tabContent}>
            <Card style={styles.taxSettingsCard}>
              <View style={styles.taxCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taxCardTitle}>
                    Platform Tax Compliance Rules
                  </Text>
                  <Text style={styles.taxCardSub}>
                    Configure official GST/tax rules for subscription plans
                  </Text>
                </View>
                <Badge
                  label={
                    taxConfig?.isEnabled ? "TAX ENABLED" : "NOT CONFIGURED"
                  }
                  variant={taxConfig?.isEnabled ? "success" : "neutral"}
                />
              </View>

              <View style={styles.taxDetailsList}>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>Tax Status</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.isEnabled
                      ? "Active & Calculated on Invoices"
                      : "Not Configured (₹0.00 / Disabled)"}
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>Tax Label</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.taxName || "GST"}
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>Applicable Rate</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.taxRate || 0}%
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>GSTIN / Tax ID</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.taxIdentificationNumber ||
                      "Unregistered / None"}
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>HSN / SAC Code</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.hsnSacCode || "9993"} (Healthcare Services)
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>Calculation Mode</Text>
                  <Text style={styles.taxDetailVal}>
                    {taxConfig?.taxCalculationMode === "inclusive"
                      ? "Inclusive (Amount includes tax)"
                      : "Exclusive (Standard)"}
                  </Text>
                </View>
                <View style={styles.taxDetailRow}>
                  <Text style={styles.taxDetailLabel}>Current Version</Text>
                  <Text style={styles.taxDetailVal}>
                    v{taxConfig?.version || 1}
                  </Text>
                </View>
              </View>

              <Button
                title="Edit Tax Configuration"
                onPress={() => setEditTaxModalVisible(true)}
              />
            </Card>

            {/* Version History Log */}
            <Text style={styles.sectionHeading}>TAX RULE AUDIT LOG:</Text>
            {taxConfig?.versionHistory &&
            taxConfig.versionHistory.length > 0 ? (
              taxConfig.versionHistory.map((v) => (
                <Card key={v.version} style={styles.versionCard}>
                  <View style={styles.versionTop}>
                    <Text style={styles.versionTitle}>
                      Version {v.version} ·{" "}
                      {v.isEnabled ? "Enabled" : "Disabled"}
                    </Text>
                    <Text style={styles.versionDate}>
                      {formatDDMMYYYY(String(v.effectiveFrom))}
                    </Text>
                  </View>
                  <Text style={styles.versionReason}>Reason: {v.reason}</Text>
                  <Text style={styles.versionAuthor}>
                    Modified by: {v.updatedByName || "Super Admin"}
                  </Text>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptySub}>
                  No prior versions logged. Initial configuration is active.
                </Text>
              </Card>
            )}
          </View>
        )}

        {/* TAB 3: RECONCILIATION */}
        {activeTab === "reconciliation" && (
          <View style={styles.tabContent}>
            <Card style={styles.reconciliationHeroCard}>
              <View style={styles.reconcileIconRow}>
                <View style={styles.reconcileIconCircle}>
                  <Ionicons
                    name="shield-checkmark"
                    size={28}
                    color={Palette.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reconcileTitle}>
                    Billing & Document Integrity
                  </Text>
                  <Text style={styles.reconcileSub}>
                    Cross-checks verified Razorpay transactions against issued
                    invoices and repairs any missing financial documents.
                  </Text>
                </View>
              </View>

              <Button
                title={
                  reconciling
                    ? "Scanning Payments & Invoices..."
                    : "Run Billing Reconciliation Scan"
                }
                onPress={handleRunReconciliation}
                disabled={reconciling}
              />
            </Card>

            {reconciliationResult && (
              <Card style={styles.reconcileResultCard}>
                <View style={styles.reconcileResultHeader}>
                  <Ionicons
                    name={
                      reconciliationResult.status === "healthy"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={20}
                    color={
                      reconciliationResult.status === "healthy"
                        ? Palette.success
                        : Palette.warning
                    }
                  />
                  <Text style={styles.reconcileResultTitle}>
                    {reconciliationResult.status === "healthy"
                      ? "Zero Discrepancies Found"
                      : "Reconciliation Action Report"}
                  </Text>
                </View>

                <View style={styles.resultItemRow}>
                  <Text style={styles.resultLabel}>
                    Verified Payments Scanned:
                  </Text>
                  <Text style={styles.resultVal}>
                    {reconciliationResult.totalVerifiedPaymentsChecked}
                  </Text>
                </View>
                <View style={styles.resultItemRow}>
                  <Text style={styles.resultLabel}>
                    Missing Invoices Backfilled:
                  </Text>
                  <Text style={[styles.resultVal, { color: Palette.success }]}>
                    {reconciliationResult.invoicesBackfilled}
                  </Text>
                </View>
                <View style={styles.resultItemRow}>
                  <Text style={styles.resultLabel}>Discrepancies:</Text>
                  <Text
                    style={[
                      styles.resultVal,
                      {
                        color:
                          reconciliationResult.discrepanciesFound > 0
                            ? Palette.error
                            : Palette.success,
                      },
                    ]}
                  >
                    {reconciliationResult.discrepanciesFound}
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* EDIT TAX CONFIGURATION MODAL */}
      <Modal
        visible={editTaxModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditTaxModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Tax Configuration</Text>
              <Pressable onPress={() => setEditTaxModalVisible(false)}>
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormBody}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Enable Tax Calculation</Text>
                  <Text style={styles.formHelp}>
                    When disabled, all invoices display "Not configured"
                    (₹0.00).
                  </Text>
                </View>
                <Switch
                  value={editIsEnabled}
                  onValueChange={setEditIsEnabled}
                  trackColor={{
                    false: Palette.surfaceAlt,
                    true: Palette.primary,
                  }}
                />
              </View>

              <Text style={styles.formLabel}>Tax Label / Name</Text>
              <TextInput
                style={styles.formInput}
                value={editTaxName}
                onChangeText={setEditTaxName}
                placeholder="GST, VAT, etc."
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Tax Rate (%)</Text>
              <TextInput
                style={styles.formInput}
                value={editTaxRate}
                onChangeText={setEditTaxRate}
                placeholder="18"
                keyboardType="numeric"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>GSTIN / Tax ID Number</Text>
              <TextInput
                style={styles.formInput}
                value={editTaxId}
                onChangeText={setEditTaxId}
                placeholder="e.g. 27AAAAA0000A1Z5"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>HSN / SAC Code</Text>
              <TextInput
                style={styles.formInput}
                value={editHsnCode}
                onChangeText={setEditHsnCode}
                placeholder="9993"
                placeholderTextColor={Palette.textMuted}
              />

              <Text style={styles.formLabel}>Calculation Mode</Text>
              <View style={styles.modeRow}>
                <Pressable
                  style={[
                    styles.modeBtn,
                    editTaxMode === "exclusive" && styles.modeBtnActive,
                  ]}
                  onPress={() => setEditTaxMode("exclusive")}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      editTaxMode === "exclusive" && styles.modeBtnTextActive,
                    ]}
                  >
                    Exclusive
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeBtn,
                    editTaxMode === "inclusive" && styles.modeBtnActive,
                  ]}
                  onPress={() => setEditTaxMode("inclusive")}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      editTaxMode === "inclusive" && styles.modeBtnTextActive,
                    ]}
                  >
                    Inclusive
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.formLabel}>
                Change Reason (Required for Audit Log)
              </Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                value={editReason}
                onChangeText={setEditReason}
                placeholder="e.g., Annual compliance update for healthcare GST..."
                multiline
                placeholderTextColor={Palette.textMuted}
              />
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditTaxModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={savingTax ? "Saving..." : "Save Rules"}
                onPress={handleSaveTaxConfig}
                disabled={savingTax}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* VIEW INVOICE DETAIL MODAL */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons
                  name="document-text"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.modalTitle}>Tax Invoice Detail</Text>
              </View>
              <Pressable onPress={() => setInvoiceModalVisible(false)}>
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {selectedInvoice ? (
              <ScrollView contentContainerStyle={styles.invoiceDocBody}>
                {/* INVOICE NUMBER & STATUS */}
                <View style={styles.docHeaderRow}>
                  <View>
                    <Text style={styles.docInvoiceNum}>
                      {selectedInvoice.invoiceNumber}
                    </Text>
                    <Text style={styles.docDate}>
                      Issued:{" "}
                      {formatDDMMYYYY(
                        String(
                          selectedInvoice.paymentDetails?.paidAt ||
                            selectedInvoice.createdAt ||
                            "",
                        ),
                      )}
                    </Text>
                  </View>
                  <Badge
                    label={String(selectedInvoice.status).toUpperCase()}
                    variant={
                      selectedInvoice.status === "paid" ? "success" : "neutral"
                    }
                  />
                </View>

                {/* SUBSCRIBER INFO */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionLabel}>BILLED SUBSCRIBER</Text>
                  <Text style={styles.docSubscriberName}>
                    {selectedInvoice.subscriberSnapshot.name}
                  </Text>
                  <Text style={styles.docSubscriberEmail}>
                    {selectedInvoice.subscriberSnapshot.email}
                    {selectedInvoice.subscriberSnapshot.phone
                      ? ` · ${selectedInvoice.subscriberSnapshot.phone}`
                      : ""}
                  </Text>
                  <Text style={styles.docSubscriberType}>
                    Account: {selectedInvoice.subscriberSnapshot.subscriberType}
                  </Text>
                </View>

                {/* PLAN LINE ITEM */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionLabel}>
                    SUBSCRIPTION PLAN ITEM
                  </Text>
                  <Text style={styles.docPlanName}>
                    {selectedInvoice.planSnapshot.name} (
                    {selectedInvoice.planSnapshot.billingInterval})
                  </Text>
                  <Text style={styles.docEntitlement}>
                    • Included Video Consultations:{" "}
                    {selectedInvoice.planSnapshot.videoConsultationsMonthly}{" "}
                    monthly
                  </Text>
                  <Text style={styles.docEntitlement}>
                    • Family Limit:{" "}
                    {selectedInvoice.planSnapshot.familyMembersLimit} member(s)
                  </Text>
                  {selectedInvoice.coveragePeriod ? (
                    <Text style={styles.docCoverage}>
                      Coverage:{" "}
                      {formatDDMMYYYY(
                        String(selectedInvoice.coveragePeriod.startDate || ""),
                      )}{" "}
                      to{" "}
                      {formatDDMMYYYY(
                        String(selectedInvoice.coveragePeriod.expiryDate || ""),
                      )}{" "}
                      ({selectedInvoice.coveragePeriod.durationDays} Days)
                    </Text>
                  ) : null}
                </View>

                {/* FINANCIAL BREAKDOWN */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionLabel}>FINANCIAL SUMMARY</Text>
                  <View style={styles.docPriceRow}>
                    <Text style={styles.docPriceLabel}>Base Amount</Text>
                    <Text style={styles.docPriceVal}>
                      {formatINR(selectedInvoice.financials.baseAmount)}
                    </Text>
                  </View>
                  <View style={styles.docPriceRow}>
                    <Text style={styles.docPriceLabel}>
                      Tax ({selectedInvoice.financials.taxName || "GST"})
                    </Text>
                    <Text style={styles.docPriceVal}>
                      {selectedInvoice.financials.isTaxApplicable
                        ? `${formatINR(selectedInvoice.financials.taxAmount)} (${selectedInvoice.financials.taxRate}%)`
                        : "Not configured (₹0.00)"}
                    </Text>
                  </View>
                  <View style={[styles.docPriceRow, styles.docTotalRow]}>
                    <Text style={styles.docTotalLabel}>Total Paid</Text>
                    <Text style={styles.docTotalVal}>
                      {formatINR(selectedInvoice.financials.totalAmount)}
                    </Text>
                  </View>
                </View>

                {/* PAYMENT GATEWAY METADATA */}
                <View style={styles.docSection}>
                  <Text style={styles.docSectionLabel}>
                    GATEWAY VERIFICATION
                  </Text>
                  <Text style={styles.gatewayDetail}>
                    Payment ID:{" "}
                    {selectedInvoice.paymentDetails.razorpayPaymentId}
                  </Text>
                  {selectedInvoice.paymentDetails.razorpayOrderId ? (
                    <Text style={styles.gatewayDetail}>
                      Order ID: {selectedInvoice.paymentDetails.razorpayOrderId}
                    </Text>
                  ) : null}
                  <Text style={styles.gatewayDetail}>
                    Receipt Ref: {selectedInvoice.paymentDetails.receiptNumber}
                  </Text>
                </View>
              </ScrollView>
            ) : null}

            <Button
              title="Close Document"
              variant="outline"
              onPress={() => setInvoiceModalVisible(false)}
            />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  refreshBtn: {
    padding: Spacing.xs,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  /* KPI Grid */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: "46%",
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: 4,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  kpiLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },

  /* Tabs */
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  tabBtnActive: {
    backgroundColor: Palette.surface,
    ...Shadows.card,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.primary,
    fontWeight: "800",
  },
  tabContent: {
    gap: Spacing.md,
  },

  /* Search & Filter */
  searchRow: {
    flexDirection: "row",
  },
  searchInputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
  },
  filterChipRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  /* Invoice Card */
  invoiceCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  invoiceCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceNumber: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
  },
  invoiceDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  invoiceSubscriberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  invoiceSubscriberName: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  invoiceSubscriberEmail: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  invoicePlanDetailsBox: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  invoiceDetailItem: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  invoiceCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  gatewayRefText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
  viewInvoiceActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
  },
  viewInvoiceActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },

  /* Tax Tab */
  taxSettingsCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: Spacing.md,
  },
  taxCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taxCardTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  taxCardSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  taxDetailsList: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  taxDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  taxDetailLabel: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  taxDetailVal: {
    fontSize: 12,
    color: Palette.text,
    fontWeight: "700",
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  versionCard: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    gap: 4,
  },
  versionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  versionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  versionDate: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  versionReason: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  versionAuthor: {
    fontSize: 10,
    color: Palette.primary,
    fontWeight: "600",
  },

  /* Reconciliation Tab */
  reconciliationHeroCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: Spacing.md,
  },
  reconcileIconRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  reconcileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reconcileTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  reconcileSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  reconcileResultCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  reconcileResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.xs,
  },
  reconcileResultTitle: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
  },
  resultItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultLabel: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  resultVal: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },

  /* Empty State */
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    gap: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  emptySub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },

  /* Modal Form */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  modalFormBody: {
    gap: Spacing.xs,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    marginBottom: Spacing.xs,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 6,
  },
  formHelp: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  formInput: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: Palette.text,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginVertical: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modeBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  modeBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  /* Invoice Document Modal Styling */
  invoiceDocBody: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  docHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.xs,
  },
  docInvoiceNum: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
  },
  docDate: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  docSection: {
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.xs,
  },
  docSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
  },
  docSubscriberName: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  docSubscriberEmail: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  docSubscriberType: {
    fontSize: 11,
    color: Palette.primary,
    fontWeight: "600",
  },
  docPlanName: {
    fontSize: 14,
    fontWeight: "800",
    color: Palette.text,
  },
  docEntitlement: {
    fontSize: 11,
    color: Palette.text,
  },
  docCoverage: {
    fontSize: 11,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  docPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  docPriceLabel: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  docPriceVal: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  docTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: 4,
    marginTop: 2,
  },
  docTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.text,
  },
  docTotalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.primary,
  },
  gatewayDetail: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Palette.textMuted,
  },
});
