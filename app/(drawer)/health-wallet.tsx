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
import * as ImagePicker from "expo-image-picker";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as walletService from "@/services/wallet";
import * as healthDocumentsService from "@/services/health-documents";
import type { HealthDocumentRecord, DocumentProcessingStatus } from "@/types";
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

  // Document Intelligence & OCR State
  const [selectedDocForDetails, setSelectedDocForDetails] =
    useState<WalletItem | null>(null);
  const [detailsTab, setDetailsTab] = useState<"entities" | "tests" | "text">(
    "entities",
  );
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  // Upload Document Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocTitle, setUploadDocTitle] = useState("");
  const [uploadDocCategory, setUploadDocCategory] = useState("Medical Report");
  const [uploadDocNotes, setUploadDocNotes] = useState("");
  const [uploadDocAsset, setUploadDocAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDuplicateWarning, setUploadDuplicateWarning] = useState(false);

  // Edit / Verify Metadata Modal State
  const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Medical Report");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editHospitalName, setEditHospitalName] = useState("");
  const [editReferenceNumber, setEditReferenceNumber] = useState("");
  const [editDocumentDate, setEditDocumentDate] = useState("");
  const [savingEditMetadata, setSavingEditMetadata] = useState(false);

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

  // Pick Document for Upload via expo-image-picker
  const handlePickDocument = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Media library access is needed to select healthcare documents for analysis.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setUploadDocAsset(asset);
        if (!uploadDocTitle) {
          const derivedName = asset.fileName || "Medical Report";
          setUploadDocTitle(derivedName.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (err) {
      Alert.alert(
        "Picker Error",
        toErrorMessage(err, "Failed to select document."),
      );
    }
  };

  // Submit Upload to Document Intelligence Backend
  const handleSubmitUpload = async () => {
    if (!uploadDocAsset) {
      Alert.alert(
        "File Required",
        "Please select a medical report or document file to upload.",
      );
      return;
    }
    if (!uploadDocTitle.trim()) {
      Alert.alert(
        "Title Required",
        "Please provide a title for this health document.",
      );
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      const fileData: unknown = {
        uri: uploadDocAsset.uri,
        name: uploadDocAsset.fileName || "document.jpg",
        type: uploadDocAsset.mimeType || "image/jpeg",
      };
      formData.append("file", fileData as Blob);
      formData.append("title", uploadDocTitle.trim());
      formData.append("category", uploadDocCategory);
      if (uploadDocNotes.trim()) {
        formData.append("notes", uploadDocNotes.trim());
      }
      if (
        familyMemberFilter &&
        familyMemberFilter !== "all" &&
        familyMemberFilter !== "self"
      ) {
        formData.append("familyMemberId", familyMemberFilter);
      }

      const res = await healthDocumentsService.uploadHealthDocument(formData);
      if (res.success) {
        if (res.isDuplicate) {
          setUploadDuplicateWarning(true);
          Alert.alert(
            "Document Uploaded (Duplicate Detected)",
            "An identical document already exists in your vault. It has been securely analyzed and indexed.",
          );
        } else {
          Alert.alert(
            "Document Queued for Analysis",
            "Your document has been securely uploaded. Document Intelligence is analyzing the medical entities in the background.",
          );
        }
        setShowUploadModal(false);
        setUploadDocAsset(null);
        setUploadDocTitle("");
        setUploadDocNotes("");
        await fetchWallet();
      }
    } catch (err) {
      Alert.alert(
        "Upload Failed",
        toErrorMessage(err, "Failed to upload document."),
      );
    } finally {
      setUploadingDoc(false);
    }
  };

  // Retry Failed or Partial Document Processing
  const handleRetryProcessing = async (docId: string) => {
    setRetryingDocId(docId);
    try {
      const res = await healthDocumentsService.retryDocumentProcessing(docId);
      if (res.success) {
        Alert.alert(
          "OCR Analysis Re-queued",
          "Document intelligence has been re-triggered. Refresh in a few seconds.",
        );
        await fetchWallet();
        if (
          selectedDocForDetails &&
          (selectedDocForDetails._id === docId ||
            selectedDocForDetails.id.includes(docId))
        ) {
          setSelectedDocForDetails({
            ...selectedDocForDetails,
            processingStatus: "processing",
          });
        }
      }
    } catch (err) {
      Alert.alert(
        "Retry Failed",
        toErrorMessage(err, "Unable to retry document processing."),
      );
    } finally {
      setRetryingDocId(null);
    }
  };

  // Open Edit Metadata Modal
  const handleOpenEditMetadata = (item: WalletItem) => {
    setEditingDocId(item._id || item.id.replace("doc-", ""));
    setEditTitle(item.title || "");
    setEditCategory(
      item.extractedMetadata?.documentType ||
        item.reportType ||
        item.category ||
        "Medical Report",
    );
    setEditDoctorName(
      item.extractedMetadata?.doctorName &&
        item.extractedMetadata.doctorName !== "Unknown / Not detected"
        ? item.extractedMetadata.doctorName
        : item.doctor?.name || "",
    );
    setEditHospitalName(
      item.extractedMetadata?.hospitalName &&
        item.extractedMetadata.hospitalName !== "Unknown / Not detected"
        ? item.extractedMetadata.hospitalName
        : item.hospital?.name || "",
    );
    setEditReferenceNumber(
      item.extractedMetadata?.referenceNumber &&
        item.extractedMetadata.referenceNumber !== "Unknown / Not detected"
        ? item.extractedMetadata.referenceNumber
        : "",
    );
    setEditDocumentDate(item.date || "");
    setShowEditMetadataModal(true);
  };

  // Save Human-Verified Metadata
  const handleSaveMetadata = async () => {
    if (!editTitle.trim()) {
      Alert.alert("Title Required", "Document title cannot be empty.");
      return;
    }

    setSavingEditMetadata(true);
    try {
      const res = await healthDocumentsService.updateDocumentMetadata(
        editingDocId,
        {
          title: editTitle.trim(),
          category: editCategory,
          doctorName: editDoctorName.trim(),
          hospitalName: editHospitalName.trim(),
          referenceNumber: editReferenceNumber.trim(),
          documentDate: editDocumentDate.trim() || undefined,
        },
      );

      if (res.success) {
        Alert.alert(
          "Metadata Verified",
          "Document details have been verified and saved with audit trail.",
        );
        setShowEditMetadataModal(false);
        if (
          selectedDocForDetails &&
          (selectedDocForDetails._id === editingDocId ||
            selectedDocForDetails.id.includes(editingDocId))
        ) {
          setSelectedDocForDetails({
            ...selectedDocForDetails,
            title: res.document.title,
            reportType: res.document.category,
            extractedMetadata: res.document.extractedMetadata,
            userCorrections: res.document.userCorrections,
          });
        }
        await fetchWallet();
      }
    } catch (err) {
      Alert.alert(
        "Save Failed",
        toErrorMessage(err, "Failed to update document metadata."),
      );
    } finally {
      setSavingEditMetadata(false);
    }
  };

  const getItemBadgeVariant = (type: string, status?: string): BadgeVariant => {
    switch (type) {
      case "prescription":
        return "primary";
      case "report":
        if (status === "processed" || status === "AI Processed")
          return "success";
        if (status === "processing" || status === "Analyzing...")
          return "warning";
        if (status === "failed" || status === "Analysis Failed") return "error";
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
            label={
              isReport && item.processingStatus
                ? item.processingStatus === "processed"
                  ? "AI Analyzed"
                  : item.processingStatus === "processing"
                    ? "Analyzing..."
                    : item.processingStatus === "partially_processed"
                      ? "Partial OCR"
                      : item.processingStatus === "failed"
                        ? "Analysis Failed"
                        : "Uploaded"
                : item.statusLabel || item.type.toUpperCase()
            }
            variant={getItemBadgeVariant(
              item.type,
              item.processingStatus || item.status,
            )}
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

        {/* Medical Report Specific Details with Document Intelligence */}
        {isReport && (
          <View style={styles.contentBox}>
            <View style={styles.tagRow}>
              <Text style={styles.tagLabel}>Classification:</Text>
              <Text style={styles.tagValue}>
                {item.extractedMetadata?.documentType ||
                  item.reportType ||
                  "Diagnostic Test"}
              </Text>
              {item.confidence ? (
                <Badge
                  label={`${item.confidence}% Confidence`}
                  variant={item.confidence >= 70 ? "success" : "neutral"}
                  style={{ marginLeft: Spacing.xs }}
                />
              ) : null}
              {item.userCorrections?.isCorrected ? (
                <Badge
                  label="Verified"
                  variant="primary"
                  style={{ marginLeft: Spacing.xs }}
                />
              ) : null}
            </View>

            {item.extractedMetadata?.hospitalName &&
            item.extractedMetadata.hospitalName !== "Unknown / Not detected" ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Facility:</Text>
                <Text style={styles.tagValue} numberOfLines={1}>
                  {item.extractedMetadata.hospitalName}
                </Text>
              </View>
            ) : null}

            {item.extractedMetadata?.doctorName &&
            item.extractedMetadata.doctorName !== "Unknown / Not detected" ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Doctor:</Text>
                <Text style={styles.tagValue} numberOfLines={1}>
                  {item.extractedMetadata.doctorName}
                </Text>
              </View>
            ) : null}

            {item.extractedMetadata?.referenceNumber &&
            item.extractedMetadata.referenceNumber !==
              "Unknown / Not detected" ? (
              <View style={styles.tagRow}>
                <Text style={styles.tagLabel}>Ref / ID:</Text>
                <Text style={[styles.tagValue, { fontFamily: "monospace" }]}>
                  {item.extractedMetadata.referenceNumber}
                </Text>
              </View>
            ) : null}

            {item.extractedMetadata?.testResults &&
            item.extractedMetadata.testResults.length > 0 ? (
              <View style={{ marginTop: Spacing.xs }}>
                <Text style={[styles.tagLabel, { marginBottom: 4 }]}>
                  Detected Lab Values:
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}
                >
                  {item.extractedMetadata.testResults
                    .slice(0, 3)
                    .map((t, idx) => (
                      <View key={idx} style={styles.testValueChip}>
                        <Text style={styles.testValueChipText}>
                          {t.testName}:{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {t.value} {t.unit}
                          </Text>
                        </Text>
                      </View>
                    ))}
                  {item.extractedMetadata.testResults.length > 3 ? (
                    <Text style={styles.moreText}>
                      +{item.extractedMetadata.testResults.length - 3} more
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

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
                title="Smart Details"
                variant="primary"
                onPress={() => {
                  setSelectedDocForDetails(item);
                  setDetailsTab("entities");
                }}
                style={styles.actionBtn}
              />
              <Button
                title="Open File"
                variant="outline"
                onPress={() => handleOpenDocument(item.url)}
                style={styles.actionBtnSmall}
              />
              {item.processingStatus === "failed" ||
              item.processingStatus === "partially_processed" ? (
                <Button
                  title={
                    retryingDocId === (item._id || item.id)
                      ? "Retrying..."
                      : "Retry OCR"
                  }
                  variant="outline"
                  loading={retryingDocId === (item._id || item.id)}
                  onPress={() =>
                    handleRetryProcessing(
                      item._id || item.id.replace("doc-", ""),
                    )
                  }
                  style={styles.actionBtnSmall}
                />
              ) : null}
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
              {item.appointmentId ? (
                <Button
                  title="Encounter"
                  variant="outline"
                  onPress={() =>
                    router.push(`/appointment/${item.appointmentId}` as never)
                  }
                  style={styles.actionBtnSmall}
                />
              ) : null}
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
            accessibilityLabel="Upload medical document"
            onPress={() => {
              setUploadDocTitle("");
              setUploadDocNotes("");
              setUploadDocAsset(null);
              setUploadDuplicateWarning(false);
              setShowUploadModal(true);
            }}
            style={[
              styles.refreshBtn,
              {
                backgroundColor: Palette.primaryLight,
                marginRight: Spacing.xs,
              },
            ]}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={19}
              color={Palette.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export health records"
            onPress={() => router.push("/(drawer)/health/export" as any)}
            style={[
              styles.refreshBtn,
              {
                backgroundColor: Palette.surfaceAlt,
                marginRight: Spacing.xs,
              },
            ]}
          >
            <Ionicons
              name="cloud-download-outline"
              size={19}
              color={Palette.primary}
            />
          </Pressable>
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

      {/* ── Document Intelligence & OCR Details Modal ──────────────────────── */}
      <Modal
        visible={!!selectedDocForDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDocForDetails(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.billModalCard,
              { maxHeight: "88%", width: "94%", maxWidth: 440 },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedDocForDetails?.title || "Document Intelligence"}
                  </Text>
                  {selectedDocForDetails?.userCorrections?.verifiedByUser ? (
                    <Badge label="Verified" variant="success" />
                  ) : selectedDocForDetails?.processingStatus ===
                    "processed" ? (
                    <Badge label="Analyzed" variant="primary" />
                  ) : null}
                </View>
                <Text style={styles.modalSub}>
                  {selectedDocForDetails?.reportType ||
                    selectedDocForDetails?.extractedMetadata?.documentType ||
                    "Health Document"}{" "}
                  •{" "}
                  {selectedDocForDetails?.ocrProvider === "gemini_vision"
                    ? "Gemini Multimodal OCR"
                    : "Local Healthcare Parser"}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedDocForDetails(null)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            {/* Non-Diagnostic Safety Callout */}
            <View style={styles.ocrSafetyNotice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#0D9488"
              />
              <Text style={styles.ocrSafetyNoticeText}>
                Factual entity extraction for reference only. No diagnosis or
                treatment generated.
              </Text>
            </View>

            {/* Sub-tabs: Entities, Test Results, Extracted Text */}
            <View style={styles.docDetailsTabsRow}>
              <Pressable
                onPress={() => setDetailsTab("entities")}
                style={[
                  styles.docTabBtn,
                  detailsTab === "entities" && styles.docTabBtnActive,
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={
                    detailsTab === "entities"
                      ? Palette.primary
                      : Palette.textMuted
                  }
                />
                <Text
                  style={[
                    styles.docTabBtnText,
                    detailsTab === "entities" && styles.docTabBtnTextActive,
                  ]}
                >
                  Entities
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDetailsTab("tests")}
                style={[
                  styles.docTabBtn,
                  detailsTab === "tests" && styles.docTabBtnActive,
                ]}
              >
                <Ionicons
                  name="flask-outline"
                  size={15}
                  color={
                    detailsTab === "tests" ? Palette.primary : Palette.textMuted
                  }
                />
                <Text
                  style={[
                    styles.docTabBtnText,
                    detailsTab === "tests" && styles.docTabBtnTextActive,
                  ]}
                >
                  Test Values (
                  {selectedDocForDetails?.extractedMetadata?.testResults
                    ?.length || 0}
                  )
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDetailsTab("text")}
                style={[
                  styles.docTabBtn,
                  detailsTab === "text" && styles.docTabBtnActive,
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color={
                    detailsTab === "text" ? Palette.primary : Palette.textMuted
                  }
                />
                <Text
                  style={[
                    styles.docTabBtnText,
                    detailsTab === "text" && styles.docTabBtnTextActive,
                  ]}
                >
                  Raw OCR
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 320, marginVertical: Spacing.sm }}
              showsVerticalScrollIndicator={false}
            >
              {detailsTab === "entities" && (
                <View style={styles.entitiesContainer}>
                  <View style={styles.entityRow}>
                    <Text style={styles.entityLabel}>Healthcare Facility</Text>
                    <Text style={styles.entityValue}>
                      {selectedDocForDetails?.extractedMetadata?.hospitalName ||
                        selectedDocForDetails?.hospital?.name ||
                        "Not detected"}
                    </Text>
                  </View>
                  <View style={styles.entityRow}>
                    <Text style={styles.entityLabel}>Doctor / Specialist</Text>
                    <Text style={styles.entityValue}>
                      {selectedDocForDetails?.extractedMetadata?.doctorName ||
                        selectedDocForDetails?.doctor?.name ||
                        "Not detected"}
                    </Text>
                  </View>
                  <View style={styles.entityRow}>
                    <Text style={styles.entityLabel}>Document Date</Text>
                    <Text style={styles.entityValue}>
                      {formatDDMMYYYY(
                        selectedDocForDetails?.extractedMetadata
                          ?.documentDate ||
                          selectedDocForDetails?.date ||
                          "",
                      )}
                    </Text>
                  </View>
                  <View style={styles.entityRow}>
                    <Text style={styles.entityLabel}>Reference / Lab ID</Text>
                    <Text
                      style={[styles.entityValue, { fontFamily: "monospace" }]}
                    >
                      {selectedDocForDetails?.extractedMetadata
                        ?.referenceNumber || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.entityRow}>
                    <Text style={styles.entityLabel}>OCR Confidence</Text>
                    <Text style={styles.entityValue}>
                      {Math.round(
                        (selectedDocForDetails?.extractedMetadata?.confidence ||
                          0) * 100,
                      )}
                      %
                    </Text>
                  </View>
                  {selectedDocForDetails?.contentHash ? (
                    <View style={styles.entityRow}>
                      <Text style={styles.entityLabel}>SHA-256 Hash</Text>
                      <Text
                        style={[
                          styles.entityValue,
                          { fontFamily: "monospace", fontSize: 11 },
                        ]}
                      >
                        {selectedDocForDetails.contentHash.substring(0, 16)}...
                      </Text>
                    </View>
                  ) : null}
                  {selectedDocForDetails?.userCorrections?.verifiedByUser ? (
                    <View style={styles.verificationAuditBox}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#16A34A"
                      />
                      <Text style={styles.verificationAuditText}>
                        Human verified on{" "}
                        {formatDDMMYYYY(
                          selectedDocForDetails.userCorrections.verifiedAt ||
                            "",
                        )}
                        .
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {detailsTab === "tests" && (
                <View style={styles.testsContainer}>
                  {(selectedDocForDetails?.extractedMetadata?.testResults
                    ?.length || 0) === 0 ? (
                    <Text style={styles.emptyTestsText}>
                      No discrete numerical lab parameters detected in this
                      document.
                    </Text>
                  ) : (
                    selectedDocForDetails?.extractedMetadata?.testResults?.map(
                      (t, idx) => (
                        <View key={`test-${idx}`} style={styles.testResultCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.testResultName}>
                              {t.testName}
                            </Text>
                            {t.referenceRange ? (
                              <Text style={styles.testResultRange}>
                                Ref: {t.referenceRange}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.testResultValue}>
                              {t.value} {t.unit || ""}
                            </Text>
                            {t.flag && t.flag !== "normal" ? (
                              <Badge
                                label={t.flag.toUpperCase()}
                                variant={
                                  t.flag === "high" ? "error" : "warning"
                                }
                              />
                            ) : null}
                          </View>
                        </View>
                      ),
                    )
                  )}
                </View>
              )}

              {detailsTab === "text" && (
                <View style={styles.rawTextContainer}>
                  <Text style={styles.rawTextContent} selectable>
                    {selectedDocForDetails?.extractedText ||
                      "No OCR text extracted yet. If processing failed, tap Retry."}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Button
                title="Verify / Edit"
                variant="outline"
                onPress={() => {
                  if (selectedDocForDetails) {
                    const doc = selectedDocForDetails;
                    setSelectedDocForDetails(null);
                    handleOpenEditMetadata(doc);
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Open Original"
                variant="primary"
                onPress={() => {
                  if (selectedDocForDetails?.url) {
                    handleOpenDocument(selectedDocForDetails.url);
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Upload Health Document Modal ─────────────────────────────────────── */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploadingDoc) setShowUploadModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.billModalCard,
              { width: "94%", maxWidth: 440, maxHeight: "90%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Upload Health Document</Text>
                <Text style={styles.modalSub}>
                  Upload PDF or image for automatic entity & metadata
                  recognition
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!uploadingDoc) setShowUploadModal(false);
                }}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* File Selection Box */}
              <Pressable
                onPress={handlePickDocument}
                disabled={uploadingDoc}
                style={[
                  styles.uploadFilePickerBox,
                  uploadDocAsset && styles.uploadFilePickerBoxSelected,
                ]}
              >
                <Ionicons
                  name={
                    uploadDocAsset ? "document-attach" : "cloud-upload-outline"
                  }
                  size={32}
                  color={uploadDocAsset ? Palette.primary : Palette.textMuted}
                />
                <Text style={styles.uploadFilePickerTitle}>
                  {uploadDocAsset
                    ? uploadDocAsset.fileName || "File Selected"
                    : "Select File / Image from Device"}
                </Text>
                <Text style={styles.uploadFilePickerSub}>
                  {uploadDocAsset
                    ? `${uploadDocAsset.mimeType || "image"} • ${uploadDocAsset.fileSize ? (uploadDocAsset.fileSize / 1024).toFixed(1) + " KB" : "Ready"}`
                    : "Supports PDF, JPG, PNG up to 10MB"}
                </Text>
              </Pressable>

              {/* Title input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Document Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={uploadDocTitle}
                  onChangeText={setUploadDocTitle}
                  placeholder="e.g., Blood Test Report, Discharge Summary"
                  placeholderTextColor={Palette.textMuted}
                  editable={!uploadingDoc}
                />
              </View>

              {/* Category chips */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Document Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginVertical: 4 }}
                >
                  {[
                    "Medical Report",
                    "Prescription",
                    "Lab Test",
                    "Discharge Summary",
                    "Scan / Imaging",
                    "Vaccination",
                    "Other",
                  ].map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setUploadDocCategory(cat)}
                      style={[
                        styles.categoryChip,
                        uploadDocCategory === cat && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          uploadDocCategory === cat &&
                            styles.categoryChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Notes input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Clinical / Personal Notes (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { height: 70, textAlignVertical: "top" },
                  ]}
                  value={uploadDocNotes}
                  onChangeText={setUploadDocNotes}
                  placeholder="Add any context or instructions..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={3}
                  editable={!uploadingDoc}
                />
              </View>

              <View style={styles.ocrInfoBanner}>
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.ocrInfoBannerText}>
                  HealPoint will analyze facility name, treating physician, lab
                  parameters and raw text in the background. Original file
                  remains untouched.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Button
                title={uploadingDoc ? "Uploading..." : "Upload & Analyze"}
                variant="primary"
                onPress={handleSubmitUpload}
                loading={uploadingDoc}
                disabled={
                  uploadingDoc || !uploadDocAsset || !uploadDocTitle.trim()
                }
                style={{ flex: 1 }}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowUploadModal(false)}
                disabled={uploadingDoc}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit / Verify Metadata Modal ─────────────────────────────────────── */}
      <Modal
        visible={showEditMetadataModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingEditMetadata) setShowEditMetadataModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.billModalCard,
              { width: "94%", maxWidth: 440, maxHeight: "90%" },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Verify & Correct Details</Text>
                <Text style={styles.modalSub}>
                  Human verification with immutable audit tracking
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!savingEditMetadata) setShowEditMetadataModal(false);
                }}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Document Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Title"
                  placeholderTextColor={Palette.textMuted}
                  editable={!savingEditMetadata}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginVertical: 4 }}
                >
                  {[
                    "Medical Report",
                    "Prescription",
                    "Lab Test",
                    "Discharge Summary",
                    "Scan / Imaging",
                    "Vaccination",
                    "Other",
                  ].map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      style={[
                        styles.categoryChip,
                        editCategory === cat && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          editCategory === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Treating Doctor / Specialist
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editDoctorName}
                  onChangeText={setEditDoctorName}
                  placeholder="Doctor Name"
                  placeholderTextColor={Palette.textMuted}
                  editable={!savingEditMetadata}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hospital / Clinic / Lab</Text>
                <TextInput
                  style={styles.textInput}
                  value={editHospitalName}
                  onChangeText={setEditHospitalName}
                  placeholder="Facility Name"
                  placeholderTextColor={Palette.textMuted}
                  editable={!savingEditMetadata}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reference / Lab ID Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={editReferenceNumber}
                  onChangeText={setEditReferenceNumber}
                  placeholder="Reference Number"
                  placeholderTextColor={Palette.textMuted}
                  editable={!savingEditMetadata}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Document Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={editDocumentDate}
                  onChangeText={setEditDocumentDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Palette.textMuted}
                  editable={!savingEditMetadata}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Button
                title={savingEditMetadata ? "Saving..." : "Verify & Save"}
                variant="primary"
                onPress={handleSaveMetadata}
                loading={savingEditMetadata}
                disabled={savingEditMetadata || !editTitle.trim()}
                style={{ flex: 1 }}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowEditMetadataModal(false)}
                disabled={savingEditMetadata}
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
  // Document Intelligence & OCR Styles
  testValueChip: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  testValueChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#0F766E",
    fontWeight: "600",
  },
  ocrSafetyNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDFA",
    borderLeftWidth: 3,
    borderLeftColor: "#0D9488",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  ocrSafetyNoticeText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#115E59",
    flex: 1,
  },
  docDetailsTabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  docTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  docTabBtnActive: {
    backgroundColor: Palette.surface,
    ...Shadows.sm,
  },
  docTabBtnText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
    fontSize: 12,
  },
  docTabBtnTextActive: {
    color: Palette.primary,
  },
  entitiesContainer: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 6,
  },
  entityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  entityLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  entityValue: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    textAlign: "right",
    flexShrink: 1,
  },
  verificationAuditBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  verificationAuditText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },
  testsContainer: {
    gap: Spacing.xs,
  },
  emptyTestsText: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  testResultCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
  },
  testResultName: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  testResultRange: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  testResultValue: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  rawTextContainer: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    maxHeight: 280,
  },
  rawTextContent: {
    fontFamily: "monospace",
    fontSize: 11,
    color: Palette.text,
    lineHeight: 16,
  },
  uploadFilePickerBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surfaceAlt,
    marginBottom: Spacing.sm,
  },
  uploadFilePickerBoxSelected: {
    borderColor: Palette.primary,
    backgroundColor: "#F0FDF4",
  },
  uploadFilePickerTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  uploadFilePickerSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    ...Typography.body,
    color: Palette.text,
  },
  ocrInfoBanner: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F0FDFA",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: 4,
    alignItems: "center",
  },
  ocrInfoBannerText: {
    ...Typography.caption,
    color: "#0F766E",
    flex: 1,
    fontSize: 11,
  },
});
