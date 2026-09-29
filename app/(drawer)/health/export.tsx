/**
 * HealPoint — Smart Patient Data Portability & Secure Health Export Center.
 *
 * Patient-controlled health-data portability area:
 * 1. My Health Data — Live records scope across 10 categories
 * 2. Export Health Records — Custom category, date range & format selector with Preview confirmation
 * 3. Export History — Snapshot ledger with status badges, expiration timer, and secure download
 * 4. Shared Data — Controlled time-limited external shares with instant revocation
 * 5. Access History — Transparent chronological audit trail of all disclosures
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import * as healthExportService from "@/services/healthExport";
import type {
  HealthExportCategory,
  HealthExportFormat,
  HealthExportStatus,
  HealthExportJob,
  HealthExportShare,
  ExportDataSummaryResponse,
  ExportPreviewResult,
  ExportAccessHistoryResponse,
} from "@/types";

type ActiveTab = "data" | "export" | "history" | "shares" | "audit";

const CATEGORY_METADATA: Record<
  HealthExportCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap; description: string }
> = {
  demographics: {
    label: "Profile & Demographics",
    icon: "person-outline",
    description:
      "Full name, DOB, gender, blood group, allergies, chronic conditions.",
  },
  appointments: {
    label: "Appointments & Visits",
    icon: "calendar-outline",
    description: "Confirmed, completed, and past appointment encounters.",
  },
  consultations: {
    label: "Consultation History",
    icon: "fitness-outline",
    description:
      "Doctor clinical assessments, examination notes, and vitals records.",
  },
  prescriptions: {
    label: "Prescriptions",
    icon: "medkit-outline",
    description:
      "Active and historical medicines, dosage instructions, and diet advice.",
  },
  reports: {
    label: "Medical Reports",
    icon: "newspaper-outline",
    description:
      "Diagnostic lab reports, pathology findings, and clinical files.",
  },
  documents: {
    label: "Health Documents",
    icon: "folder-open-outline",
    description:
      "Digital Health Wallet uploaded records and insurance documents.",
  },
  timeline: {
    label: "Health Timeline",
    icon: "time-outline",
    description: "Chronological medical journey milestones and events.",
  },
  follow_ups: {
    label: "Follow-Ups & Care Plans",
    icon: "repeat-outline",
    description: "Physician follow-up advice and scheduled continuity care.",
  },
  billing: {
    label: "Billing & Receipts",
    icon: "receipt-outline",
    description: "Consultation payments, receipts, and fee breakdown records.",
  },
  hospital_pass: {
    label: "Hospital Digital Pass",
    icon: "qr-code-outline",
    description:
      "Check-in timestamps, reception verification, and queue tokens.",
  },
};

export default function HealthExportCenterScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>("data");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("self");

  // Data summary state
  const [dataSummary, setDataSummary] =
    useState<ExportDataSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export builder state
  const [selectedCategories, setSelectedCategories] = useState<
    HealthExportCategory[]
  >(["demographics", "appointments", "prescriptions", "reports", "documents"]);
  const [dateRangePreset, setDateRangePreset] = useState<
    "all" | "30d" | "90d" | "1y"
  >("all");
  const [exportFormat, setExportFormat] = useState<HealthExportFormat>("json");

  // Preview & Confirmation Modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewResult | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);

  // History & Shares state
  const [exportsList, setExportsList] = useState<HealthExportJob[]>([]);
  const [sharesList, setSharesList] = useState<HealthExportShare[]>([]);
  const [accessHistory, setAccessHistory] =
    useState<ExportAccessHistoryResponse | null>(null);

  // Share creation modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedExportForShare, setSelectedExportForShare] =
    useState<HealthExportJob | null>(null);
  const [recipientType, setRecipientType] = useState<
    "doctor" | "hospital" | "external_system"
  >("doctor");
  const [recipientName, setRecipientName] = useState("");
  const [recipientDetail, setRecipientDetail] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [sharingLoading, setSharingLoading] = useState(false);

  // Load live health data summary
  const loadDataSummary = useCallback(async () => {
    try {
      setError(null);
      const famId =
        selectedMemberId === "self" || selectedMemberId === "all"
          ? undefined
          : selectedMemberId;
      const res = await healthExportService.getMyHealthDataSummary(famId);
      setDataSummary(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load health data summary.");
    } finally {
      setLoadingSummary(false);
      setRefreshing(false);
    }
  }, [selectedMemberId]);

  // Load export history
  const loadExports = useCallback(async () => {
    try {
      const res = await healthExportService.listPatientExports(1, 20);
      setExportsList(res.data);
    } catch (err: any) {
      console.warn("Failed to load exports:", err);
    }
  }, []);

  // Load shares
  const loadShares = useCallback(async () => {
    try {
      const res = await healthExportService.listPatientShares();
      setSharesList(res);
    } catch (err: any) {
      console.warn("Failed to load shares:", err);
    }
  }, []);

  // Load audit history
  const loadAuditHistory = useCallback(async () => {
    try {
      const res = await healthExportService.getExportAccessHistory();
      setAccessHistory(res);
    } catch (err: any) {
      console.warn("Failed to load access history:", err);
    }
  }, []);

  useEffect(() => {
    loadDataSummary();
  }, [loadDataSummary]);

  useEffect(() => {
    if (activeTab === "history") loadExports();
    if (activeTab === "shares") loadShares();
    if (activeTab === "audit") loadAuditHistory();
  }, [activeTab, loadExports, loadShares, loadAuditHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === "data" || activeTab === "export") loadDataSummary();
    if (activeTab === "history") loadExports();
    if (activeTab === "shares") loadShares();
    if (activeTab === "audit") loadAuditHistory();
  }, [activeTab, loadDataSummary, loadExports, loadShares, loadAuditHistory]);

  // Toggle category in builder
  const toggleCategory = (cat: HealthExportCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories(
      Object.keys(CATEGORY_METADATA) as HealthExportCategory[],
    );
  };

  const deselectAllCategories = () => {
    setSelectedCategories(["demographics"]);
  };

  // Compute date range payload based on preset
  const computedDateRange = useMemo(() => {
    if (dateRangePreset === "all") return { type: "all" as const };
    const now = new Date();
    let fromDate = new Date();
    if (dateRangePreset === "30d") fromDate.setDate(now.getDate() - 30);
    if (dateRangePreset === "90d") fromDate.setDate(now.getDate() - 90);
    if (dateRangePreset === "1y") fromDate.setFullYear(now.getFullYear() - 1);
    return {
      type: "custom" as const,
      from: fromDate.toISOString(),
      to: now.toISOString(),
    };
  }, [dateRangePreset]);

  // Request preview
  const handleOpenPreview = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert(
        "Selection Required",
        "Please select at least one data category to export.",
      );
      return;
    }
    try {
      setGenerating(true);
      const famId =
        selectedMemberId === "self" || selectedMemberId === "all"
          ? undefined
          : selectedMemberId;
      const preview = await healthExportService.previewExportRequest({
        familyMemberId: famId,
        categories: selectedCategories,
        dateRange: computedDateRange,
        format: exportFormat,
      });
      setPreviewData(preview);
      setPreviewModalVisible(true);
    } catch (err: any) {
      Alert.alert(
        "Preview Error",
        err?.message || "Could not generate export preview.",
      );
    } finally {
      setGenerating(false);
    }
  };

  // Confirm and start compilation
  const handleConfirmExport = async (forceNew = false) => {
    try {
      setGenerating(true);
      const famId =
        selectedMemberId === "self" || selectedMemberId === "all"
          ? undefined
          : selectedMemberId;
      const res = await healthExportService.createExportJob({
        familyMemberId: famId,
        categories: selectedCategories,
        dateRange: computedDateRange,
        format: exportFormat,
        forceNew,
      });

      setPreviewModalVisible(false);
      Alert.alert(
        res.isReused
          ? "Export Ready (Reused Snapshot)"
          : "Export Compilation Started",
        res.message ||
          "Your export job is being compiled securely in the background.",
        [
          {
            text: "View My Exports",
            onPress: () => {
              setActiveTab("history");
              loadExports();
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert(
        "Export Request Failed",
        err?.message || "Could not initiate export compilation.",
      );
    } finally {
      setGenerating(false);
    }
  };

  // Download action
  const handleDownloadExport = async (job: HealthExportJob) => {
    if (job.status !== "ready" && job.status !== "downloaded") {
      Alert.alert(
        "Not Ready",
        `This export is currently in '${job.status}' status and cannot be downloaded.`,
      );
      return;
    }
    const downloadUrl = healthExportService.getExportDownloadEndpoint(
      job.exportId,
    );
    Alert.alert(
      "Download Health Export",
      `Download ${job.format.toUpperCase()} export package for ${job.patientName}? (Checksum: ${job.checksum?.slice(0, 8)}...)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Download",
          onPress: async () => {
            try {
              const supported = await Linking.canOpenURL(downloadUrl);
              if (supported) {
                await Linking.openURL(downloadUrl);
              } else {
                Alert.alert(
                  "Notice",
                  `Download endpoint ready at: ${downloadUrl}`,
                );
              }
              // Refresh exports list to reflect download count
              setTimeout(loadExports, 2000);
            } catch (err: any) {
              Alert.alert(
                "Download Error",
                err?.message || "Could not open download link.",
              );
            }
          },
        },
      ],
    );
  };

  // Open share modal
  const handleOpenShareModal = (job: HealthExportJob) => {
    setSelectedExportForShare(job);
    setRecipientName("");
    setRecipientDetail("");
    setExpiryDays("7");
    setShareModalVisible(true);
  };

  // Submit share creation
  const handleCreateShare = async () => {
    if (!selectedExportForShare) return;
    if (!recipientName.trim()) {
      Alert.alert(
        "Input Required",
        "Please enter the recipient's name or clinic identifier.",
      );
      return;
    }

    try {
      setSharingLoading(true);
      const res = await healthExportService.createExportShareLink(
        selectedExportForShare.exportId,
        {
          recipientType,
          recipientName: recipientName.trim(),
          recipientDetail: recipientDetail.trim(),
          expiryDays: Number(expiryDays) || 7,
          categories: selectedExportForShare.categories,
        },
      );

      setShareModalVisible(false);
      Alert.alert(
        "Share Link Created",
        `Secure share created for ${res.data.recipientName}. Valid until ${new Date(res.data.expiresAt).toLocaleDateString()}.`,
        [
          {
            text: "View Shared Data",
            onPress: () => {
              setActiveTab("shares");
              loadShares();
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert(
        "Share Failed",
        err?.message || "Could not generate share link.",
      );
    } finally {
      setSharingLoading(false);
    }
  };

  // Revoke share
  const handleRevokeShare = (share: HealthExportShare) => {
    Alert.alert(
      "Revoke Health Share?",
      `Are you sure you want to revoke access for ${share.recipientName}?\n\nNew downloads and access will be blocked immediately.\n(Note: Any copy previously downloaded by the recipient cannot be remotely erased.)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke Access",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await healthExportService.revokePatientShare(
                share.shareId,
                "Revoked by patient via Health Export Center",
              );
              Alert.alert("Access Revoked", res.message);
              loadShares();
            } catch (err: any) {
              Alert.alert(
                "Revocation Failed",
                err?.message || "Could not revoke share.",
              );
            }
          },
        },
      ],
    );
  };

  // Render status badge for export
  const renderExportStatusBadge = (status: HealthExportStatus) => {
    let variant: BadgeVariant = "neutral";
    let label = status.toUpperCase();
    if (status === "ready") {
      variant = "success";
      label = "READY";
    } else if (status === "preparing" || status === "requested") {
      variant = "warning";
      label = status === "preparing" ? "PREPARING" : "REQUESTED";
    } else if (status === "downloaded") {
      variant = "primary";
      label = "DOWNLOADED";
    } else if (status === "expired") {
      variant = "neutral";
      label = "EXPIRED";
    } else if (status === "failed") {
      variant = "error";
      label = "FAILED";
    }
    return <Badge label={label} variant={variant} />;
  };

  // Render status badge for share
  const renderShareStatusBadge = (status: string) => {
    let variant: BadgeVariant = "neutral";
    if (status === "active") variant = "success";
    if (status === "accessed") variant = "primary";
    if (status === "revoked") variant = "error";
    if (status === "expired") variant = "neutral";
    return <Badge label={status.toUpperCase()} variant={variant} />;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DrawerToggleButton color={Palette.text} />
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Health Data & Export</Text>
            <Text style={styles.headerSubtitle}>
              Portability, Exports & Secure Sharing
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.headerPrivacyBtn}
          onPress={() => router.push("/(drawer)/privacy" as any)}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={Palette.primary}
          />
          <Text style={styles.headerPrivacyText}>Consent</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "data" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("data")}
          >
            <Ionicons
              name="server-outline"
              size={16}
              color={activeTab === "data" ? Palette.primary : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "data" && styles.tabLabelActive,
              ]}
            >
              My Health Data
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "export" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("export")}
          >
            <Ionicons
              name="cloud-download-outline"
              size={16}
              color={
                activeTab === "export" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "export" && styles.tabLabelActive,
              ]}
            >
              Export Records
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "history" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color={
                activeTab === "history" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "history" && styles.tabLabelActive,
              ]}
            >
              Export History
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "shares" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("shares")}
          >
            <Ionicons
              name="share-social-outline"
              size={16}
              color={
                activeTab === "shares" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "shares" && styles.tabLabelActive,
              ]}
            >
              Shared Data
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabItem,
              activeTab === "audit" && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab("audit")}
          >
            <Ionicons
              name="shield-outline"
              size={16}
              color={
                activeTab === "audit" ? Palette.primary : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "audit" && styles.tabLabelActive,
              ]}
            >
              Access History
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
      >
        {/* Family Member Filter Bar */}
        {(activeTab === "data" || activeTab === "export") && (
          <View style={styles.filterBarContainer}>
            <FamilyMemberFilterBar
              selectedMemberId={selectedMemberId}
              onSelectMember={(id: string) => {
                setSelectedMemberId(id);
                setLoadingSummary(true);
              }}
            />
          </View>
        )}

        {/* TAB 1: MY HEALTH DATA */}
        {activeTab === "data" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {dataSummary?.subjectName || "Patient"} Health Records
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Authentic clinical records and documents available across
                  HealPoint
                </Text>
              </View>
              <Badge
                label={`${dataSummary?.totalRecords || 0} Total Records`}
                variant="primary"
              />
            </View>

            {loadingSummary ? (
              <Loading label="Inspecting patient records across systems..." />
            ) : error ? (
              <ErrorState
                title="Error Loading Records"
                message={error}
                onRetry={loadDataSummary}
              />
            ) : (
              <View style={styles.categoryGrid}>
                {(Object.keys(CATEGORY_METADATA) as HealthExportCategory[]).map(
                  (cat) => {
                    const meta = CATEGORY_METADATA[cat];
                    const count = dataSummary?.recordsSummary[cat] || 0;
                    const isAvailable = count > 0;

                    return (
                      <Card
                        key={cat}
                        style={[
                          styles.categoryCard,
                          !isAvailable && styles.categoryCardEmpty,
                        ]}
                      >
                        <View style={styles.categoryHeader}>
                          <View
                            style={[
                              styles.categoryIconWrap,
                              isAvailable && styles.categoryIconWrapActive,
                            ]}
                          >
                            <Ionicons
                              name={meta.icon}
                              size={20}
                              color={
                                isAvailable
                                  ? Palette.primary
                                  : Palette.textMuted
                              }
                            />
                          </View>
                          <Badge
                            label={
                              isAvailable ? `${count} Records` : "No Records"
                            }
                            variant={isAvailable ? "success" : "neutral"}
                          />
                        </View>
                        <Text style={styles.categoryTitle}>{meta.label}</Text>
                        <Text style={styles.categoryDesc}>
                          {meta.description}
                        </Text>
                      </Card>
                    );
                  },
                )}

                <View style={styles.quickExportBanner}>
                  <Ionicons
                    name="shield-checkmark"
                    size={24}
                    color={Palette.primary}
                  />
                  <View style={styles.quickExportTextCol}>
                    <Text style={styles.quickExportTitle}>
                      Ready to export your records?
                    </Text>
                    <Text style={styles.quickExportSubtitle}>
                      Generate a portable JSON or CSV copy protected by snapshot
                      encryption.
                    </Text>
                  </View>
                  <Button
                    title="Export Now"
                    variant="primary"
                    onPress={() => setActiveTab("export")}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: EXPORT HEALTH RECORDS (BUILDER) */}
        {activeTab === "export" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Compile Health Export</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose data categories, date range, and desired export format
                </Text>
              </View>
            </View>

            {/* Step 1: Categories Selection */}
            <Card style={styles.builderCard}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Select Data Categories</Text>
              </View>
              <Text style={styles.stepSubtitle}>
                Data minimization guarantee: Only selected categories are
                packaged.
              </Text>

              <View style={styles.chipsRow}>
                <Pressable
                  style={styles.actionChip}
                  onPress={selectAllCategories}
                >
                  <Ionicons
                    name="checkbox-outline"
                    size={14}
                    color={Palette.primary}
                  />
                  <Text style={styles.actionChipText}>Select All</Text>
                </Pressable>
                <Pressable
                  style={styles.actionChip}
                  onPress={deselectAllCategories}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={14}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.actionChipText}>Reset</Text>
                </Pressable>
              </View>

              <View style={styles.categorySelectList}>
                {(Object.keys(CATEGORY_METADATA) as HealthExportCategory[]).map(
                  (cat) => {
                    const meta = CATEGORY_METADATA[cat];
                    const count = dataSummary?.recordsSummary[cat] || 0;
                    const isSelected = selectedCategories.includes(cat);

                    return (
                      <Pressable
                        key={cat}
                        style={[
                          styles.categoryCheckRow,
                          isSelected && styles.categoryCheckRowSelected,
                        ]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={20}
                          color={
                            isSelected ? Palette.primary : Palette.textMuted
                          }
                        />
                        <View style={styles.categoryCheckTextCol}>
                          <Text style={styles.categoryCheckName}>
                            {meta.label}
                          </Text>
                          <Text style={styles.categoryCheckCount}>
                            {count > 0
                              ? `${count} records available`
                              : "No current records"}
                          </Text>
                        </View>
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                    );
                  },
                )}
              </View>
            </Card>

            {/* Step 2: Date Range */}
            <Card style={styles.builderCard}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Select Date Range</Text>
              </View>

              <View style={styles.presetsRow}>
                {(
                  [
                    { key: "all", label: "All Available" },
                    { key: "30d", label: "Last 30 Days" },
                    { key: "90d", label: "Last 90 Days" },
                    { key: "1y", label: "Last 1 Year" },
                  ] as const
                ).map((preset) => {
                  const isSelected = dateRangePreset === preset.key;
                  return (
                    <Pressable
                      key={preset.key}
                      style={[
                        styles.presetOption,
                        isSelected && styles.presetOptionSelected,
                      ]}
                      onPress={() => setDateRangePreset(preset.key)}
                    >
                      <Text
                        style={[
                          styles.presetOptionText,
                          isSelected && styles.presetOptionTextSelected,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Step 3: Format */}
            <Card style={styles.builderCard}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Export Package Format</Text>
              </View>

              <View style={styles.formatRow}>
                <Pressable
                  style={[
                    styles.formatOption,
                    exportFormat === "json" && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportFormat("json")}
                >
                  <Ionicons
                    name="code-slash-outline"
                    size={20}
                    color={
                      exportFormat === "json"
                        ? Palette.primary
                        : Palette.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.formatOptionTitle,
                      exportFormat === "json" &&
                        styles.formatOptionTitleSelected,
                    ]}
                  >
                    Structured JSON
                  </Text>
                  <Text style={styles.formatOptionDesc}>
                    Complete snapshot with full clinical metadata and digital
                    integrity checksum.
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.formatOption,
                    exportFormat === "csv" && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportFormat("csv")}
                >
                  <Ionicons
                    name="grid-outline"
                    size={20}
                    color={
                      exportFormat === "csv"
                        ? Palette.primary
                        : Palette.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.formatOptionTitle,
                      exportFormat === "csv" &&
                        styles.formatOptionTitleSelected,
                    ]}
                  >
                    Tabular CSV
                  </Text>
                  <Text style={styles.formatOptionDesc}>
                    Spreadsheet-friendly tables for appointments, prescriptions,
                    and billing.
                  </Text>
                </Pressable>
              </View>
            </Card>

            {/* Confirmation CTA */}
            <View style={styles.ctaContainer}>
              <Button
                title={
                  generating
                    ? "Preparing Preview..."
                    : "Review & Preview Export"
                }
                variant="primary"
                onPress={handleOpenPreview}
                disabled={generating || selectedCategories.length === 0}
              />
            </View>
          </View>
        )}

        {/* TAB 3: EXPORT HISTORY */}
        {activeTab === "history" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Export Package History</Text>
                <Text style={styles.sectionSubtitle}>
                  Snapshots generated for your account. Valid for 72 hours from
                  compilation.
                </Text>
              </View>
            </View>

            {exportsList.length === 0 ? (
              <EmptyState
                title="No Exports Found"
                message="You have not generated any health data exports yet. Tap below to create your first export."
                action={
                  <Button
                    title="Generate Export"
                    variant="primary"
                    onPress={() => setActiveTab("export")}
                  />
                }
              />
            ) : (
              exportsList.map((job) => {
                const isReady =
                  job.status === "ready" || job.status === "downloaded";
                const isExpired =
                  job.status === "expired" ||
                  new Date() > new Date(job.expiresAt);

                return (
                  <Card key={job._id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View>
                        <Text style={styles.historyExportId}>
                          {job.exportId}
                        </Text>
                        <Text style={styles.historySubject}>
                          Subject: {job.familyMemberName || job.patientName} (
                          {job.familyMemberName ? "Dependent" : "Self"})
                        </Text>
                      </View>
                      {renderExportStatusBadge(
                        isExpired ? "expired" : job.status,
                      )}
                    </View>

                    <View style={styles.historyMetaRow}>
                      <Badge
                        label={job.format.toUpperCase()}
                        variant="neutral"
                      />
                      <Text style={styles.historyMetaText}>
                        {job.recordsSummary?.totalRecords || 0} Records
                      </Text>
                      {job.fileSize ? (
                        <Text style={styles.historyMetaText}>
                          {(job.fileSize / 1024).toFixed(1)} KB
                        </Text>
                      ) : null}
                      <Text style={styles.historyMetaText}>
                        Downloads: {job.downloadCount}/{job.maxDownloads}
                      </Text>
                    </View>

                    <View style={styles.historyDatesRow}>
                      <Text style={styles.historyDateLabel}>
                        Generated:{" "}
                        {new Date(job.createdAt).toLocaleDateString()}
                      </Text>
                      <Text
                        style={[
                          styles.historyDateLabel,
                          isExpired && {
                            color: Palette.error,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {isExpired
                          ? "Expired"
                          : `Expires: ${new Date(job.expiresAt).toLocaleDateString()}`}
                      </Text>
                    </View>

                    {job.checksum && (
                      <Text style={styles.checksumText}>
                        SHA-256: {job.checksum.slice(0, 16)}...
                      </Text>
                    )}

                    <View style={styles.historyActionsRow}>
                      {isReady && !isExpired && (
                        <Button
                          title="Download"
                          variant="primary"
                          onPress={() => handleDownloadExport(job)}
                        />
                      )}
                      {isReady && !isExpired && (
                        <Button
                          title="Share Link"
                          variant="secondary"
                          onPress={() => handleOpenShareModal(job)}
                        />
                      )}
                      {(job.status === "requested" ||
                        job.status === "preparing") && (
                        <Button
                          title="Cancel"
                          variant="ghost"
                          onPress={async () => {
                            await healthExportService.cancelExportJob(
                              job.exportId,
                            );
                            loadExports();
                          }}
                        />
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: SHARED DATA */}
        {activeTab === "shares" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Shared Health Records</Text>
                <Text style={styles.sectionSubtitle}>
                  Controlled external share links granted to doctors, hospitals,
                  or clinics.
                </Text>
              </View>
            </View>

            {sharesList.length === 0 ? (
              <EmptyState
                title="No Active Shares"
                message="You have not created any external share links. Exports can be shared with specific care providers from the Export History tab."
              />
            ) : (
              sharesList.map((share) => {
                const isActive = share.status === "active";
                return (
                  <Card key={share._id} style={styles.shareCard}>
                    <View style={styles.shareCardHeader}>
                      <View>
                        <Text style={styles.shareRecipient}>
                          {share.recipientName}
                        </Text>
                        <Text style={styles.shareType}>
                          Type: {share.recipientType.toUpperCase()} | ID:{" "}
                          {share.shareId}
                        </Text>
                      </View>
                      {renderShareStatusBadge(share.status)}
                    </View>

                    <Text style={styles.shareCategories}>
                      Scope:{" "}
                      {share.categories
                        .map((c) => CATEGORY_METADATA[c]?.label || c)
                        .join(", ")}
                    </Text>

                    <View style={styles.shareFooter}>
                      <Text style={styles.shareExpiry}>
                        Expires:{" "}
                        {new Date(share.expiresAt).toLocaleDateString()}
                      </Text>
                      <Text style={styles.shareAccessCount}>
                        Accessed: {share.accessCount} times
                      </Text>
                    </View>

                    {isActive && (
                      <View style={styles.shareActionRow}>
                        <Button
                          title="Revoke Access"
                          variant="danger"
                          onPress={() => handleRevokeShare(share)}
                        />
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* TAB 5: ACCESS HISTORY (AUDIT) */}
        {activeTab === "audit" && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Access & Disclosure Trail
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Transparent, tamper-evident log of all export compilation and
                  download events.
                </Text>
              </View>
            </View>

            {(!accessHistory || accessHistory.accessLogs.length === 0) && (
              <EmptyState
                title="No Access Records"
                message="No recent download or external disclosure activity recorded for your account."
              />
            )}

            {accessHistory?.accessLogs.map((log) => (
              <Card key={log._id} style={styles.auditCard}>
                <View style={styles.auditHeader}>
                  <Badge
                    label={log.result === "allowed" ? "AUTHORIZED" : "DENIED"}
                    variant={log.result === "allowed" ? "success" : "error"}
                  />
                  <Text style={styles.auditTime}>
                    {new Date(log.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.auditPurpose}>{log.purpose}</Text>
                <Text style={styles.auditAccessor}>
                  Accessor: {log.accessorName} ({log.accessorRole})
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* PREVIEW CONFIRMATION MODAL */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Health Data Export</Text>
              <Pressable onPress={() => setPreviewModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.previewNoticeBox}>
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.previewNoticeText}>
                  This export will compile a secure snapshot of your clinical
                  records. It will be available for download for 72 hours and
                  will automatically expire thereafter.
                </Text>
              </View>

              <View style={styles.previewSummaryTable}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewKey}>Subject</Text>
                  <Text style={styles.previewVal}>
                    {previewData?.familyMemberName || previewData?.patientName}{" "}
                    ({previewData?.familyMemberName ? "Family Member" : "Self"})
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewKey}>Format</Text>
                  <Text style={styles.previewVal}>
                    {previewData?.format.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewKey}>Date Range</Text>
                  <Text style={styles.previewVal}>
                    {previewData?.dateRange.type === "all"
                      ? "All Records"
                      : "Custom Range"}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewKey}>Total Scope</Text>
                  <Text
                    style={[
                      styles.previewVal,
                      { color: Palette.primary, fontWeight: "700" },
                    ]}
                  >
                    {previewData?.totalRecords} Records
                  </Text>
                </View>
              </View>

              <Text style={styles.previewSectionTitle}>
                Categories Included:
              </Text>
              <View style={styles.previewCategoriesList}>
                {previewData?.selectedCategories.map((c) => (
                  <View key={c} style={styles.previewCatItem}>
                    <Text style={styles.previewCatName}>
                      {CATEGORY_METADATA[c]?.label || c}
                    </Text>
                    <Text style={styles.previewCatCount}>
                      {previewData.recordsSummary[c] || 0} records
                    </Text>
                  </View>
                ))}
              </View>

              {previewData?.reusableExportAvailable && (
                <View style={styles.reusedNoticeBox}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={Palette.info}
                  />
                  <Text style={styles.reusedNoticeText}>
                    An identical export was compiled in the last 6 hours (
                    {previewData.reusableExportId}). You can download it
                    immediately or force a fresh compilation.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {previewData?.reusableExportAvailable ? (
                <>
                  <Button
                    title="Reuse Existing"
                    variant="secondary"
                    onPress={() => handleConfirmExport(false)}
                    disabled={generating}
                  />
                  <Button
                    title="Force Fresh Export"
                    variant="primary"
                    onPress={() => handleConfirmExport(true)}
                    disabled={generating}
                  />
                </>
              ) : (
                <Button
                  title={
                    generating
                      ? "Queueing Export..."
                      : "Generate Export Snapshot"
                  }
                  variant="primary"
                  onPress={() => handleConfirmExport(false)}
                  disabled={generating}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* SHARE CREATION MODAL */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Health Records</Text>
              <Pressable onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Recipient Category</Text>
              <View style={styles.typeSelectorRow}>
                {(
                  [
                    { key: "doctor", label: "Doctor" },
                    { key: "hospital", label: "Hospital" },
                    { key: "external_system", label: "External Clinic / Lab" },
                  ] as const
                ).map((t) => (
                  <Pressable
                    key={t.key}
                    style={[
                      styles.typeOption,
                      recipientType === t.key && styles.typeOptionActive,
                    ]}
                    onPress={() => setRecipientType(t.key)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        recipientType === t.key && styles.typeOptionTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                Recipient Name / Clinic Title
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Dr. Anand Sharma / City Care Lab"
                placeholderTextColor={Palette.textMuted}
                value={recipientName}
                onChangeText={setRecipientName}
              />

              <Text style={styles.inputLabel}>
                Contact / Email / ID (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. dr.anand@metrohospital.org"
                placeholderTextColor={Palette.textMuted}
                value={recipientDetail}
                onChangeText={setRecipientDetail}
              />

              <Text style={styles.inputLabel}>Validity Duration (Days)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={expiryDays}
                onChangeText={setExpiryDays}
              />

              <View style={styles.shareWarningBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={Palette.warning}
                />
                <Text style={styles.shareWarningText}>
                  Access can be revoked at any time. External parties who
                  download the package during the validity window will possess a
                  local snapshot copy that cannot be remotely deleted.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title={
                  sharingLoading ? "Creating..." : "Confirm & Create Share Link"
                }
                variant="primary"
                onPress={handleCreateShare}
                disabled={sharingLoading}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  headerTitleCol: {
    marginLeft: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  headerPrivacyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
  },
  headerPrivacyText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  tabsContainer: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabsScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Palette.primary,
  },
  tabLabel: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  filterBarContainer: {
    marginBottom: Spacing.sm,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  tabContent: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  categoryGrid: {
    gap: Spacing.md,
  },
  categoryCard: {
    padding: Spacing.md,
  },
  categoryCardEmpty: {
    opacity: 0.7,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryIconWrapActive: {
    backgroundColor: Palette.primaryLight,
  },
  categoryTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  categoryDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  quickExportBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primaryLight,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: `${Palette.primary}30`,
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  quickExportTextCol: {
    flex: 1,
  },
  quickExportTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  quickExportSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  builderCard: {
    padding: Spacing.md,
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepBadgeText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  stepTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  stepSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
  },
  actionChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  categorySelectList: {
    gap: Spacing.xs,
  },
  categoryCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  categoryCheckRowSelected: {
    backgroundColor: Palette.surface,
    borderColor: Palette.primary,
  },
  categoryCheckTextCol: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  categoryCheckName: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  categoryCheckCount: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  presetOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  presetOptionSelected: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  presetOptionText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  presetOptionTextSelected: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  formatRow: {
    gap: Spacing.sm,
  },
  formatOption: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  formatOptionSelected: {
    backgroundColor: Palette.surface,
    borderColor: Palette.primary,
  },
  formatOptionTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
    marginTop: 4,
  },
  formatOptionTitleSelected: {
    color: Palette.primaryDark,
  },
  formatOptionDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  ctaContainer: {
    marginTop: Spacing.sm,
  },
  historyCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyExportId: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
  },
  historySubject: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: 4,
  },
  historyMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  historyDatesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  historyDateLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  checksumText: {
    fontSize: 10,
    color: Palette.textMuted,
    fontFamily: "monospace",
    marginTop: 4,
  },
  historyActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  shareCard: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  shareCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shareRecipient: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  shareType: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  shareCategories: {
    ...Typography.caption,
    color: Palette.text,
    marginVertical: 4,
  },
  shareFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shareExpiry: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  shareAccessCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  shareActionRow: {
    marginTop: Spacing.sm,
    alignItems: "flex-end",
  },
  auditCard: {
    padding: Spacing.md,
    gap: 4,
  },
  auditHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditTime: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  auditPurpose: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    marginTop: 4,
  },
  auditAccessor: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalBody: {
    marginBottom: Spacing.md,
  },
  modalFooter: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  previewNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Palette.primaryLight,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  previewNoticeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    flex: 1,
    lineHeight: 18,
  },
  previewSummaryTable: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  previewKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  previewVal: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  previewSectionTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  previewCategoriesList: {
    gap: 4,
    marginBottom: Spacing.md,
  },
  previewCatItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  previewCatName: {
    ...Typography.caption,
    color: Palette.text,
  },
  previewCatCount: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  reusedNoticeBox: {
    flexDirection: "row",
    backgroundColor: `${Palette.info}15`,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
    alignItems: "flex-start",
    marginTop: Spacing.xs,
  },
  reusedNoticeText: {
    ...Typography.caption,
    color: Palette.info,
    flex: 1,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    ...Typography.bodySmall,
    color: Palette.text,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  typeSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginVertical: 4,
  },
  typeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
  },
  typeOptionActive: {
    backgroundColor: Palette.primary,
  },
  typeOptionText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  typeOptionTextActive: {
    color: "#FFFFFF",
  },
  shareWarningBox: {
    flexDirection: "row",
    backgroundColor: `${Palette.warning}15`,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
    alignItems: "flex-start",
    marginTop: Spacing.md,
  },
  shareWarningText: {
    ...Typography.caption,
    color: Palette.warning,
    flex: 1,
    lineHeight: 16,
  },
});
