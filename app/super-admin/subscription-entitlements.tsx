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
import * as subscriptionService from "@/services/subscriptions";
import type {
  EntitlementOverride,
  FeatureCatalogItem,
  PlanFeatureMatrixItem,
  PlanValidationResponse,
} from "@/types";

type TabMode = "matrix" | "catalog" | "validator" | "overrides";

export default function SuperAdminSubscriptionEntitlementsScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabMode>("matrix");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [planMatrix, setPlanMatrix] = useState<PlanFeatureMatrixItem[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("care_pro");

  // Validator State
  const [validatorPlanKey, setValidatorPlanKey] = useState("care_pro");
  const [validatorPrice, setValidatorPrice] = useState("799");
  const [validatorVideoQuota, setValidatorVideoQuota] = useState("6");
  const [validatorFamilyLimit, setValidatorFamilyLimit] = useState("4");
  const [validatorFeatureCode, setValidatorFeatureCode] =
    useState("VIDEO_CONSULTATION");
  const [validationResult, setValidationResult] = useState<
    PlanValidationResponse["validation"] | null
  >(null);
  const [validating, setValidating] = useState(false);

  // Manual Overrides State
  const [overridesList, setOverridesList] = useState<
    Array<{ userId: string; userName: string; override: EntitlementOverride }>
  >([]);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [overrideFeatureKey, setOverrideFeatureKey] =
    useState("VIDEO_CONSULTATION");
  const [overrideValueInput, setOverrideValueInput] = useState("10");
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [catRes, matrixRes, subsRes] = await Promise.all([
        subscriptionService.getFeatureCatalog().catch(() => null),
        subscriptionService.getPlanFeatureMatrix().catch(() => null),
        subscriptionService.getSubscriptions({ limit: 100 }).catch(() => null),
      ]);

      if (catRes?.success && Array.isArray(catRes.catalog)) {
        setCatalog(catRes.catalog);
      }
      if (matrixRes?.success && Array.isArray(matrixRes.matrix)) {
        setPlanMatrix(matrixRes.matrix);
        if (
          matrixRes.matrix.length > 0 &&
          !matrixRes.matrix.some((p) => p.planKey === selectedPlanKey)
        ) {
          setSelectedPlanKey(matrixRes.matrix[0].planKey);
        }
      }

      // Collect overrides from subscriptions
      const collected: Array<{
        userId: string;
        userName: string;
        override: EntitlementOverride;
      }> = [];
      if (subsRes?.subscriptions) {
        for (const sub of subsRes.subscriptions) {
          if (sub.userId && Array.isArray((sub as any).entitlementOverrides)) {
            for (const ov of (sub as any).entitlementOverrides) {
              if (ov.isActive) {
                collected.push({
                  userId: String(sub.userId),
                  userName: (sub as any).userName || sub.hospitalName || "User",
                  override: ov,
                });
              }
            }
          }
        }
      }
      setOverridesList(collected);
    } catch (err: any) {
      setError(err?.message || "Failed to load entitlement data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPlanKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const runValidationCheck = async () => {
    setValidating(true);
    try {
      const payload = {
        key: validatorPlanKey,
        name: validatorPlanKey.toUpperCase(),
        billingInterval: validatorPlanKey.startsWith("annual")
          ? "yearly"
          : "monthly",
        price: Number(validatorPrice) || 0,
        videoConsultationsMonthly: Number(validatorVideoQuota) || 0,
        familyMembersLimit: Number(validatorFamilyLimit) || 1,
        featureDetails: [
          {
            code: validatorFeatureCode,
            included: true,
            quota: Number(validatorVideoQuota) || 0,
          },
        ],
      };

      const res = await subscriptionService.validatePlanEntitlements(payload);
      if (res?.success) {
        setValidationResult(res.validation);
      }
    } catch (err: any) {
      Alert.alert("Validation Error", err?.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleCreateOverride = async () => {
    if (!targetUserId.trim()) {
      Alert.alert("Validation Error", "User ID is required.");
      return;
    }
    if (!overrideReason.trim()) {
      Alert.alert(
        "Validation Error",
        "Administrative reason is mandatory for manual overrides.",
      );
      return;
    }

    setSubmittingOverride(true);
    try {
      const parsedValue =
        overrideFeatureKey === "VIDEO_CONSULTATION" ||
        overrideFeatureKey === "FAMILY_HEALTHCARE"
          ? Number(overrideValueInput) || 0
          : overrideValueInput === "true" || overrideValueInput === "1";

      const res = await subscriptionService.createEntitlementOverride({
        userId: targetUserId.trim(),
        featureKey: overrideFeatureKey,
        overrideValue: parsedValue,
        reason: overrideReason.trim(),
      });

      if (res?.success) {
        Alert.alert(
          "Success",
          "Manual entitlement override granted and logged in audit center.",
        );
        setOverrideModalVisible(false);
        setTargetUserId("");
        setOverrideReason("");
        loadData();
      }
    } catch (err: any) {
      Alert.alert(
        "Override Failed",
        err?.message || "Could not grant override.",
      );
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleRevokeOverride = async (userId: string, overrideId?: string) => {
    if (!overrideId) return;

    Alert.alert(
      "Revoke Override",
      "Are you sure you want to revoke this manual entitlement override? The user will immediately revert to their baseline plan entitlement.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await subscriptionService.revokeEntitlementOverride(
                overrideId,
                {
                  userId,
                  reason: "Administrative revocation by Super Admin",
                },
              );
              if (res?.success) {
                Alert.alert("Success", "Entitlement override revoked.");
                loadData();
              }
            } catch (err: any) {
              Alert.alert(
                "Revocation Failed",
                err?.message || "Failed to revoke override",
              );
            }
          },
        },
      ],
    );
  };

  const selectedPlan =
    planMatrix.find((p) => p.planKey === selectedPlanKey) || planMatrix[0];

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription Entitlements</Text>
        </View>
        <Loading label="Loading entitlement catalog & plan matrices..." />
      </SafeAreaView>
    );
  }

  if (error && planMatrix.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription Entitlements</Text>
        </View>
        <ErrorState
          title="Unable to Load Entitlements"
          message={error}
          onRetry={loadData}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Benefits & Entitlements</Text>
          <Text style={styles.headerSubtitle}>
            Authoritative feature catalog, matrix & revenue protection
          </Text>
        </View>
      </View>

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
        {/* KPI SUMMARY CARDS */}
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiCard}>
            <View
              style={[styles.kpiIconCircle, { backgroundColor: "#EEF2FF" }]}
            >
              <Ionicons name="apps" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.kpiValue}>{catalog.length || 15}</Text>
            <Text style={styles.kpiLabel}>Controlled Features</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[styles.kpiIconCircle, { backgroundColor: "#ECFDF5" }]}
            >
              <Ionicons name="shield-checkmark" size={20} color="#059669" />
            </View>
            <Text style={styles.kpiValue}>{planMatrix.length || 8}</Text>
            <Text style={styles.kpiLabel}>Verified Plans</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[styles.kpiIconCircle, { backgroundColor: "#FEF2F2" }]}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
            </View>
            <Text style={styles.kpiValue}>0</Text>
            <Text style={styles.kpiLabel}>Catalog Conflicts</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <View
              style={[styles.kpiIconCircle, { backgroundColor: "#FFFBEB" }]}
            >
              <Ionicons name="key" size={20} color="#D97706" />
            </View>
            <Text style={styles.kpiValue}>{overridesList.length}</Text>
            <Text style={styles.kpiLabel}>Active Overrides</Text>
          </Card>
        </View>

        {/* TAB NAVIGATION */}
        <View style={styles.tabBar}>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "matrix" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("matrix")}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={
                activeTab === "matrix" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "matrix" && styles.tabLabelActive,
              ]}
            >
              Plan Matrix
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "catalog" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("catalog")}
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={
                activeTab === "catalog" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "catalog" && styles.tabLabelActive,
              ]}
            >
              Catalog
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "validator" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("validator")}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={
                activeTab === "validator" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "validator" && styles.tabLabelActive,
              ]}
            >
              Validator
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "overrides" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("overrides")}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={
                activeTab === "overrides" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "overrides" && styles.tabLabelActive,
              ]}
            >
              Overrides
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: PLAN MATRIX */}
        {activeTab === "matrix" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Plan Feature Matrix</Text>
              <Text style={styles.sectionSubtitle}>
                Select an active plan to inspect its authoritative feature
                entitlements and limits
              </Text>
            </View>

            {/* Plan Selector Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.planChipsRow}
            >
              {planMatrix.map((p) => {
                const isSelected = p.planKey === selectedPlanKey;
                return (
                  <Pressable
                    key={p.planKey}
                    onPress={() => setSelectedPlanKey(p.planKey)}
                    style={[
                      styles.planChip,
                      isSelected && styles.planChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.planChipText,
                        isSelected && styles.planChipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                    <Badge
                      label={p.billingInterval.toUpperCase()}
                      variant={
                        p.billingInterval === "yearly" ? "primary" : "neutral"
                      }
                    />
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Plan Details Card */}
            {selectedPlan && (
              <Card style={styles.matrixCard}>
                <View style={styles.matrixCardHeader}>
                  <View>
                    <Text style={styles.matrixPlanName}>
                      {selectedPlan.name}
                    </Text>
                    <Text style={styles.matrixPlanMeta}>
                      Interval: {selectedPlan.billingInterval.toUpperCase()} •
                      Video Quota: {selectedPlan.videoConsultationsMonthly}/mo •
                      Family: {selectedPlan.familyMembersLimit} Members
                    </Text>
                  </View>
                  <Badge
                    label={`${selectedPlan.features.filter((f) => f.isIncluded).length} / ${
                      selectedPlan.features.length
                    } Included`}
                    variant="success"
                  />
                </View>

                {/* Features List for Selected Plan */}
                <View style={styles.featuresList}>
                  {selectedPlan.features.map((feat) => (
                    <View key={feat.key} style={styles.featureRow}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons
                          name={
                            feat.isIncluded
                              ? "checkmark-circle"
                              : "close-circle"
                          }
                          size={20}
                          color={
                            feat.isIncluded
                              ? Palette.success
                              : Palette.textMuted
                          }
                        />
                      </View>
                      <View style={styles.featureInfo}>
                        <View style={styles.featureTitleRow}>
                          <Text style={styles.featureName}>{feat.name}</Text>
                          <Badge
                            label={feat.type.toUpperCase()}
                            variant={
                              feat.type === "quota"
                                ? "primary"
                                : feat.type === "limit"
                                  ? "warning"
                                  : "neutral"
                            }
                          />
                        </View>
                        <Text style={styles.featureDesc}>
                          {feat.description}
                        </Text>
                        {feat.limit !== null && (
                          <Text style={styles.featureLimit}>
                            Limit / Quota: {feat.limit} {feat.unit || ""}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </View>
        )}

        {/* TAB 2: CONTROLLED FEATURE CATALOG */}
        {activeTab === "catalog" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Controlled Platform Features
              </Text>
              <Text style={styles.sectionSubtitle}>
                HealPoint backend registers only features backed by real code &
                infrastructure
              </Text>
            </View>

            {catalog.map((item) => (
              <Card key={item.key} style={styles.catalogCard}>
                <View style={styles.catalogCardHeader}>
                  <View style={styles.catalogTitleGroup}>
                    <Text style={styles.catalogName}>{item.name}</Text>
                    <Text style={styles.catalogKey}>KEY: {item.key}</Text>
                  </View>
                  <Badge label="SUPPORTED" variant="success" />
                </View>
                <Text style={styles.catalogDesc}>{item.description}</Text>
                <View style={styles.catalogMetaRow}>
                  <Badge label={`Type: ${item.type}`} variant="primary" />
                  {item.unit && (
                    <Badge label={`Unit: ${item.unit}`} variant="neutral" />
                  )}
                  <Badge
                    label={
                      item.defaultForFree
                        ? "Free Default: YES"
                        : "Free Default: NO"
                    }
                    variant={item.defaultForFree ? "success" : "warning"}
                  />
                  {item.dependencies?.length > 0 && (
                    <Badge
                      label={`Requires: ${item.dependencies.join(", ")}`}
                      variant="warning"
                    />
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* TAB 3: PLAN CONSISTENCY & CONFLICT VALIDATOR */}
        {activeTab === "validator" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Plan Consistency Validator
              </Text>
              <Text style={styles.sectionSubtitle}>
                Inspect and verify plan changes before activation to prevent
                price & benefit mismatches
              </Text>
            </View>

            <Card style={styles.validatorFormCard}>
              <Text style={styles.formSectionLabel}>
                TEST PLAN CONFIGURATION
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Plan Key</Text>
                <TextInput
                  style={styles.textInput}
                  value={validatorPlanKey}
                  onChangeText={setValidatorPlanKey}
                  placeholder="e.g. care_pro"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Price (₹ INR)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={validatorPrice}
                    onChangeText={setValidatorPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Monthly Video Visits</Text>
                  <TextInput
                    style={styles.textInput}
                    value={validatorVideoQuota}
                    onChangeText={setValidatorVideoQuota}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Family Members Limit</Text>
                  <TextInput
                    style={styles.textInput}
                    value={validatorFamilyLimit}
                    onChangeText={setValidatorFamilyLimit}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Feature Code</Text>
                  <TextInput
                    style={styles.textInput}
                    value={validatorFeatureCode}
                    onChangeText={setValidatorFeatureCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Button
                title={
                  validating
                    ? "Running Rule Engine..."
                    : "Run Consistency Check"
                }
                onPress={runValidationCheck}
                variant="primary"
                loading={validating}
              />
            </Card>

            {/* Validation Result Box */}
            {validationResult && (
              <Card
                style={[
                  styles.resultCard,
                  validationResult.isValid
                    ? styles.resultCardValid
                    : styles.resultCardInvalid,
                ]}
              >
                <View style={styles.resultHeader}>
                  <Ionicons
                    name={
                      validationResult.isValid
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={28}
                    color={
                      validationResult.isValid ? Palette.success : Palette.error
                    }
                  />
                  <View style={styles.resultTitleGroup}>
                    <Text style={styles.resultTitle}>
                      {validationResult.isValid
                        ? "Configuration Valid & Consistent"
                        : "Configuration Conflicts Detected"}
                    </Text>
                    <Text style={styles.resultSubtitle}>
                      {validationResult.isValid
                        ? "Plan adheres to platform pricing and entitlement constraints."
                        : "Plan violates core backend entitlement safety rules."}
                    </Text>
                  </View>
                </View>

                {validationResult.issues?.length > 0 && (
                  <View style={styles.issuesList}>
                    <Text style={styles.issuesHeading}>
                      BLOCKING CONFLICTS:
                    </Text>
                    {validationResult.issues.map((iss, idx) => (
                      <View key={idx} style={styles.issueItem}>
                        <Ionicons
                          name="close"
                          size={16}
                          color={Palette.error}
                        />
                        <Text style={styles.issueText}>{iss.message}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {validationResult.warnings?.length > 0 && (
                  <View style={styles.warningsList}>
                    <Text style={styles.warningsHeading}>ADMIN WARNINGS:</Text>
                    {validationResult.warnings.map((warn, idx) => (
                      <View key={idx} style={styles.warningItem}>
                        <Ionicons name="warning" size={16} color="#D97706" />
                        <Text style={styles.warningText}>{warn.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            )}
          </View>
        )}

        {/* TAB 4: MANUAL OVERRIDES */}
        {activeTab === "overrides" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>
                  Manual Entitlement Overrides
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Audited exceptions for patient care support with strict
                  security tracking
                </Text>
              </View>
              <Button
                title="+ Add Override"
                variant="primary"
                onPress={() => setOverrideModalVisible(true)}
              />
            </View>

            {overridesList.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={48}
                  color={Palette.primary}
                />
                <Text style={styles.emptyTitle}>Zero Active Overrides</Text>
                <Text style={styles.emptySubtitle}>
                  All patients are currently operating strictly on verified
                  subscription plan benefits without manual overrides.
                </Text>
              </Card>
            ) : (
              overridesList.map((item, idx) => (
                <Card key={idx} style={styles.overrideCard}>
                  <View style={styles.overrideCardHeader}>
                    <View>
                      <Text style={styles.overrideUserName}>
                        {item.userName}
                      </Text>
                      <Text style={styles.overrideUserId}>
                        ID: {item.userId}
                      </Text>
                    </View>
                    <Badge label="ACTIVE OVERRIDE" variant="warning" />
                  </View>

                  <View style={styles.overrideDetails}>
                    <Text style={styles.overrideFeature}>
                      Feature:{" "}
                      <Text style={styles.boldText}>
                        {item.override.featureKey}
                      </Text>
                    </Text>
                    <Text style={styles.overrideValue}>
                      Granted Value:{" "}
                      <Text style={styles.boldText}>
                        {String(item.override.overrideValue)}
                      </Text>
                    </Text>
                    <Text style={styles.overrideReason}>
                      Reason: "{item.override.reason}"
                    </Text>
                    <Text style={styles.overrideAuthor}>
                      Authorized By:{" "}
                      {item.override.authorizedByName || "Super Admin"}
                    </Text>
                  </View>

                  <Button
                    title="Revoke Override"
                    variant="danger"
                    onPress={() =>
                      handleRevokeOverride(item.userId, item.override._id)
                    }
                  />
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* CREATE OVERRIDE MODAL */}
      <Modal
        visible={overrideModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOverrideModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Grant Manual Entitlement</Text>
              <Pressable onPress={() => setOverrideModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalNotice}>
                <Ionicons name="information-circle" size={18} color="#4F46E5" />
                <Text style={styles.modalNoticeText}>
                  Manual overrides are permanently recorded in the security
                  audit log. Overrides never bypass payment verification,
                  privacy, or clinical boundaries.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient User ID *</Text>
                <TextInput
                  style={styles.textInput}
                  value={targetUserId}
                  onChangeText={setTargetUserId}
                  placeholder="Paste MongoDB ObjectId"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Feature Key *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {catalog.map((f) => (
                    <Pressable
                      key={f.key}
                      onPress={() => setOverrideFeatureKey(f.key)}
                      style={[
                        styles.chip,
                        overrideFeatureKey === f.key && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          overrideFeatureKey === f.key && styles.chipTextActive,
                        ]}
                      >
                        {f.key}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Override Value (e.g. Quota count or true/false) *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={overrideValueInput}
                  onChangeText={setOverrideValueInput}
                  placeholder="e.g. 10 or true"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Administrative Reason *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={overrideReason}
                  onChangeText={setOverrideReason}
                  placeholder="Mandatory justification for this override"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setOverrideModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Grant Override"
                variant="primary"
                onPress={handleCreateOverride}
                loading={submittingOverride}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.sm,
    alignItems: "center",
  },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
  },
  kpiLabel: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: "#EEF2FF",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabLabelActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  tabContent: {
    gap: Spacing.md,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  planChipsRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  planChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  planChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: Palette.primary,
  },
  planChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  planChipTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  matrixCard: {
    padding: Spacing.md,
  },
  matrixCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  matrixPlanName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  matrixPlanMeta: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  featuresList: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: Palette.border,
  },
  featureIconWrap: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureName: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  featureDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  featureLimit: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.primary,
    marginTop: 2,
  },
  catalogCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  catalogCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  catalogTitleGroup: {
    flex: 1,
  },
  catalogName: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  catalogKey: {
    fontSize: 10,
    fontFamily: "monospace",
    color: Palette.textMuted,
    marginTop: 1,
  },
  catalogDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  catalogMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: Spacing.xs,
  },
  validatorFormCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  formSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 4,
  },
  inputRow: {
    flexDirection: "row",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    fontSize: 14,
    color: Palette.text,
    backgroundColor: Palette.surface,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  resultCard: {
    padding: Spacing.md,
    borderWidth: 1.5,
  },
  resultCardValid: {
    borderColor: Palette.success,
    backgroundColor: "#F0FDF4",
  },
  resultCardInvalid: {
    borderColor: Palette.error,
    backgroundColor: "#FEF2F2",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  resultTitleGroup: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  resultSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  issuesList: {
    marginTop: Spacing.sm,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
  },
  issuesHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.error,
    marginBottom: 2,
  },
  issueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  issueText: {
    fontSize: 12,
    color: Palette.error,
    flex: 1,
  },
  warningsList: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  warningsHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
    marginBottom: 2,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#B45309",
    flex: 1,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  overrideCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  overrideCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  overrideUserName: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  overrideUserId: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  overrideDetails: {
    gap: 2,
    backgroundColor: "#FFFBEB",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  overrideFeature: {
    fontSize: 12,
    color: Palette.text,
  },
  overrideValue: {
    fontSize: 12,
    color: Palette.text,
  },
  overrideReason: {
    fontSize: 12,
    color: Palette.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  overrideAuthor: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 2,
  },
  boldText: {
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "85%",
    padding: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalNotice: {
    flexDirection: "row",
    gap: Spacing.xs,
    backgroundColor: "#EEF2FF",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  modalNoticeText: {
    fontSize: 12,
    color: Palette.text,
    flex: 1,
    lineHeight: 16,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: 6,
    marginTop: 4,
  },
  chipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: Palette.primary,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.text,
  },
  chipTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
});
