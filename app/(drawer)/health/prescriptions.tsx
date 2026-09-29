/**
 * HealPoint — Smart Medication & Prescription Reminder Center.
 *
 * Displays real digital prescriptions issued by doctors across all consultations
 * (both in-person clinic visits and video consultations) and personal medication
 * dose adherence reminders. Powered 100% by authentic backend data.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
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
import type {
  Appointment,
  AppointmentMedicineItem,
  MedicationReminder,
  MedicationRemindersResponse,
  TodayMedicationDose,
} from "@/types";

type ViewTab = "today" | "all";

interface ReminderModalTarget {
  appointmentId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
  doctorName: string;
  hospitalName: string;
}

const PRESET_TIMES = [
  { label: "Morning (08:00 AM)", time: "08:00 AM" },
  { label: "Afternoon (01:00 PM)", time: "01:00 PM" },
  { label: "Evening (06:00 PM)", time: "06:00 PM" },
  { label: "Bedtime (09:00 PM)", time: "09:00 PM" },
];

export default function PrescriptionsScreen() {
  const router = useRouter();
  const { memberId, tab } = useLocalSearchParams<{
    memberId?: string;
    tab?: string;
  }>();
  const { user } = useAuth();
  const userId = user?._id;

  const [activeTab, setActiveTab] = useState<ViewTab>(
    tab === "all" ? "all" : "today",
  );
  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    memberId || "all",
  );
  const [prescriptions, setPrescriptions] = useState<Appointment[]>([]);
  const [reminderData, setReminderData] =
    useState<MedicationRemindersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Action busy states
  const [actionBusyDoseId, setActionBusyDoseId] = useState<string | null>(null);

  // Set Reminder Modal State
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<ReminderModalTarget | null>(
    null,
  );
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["08:00 AM"]);
  const [customTimeInput, setCustomTimeInput] = useState("");
  const [frequencyType, setFrequencyType] = useState<
    "daily" | "twice_daily" | "thrice_daily" | "custom"
  >("daily");
  const [savingReminder, setSavingReminder] = useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const familyParam =
          familyMemberFilter === "all" ? undefined : familyMemberFilter;

        // Fetch prescriptions and reminders concurrently
        const [historyRes, remindersRes] = await Promise.all([
          appointmentService.getPatientMedicalHistory(familyMemberFilter),
          appointmentService.getPatientMedicationReminders({
            familyMemberId: familyParam,
          }),
        ]);

        setPrescriptions(historyRes.prescriptions || []);
        if (remindersRes && remindersRes.success) {
          setReminderData(remindersRes);
        }
      } catch (err) {
        setError(
          toErrorMessage(
            err,
            "Unable to load digital prescriptions and reminders.",
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [familyMemberFilter],
  );

  useScreenFocus(loadData);

  useEffect(() => {
    loadData();
  }, [userId, familyMemberFilter, loadData]);

  const onRefresh = () => {
    loadData(true);
  };

  // Map of active reminders by appointmentId + medicineName (normalized)
  const activeReminderMap = useMemo(() => {
    const map = new Set<string>();
    if (reminderData?.reminders) {
      for (const r of reminderData.reminders) {
        if (r.isActive) {
          map.add(
            `${String(r.appointmentId)}_${String(r.medicineName).toLowerCase()}`,
          );
        }
      }
    }
    return map;
  }, [reminderData?.reminders]);

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

  const nextPendingDose = useMemo(() => {
    if (!reminderData?.todayReminders) return null;
    return reminderData.todayReminders.find(
      (d) => d.status === "pending" || d.status === "snoozed",
    );
  }, [reminderData?.todayReminders]);

  // Handle Mark Taken / Skipped / Snoozed
  const handleDoseAction = async (
    dose: TodayMedicationDose,
    action: "taken" | "skipped" | "snoozed",
  ) => {
    const key = `${dose.reminderId}_${dose.scheduledTime}`;
    setActionBusyDoseId(key);
    try {
      await appointmentService.recordMedicationAction(dose.reminderId, {
        action,
        scheduledTime: dose.scheduledTime,
        scheduledDate: dose.scheduledDate,
        snoozeMinutes: action === "snoozed" ? 15 : undefined,
      });
      // Fast refresh
      await loadData(true);
    } catch (err) {
      Alert.alert(
        "Update Failed",
        toErrorMessage(err, "Could not update dose adherence."),
      );
    } finally {
      setActionBusyDoseId(null);
    }
  };

  // Handle Deactivate Reminder
  const handleDeactivateReminder = (reminder: MedicationReminder) => {
    Alert.alert(
      "Deactivate Reminder?",
      `Are you sure you want to stop reminders for ${reminder.medicineName}? You can reactivate them anytime from your prescription.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              await appointmentService.deleteMedicationReminder(reminder._id);
              await loadData(true);
            } catch (err) {
              Alert.alert(
                "Error",
                toErrorMessage(err, "Could not deactivate reminder."),
              );
            }
          },
        },
      ],
    );
  };

  // Open Set Reminder Modal
  const openSetReminderModal = (
    appointment: Appointment,
    med: AppointmentMedicineItem,
  ) => {
    const doctorObj =
      typeof appointment.doctorId === "object" && appointment.doctorId
        ? appointment.doctorId
        : null;
    const doctorName = formatDoctorName(
      doctorObj?.name || appointment.doctorName,
      "Doctor",
    );
    const hospitalName =
      typeof appointment.hospitalId === "object" && appointment.hospitalId?.name
        ? appointment.hospitalId.name
        : appointment.hospitalName || "HealPoint Hospital";

    setModalTarget({
      appointmentId: appointment._id,
      medicineName: med.name,
      dosage: med.dosage || "As directed",
      frequency: med.frequency || "Daily",
      duration: med.duration || "Course duration",
      timing: med.timing || "After food",
      instructions: med.instructions || "Follow doctor guidance",
      doctorName,
      hospitalName,
    });

    // Smart default times based on frequency
    const freq = (med.frequency || "").toLowerCase();
    if (freq.includes("twice") || freq.includes("2") || freq.includes("bd")) {
      setSelectedTimes(["08:00 AM", "08:00 PM"]);
      setFrequencyType("twice_daily");
    } else if (
      freq.includes("thrice") ||
      freq.includes("3") ||
      freq.includes("tds")
    ) {
      setSelectedTimes(["08:00 AM", "02:00 PM", "08:00 PM"]);
      setFrequencyType("thrice_daily");
    } else {
      setSelectedTimes(["08:00 AM"]);
      setFrequencyType("daily");
    }

    setCustomTimeInput("");
    setReminderModalVisible(true);
  };

  const togglePresetTime = (time: string) => {
    if (selectedTimes.includes(time)) {
      if (selectedTimes.length === 1) {
        Alert.alert("Time Required", "Please keep at least one reminder time.");
        return;
      }
      setSelectedTimes(selectedTimes.filter((t) => t !== time));
    } else {
      setSelectedTimes([...selectedTimes, time].sort());
    }
  };

  const addCustomTime = () => {
    const raw = customTimeInput.trim().toUpperCase();
    if (!raw) return;
    if (selectedTimes.includes(raw)) {
      setCustomTimeInput("");
      return;
    }
    setSelectedTimes([...selectedTimes, raw].sort());
    setCustomTimeInput("");
  };

  const removeSelectedTime = (time: string) => {
    if (selectedTimes.length === 1) {
      Alert.alert("Time Required", "Please keep at least one reminder time.");
      return;
    }
    setSelectedTimes(selectedTimes.filter((t) => t !== time));
  };

  const handleSaveReminder = async () => {
    if (!modalTarget) return;
    if (selectedTimes.length === 0) {
      Alert.alert(
        "Missing Times",
        "Please select at least one reminder schedule time.",
      );
      return;
    }

    setSavingReminder(true);
    try {
      await appointmentService.createMedicationReminder({
        appointmentId: modalTarget.appointmentId,
        medicineName: modalTarget.medicineName,
        reminderTimes: selectedTimes,
        frequencyType,
      });

      setReminderModalVisible(false);
      await loadData(true);
      Alert.alert(
        "Reminder Set",
        `Personal dose reminder scheduled for ${modalTarget.medicineName} at ${selectedTimes.join(", ")}.`,
      );
    } catch (err) {
      Alert.alert(
        "Setup Failed",
        toErrorMessage(err, "Could not schedule medication reminder."),
      );
    } finally {
      setSavingReminder(false);
    }
  };

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
                (m: AppointmentMedicineItem, idx: number) => {
                  const reminderKey = `${String(item._id)}_${String(m.name).toLowerCase()}`;
                  const hasReminder = activeReminderMap.has(reminderKey);

                  return (
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

                        {/* Reminder Status / Action for Medicine */}
                        <View style={styles.medReminderRow}>
                          {hasReminder ? (
                            <View style={styles.reminderActiveBadge}>
                              <Ionicons
                                name="alarm"
                                size={12}
                                color="#059669"
                              />
                              <Text style={styles.reminderActiveText}>
                                Reminder Active
                              </Text>
                            </View>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Set reminder for ${m.name}`}
                              style={styles.setReminderBtn}
                              onPress={() => openSetReminderModal(item, m)}
                            >
                              <Ionicons
                                name="alarm-outline"
                                size={12}
                                color={Palette.primary}
                              />
                              <Text style={styles.setReminderBtnText}>
                                Set Reminder
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                },
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

  const getDoseStatusBadgeVariant = (
    status: string,
  ): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "taken":
        return { variant: "success", label: "Taken" };
      case "skipped":
        return { variant: "neutral", label: "Skipped" };
      case "snoozed":
        return { variant: "warning", label: "Snoozed" };
      default:
        return { variant: "primary", label: "Pending" };
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton color={Palette.text} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Prescriptions & Reminders</Text>
            <Text style={styles.subtitle}>
              Verified Doctor Prescriptions & Dose Schedules
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh prescriptions and reminders"
            onPress={onRefresh}
            style={styles.headerActionBtn}
          >
            <Ionicons name="refresh" size={18} color={Palette.primary} />
          </Pressable>
        </View>

        {/* Quick Vault Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vaultBar}
        >
          <Pressable
            style={styles.vaultItem}
            onPress={() => router.push("/(drawer)/health-wallet" as never)}
          >
            <Ionicons name="wallet-outline" size={14} color={Palette.primary} />
            <Text style={styles.vaultItemText}>Health Wallet</Text>
          </Pressable>
          <Pressable
            style={styles.vaultItem}
            onPress={() => router.push("/health/timeline" as never)}
          >
            <Ionicons name="time-outline" size={14} color={Palette.primary} />
            <Text style={styles.vaultItemText}>Timeline</Text>
          </Pressable>
          <Pressable
            style={styles.vaultItem}
            onPress={() => router.push("/health/follow-ups" as never)}
          >
            <Ionicons
              name="refresh-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.vaultItemText}>Follow-Ups</Text>
          </Pressable>
          <Pressable
            style={styles.vaultItem}
            onPress={() => router.push("/health/records" as never)}
          >
            <Ionicons
              name="folder-open-outline"
              size={14}
              color={Palette.primary}
            />
            <Text style={styles.vaultItemText}>Records</Text>
          </Pressable>
        </ScrollView>

        {/* Segmented View Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Today's Reminders & Doses"
            style={[
              styles.tabButton,
              activeTab === "today" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("today")}
          >
            <Ionicons
              name="alarm"
              size={15}
              color={activeTab === "today" ? Palette.white : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "today" && styles.tabTextActive,
              ]}
            >
              Today's Schedule
            </Text>
            {reminderData?.stats?.todayPending &&
            reminderData.stats.todayPending > 0 ? (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "today" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "today" && styles.tabBadgeTextActive,
                  ]}
                >
                  {reminderData.stats.todayPending}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="All Doctor Prescriptions"
            style={[styles.tabButton, activeTab === "all" && styles.tabActive]}
            onPress={() => setActiveTab("all")}
          >
            <Ionicons
              name="document-text"
              size={15}
              color={activeTab === "all" ? Palette.white : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "all" && styles.tabTextActive,
              ]}
            >
              All Prescriptions
            </Text>
            {prescriptions.length > 0 ? (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "all" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "all" && styles.tabBadgeTextActive,
                  ]}
                >
                  {prescriptions.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Family Member Isolation Filter */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={setFamilyMemberFilter}
      />

      {loading && !refreshing ? (
        <Loading fullScreen label="Loading prescriptions & reminders..." />
      ) : error ? (
        <ErrorState
          title="Could Not Load Prescriptions"
          message={error}
          onRetry={() => loadData()}
        />
      ) : activeTab === "today" ? (
        /* TODAY'S SCHEDULE & REMINDERS VIEW */
        <ScrollView
          contentContainerStyle={styles.scheduleContent}
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
          {/* Adherence Stats Banner */}
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statVal}>
                  {reminderData?.stats?.activeReminders ?? 0}
                </Text>
                <Text style={styles.statLabel}>Active Meds</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statVal}>
                  {reminderData?.stats?.todayTotal ?? 0}
                </Text>
                <Text style={styles.statLabel}>Doses Today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: "#059669" }]}>
                  {reminderData?.stats?.todayTaken ?? 0}
                </Text>
                <Text style={styles.statLabel}>Taken</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statVal, { color: Palette.primary }]}>
                  {reminderData?.stats?.todayPending ?? 0}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </Card>

          {/* Next Dose Highlight Card */}
          {nextPendingDose ? (
            <Card style={styles.nextDoseCard}>
              <View style={styles.nextDoseHeader}>
                <View style={styles.nextDoseBadge}>
                  <Ionicons name="time" size={14} color={Palette.white} />
                  <Text style={styles.nextDoseBadgeText}>NEXT SCHEDULED</Text>
                </View>
                <Text style={styles.nextDoseTime}>
                  {nextPendingDose.scheduledTime}
                </Text>
              </View>
              <View style={styles.nextDoseBody}>
                <Text style={styles.nextDoseTitle}>
                  {nextPendingDose.medicineName}
                </Text>
                {nextPendingDose.dosage ? (
                  <Text style={styles.nextDoseDosage}>
                    {nextPendingDose.dosage}
                  </Text>
                ) : null}
                <Text style={styles.nextDoseDoctor}>
                  Prescribed by {nextPendingDose.doctorName}
                </Text>
                {nextPendingDose.timing || nextPendingDose.instructions ? (
                  <Text style={styles.nextDoseInstructions}>
                    {nextPendingDose.timing
                      ? `${nextPendingDose.timing} • `
                      : ""}
                    {nextPendingDose.instructions || "Take as directed"}
                  </Text>
                ) : null}
              </View>
              <View style={styles.nextDoseActions}>
                <Button
                  title="✓ Mark as Taken"
                  onPress={() => handleDoseAction(nextPendingDose, "taken")}
                  loading={
                    actionBusyDoseId ===
                    `${nextPendingDose.reminderId}_${nextPendingDose.scheduledTime}`
                  }
                  style={styles.takeNowBtn}
                />
              </View>
            </Card>
          ) : reminderData?.stats &&
            reminderData.stats.todayTotal > 0 &&
            reminderData.stats.todayPending === 0 ? (
            <Card style={styles.allTakenCard}>
              <Ionicons
                name="checkmark-circle-sharp"
                size={32}
                color="#059669"
              />
              <View style={styles.allTakenTextWrap}>
                <Text style={styles.allTakenTitle}>
                  All Caught Up for Today!
                </Text>
                <Text style={styles.allTakenSub}>
                  You have logged all scheduled medication doses. Keep up the
                  great health routine!
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Today's Dose List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Medication Doses</Text>
            <Text style={styles.sectionCount}>
              {reminderData?.todayReminders?.length ?? 0} Doses
            </Text>
          </View>

          {reminderData?.todayReminders &&
          reminderData.todayReminders.length > 0 ? (
            <View style={styles.dosesList}>
              {reminderData.todayReminders.map((dose, idx) => {
                const key = `${dose.reminderId}_${dose.scheduledTime}`;
                const isBusy = actionBusyDoseId === key;
                const statusMeta = getDoseStatusBadgeVariant(dose.status);

                return (
                  <Card key={`${key}_${idx}`} style={styles.doseCard}>
                    <View style={styles.doseTopRow}>
                      <View style={styles.doseTimeWrap}>
                        <Ionicons
                          name="alarm-outline"
                          size={16}
                          color={Palette.primary}
                        />
                        <Text style={styles.doseTime}>
                          {dose.scheduledTime}
                        </Text>
                      </View>
                      <Badge
                        label={statusMeta.label}
                        variant={statusMeta.variant}
                      />
                    </View>

                    <View style={styles.doseInfoWrap}>
                      <View style={styles.doseNameRow}>
                        <Text style={styles.doseMedicineName}>
                          {dose.medicineName}
                        </Text>
                        {dose.dosage ? (
                          <Text style={styles.doseDosage}>{dose.dosage}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.doseDoctorText}>
                        <Ionicons
                          name="person-outline"
                          size={12}
                          color={Palette.textMuted}
                        />{" "}
                        {dose.doctorName} • {dose.hospitalName}
                      </Text>
                      {dose.timing || dose.instructions ? (
                        <Text style={styles.doseTimingText}>
                          {dose.timing ? `${dose.timing} — ` : ""}
                          {dose.instructions}
                        </Text>
                      ) : null}
                      {dose.patientName && dose.familyMemberId ? (
                        <View style={styles.dependentTag}>
                          <Ionicons
                            name="people"
                            size={10}
                            color={Palette.primaryDark}
                          />
                          <Text style={styles.dependentTagText}>
                            Patient: {dose.patientName}{" "}
                            {dose.patientRelationship
                              ? `(${dose.patientRelationship})`
                              : ""}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Dose Actions Row */}
                    {dose.status === "pending" || dose.status === "snoozed" ? (
                      <View style={styles.doseActionRow}>
                        <Button
                          title="✓ Taken"
                          variant="primary"
                          onPress={() => handleDoseAction(dose, "taken")}
                          loading={isBusy}
                          style={styles.doseActionBtn}
                        />
                        <Button
                          title="⏰ Snooze +15m"
                          variant="outline"
                          onPress={() => handleDoseAction(dose, "snoozed")}
                          loading={isBusy}
                          style={styles.doseActionBtn}
                        />
                        <Button
                          title="Skip"
                          variant="ghost"
                          onPress={() => handleDoseAction(dose, "skipped")}
                          loading={isBusy}
                          style={styles.doseActionBtnGhost}
                        />
                      </View>
                    ) : dose.status === "taken" ? (
                      <View style={styles.doseDoneRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#059669"
                        />
                        <Text style={styles.doseDoneText}>
                          Logged as taken
                          {dose.actionTime ? ` at ${dose.actionTime}` : ""}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.doseDoneRow}>
                        <Ionicons
                          name="close-circle-outline"
                          size={14}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.doseSkippedText}>Dose skipped</Text>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState
              title="No Medication Doses for Today"
              message="You have no active prescription reminders scheduled for today. You can activate reminders for any prescribed medication from your verified prescriptions."
              action={
                <Button
                  title="View Prescriptions to Set Reminders"
                  onPress={() => setActiveTab("all")}
                />
              }
            />
          )}

          {/* Active Configured Reminders Section */}
          {reminderData?.reminders && reminderData.reminders.length > 0 ? (
            <View style={styles.activeRemindersSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Active Reminder Schedules
                </Text>
                <Text style={styles.sectionCount}>
                  {reminderData.reminders.length} Active
                </Text>
              </View>

              {reminderData.reminders.map((rem) => (
                <Card key={rem._id} style={styles.activeRuleCard}>
                  <View style={styles.activeRuleTop}>
                    <View style={styles.activeRuleTitleWrap}>
                      <Text style={styles.activeRuleName}>
                        {rem.medicineName}
                      </Text>
                      {rem.dosage ? (
                        <Text style={styles.activeRuleDosage}>
                          {rem.dosage}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Deactivate reminder"
                      onPress={() => handleDeactivateReminder(rem)}
                      style={styles.deactivateBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color="#DC2626"
                      />
                      <Text style={styles.deactivateBtnText}>Deactivate</Text>
                    </Pressable>
                  </View>

                  <View style={styles.timesWrap}>
                    {rem.reminderTimes.map((t, idx) => (
                      <View key={idx} style={styles.timeTag}>
                        <Ionicons
                          name="time-outline"
                          size={11}
                          color={Palette.primary}
                        />
                        <Text style={styles.timeTagText}>{t}</Text>
                      </View>
                    ))}
                    <Text style={styles.freqTag}>
                      {rem.frequencyType.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.activeRuleDoctor}>
                    Prescribed by {rem.doctorName} • {rem.hospitalName}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        /* ALL PRESCRIPTIONS VIEW */
        <View style={styles.allTabWrap}>
          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Palette.textMuted} />
            <TextInput
              placeholder="Search doctor, medication, or diagnosis..."
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
        </View>
      )}

      {/* SET MEDICATION REMINDER MODAL */}
      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="alarm" size={20} color={Palette.primary} />
                <Text style={styles.modalTitle}>Set Medication Reminder</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close reminder dialog"
                onPress={() => setReminderModalVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {modalTarget ? (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Read-Only Verified Prescribed Details */}
                <View style={styles.prescribedInfoBox}>
                  <Text style={styles.prescribedBadge}>
                    AUTHORITATIVE DOCTOR PRESCRIPTION
                  </Text>
                  <Text style={styles.prescribedMedName}>
                    {modalTarget.medicineName}
                  </Text>
                  <Text style={styles.prescribedDosage}>
                    Dosage: {modalTarget.dosage}
                  </Text>
                  <View style={styles.prescribedMetaRow}>
                    <Text style={styles.prescribedMeta}>
                      Frequency: {modalTarget.frequency}
                    </Text>
                    <Text style={styles.prescribedMeta}>
                      Timing: {modalTarget.timing}
                    </Text>
                  </View>
                  <Text style={styles.prescribedDoctor}>
                    Dr. {modalTarget.doctorName} • {modalTarget.hospitalName}
                  </Text>
                  {modalTarget.instructions ? (
                    <Text style={styles.prescribedInstructions}>
                      Note: {modalTarget.instructions}
                    </Text>
                  ) : null}
                </View>

                {/* Schedule Daily Times */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Daily Reminder Times
                  </Text>
                  <Text style={styles.modalSectionSub}>
                    Select preferred alert times for taking this dose:
                  </Text>

                  <View style={styles.presetsGrid}>
                    {PRESET_TIMES.map((preset) => {
                      const isSelected = selectedTimes.includes(preset.time);
                      return (
                        <Pressable
                          key={preset.time}
                          style={[
                            styles.presetChip,
                            isSelected && styles.presetChipActive,
                          ]}
                          onPress={() => togglePresetTime(preset.time)}
                        >
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={14}
                            color={
                              isSelected ? Palette.primary : Palette.textMuted
                            }
                          />
                          <Text
                            style={[
                              styles.presetChipText,
                              isSelected && styles.presetChipTextActive,
                            ]}
                          >
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Custom Time Input */}
                  <View style={styles.customTimeRow}>
                    <TextInput
                      placeholder="Or enter custom time (e.g. 10:30 AM)"
                      placeholderTextColor={Palette.textMuted}
                      value={customTimeInput}
                      onChangeText={setCustomTimeInput}
                      style={styles.customTimeInput}
                    />
                    <Button
                      title="Add"
                      variant="outline"
                      onPress={addCustomTime}
                      style={styles.addCustomTimeBtn}
                    />
                  </View>

                  {/* Active Selected Times Display */}
                  <View style={styles.selectedTimesWrap}>
                    <Text style={styles.selectedTimesLabel}>
                      Selected Alert Times ({selectedTimes.length}):
                    </Text>
                    <View style={styles.selectedChipsList}>
                      {selectedTimes.map((time) => (
                        <View key={time} style={styles.selectedTimeChip}>
                          <Text style={styles.selectedTimeChipText}>
                            {time}
                          </Text>
                          <Pressable
                            onPress={() => removeSelectedTime(time)}
                            hitSlop={6}
                          >
                            <Ionicons
                              name="close-circle"
                              size={14}
                              color={Palette.primaryDark}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Frequency Selector */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Repeat Pattern</Text>
                  <View style={styles.freqRow}>
                    {(
                      [
                        { key: "daily", label: "Once Daily" },
                        { key: "twice_daily", label: "Twice Daily" },
                        { key: "thrice_daily", label: "Thrice Daily" },
                        { key: "custom", label: "Custom" },
                      ] as const
                    ).map((f) => (
                      <Pressable
                        key={f.key}
                        style={[
                          styles.freqOption,
                          frequencyType === f.key && styles.freqOptionActive,
                        ]}
                        onPress={() => setFrequencyType(f.key)}
                      >
                        <Text
                          style={[
                            styles.freqOptionText,
                            frequencyType === f.key &&
                              styles.freqOptionTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Safety & Compliance Disclaimer */}
                <View style={styles.safetyBox}>
                  <Ionicons name="shield-checkmark" size={16} color="#059669" />
                  <Text style={styles.safetyText}>
                    HealPoint Medication Reminders assist with your personal
                    schedule adherence. Dosages and prescription records remain
                    strictly unaltered as verified by your physician.
                  </Text>
                </View>
              </ScrollView>
            ) : null}

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setReminderModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Schedule Reminder"
                onPress={handleSaveReminder}
                loading={savingReminder}
                disabled={selectedTimes.length === 0}
                style={styles.modalBtn}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
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
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "800",
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  vaultBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  vaultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  vaultItemText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.text,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Palette.background,
    borderRadius: Radius.lg,
    padding: 3,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Palette.primary,
    ...Shadows.sm,
  },
  tabText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.white,
    fontWeight: "800",
  },
  tabBadge: {
    backgroundColor: Palette.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
  },
  tabBadgeTextActive: {
    color: Palette.white,
  },
  scheduleContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  statsCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statCol: {
    alignItems: "center",
    gap: 2,
  },
  statVal: {
    ...Typography.h3,
    fontWeight: "900",
    color: Palette.text,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Palette.border,
  },
  nextDoseCard: {
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    borderColor: "rgba(14, 159, 142, 0.3)",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  nextDoseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextDoseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  nextDoseBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.5,
  },
  nextDoseTime: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  nextDoseBody: {
    gap: 2,
  },
  nextDoseTitle: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  nextDoseDosage: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  nextDoseDoctor: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  nextDoseInstructions: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.text,
  },
  nextDoseActions: {
    marginTop: Spacing.xs,
  },
  takeNowBtn: {
    width: "100%",
  },
  allTakenCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderColor: "rgba(5, 150, 105, 0.2)",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  allTakenTextWrap: {
    flex: 1,
    gap: 2,
  },
  allTakenTitle: {
    ...Typography.body,
    fontWeight: "800",
    color: "#059669",
  },
  allTakenSub: {
    ...Typography.caption,
    color: Palette.text,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
  },
  sectionCount: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  dosesList: {
    gap: Spacing.sm,
  },
  doseCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  doseTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doseTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doseTime: {
    ...Typography.bodySmall,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  doseInfoWrap: {
    gap: 3,
  },
  doseNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doseMedicineName: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
  },
  doseDosage: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  doseDoctorText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doseTimingText: {
    ...Typography.caption,
    color: Palette.text,
  },
  dependentTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  dependentTagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  doseActionRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  doseActionBtn: {
    flex: 1,
  },
  doseActionBtnGhost: {
    minWidth: 60,
  },
  doseDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  doseDoneText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#059669",
  },
  doseSkippedText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  activeRemindersSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  activeRuleCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: 6,
  },
  activeRuleTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  activeRuleTitleWrap: {
    flex: 1,
  },
  activeRuleName: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
  },
  activeRuleDosage: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  deactivateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
  },
  deactivateBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  timesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  timeTagText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  freqTag: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    backgroundColor: Palette.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  activeRuleDoctor: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  allTabWrap: {
    flex: 1,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    height: 42,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: "800",
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
    color: Palette.text,
    fontWeight: "600",
  },
  diagnosisBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
    gap: 2,
  },
  sectionHeading: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
    letterSpacing: 0.5,
  },
  diagnosisText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  rxContainer: {
    gap: Spacing.sm,
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
    fontWeight: "800",
    color: Palette.text,
  },
  rxCountBadge: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  medicinesList: {
    gap: Spacing.sm,
  },
  medicineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  medIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  medIndexText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  medItemBody: {
    flex: 1,
    gap: 3,
  },
  medItemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  medItemName: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
  },
  medItemDosage: {
    ...Typography.bodySmall,
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
    fontSize: 11,
    color: Palette.textMuted,
    backgroundColor: Palette.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  medItemInstructions: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.text,
    marginTop: 2,
  },
  medReminderRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  reminderActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(5, 150, 105, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  reminderActiveText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  setReminderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  setReminderBtnText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 20, 18, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "88%",
    paddingBottom: Spacing.xl,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  prescribedInfoBox: {
    backgroundColor: "rgba(14, 159, 142, 0.05)",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
    gap: 3,
  },
  prescribedBadge: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: "900",
    color: Palette.primaryDark,
    letterSpacing: 0.6,
  },
  prescribedMedName: {
    ...Typography.h4,
    fontWeight: "800",
    color: Palette.text,
    marginTop: 2,
  },
  prescribedDosage: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  prescribedMetaRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: 2,
  },
  prescribedMeta: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  prescribedDoctor: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  prescribedInstructions: {
    ...Typography.caption,
    fontStyle: "italic",
    color: Palette.text,
    marginTop: 2,
  },
  modalSection: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  modalSectionTitle: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
  },
  modalSectionSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  presetChipActive: {
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    borderColor: Palette.primary,
  },
  presetChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  presetChipTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  customTimeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  customTimeInput: {
    flex: 1,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Typography.bodySmall,
    color: Palette.text,
  },
  addCustomTimeBtn: {
    paddingHorizontal: Spacing.md,
  },
  selectedTimesWrap: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  selectedTimesLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  selectedChipsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  selectedTimeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  selectedTimeChipText: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  freqRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  freqOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  freqOptionActive: {
    backgroundColor: Palette.primaryDark,
    borderColor: Palette.primaryDark,
  },
  freqOptionText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  freqOptionTextActive: {
    color: Palette.white,
  },
  safetyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  safetyText: {
    flex: 1,
    ...Typography.caption,
    fontSize: 11,
    color: Palette.text,
    lineHeight: 16,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  modalBtn: {
    flex: 1,
  },
});
