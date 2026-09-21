/**
 * HealPoint - Hospital Admin · Subscription & Billing.
 * Shows this hospital's active subscription, available upgrade plans,
 * Razorpay payment integration, payment invoices, and audit history.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import {
  paymentStatusBadge,
  StatusBadge,
  subscriptionStatusBadge,
} from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { formatINR, formatISODate } from "@/lib/format";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { toErrorMessage } from "@/services/api";
import * as subscriptionService from "@/services/subscriptions";
import type { Subscription, SubscriptionPlan } from "@/types";

export default function AdminSubscriptionScreen() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );

  // Upgrade state
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [confirmUpgradeVisible, setConfirmUpgradeVisible] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [subRes, plansRes] = await Promise.all([
        subscriptionService.getMySubscription(),
        subscriptionService
          .getPlans()
          .catch(() => ({ success: true, plans: [] })),
      ]);
      setSubscription(subRes.subscription);
      if (plansRes.plans && plansRes.plans.length > 0) {
        setPlans(plansRes.plans.filter((p) => p.isActive));
      }
      if (subRes.subscription?.billingCycle === "yearly") {
        setBillingCycle("yearly");
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setConfirmUpgradeVisible(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    setUpgrading(true);
    try {
      const orderRes = await subscriptionService.createSubscriptionOrder({
        planId: selectedPlan._id,
        planKey: selectedPlan.key,
        billingCycle,
      });

      // Free plan handles activation immediately without Razorpay
      if (orderRes.isFree) {
        setConfirmUpgradeVisible(false);
        Alert.alert(
          "Success",
          "Your subscription has been switched to " + selectedPlan.name + "!",
        );
        await loadData();
        return;
      }

      if (!orderRes.orderId) {
        throw new Error(orderRes.message || "Unable to create payment order.");
      }

      const planPrice =
        billingCycle === "yearly"
          ? selectedPlan.yearlyPrice
          : selectedPlan.monthlyPrice;
      const checkoutAmount = orderRes.amount ?? planPrice * 100;

      // Close modal before opening native Razorpay checkout
      setConfirmUpgradeVisible(false);

      const razorpayResponse = await openRazorpayCheckout({
        key: orderRes.keyId || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "",
        order_id: orderRes.orderId,
        amount: checkoutAmount,
        currency: orderRes.currency || "INR",
        name: "HealPoint Healthcare",
        description:
          "Hospital Plan: " + selectedPlan.name + " (" + billingCycle + ")",
        prefill: {
          name: user?.name || undefined,
          email: user?.email || undefined,
          contact: user?.phone || undefined,
        },
        theme: { color: Palette.primary },
      });

      // Verify payment signature on backend
      const verifyRes = await subscriptionService.verifySubscriptionPayment({
        razorpay_order_id:
          razorpayResponse.razorpay_order_id || orderRes.orderId,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature || "",
        planId: selectedPlan._id,
        planKey: selectedPlan.key,
        billingCycle,
      });

      if (verifyRes.success) {
        Alert.alert(
          "Payment Successful",
          "Your subscription to " + selectedPlan.name + " is now active!",
        );
        await loadData();
      } else {
        throw new Error(verifyRes.message || "Payment verification failed.");
      }
    } catch (err) {
      const msg = toErrorMessage(err, "Payment could not be completed.");
      if (!msg.toLowerCase().includes("cancel")) {
        Alert.alert("Upgrade Notice", msg);
      }
    } finally {
      setUpgrading(false);
      setSelectedPlan(null);
    }
  };

  const hospitalName =
    subscription?.hospital && typeof subscription.hospital === "object"
      ? subscription.hospital.name
      : subscription?.hospitalName || "Your Hospital";

  const currentPlanKey =
    subscription?.planKey || subscription?.planDetails?.key || "free";
  const isCurrentPlan = (plan: SubscriptionPlan) =>
    plan.key.toLowerCase() === currentPlanKey.toLowerCase() &&
    subscription?.status === "active";

  return (
    <AdminModuleScreen
      title="Subscription & Billing"
      subtitle="Manage your hospital's plan and billing"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={loadData}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
      >
        {/* CURRENT PLAN CARD */}
        {subscription && (
          <Card padded style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hospitalName}>{hospitalName}</Text>
                <Text style={styles.planTitle}>
                  {subscription.planName || subscription.planKey || "Free Plan"}
                </Text>
              </View>
              <View style={styles.badges}>
                <StatusBadge
                  value={subscription.status}
                  variant={subscriptionStatusBadge(subscription.status)}
                />
                <Badge
                  label={String(
                    subscription.paymentStatus || "n/a",
                  ).toUpperCase()}
                  variant={paymentStatusBadge(subscription.paymentStatus)}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Price</Text>
                <Text style={styles.metricValue}>
                  {formatINR(subscription.amount)}
                  <Text style={styles.metricSub}>
                    /{subscription.billingCycle === "yearly" ? "yr" : "mo"}
                  </Text>
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Start Date</Text>
                <Text style={styles.metricValue}>
                  {formatISODate(subscription.startDate)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Renewal / Expiry</Text>
                <Text style={styles.metricValue}>
                  {formatISODate(subscription.expiryDate)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Auto-Renew</Text>
                <Text style={styles.metricValue}>
                  {subscription.autoRenew ? "Enabled" : "Off"}
                </Text>
              </View>
            </View>

            {subscription.planDetails?.features &&
              subscription.planDetails.features.length > 0 && (
                <View style={styles.featuresBox}>
                  <Text style={styles.featuresBoxTitle}>
                    Included in this plan:
                  </Text>
                  {subscription.planDetails.features.map((feat) => (
                    <View key={feat} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={Palette.success}
                      />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              )}
          </Card>
        )}

        {/* BILLING CYCLE SELECTOR */}
        <View style={styles.cycleSection}>
          <Text style={styles.sectionTitle}>Available Upgrade Plans</Text>
          <View style={styles.cycleToggleContainer}>
            <Pressable
              style={[
                styles.cycleButton,
                billingCycle === "monthly" && styles.cycleButtonActive,
              ]}
              onPress={() => setBillingCycle("monthly")}
            >
              <Text
                style={[
                  styles.cycleButtonText,
                  billingCycle === "monthly" && styles.cycleButtonTextActive,
                ]}
              >
                Monthly
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.cycleButton,
                billingCycle === "yearly" && styles.cycleButtonActive,
              ]}
              onPress={() => setBillingCycle("yearly")}
            >
              <Text
                style={[
                  styles.cycleButtonText,
                  billingCycle === "yearly" && styles.cycleButtonTextActive,
                ]}
              >
                Yearly
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>Save ~15%</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* AVAILABLE PLANS LIST */}
        {plans.length === 0 ? (
          <Card padded>
            <Text style={styles.muted}>
              Loading available subscription packages...
            </Text>
          </Card>
        ) : (
          plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan);
            const price =
              billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <Card
                key={plan._id}
                padded
                style={[styles.planCard, isCurrent && styles.activePlanCard]}
              >
                <View style={styles.planCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planCardName}>{plan.name}</Text>
                      {isCurrent && (
                        <Badge label="ACTIVE PLAN" variant="success" />
                      )}
                    </View>
                    {plan.description ? (
                      <Text style={styles.planCardDescription}>
                        {plan.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceNumber}>{formatINR(price)}</Text>
                  <Text style={styles.priceCycle}>
                    /{billingCycle === "yearly" ? "year" : "month"}
                  </Text>
                </View>

                <View style={styles.planFeaturesList}>
                  {(plan.features || []).map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={isCurrent ? Palette.primary : Palette.textMuted}
                      />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.planCardFooter}>
                  {isCurrent ? (
                    <Button
                      title="Current Plan"
                      variant="outline"
                      disabled
                      fullWidth
                    />
                  ) : (
                    <Button
                      title={"Upgrade to " + plan.name}
                      variant="primary"
                      onPress={() => handleSelectPlan(plan)}
                      fullWidth
                    />
                  )}
                </View>
              </Card>
            );
          })
        )}

        {/* PAYMENT INVOICES / BILLING RECORDS */}
        {subscription?.payments && subscription.payments.length > 0 && (
          <Card padded>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="receipt-outline"
                size={20}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Invoices & Payments</Text>
            </View>
            <View style={styles.paymentsList}>
              {subscription.payments.map((p, idx) => (
                <View key={p._id || idx} style={styles.paymentItem}>
                  <View style={styles.paymentLeft}>
                    <Text style={styles.paymentAmount}>
                      {formatINR(p.amount)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatISODate(p.paidAt || p.createdAt)} ·{" "}
                      {p.billingCycle
                        ? p.billingCycle.toUpperCase()
                        : "SUBSCRIPTION"}
                    </Text>
                    {p.razorpayPaymentId ? (
                      <Text style={styles.paymentTxn}>
                        Txn: {p.razorpayPaymentId}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={String(p.paymentStatus || "PAID").toUpperCase()}
                    variant={p.paymentStatus === "paid" ? "success" : "warning"}
                  />
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* SUBSCRIPTION AUDIT TRAIL */}
        {subscription?.history && subscription.history.length > 0 && (
          <Card padded>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={20} color={Palette.primary} />
              <Text style={styles.sectionTitle}>Subscription History</Text>
            </View>
            {subscription.history.map((entry, index) => (
              <View key={String(entry._id || index)} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={styles.historyTexts}>
                  <Text style={styles.historyAction}>
                    {String(entry.action || "")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.historyNote}>
                    {entry.note || ""}{" "}
                    {entry.changedByName ? "· " + entry.changedByName : ""} ·{" "}
                    {formatISODate(entry.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* CONFIRM UPGRADE DIALOG */}
      {selectedPlan && (
        <ConfirmDialog
          visible={confirmUpgradeVisible}
          title={"Switch to " + selectedPlan.name + "?"}
          message={
            "You are selecting the " +
            selectedPlan.name +
            " plan at " +
            formatINR(
              billingCycle === "yearly"
                ? selectedPlan.yearlyPrice
                : selectedPlan.monthlyPrice,
            ) +
            " per " +
            (billingCycle === "yearly" ? "year" : "month") +
            ". Real-time payments are processed securely via Razorpay."
          }
          confirmLabel={
            selectedPlan.key === "free"
              ? "Activate Free Plan"
              : "Proceed to Razorpay"
          }
          cancelLabel="Cancel"
          loading={upgrading}
          onConfirm={handleConfirmUpgrade}
          onCancel={() => {
            setConfirmUpgradeVisible(false);
            setSelectedPlan(null);
          }}
        />
      )}
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  heroCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hospitalName: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planTitle: {
    ...Typography.h3,
    color: Palette.primary,
    marginTop: 2,
    fontWeight: "700",
  },
  badges: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.md,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  metricItem: {
    width: "46%",
    backgroundColor: Palette.background,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  metricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  metricValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
    marginTop: 2,
  },
  metricSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "normal",
  },
  featuresBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  featuresBoxTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  featureText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
  cycleSection: {
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cycleToggleContainer: {
    flexDirection: "row",
    backgroundColor: Palette.border,
    borderRadius: Radius.pill,
    padding: 3,
  },
  cycleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    gap: Spacing.xs,
  },
  cycleButtonActive: {
    backgroundColor: Palette.surface,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  cycleButtonText: {
    ...Typography.label,
    color: Palette.textMuted,
  },
  cycleButtonTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  discountBadge: {
    backgroundColor: "#E2F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  discountText: {
    ...Typography.caption,
    color: Palette.success,
    fontSize: 10,
    fontWeight: "700",
  },
  planCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  activePlanCard: {
    borderColor: Palette.primary,
    borderWidth: 2,
    backgroundColor: Palette.surface,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  planCardName: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  planCardDescription: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginVertical: Spacing.sm,
  },
  priceNumber: {
    ...Typography.h2,
    color: Palette.primary,
    fontWeight: "700",
  },
  priceCycle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginLeft: Spacing.xs,
  },
  planFeaturesList: {
    marginVertical: Spacing.sm,
    gap: 4,
  },
  planCardFooter: {
    marginTop: Spacing.sm,
  },
  paymentsList: {
    gap: Spacing.sm,
  },
  paymentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  paymentLeft: {
    gap: 2,
  },
  paymentAmount: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  paymentDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  paymentTxn: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  historyRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginTop: 6,
  },
  historyTexts: {
    flex: 1,
    gap: 2,
  },
  historyAction: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "500",
  },
  historyNote: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  muted: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
});
