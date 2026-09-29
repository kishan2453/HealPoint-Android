/**
 * HealPoint - Patient Subscription & Healthcare Membership Center
 *
 * Upgraded tier structure:
 *  - 5 Monthly Plans:
 *      1. Care Starter  (₹249/mo  ·  2 Video Visits/mo · 1 Member)
 *      2. Care Plus     (₹499/mo  ·  4 Video Visits/mo · 2 Members)
 *      3. Care Pro      (₹799/mo  ·  6 Video Visits/mo · 4 Members)
 *      4. Family Care   (₹1,099/mo · 8 Video Visits/mo · 6 Members)
 *      5. Family Prime  (₹1,499/mo · 10 Video Visits/mo · 10 Members)
 *
 *  - 2 Yearly Plans:
 *      1. Annual Care Pro     (₹7,999/yr  · Save ₹1,589 [16.6% off] · 72 Visits/yr · 4 Members)
 *      2. Annual Family Prime (₹11,999/yr · Save ₹5,989 [33.3% off / 4 mos free] · 120 Visits/yr · 10 Members)
 *
 *  - Separate Free Baseline:
 *      ₹0 (Unlimited clinic appointments, digital health wallet, records)
 */

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatINR } from "@/lib/format";
import { openRazorpayCheckout } from "@/lib/razorpay";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  getEntitlementBadge,
  getPlanVideoLimit,
  getQuotaUsagePercent,
} from "@/lib/subscription-entitlement";
import { toErrorMessage } from "@/services/api";
import * as subscriptionService from "@/services/subscriptions";
import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionReceipt,
  SubscriptionInvoice,
  UserSubscriptionEntitlement,
  PromotionValidationResponse,
} from "@/types";

type BillingViewTab = "monthly" | "yearly";

export default function PatientSubscriptionScreen() {
  const params = useLocalSearchParams<{ notice?: string }>();

  const [entitlement, setEntitlement] =
    useState<UserSubscriptionEntitlement | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(
    DEFAULT_SUBSCRIPTION_PLANS,
  );
  const [activeTab, setActiveTab] = useState<BillingViewTab>("monthly");
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [selectedReceipt, setSelectedReceipt] =
    useState<SubscriptionReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [entitlementsModalVisible, setEntitlementsModalVisible] =
    useState(false);

  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] =
    useState<SubscriptionInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);

  const handleViewReceipt = async (paymentId: string) => {
    setReceiptLoading(true);
    try {
      const res = await subscriptionService.getSubscriptionReceipt(paymentId);
      if (res && res.success && res.receipt) {
        setSelectedReceipt(res.receipt);
        setReceiptModalVisible(true);
      } else {
        Alert.alert("Receipt Error", "Unable to load verified receipt.");
      }
    } catch (err: any) {
      Alert.alert("Receipt Error", err?.message || "Failed to load receipt");
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleViewInvoice = async (paymentIdOrInvoiceId: string) => {
    setInvoiceLoading(true);
    try {
      // Find from loaded list first
      let found = invoices.find(
        (inv) =>
          inv._id === paymentIdOrInvoiceId ||
          inv.paymentDetails?.razorpayPaymentId === paymentIdOrInvoiceId ||
          inv.invoiceNumber === paymentIdOrInvoiceId,
      );
      if (!found) {
        const res =
          await subscriptionService.getSubscriptionInvoiceById(
            paymentIdOrInvoiceId,
          );
        if (res && res.success && res.invoice) {
          found = res.invoice;
        }
      }
      if (found) {
        setSelectedInvoice(found);
        setInvoiceModalVisible(true);
      } else {
        // If invoice is being generated, prompt receipt fallback
        Alert.alert(
          "Invoice Processing",
          "This verified payment is linked to your account. You can view the instant receipt now while the formal invoice compiles.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View Receipt",
              onPress: () => handleViewReceipt(paymentIdOrInvoiceId),
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Invoice",
        err?.message || "Unable to fetch the official invoice.",
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (params.notice === "subscription_required") {
      setNotice({
        type: "info",
        text: "Video consultations are available with an active care plan. Choose a plan to consult doctors online.",
      });
    } else if (params.notice === "quota_exhausted") {
      setNotice({
        type: "error",
        text: "Your monthly video consultation limit has been reached. Choose an upgraded plan to continue consultations.",
      });
    }
  }, [params.notice]);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [entitlementRes, subRes, plansRes, invoicesRes] = await Promise.all(
        [
          subscriptionService.getPatientSubscriptionEntitlement(),
          subscriptionService.getMySubscription().catch(() => null),
          subscriptionService.getPlans().catch(() => null),
          subscriptionService.getMySubscriptionInvoices().catch(() => null),
        ],
      );

      setEntitlement(entitlementRes);
      setSubscription(subRes?.subscription || null);
      if (invoicesRes && invoicesRes.invoices) {
        setInvoices(invoicesRes.invoices);
      }

      if (
        plansRes &&
        Array.isArray(plansRes.plans) &&
        plansRes.plans.length > 0
      ) {
        // Active catalog plans
        const backendPlans = plansRes.plans.filter((p) => p.isActive);
        const mergedKeys = new Set(
          backendPlans.map((p) => p.key.toLowerCase()),
        );
        const additions = DEFAULT_SUBSCRIPTION_PLANS.filter(
          (dp) => !mergedKeys.has(dp.key.toLowerCase()),
        );
        const combined = [...backendPlans, ...additions].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
        );
        setPlans(combined);
      } else {
        setPlans(DEFAULT_SUBSCRIPTION_PLANS);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load subscription details."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScreenFocus(() => {
    loadData();
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Separate plans by interval with zero duplicate cards
  const monthlyPlans = useMemo(() => {
    return plans.filter(
      (p) =>
        (p.billingInterval === "monthly" ||
          (!p.billingInterval && p.monthlyPrice > 0 && !p.yearlyPrice)) &&
        p.key !== "free",
    );
  }, [plans]);

  const yearlyPlans = useMemo(() => {
    return plans.filter(
      (p) =>
        p.billingInterval === "yearly" ||
        (!p.billingInterval && p.yearlyPrice > 0 && !p.monthlyPrice) ||
        p.key.startsWith("annual_"),
    );
  }, [plans]);

  const freeBaselinePlan = useMemo(() => {
    return (
      plans.find((p) => p.key === "free") ||
      DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.key === "free")!
    );
  }, [plans]);

  const currentDisplayPlans = useMemo(() => {
    return activeTab === "monthly" ? monthlyPlans : yearlyPlans;
  }, [activeTab, monthlyPlans, yearlyPlans]);

  // Checkout & Coupon State
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] =
    useState<SubscriptionPlan | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCouponResult, setAppliedCouponResult] =
    useState<PromotionValidationResponse | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const handleSelectPlan = (targetPlan: SubscriptionPlan) => {
    const isCurrent =
      entitlement?.planKey.toLowerCase() === targetPlan.key.toLowerCase() &&
      entitlement?.hasActiveSubscription;

    if (isCurrent) {
      Alert.alert(
        "Current Active Plan",
        `You are already actively subscribed to the ${targetPlan.name} plan.`,
      );
      return;
    }

    if (targetPlan.key.toLowerCase() === "free") {
      Alert.alert(
        "Free Starter Tier",
        "The Free plan provides essential in-person clinic bookings and health records. Paid video care plans activate instantly upon confirmation.",
      );
      return;
    }

    setSelectedPlanForCheckout(targetPlan);
    setCouponCodeInput("");
    setAppliedCouponResult(null);
    setCouponError(null);
    setCheckoutModalVisible(true);
  };

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim() || !selectedPlanForCheckout) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const targetInterval =
        selectedPlanForCheckout.billingInterval ||
        (activeTab === "yearly" ? "yearly" : "monthly");
      const res = await subscriptionService.validateSubscriptionCoupon({
        code: couponCodeInput.trim().toUpperCase(),
        planId: selectedPlanForCheckout._id,
        planKey: selectedPlanForCheckout.key,
        billingCycle: targetInterval,
      });

      if (res && res.valid) {
        setAppliedCouponResult(res);
        setCouponError(null);
      } else {
        setAppliedCouponResult(null);
        setCouponError(res?.message || "Invalid or ineligible coupon code.");
      }
    } catch (err: any) {
      setAppliedCouponResult(null);
      setCouponError(err?.message || "Failed to validate coupon code.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponResult(null);
    setCouponCodeInput("");
    setCouponError(null);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlanForCheckout) return;
    const targetPlan = selectedPlanForCheckout;
    setProcessingPlanId(targetPlan._id);
    setNotice(null);

    const targetInterval =
      targetPlan.billingInterval ||
      (activeTab === "yearly" ? "yearly" : "monthly");

    const basePrice =
      targetPlan.price !== undefined && targetPlan.price !== null
        ? Number(targetPlan.price)
        : targetInterval === "yearly"
          ? Number(targetPlan.yearlyPrice || 0)
          : Number(targetPlan.monthlyPrice || 0);

    const discount = appliedCouponResult?.pricing?.discountAmount || 0;
    const finalAmount = Math.max(0, basePrice - discount);

    try {
      // 1. Create order on backend with server-side price authority + coupon
      const orderRes = await subscriptionService.createSubscriptionOrder({
        planId: targetPlan._id,
        planKey: targetPlan.key,
        billingCycle: targetInterval,
        amount: finalAmount,
        promoCode: appliedCouponResult?.valid
          ? appliedCouponResult.code
          : undefined,
      });

      if (!orderRes.success) {
        throw new Error(
          orderRes.message || "Failed to initiate subscription order.",
        );
      }

      setCheckoutModalVisible(false);

      // If free/zero-amount activation
      if (orderRes.isFree || !orderRes.orderId) {
        setNotice({
          type: "success",
          text: `Congratulations! Your ${targetPlan.name} plan is now active.`,
        });
        await loadData();
        return;
      }

      // 2. Open Razorpay Checkout bridge with server-verified amount
      const amountToPay = orderRes.amount || Math.round(finalAmount * 100);

      const paymentResult = await openRazorpayCheckout({
        key: orderRes.keyId || "",
        order_id: orderRes.orderId,
        amount: amountToPay,
        currency: orderRes.currency || "INR",
        name: "HealPoint Healthcare",
        description: `${targetPlan.name} Plan (${targetInterval === "yearly" ? "Annual" : "Monthly"})${appliedCouponResult ? ` [Coupon: ${appliedCouponResult.code}]` : ""}`,
        theme: { color: Palette.primary },
      });

      // 3. Verify payment signature on backend
      const verifyRes = await subscriptionService.verifySubscriptionPayment({
        razorpay_order_id:
          paymentResult.razorpay_order_id || orderRes.orderId || "",
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature || "",
        planId: targetPlan._id,
        planKey: targetPlan.key,
        billingCycle: targetInterval,
        promoCode: appliedCouponResult?.valid
          ? appliedCouponResult.code
          : undefined,
        discountAmount: discount,
      });

      if (verifyRes.success) {
        setNotice({
          type: "success",
          text: `Payment verified! Your ${targetPlan.name} plan with ${getPlanVideoLimit(targetPlan)} video consultations/month is now active.${appliedCouponResult ? ` (Saved ₹${discount} with ${appliedCouponResult.code})` : ""}`,
        });
        await loadData();
      } else {
        throw new Error(
          verifyRes.message || "Payment verification incomplete.",
        );
      }
    } catch (err: any) {
      if (err?.code === 2 || err?.reason === "payment_cancelled") {
        setNotice({
          type: "info",
          text: "Payment was cancelled. Your current plan was not changed.",
        });
      } else {
        const msg = toErrorMessage(
          err,
          "Unable to complete subscription. Please try again.",
        );
        setNotice({ type: "error", text: msg });
        Alert.alert("Subscription Notice", msg);
      }
    } finally {
      setProcessingPlanId(null);
    }
  };

  const usagePercent = useMemo(() => {
    if (!entitlement) return 0;
    return getQuotaUsagePercent(
      entitlement.usedThisMonth,
      entitlement.monthlyQuota,
    );
  }, [entitlement]);

  const badgeInfo = useMemo(() => {
    if (!entitlement) {
      return { label: "Free Plan", variant: "neutral" as BadgeVariant };
    }
    return getEntitlementBadge(entitlement);
  }, [entitlement]);

  const quotaResetDateLabel = useMemo(() => {
    if (entitlement?.billingPeriodEnd) {
      return formatDDMMYYYY(entitlement.billingPeriodEnd);
    }
    if (subscription?.expiryDate) {
      return formatDDMMYYYY(subscription.expiryDate);
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return formatDDMMYYYY(d.toISOString());
  }, [entitlement, subscription]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <DrawerHeader
          title="Subscription & Plans"
          subtitle="Video consultation quotas & healthcare memberships"
        />
        <Loading label="Loading subscription catalog & quota..." />
      </SafeAreaView>
    );
  }

  if (error && !entitlement) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <DrawerHeader
          title="Subscription & Plans"
          subtitle="Video consultation quotas & healthcare memberships"
        />
        <ErrorState
          title="Unable to Load Plans"
          message={error}
          onRetry={loadData}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <DrawerHeader
        title="Subscription & Plans"
        subtitle="Manage video consultation quotas & memberships"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Notice feedback banner */}
        {notice ? (
          <View style={styles.noticeWrap}>
            <FormMessage type={notice.type} message={notice.text} />
          </View>
        ) : null}

        {/* CURRENT MEMBERSHIP & QUOTA HERO CARD */}
        <Card style={styles.currentPlanCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.planIconCircle}>
                <Ionicons
                  name="shield-checkmark"
                  size={24}
                  color={Palette.primary}
                />
              </View>
              <View>
                <Text style={styles.cardEyebrow}>CURRENT MEMBERSHIP</Text>
                <Text style={styles.cardPlanTitle}>
                  {entitlement?.planName || "Free Starter"}
                </Text>
              </View>
            </View>
            <Badge label={badgeInfo.label} variant={badgeInfo.variant} />
          </View>

          {/* Video Consultation Quota Section */}
          <View style={styles.quotaSection}>
            <View style={styles.quotaHeaderRow}>
              <View style={styles.quotaLabelGroup}>
                <Ionicons name="videocam" size={18} color={Palette.primary} />
                <Text style={styles.quotaTitle}>
                  Monthly Video Consultations
                </Text>
              </View>
              <Text style={styles.quotaCountText}>
                <Text style={styles.quotaCountBold}>
                  {entitlement?.monthlyQuota === 0
                    ? 0
                    : (entitlement?.usedThisMonth ?? 0)}
                </Text>
                {" / "}
                {entitlement?.monthlyQuota ?? 0} Used
              </Text>
            </View>

            {/* Quota Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${usagePercent}%` },
                  usagePercent >= 100
                    ? styles.progressExhausted
                    : usagePercent >= 75
                      ? styles.progressWarning
                      : styles.progressNormal,
                ]}
              />
            </View>

            {/* Quota Metrics Grid */}
            <View style={styles.quotaMetricsRow}>
              <View style={styles.quotaMetricItem}>
                <Text style={styles.quotaMetricLabel}>Remaining</Text>
                <Text style={styles.quotaMetricValue}>
                  {entitlement?.remainingQuota ?? 0}
                </Text>
              </View>
              <View style={styles.quotaMetricDivider} />
              <View style={styles.quotaMetricItem}>
                <Text style={styles.quotaMetricLabel}>Monthly Quota</Text>
                <Text style={styles.quotaMetricValue}>
                  {entitlement?.monthlyQuota ?? 0}
                </Text>
              </View>
              <View style={styles.quotaMetricDivider} />
              <View style={styles.quotaMetricItem}>
                <Text style={styles.quotaMetricLabel}>Family Limit</Text>
                <Text style={styles.quotaMetricValue}>
                  {entitlement?.familyMembersLimit ?? 1}{" "}
                  {(entitlement?.familyMembersLimit ?? 1) === 1
                    ? "Member"
                    : "Members"}
                </Text>
              </View>
              <View style={styles.quotaMetricDivider} />
              <View style={styles.quotaMetricItem}>
                <Text style={styles.quotaMetricLabel}>Renews On</Text>
                <Text style={styles.quotaMetricValue}>
                  {quotaResetDateLabel}
                </Text>
              </View>
            </View>

            {/* Explanatory status message */}
            <View style={styles.quotaStatusBox}>
              <Ionicons
                name={
                  entitlement?.code === "consultation_available"
                    ? "checkmark-circle-outline"
                    : entitlement?.code === "quota_exhausted"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={16}
                color={
                  entitlement?.code === "consultation_available"
                    ? Palette.success
                    : entitlement?.code === "quota_exhausted"
                      ? Palette.error
                      : Palette.primary
                }
              />
              <Text style={styles.quotaStatusText}>
                {entitlement?.message ||
                  "Choose a care plan below for instant video doctor consultations & family coverage."}
              </Text>
            </View>

            {/* PENDING DOWNGRADE NOTICE */}
            {subscription?.pendingDowngradePlanKey ? (
              <View style={styles.pendingDowngradeBanner}>
                <Ionicons name="time" size={16} color="#b45309" />
                <Text style={styles.pendingDowngradeBannerText}>
                  Scheduled Downgrade: Transitioning to{" "}
                  {subscription.pendingDowngradePlanKey} on{" "}
                  {subscription.pendingDowngradeDate
                    ? formatDDMMYYYY(subscription.pendingDowngradeDate)
                    : "billing cycle end"}
                  . Current premium benefits remain fully active until then.
                </Text>
              </View>
            ) : null}

            {/* View Full Entitlements Button */}
            <Pressable
              style={styles.viewEntitlementsBtn}
              onPress={() => setEntitlementsModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="View all plan benefits and entitlements"
            >
              <View style={styles.viewEntitlementsBtnLeft}>
                <Ionicons name="sparkles" size={16} color={Palette.primary} />
                <Text style={styles.viewEntitlementsBtnText}>
                  View All Plan Benefits & Entitlements (
                  {entitlement?.featureMatrix
                    ? entitlement.featureMatrix.filter((f) => f.isIncluded)
                        .length
                    : 4}{" "}
                  Active)
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Palette.primary}
              />
            </Pressable>
          </View>
        </Card>

        {/* SECTION HEADER & BILLING INTERVAL SWITCH */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Healthcare Membership Plans</Text>
          <Text style={styles.sectionSubtitle}>
            Dedicated video consultations, doctor appointments, and family
            coverage
          </Text>
        </View>

        {/* TAB TOGGLE: 5 MONTHLY vs 2 YEARLY */}
        <View style={styles.cycleToggleContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View 5 Monthly Plans"
            style={[
              styles.cycleTab,
              activeTab === "monthly" && styles.cycleTabActive,
            ]}
            onPress={() => setActiveTab("monthly")}
          >
            <Text
              style={[
                styles.cycleTabText,
                activeTab === "monthly" && styles.cycleTabTextActive,
              ]}
            >
              Monthly (5 Plans)
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View 2 Yearly Plans with Annual Savings"
            style={[
              styles.cycleTab,
              activeTab === "yearly" && styles.cycleTabActive,
            ]}
            onPress={() => setActiveTab("yearly")}
          >
            <View style={styles.yearlyTabInner}>
              <Text
                style={[
                  styles.cycleTabText,
                  activeTab === "yearly" && styles.cycleTabTextActive,
                ]}
              >
                Yearly (2 Plans)
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>SAVE UP TO 33%</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* TAB DESCRIPTION BANNER */}
        <View style={styles.tabBanner}>
          <Ionicons
            name={activeTab === "monthly" ? "calendar-outline" : "sparkles"}
            size={18}
            color={Palette.primary}
          />
          <Text style={styles.tabBannerText}>
            {activeTab === "monthly"
              ? "Showing 5 monthly plans. Flexible month-to-month video visits & family coverage."
              : "Showing 2 annual plans. Guaranteed savings of up to ₹5,989 (up to 4 months free!)."}
          </Text>
        </View>

        {/* PLAN CARDS */}
        <View style={styles.plansList}>
          {currentDisplayPlans.map((planItem) => {
            const planKey = planItem.key.toLowerCase();
            const isCurrent =
              entitlement?.planKey.toLowerCase() === planKey &&
              entitlement?.hasActiveSubscription;

            const videoLimit = getPlanVideoLimit(planItem);
            const isProcessing = processingPlanId === planItem._id;
            const isYearly = activeTab === "yearly";

            const price = isYearly
              ? planItem.price || planItem.yearlyPrice
              : planItem.price || planItem.monthlyPrice;

            const badgeText =
              planItem.badge || (isYearly ? "Annual Savings" : "");
            const metrics = planItem.pricingMetrics;

            return (
              <Card
                key={planItem._id}
                style={[
                  styles.planCard,
                  isYearly && styles.planCardYearly,
                  isCurrent && styles.planCardCurrent,
                ]}
              >
                {/* Header Badge */}
                {badgeText ? (
                  <View
                    style={[
                      styles.planBadgeRibbon,
                      isYearly
                        ? styles.planBadgeAnnual
                        : styles.planBadgeMonthly,
                    ]}
                  >
                    <Text style={styles.planBadgeText}>
                      {badgeText.toUpperCase()}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.planCardHeader}>
                  <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                    <Text style={styles.planCardName}>{planItem.name}</Text>
                    <Text style={styles.planCardDesc} numberOfLines={2}>
                      {planItem.description ||
                        `Includes ${videoLimit} video consultations every month.`}
                    </Text>
                  </View>

                  <View style={styles.planPriceWrap}>
                    <Text style={styles.planPriceAmount}>
                      {formatINR(price)}
                    </Text>
                    <Text style={styles.planPriceCycle}>
                      {isYearly ? "/year" : "/month"}
                    </Text>
                  </View>
                </View>

                {/* Annual Savings Callout if Yearly */}
                {isYearly && (metrics?.annualSavings || 0) > 0 ? (
                  <View style={styles.annualSavingsBanner}>
                    <Ionicons
                      name="gift-outline"
                      size={16}
                      color={Palette.success}
                    />
                    <Text style={styles.annualSavingsText}>
                      Save {formatINR(metrics?.annualSavings || 0)}/yr (
                      {metrics?.savingsPercentage}% off) • Just ₹
                      {metrics?.effectiveMonthlyPrice}/mo
                    </Text>
                  </View>
                ) : null}

                {/* Consultation & Family Highlight Box */}
                <View style={styles.videoHighlightBox}>
                  <View style={styles.highlightSubItem}>
                    <Ionicons
                      name="videocam"
                      size={18}
                      color={Palette.primary}
                    />
                    <Text style={styles.highlightSubText}>
                      {isYearly
                        ? `${videoLimit * 12} Video Visits / year (${videoLimit}/mo)`
                        : `${videoLimit} Video Consultations / month`}
                    </Text>
                  </View>
                  <View style={styles.highlightDivider} />
                  <View style={styles.highlightSubItem}>
                    <Ionicons name="people" size={18} color={Palette.primary} />
                    <Text style={styles.highlightSubText}>
                      {planItem.familyMembersLimit ?? 1}{" "}
                      {(planItem.familyMembersLimit ?? 1) === 1
                        ? "Member"
                        : "Family Members"}
                    </Text>
                  </View>
                </View>

                {/* Features Checklist */}
                <View style={styles.featuresList}>
                  {(planItem.features || []).map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* Action CTA Button */}
                <View style={styles.planActionWrap}>
                  {isCurrent ? (
                    <Button
                      title="Current Plan Active"
                      variant="secondary"
                      fullWidth
                      icon="checkmark-outline"
                      disabled
                      style={styles.currentPlanBtn}
                    />
                  ) : (
                    <Button
                      title={
                        isProcessing
                          ? "Processing..."
                          : `Subscribe to ${planItem.name}`
                      }
                      variant="primary"
                      fullWidth
                      loading={isProcessing}
                      disabled={isProcessing}
                      onPress={() => handleSelectPlan(planItem)}
                    />
                  )}
                </View>
              </Card>
            );
          })}
        </View>

        {/* FREE BASELINE & FEATURE COMPARISON TOGGLE */}
        <Card style={styles.baselineCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle Free plan & full tier comparison table"
            onPress={() => setShowComparisonTable((prev) => !prev)}
            style={styles.baselineHeaderPressable}
          >
            <View style={styles.baselineHeaderLeft}>
              <View style={styles.baselineIconBox}>
                <Ionicons
                  name="layers-outline"
                  size={22}
                  color={Palette.text}
                />
              </View>
              <View>
                <Text style={styles.baselineTitle}>
                  Free Baseline & Tier Comparison
                </Text>
                <Text style={styles.baselineSubtitle}>
                  View Free features (₹0) and side-by-side tier comparison
                </Text>
              </View>
            </View>
            <Ionicons
              name={showComparisonTable ? "chevron-up" : "chevron-down"}
              size={20}
              color={Palette.textMuted}
            />
          </Pressable>

          {showComparisonTable ? (
            <View style={styles.comparisonTableContainer}>
              <View style={styles.freeSummaryBox}>
                <View style={styles.freeSummaryHeader}>
                  <Text style={styles.freeSummaryTitle}>
                    {freeBaselinePlan.name} (₹0 Free Forever)
                  </Text>
                  <Badge label="Included" variant="neutral" />
                </View>
                <Text style={styles.freeSummaryDesc}>
                  Every HealPoint user receives unlimited in-person clinic
                  bookings, encrypted digital prescriptions, lab test storage,
                  and immunization history at zero cost.
                </Text>
                <View style={styles.freeFeaturesGrid}>
                  {freeBaselinePlan.features.map((f, i) => (
                    <View key={i} style={styles.featureItem}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.freeFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Comparison Matrix */}
              <Text style={styles.matrixHeading}>Tier Matrix</Text>
              <View style={styles.matrixTable}>
                <View style={styles.matrixRowHeader}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Tier
                  </Text>
                  <Text style={styles.matrixCell}>Price</Text>
                  <Text style={styles.matrixCell}>Video Quota</Text>
                  <Text style={styles.matrixCell}>Family</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Free
                  </Text>
                  <Text style={styles.matrixCell}>₹0</Text>
                  <Text style={styles.matrixCell}>0 visits</Text>
                  <Text style={styles.matrixCell}>1 (Self)</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Starter
                  </Text>
                  <Text style={styles.matrixCell}>₹249/mo</Text>
                  <Text style={styles.matrixCell}>2 visits/mo</Text>
                  <Text style={styles.matrixCell}>1 (Self)</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Plus
                  </Text>
                  <Text style={styles.matrixCell}>₹499/mo</Text>
                  <Text style={styles.matrixCell}>4 visits/mo</Text>
                  <Text style={styles.matrixCell}>2 Members</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Pro
                  </Text>
                  <Text style={styles.matrixCell}>₹799/mo</Text>
                  <Text style={styles.matrixCell}>6 visits/mo</Text>
                  <Text style={styles.matrixCell}>4 Members</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Family Care
                  </Text>
                  <Text style={styles.matrixCell}>₹1,099/mo</Text>
                  <Text style={styles.matrixCell}>8 visits/mo</Text>
                  <Text style={styles.matrixCell}>6 Members</Text>
                </View>
                <View style={styles.matrixRow}>
                  <Text style={[styles.matrixCell, styles.matrixCellKey]}>
                    Family Prime
                  </Text>
                  <Text style={styles.matrixCell}>₹1,499/mo</Text>
                  <Text style={styles.matrixCell}>10 visits/mo</Text>
                  <Text style={styles.matrixCell}>10 Members</Text>
                </View>
                <View style={[styles.matrixRow, styles.matrixRowHighlight]}>
                  <Text
                    style={[
                      styles.matrixCell,
                      styles.matrixCellKey,
                      { color: Palette.primary },
                    ]}
                  >
                    Annual Pro
                  </Text>
                  <Text style={styles.matrixCell}>₹7,999/yr</Text>
                  <Text style={styles.matrixCell}>72 visits/yr</Text>
                  <Text style={styles.matrixCell}>4 Members</Text>
                </View>
                <View style={[styles.matrixRow, styles.matrixRowHighlight]}>
                  <Text
                    style={[
                      styles.matrixCell,
                      styles.matrixCellKey,
                      { color: Palette.primary },
                    ]}
                  >
                    Annual Prime
                  </Text>
                  <Text style={styles.matrixCell}>₹11,999/yr</Text>
                  <Text style={styles.matrixCell}>120 visits/yr</Text>
                  <Text style={styles.matrixCell}>10 Members</Text>
                </View>
              </View>
            </View>
          ) : null}
        </Card>

        {/* TRUST & GUARANTEE INFO */}
        <Card style={styles.trustCard}>
          <View style={styles.trustItem}>
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={Palette.primary}
            />
            <View style={styles.trustTexts}>
              <Text style={styles.trustTitle}>Bank-Grade Secure Checkout</Text>
              <Text style={styles.trustSubtitle}>
                Protected by Razorpay 256-bit encryption. UPI, RuPay, Cards &
                NetBanking supported.
              </Text>
            </View>
          </View>

          <View style={styles.trustItem}>
            <Ionicons
              name="refresh-circle-outline"
              size={22}
              color={Palette.primary}
            />
            <View style={styles.trustTexts}>
              <Text style={styles.trustTitle}>Fair Quota Policy</Text>
              <Text style={styles.trustSubtitle}>
                Cancelled or rescheduled appointments do not consume your video
                consultation quota.
              </Text>
            </View>
          </View>

          <View style={styles.trustItem}>
            <Ionicons name="people-outline" size={22} color={Palette.primary} />
            <View style={styles.trustTexts}>
              <Text style={styles.trustTitle}>
                Verified Healthcare Specialists
              </Text>
              <Text style={styles.trustSubtitle}>
                Every consultation connects with licensed, accredited doctors
                over secure Google Meet.
              </Text>
            </View>
          </View>
        </Card>

        {/* REAL PAYMENT HISTORY & VERIFIED RECEIPTS */}
        {subscription?.payments && subscription.payments.length > 0 ? (
          <Card style={styles.paymentHistoryCard}>
            <View style={styles.paymentHistoryHeader}>
              <View style={styles.paymentHistoryTitleRow}>
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.paymentHistoryTitle}>
                  Payment History & Receipts
                </Text>
              </View>
              <Badge label="Verified Ledger" variant="neutral" />
            </View>

            <View style={styles.paymentsList}>
              {subscription.payments
                .filter(
                  (p) =>
                    p.paymentStatus === "paid" ||
                    (p.amount !== undefined && p.amount > 0),
                )
                .slice(-5)
                .reverse()
                .map((p, index) => {
                  const isPaid = p.paymentStatus === "paid";

                  return (
                    <View key={p._id || index} style={styles.paymentRow}>
                      <View style={styles.paymentRowLeft}>
                        <View style={styles.paymentIconBadge}>
                          <Ionicons
                            name={isPaid ? "checkmark-done" : "time-outline"}
                            size={16}
                            color={isPaid ? Palette.success : Palette.warning}
                          />
                        </View>
                        <View>
                          <Text style={styles.paymentRowTitle}>
                            {formatINR(p.amount)} ·{" "}
                            {p.billingCycle || "monthly"}
                          </Text>
                          <Text style={styles.paymentRowSub}>
                            {p.paidAt
                              ? formatDDMMYYYY(String(p.paidAt))
                              : formatDDMMYYYY(String(p.createdAt || ""))}
                            {p.razorpayPaymentId
                              ? ` · Ref: ${p.razorpayPaymentId.slice(-8)}`
                              : ""}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.paymentRowRight}>
                        <Badge
                          label={
                            isPaid
                              ? "PAID"
                              : String(p.paymentStatus).toUpperCase()
                          }
                          variant={isPaid ? "success" : "warning"}
                        />
                        {p.razorpayPaymentId ? (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 6,
                              marginTop: 4,
                            }}
                          >
                            <Pressable
                              style={styles.viewReceiptBtn}
                              onPress={() =>
                                handleViewInvoice(p.razorpayPaymentId!)
                              }
                              disabled={invoiceLoading}
                            >
                              <Ionicons
                                name="receipt-outline"
                                size={14}
                                color={Palette.primary}
                              />
                              <Text style={styles.viewReceiptBtnText}>
                                Invoice
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.viewReceiptBtn,
                                { backgroundColor: Palette.surfaceAlt },
                              ]}
                              onPress={() =>
                                handleViewReceipt(p.razorpayPaymentId!)
                              }
                              disabled={receiptLoading}
                            >
                              <Ionicons
                                name="document-text-outline"
                                size={14}
                                color={Palette.textMuted}
                              />
                              <Text
                                style={[
                                  styles.viewReceiptBtnText,
                                  { color: Palette.text },
                                ]}
                              >
                                Receipt
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* CHECKOUT & PROMOTION COUPON MODAL */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!processingPlanId) setCheckoutModalVisible(false);
        }}
      >
        <View style={styles.checkoutModalOverlay}>
          <Card style={styles.checkoutModalCard}>
            <View style={styles.checkoutModalHeader}>
              <View style={styles.checkoutModalHeaderLeft}>
                <Ionicons name="pricetag" size={20} color={Palette.primary} />
                <Text style={styles.checkoutModalTitle}>
                  Confirm Subscription Order
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!processingPlanId) setCheckoutModalVisible(false);
                }}
                disabled={Boolean(processingPlanId)}
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {selectedPlanForCheckout ? (
              <ScrollView contentContainerStyle={styles.checkoutModalBody}>
                {/* Plan Highlights */}
                <View style={styles.checkoutPlanSummaryBox}>
                  <View style={styles.checkoutPlanTitleRow}>
                    <Text style={styles.checkoutPlanName}>
                      {selectedPlanForCheckout.name} Plan
                    </Text>
                    <Badge
                      label={
                        (selectedPlanForCheckout.billingInterval ||
                          activeTab) === "yearly"
                          ? "Annual Care"
                          : "Monthly Care"
                      }
                      variant="primary"
                    />
                  </View>
                  <Text style={styles.checkoutPlanDescription}>
                    {selectedPlanForCheckout.description ||
                      "Comprehensive preventive & consultation care package."}
                  </Text>
                  <View style={styles.checkoutEntitlementHighlights}>
                    <View style={styles.checkoutHighlightItem}>
                      <Ionicons
                        name="videocam-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.checkoutHighlightText}>
                        {getPlanVideoLimit(selectedPlanForCheckout)} Video
                        Consultations included
                      </Text>
                    </View>
                    <View style={styles.checkoutHighlightItem}>
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.checkoutHighlightText}>
                        Up to {selectedPlanForCheckout.familyMembersLimit || 1}{" "}
                        Family Members
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Coupon Code Section */}
                <View style={styles.couponSectionContainer}>
                  <Text style={styles.couponSectionTitle}>
                    Have a Coupon or Promo Code?
                  </Text>
                  {appliedCouponResult ? (
                    <View style={styles.appliedCouponCard}>
                      <View style={styles.appliedCouponLeft}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={Palette.success}
                        />
                        <View style={{ marginLeft: Spacing.sm }}>
                          <Text style={styles.appliedCouponCode}>
                            {appliedCouponResult.promotion?.code ||
                              appliedCouponResult.code}
                          </Text>
                          <Text style={styles.appliedCouponDiscountText}>
                            ₹{appliedCouponResult.pricing?.discountAmount}{" "}
                            discount applied!
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={handleRemoveCoupon}
                        style={styles.removeCouponBtn}
                        hitSlop={8}
                      >
                        <Text style={styles.removeCouponBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.couponInputRow}>
                      <TextInput
                        style={styles.couponTextInput}
                        placeholder="ENTER COUPON CODE"
                        placeholderTextColor={Palette.textMuted}
                        value={couponCodeInput}
                        onChangeText={(t) => {
                          setCouponCodeInput(t.toUpperCase());
                          if (couponError) setCouponError(null);
                        }}
                        autoCapitalize="characters"
                        editable={!validatingCoupon}
                      />
                      <Pressable
                        style={[
                          styles.applyCouponBtn,
                          !couponCodeInput.trim() &&
                            styles.applyCouponBtnDisabled,
                        ]}
                        onPress={handleApplyCoupon}
                        disabled={!couponCodeInput.trim() || validatingCoupon}
                      >
                        <Text style={styles.applyCouponBtnText}>
                          {validatingCoupon ? "Checking..." : "Apply"}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {couponError ? (
                    <Text style={styles.couponErrorText}>{couponError}</Text>
                  ) : null}
                </View>

                {/* Financial Summary */}
                <View style={styles.checkoutPriceBreakdownCard}>
                  <Text style={styles.checkoutBreakdownTitle}>
                    Price Details
                  </Text>
                  {(() => {
                    const targetInterval =
                      selectedPlanForCheckout.billingInterval ||
                      (activeTab === "yearly" ? "yearly" : "monthly");
                    const basePrice =
                      selectedPlanForCheckout.price !== undefined &&
                      selectedPlanForCheckout.price !== null
                        ? Number(selectedPlanForCheckout.price)
                        : targetInterval === "yearly"
                          ? Number(selectedPlanForCheckout.yearlyPrice || 0)
                          : Number(selectedPlanForCheckout.monthlyPrice || 0);
                    const discount =
                      appliedCouponResult?.pricing?.discountAmount || 0;
                    const finalAmount = Math.max(0, basePrice - discount);

                    return (
                      <>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceRowLabel}>
                            Base Subscription Price
                          </Text>
                          <Text style={styles.priceRowValue}>₹{basePrice}</Text>
                        </View>

                        {discount > 0 ? (
                          <View style={styles.priceRow}>
                            <Text
                              style={[
                                styles.priceRowLabel,
                                { color: Palette.success },
                              ]}
                            >
                              Promotional Discount ({appliedCouponResult?.code})
                            </Text>
                            <Text
                              style={[
                                styles.priceRowValue,
                                { color: Palette.success },
                              ]}
                            >
                              -₹{discount}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.priceDivider} />

                        <View style={styles.totalPayableRow}>
                          <Text style={styles.totalPayableLabel}>
                            Total Payable
                          </Text>
                          <View style={styles.totalPayableRight}>
                            {discount > 0 ? (
                              <Text style={styles.strikethroughOriginalPrice}>
                                ₹{basePrice}
                              </Text>
                            ) : null}
                            <Text style={styles.totalPayableValue}>
                              ₹{finalAmount}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Trust & Guarantee Banner */}
                <View style={styles.checkoutTrustBadge}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.checkoutTrustText}>
                    100% Authorized Payment via Razorpay. Subscriptions and
                    video visit quotas are backed by the HealPoint Entitlement
                    Protection Center.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.checkoutModalActions}>
                  <Button
                    title={
                      processingPlanId
                        ? "Opening Checkout..."
                        : `Proceed to Pay ₹${Math.max(
                            0,
                            (selectedPlanForCheckout.price !== undefined &&
                            selectedPlanForCheckout.price !== null
                              ? Number(selectedPlanForCheckout.price)
                              : (selectedPlanForCheckout.billingInterval ||
                                    activeTab) === "yearly"
                                ? Number(
                                    selectedPlanForCheckout.yearlyPrice || 0,
                                  )
                                : Number(
                                    selectedPlanForCheckout.monthlyPrice || 0,
                                  )) -
                              (appliedCouponResult?.pricing?.discountAmount ||
                                0),
                          )}`
                    }
                    onPress={handleConfirmCheckout}
                    loading={Boolean(processingPlanId)}
                    style={styles.checkoutConfirmBtn}
                  />
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => setCheckoutModalVisible(false)}
                    disabled={Boolean(processingPlanId)}
                    style={styles.checkoutCancelBtn}
                  />
                </View>
              </ScrollView>
            ) : null}
          </Card>
        </View>
      </Modal>

      {/* VERIFIED DIGITAL RECEIPT MODAL */}
      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <Card style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <View style={styles.receiptModalHeaderLeft}>
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.receiptModalTitle}>
                  Digital Payment Receipt
                </Text>
              </View>
              <Pressable onPress={() => setReceiptModalVisible(false)}>
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {selectedReceipt ? (
              <ScrollView contentContainerStyle={styles.receiptModalBody}>
                {/* RECEIPT NUMBER & STATUS */}
                <View style={styles.receiptHeaderRow}>
                  <View>
                    <Text style={styles.receiptInvoiceNum}>
                      {selectedReceipt.receiptNumber}
                    </Text>
                    <Text style={styles.receiptDate}>
                      Date: {formatDDMMYYYY(selectedReceipt.issuedAt)}
                    </Text>
                  </View>
                  <Badge label={selectedReceipt.status} variant="success" />
                </View>

                {/* SUBSCRIBER INFO */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>BILLED TO</Text>
                  <Text style={styles.receiptSubscriberName}>
                    {selectedReceipt.subscriber.name}
                  </Text>
                  <Text style={styles.receiptSubscriberEmail}>
                    {selectedReceipt.subscriber.email}
                  </Text>
                  <Text style={styles.receiptSubscriberType}>
                    {selectedReceipt.subscriber.type}
                  </Text>
                </View>

                {/* PLAN & ENTITLEMENT LINE ITEMS */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>
                    MEMBERSHIP DETAILS
                  </Text>
                  <View style={styles.receiptPlanRow}>
                    <Text style={styles.receiptPlanName}>
                      {selectedReceipt.plan.name}
                    </Text>
                    <Text style={styles.receiptPlanInterval}>
                      ({selectedReceipt.plan.billingInterval})
                    </Text>
                  </View>
                  <Text style={styles.receiptEntitlementText}>
                    • Included Video Consultations:{" "}
                    {selectedReceipt.plan.videoConsultationsQuota} visits
                  </Text>
                  <Text style={styles.receiptEntitlementText}>
                    • Family Member Limit:{" "}
                    {selectedReceipt.plan.familyMembersLimit} member(s)
                  </Text>
                  {selectedReceipt.coveragePeriod ? (
                    <Text style={styles.receiptCoverageText}>
                      Coverage:{" "}
                      {formatDDMMYYYY(
                        String(selectedReceipt.coveragePeriod.startDate || ""),
                      )}{" "}
                      to{" "}
                      {formatDDMMYYYY(
                        String(selectedReceipt.coveragePeriod.expiryDate || ""),
                      )}{" "}
                      ({selectedReceipt.coveragePeriod.durationDays} Days)
                    </Text>
                  ) : null}
                </View>

                {/* PAYMENT SUMMARY */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>
                    PAYMENT DETAILS
                  </Text>
                  <View style={styles.receiptPriceRow}>
                    <Text style={styles.receiptPriceLabel}>
                      Gross Membership Fee
                    </Text>
                    <Text style={styles.receiptPriceVal}>
                      {formatINR(selectedReceipt.payment.amountPaid)}
                    </Text>
                  </View>
                  <View style={styles.receiptPriceRow}>
                    <Text style={styles.receiptPriceLabel}>
                      Gateway Reference
                    </Text>
                    <Text style={styles.receiptRefText}>
                      {selectedReceipt.payment.razorpayPaymentId || "Verified"}
                    </Text>
                  </View>
                  <View
                    style={[styles.receiptPriceRow, styles.receiptTotalRow]}
                  >
                    <Text style={styles.receiptTotalLabel}>
                      Total Paid (INR)
                    </Text>
                    <Text style={styles.receiptTotalVal}>
                      {formatINR(selectedReceipt.payment.amountPaid)}
                    </Text>
                  </View>
                </View>

                {/* ISSUER STAMP */}
                <View style={styles.receiptIssuerBox}>
                  <Ionicons
                    name="business"
                    size={16}
                    color={Palette.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptIssuerTitle}>
                      {selectedReceipt.issuer.company}
                    </Text>
                    <Text style={styles.receiptIssuerSub}>
                      {selectedReceipt.issuer.system} ·{" "}
                      {selectedReceipt.issuer.supportEmail}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            <Button
              title="Close Receipt"
              variant="outline"
              onPress={() => setReceiptModalVisible(false)}
            />
          </Card>
        </View>
      </Modal>

      {/* VERIFIED TAX INVOICE MODAL */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <Card style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <View style={styles.receiptModalHeaderLeft}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.receiptModalTitle}>
                  Tax Invoice / Bill of Supply
                </Text>
              </View>
              <Pressable onPress={() => setInvoiceModalVisible(false)}>
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {selectedInvoice ? (
              <ScrollView contentContainerStyle={styles.receiptModalBody}>
                {/* INVOICE NUMBER & STATUS */}
                <View style={styles.receiptHeaderRow}>
                  <View>
                    <Text style={styles.receiptInvoiceNum}>
                      {selectedInvoice.invoiceNumber}
                    </Text>
                    <Text style={styles.receiptDate}>
                      Date:{" "}
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
                      selectedInvoice.status === "paid" ? "success" : "warning"
                    }
                  />
                </View>

                {/* ISSUER & TAX INFO */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>
                    ISSUER / SELLER
                  </Text>
                  <Text style={styles.receiptSubscriberName}>
                    {selectedInvoice.issuerSnapshot?.legalEntityName ||
                      "HealPoint Healthcare Technologies Pvt. Ltd."}
                  </Text>
                  <Text style={styles.receiptSubscriberEmail}>
                    {selectedInvoice.issuerSnapshot?.registeredAddress ||
                      "Healthcare Innovation Park, Mumbai, Maharashtra 400001, India"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: Palette.textMuted,
                      marginTop: 2,
                    }}
                  >
                    Tax ID / GSTIN:{" "}
                    <Text style={{ fontWeight: "700", color: Palette.text }}>
                      {selectedInvoice.financials.taxIdentificationNumber ||
                        "Not Applicable / Not Configured"}
                    </Text>{" "}
                    · SAC:{" "}
                    <Text style={{ fontWeight: "700", color: Palette.text }}>
                      {selectedInvoice.financials.hsnSacCode || "9993"}
                    </Text>
                  </Text>
                </View>

                {/* SUBSCRIBER INFO */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>BILLED TO</Text>
                  <Text style={styles.receiptSubscriberName}>
                    {selectedInvoice.subscriberSnapshot.name}
                  </Text>
                  <Text style={styles.receiptSubscriberEmail}>
                    {selectedInvoice.subscriberSnapshot.email}
                    {selectedInvoice.subscriberSnapshot.phone
                      ? ` · ${selectedInvoice.subscriberSnapshot.phone}`
                      : ""}
                  </Text>
                  <Text style={styles.receiptSubscriberType}>
                    {selectedInvoice.subscriberSnapshot.subscriberType ===
                    "hospital"
                      ? "Hospital Account"
                      : "Individual Patient"}
                  </Text>
                </View>

                {/* PLAN & ENTITLEMENT LINE ITEMS */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>
                    SUBSCRIPTION PLAN ITEM
                  </Text>
                  <View style={styles.receiptPlanRow}>
                    <Text style={styles.receiptPlanName}>
                      {selectedInvoice.planSnapshot.name}
                    </Text>
                    <Text style={styles.receiptPlanInterval}>
                      ({selectedInvoice.planSnapshot.billingInterval})
                    </Text>
                  </View>
                  <Text style={styles.receiptEntitlementText}>
                    • Included Video Consultations:{" "}
                    {selectedInvoice.planSnapshot.videoConsultationsMonthly}{" "}
                    visits
                  </Text>
                  <Text style={styles.receiptEntitlementText}>
                    • Family Member Limit:{" "}
                    {selectedInvoice.planSnapshot.familyMembersLimit} member(s)
                  </Text>
                  {selectedInvoice.coveragePeriod ? (
                    <Text style={styles.receiptCoverageText}>
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

                {/* FINANCIAL & TAX BREAKDOWN */}
                <View style={styles.receiptSection}>
                  <Text style={styles.receiptSectionLabel}>
                    FINANCIAL & TAX SUMMARY
                  </Text>
                  <View style={styles.receiptPriceRow}>
                    <Text style={styles.receiptPriceLabel}>Base Amount</Text>
                    <Text style={styles.receiptPriceVal}>
                      {formatINR(selectedInvoice.financials.baseAmount)}
                    </Text>
                  </View>
                  {selectedInvoice.financials.discountAmount > 0 && (
                    <View style={styles.receiptPriceRow}>
                      <Text style={styles.receiptPriceLabel}>Discount</Text>
                      <Text
                        style={[
                          styles.receiptPriceVal,
                          { color: Palette.success },
                        ]}
                      >
                        -{formatINR(selectedInvoice.financials.discountAmount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.receiptPriceRow}>
                    <Text style={styles.receiptPriceLabel}>
                      Tax ({selectedInvoice.financials.taxName || "GST"})
                    </Text>
                    <Text style={styles.receiptPriceVal}>
                      {selectedInvoice.financials.isTaxApplicable
                        ? `${formatINR(selectedInvoice.financials.taxAmount)} (${selectedInvoice.financials.taxRate}%)`
                        : "Not configured (₹0.00)"}
                    </Text>
                  </View>
                  <View style={styles.receiptPriceRow}>
                    <Text style={styles.receiptPriceLabel}>
                      Gateway Reference
                    </Text>
                    <Text style={styles.receiptRefText}>
                      {selectedInvoice.paymentDetails.razorpayPaymentId}
                    </Text>
                  </View>
                  <View
                    style={[styles.receiptPriceRow, styles.receiptTotalRow]}
                  >
                    <Text style={styles.receiptTotalLabel}>
                      Total Paid (INR)
                    </Text>
                    <Text style={styles.receiptTotalVal}>
                      {formatINR(selectedInvoice.financials.totalAmount)}
                    </Text>
                  </View>
                </View>

                {/* DIGITAL VERIFICATION STAMP */}
                <View style={styles.receiptIssuerBox}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={Palette.success}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptIssuerTitle}>
                      HealPoint Cryptographic Invoice Verification
                    </Text>
                    <Text style={styles.receiptIssuerSub}>
                      Transaction: {selectedInvoice.transactionType} · Verified
                      via Razorpay HMAC SHA256
                    </Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            <Button
              title="Close Invoice"
              variant="outline"
              onPress={() => setInvoiceModalVisible(false)}
            />
          </Card>
        </View>
      </Modal>

      {/* Patient Entitlements Breakdown Modal */}
      <Modal
        visible={entitlementsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEntitlementsModalVisible(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <Card style={[styles.receiptModalCard, { maxHeight: "85%" }]}>
            <View style={styles.receiptModalHeader}>
              <View style={styles.receiptModalHeaderLeft}>
                <View
                  style={[
                    styles.planIconCircle,
                    { backgroundColor: "#EEF2FF" },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={20}
                    color={Palette.primary}
                  />
                </View>
                <View>
                  <Text style={styles.receiptModalTitle}>My Plan Benefits</Text>
                  <Text style={{ fontSize: 12, color: Palette.textMuted }}>
                    Authoritative server-verified entitlements
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEntitlementsModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close benefits breakdown"
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.entitlementsModalBody}>
              {/* Plan Summary Banner */}
              <View style={styles.entitlementBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entitlementBannerTitle}>
                    {entitlement?.planName || "Free Starter"}
                  </Text>
                  <Text style={styles.entitlementBannerSubtitle}>
                    {entitlement?.hasActiveSubscription
                      ? `Active Membership • Renews ${quotaResetDateLabel}`
                      : "Free Baseline Guarantee • Lifetime Access"}
                  </Text>
                </View>
                <Badge
                  label={
                    entitlement?.hasActiveSubscription
                      ? "VERIFIED ACTIVE"
                      : "FREE BASELINE"
                  }
                  variant={
                    entitlement?.hasActiveSubscription ? "success" : "neutral"
                  }
                />
              </View>

              {/* Active Overrides Notice if any */}
              {entitlement?.activeOverrides &&
                entitlement.activeOverrides.length > 0 && (
                  <View style={styles.entitlementOverrideNotice}>
                    <Ionicons name="key" size={16} color="#D97706" />
                    <Text style={styles.entitlementOverrideText}>
                      Active Care Override Applied:{" "}
                      {entitlement.activeOverrides[0].reason}
                    </Text>
                  </View>
                )}

              {/* Feature Matrix List */}
              <Text style={styles.entitlementsListHeading}>
                PLATFORM CAPABILITIES & STATUS:
              </Text>
              {(entitlement?.featureMatrix || []).map((feat) => (
                <View key={feat.featureKey} style={styles.entitlementItemRow}>
                  <View style={styles.entitlementItemLeft}>
                    <Ionicons
                      name={
                        feat.isIncluded ? "checkmark-circle" : "close-circle"
                      }
                      size={20}
                      color={
                        feat.isIncluded ? Palette.success : Palette.textMuted
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entitlementItemName}>
                        {feat.name}
                      </Text>
                      <Text style={styles.entitlementItemDesc}>
                        {feat.description}
                      </Text>
                      {feat.limit !== null && (
                        <Text style={styles.entitlementItemLimit}>
                          Capacity: {feat.limit} {feat.unit || ""}
                          {feat.remaining !== null
                            ? ` (${feat.remaining} remaining)`
                            : ""}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Badge
                    label={feat.isIncluded ? "INCLUDED" : "NOT INCLUDED"}
                    variant={feat.isIncluded ? "success" : "neutral"}
                  />
                </View>
              ))}
            </ScrollView>

            <Button
              title="Close Benefits"
              variant="outline"
              onPress={() => setEntitlementsModalVisible(false)}
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
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.lg,
  },
  noticeWrap: {
    marginBottom: Spacing.xs,
  },

  /* Current Plan Card */
  currentPlanCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  planIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEyebrow: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardPlanTitle: {
    ...Typography.h2,
    color: Palette.text,
    marginTop: 2,
  },

  /* Quota Section */
  quotaSection: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  quotaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quotaLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  quotaTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  quotaCountText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  quotaCountBold: {
    fontWeight: "800",
    color: Palette.primary,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: Palette.border,
    borderRadius: Radius.pill,
    overflow: "hidden",
    marginVertical: Spacing.xs,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  progressNormal: {
    backgroundColor: Palette.primary,
  },
  progressWarning: {
    backgroundColor: Palette.warning,
  },
  progressExhausted: {
    backgroundColor: Palette.error,
  },

  /* Quota Metrics Row */
  quotaMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.xs,
  },
  quotaMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  quotaMetricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: 2,
    fontSize: 10,
  },
  quotaMetricValue: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  quotaMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },

  /* Status info box */
  quotaStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  quotaStatusText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
  },

  /* Section Header */
  sectionHeader: {
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  sectionSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
  },

  /* Billing Cycle Toggle */
  cycleToggleContainer: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cycleTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
  },
  cycleTabActive: {
    backgroundColor: Palette.surface,
    ...Shadows.sm,
  },
  cycleTabText: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  cycleTabTextActive: {
    color: Palette.text,
    fontWeight: "700",
  },
  yearlyTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  saveBadge: {
    backgroundColor: "rgba(46, 158, 91, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  saveBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.success,
  },

  tabBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBannerText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },

  /* Plans List */
  plansList: {
    gap: Spacing.lg,
  },
  planCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    position: "relative",
    overflow: "hidden",
    ...Shadows.card,
  },
  planCardYearly: {
    borderColor: Palette.primary,
    borderWidth: 1.5,
  },
  planCardCurrent: {
    backgroundColor: Palette.surface,
  },
  planBadgeRibbon: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderBottomLeftRadius: Radius.md,
  },
  planBadgeMonthly: {
    backgroundColor: Palette.primary,
  },
  planBadgeAnnual: {
    backgroundColor: "#7B61FF",
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  planCardName: {
    ...Typography.h2,
    color: Palette.text,
  },
  planCardDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
  },
  planPriceWrap: {
    alignItems: "flex-end",
  },
  planPriceAmount: {
    ...Typography.h1,
    color: Palette.primary,
    fontSize: 24,
  },
  planPriceCycle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  annualSavingsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(46, 158, 91, 0.12)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  annualSavingsText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "700",
  },

  /* Video Highlight Box */
  videoHighlightBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    marginBottom: Spacing.md,
  },
  highlightSubItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  highlightSubText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  highlightDivider: {
    width: 1,
    height: 18,
    backgroundColor: Palette.border,
    marginHorizontal: Spacing.sm,
  },

  /* Features List */
  featuresList: {
    gap: Spacing.xs + 2,
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs + 2,
  },
  featureText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },

  /* Plan Action CTA */
  planActionWrap: {
    marginTop: Spacing.xs,
  },
  currentPlanBtn: {
    opacity: 0.85,
  },

  /* Baseline Card & Comparison */
  baselineCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  baselineHeaderPressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  baselineHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  baselineIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  baselineTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  baselineSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  comparisonTableContainer: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  freeSummaryBox: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs + 2,
  },
  freeSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  freeSummaryTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  freeSummaryDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  freeFeaturesGrid: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  freeFeatureText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
  },

  matrixHeading: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  matrixTable: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: "hidden",
  },
  matrixRowHeader: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  matrixRow: {
    flexDirection: "row",
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  matrixRowHighlight: {
    backgroundColor: Palette.primaryLight,
  },
  matrixCell: {
    flex: 1,
    ...Typography.caption,
    color: Palette.text,
  },
  matrixCellKey: {
    fontWeight: "700",
    flex: 1.2,
  },

  /* Trust Card */
  trustCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  trustTexts: {
    flex: 1,
  },
  trustTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  trustSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
  },

  /* Pending Downgrade Banner */
  pendingDowngradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  pendingDowngradeBannerText: {
    ...Typography.bodySmall,
    color: "#b45309",
    flex: 1,
    fontWeight: "600",
  },

  /* Payment History Ledger */
  paymentHistoryCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  paymentHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentHistoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  paymentHistoryTitle: {
    ...Typography.h4,
    fontWeight: "700",
    color: Palette.text,
  },
  paymentsList: {
    gap: Spacing.sm,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  paymentRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  paymentIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentRowTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  paymentRowSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  paymentRowRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  viewReceiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
  },
  viewReceiptBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },

  /* Receipt Modal */
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: Spacing.md,
  },
  receiptModalCard: {
    maxHeight: "85%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  receiptModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.sm,
  },
  receiptModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  receiptModalTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  receiptModalBody: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  receiptHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  receiptInvoiceNum: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
  },
  receiptDate: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  receiptSection: {
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.sm,
  },
  receiptSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  receiptSubscriberName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  receiptSubscriberEmail: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  receiptSubscriberType: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "600",
  },
  receiptPlanRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
  },
  receiptPlanName: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  receiptPlanInterval: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textTransform: "capitalize",
  },
  receiptEntitlementText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  receiptCoverageText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
    marginTop: 2,
  },
  receiptPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptPriceLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  receiptPriceVal: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  receiptRefText: {
    ...Typography.bodySmall,
    fontFamily: "monospace",
    color: Palette.text,
  },
  receiptTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  receiptTotalLabel: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.text,
  },
  receiptTotalVal: {
    ...Typography.h3,
    fontWeight: "800",
    color: Palette.primary,
  },
  receiptIssuerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  receiptIssuerTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.text,
  },
  receiptIssuerSub: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  viewEntitlementsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#EEF2FF",
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  viewEntitlementsBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  viewEntitlementsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primary,
    flex: 1,
  },
  entitlementsModalBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  entitlementBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  entitlementBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  entitlementBannerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  entitlementOverrideNotice: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  entitlementOverrideText: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "600",
  },
  entitlementsListHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  entitlementItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: Palette.border,
  },
  entitlementItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  entitlementItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  entitlementItemDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 1,
  },
  entitlementItemLimit: {
    fontSize: 12,
    color: Palette.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  // Checkout & Promotion Modal Styles
  checkoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  checkoutModalCard: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "90%",
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  checkoutModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  checkoutModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkoutModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  checkoutModalBody: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  checkoutPlanSummaryBox: {
    backgroundColor: "#F8FAFC",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
  },
  checkoutPlanTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkoutPlanName: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.text,
  },
  checkoutPlanDescription: {
    fontSize: 13,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  checkoutEntitlementHighlights: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: 6,
  },
  checkoutHighlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  checkoutHighlightText: {
    fontSize: 13,
    color: Palette.text,
    fontWeight: "500",
  },
  couponSectionContainer: {
    gap: Spacing.xs,
  },
  couponSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  couponInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  couponTextInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
    letterSpacing: 1,
  },
  applyCouponBtn: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  applyCouponBtnDisabled: {
    backgroundColor: Palette.border,
  },
  applyCouponBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  appliedCouponCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: "#F0FDF4",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  appliedCouponLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  appliedCouponCode: {
    fontSize: 15,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  appliedCouponDiscountText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "500",
  },
  removeCouponBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  removeCouponBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.error,
  },
  couponErrorText: {
    fontSize: 12,
    color: Palette.error,
    fontWeight: "600",
    marginTop: 2,
  },
  checkoutPriceBreakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  checkoutBreakdownTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRowLabel: {
    fontSize: 14,
    color: Palette.textMuted,
  },
  priceRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  priceDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.xs,
  },
  totalPayableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  totalPayableLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  totalPayableRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  strikethroughOriginalPrice: {
    fontSize: 14,
    color: Palette.textMuted,
    textDecorationLine: "line-through",
  },
  totalPayableValue: {
    fontSize: 20,
    fontWeight: "900",
    color: Palette.primary,
  },
  checkoutTrustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.sm,
  },
  checkoutTrustText: {
    fontSize: 11,
    color: Palette.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  checkoutModalActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  checkoutConfirmBtn: {
    width: "100%",
  },
  checkoutCancelBtn: {
    width: "100%",
  },
});
