/**
 * HealPoint — Digital Health Wallet Screen.
 *
 * Premium patient health locker organizing real healthcare data in one unified vault:
 *  - EMR Clinical Records & Vitals
 *  - Digital Prescriptions & Medication Plans
 *  - Diagnostic Medical Reports & Lab Results
 *  - Consultation & Visit History (In-Clinic & Video Meet)
 *  - Verified Bills & Payment Receipts (Razorpay & Cash)
 *  - Digital Hospital Passes with QR Check-In
 *
 * Backed by real authenticated backend data with family member isolation.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  Share,
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
import { QRCodeCanvas } from "@/components/ui/QRCodeCanvas";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as walletService from "@/services/wallet";
import type {
  HealthWalletCounts,
  WalletCategory,
  WalletItem,
} from "@/services/wallet";

const CATEGORIES: {
  key: WalletCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Items", icon: "wallet-outline" },
  {
    key: "prescriptions",
    label: "Prescriptions",
    icon: "document-text-outline",
  },
  { key: "reports", label: "Lab Reports", icon: "bar-chart-outline" },
  { key: "bills", label: "Bills & Receipts", icon: "receipt-outline" },
  { key: "consultations", label: "Consultations", icon: "calendar-outline" },
  { key: "records", label: "EMR Records", icon: "folder-open-outline" },
  { key: "passes", label: "Hospital Passes", icon: "qr-code-outline" },
];

export default function DigitalHealthWalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    memberId?: string;
    category?: string;
  }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    params.memberId || "all",
  );
  const [selectedCategory, setSelectedCategory] = useState<WalletCategory>(
    (params.category as WalletCategory) || "all",
  );
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [counts, setCounts] = useState<HealthWalletCounts>({
    prescriptions: 0,
    reports: 0,
    bills: 0,
    consultations: 0,
    records: 0,
    passes: 0,
    appointments: 0,
    total: 0,
  });
  const [items, setItems] = useState<WalletItem[]>([]);

  // Pass QR Modal
  const [selectedPass, setSelectedPass] = useState<WalletItem | null>(null);

  // Bill Details Modal
  const [selectedBill, setSelectedBill] = useState<WalletItem | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!userId) return;
    try {
      setError("");
      const res = await walletService.getDigitalHealthWallet({
        familyMemberId: familyMemberFilter,
        category: selectedCategory,
        search: search.trim() || undefined,
        sort: sortOrder,
      });

      if (res.success) {
        setCounts(
          res.counts || {
            prescriptions: 0,
            reports: 0,
            bills: 0,
            consultations: 0,
            records: 0,
            passes: 0,
            appointments: 0,
            total: 0,
          },
        );
        setItems(res.items || []);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load Digital Health Wallet."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, familyMemberFilter, selectedCategory, search, sortOrder]);

  useScreenFocus(fetchWallet);

  useEffect(() => {
    setLoading(true);
    fetchWallet();
  }, [fetchWallet]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleOpenDocument = async (url?: string) => {
    if (!url) {
      Alert.alert("File Unavailable", "The document URL is not accessible.");
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(
        "Unable to Open",
        "Could not launch file viewer for this document.",
      );
    }
  };

  const handleShareReport = async (item: WalletItem) => {
    try {
      await Share.share({
        title: item.title,
        message: `HealPoint Lab Report: ${item.name || item.title}\nDate: ${formatDDMMYYYY(item.date)}\nDoctor: ${item.doctor?.name || "Specialist"}\nHospital: ${item.hospital?.name || "HealPoint"}\nAccess URL: ${item.url || "N/A"}`,
      });
    } catch {}
  };

  const handleSharePrescription = async (item: WalletItem) => {
    try {
      const medList = (item.medicines || [])
        .map(
          (m, i) =>
            `${i + 1}. ${m.name} - ${m.dosage || ""} (${m.frequency || ""})`,
        )
        .join("\n");
      await Share.share({
        title: item.title,
        message: `HealPoint Digital Prescription\nDoctor: ${item.doctor?.name}\nDate: ${formatDDMMYYYY(item.date)}\nDiagnosis: ${item.diagnosis || "Consultation"}\n\nMedications:\n${medList || "Prescribed by doctor."}\n\nFollow-up: ${item.followUpAdvice || "As advised by doctor."}`,
      });
    } catch {}
  };

  const handleShareReceipt = async (item: WalletItem) => {
    try {
      const billing = item.billing;
      const breakdownText = billing
        ? [
            `Consultation Fee: ${formatINR(billing.consultationFee)}`,
            billing.serviceFee && billing.serviceFee > 0
              ? `Platform Service Fee: ${formatINR(billing.serviceFee)}`
              : null,
            billing.subscriptionBenefit && billing.subscriptionBenefit > 0
              ? `${billing.planName || "Subscription"} Plan Benefit: -${formatINR(billing.subscriptionBenefit)}`
              : null,
            billing.discount && billing.discount > 0
              ? `Discount: -${formatINR(billing.discount)}`
              : null,
            `Total Amount: ${formatINR(billing.totalAmount)}`,
          ]
            .filter(Boolean)
            .join("\n")
        : `Amount: ${formatINR(item.amount || 0)}`;

      await Share.share({
        title: "HealPoint Verified Payment Receipt",
        message:
          `HealPoint Healthcare - Verified Payment Receipt\n` +
          `----------------------------------------\n` +
          `Appointment: ${item.displayAppointmentId || item.appointmentId}\n` +
          `Patient: ${item.patientName || "Patient"}\n` +
          `Doctor: ${item.doctor?.name || "Doctor"}\n` +
          `Hospital: ${item.hospital?.name || "HealPoint Hospital"}\n` +
          `Date & Time: ${formatDDMMYYYY(item.date || "")} ${item.time || ""}\n` +
          `Payment Method: ${item.paymentMethod === "online" ? "Online (Razorpay)" : "Hospital Cash Counter"}\n` +
          `Status: ${item.statusLabel || "Paid"}\n` +
          (item.razorpayPaymentId
            ? `Transaction ID: ${item.razorpayPaymentId}\n`
            : "") +
          `----------------------------------------\n` +
          breakdownText,
      });
    } catch {}
  };

  const getItemBadgeVariant = (type: string, status?: string): BadgeVariant => {
    switch (type) {
      case "prescription":
        return "primary";
      case "report":
        return "primary";
      case "bill":
        return status === "paid" || status === "success"
          ? "success"
          : "warning";
      case "consultation":
        return status === "completed" ? "primary" : "neutral";
      case "pass":
        return "success";
      default:
        return "neutral";
    }
  };

  // Render Item Card
  const renderItem = ({ item }: { item: WalletItem }) => {
    const isRx = item.type === "prescription";
    const isReport = item.type === "report";
    const isBill = item.type === "bill";
    const isConsultation = item.type === "consultation";
    const isPass = item.type === "pass";
    const isRecord = item.type === "record";

    return (
      <Card padded style={styles.itemCard}>
        {/* Card Header */}
        <View style={styles.itemHeader}>
          <View style={styles.itemHeaderLeft}>
            <View
              style={[
                styles.itemTypeIcon,
                isRx && { backgroundColor: "#ECFDF5" },
                isReport && { backgroundColor: "#EFF6FF" },
                isBill && { backgroundColor: "#FEF3C7" },
                isConsultation && { backgroundColor: "#F5F3FF" },
                isPass && { backgroundColor: "#F0FDF4" },
                isRecord && { backgroundColor: "#FFF7ED" },
              ]}
            >
              <Ionicons
                name={
                  isRx
                    ? "document-text"
                    : isReport
                      ? "bar-chart"
                      : isBill
                        ? "receipt"
                        : isConsultation
                          ? "calendar"
                          : isPass
                            ? "qr-code"
                            : "folder"
                }
                size={18}
                color={
                  isRx
                    ? "#059669"
                    : isReport
                      ? "#2563EB"
                      : isBill
                        ? "#D97706"
                        : isConsultation
                          ? "#7C3AED"
                          : isPass
                            ? "#16A34A"
                            : "#EA580C"
                }
              />
            </View>
            <View style={styles.itemTitleBlock}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {formatDDMMYYYY(item.date)} {item.time ? `• ${item.time}` : ""}{" "}
                • {item.doctor?.name || "Doctor"}
              </Text>
            </View>
          </View>
          <Badge
            label={item.statusLabel || item.type.toUpperCase()}
            variant={getItemBadgeVariant(item.type, item.status)}
          />
        </View>

        <View style={styles.divider} />

        {/* Doctor & Hospital Details */}
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>PROVIDER</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {formatDoctorName(item.doctor?.name || "Specialist")}
            </Text>
            <Text style={styles.infoSub} numberOfLines={1}>
              {item.doctor?.speciality || "General Specialist"}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>FACILITY</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {item.hospital?.name || "HealPoint Clinic"}
            </Text>
            <Text style={styles.infoSub} numberOfLines={1}>
              {item.hospital?.city || "Healthcare Centre"}
            </Text>
          </View>
        </View>

        {/* Prescription Specific Details */}
        {isRx && (
          <View style={styles.contentBox}>
            {item.diagnosis ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Diagnosis:</Text>
                <Text style={styles.tagValue}>{item.diagnosis}</Text>
              </View>
            ) : null}
            {item.medicines && item.medicines.length > 0 ? (
              <View style={styles.medBox}>
                <Text style={styles.medHeader}>
                  Prescribed Medications ({item.medicines.length})
                </Text>
                {item.medicines.slice(0, 3).map((m, idx) => (
                  <View key={idx} style={styles.medRow}>
                    <Text style={styles.medBullet}>•</Text>
                    <Text style={styles.medText}>
                      <Text style={{ fontWeight: "700" }}>{m.name}</Text>
                      {m.dosage ? ` - ${m.dosage}` : ""}
                      {m.frequency ? ` (${m.frequency})` : ""}
                    </Text>
                  </View>
                ))}
                {item.medicines.length > 3 && (
                  <Text style={styles.moreText}>
                    +{item.medicines.length - 3} more medications
                  </Text>
                )}
              </View>
            ) : item.prescription ? (
              <Text style={styles.bodyText} numberOfLines={2}>
                {item.prescription}
              </Text>
            ) : null}

            {item.followUpAdvice ? (
              <View style={styles.adviceRow}>
                <Ionicons
                  name="information-circle"
                  size={14}
                  color={Palette.accent}
                />
                <Text style={styles.adviceText} numberOfLines={2}>
                  Follow-Up: {item.followUpAdvice}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Medical Report Specific Details */}
        {isReport && (
          <View style={styles.contentBox}>
            <View style={styles.tagRow}>
              <Text style={styles.tagLabel}>Type:</Text>
              <Text style={styles.tagValue}>
                {item.reportType || "Diagnostic Test"}
              </Text>
              {item.size ? (
                <Text style={styles.fileSizeText}>
                  • {(item.size / 1024).toFixed(0)} KB
                </Text>
              ) : null}
            </View>
            {item.notes ? (
              <Text style={styles.bodyText} numberOfLines={2}>
                Notes: {item.notes}
              </Text>
            ) : null}
          </View>
        )}

        {/* Bill Specific Details */}
        {isBill && (
          <View style={styles.contentBox}>
            <View style={styles.billRow}>
              <Text style={styles.billAmountLabel}>Encounter Fee:</Text>
              <Text style={styles.billAmountValue}>
                {formatINR(item.amount || 0)}
              </Text>
            </View>
            <View style={styles.tagRow}>
              <Text style={styles.tagLabel}>Payment Mode:</Text>
              <Text style={styles.tagValue}>
                {item.paymentMethod === "online"
                  ? "Online Payment (Razorpay)"
                  : "Clinic Cash Counter"}
              </Text>
            </View>
            {item.razorpayPaymentId ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Txn ID:</Text>
                <Text style={[styles.tagValue, { fontFamily: "monospace" }]}>
                  {item.razorpayPaymentId}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Consultation Specific Details */}
        {isConsultation && (
          <View style={styles.contentBox}>
            <View style={styles.tagRow}>
              <Text style={styles.tagLabel}>Consultation Type:</Text>
              <Text style={styles.tagValue}>
                {item.consultationType === "video"
                  ? "Google Meet Video Consultation"
                  : "In-Person Clinic Appointment"}
              </Text>
            </View>
            {item.diagnosis ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Clinical Impression:</Text>
                <Text style={styles.tagValue}>{item.diagnosis}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Hospital Pass Specific Details */}
        {isPass && (
          <View style={styles.contentBox}>
            <View style={styles.passTokenRow}>
              <Text style={styles.passTokenLabel}>QUEUE TOKEN</Text>
              <Text style={styles.passTokenValue}>
                #{item.queueToken || "ACTIVE"}
              </Text>
            </View>
            <Text style={styles.passStatusSub}>
              {item.checkedIn
                ? "Patient Checked In at Hospital"
                : "Ready for Kiosk Check-In"}
            </Text>
          </View>
        )}

        {/* EMR Record Specific Details */}
        {isRecord && (
          <View style={styles.contentBox}>
            {item.diagnosis ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Assessment:</Text>
                <Text style={styles.tagValue}>{item.diagnosis}</Text>
              </View>
            ) : null}
            {item.vitals && Object.keys(item.vitals).length > 0 && (
              <View style={styles.vitalsWrap}>
                {item.vitals.bloodPressure ? (
                  <View style={styles.vitalChip}>
                    <Text style={styles.vitalLabel}>BP</Text>
                    <Text style={styles.vitalVal}>
                      {item.vitals.bloodPressure}
                    </Text>
                  </View>
                ) : null}
                {item.vitals.heartRate ? (
                  <View style={styles.vitalChip}>
                    <Text style={styles.vitalLabel}>Pulse</Text>
                    <Text style={styles.vitalVal}>
                      {item.vitals.heartRate} bpm
                    </Text>
                  </View>
                ) : null}
                {item.vitals.spO2 ? (
                  <View style={styles.vitalChip}>
                    <Text style={styles.vitalLabel}>SpO2</Text>
                    <Text style={styles.vitalVal}>{item.vitals.spO2}%</Text>
                  </View>
                ) : null}
                {item.vitals.temperature ? (
                  <View style={styles.vitalChip}>
                    <Text style={styles.vitalLabel}>Temp</Text>
                    <Text style={styles.vitalVal}>
                      {item.vitals.temperature}°F
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {isRx && (
            <>
              <Button
                title="Reminders"
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: "/health/prescriptions",
                    params: {
                      tab: "all",
                      memberId: item.familyMemberId || undefined,
                    },
                  } as never)
                }
                style={styles.actionBtn}
              />
              <Button
                title="Encounter"
                variant="outline"
                onPress={() =>
                  router.push(`/appointment/${item.appointmentId}` as never)
                }
                style={styles.actionBtn}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share prescription"
                onPress={() => handleSharePrescription(item)}
                style={styles.iconActionBtn}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={Palette.primary}
                />
              </Pressable>
            </>
          )}

          {isReport && (
            <>
              <Button
                title="Open Document"
                variant="primary"
                onPress={() => handleOpenDocument(item.url)}
                style={styles.actionBtn}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share report"
                onPress={() => handleShareReport(item)}
                style={styles.iconActionBtn}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={Palette.primary}
                />
              </Pressable>
              <Button
                title="Encounter"
                variant="outline"
                onPress={() =>
                  router.push(`/appointment/${item.appointmentId}` as never)
                }
                style={styles.actionBtnSmall}
              />
            </>
          )}

          {isBill && (
            <>
              <Button
                title="View Receipt"
                variant="outline"
                onPress={() => setSelectedBill(item)}
                style={styles.actionBtn}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share receipt"
                onPress={() => handleShareReceipt(item)}
                style={styles.iconActionBtn}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={Palette.primary}
                />
              </Pressable>
              <Button
                title="Appointment"
                variant="secondary"
                onPress={() =>
                  router.push(`/appointment/${item.appointmentId}` as never)
                }
                style={styles.actionBtnSmall}
              />
            </>
          )}

          {isConsultation && (
            <>
              <Button
                title="View Visit Details"
                variant="outline"
                onPress={() =>
                  router.push(`/appointment/${item.appointmentId}` as never)
                }
                style={styles.actionBtn}
              />
              {item.doctor?._id ? (
                <Button
                  title="Book Again"
                  variant="primary"
                  icon="repeat"
                  onPress={() =>
                    router.push({
                      pathname: "/booking/[doctorId]",
                      params: {
                        doctorId: String(item.doctor._id),
                        type: item.consultationType || "clinic",
                        source: "rebook",
                        previousAppointmentId: item.appointmentId,
                      },
                    })
                  }
                  style={styles.actionBtnSmall}
                />
              ) : null}
              {item.meetingUrl && item.consultationType === "video" ? (
                <Button
                  title="Join Video"
                  variant="primary"
                  onPress={() => handleOpenDocument(item.meetingUrl)}
                  style={styles.actionBtnSmall}
                />
              ) : null}
            </>
          )}

          {isPass && (
            <>
              <Button
                title="Show QR Pass"
                variant="primary"
                onPress={() => setSelectedPass(item)}
                style={styles.actionBtn}
              />
              <Button
                title="Appointment"
                variant="outline"
                onPress={() =>
                  router.push(`/appointment/${item.appointmentId}` as never)
                }
                style={styles.actionBtnSmall}
              />
            </>
          )}

          {isRecord && (
            <Button
              title="View Complete EMR"
              variant="outline"
              onPress={() =>
                router.push(`/appointment/${item.appointmentId}` as never)
              }
              style={styles.actionBtn}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton color={Palette.text} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Digital Health Wallet</Text>
            <Text style={styles.subtitle}>
              Unified Health Records, Rx, Lab & Billing Vault
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh wallet"
            onPress={onRefresh}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh" size={20} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Family Member Filter Bar */}
        <FamilyMemberFilterBar
          selectedMemberId={familyMemberFilter}
          onSelectMember={setFamilyMemberFilter}
          style={styles.familyBar}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Overview Metric Cards */}
            <View style={styles.metricsContainer}>
              <Text style={styles.sectionHeading}>WALLET OVERVIEW</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.metricsScroll}
              >
                <Pressable
                  onPress={() => setSelectedCategory("prescriptions")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "prescriptions" &&
                      styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="document-text" size={22} color="#059669" />
                  <Text style={styles.metricCount}>{counts.prescriptions}</Text>
                  <Text style={styles.metricLabel}>Prescriptions</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedCategory("reports")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "reports" && styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="bar-chart" size={22} color="#2563EB" />
                  <Text style={styles.metricCount}>{counts.reports}</Text>
                  <Text style={styles.metricLabel}>Lab Reports</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedCategory("bills")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "bills" && styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="receipt" size={22} color="#D97706" />
                  <Text style={styles.metricCount}>{counts.bills}</Text>
                  <Text style={styles.metricLabel}>Bills & Receipts</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedCategory("consultations")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "consultations" &&
                      styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="calendar" size={22} color="#7C3AED" />
                  <Text style={styles.metricCount}>{counts.consultations}</Text>
                  <Text style={styles.metricLabel}>Consultations</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedCategory("records")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "records" && styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="folder-open" size={22} color="#EA580C" />
                  <Text style={styles.metricCount}>{counts.records}</Text>
                  <Text style={styles.metricLabel}>EMR Records</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedCategory("passes")}
                  style={[
                    styles.metricCard,
                    selectedCategory === "passes" && styles.metricCardActive,
                  ]}
                >
                  <Ionicons name="qr-code" size={22} color="#16A34A" />
                  <Text style={styles.metricCount}>{counts.passes}</Text>
                  <Text style={styles.metricLabel}>Hospital Passes</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* Search and Sort Row */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by doctor, clinic, test, medicine..."
                placeholderTextColor={Palette.textMuted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={Palette.textMuted}
                  />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle sort order"
                onPress={() =>
                  setSortOrder((prev) =>
                    prev === "newest" ? "oldest" : "newest",
                  )
                }
                style={styles.sortBtn}
              >
                <Ionicons
                  name={sortOrder === "newest" ? "arrow-down" : "arrow-up"}
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.sortBtnText}>
                  {sortOrder === "newest" ? "Newest" : "Oldest"}
                </Text>
              </Pressable>
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setSelectedCategory(cat.key)}
                    style={[
                      styles.categoryChip,
                      isActive && styles.categoryChipActive,
                    ]}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={14}
                      color={isActive ? Palette.white : Palette.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Status Feedback */}
            {loading && !refreshing && (
              <Loading label="Loading health documents..." fullScreen={false} />
            )}
            {error ? (
              <ErrorState message={error} onRetry={fetchWallet} />
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              title="No Health Records in Wallet"
              message={
                search
                  ? `No health documents matching "${search}". Try clearing your search.`
                  : selectedCategory !== "all"
                    ? `No ${selectedCategory} found for this profile. Your documents will appear here automatically after consultations.`
                    : "Your Digital Health Wallet is empty. Consultations, prescriptions, test reports, and bills will automatically sync here."
              }
              action={
                <Button
                  title={search ? "Clear Search" : "Find Doctors"}
                  variant="primary"
                  onPress={
                    search
                      ? () => setSearch("")
                      : () => router.push("/(drawer)/doctors" as never)
                  }
                />
              }
            />
          ) : null
        }
      />

      {/* Digital Hospital Pass QR Modal */}
      <Modal
        visible={Boolean(selectedPass)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPass(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Digital Hospital Pass</Text>
                <Text style={styles.modalSub}>
                  {selectedPass?.hospital?.name || "HealPoint Partner Hospital"}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedPass(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            <View style={styles.qrContainer}>
              <QRCodeCanvas
                value={`HEALPOINT_PASS:${selectedPass?.appointmentId}:${selectedPass?.queueToken || "CHECKIN"}`}
                size={200}
                color="#0f172a"
                backgroundColor="#ffffff"
              />
            </View>

            <View style={styles.passDetailsBox}>
              <View style={styles.passTokenBadge}>
                <Text style={styles.passTokenBadgeLabel}>QUEUE TOKEN</Text>
                <Text style={styles.passTokenBadgeNum}>
                  #{selectedPass?.queueToken || "ACTIVE"}
                </Text>
              </View>
              <Text style={styles.passPatientName}>
                Patient: {selectedPass?.patientName || user?.name}
              </Text>
              <Text style={styles.passDocInfo}>
                Attending: {selectedPass?.doctor?.name} (
                {selectedPass?.doctor?.speciality})
              </Text>
              <Text style={styles.passDateInfo}>
                Date: {formatDDMMYYYY(selectedPass?.date || "")}{" "}
                {selectedPass?.time}
              </Text>
            </View>

            <Text style={styles.passFooterNote}>
              Scan this QR code at hospital kiosk or reception counter for
              instant check-in.
            </Text>

            <Button
              title="Close Pass"
              variant="outline"
              onPress={() => setSelectedPass(null)}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </View>
      </Modal>

      {/* Bill & Payment Receipt Modal */}
      <Modal
        visible={Boolean(selectedBill)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBill(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.billModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Official Payment Receipt</Text>
                <Text style={styles.modalSub}>HealPoint Medical Encounter</Text>
              </View>
              <Pressable
                onPress={() => setSelectedBill(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            <View style={styles.billReceiptBox}>
              <View style={styles.receiptTop}>
                <Text style={styles.receiptAmtLabel}>AMOUNT PAID</Text>
                <Text style={styles.receiptAmtVal}>
                  {formatINR(selectedBill?.amount || 0)}
                </Text>
                <Badge
                  label={selectedBill?.statusLabel || "PAID"}
                  variant={
                    selectedBill?.status === "paid" ? "success" : "warning"
                  }
                  style={{ alignSelf: "center", marginTop: Spacing.xs }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Appointment Ref</Text>
                <Text style={styles.receiptVal}>
                  {selectedBill?.displayAppointmentId ||
                    selectedBill?.appointmentId}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Patient Name</Text>
                <Text style={styles.receiptVal}>
                  {selectedBill?.patientName}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Doctor</Text>
                <Text style={styles.receiptVal}>
                  {selectedBill?.doctor?.name}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Hospital</Text>
                <Text style={styles.receiptVal}>
                  {selectedBill?.hospital?.name}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Date & Time</Text>
                <Text style={styles.receiptVal}>
                  {formatDDMMYYYY(selectedBill?.date || "")}{" "}
                  {selectedBill?.time}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Consultation Fee</Text>
                <Text style={styles.receiptVal}>
                  {formatINR(
                    selectedBill?.billing?.consultationFee ??
                      selectedBill?.amount ??
                      0,
                  )}
                </Text>
              </View>
              {selectedBill?.billing?.serviceFee &&
              selectedBill.billing.serviceFee > 0 ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptKey}>Platform Fee</Text>
                  <Text style={styles.receiptVal}>
                    {formatINR(selectedBill.billing.serviceFee)}
                  </Text>
                </View>
              ) : null}
              {selectedBill?.billing?.subscriptionBenefit &&
              selectedBill.billing.subscriptionBenefit > 0 ? (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptKey, { color: Palette.success }]}>
                    {selectedBill.billing.planName || "Subscription"} Benefit
                  </Text>
                  <Text
                    style={[
                      styles.receiptVal,
                      { color: Palette.success, fontWeight: "700" },
                    ]}
                  >
                    -{formatINR(selectedBill.billing.subscriptionBenefit)}
                  </Text>
                </View>
              ) : null}
              {selectedBill?.billing?.discount &&
              selectedBill.billing.discount > 0 ? (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptKey, { color: Palette.success }]}>
                    Discount
                  </Text>
                  <Text
                    style={[
                      styles.receiptVal,
                      { color: Palette.success, fontWeight: "700" },
                    ]}
                  >
                    -{formatINR(selectedBill.billing.discount)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptKey, { fontWeight: "700" }]}>
                  Total Paid
                </Text>
                <Text
                  style={[
                    styles.receiptVal,
                    { fontWeight: "800", color: Palette.primaryDark },
                  ]}
                >
                  {selectedBill?.billing?.totalAmount === 0
                    ? "₹0 (Covered by Plan)"
                    : formatINR(
                        selectedBill?.billing?.totalAmount ??
                          selectedBill?.amount ??
                          0,
                      )}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptKey}>Payment Channel</Text>
                <Text style={styles.receiptVal}>
                  {selectedBill?.billing?.totalAmount === 0
                    ? `Covered by ${selectedBill.billing.planName || "Subscription"} Plan`
                    : selectedBill?.paymentMethod === "online"
                      ? "Razorpay Gateway"
                      : "Hospital Cash Desk"}
                </Text>
              </View>
              {selectedBill?.razorpayPaymentId ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptKey}>Payment ID</Text>
                  <Text
                    style={[styles.receiptVal, { fontFamily: "monospace" }]}
                  >
                    {selectedBill.razorpayPaymentId}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Share Receipt"
                variant="primary"
                onPress={() => {
                  if (selectedBill) handleShareReceipt(selectedBill);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Close"
                variant="outline"
                onPress={() => setSelectedBill(null)}
                style={{ flex: 1 }}
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
    backgroundColor: Palette.surface,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    padding: Spacing.xs,
  },
  familyBar: {
    marginTop: Spacing.xs,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  metricsContainer: {
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  metricsScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  metricCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    minWidth: 110,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  metricCardActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  metricCount: {
    ...Typography.h2,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  metricLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Palette.text,
    padding: 0,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: Spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: Palette.border,
  },
  sortBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  categoryScroll: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  categoryChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  categoryChipTextActive: {
    color: Palette.white,
  },
  itemCard: {
    marginBottom: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  itemHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  itemTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitleBlock: {
    flex: 1,
  },
  itemTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  itemMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 1,
  },
  infoSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  contentBox: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginVertical: 2,
  },
  tagLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tagValue: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  fileSizeText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  bodyText: {
    ...Typography.caption,
    color: Palette.text,
    marginTop: 2,
  },
  medBox: {
    marginTop: 4,
  },
  medHeader: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    marginBottom: 2,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginVertical: 1,
  },
  medBullet: {
    color: Palette.primary,
    fontSize: 14,
    lineHeight: 16,
  },
  medText: {
    ...Typography.caption,
    color: Palette.text,
    flex: 1,
  },
  moreText: {
    ...Typography.caption,
    color: Palette.primary,
    fontStyle: "italic",
    marginTop: 2,
  },
  adviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  adviceText: {
    ...Typography.caption,
    color: Palette.accent,
    flex: 1,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  billAmountLabel: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  billAmountValue: {
    ...Typography.h3,
    color: Palette.primaryDark,
  },
  passTokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passTokenLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  passTokenValue: {
    ...Typography.h2,
    color: "#16A34A",
  },
  passStatusSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  vitalsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  vitalChip: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vitalLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  vitalVal: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  actionBtnSmall: {
    minWidth: 90,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  qrModalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 380,
    ...Shadows.lg,
  },
  billModalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 400,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    backgroundColor: Palette.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  passDetailsBox: {
    marginTop: Spacing.md,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 4,
  },
  passTokenBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  passTokenBadgeLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  passTokenBadgeNum: {
    ...Typography.h3,
    color: "#16A34A",
  },
  passPatientName: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  passDocInfo: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  passDateInfo: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  passFooterNote: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  billReceiptBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  receiptTop: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  receiptAmtLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  receiptAmtVal: {
    ...Typography.h1,
    color: Palette.primaryDark,
    marginTop: 2,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
    gap: Spacing.sm,
  },
  receiptKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  receiptVal: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    textAlign: "right",
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
