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
  SubscriptionPromotion,
  PromotionAnalyticsOverview,
  PromotionRedemption,
  PromotionDiscountType,
  PromotionBillingCycle,
  PromotionEligibility,
} from "@/types";

type TabFilter = "all" | "active" | "scheduled" | "expired" | "disabled";

const CATALOG_PLAN_OPTIONS = [
  { key: "ALL", label: "All Plans" },
  { key: "care_starter", label: "Care Starter (₹249)" },
  { key: "care_plus", label: "Care Plus (₹499)" },
  { key: "care_pro", label: "Care Pro (₹799)" },
  { key: "family_care", label: "Family Care (₹1,099)" },
  { key: "family_prime", label: "Family Prime (₹1,499)" },
  { key: "annual_care_pro", label: "Annual Care Pro (₹7,999)" },
  { key: "annual_family_prime", label: "Annual Family Prime (₹11,999)" },
];

export default function SuperAdminPromotionsScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Directory & Analytics
  const [promotions, setPromotions] = useState<SubscriptionPromotion[]>([]);
  const [analytics, setAnalytics] = useState<PromotionAnalyticsOverview | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal State
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);

  // Form Fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] =
    useState<PromotionDiscountType>("PERCENTAGE");
  const [formDiscountValue, setFormDiscountValue] = useState("20");
  const [formMaxDiscount, setFormMaxDiscount] = useState("500");
  const [formMinPlanAmount, setFormMinPlanAmount] = useState("0");
  const [formBillingCycle, setFormBillingCycle] =
    useState<PromotionBillingCycle>("both");
  const [formSelectedPlans, setFormSelectedPlans] = useState<string[]>(["ALL"]);
  const [formEligibility, setFormEligibility] =
    useState<PromotionEligibility>("all");
  const [formUsageLimit, setFormUsageLimit] = useState("0");
  const [formPerUserLimit, setFormPerUserLimit] = useState("1");
  const [formDurationDays, setFormDurationDays] = useState("30");

  // Redemptions Ledger Modal
  const [redemptionsModalVisible, setRedemptionsModalVisible] = useState(false);
  const [selectedPromoForRedemptions, setSelectedPromoForRedemptions] =
    useState<SubscriptionPromotion | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [redemptionsList, setRedemptionsList] = useState<PromotionRedemption[]>(
    [],
  );

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [promosRes, analyticsRes] = await Promise.all([
        subscriptionService.getAdminPromotions({
          status: activeTab,
          search: searchQuery,
          limit: 100,
        }),
        subscriptionService.getAdminPromotionAnalytics(),
      ]);

      if (promosRes && promosRes.success) {
        setPromotions(promosRes.promotions || []);
      }
      if (analyticsRes && analyticsRes.success) {
        setAnalytics(analyticsRes);
      }
    } catch (err: any) {
      console.error("Failed to load promotions:", err);
      setError(err?.message || "Failed to load subscription promotions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormDiscountType("PERCENTAGE");
    setFormDiscountValue("20");
    setFormMaxDiscount("500");
    setFormMinPlanAmount("0");
    setFormBillingCycle("both");
    setFormSelectedPlans(["ALL"]);
    setFormEligibility("all");
    setFormUsageLimit("0");
    setFormPerUserLimit("1");
    setFormDurationDays("30");
    setPromoModalVisible(true);
  };

  const handleOpenEditModal = (promo: SubscriptionPromotion) => {
    setIsEditing(true);
    setEditingId(promo._id);
    setFormCode(promo.code);
    setFormName(promo.name);
    setFormDescription(promo.description || "");
    setFormDiscountType(promo.discountType);
    setFormDiscountValue(String(promo.discountValue));
    setFormMaxDiscount(
      promo.maxDiscountAmount ? String(promo.maxDiscountAmount) : "",
    );
    setFormMinPlanAmount(String(promo.minimumPlanAmount || 0));
    setFormBillingCycle(promo.applicableBillingCycles);
    setFormSelectedPlans(promo.applicablePlans || ["ALL"]);
    setFormEligibility(promo.customerEligibility);
    setFormUsageLimit(String(promo.usageLimit || 0));
    setFormPerUserLimit(String(promo.perUserLimit || 1));
    const days = Math.round(
      (new Date(promo.endDate).getTime() -
        new Date(promo.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    setFormDurationDays(String(Math.max(1, days)));
    setPromoModalVisible(true);
  };

  const handleTogglePlanSelection = (planKey: string) => {
    if (planKey === "ALL") {
      setFormSelectedPlans(["ALL"]);
      return;
    }
    let updated = formSelectedPlans.filter((k) => k !== "ALL");
    if (updated.includes(planKey)) {
      updated = updated.filter((k) => k !== planKey);
      if (updated.length === 0) updated = ["ALL"];
    } else {
      updated.push(planKey);
    }
    setFormSelectedPlans(updated);
  };

  const handleSavePromotion = async () => {
    if (!formCode.trim()) {
      Alert.alert("Validation", "Promotion code is required.");
      return;
    }
    if (!formName.trim()) {
      Alert.alert("Validation", "Promotion display name is required.");
      return;
    }
    const val = Number(formDiscountValue);
    if (isNaN(val) || val <= 0) {
      Alert.alert("Validation", "Discount value must be greater than 0.");
      return;
    }
    if (formDiscountType === "PERCENTAGE" && val > 100) {
      Alert.alert("Validation", "Percentage discount cannot exceed 100%.");
      return;
    }

    setSavingPromo(true);
    try {
      const now = new Date();
      const days = Number(formDurationDays) || 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const payload: Partial<SubscriptionPromotion> = {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        description: formDescription.trim(),
        discountType: formDiscountType,
        discountValue: val,
        maxDiscountAmount: formMaxDiscount
          ? Number(formMaxDiscount)
          : undefined,
        minimumPlanAmount: Number(formMinPlanAmount) || 0,
        applicableBillingCycles: formBillingCycle,
        applicablePlans: formSelectedPlans,
        customerEligibility: formEligibility,
        usageLimit: Number(formUsageLimit) || 0,
        perUserLimit: Number(formPerUserLimit) || 1,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
      };

      if (isEditing && editingId) {
        await subscriptionService.updateAdminPromotion(editingId, payload);
        Alert.alert(
          "Success",
          `Promotion ${payload.code} updated successfully.`,
        );
      } else {
        await subscriptionService.createAdminPromotion(payload);
        Alert.alert(
          "Success",
          `Promotion ${payload.code} created successfully.`,
        );
      }

      setPromoModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert("Save Error", err?.message || "Failed to save promotion");
    } finally {
      setSavingPromo(false);
    }
  };

  const handleToggleStatus = async (promo: SubscriptionPromotion) => {
    try {
      const next = !promo.isActive;
      await subscriptionService.toggleAdminPromotionStatus(promo._id, next);
      setPromotions((prev) =>
        prev.map((p) => (p._id === promo._id ? { ...p, isActive: next } : p)),
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to toggle promotion status");
    }
  };

  const handleOpenRedemptions = async (promo: SubscriptionPromotion) => {
    setSelectedPromoForRedemptions(promo);
    setRedemptionsList([]);
    setRedemptionsLoading(true);
    setRedemptionsModalVisible(true);

    try {
      const res = await subscriptionService.getAdminPromotionRedemptions(
        promo._id,
      );
      if (res && res.success) {
        setRedemptionsList(res.redemptions || []);
      }
    } catch (err: any) {
      Alert.alert(
        "Audit Error",
        err?.message || "Failed to load redemptions ledger",
      );
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const getStatusBadgeVariant = (
    status: string,
    isActive: boolean,
  ): BadgeVariant => {
    if (!isActive) return "neutral";
    switch (status) {
      case "active":
        return "success";
      case "scheduled":
        return "primary";
      case "expired":
        return "error";
      default:
        return "neutral";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Offers & Promotions</Text>
            <Text style={styles.headerSubtitle}>
              Controlled Subscription Coupon & Campaign Engine
            </Text>
          </View>
        </View>
        <Button
          title="+ New Coupon"
          onPress={handleOpenCreateModal}
          style={styles.createBtn}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
      >
        {/* KPI Overview Metrics */}
        {analytics?.summary ? (
          <View style={styles.kpiGrid}>
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Ionicons name="pricetags" size={20} color={Palette.primary} />
                <Text style={styles.kpiLabel}>Active Offers</Text>
              </View>
              <Text style={styles.kpiValue}>
                {analytics.summary.activePromotions}
                <Text style={styles.kpiSubValue}>
                  {" "}
                  / {analytics.summary.totalPromotions}
                </Text>
              </Text>
              <Text style={styles.kpiSubtext}>Targeted across plans</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Ionicons name="cart" size={20} color={Palette.info} />
                <Text style={styles.kpiLabel}>Redemptions</Text>
              </View>
              <Text style={styles.kpiValue}>
                {analytics.summary.totalRedemptions}
              </Text>
              <Text style={styles.kpiSubtext}>
                Verified checkout conversions
              </Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Ionicons name="gift" size={20} color={Palette.success} />
                <Text style={styles.kpiLabel}>Discounts Given</Text>
              </View>
              <Text style={[styles.kpiValue, { color: Palette.success }]}>
                {formatINR(analytics.summary.totalDiscountDistributed)}
              </Text>
              <Text style={styles.kpiSubtext}>
                Avg {formatINR(analytics.summary.avgDiscountPerRedemption)} /
                use
              </Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Ionicons name="trending-up" size={20} color="#8B5CF6" />
                <Text style={styles.kpiLabel}>Associated Rev.</Text>
              </View>
              <Text style={[styles.kpiValue, { color: "#8B5CF6" }]}>
                {formatINR(analytics.summary.associatedRevenueGenerated)}
              </Text>
              <Text style={styles.kpiSubtext}>Net revenue captured</Text>
            </Card>
          </View>
        ) : null}

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          {(
            ["all", "active", "scheduled", "expired", "disabled"] as TabFilter[]
          ).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={[styles.tabBtn, isSelected && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    isSelected && styles.tabBtnTextActive,
                  ]}
                >
                  {tab.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={Palette.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coupon code or campaign name..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={loadData}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable
              onPress={() => {
                setSearchQuery("");
                loadData();
              }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : promotions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons
              name="ticket-outline"
              size={48}
              color={Palette.textMuted}
            />
            <Text style={styles.emptyTitle}>No Promotions Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No offers matched "${searchQuery}".`
                : "Create promotional codes to offer discounts on monthly or yearly plans."}
            </Text>
            <Button
              title="Create First Offer"
              onPress={handleOpenCreateModal}
              style={{ marginTop: Spacing.md }}
            />
          </Card>
        ) : (
          <View style={styles.promotionsList}>
            {promotions.map((promo) => {
              const isExpired = new Date(promo.endDate) < new Date();
              const isPercentage = promo.discountType === "PERCENTAGE";

              return (
                <Card key={promo._id} style={styles.promoCard}>
                  {/* Card Header */}
                  <View style={styles.promoCardHeader}>
                    <View style={styles.codeRow}>
                      <View style={styles.codeBadge}>
                        <Ionicons name="pricetag" size={14} color="#1E40AF" />
                        <Text style={styles.codeBadgeText}>{promo.code}</Text>
                      </View>
                      <Badge
                        label={
                          !promo.isActive
                            ? "DISABLED"
                            : isExpired
                              ? "EXPIRED"
                              : promo.status.toUpperCase()
                        }
                        variant={getStatusBadgeVariant(
                          promo.status,
                          promo.isActive,
                        )}
                      />
                    </View>
                    <Switch
                      value={promo.isActive}
                      onValueChange={() => handleToggleStatus(promo)}
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>

                  <Text style={styles.promoName}>{promo.name}</Text>
                  {promo.description ? (
                    <Text style={styles.promoDescription}>
                      {promo.description}
                    </Text>
                  ) : null}

                  {/* Discount & Target Pill */}
                  <View style={styles.discountPillRow}>
                    <View style={styles.discountValuePill}>
                      <Ionicons name="flash" size={14} color="#15803D" />
                      <Text style={styles.discountValuePillText}>
                        {isPercentage
                          ? `${promo.discountValue}% OFF${promo.maxDiscountAmount ? ` (Up to ₹${promo.maxDiscountAmount})` : ""}`
                          : `₹${promo.discountValue} FLAT OFF`}
                      </Text>
                    </View>
                    <View style={styles.cyclePill}>
                      <Text style={styles.cyclePillText}>
                        {promo.applicableBillingCycles === "both"
                          ? "Monthly & Yearly"
                          : promo.applicableBillingCycles === "yearly"
                            ? "Yearly Plans"
                            : "Monthly Plans"}
                      </Text>
                    </View>
                  </View>

                  {/* Progress & Limit details */}
                  <View style={styles.promoMetaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Usage / Limit</Text>
                      <Text style={styles.metaValue}>
                        {promo.timesRedeemed}{" "}
                        <Text style={styles.metaSubValue}>
                          /{" "}
                          {promo.usageLimit > 0
                            ? promo.usageLimit
                            : "Unlimited"}
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Per-User Limit</Text>
                      <Text style={styles.metaValue}>
                        {promo.perUserLimit || 1} use
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Min. Plan Price</Text>
                      <Text style={styles.metaValue}>
                        {promo.minimumPlanAmount > 0
                          ? `₹${promo.minimumPlanAmount}`
                          : "None"}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Valid Until</Text>
                      <Text style={styles.metaValue}>
                        {formatDDMMYYYY(promo.endDate)}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Footer */}
                  <View style={styles.promoCardFooter}>
                    <Pressable
                      style={styles.footerActionBtn}
                      onPress={() => handleOpenRedemptions(promo)}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={16}
                        color={Palette.primary}
                      />
                      <Text style={styles.footerActionBtnText}>
                        Redemptions ({promo.timesRedeemed})
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.footerActionBtn}
                      onPress={() => handleOpenEditModal(promo)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color={Palette.text}
                      />
                      <Text
                        style={[
                          styles.footerActionBtnText,
                          { color: Palette.text },
                        ]}
                      >
                        Edit
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* CREATE / EDIT PROMOTION MODAL */}
      <Modal
        visible={promoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingPromo) setPromoModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="pricetag" size={20} color={Palette.primary} />
                <Text style={styles.modalTitle}>
                  {isEditing
                    ? `Edit Coupon: ${formCode}`
                    : "Create Promotional Coupon"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!savingPromo) setPromoModalVisible(false);
                }}
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Code & Name Row */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Coupon Code *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { letterSpacing: 1.5, fontWeight: "700" },
                  ]}
                  placeholder="e.g. WELCOME50, HEALPRO20"
                  placeholderTextColor={Palette.textMuted}
                  value={formCode}
                  onChangeText={(t) => setFormCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  editable={!isEditing}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Campaign Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. New Year Healthcare Kickoff"
                  placeholderTextColor={Palette.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { height: 60, textAlignVertical: "top" },
                  ]}
                  placeholder="e.g. 50% discount on first month of Care Pro"
                  placeholderTextColor={Palette.textMuted}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                />
              </View>

              {/* Discount Type & Value */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Discount Type</Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      style={[
                        styles.toggleSegment,
                        formDiscountType === "PERCENTAGE" &&
                          styles.toggleSegmentActive,
                      ]}
                      onPress={() => setFormDiscountType("PERCENTAGE")}
                    >
                      <Text
                        style={[
                          styles.toggleSegmentText,
                          formDiscountType === "PERCENTAGE" &&
                            styles.toggleSegmentTextActive,
                        ]}
                      >
                        Percentage (%)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.toggleSegment,
                        formDiscountType === "FIXED_AMOUNT" &&
                          styles.toggleSegmentActive,
                      ]}
                      onPress={() => setFormDiscountType("FIXED_AMOUNT")}
                    >
                      <Text
                        style={[
                          styles.toggleSegmentText,
                          formDiscountType === "FIXED_AMOUNT" &&
                            styles.toggleSegmentTextActive,
                        ]}
                      >
                        Fixed (₹)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 0.8 }]}>
                  <Text style={styles.formLabel}>
                    {formDiscountType === "PERCENTAGE"
                      ? "Percent (%)"
                      : "Amount (₹)"}{" "}
                    *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="e.g. 20"
                    placeholderTextColor={Palette.textMuted}
                    value={formDiscountValue}
                    onChangeText={setFormDiscountValue}
                  />
                </View>
              </View>

              {formDiscountType === "PERCENTAGE" ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Max Discount Cap (₹) [Optional]
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="e.g. 300 (Leaves blank for no cap)"
                    placeholderTextColor={Palette.textMuted}
                    value={formMaxDiscount}
                    onChangeText={setFormMaxDiscount}
                  />
                </View>
              ) : null}

              {/* Billing Cycle Applicability */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Applicable Billing Cycles</Text>
                <View style={styles.toggleRow}>
                  {(
                    ["both", "monthly", "yearly"] as PromotionBillingCycle[]
                  ).map((cycle) => (
                    <Pressable
                      key={cycle}
                      style={[
                        styles.toggleSegment,
                        formBillingCycle === cycle &&
                          styles.toggleSegmentActive,
                      ]}
                      onPress={() => setFormBillingCycle(cycle)}
                    >
                      <Text
                        style={[
                          styles.toggleSegmentText,
                          formBillingCycle === cycle &&
                            styles.toggleSegmentTextActive,
                        ]}
                      >
                        {cycle.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Target Plans Multi-select Chips */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Applicable Subscription Plans
                </Text>
                <View style={styles.chipsWrap}>
                  {CATALOG_PLAN_OPTIONS.map((plan) => {
                    const isSelected = formSelectedPlans.includes(plan.key);
                    return (
                      <Pressable
                        key={plan.key}
                        style={[
                          styles.planChip,
                          isSelected && styles.planChipSelected,
                        ]}
                        onPress={() => handleTogglePlanSelection(plan.key)}
                      >
                        <Text
                          style={[
                            styles.planChipText,
                            isSelected && styles.planChipTextSelected,
                          ]}
                        >
                          {plan.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Limits and Timing Row */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Total Usage Limit (0=∞)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.textMuted}
                    value={formUsageLimit}
                    onChangeText={setFormUsageLimit}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Per-User Cap</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={Palette.textMuted}
                    value={formPerUserLimit}
                    onChangeText={setFormPerUserLimit}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Days Active</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={Palette.textMuted}
                    value={formDurationDays}
                    onChangeText={setFormDurationDays}
                  />
                </View>
              </View>

              {/* Live Preview Card */}
              <View style={styles.previewBox}>
                <Text style={styles.previewHeading}>Simulation Preview</Text>
                <Text style={styles.previewText}>
                  Code:{" "}
                  <Text style={{ fontWeight: "700" }}>
                    {formCode || "COUPON"}
                  </Text>{" "}
                  ·{" "}
                  {formDiscountType === "PERCENTAGE"
                    ? `${formDiscountValue || 0}% discount${formMaxDiscount ? ` (capped at ₹${formMaxDiscount})` : ""}`
                    : `₹${formDiscountValue || 0} flat discount`}
                </Text>
                <Text style={styles.previewSubtext}>
                  On Care Pro (₹799/mo): Patient pays ₹
                  {formDiscountType === "PERCENTAGE"
                    ? Math.max(
                        0,
                        799 -
                          Math.min(
                            Number(formMaxDiscount || 99999),
                            (799 * Number(formDiscountValue || 0)) / 100,
                          ),
                      )
                    : Math.max(0, 799 - Number(formDiscountValue || 0))}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Button
                  title={
                    savingPromo
                      ? "Saving Offer..."
                      : isEditing
                        ? "Update Coupon"
                        : "Launch Coupon"
                  }
                  onPress={handleSavePromotion}
                  loading={savingPromo}
                  style={styles.modalSubmitBtn}
                />
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setPromoModalVisible(false)}
                  disabled={savingPromo}
                  style={styles.modalCancelBtn}
                />
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* REDEMPTIONS AUDIT LEDGER MODAL */}
      <Modal
        visible={redemptionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRedemptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={Palette.success}
                />
                <Text style={styles.modalTitle}>
                  Redemption Ledger: {selectedPromoForRedemptions?.code}
                </Text>
              </View>
              <Pressable onPress={() => setRedemptionsModalVisible(false)}>
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {redemptionsLoading ? (
              <View style={{ padding: Spacing.xl, alignItems: "center" }}>
                <ActivityIndicator size="large" color={Palette.primary} />
                <Text
                  style={{ marginTop: Spacing.sm, color: Palette.textMuted }}
                >
                  Fetching verified redemptions...
                </Text>
              </View>
            ) : redemptionsList.length === 0 ? (
              <View style={{ padding: Spacing.xl, alignItems: "center" }}>
                <Ionicons
                  name="receipt-outline"
                  size={40}
                  color={Palette.textMuted}
                />
                <Text
                  style={{
                    marginTop: Spacing.sm,
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  No Redemptions Yet
                </Text>
                <Text
                  style={{
                    color: Palette.textMuted,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  This coupon has not been redeemed in any verified payment yet.
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.redemptionsScroll}>
                {redemptionsList.map((red, idx) => (
                  <View key={red._id || idx} style={styles.redemptionItem}>
                    <View style={styles.redemptionItemLeft}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={Palette.success}
                      />
                      <View style={{ marginLeft: Spacing.sm }}>
                        <Text style={styles.redemptionPlanKey}>
                          {red.planKey} ({red.billingCycle})
                        </Text>
                        <Text style={styles.redemptionDate}>
                          {formatDDMMYYYY(red.redeemedAt)}
                        </Text>
                        <Text style={styles.redemptionPaymentId}>
                          Payment: {red.razorpayPaymentId || "Verified"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.redemptionItemRight}>
                      <Text style={styles.redemptionDiscountText}>
                        -₹{red.discountApplied}
                      </Text>
                      <Text style={styles.redemptionFinalPaid}>
                        Paid: ₹{red.finalPayableAmount}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 1,
  },
  createBtn: {
    paddingHorizontal: Spacing.sm,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "900",
    color: Palette.text,
  },
  kpiSubValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  kpiSubtext: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: Radius.md,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    ...Shadows.sm,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tabBtnTextActive: {
    color: Palette.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Palette.text,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  promotionsList: {
    gap: Spacing.md,
  },
  promoCard: {
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
  },
  promoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E40AF",
    letterSpacing: 0.5,
  },
  promoName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 2,
  },
  promoDescription: {
    fontSize: 13,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  discountPillRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 4,
    flexWrap: "wrap",
  },
  discountValuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  discountValuePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  cyclePill: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  cyclePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  promoMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    backgroundColor: "#F8FAFC",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  metaItem: {
    minWidth: "45%",
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 1,
  },
  metaSubValue: {
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  promoCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  footerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.xs,
  },
  footerActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "92%",
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Palette.text,
  },
  modalBody: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  formGroup: {
    gap: 4,
  },
  formRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  formInput: {
    height: 44,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Palette.text,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: Radius.md,
    padding: 2,
    height: 44,
  },
  toggleSegment: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  toggleSegmentActive: {
    backgroundColor: "#FFFFFF",
    ...Shadows.sm,
  },
  toggleSegmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  toggleSegmentTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  planChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: "#F8FAFC",
  },
  planChipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: Palette.primary,
  },
  planChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  planChipTextSelected: {
    color: Palette.primary,
    fontWeight: "700",
  },
  previewBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  previewHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  previewText: {
    fontSize: 14,
    color: Palette.text,
    marginTop: 2,
  },
  previewSubtext: {
    fontSize: 13,
    color: Palette.success,
    fontWeight: "600",
    marginTop: 2,
  },
  modalActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalSubmitBtn: {
    width: "100%",
  },
  modalCancelBtn: {
    width: "100%",
  },
  redemptionsScroll: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  redemptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  redemptionItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  redemptionPlanKey: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  redemptionDate: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  redemptionPaymentId: {
    fontSize: 11,
    color: Palette.textMuted,
    fontFamily: "monospace",
  },
  redemptionItemRight: {
    alignItems: "flex-end",
  },
  redemptionDiscountText: {
    fontSize: 14,
    fontWeight: "800",
    color: Palette.success,
  },
  redemptionFinalPaid: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
});
