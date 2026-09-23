/**
 * HealPoint — Doctor Follow-Up Management & Care Plan Center.
 *
 * Dedicated clinical dashboard for doctors to monitor patient follow-up adherence,
 * view pending review visits, inspect diagnostic recommendations, and navigate
 * seamlessly to patient consultation records.
 * Uses 100% authentic live backend data.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { RoleGuard } from "@/components/RoleGuard";
import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { formatDDMMYYYY } from "@/lib/format";
import { parseRecommendedTimeframe } from "@/lib/followup-intelligence";
import { getUserImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as consultationService from "@/services/consultations";
import type { DoctorConsultation } from "@/types";

type TabFilter = "all" | "pending" | "scheduled" | "completed";

interface DoctorFollowUpItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientImage?: string;
  visitDate: string;
  visitTime: string;
  diagnosis?: string;
  advice: string;
  timeframeText?: string;
  targetDate?: string;
  status: "pending" | "scheduled" | "completed";
  statusLabel: string;
  statusVariant: "warning" | "primary" | "success";
  consultationType: "video" | "clinic";
  consultation: DoctorConsultation;
}

export default function DoctorFollowUpsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const doctorId = user?._id || "";

  const [consultations, setConsultations] = useState<DoctorConsultation[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!doctorId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const res = await consultationService.getDoctorConsultations(doctorId);
        setConsultations(res.consultations || []);
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load patient care plans."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [doctorId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    loadData(true);
  };

  // Extract all follow-up care plans from the doctor's consultation history
  const followUpItems: DoctorFollowUpItem[] = useMemo(() => {
    const items: DoctorFollowUpItem[] = [];

    // Group consultations by patient to detect scheduled/completed follow-up visits
    const patientConsultationsMap = new Map<string, DoctorConsultation[]>();
    for (const c of consultations) {
      const pId = c.patient?._id ? String(c.patient._id) : "unknown";
      if (!patientConsultationsMap.has(pId)) {
        patientConsultationsMap.set(pId, []);
      }
      patientConsultationsMap.get(pId)!.push(c);
    }

    for (const c of consultations) {
      const advice = (c.followUpAdvice || "").trim();
      if (!advice) continue;

      const pId = c.patient?._id ? String(c.patient._id) : "unknown";
      const pName = c.patient?.name?.trim() || "Patient";
      const pPhone = c.patient?.phone;
      const pImage = c.patient?.image;

      const { timeframe, targetDate } = parseRecommendedTimeframe(
        advice,
        c.slotDate,
      );

      // Check if this patient has a subsequent appointment with this doctor
      const allForPatient = patientConsultationsMap.get(pId) || [];
      const subsequent = allForPatient.find(
        (other) =>
          other._id !== c._id &&
          other.createdAt &&
          c.createdAt &&
          new Date(other.createdAt).getTime() > new Date(c.createdAt).getTime(),
      );

      let status: "pending" | "scheduled" | "completed" = "pending";
      let statusLabel = "Patient Action Due";
      let statusVariant: "warning" | "primary" | "success" = "warning";

      if (subsequent) {
        if (subsequent.status === "completed") {
          status = "completed";
          statusLabel = "Follow-Up Completed";
          statusVariant = "success";
        } else {
          status = "scheduled";
          statusLabel = `Booked (${subsequent.slotDate || "Upcoming"})`;
          statusVariant = "primary";
        }
      }

      items.push({
        id: c._id,
        appointmentId: c.appointmentId || c._id,
        patientId: pId,
        patientName: pName,
        patientPhone: pPhone,
        patientImage: pImage,
        visitDate: c.slotDate || "",
        visitTime: c.slotTime || "",
        diagnosis: c.diagnosis,
        advice,
        timeframeText: timeframe,
        targetDate,
        status,
        statusLabel,
        statusVariant,
        consultationType: c.consultationType === "video" ? "video" : "clinic",
        consultation: c,
      });
    }

    return items;
  }, [consultations]);

  const filteredItems = useMemo(() => {
    let list = followUpItems;
    if (activeTab !== "all") {
      list = list.filter((item) => item.status === activeTab);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.patientName.toLowerCase().includes(q) ||
          (item.patientPhone && item.patientPhone.includes(q)) ||
          (item.diagnosis && item.diagnosis.toLowerCase().includes(q)) ||
          item.advice.toLowerCase().includes(q),
      );
    }
    return list;
  }, [followUpItems, activeTab, search]);

  const stats = useMemo(() => {
    const total = followUpItems.length;
    const pending = followUpItems.filter((f) => f.status === "pending").length;
    const scheduled = followUpItems.filter(
      (f) => f.status === "scheduled",
    ).length;
    const completed = followUpItems.filter(
      (f) => f.status === "completed",
    ).length;
    return { total, pending, scheduled, completed };
  }, [followUpItems]);

  const renderItem = ({ item }: { item: DoctorFollowUpItem }) => {
    const isDue = item.status === "pending";
    const isScheduled = item.status === "scheduled";
    const patientAvatar = getUserImage(item.patientImage);

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: patientAvatar }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{item.patientName}</Text>
            {item.patientPhone ? (
              <View style={styles.phoneRow}>
                <Ionicons
                  name="call-outline"
                  size={12}
                  color={Palette.textMuted}
                />
                <Text style={styles.phoneText}>{item.patientPhone}</Text>
              </View>
            ) : null}
            <Text style={styles.visitDateText}>
              Consultation: {formatDDMMYYYY(item.visitDate)}{" "}
              {item.visitTime ? `• ${item.visitTime}` : ""}
            </Text>
          </View>
          <Badge
            label={item.statusLabel}
            variant={item.statusVariant as BadgeVariant}
          />
        </View>

        {/* Diagnosis if available */}
        {item.diagnosis ? (
          <View style={styles.diagnosisRow}>
            <Ionicons name="medkit-outline" size={14} color={Palette.primary} />
            <Text style={styles.diagnosisText}>
              Diagnosis:{" "}
              <Text style={styles.diagnosisBold}>{item.diagnosis}</Text>
            </Text>
          </View>
        ) : null}

        {/* Clinical Advice */}
        <View
          style={[
            styles.adviceBox,
            isDue && styles.adviceBoxDue,
            isScheduled && styles.adviceBoxScheduled,
          ]}
        >
          <View style={styles.adviceHead}>
            <Ionicons
              name={isDue ? "time-outline" : "chatbubble-ellipses-outline"}
              size={14}
              color={isDue ? "#D97706" : Palette.primary}
            />
            <Text
              style={[
                styles.adviceHeadTitle,
                { color: isDue ? "#92400E" : Palette.primaryDark },
              ]}
            >
              Recommended Care Plan / Follow-Up Advice
            </Text>
          </View>
          <Text style={styles.adviceBody}>{item.advice}</Text>
          {item.timeframeText ? (
            <Text style={styles.timeframeNote}>
              Timeline: {item.timeframeText}{" "}
              {item.targetDate ? `(Target: ~${item.targetDate})` : ""}
            </Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <Button
            title="View Consultation"
            variant="outline"
            style={styles.actionBtn}
            onPress={() => router.push(`/consultation/${item.id}`)}
          />
          <Button
            title="Appointment Details"
            variant="secondary"
            style={styles.actionBtn}
            onPress={() => router.push(`/appointment/${item.appointmentId}`)}
          />
        </View>
      </Card>
    );
  };

  return (
    <RoleGuard allowedRoles={["doctor"]}>
      <AdminModuleScreen
        title="Follow-Up & Care Plans"
        subtitle="Patient adherence, scheduled reviews, and recovery tracking"
        allowedRoles={["doctor"]}
        loading={loading}
        loadingComponent={<Loading label="Loading patient care plans..." />}
        error={error}
        onRetry={() => loadData(false)}
      >
        {/* KPI stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Plans</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#D97706" }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>Action Due</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: "#059669" }]}>
              {stats.scheduled}
            </Text>
            <Text style={styles.statLabel}>Scheduled</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: Palette.textMuted }]}>
              {stats.completed}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient, phone, or diagnosis..."
            placeholderTextColor={Palette.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={Palette.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Tab Filter */}
        <View style={styles.tabRow}>
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Action Due" },
              { key: "scheduled", label: "Scheduled" },
              { key: "completed", label: "Completed" },
            ] as const
          ).map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[styles.tabItem, active && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* FlatList */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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
              title={
                activeTab === "pending"
                  ? "No Action Due"
                  : activeTab === "scheduled"
                    ? "No Scheduled Follow-Ups"
                    : "No Patient Follow-Ups"
              }
              message={
                activeTab === "pending"
                  ? "No patients are currently pending follow-up booking."
                  : "Care plan recommendations you provide during consultations will appear here to monitor patient recovery."
              }
            />
          }
        />
      </AdminModuleScreen>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    ...Typography.h3,
    color: Palette.primary,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.body,
    fontSize: 14,
    color: Palette.text,
    padding: 0,
  },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabItemActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  tabText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  tabTextActive: {
    color: Palette.primary,
    fontWeight: "600",
  },
  list: {
    paddingBottom: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.surfaceAlt,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  visitDateText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  diagnosisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  diagnosisText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  diagnosisBold: {
    fontWeight: "600",
    color: Palette.text,
  },
  adviceBox: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.border,
  },
  adviceBoxDue: {
    backgroundColor: "#FFFBEB",
    borderLeftColor: "#F59E0B",
  },
  adviceBoxScheduled: {
    backgroundColor: "#F0FDF4",
    borderLeftColor: "#10B981",
  },
  adviceHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  adviceHeadTitle: {
    ...Typography.caption,
    fontWeight: "700",
    fontSize: 12,
  },
  adviceBody: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.text,
    lineHeight: 18,
  },
  timeframeNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
