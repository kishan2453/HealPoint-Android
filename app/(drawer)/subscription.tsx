/**
 * HealPoint - Patient Subscription & Video Consultation Plans Screen.
 *
 * Provides patients with complete visibility and management of their subscription:
 *  - Live Video Consultation Quota meter (Used / Remaining / Allowance)
 *  - Current active plan status & monthly cycle renewal date
 *  - Monthly / Yearly billing cycle toggle
 *  - Tiered plan comparison cards: Free (0/mo), Gold (4/mo), Platinum (7/mo), Prime (10/mo)
 *  - Integrated Razorpay checkout bridge with secure backend signature verification
 *  - Real-time quota recalculation upon plan upgrade
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  SubscriptionBillingCycle,
  SubscriptionPlan,
  UserSubscriptionEntitlement,
} from "@/types";

export default function PatientSubscriptionScreen() {
  const params = useLocalSearchParams<{ notice?: string }>();

  const [entitlement, setEntitlement] =
    useState<UserSubscriptionEntitlement | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(
    DEFAULT_SUBSCRIPTION_PLANS,
  );
  const [billingCycle, setBillingCycle] =
    useState<SubscriptionBillingCycle>("monthly");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (params.notice === "subscription_required") {
      setNotice({
        type: "info",
        text: "Video consultations are available with an active premium plan. Choose a plan to continue.",
      });
    } else if (params.notice === "quota_exhausted") {
      setNotice({
        type: "error",
        text: "Your monthly video consultation limit has been reached. Choose an eligible plan to continue.",
      });
    }
  }, [params.notice]);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [entitlementRes, subRes, plansRes] = await Promise.all([
        subscriptionService.getPatientSubscriptionEntitlement(),
        subscriptionService.getMySubscription().catch(() => null),
        subscriptionService.getPlans().catch(() => null),
      ]);

      setEntitlement(entitlementRes);
      setSubscription(subRes?.subscription || null);

      if (
        plansRes &&
        Array.isArray(plansRes.plans) &&
        plansRes.plans.length > 0
      ) {
        // Merge backend plans with standard defaults if any tier is missing
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

  const handleSelectPlan = async (targetPlan: SubscriptionPlan) => {
    const isCurrent =
      entitlement?.planKey.toLowerCase() === targetPlan.key.toLowerCase() &&
      entitlement?.hasActiveSubscription;

    if (isCurrent) {
      Alert.alert(
        "Current Plan",
        `You are already subscribed to the ${targetPlan.name} plan.`,
      );
      return;
    }

    if (targetPlan.key.toLowerCase() === "free") {
      Alert.alert(
        "Free Plan",
        "The Free plan is the default tier with appointment booking and health timeline. To cancel a paid plan, please contact hospital support.",
      );
      return;
    }

    setProcessingPlanId(targetPlan._id);
    setNotice(null);

    try {
      // 1. Create order on backend
      const orderRes = await subscriptionService.createSubscriptionOrder({
        planId: targetPlan._id,
        planKey: targetPlan.key,
        billingCycle,
      });

      if (!orderRes.success) {
        throw new Error(
          orderRes.message || "Failed to initiate subscription order.",
        );
      }

      // If backend marks order as free/promotional zero-amount
      if (orderRes.isFree || !orderRes.orderId) {
        setNotice({
          type: "success",
          text: `Congratulations! Your ${targetPlan.name} plan is now active.`,
        });
        await loadData();
        return;
      }

      // 2. Open Razorpay Checkout bridge
      const amountToPay =
        orderRes.amount ||
        (billingCycle === "yearly"
          ? targetPlan.yearlyPrice * 100
          : targetPlan.monthlyPrice * 100);

      const paymentResult = await openRazorpayCheckout({
        key: orderRes.keyId || "",
        order_id: orderRes.orderId,
        amount: amountToPay,
        currency: orderRes.currency || "INR",
        name: "HealPoint Healthcare",
        description: `${targetPlan.name} Plan (${billingCycle === "yearly" ? "Yearly" : "Monthly"})`,
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
        billingCycle,
      });

      if (verifyRes.success) {
        setNotice({
          type: "success",
          text: `Payment verified! Your ${targetPlan.name} plan with ${getPlanVideoLimit(targetPlan)} video consultations/month is now active.`,
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
          text: "Checkout was cancelled. Your current plan was not changed.",
        });
      } else {
        const msg = toErrorMessage(
          err,
          "Unable to complete plan subscription. Please try again.",
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
    // Default to next month's 1st
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
        <Loading label="Loading your subscription status..." />
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
                  {entitlement?.planName || "Free"} Plan
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
                <Text style={styles.quotaMetricLabel}>Monthly Allowance</Text>
                <Text style={styles.quotaMetricValue}>
                  {entitlement?.monthlyQuota ?? 0}
                </Text>
              </View>
              <View style={styles.quotaMetricDivider} />
              <View style={styles.quotaMetricItem}>
                <Text style={styles.quotaMetricLabel}>Quota Renews On</Text>
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
                  "Upgrade to a video consultation plan to consult top specialists anytime."}
              </Text>
            </View>
          </View>
        </Card>

        {/* BILLING CYCLE SELECTOR */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose Your Healthcare Plan</Text>
          <Text style={styles.sectionSubtitle}>
            Enjoy verified Google Meet consultations, priority bookings, and
            family care
          </Text>
        </View>

        <View style={styles.cycleToggleContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select monthly billing"
            style={[
              styles.cycleTab,
              billingCycle === "monthly" && styles.cycleTabActive,
            ]}
            onPress={() => setBillingCycle("monthly")}
          >
            <Text
              style={[
                styles.cycleTabText,
                billingCycle === "monthly" && styles.cycleTabTextActive,
              ]}
            >
              Monthly Billing
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select yearly billing with savings"
            style={[
              styles.cycleTab,
              billingCycle === "yearly" && styles.cycleTabActive,
            ]}
            onPress={() => setBillingCycle("yearly")}
          >
            <View style={styles.yearlyTabInner}>
              <Text
                style={[
                  styles.cycleTabText,
                  billingCycle === "yearly" && styles.cycleTabTextActive,
                ]}
              >
                Yearly Billing
              </Text>
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>SAVE 17%</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* PLAN COMPARISON CARDS */}
        <View style={styles.plansList}>
          {plans.map((planItem) => {
            const planKey = planItem.key.toLowerCase();
            const isCurrent =
              entitlement?.planKey.toLowerCase() === planKey &&
              (planKey === "free"
                ? !entitlement?.hasActiveSubscription
                : entitlement?.hasActiveSubscription);

            const videoLimit = getPlanVideoLimit(planItem);
            const isProcessing = processingPlanId === planItem._id;

            const isPlatinum = planKey === "platinum";
            const isPrime = planKey === "prime";

            const price =
              billingCycle === "yearly"
                ? planItem.yearlyPrice
                : planItem.monthlyPrice;

            return (
              <Card
                key={planItem._id}
                style={[
                  styles.planCard,
                  isPlatinum && styles.planCardPlatinum,
                  isCurrent && styles.planCardCurrent,
                ]}
              >
                {/* Popular / Recommended Pill */}
                {isPlatinum ? (
                  <View style={styles.popularRibbon}>
                    <Text style={styles.popularRibbonText}>MOST POPULAR</Text>
                  </View>
                ) : isPrime ? (
                  <View style={styles.primeRibbon}>
                    <Text style={styles.primeRibbonText}>ALL INCLUSIVE</Text>
                  </View>
                ) : null}

                <View style={styles.planCardHeader}>
                  <View>
                    <Text style={styles.planCardName}>{planItem.name}</Text>
                    <Text style={styles.planCardDesc} numberOfLines={2}>
                      {planItem.description ||
                        (videoLimit > 0
                          ? `Includes ${videoLimit} video consultations every month.`
                          : "Basic appointments and health records.")}
                    </Text>
                  </View>

                  <View style={styles.planPriceWrap}>
                    <Text style={styles.planPriceAmount}>
                      {price === 0 ? "₹0" : formatINR(price)}
                    </Text>
                    <Text style={styles.planPriceCycle}>
                      {price === 0
                        ? "free"
                        : billingCycle === "yearly"
                          ? "/year"
                          : "/month"}
                    </Text>
                  </View>
                </View>

                {/* Consultation Allowance Highlight */}
                <View
                  style={[
                    styles.videoHighlightBox,
                    videoLimit > 0
                      ? styles.videoHighlightActive
                      : styles.videoHighlightNeutral,
                  ]}
                >
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={videoLimit > 0 ? Palette.primary : Palette.textMuted}
                  />
                  <View style={styles.videoHighlightTexts}>
                    <Text style={styles.videoHighlightCount}>
                      {videoLimit > 0
                        ? `${videoLimit} Video Consultations / month`
                        : "0 Video Consultations included"}
                    </Text>
                    <Text style={styles.videoHighlightSub}>
                      {videoLimit > 0
                        ? "Quota resets automatically every month"
                        : "In-person clinic appointments only"}
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
                      title="Current Plan"
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
                          : planKey === "free"
                            ? "Default Free Plan"
                            : `Choose ${planItem.name}`
                      }
                      variant={isPlatinum || isPrime ? "primary" : "secondary"}
                      fullWidth
                      loading={isProcessing}
                      disabled={isProcessing || planKey === "free"}
                      onPress={() => handleSelectPlan(planItem)}
                    />
                  )}
                </View>
              </Card>
            );
          })}
        </View>

        {/* TRUST & GUARANTEE INFO */}
        <Card style={styles.trustCard}>
          <View style={styles.trustItem}>
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={Palette.primary}
            />
            <View style={styles.trustTexts}>
              <Text style={styles.trustTitle}>Bank-Grade Secure Payments</Text>
              <Text style={styles.trustSubtitle}>
                Protected by Razorpay 256-bit encryption. UPI, Cards &
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
                Cancelled or rescheduled appointments do not consume your
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
                Every consultation connects with accredited doctors over Google
                Meet.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
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
  },
  quotaMetricValue: {
    ...Typography.bodyMedium,
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
    marginTop: Spacing.sm,
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
    fontSize: 10,
    fontWeight: "800",
    color: Palette.success,
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
  planCardPlatinum: {
    borderColor: Palette.primary,
    borderWidth: 2,
  },
  planCardCurrent: {
    backgroundColor: Palette.surface,
  },
  popularRibbon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderBottomLeftRadius: Radius.md,
  },
  popularRibbonText: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.5,
  },
  primeRibbon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#7B61FF",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderBottomLeftRadius: Radius.md,
  },
  primeRibbonText: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  planCardName: {
    ...Typography.h2,
    color: Palette.text,
  },
  planCardDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    maxWidth: 220,
    marginTop: 2,
  },
  planPriceWrap: {
    alignItems: "flex-end",
  },
  planPriceAmount: {
    ...Typography.h1,
    color: Palette.primary,
    fontSize: 26,
  },
  planPriceCycle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  /* Video Highlight Box */
  videoHighlightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  videoHighlightActive: {
    backgroundColor: Palette.primaryLight,
  },
  videoHighlightNeutral: {
    backgroundColor: Palette.surfaceAlt,
  },
  videoHighlightTexts: {
    flex: 1,
  },
  videoHighlightCount: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  videoHighlightSub: {
    ...Typography.caption,
    color: Palette.textMuted,
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
});
