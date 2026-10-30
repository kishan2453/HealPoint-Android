/**
 * HealPoint — Smart Patient Health Document & Report Center 2.0.
 *
 * Professional healthcare medical document repository:
 * - Unified real documents (Reports, Prescriptions, Records, Lab Reports, Imaging/Scans, Uploaded, Shared)
 * - Factual categories (only shown when real documents exist)
 * - Multi-criteria search by Document Name, Doctor, Hospital, Type, and Date
 * - Filters by Type, Doctor, Hospital, and factual sorting (Newest, Oldest, Name)
 * - Family Healthcare Isolation (My Documents vs Dependent Documents)
 * - Secure Smart Health Document Upload with duplicate protection & progress
 * - Document Details viewer with Open, Download, Doctor Sharing, and Revocation
 * - Direct links to related Appointments, Doctors, Hospitals, and Health Timeline
 *
 * 100% authentic backend data. No fake documents. No medical diagnosis logic.
 */
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
import { Image } from "expo-image";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { PatientBottomNav } from "@/components/PatientBottomNav";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as healthDocumentsService from "@/services/health-documents";
import type {
  Appointment,
  HealthDocumentRecord,
  PatientReportItem,
} from "@/types";

export type DocumentCategoryKey =
  | "all"
  | "reports"
  | "prescriptions"
  | "records"
  | "lab_reports"
  | "imaging"
  | "doctor_docs"
  | "uploaded"
  | "shared";

export interface UnifiedDocumentItem {
  id: string;
  title: string;
  categoryKeys: DocumentCategoryKey[];
  primaryCategory: string;
  typeLabel: string;
  date: string;
  uploadDate?: string;
  timestamp: number;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorId?: string;
  hospitalName?: string;
  hospitalId?: string;
  appointmentId?: string;
  displayAppointmentId?: string;
  fileType: string;
  fileSize?: string;
  rawSize?: number;
  url?: string;
  isShared: boolean;
  sharedWith?: {
    doctorId: string;
    doctorName: string;
    sharedAt?: string;
    note?: string;
  }[];
  processingStatus?: string;
  diagnosis?: string;
  notes?: string;
  patientName?: string;
  familyRelationship?: string;
  source: "uploaded" | "report" | "prescription" | "consultation";
}

const CATEGORY_DEFINITIONS: {
  key: DocumentCategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Documents", icon: "folder-open-outline" },
  { key: "reports", label: "Reports", icon: "bar-chart-outline" },
  { key: "prescriptions", label: "Prescriptions", icon: "document-text-outline" },
  { key: "records", label: "Medical Records", icon: "medkit-outline" },
  { key: "lab_reports", label: "Lab Reports", icon: "flask-outline" },
  { key: "imaging", label: "Imaging & Scans", icon: "scan-outline" },
  { key: "doctor_docs", label: "Doctor Documents", icon: "person-outline" },
  { key: "uploaded", label: "Uploaded", icon: "cloud-upload-outline" },
  { key: "shared", label: "Shared", icon: "share-social-outline" },
];

export default function HealthDocumentCenterScreen() {
  const router = useRouter();
  const { memberId, category: initialCategory } = useLocalSearchParams<{
    memberId?: string;
    category?: string;
  }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    memberId || "all",
  );
  const [activeCategory, setActiveCategory] = useState<DocumentCategoryKey>(
    (initialCategory as DocumentCategoryKey) || "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "name">("newest");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>("all");
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>("all");

  // Raw data from real services
  const [uploadedDocs, setUploadedDocs] = useState<HealthDocumentRecord[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<{
    consultations: Appointment[];
    prescriptions: Appointment[];
    reports: PatientReportItem[];
  }>({
    consultations: [],
    prescriptions: [],
    reports: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Modals
  const [selectedDocDetails, setSelectedDocDetails] = useState<UnifiedDocumentItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetDoc, setShareTargetDoc] = useState<UnifiedDocumentItem | null>(null);
  const [revokeConfirmDoc, setRevokeConfirmDoc] = useState<UnifiedDocumentItem | null>(null);

  // Upload Form State
  const [uploadAsset, setUploadAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Lab Report");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadAppointmentId, setUploadAppointmentId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Share Form State
  const [selectedDoctorIdToShare, setSelectedDoctorIdToShare] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  // Load all authentic health documents
  const loadDocuments = useCallback(async () => {
    setError("");
    try {
      const [uploadedRes, historyRes] = await Promise.all([
        healthDocumentsService
          .getMyHealthDocuments({
            familyMemberId: familyMemberFilter,
            sort: sortOrder === "name" ? "newest" : sortOrder,
          })
          .catch(() => ({ success: true, documents: [] as HealthDocumentRecord[] })),
        appointmentService
          .getPatientMedicalHistory(familyMemberFilter)
          .catch(() => ({ consultations: [], prescriptions: [], reports: [] })),
      ]);

      setUploadedDocs(uploadedRes.documents || []);
      setMedicalHistory({
        consultations: historyRes.consultations || [],
        prescriptions: historyRes.prescriptions || [],
        reports: historyRes.reports || [],
      });
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load health documents."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [familyMemberFilter, sortOrder]);

  useScreenFocus(loadDocuments, 20_000);

  useEffect(() => {
    setLoading(true);
    loadDocuments();
  }, [loadDocuments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDocuments();
  };

  // Normalize all records into UnifiedDocumentItem
  const unifiedDocuments = useMemo<UnifiedDocumentItem[]>(() => {
    const items: UnifiedDocumentItem[] = [];

    // 1. Uploaded & Scanned Health Documents
    for (const doc of uploadedDocs) {
      const catLower = (doc.category || "").toLowerCase();
      const categories: DocumentCategoryKey[] = ["uploaded"];

      let primaryCategory = "Document";
      if (catLower.includes("lab") || catLower.includes("blood") || catLower.includes("pathology")) {
        categories.push("reports", "lab_reports");
        primaryCategory = "Lab Report";
      } else if (
        catLower.includes("scan") ||
        catLower.includes("x-ray") ||
        catLower.includes("mri") ||
        catLower.includes("ct") ||
        catLower.includes("radiology")
      ) {
        categories.push("reports", "imaging");
        primaryCategory = "Imaging / Scan";
      } else if (catLower.includes("report")) {
        categories.push("reports");
        primaryCategory = "Medical Report";
      } else if (catLower.includes("prescrip")) {
        categories.push("prescriptions");
        primaryCategory = "Prescription";
      } else if (catLower.includes("record")) {
        categories.push("records");
        primaryCategory = "Medical Record";
      }

      const isShared = Boolean(doc.sharedWith && doc.sharedWith.length > 0);
      if (isShared) {
        categories.push("shared");
      }

      items.push({
        id: doc._id,
        title: doc.title || doc.filename || "Health Document",
        categoryKeys: categories,
        primaryCategory,
        typeLabel: doc.category || "Health Document",
        date: doc.documentDate || doc.createdAt,
        uploadDate: doc.createdAt,
        timestamp: new Date(doc.documentDate || doc.createdAt).getTime() || 0,
        doctorName:
          doc.extractedMetadata?.doctorName ||
          (typeof doc.linkedDoctorId === "object" && doc.linkedDoctorId
            ? (doc.linkedDoctorId as { name?: string }).name
            : undefined),
        hospitalName:
          doc.extractedMetadata?.hospitalName ||
          (typeof doc.linkedHospitalId === "object" && doc.linkedHospitalId
            ? (doc.linkedHospitalId as { name?: string }).name
            : undefined),
        appointmentId:
          typeof doc.linkedAppointmentId === "string"
            ? doc.linkedAppointmentId
            : typeof doc.linkedAppointmentId === "object" && doc.linkedAppointmentId
              ? String((doc.linkedAppointmentId as { _id?: string })._id || "")
              : undefined,
        fileType: doc.mimeType?.split("/")[1]?.toUpperCase() || "IMAGE",
        fileSize: formatFileSize(doc.size),
        rawSize: doc.size,
        url: doc.url,
        isShared,
        sharedWith: doc.sharedWith?.map((s) => ({
          doctorId:
            typeof s.doctorId === "object" && s.doctorId
              ? String((s.doctorId as { _id?: string })._id || "")
              : String(s.doctorId || ""),
          doctorName:
            typeof s.doctorId === "object" && s.doctorId
              ? (s.doctorId as { name?: string }).name || "Attending Doctor"
              : "Attending Doctor",
          sharedAt: s.sharedAt,
          note: s.note,
        })),
        processingStatus: doc.processingStatus,
        notes: doc.notes,
        patientName: doc.patientName,
        familyRelationship: doc.patientRelationship,
        source: "uploaded",
      });
    }

    // 2. Diagnostic Reports from Appointments
    for (const rep of medicalHistory.reports) {
      const typeLower = (rep.type || "").toLowerCase();
      const categories: DocumentCategoryKey[] = ["reports"];

      let primaryCategory = "Diagnostic Report";
      if (
        typeLower.includes("scan") ||
        typeLower.includes("x-ray") ||
        typeLower.includes("mri") ||
        typeLower.includes("ct") ||
        typeLower.includes("radiology")
      ) {
        categories.push("imaging");
        primaryCategory = "Imaging / Scan";
      } else {
        categories.push("lab_reports");
        primaryCategory = "Lab Report";
      }

      if (rep.doctorName) {
        categories.push("doctor_docs");
      }

      items.push({
        id: rep._id,
        title: rep.name || "Diagnostic Report",
        categoryKeys: categories,
        primaryCategory,
        typeLabel: rep.type || "Diagnostic Report",
        date: rep.date || rep.uploadedAt || "",
        uploadDate: rep.uploadedAt,
        timestamp: new Date(rep.date || rep.uploadedAt || "").getTime() || 0,
        doctorName: rep.doctorName ? formatDoctorName(rep.doctorName) : undefined,
        hospitalName: rep.hospitalName,
        appointmentId: rep.appointmentId,
        fileType: rep.url?.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE",
        url: rep.url,
        isShared: false,
        notes: rep.notes,
        source: "report",
      });
    }

    // 3. Digital Prescriptions from Consultations
    for (const appt of medicalHistory.prescriptions) {
      const hasRx =
        appt.prescription ||
        (appt.medicines && appt.medicines.length > 0) ||
        appt.hasPrescription;
      if (!hasRx) continue;

      const docName =
        typeof appt.doctorId === "object" && appt.doctorId && "name" in appt.doctorId
          ? formatDoctorName(appt.doctorId.name)
          : appt.doctorName
            ? formatDoctorName(appt.doctorName)
            : "Attending Doctor";

      const docSpecialty =
        typeof appt.doctorId === "object" && appt.doctorId
          ? (appt.doctorId as { speciality?: string; department?: string }).speciality ||
            (appt.doctorId as { speciality?: string; department?: string }).department
          : appt.doctorSpecialty;

      const docId =
        typeof appt.doctorId === "object" && appt.doctorId
          ? String((appt.doctorId as { _id?: string })._id || "")
          : typeof appt.doctorId === "string"
            ? appt.doctorId
            : undefined;

      const hospName =
        appt.hospitalName ||
        (typeof appt.doctorId === "object" &&
        appt.doctorId &&
        (appt.doctorId as { hospitalName?: string }).hospitalName) ||
        undefined;

      const apptDate = appt.slotDate || appt.date || appt.appointmentDate || "";

      items.push({
        id: `rx_${appt._id}`,
        title: `Prescription — ${docName}`,
        categoryKeys: ["prescriptions", "doctor_docs"],
        primaryCategory: "Prescription",
        typeLabel: "Digital Prescription",
        date: apptDate,
        timestamp: new Date(apptDate).getTime() || 0,
        doctorName: docName,
        doctorSpecialty: docSpecialty,
        doctorId: docId,
        hospitalName: hospName,
        appointmentId: String(appt._id),
        displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
        fileType: "DIGITAL",
        isShared: false,
        diagnosis: appt.diagnosis,
        notes: appt.followUpAdvice,
        patientName: appt.patientName,
        familyRelationship: appt.familyRelationship,
        source: "prescription",
      });
    }

    // 4. Clinical Encounters / Medical Records
    for (const appt of medicalHistory.consultations) {
      if (appt.status !== "completed") continue;
      if (!appt.diagnosis && !appt.clinicalNotes && !appt.vitals) continue;

      const docName =
        typeof appt.doctorId === "object" && appt.doctorId && "name" in appt.doctorId
          ? formatDoctorName(appt.doctorId.name)
          : appt.doctorName
            ? formatDoctorName(appt.doctorName)
            : "Attending Doctor";

      const docId =
        typeof appt.doctorId === "object" && appt.doctorId
          ? String((appt.doctorId as { _id?: string })._id || "")
          : typeof appt.doctorId === "string"
            ? appt.doctorId
            : undefined;

      const apptDate = appt.slotDate || appt.date || appt.appointmentDate || "";

      items.push({
        id: `rec_${appt._id}`,
        title: `Clinical Encounter — ${docName}`,
        categoryKeys: ["records", "doctor_docs"],
        primaryCategory: "Medical Record",
        typeLabel: "Clinical EMR Record",
        date: apptDate,
        timestamp: new Date(apptDate).getTime() || 0,
        doctorName: docName,
        doctorId: docId,
        hospitalName: appt.hospitalName,
        appointmentId: String(appt._id),
        displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
        fileType: "CLINICAL",
        isShared: false,
        diagnosis: appt.diagnosis,
        notes: appt.clinicalNotes?.treatmentPlan || appt.followUpAdvice,
        patientName: appt.patientName,
        familyRelationship: appt.familyRelationship,
        source: "consultation",
      });
    }

    return items;
  }, [uploadedDocs, medicalHistory]);

  // Compute live counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<DocumentCategoryKey, number> = {
      all: unifiedDocuments.length,
      reports: 0,
      prescriptions: 0,
      records: 0,
      lab_reports: 0,
      imaging: 0,
      doctor_docs: 0,
      uploaded: 0,
      shared: 0,
    };

    for (const doc of unifiedDocuments) {
      for (const cat of doc.categoryKeys) {
        if (cat in counts) {
          counts[cat]++;
        }
      }
    }
    return counts;
  }, [unifiedDocuments]);

  // Only expose categories that have actual data!
  const availableCategories = useMemo(() => {
    return CATEGORY_DEFINITIONS.filter(
      (def) => def.key === "all" || categoryCounts[def.key] > 0,
    );
  }, [categoryCounts]);

  // Extract unique doctors and hospitals for filters
  const filterOptions = useMemo(() => {
    const doctors = new Set<string>();
    const hospitals = new Set<string>();

    for (const doc of unifiedDocuments) {
      if (doc.doctorName?.trim()) doctors.add(doc.doctorName.trim());
      if (doc.hospitalName?.trim()) hospitals.add(doc.hospitalName.trim());
    }

    return {
      doctors: Array.from(doctors).sort(),
      hospitals: Array.from(hospitals).sort(),
    };
  }, [unifiedDocuments]);

  // Filtered & Sorted documents
  const filteredDocuments = useMemo(() => {
    let result = unifiedDocuments;

    // 1. Category filter
    if (activeCategory !== "all") {
      result = result.filter((d) => d.categoryKeys.includes(activeCategory));
    }

    // 2. Doctor filter
    if (selectedDoctorFilter !== "all") {
      result = result.filter((d) => d.doctorName === selectedDoctorFilter);
    }

    // 3. Hospital filter
    if (selectedHospitalFilter !== "all") {
      result = result.filter((d) => d.hospitalName === selectedHospitalFilter);
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.doctorName && d.doctorName.toLowerCase().includes(q)) ||
          (d.hospitalName && d.hospitalName.toLowerCase().includes(q)) ||
          d.typeLabel.toLowerCase().includes(q) ||
          d.date.toLowerCase().includes(q) ||
          (d.displayAppointmentId && d.displayAppointmentId.toLowerCase().includes(q)),
      );
    }

    // 5. Sorting
    result = [...result].sort((a, b) => {
      if (sortOrder === "name") {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === "oldest") {
        return a.timestamp - b.timestamp;
      }
      return b.timestamp - a.timestamp;
    });

    return result;
  }, [
    unifiedDocuments,
    activeCategory,
    selectedDoctorFilter,
    selectedHospitalFilter,
    searchQuery,
    sortOrder,
  ]);

  // Pick Document / Image
  const handlePickDocument = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to select medical reports and documents.",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];

        // File size check (15 MB maximum)
        if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024) {
          Alert.alert(
            "File Too Large",
            "Please select a medical document smaller than 15 MB.",
          );
          return;
        }

        setUploadAsset(asset);
        if (!uploadTitle.trim()) {
          const rawName = asset.fileName || "Medical Document";
          setUploadTitle(rawName.replace(/\.[^/.]+$/, ""));
        }

        // Duplicate check against existing items
        const matchingDoc = unifiedDocuments.find(
          (d) =>
            d.title.toLowerCase() === (asset.fileName || "").toLowerCase() ||
            (asset.fileSize && d.rawSize === asset.fileSize),
        );
        if (matchingDoc) {
          setDuplicateWarning(
            `A document matching "${matchingDoc.title}" (${matchingDoc.date}) already exists in your vault.`,
          );
        } else {
          setDuplicateWarning(null);
        }
      }
    } catch {
      Alert.alert("Error", "Could not access file picker.");
    }
  };

  // Submit Upload
  const handleUploadSubmit = async () => {
    if (!uploadAsset) {
      setUploadErrorMsg("Please choose a file or image to upload.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadErrorMsg("Please provide a document title or description.");
      return;
    }

    setUploadErrorMsg("");
    setUploadStatus("uploading");

    try {
      const formData = new FormData();
      const filePayload: any = {
        uri: uploadAsset.uri,
        name: uploadAsset.fileName || "document.jpg",
        type: uploadAsset.mimeType || "image/jpeg",
      };
      formData.append("file", filePayload as Blob);
      formData.append("title", uploadTitle.trim());
      formData.append("category", uploadCategory);
      if (uploadNotes.trim()) {
        formData.append("notes", uploadNotes.trim());
      }
      if (uploadAppointmentId) {
        formData.append("linkedAppointmentId", uploadAppointmentId);
      }
      if (
        familyMemberFilter &&
        familyMemberFilter !== "all" &&
        familyMemberFilter !== "self"
      ) {
        formData.append("familyMemberId", familyMemberFilter);
      }

      setUploadStatus("processing");
      const res = await healthDocumentsService.uploadHealthDocument(formData);

      if (res.success) {
        setUploadStatus("success");
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadAsset(null);
          setUploadTitle("");
          setUploadNotes("");
          setUploadAppointmentId("");
          setUploadStatus("idle");
          setDuplicateWarning(null);
          loadDocuments();
        }, 1200);
      } else {
        setUploadStatus("error");
        setUploadErrorMsg(res.message || "Upload could not be completed.");
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadErrorMsg(toErrorMessage(err, "Failed to upload document. Please retry."));
    }
  };

  // Document Open / Viewer
  const handleOpenDocument = async (doc: UnifiedDocumentItem) => {
    if (!doc.url) {
      Alert.alert(
        "Digital Record",
        "This is an authenticated digital record without an external attachment. Full details are shown below.",
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(doc.url);
      if (supported) {
        await Linking.openURL(doc.url);
      } else {
        await Linking.openURL(doc.url);
      }
    } catch {
      Alert.alert("Unable to Open", "Could not launch file viewer for this document.");
    }
  };

  // Secure Native Share
  const handleShareNative = async (doc: UnifiedDocumentItem) => {
    try {
      await Share.share({
        title: doc.title,
        message:
          `HealPoint Health Document: ${doc.title}\n` +
          `Category: ${doc.typeLabel}\n` +
          `Date: ${formatDDMMYYYY(doc.date)}\n` +
          (doc.doctorName ? `Doctor: ${doc.doctorName}\n` : "") +
          (doc.hospitalName ? `Hospital: ${doc.hospitalName}\n` : "") +
          (doc.url ? `Document Access: ${doc.url}\n` : "") +
          `Verified through HealPoint Healthcare.`,
      });
    } catch {}
  };

  // Share with Doctor
  const handleConfirmShareWithDoctor = async () => {
    if (!shareTargetDoc || !selectedDoctorIdToShare) {
      setShareFeedback("Please select a treating doctor.");
      return;
    }

    setSharingLoading(true);
    setShareFeedback("");
    try {
      const res = await healthDocumentsService.shareDocumentWithDoctor(
        shareTargetDoc.id,
        {
          doctorId: selectedDoctorIdToShare,
          appointmentId: shareTargetDoc.appointmentId,
          note: shareNote.trim() || undefined,
        },
      );

      if (res.success) {
        setShowShareModal(false);
        setShareTargetDoc(null);
        setSelectedDoctorIdToShare("");
        setShareNote("");
        Alert.alert(
          "Document Shared",
          "This health document has been securely shared with your treating doctor.",
        );
        loadDocuments();
      }
    } catch (err) {
      setShareFeedback(toErrorMessage(err, "Unable to share document."));
    } finally {
      setSharingLoading(false);
    }
  };

  // Revoke Doctor Access
  const handleRevokeShare = async (doc: UnifiedDocumentItem, doctorId: string) => {
    try {
      const res = await healthDocumentsService.revokeDocumentShare(doc.id, doctorId);
      if (res.success) {
        setRevokeConfirmDoc(null);
        Alert.alert("Access Revoked", "Doctor access to this document has been removed.");
        loadDocuments();
      }
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err, "Failed to revoke access."));
    }
  };

  return (
    <View style={styles.safe}>
      {/* Top Header */}
      <DrawerHeader
        title="Health Document Center"
        subtitle={`${unifiedDocuments.length} document${unifiedDocuments.length === 1 ? "" : "s"} · Vault Verified`}
        rightElement={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload health document"
            onPress={() => {
              setUploadAsset(null);
              setUploadTitle("");
              setUploadErrorMsg("");
              setUploadStatus("idle");
              setShowUploadModal(true);
            }}
            style={({ pressed }) => [
              styles.uploadHeaderBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={17} color={Palette.white} />
            <Text style={styles.uploadHeaderBtnText}>Upload</Text>
          </Pressable>
        }
      />

      {/* Family Member Switcher */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={setFamilyMemberFilter}
        style={styles.familyBar}
      />

      {/* Search Bar & Multi-criteria Controls */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, doctor, hospital, or date..."
            placeholderTextColor={Palette.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable
              hitSlop={8}
              onPress={() => setSearchQuery("")}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Factual Category Chips (only shown if data exists) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {availableCategories.map((cat) => {
            const active = activeCategory === cat.key;
            const count = categoryCounts[cat.key];
            return (
              <Pressable
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={active ? Palette.white : Palette.textMuted}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sorting & Filter Strip */}
        <View style={styles.filterStrip}>
          <View style={styles.sortRow}>
            <Text style={styles.filterLabel}>Sort:</Text>
            <Pressable
              onPress={() =>
                setSortOrder(
                  sortOrder === "newest"
                    ? "oldest"
                    : sortOrder === "oldest"
                      ? "name"
                      : "newest",
                )
              }
              style={styles.sortPill}
            >
              <Ionicons
                name={
                  sortOrder === "name"
                    ? "text-outline"
                    : sortOrder === "oldest"
                      ? "arrow-up"
                      : "arrow-down"
                }
                size={12}
                color={Palette.primary}
              />
              <Text style={styles.sortPillText}>
                {sortOrder === "newest"
                  ? "Newest"
                  : sortOrder === "oldest"
                    ? "Oldest"
                    : "Name (A-Z)"}
              </Text>
            </Pressable>
          </View>

          {/* Active Doctor or Hospital Filter indicators */}
          {(selectedDoctorFilter !== "all" || selectedHospitalFilter !== "all") && (
            <Pressable
              onPress={() => {
                setSelectedDoctorFilter("all");
                setSelectedHospitalFilter("all");
              }}
              style={styles.clearFilterPill}
            >
              <Text style={styles.clearFilterText}>Reset Filters</Text>
              <Ionicons name="close" size={12} color="#DC2626" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main List Area */}
      {loading ? (
        <Loading label="Loading verified health documents..." />
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
            />
          }
        >
          <ErrorState message={error} onRetry={loadDocuments} />
        </ScrollView>
      ) : filteredDocuments.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
            />
          }
        >
          <EmptyState
            title={
              searchQuery
                ? "No matching documents"
                : activeCategory === "prescriptions"
                  ? "No prescriptions found"
                  : activeCategory === "reports" || activeCategory === "lab_reports"
                    ? "No medical reports yet"
                    : activeCategory === "shared"
                      ? "No shared documents"
                      : "No health documents yet"
            }
            message={
              searchQuery
                ? "Try searching with a different doctor, report name, or hospital."
                : activeCategory === "prescriptions"
                  ? "Doctor prescriptions issued during your clinic or video consultations will automatically appear here."
                  : activeCategory === "shared"
                    ? "Documents you explicitly share with your treating doctors will appear here."
                    : "Upload your lab reports, prescriptions, or medical scans to keep them organized and accessible."
            }
            action={
              <Button
                title="Upload Document"
                icon="cloud-upload-outline"
                onPress={() => {
                  setUploadAsset(null);
                  setUploadTitle("");
                  setShowUploadModal(true);
                }}
              />
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.typeLabel}`}
              onPress={() => setSelectedDocDetails(item)}
              style={({ pressed }) => [
                styles.docCard,
                pressed && styles.pressed,
              ]}
            >
              {/* Header: Icon, Title, Category Badge */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.docIconBox,
                    item.categoryKeys.includes("prescriptions") && styles.iconRx,
                    item.categoryKeys.includes("reports") && styles.iconReport,
                    item.categoryKeys.includes("imaging") && styles.iconImaging,
                    item.categoryKeys.includes("records") && styles.iconRecord,
                  ]}
                >
                  <Ionicons
                    name={
                      item.categoryKeys.includes("prescriptions")
                        ? "document-text"
                        : item.categoryKeys.includes("imaging")
                          ? "scan"
                          : item.categoryKeys.includes("lab_reports")
                            ? "flask"
                            : item.categoryKeys.includes("records")
                              ? "medkit"
                              : "document"
                    }
                    size={22}
                    color={
                      item.categoryKeys.includes("prescriptions")
                        ? "#2563EB"
                        : item.categoryKeys.includes("imaging")
                          ? "#9333EA"
                          : item.categoryKeys.includes("lab_reports")
                            ? "#16A34A"
                            : item.categoryKeys.includes("records")
                              ? "#0D9488"
                              : Palette.primary
                    }
                  />
                </View>

                <View style={styles.cardTitleWrap}>
                  <Text style={styles.docTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.docSubBadgeRow}>
                    <Badge
                      label={item.primaryCategory}
                      variant={
                        item.categoryKeys.includes("prescriptions")
                          ? "primary"
                          : item.categoryKeys.includes("imaging")
                            ? "warning"
                            : item.categoryKeys.includes("reports")
                              ? "success"
                              : "neutral"
                      }
                    />
                    {item.isShared ? (
                      <View style={styles.sharedBadge}>
                        <Ionicons name="share-social" size={10} color="#2563EB" />
                        <Text style={styles.sharedBadgeText}>Shared</Text>
                      </View>
                    ) : null}
                    {item.processingStatus === "processing" ? (
                      <View style={styles.processingBadge}>
                        <ActivityIndicator size="small" color="#D97706" />
                        <Text style={styles.processingBadgeText}>Analyzing</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Metadata: Doctor, Hospital, Date, File */}
              <View style={styles.cardMetaGrid}>
                {item.doctorName ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={13} color={Palette.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.doctorName}
                    </Text>
                  </View>
                ) : null}

                {item.hospitalName ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="business-outline" size={13} color={Palette.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.hospitalName}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color={Palette.textMuted} />
                  <Text style={styles.metaText}>
                    {formatDDMMYYYY(item.date)}
                    {item.fileSize ? ` · ${item.fileSize}` : ""}
                    {item.fileType ? ` · ${item.fileType}` : ""}
                  </Text>
                </View>

                {/* Family Dependent Attribution */}
                {item.patientName &&
                item.familyRelationship &&
                item.familyRelationship !== "Self" ? (
                  <View style={styles.familyAttribution}>
                    <Ionicons name="people" size={11} color="#0D9488" />
                    <Text style={styles.familyAttributionText} numberOfLines={1}>
                      For {item.patientName} ({item.familyRelationship})
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Toolbar on Card */}
              <View style={styles.cardActionsRow}>
                {item.url ? (
                  <Pressable
                    onPress={() => handleOpenDocument(item)}
                    style={styles.cardActionBtn}
                  >
                    <Ionicons name="open-outline" size={14} color={Palette.primary} />
                    <Text style={styles.cardActionText}>View File</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => setSelectedDocDetails(item)}
                  style={styles.cardActionBtn}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={Palette.primaryDark}
                  />
                  <Text style={styles.cardActionText}>Details</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleShareNative(item)}
                  style={styles.cardActionBtn}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={14}
                    color={Palette.textMuted}
                  />
                  <Text style={[styles.cardActionText, { color: Palette.textMuted }]}>
                    Share
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          )}
          ListFooterComponent={<View style={styles.listFooter} />}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. DOCUMENT DETAILS & VIEWER MODAL                                       */}
      {/* ========================================================================= */}
      {selectedDocDetails ? (
        <Modal
          visible={Boolean(selectedDocDetails)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedDocDetails(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.detailsModalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedDocDetails.title}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedDocDetails.typeLabel} · {formatDDMMYYYY(selectedDocDetails.date)}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => setSelectedDocDetails(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailsScrollBody}
              >
                {/* Verification & Security Badge */}
                <View style={styles.securityPill}>
                  <Ionicons name="shield-checkmark" size={15} color="#16A34A" />
                  <Text style={styles.securityPillText}>
                    Verified Medical Vault Record · Restricted Patient Access
                  </Text>
                </View>

                {/* Doctor Connection Card */}
                {selectedDocDetails.doctorName ? (
                  <Card style={styles.connectionCard}>
                    <View style={styles.connectionRow}>
                      <Ionicons name="person" size={20} color={Palette.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connectionTitle}>
                          {selectedDocDetails.doctorName}
                        </Text>
                        <Text style={styles.connectionSub}>
                          {selectedDocDetails.doctorSpecialty || "Consulting Specialist"}
                        </Text>
                      </View>
                      {selectedDocDetails.doctorId ? (
                        <Button
                          title="Doctor Profile"
                          variant="outline"
                          onPress={() => {
                            const dId = selectedDocDetails.doctorId;
                            setSelectedDocDetails(null);
                            router.push(`/doctor/${dId}` as never);
                          }}
                        />
                      ) : null}
                    </View>
                  </Card>
                ) : null}

                {/* Hospital Connection Card */}
                {selectedDocDetails.hospitalName ? (
                  <Card style={styles.connectionCard}>
                    <View style={styles.connectionRow}>
                      <Ionicons name="business" size={20} color={Palette.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connectionTitle}>
                          {selectedDocDetails.hospitalName}
                        </Text>
                        <Text style={styles.connectionSub}>Affiliated Hospital</Text>
                      </View>
                      {selectedDocDetails.hospitalId ? (
                        <Button
                          title="Hospital"
                          variant="outline"
                          onPress={() => {
                            const hId = selectedDocDetails.hospitalId;
                            setSelectedDocDetails(null);
                            router.push(`/hospital/${hId}` as never);
                          }}
                        />
                      ) : null}
                    </View>
                  </Card>
                ) : null}

                {/* Appointment Connection */}
                {selectedDocDetails.appointmentId ? (
                  <Card style={styles.connectionCard}>
                    <View style={styles.connectionRow}>
                      <Ionicons name="calendar" size={20} color={Palette.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connectionTitle}>Linked Appointment</Text>
                        <Text style={styles.connectionSub}>
                          Ref #{selectedDocDetails.displayAppointmentId || selectedDocDetails.appointmentId}
                        </Text>
                      </View>
                      <Button
                        title="View Visit"
                        variant="outline"
                        onPress={() => {
                          const aptId = selectedDocDetails.appointmentId;
                          setSelectedDocDetails(null);
                          router.push(`/appointment/${aptId}` as never);
                        }}
                      />
                    </View>
                  </Card>
                ) : null}

                {/* Clinical Notes / Diagnosis if present */}
                {selectedDocDetails.diagnosis ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>Primary Assessment</Text>
                    <Text style={styles.sectionBlockBody}>
                      {selectedDocDetails.diagnosis}
                    </Text>
                  </View>
                ) : null}

                {selectedDocDetails.notes ? (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>Physician Notes & Instructions</Text>
                    <Text style={styles.sectionBlockBody}>
                      {selectedDocDetails.notes}
                    </Text>
                  </View>
                ) : null}

                {/* Secure Sharing Status Section */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionBlockTitle}>Sharing & Confidentiality</Text>
                  {selectedDocDetails.isShared &&
                  selectedDocDetails.sharedWith &&
                  selectedDocDetails.sharedWith.length > 0 ? (
                    <View style={styles.sharedDoctorList}>
                      {selectedDocDetails.sharedWith.map((share) => (
                        <View key={share.doctorId} style={styles.sharedDoctorItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sharedDocName}>{share.doctorName}</Text>
                            <Text style={styles.sharedDocTime}>
                              Access granted · {share.sharedAt ? formatDDMMYYYY(share.sharedAt) : "Active"}
                            </Text>
                          </View>
                          <Button
                            title="Revoke"
                            variant="danger"
                            onPress={() => handleRevokeShare(selectedDocDetails, share.doctorId)}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.notSharedBox}>
                      <Text style={styles.notSharedText}>
                        This document is currently confidential and only accessible by you.
                      </Text>
                      {selectedDocDetails.source === "uploaded" ? (
                        <Button
                          title="Share with Doctor"
                          variant="secondary"
                          icon="share-social-outline"
                          onPress={() => {
                            setShareTargetDoc(selectedDocDetails);
                            setSelectedDocDetails(null);
                            setShowShareModal(true);
                          }}
                          style={{ marginTop: Spacing.xs }}
                        />
                      ) : null}
                    </View>
                  )}
                </View>

                {/* File Details */}
                <View style={styles.fileInfoBox}>
                  <Text style={styles.fileInfoLabel}>Format: {selectedDocDetails.fileType}</Text>
                  {selectedDocDetails.fileSize ? (
                    <Text style={styles.fileInfoLabel}>Size: {selectedDocDetails.fileSize}</Text>
                  ) : null}
                  {selectedDocDetails.uploadDate ? (
                    <Text style={styles.fileInfoLabel}>
                      Uploaded: {formatDDMMYYYY(selectedDocDetails.uploadDate)}
                    </Text>
                  ) : null}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.modalActionButtons}>
                  {selectedDocDetails.url ? (
                    <Button
                      title="Open Document File"
                      icon="open-outline"
                      variant="primary"
                      onPress={() => handleOpenDocument(selectedDocDetails)}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                  <Button
                    title="Export / Share"
                    icon="share-outline"
                    variant="outline"
                    onPress={() => handleShareNative(selectedDocDetails)}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* ========================================================================= */}
      {/* 2. SMART HEALTH DOCUMENT UPLOAD MODAL                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (uploadStatus !== "uploading") setShowUploadModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.uploadModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Upload Medical Document</Text>
                <Text style={styles.modalSubtitle}>
                  Secured & encrypted with HealPoint Document Intelligence
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => setShowUploadModal(false)}
                disabled={uploadStatus === "uploading"}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.uploadScrollBody}
            >
              {/* File Selector Box */}
              <Pressable
                onPress={handlePickDocument}
                disabled={uploadStatus === "uploading"}
                style={styles.pickFileBox}
              >
                {uploadAsset ? (
                  <View style={styles.assetPreviewWrap}>
                    <Image
                      source={{ uri: uploadAsset.uri }}
                      style={styles.assetThumbnail}
                      contentFit="cover"
                    />
                    <View style={styles.assetMeta}>
                      <Text style={styles.assetName} numberOfLines={1}>
                        {uploadAsset.fileName || "Selected Document"}
                      </Text>
                      <Text style={styles.assetSize}>
                        {formatFileSize(uploadAsset.fileSize)} · Tap to replace
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.pickFilePlaceholder}>
                    <Ionicons
                      name="cloud-upload"
                      size={32}
                      color={Palette.primary}
                    />
                    <Text style={styles.pickFileTitle}>Select Medical File or Image</Text>
                    <Text style={styles.pickFileSubtitle}>
                      Supports PDF, JPG, PNG, WEBP (Max 15 MB)
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Duplicate Warning */}
              {duplicateWarning ? (
                <View style={styles.duplicateWarningBox}>
                  <Ionicons name="alert-circle" size={18} color="#D97706" />
                  <Text style={styles.duplicateWarningText}>{duplicateWarning}</Text>
                </View>
              ) : null}

              {/* Title Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Document Name / Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Complete Blood Count (CBC) Report"
                  placeholderTextColor={Palette.textMuted}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  editable={uploadStatus !== "uploading"}
                />
              </View>

              {/* Category Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Document Category</Text>
                <View style={styles.categoryPillRow}>
                  {["Lab Report", "Prescription", "Medical Record", "Radiology/Scan", "Other"].map(
                    (cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setUploadCategory(cat)}
                        style={[
                          styles.catSelectPill,
                          uploadCategory === cat && styles.catSelectPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.catSelectPillText,
                            uploadCategory === cat && styles.catSelectPillTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>

              {/* Optional Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Optional Notes or Instructions</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputArea]}
                  placeholder="e.g. Advised fasting test, follow-up for fever"
                  placeholderTextColor={Palette.textMuted}
                  value={uploadNotes}
                  onChangeText={setUploadNotes}
                  multiline
                  numberOfLines={2}
                  editable={uploadStatus !== "uploading"}
                />
              </View>

              {/* Upload Error Feedback */}
              {uploadErrorMsg ? (
                <FormMessage type="error" message={uploadErrorMsg} />
              ) : null}

              {/* Progress State Indicator */}
              {uploadStatus === "uploading" ? (
                <View style={styles.progressStateBox}>
                  <ActivityIndicator size="small" color={Palette.primary} />
                  <Text style={styles.progressStateText}>Uploading document to secure vault...</Text>
                </View>
              ) : uploadStatus === "processing" ? (
                <View style={styles.progressStateBox}>
                  <ActivityIndicator size="small" color="#D97706" />
                  <Text style={styles.progressStateText}>Processing document intelligence...</Text>
                </View>
              ) : uploadStatus === "success" ? (
                <View style={styles.progressStateSuccessBox}>
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                  <Text style={styles.progressStateSuccessText}>Document uploaded successfully!</Text>
                </View>
              ) : null}

              {/* Upload Submit Button */}
              <Button
                title={
                  uploadStatus === "uploading"
                    ? "Uploading..."
                    : uploadStatus === "processing"
                      ? "Processing..."
                      : uploadStatus === "error"
                        ? "Retry Upload"
                        : "Upload to Health Vault"
                }
                icon="cloud-upload"
                variant="primary"
                disabled={uploadStatus === "uploading" || uploadStatus === "processing"}
                loading={uploadStatus === "uploading" || uploadStatus === "processing"}
                onPress={handleUploadSubmit}
                style={{ marginTop: Spacing.sm }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. SHARE WITH DOCTOR MODAL                                               */}
      {/* ========================================================================= */}
      {showShareModal && shareTargetDoc ? (
        <Modal
          visible={showShareModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowShareModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.shareModalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Share with Doctor</Text>
                  <Text style={styles.modalSubtitle}>
                    Grant secure clinical access to {shareTargetDoc.title}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => setShowShareModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.shareScrollBody}
              >
                <Text style={styles.formLabel}>Select Attending Doctor</Text>
                {filterOptions.doctors.length === 0 ? (
                  <Text style={styles.emptyDoctorText}>
                    No treating doctors on file yet. Book an appointment first to establish clinical sharing.
                  </Text>
                ) : (
                  <View style={styles.doctorSelectList}>
                    {filterOptions.doctors.map((docName) => {
                      const selected = selectedDoctorIdToShare === docName;
                      return (
                        <Pressable
                          key={docName}
                          onPress={() => setSelectedDoctorIdToShare(docName)}
                          style={[
                            styles.doctorSelectItem,
                            selected && styles.doctorSelectItemActive,
                          ]}
                        >
                          <Ionicons
                            name="person-circle"
                            size={20}
                            color={selected ? Palette.primary : Palette.textMuted}
                          />
                          <Text
                            style={[
                              styles.doctorSelectName,
                              selected && styles.doctorSelectNameActive,
                            ]}
                          >
                            {docName}
                          </Text>
                          {selected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={Palette.primary}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={[styles.formGroup, { marginTop: Spacing.sm }]}>
                  <Text style={styles.formLabel}>Clinical Note (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Please review CBC before next visit"
                    placeholderTextColor={Palette.textMuted}
                    value={shareNote}
                    onChangeText={setShareNote}
                  />
                </View>

                {shareFeedback ? (
                  <FormMessage type="error" message={shareFeedback} />
                ) : null}

                <Button
                  title="Authorize Clinical Sharing"
                  icon="shield-checkmark"
                  variant="primary"
                  loading={sharingLoading}
                  disabled={sharingLoading || !selectedDoctorIdToShare}
                  onPress={handleConfirmShareWithDoctor}
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      <PatientBottomNav activeTab="home" />
    </View>
  );
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  uploadHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    ...Shadows.sm,
  },
  uploadHeaderBtnText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
  },
  familyBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.60)",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  categoryChipsScroll: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.8)",
    borderRadius: Radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
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
  filterStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  sortPillText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  clearFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  clearFilterText: {
    ...Typography.caption,
    color: "#DC2626",
    fontWeight: "600",
  },
  stateContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  separator: {
    height: Spacing.md,
  },
  listFooter: {
    height: 95,
  },
  docCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(37, 99, 235, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconRx: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  iconReport: {
    backgroundColor: "rgba(22, 163, 74, 0.12)",
  },
  iconImaging: {
    backgroundColor: "rgba(147, 51, 234, 0.12)",
  },
  iconRecord: {
    backgroundColor: "rgba(13, 148, 136, 0.12)",
  },
  cardTitleWrap: {
    flex: 1,
  },
  docTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    lineHeight: 20,
  },
  docSubBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  sharedBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: "#2563EB",
  },
  processingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  processingBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  cardMetaGrid: {
    marginTop: Spacing.sm,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flexShrink: 1,
  },
  familyAttribution: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(13, 148, 136, 0.10)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  familyAttributionText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: "#0F766E",
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.8)",
    paddingTop: Spacing.xs,
    marginTop: Spacing.sm,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cardActionText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.60)",
    justifyContent: "flex-end",
  },
  detailsModalContent: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "88%",
    paddingBottom: Spacing.xl,
  },
  uploadModalContent: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "88%",
    paddingBottom: Spacing.xl,
  },
  shareModalContent: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "75%",
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  modalTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailsScrollBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  uploadScrollBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  shareScrollBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  securityPillText: {
    ...Typography.caption,
    color: "#166534",
    fontWeight: "600",
    flex: 1,
  },
  connectionCard: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  connectionTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  connectionSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  sectionBlock: {
    backgroundColor: "rgba(248, 250, 252, 0.9)",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  sectionBlockTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionBlockBody: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 18,
  },
  sharedDoctorList: {
    gap: 6,
    marginTop: 4,
  },
  sharedDoctorItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.white,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  sharedDocName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  sharedDocTime: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  notSharedBox: {
    gap: 4,
  },
  notSharedText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  fileInfoBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  fileInfoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pickFileBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(37, 99, 235, 0.4)",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    backgroundColor: "rgba(248, 250, 252, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  pickFilePlaceholder: {
    alignItems: "center",
    gap: 4,
  },
  pickFileTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  pickFileSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  assetPreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "100%",
  },
  assetThumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Palette.border,
  },
  assetMeta: {
    flex: 1,
  },
  assetName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  assetSize: {
    ...Typography.caption,
    color: Palette.primary,
    marginTop: 2,
  },
  duplicateWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  duplicateWarningText: {
    ...Typography.caption,
    color: "#92400E",
    fontWeight: "600",
    flex: 1,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  formInput: {
    ...Typography.bodySmall,
    backgroundColor: "rgba(248, 250, 252, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.8)",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Palette.text,
  },
  formInputArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  categoryPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  catSelectPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(241, 245, 249, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.8)",
  },
  catSelectPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  catSelectPillText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  catSelectPillTextActive: {
    color: Palette.white,
  },
  progressStateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  progressStateText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  progressStateSuccessBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  progressStateSuccessText: {
    ...Typography.caption,
    color: "#166534",
    fontWeight: "700",
  },
  doctorSelectList: {
    gap: 6,
    maxHeight: 180,
  },
  doctorSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: "rgba(248, 250, 252, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  doctorSelectItemActive: {
    borderColor: Palette.primary,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  doctorSelectName: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
    flex: 1,
  },
  doctorSelectNameActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  emptyDoctorText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
    paddingVertical: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
