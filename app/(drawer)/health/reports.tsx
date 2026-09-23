/**
 * HealPoint - Patient Reports & Diagnostic Records.
 *
 * Displays real medical lab reports, imaging scans, and diagnostic documents
 * attached to appointments. Supports viewing, opening files, sharing, uploading,
 * and deleting patient reports with full authentication.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { Badge } from "@/components/ui/Badge";
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
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type { Appointment, PatientReportItem } from "@/types";

const CATEGORIES = [
  "All",
  "Lab Report",
  "Radiology",
  "Blood Test",
  "Scan",
  "Other",
];

export default function ReportsScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    memberId || "all",
  );
  const [reports, setReports] = useState<PatientReportItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadAppointmentId, setUploadAppointmentId] = useState("");
  const [uploadReportName, setUploadReportName] = useState("");
  const [uploadReportUrl, setUploadReportUrl] = useState("");
  const [uploadReportType, setUploadReportType] = useState("Lab Report");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const loadReports = async () => {
    setError("");
    try {
      const history =
        await appointmentService.getPatientMedicalHistory(familyMemberFilter);
      setReports(history.reports || []);
      setAppointments(history.consultations || []);
      if (history.consultations?.length > 0 && !uploadAppointmentId) {
        setUploadAppointmentId(history.consultations[0]._id);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load diagnostic reports."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useScreenFocus(loadReports);

  useEffect(() => {
    loadReports();
  }, [userId, familyMemberFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (r.category || r.type || "")
          .toLowerCase()
          .includes(selectedCategory.toLowerCase()) ||
        (r.type || "").toLowerCase().includes(selectedCategory.toLowerCase());

      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.doctorName || "").toLowerCase().includes(q) ||
        (r.hospitalName || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [reports, selectedCategory, search]);

  const handleOpenReport = async (item: PatientReportItem) => {
    if (!item.url) {
      Alert.alert(
        "Report Unavailable",
        "The file link for this report is not available.",
      );
      return;
    }
    try {
      const supported = await Linking.canOpenURL(item.url);
      if (supported) {
        await Linking.openURL(item.url);
      } else {
        await Linking.openURL(item.url);
      }
    } catch {
      Alert.alert(
        "Error Opening File",
        "Unable to open document in browser or file viewer.",
      );
    }
  };

  const handleShareReport = async (item: PatientReportItem) => {
    try {
      await Share.share({
        title: item.name,
        message: `HealPoint Medical Report: ${item.name} (${item.type || "Diagnostic Report"})\nIssued: ${formatDDMMYYYY(item.date || item.uploadedAt || "")}\nDoctor: ${item.doctorName || "Specialist"}\nFile URL: ${item.url}`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleDeleteReport = (item: PatientReportItem) => {
    Alert.alert(
      "Delete Report",
      `Are you sure you want to delete "${item.name}" from your health records? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await appointmentService.deleteMedicalReport(
                item.appointmentId,
                item._id,
              );
              setReports((prev) => prev.filter((r) => r._id !== item._id));
            } catch (err) {
              Alert.alert(
                "Delete Failed",
                toErrorMessage(err, "Could not delete report from records."),
              );
            }
          },
        },
      ],
    );
  };

  const handleUploadSubmit = async () => {
    if (!uploadAppointmentId) {
      setUploadError("Please select an appointment to attach this report to.");
      return;
    }
    if (!uploadReportName.trim()) {
      setUploadError("Please enter a report name or title.");
      return;
    }
    if (!uploadReportUrl.trim()) {
      setUploadError("Please enter the document or file URL.");
      return;
    }

    setUploadError("");
    setUploading(true);
    try {
      await appointmentService.uploadMedicalReport(uploadAppointmentId, {
        name: uploadReportName.trim(),
        url: uploadReportUrl.trim(),
        type: uploadReportType,
      });

      setUploadModalVisible(false);
      setUploadReportName("");
      setUploadReportUrl("");
      setUploadNotes("");
      loadReports();
    } catch (err) {
      setUploadError(toErrorMessage(err, "Failed to upload medical report."));
    } finally {
      setUploading(false);
    }
  };

  const renderReportItem = ({ item }: { item: PatientReportItem }) => {
    const isPdf =
      (item.mimeType || "").includes("pdf") ||
      item.url.toLowerCase().endsWith(".pdf") ||
      item.name.toLowerCase().endsWith(".pdf");

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, isPdf && styles.iconBadgePdf]}>
            <Ionicons
              name={isPdf ? "document-text" : "images"}
              size={22}
              color={isPdf ? Palette.error : Palette.primary}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.reportTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.doctorName} numberOfLines={1}>
              {item.doctorName
                ? `Attending: ${formatDoctorName(item.doctorName)}`
                : "Clinical Laboratory"}
            </Text>
            <Text style={styles.specialty} numberOfLines={1}>
              {item.type || "Medical Diagnostic"} •{" "}
              {item.hospitalName || "HealPoint Clinic"}
            </Text>
          </View>
          <Badge label={item.type || "Report"} variant="primary" />
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Palette.textMuted}
            />
            <Text style={styles.metaText}>
              {formatDDMMYYYY(item.date || item.uploadedAt || "")}
            </Text>
          </View>
          {item.size ? (
            <View style={styles.metaItem}>
              <Ionicons
                name="server-outline"
                size={14}
                color={Palette.textMuted}
              />
              <Text style={styles.metaText}>
                {(item.size / 1024).toFixed(0)} KB
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-done" size={14} color="#059669" />
            <Text
              style={[styles.metaText, { color: "#059669", fontWeight: "600" }]}
            >
              Verified Record
            </Text>
          </View>
        </View>

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>REPORT NOTES</Text>
            <Text style={styles.notesContent}>{item.notes}</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            title="Open Document"
            variant="primary"
            onPress={() => handleOpenReport(item)}
            style={styles.openBtn}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share report"
            onPress={() => handleShareReport(item)}
            style={styles.actionIconBtn}
          >
            <Ionicons
              name="share-social-outline"
              size={18}
              color={Palette.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete report"
            onPress={() => handleDeleteReport(item)}
            style={[styles.actionIconBtn, styles.deleteIconBtn]}
          >
            <Ionicons name="trash-outline" size={18} color={Palette.error} />
          </Pressable>
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
            <Text style={styles.title}>Medical Reports</Text>
            <Text style={styles.subtitle}>
              Diagnostic Tests, Scans & Lab Results
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload report"
            onPress={() => setUploadModalVisible(true)}
            style={styles.uploadTriggerBtn}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={18}
              color={Palette.white}
            />
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Palette.textMuted} />
          <TextInput
            placeholder="Search reports by title, doctor, or test type..."
            placeholderTextColor={Palette.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            clearButtonMode="while-editing"
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
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTrack}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Family Member Isolation Filter */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={setFamilyMemberFilter}
      />

      {loading && !refreshing ? (
        <Loading fullScreen label="Loading diagnostic lab reports..." />
      ) : error ? (
        <ErrorState
          title="Could Not Load Reports"
          message={error}
          onRetry={loadReports}
        />
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item._id}
          renderItem={renderReportItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Palette.primary]}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={search ? "No Matching Reports" : "No Reports Found"}
              message={
                search
                  ? `No diagnostic records match "${search}". Try another keyword or clear filter.`
                  : "Diagnostic tests, scan files, and lab results uploaded by your hospital or by you will appear here."
              }
              action={
                <Button
                  title={search ? "Clear Filter" : "Upload Medical Report"}
                  onPress={() => {
                    if (search) setSearch("");
                    else setUploadModalVisible(true);
                  }}
                />
              }
            />
          }
        />
      )}

      {/* Upload Medical Report Modal */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Medical Report</Text>
              <Pressable
                onPress={() => setUploadModalVisible(false)}
                hitSlop={12}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Palette.text} />
              </Pressable>
            </View>

            {uploadError ? (
              <View style={styles.uploadErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Palette.error} />
                <Text style={styles.uploadErrorText}>{uploadError}</Text>
              </View>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalBody}
            >
              {/* Select Appointment */}
              <Text style={styles.inputLabel}>Associate With Appointment</Text>
              {appointments.length === 0 ? (
                <Text style={styles.noApptWarning}>
                  No active or past appointments found. Please book an
                  appointment first.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.apptSelectScroll}
                >
                  {appointments.slice(0, 6).map((appt) => {
                    const isSelected = uploadAppointmentId === appt._id;
                    const docName = formatDoctorName(
                      typeof appt.doctorId === "object" && appt.doctorId?.name
                        ? appt.doctorId.name
                        : appt.doctorName,
                      "Doctor",
                    );
                    return (
                      <Pressable
                        key={appt._id}
                        onPress={() => setUploadAppointmentId(appt._id)}
                        style={[
                          styles.apptSelectTile,
                          isSelected && styles.apptSelectTileActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.apptTileDoctor,
                            isSelected && styles.apptTileDoctorActive,
                          ]}
                          numberOfLines={1}
                        >
                          {docName}
                        </Text>
                        <Text
                          style={[
                            styles.apptTileDate,
                            isSelected && styles.apptTileDateActive,
                          ]}
                        >
                          {formatDDMMYYYY(appt.slotDate || appt.date || "")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Report Title */}
              <Text style={styles.inputLabel}>Report Title / Test Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Complete Blood Count (CBC) or Chest X-Ray"
                placeholderTextColor={Palette.textMuted}
                value={uploadReportName}
                onChangeText={setUploadReportName}
              />

              {/* Category */}
              <Text style={styles.inputLabel}>Report Category</Text>
              <View style={styles.categorySelectGrid}>
                {["Lab Report", "Radiology", "Blood Test", "Scan", "Other"].map(
                  (cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setUploadReportType(cat)}
                      style={[
                        styles.catSelectPill,
                        uploadReportType === cat && styles.catSelectPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catSelectText,
                          uploadReportType === cat &&
                            styles.catSelectTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>

              {/* File URL */}
              <Text style={styles.inputLabel}>Report Document / File URL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://... or /uploads/..."
                placeholderTextColor={Palette.textMuted}
                value={uploadReportUrl}
                onChangeText={setUploadReportUrl}
                autoCapitalize="none"
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Clinical Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Any specific comments from your doctor or laboratory..."
                placeholderTextColor={Palette.textMuted}
                value={uploadNotes}
                onChangeText={setUploadNotes}
                multiline
                numberOfLines={3}
              />

              <Button
                title={
                  uploading ? "Saving Report..." : "Submit & Attach Report"
                }
                onPress={handleUploadSubmit}
                disabled={uploading || appointments.length === 0}
                style={styles.submitUploadBtn}
              />
            </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
    fontWeight: "800",
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  uploadTriggerBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
    height: 42,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
    paddingVertical: 0,
  },
  categoryTrack: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  categoryChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgePdf: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  headerInfo: {
    flex: 1,
  },
  reportTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorName: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
    marginTop: 1,
  },
  specialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  notesBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  notesLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  notesContent: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  openBtn: {
    flex: 1,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.surface,
  },
  deleteIconBtn: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "88%",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    ...Typography.h3,
    fontWeight: "800",
    color: Palette.text,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  uploadErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  uploadErrorText: {
    ...Typography.caption,
    color: Palette.error,
    flex: 1,
  },
  modalBody: {
    gap: Spacing.md,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  textInput: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.bodySmall,
    color: Palette.text,
  },
  textAreaInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  noApptWarning: {
    ...Typography.caption,
    color: Palette.error,
    fontStyle: "italic",
  },
  apptSelectScroll: {
    marginHorizontal: -Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  apptSelectTile: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    marginRight: Spacing.sm,
  },
  apptSelectTileActive: {
    borderColor: Palette.primary,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  apptTileDoctor: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  apptTileDoctorActive: {
    color: Palette.primaryDark,
  },
  apptTileDate: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  apptTileDateActive: {
    color: Palette.primary,
  },
  categorySelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  catSelectPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  catSelectPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  catSelectText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  catSelectTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  submitUploadBtn: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
});
