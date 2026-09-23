/**
 * HealPoint - Patient Prescriptions.
 *
 * Displays real digital prescriptions issued by doctors across all consultations
 * (both in-person clinic visits and video consultations). Powered by real backend data.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
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
import type { Appointment, AppointmentMedicineItem } from "@/types";

export default function PrescriptionsScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    memberId || "all",
  );
  const [prescriptions, setPrescriptions] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadPrescriptions = async () => {
    setError("");
    try {
      const history =
        await appointmentService.getPatientMedicalHistory(familyMemberFilter);
      setPrescriptions(history.prescriptions || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load digital prescriptions."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useScreenFocus(loadPrescriptions);

  useEffect(() => {
    loadPrescriptions();
  }, [userId, familyMemberFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPrescriptions();
  };

  const filteredPrescriptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prescriptions;
    return prescriptions.filter((p) => {
      const docName =
        typeof p.doctorId === "object" && p.doctorId?.name
          ? p.doctorId.name.toLowerCase()
          : (p.doctorName || "").toLowerCase();
      const diag = (p.diagnosis || "").toLowerCase();
      const hosp =
        typeof p.hospitalId === "object" && p.hospitalId?.name
          ? p.hospitalId.name.toLowerCase()
          : (p.hospitalName || "").toLowerCase();
      const meds = (p.medicines || [])
        .map((m) => m.name.toLowerCase())
        .join(" ");
      return (
        docName.includes(q) ||
        diag.includes(q) ||
        hosp.includes(q) ||
        meds.includes(q)
      );
    });
  }, [prescriptions, search]);

  const handleSharePrescription = async (item: Appointment) => {
    try {
      const docName = formatDoctorName(
        typeof item.doctorId === "object" && item.doctorId?.name
          ? item.doctorId.name
          : item.doctorName,
        "Consultant",
      );
      const hospName =
        typeof item.hospitalId === "object" && item.hospitalId?.name
          ? item.hospitalId.name
          : item.hospitalName || "HealPoint Clinic";

      const lines: string[] = [
        `==============================`,
        `HEALPOINT DIGITAL PRESCRIPTION`,
        `==============================`,
        `Doctor: ${docName}`,
        `Hospital: ${hospName}`,
        `Date: ${formatDDMMYYYY(item.slotDate || item.date || "")}`,
        `Patient: ${user?.name || "Patient"}`,
      ];

      if (item.diagnosis) {
        lines.push(`Diagnosis: ${item.diagnosis}`);
      }

      lines.push(`\nMEDICATIONS:`);
      if (item.medicines && item.medicines.length > 0) {
        item.medicines.forEach((m: AppointmentMedicineItem, idx: number) => {
          let medLine = `${idx + 1}. ${m.name}`;
          if (m.dosage) medLine += ` (${m.dosage})`;
          if (m.frequency) medLine += ` — ${m.frequency}`;
          if (m.duration) medLine += ` for ${m.duration}`;
          if (m.timing) medLine += ` [${m.timing}]`;
          if (m.instructions) medLine += `\n   Note: ${m.instructions}`;
          lines.push(medLine);
        });
      } else if (item.prescription) {
        lines.push(item.prescription);
      }

      if (item.followUpAdvice) {
        lines.push(`\nFOLLOW-UP ADVICE:`);
        lines.push(item.followUpAdvice);
      }

      lines.push(`\nVerified digital prescription via HealPoint Healthcare.`);

      await Share.share({
        message: lines.join("\n"),
        title: `Prescription - ${docName}`,
      });
    } catch {
      // User cancelled share
    }
  };

  const renderPrescriptionItem = ({ item }: { item: Appointment }) => {
    const doctorObj =
      typeof item.doctorId === "object" && item.doctorId ? item.doctorId : null;
    const doctorName = formatDoctorName(
      doctorObj?.name || item.doctorName,
      "Doctor",
    );
    const doctorSpecialty =
      doctorObj?.speciality ||
      doctorObj?.department ||
      item.doctorSpecialty ||
      "Medical Specialist";
    const hospitalName =
      typeof item.hospitalId === "object" && item.hospitalId?.name
        ? item.hospitalId.name
        : item.hospitalName || "HealPoint Hospital";

    const hasMedicines =
      Array.isArray(item.medicines) && item.medicines.length > 0;
    const hasPrescriptionText = Boolean(item.prescription?.trim());
    const hasDiagnosis = Boolean(item.diagnosis?.trim());

    return (
      <Card style={styles.card}>
        {/* Doctor Header */}
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: doctorObj?.image || undefined }}
            style={styles.doctorAvatar}
            contentFit="cover"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {doctorName}
            </Text>
            <Text style={styles.specialty} numberOfLines={1}>
              {doctorSpecialty}
            </Text>
            <Text style={styles.hospital} numberOfLines={1}>
              <Ionicons name="business" size={12} color={Palette.textMuted} />{" "}
              {hospitalName}
            </Text>
          </View>
          <Badge label="Verified Rx" variant="success" />
        </View>

        <View style={styles.divider} />

        {/* Date & Mode info */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.metaText}>
              {formatDDMMYYYY(item.slotDate || item.date || "")}
            </Text>
          </View>
          {item.slotTime ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={Palette.primary} />
              <Text style={styles.metaText}>{item.slotTime}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons
              name={
                item.consultationType === "video"
                  ? "videocam-outline"
                  : "business-outline"
              }
              size={14}
              color={Palette.textMuted}
            />
            <Text style={styles.metaText}>
              {item.consultationType === "video"
                ? "Online Consultation"
                : "In-Person Visit"}
            </Text>
          </View>
        </View>

        {/* Clinical Diagnosis Pill */}
        {hasDiagnosis ? (
          <View style={styles.diagnosisBox}>
            <Text style={styles.sectionHeading}>CLINICAL DIAGNOSIS</Text>
            <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
          </View>
        ) : null}

        {/* Prescribed Medications */}
        <View style={styles.rxContainer}>
          <View style={styles.rxHeader}>
            <View style={styles.rxBadge}>
              <Ionicons name="medical" size={14} color={Palette.primary} />
              <Text style={styles.rxBadgeText}>Prescribed Medications</Text>
            </View>
            {hasMedicines ? (
              <Text style={styles.rxCountBadge}>
                {item.medicines!.length} Item
                {item.medicines!.length === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>

          {hasMedicines ? (
            <View style={styles.medicinesList}>
              {item.medicines!.map(
                (m: AppointmentMedicineItem, idx: number) => (
                  <View key={idx} style={styles.medicineItem}>
                    <View style={styles.medIndexCircle}>
                      <Text style={styles.medIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.medItemBody}>
                      <View style={styles.medItemTopRow}>
                        <Text style={styles.medItemName}>{m.name}</Text>
                        {m.dosage ? (
                          <Text style={styles.medItemDosage}>{m.dosage}</Text>
                        ) : null}
                      </View>
                      <View style={styles.medItemDetailsRow}>
                        {m.frequency ? (
                          <Text style={styles.medTag}>{m.frequency}</Text>
                        ) : null}
                        {m.duration ? (
                          <Text style={styles.medTag}>
                            Duration: {m.duration}
                          </Text>
                        ) : null}
                        {m.timing ? (
                          <Text style={styles.medTag}>{m.timing}</Text>
                        ) : null}
                      </View>
                      {m.instructions ? (
                        <Text style={styles.medItemInstructions}>
                          Note: {m.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ),
              )}
            </View>
          ) : hasPrescriptionText ? (
            <Text style={styles.rxContent}>{item.prescription}</Text>
          ) : (
            <Text style={styles.rxContentEmpty}>
              Clinical consultation recorded. Follow instructions provided by
              your doctor.
            </Text>
          )}
        </View>

        {/* Follow-up advice */}
        {item.followUpAdvice ? (
          <View style={styles.adviceBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={Palette.accent}
            />
            <View style={styles.adviceContent}>
              <Text style={styles.adviceHeading}>Follow-up Advice</Text>
              <Text style={styles.adviceText}>{item.followUpAdvice}</Text>
            </View>
          </View>
        ) : null}

        {/* Doctor Signature verification badge */}
        <View style={styles.verifiedRow}>
          <Ionicons name="checkmark-circle" size={14} color="#059669" />
          <Text style={styles.verifiedText}>
            Digitally certified by {doctorName} via HealPoint EMR
          </Text>
        </View>

        {/* Actions Row */}
        <View style={styles.actionRow}>
          <Button
            title="View Details"
            variant="outline"
            style={styles.detailBtn}
            onPress={() =>
              router.push({
                pathname: "/appointment/[id]",
                params: { id: item._id },
              })
            }
          />
          <Button
            title="Share Rx"
            onPress={() => handleSharePrescription(item)}
            style={styles.shareBtn}
          />
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
            <Text style={styles.title}>Prescriptions</Text>
            <Text style={styles.subtitle}>
              Digital Doctor Prescriptions & Meds
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh prescriptions"
            onPress={onRefresh}
            style={styles.headerActionBtn}
          >
            <Ionicons name="refresh" size={18} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Palette.textMuted} />
          <TextInput
            placeholder="Search by doctor, medication, or diagnosis..."
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
      </View>

      {/* Family Member Isolation Filter */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={setFamilyMemberFilter}
      />

      {loading && !refreshing ? (
        <Loading fullScreen label="Loading verified prescriptions..." />
      ) : error ? (
        <ErrorState
          title="Could Not Load Prescriptions"
          message={error}
          onRetry={loadPrescriptions}
        />
      ) : (
        <FlatList
          data={filteredPrescriptions}
          keyExtractor={(item) => item._id}
          renderItem={renderPrescriptionItem}
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
              title={search ? "No Matches Found" : "No Prescriptions Yet"}
              message={
                search
                  ? `No prescriptions match "${search}". Try searching for another doctor or medication.`
                  : "When your doctor writes a digital prescription during a clinic or video consultation, it will appear here automatically."
              }
              action={
                <Button
                  title={search ? "Clear Search" : "Book Doctor Visit"}
                  onPress={() => {
                    if (search) setSearch("");
                    else router.push("/doctors");
                  }}
                />
              }
            />
          }
        />
      )}
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
    gap: Spacing.md,
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
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
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
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
    paddingVertical: 0,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
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
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.border,
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
  },
  specialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.md,
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
  diagnosisBox: {
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  diagnosisText: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  rxContainer: {
    backgroundColor: "rgba(14, 159, 142, 0.04)",
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.12)",
  },
  rxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rxBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rxBadgeText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  rxCountBadge: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  medicinesList: {
    gap: Spacing.sm,
    marginTop: 4,
  },
  medicineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  medIndexCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  medIndexText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  medItemBody: {
    flex: 1,
    gap: 2,
  },
  medItemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  medItemName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  medItemDosage: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  medItemDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  medTag: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    backgroundColor: Palette.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  medItemInstructions: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.textMuted,
    marginTop: 2,
  },
  rxContent: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 19,
  },
  rxContentEmpty: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  adviceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  adviceContent: {
    flex: 1,
  },
  adviceHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.accent,
    marginBottom: 2,
  },
  adviceText: {
    ...Typography.caption,
    color: Palette.text,
    lineHeight: 16,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  verifiedText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  detailBtn: {
    flex: 1,
  },
  shareBtn: {
    flex: 1,
  },
});
