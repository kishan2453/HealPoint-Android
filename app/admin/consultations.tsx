/**
 * HealPoint - Hospital Admin · Online Consultations.
 *
 * Dedicated route (/admin/consultations) for monitoring Google Meet online
 * consultations, active video doctors, consultation revenue, and live consultation
 * meeting rooms strictly scoped to the authenticated admin's hospital.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  appointmentDoctorName,
  appointmentPatientName,
  appointmentReference,
} from "@/lib/appointments";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { openGoogleMeetUrl } from "@/lib/meet";
import * as adminService from "@/services/admin";
import { toErrorMessage } from "@/services/api";
import * as consultationService from "@/services/consultations";
import type { Appointment, HospitalConsultationStats } from "@/types";

export default function AdminConsultationsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<HospitalConsultationStats | null>(null);
  const [videoAppointments, setVideoAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    try {
      const [statsRes, apptsRes] = await Promise.all([
        consultationService.getHospitalConsultationStats().catch(() => null),
        adminService.getHospitalAdminAppointments({
          dateFilter: "today",
          limit: 100,
        }),
      ]);

      if (statsRes) setStats(statsRes);
      const videoList = (apptsRes.appointments || []).filter(
        (a) => a.consultationType === "video",
      );
      setVideoAppointments(videoList);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load consultation operations."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData(true);
  }, [loadData]);

  const s = stats?.stats;

  return (
    <AdminModuleScreen
      title="Online Consultations"
      subtitle="Monitor live Google Meet sessions & telemedicine staff"
      allowedRoles={["admin", "super_admin"]}
      loading={loading}
      error={error}
      onRetry={() => loadData(false)}
    >
      <FlatList
        data={videoAppointments}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* KPI STATS */}
            <View style={styles.kpiGrid}>
              <StatCard
                label="Today's Video"
                value={videoAppointments.length}
                icon="videocam-outline"
                accent="#7B61FF"
              />
              <StatCard
                label="Online Doctors"
                value={s?.activeOnlineDoctors ?? 0}
                icon="medkit-outline"
                accent="#0E9F8E"
              />
              <StatCard
                label="Total Consultations"
                value={s?.total ?? 0}
                icon="chatbubbles-outline"
                accent="#2F80ED"
              />
              <StatCard
                label="Revenue"
                value={formatINR(s?.revenue ?? 0)}
                icon="cash-outline"
                accent="#E89A3C"
              />
            </View>

            <View style={styles.subHeadingRow}>
              <Text style={styles.subHeading}>
                Scheduled Video Visits Today
              </Text>
              <Text style={styles.subHeadingCount}>
                ({videoAppointments.length})
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No Video Consultations Today"
            message="There are no online video appointments scheduled for today."
          />
        }
        renderItem={({ item }) => {
          const pName = appointmentPatientName(item);
          const dName = formatDoctorName(appointmentDoctorName(item));
          const hasMeet = Boolean(item.meetingUrl);

          return (
            <Card padded style={styles.consultCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.videoIconCircle}>
                    <Ionicons name="videocam" size={18} color="#7C3AED" />
                  </View>
                  <View>
                    <Text style={styles.refText}>
                      {appointmentReference(item)}
                    </Text>
                    <Text style={styles.slotTimeText}>
                      {formatDDMMYYYY(item.slotDate)} ·{" "}
                      {item.slotTime || "Scheduled"}
                    </Text>
                  </View>
                </View>
                <Badge
                  label={
                    item.meetingStatus === "ready" ||
                    item.meetingStatus === "started"
                      ? "Room Ready"
                      : (item.status || "Scheduled").toUpperCase()
                  }
                  variant={
                    item.meetingStatus === "ready" ||
                    item.meetingStatus === "started"
                      ? "success"
                      : "neutral"
                  }
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.peopleRow}>
                <View style={styles.personCol}>
                  <Text style={styles.microLabel}>PATIENT</Text>
                  <Text style={styles.personName} numberOfLines={1}>
                    {pName}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {item.patientPhone || "No contact"}
                  </Text>
                </View>

                <View style={styles.personCol}>
                  <Text style={styles.microLabel}>DOCTOR</Text>
                  <Text style={styles.personName} numberOfLines={1}>
                    {dName}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {item.doctorSpecialty || "Specialist"}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                {hasMeet ? (
                  <Button
                    title="Launch Google Meet"
                    icon="videocam-outline"
                    variant="primary"
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (item.meetingUrl) {
                        openGoogleMeetUrl(item.meetingUrl);
                      }
                    }}
                  />
                ) : null}
                <Button
                  title="View Details"
                  variant="outline"
                  style={hasMeet ? { flex: 1 } : { width: "100%" }}
                  onPress={() => {
                    router.push({
                      pathname: "/admin/appointments",
                    });
                  }}
                />
              </View>
            </Card>
          );
        }}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerBlock: {
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  subHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  subHeading: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  subHeadingCount: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  consultCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  videoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  refText: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  slotTimeText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
  },
  peopleRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  personCol: {
    flex: 1,
    gap: 2,
  },
  microLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  personName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  personSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 4,
  },
});
