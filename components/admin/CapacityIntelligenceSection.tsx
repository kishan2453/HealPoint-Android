/**
 * HealPoint — Smart Hospital Capacity & Resource Intelligence Section.
 *
 * Provides real-time capacity vs demand intelligence, department operational load,
 * doctor availability, and multi-range appointment demand charts.
 * 100% powered by real backend appointment and doctor data.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnalyticsBar } from "@/components/admin/AnalyticsBar";
import { TrendBars } from "@/components/admin/TrendBars";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDoctorName } from "@/lib/format";
import { useResponsiveVariant } from "@/lib/responsive";
import type {
  Appointment,
  Doctor,
  HospitalDepartment,
  HospitalConsultationStats,
} from "@/types";
import {
  computeAppointmentDemand,
  computeCapacityUtilization,
  computeDepartmentLoads,
  computeDoctorAvailabilityIntelligence,
  computeHospitalCapacityOverview,
  type DepartmentLoadItem,
  type DoctorAvailabilityIntelligenceItem,
} from "@/lib/capacity-intelligence";

interface CapacityIntelligenceSectionProps {
  todayAppointments: Appointment[];
  upcomingAppointments: Appointment[];
  doctors: Doctor[];
  departments: HospitalDepartment[];
  consultationStats?: HospitalConsultationStats | null;
}

export function CapacityIntelligenceSection({
  todayAppointments,
  upcomingAppointments,
  doctors,
  departments,
  consultationStats,
}: CapacityIntelligenceSectionProps) {
  const responsive = useResponsiveVariant();
  const isDesktop = responsive === "desktop";
  const isTablet = responsive === "tablet";

  const [demandRange, setDemandRange] = useState<
    "today" | "next_7_days" | "month"
  >("next_7_days");
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "departments" | "doctors" | "demand"
  >("overview");

  // All appointments combined for multi-day demand view
  const allAppointments = useMemo(() => {
    const existingIds = new Set(todayAppointments.map((a) => String(a._id)));
    const uniqueUpcoming = upcomingAppointments.filter(
      (a) => !existingIds.has(String(a._id)),
    );
    return [...todayAppointments, ...uniqueUpcoming];
  }, [todayAppointments, upcomingAppointments]);

  // Capacity overview
  const capacityOverview = useMemo(
    () =>
      computeHospitalCapacityOverview(
        todayAppointments,
        upcomingAppointments,
        doctors,
        consultationStats,
      ),
    [todayAppointments, upcomingAppointments, doctors, consultationStats],
  );

  // Department loads
  const departmentLoads: DepartmentLoadItem[] = useMemo(
    () =>
      computeDepartmentLoads(
        departments,
        todayAppointments,
        upcomingAppointments,
        doctors,
      ),
    [departments, todayAppointments, upcomingAppointments, doctors],
  );

  // Doctor availability intelligence
  const doctorAvailabilityList: DoctorAvailabilityIntelligenceItem[] = useMemo(
    () =>
      computeDoctorAvailabilityIntelligence(
        doctors,
        todayAppointments,
        upcomingAppointments,
      ),
    [doctors, todayAppointments, upcomingAppointments],
  );

  // Capacity vs Demand utilization
  const capacityUtilization = useMemo(
    () => computeCapacityUtilization(todayAppointments, doctors),
    [todayAppointments, doctors],
  );

  // Appointment demand aggregation
  const demandData = useMemo(
    () => computeAppointmentDemand(allAppointments, demandRange),
    [allAppointments, demandRange],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="pie-chart" size={18} color={Palette.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              Capacity & Resource Intelligence
            </Text>
            <Text style={styles.headerSubtitle}>
              Department workloads, doctor availability & appointment demand
            </Text>
          </View>
        </View>
      </View>

      {/* Sub-Navigation Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        {(
          [
            {
              key: "overview",
              label: "Capacity Overview",
              icon: "speedometer-outline",
            },
            {
              key: "departments",
              label: "Department Load",
              icon: "grid-outline",
            },
            {
              key: "doctors",
              label: "Doctor Availability",
              icon: "medkit-outline",
            },
            {
              key: "demand",
              label: "Appointment Demand",
              icon: "trending-up-outline",
            },
          ] as const
        ).map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveSubTab(tab.key)}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive ? Palette.primary : Palette.textMuted}
              />
              <Text
                style={[
                  styles.tabChipText,
                  isActive && styles.tabChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ----------------- TAB: OVERVIEW ----------------- */}
      {activeSubTab === "overview" ? (
        <View style={styles.tabContent}>
          {/* Capacity Utilization Card */}
          <Card padded style={styles.utilizationCard}>
            <View style={styles.utilizationHeader}>
              <View style={styles.utilizationLeft}>
                <Ionicons
                  name="analytics-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.utilizationTitle}>
                  Capacity vs Confirmed Demand
                </Text>
              </View>
              {capacityUtilization.hasData ? (
                <Badge
                  label={`${capacityUtilization.utilizationPercent}% Utilized`}
                  variant={
                    capacityUtilization.utilizationPercent > 85
                      ? "warning"
                      : "success"
                  }
                />
              ) : (
                <Badge label="Configuration Needed" variant="neutral" />
              )}
            </View>

            {capacityUtilization.hasData ? (
              <View style={styles.utilizationBody}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(
                          100,
                          capacityUtilization.utilizationPercent,
                        )}%`,
                        backgroundColor:
                          capacityUtilization.utilizationPercent > 85
                            ? Palette.warning
                            : Palette.primary,
                      },
                    ]}
                  />
                </View>
                <View style={styles.utilizationMetricsRow}>
                  <Text style={styles.utilizationMetric}>
                    Confirmed Today:{" "}
                    <Text style={styles.utilizationBold}>
                      {capacityUtilization.confirmedCount}
                    </Text>
                  </Text>
                  <Text style={styles.utilizationMetric}>
                    Total Slot Capacity:{" "}
                    <Text style={styles.utilizationBold}>
                      {capacityUtilization.totalCapacity} slots
                    </Text>
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.utilizationEmpty}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={Palette.textMuted}
                />
                <Text style={styles.utilizationEmptyText}>
                  {capacityUtilization.missingReason}
                </Text>
              </View>
            )}
          </Card>

          {/* KPI Mini Grid */}
          <View style={styles.kpiGrid}>
            <View
              style={[
                styles.kpiBox,
                isDesktop && styles.kpiBoxDesktop,
                isTablet && styles.kpiBoxTablet,
              ]}
            >
              <View
                style={[
                  styles.kpiIconSmall,
                  { backgroundColor: Palette.primaryLight },
                ]}
              >
                <Ionicons name="people" size={16} color={Palette.primary} />
              </View>
              <Text style={styles.kpiBoxValue}>
                {capacityOverview.availableDoctorsCount}
              </Text>
              <Text style={styles.kpiBoxLabel}>Available Doctors</Text>
              <Text style={styles.kpiBoxSub}>Ready for consultation</Text>
            </View>

            <View
              style={[
                styles.kpiBox,
                isDesktop && styles.kpiBoxDesktop,
                isTablet && styles.kpiBoxTablet,
              ]}
            >
              <View
                style={[styles.kpiIconSmall, { backgroundColor: "#FEF3C7" }]}
              >
                <Ionicons name="time" size={16} color="#D97706" />
              </View>
              <Text style={[styles.kpiBoxValue, { color: "#D97706" }]}>
                {capacityOverview.busyDoctorsCount}
              </Text>
              <Text style={styles.kpiBoxLabel}>Busy Doctors</Text>
              <Text style={styles.kpiBoxSub}>Active with patients</Text>
            </View>

            <View
              style={[
                styles.kpiBox,
                isDesktop && styles.kpiBoxDesktop,
                isTablet && styles.kpiBoxTablet,
              ]}
            >
              <View
                style={[styles.kpiIconSmall, { backgroundColor: "#F3E8FF" }]}
              >
                <Ionicons name="videocam" size={16} color="#7C3AED" />
              </View>
              <Text style={[styles.kpiBoxValue, { color: "#7C3AED" }]}>
                {capacityOverview.onlineConsultationLoad}
              </Text>
              <Text style={styles.kpiBoxLabel}>Online Consultations</Text>
              <Text style={styles.kpiBoxSub}>Video visits today</Text>
            </View>

            <View
              style={[
                styles.kpiBox,
                isDesktop && styles.kpiBoxDesktop,
                isTablet && styles.kpiBoxTablet,
              ]}
            >
              <View
                style={[styles.kpiIconSmall, { backgroundColor: "#DCFCE7" }]}
              >
                <Ionicons name="calendar-outline" size={16} color="#16A34A" />
              </View>
              <Text style={[styles.kpiBoxValue, { color: "#16A34A" }]}>
                {capacityOverview.totalUpcomingCount}
              </Text>
              <Text style={styles.kpiBoxLabel}>Upcoming Demand</Text>
              <Text style={styles.kpiBoxSub}>Booked future visits</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ----------------- TAB: DEPARTMENTS ----------------- */}
      {activeSubTab === "departments" ? (
        <View style={styles.tabContent}>
          {departmentLoads.length === 0 ? (
            <EmptyState
              title="No Departments Configured"
              message="Register hospital departments to track operational workloads."
            />
          ) : (
            <View style={styles.deptGrid}>
              {departmentLoads.map((dept) => (
                <Card key={dept.departmentId} padded style={styles.deptCard}>
                  <View style={styles.deptHeader}>
                    <View style={styles.deptInfo}>
                      <Text style={styles.deptName} numberOfLines={1}>
                        {dept.name}
                      </Text>
                      <Text style={styles.deptDoctorCount}>
                        {dept.assignedDoctorsCount} Doctor(s) assigned •{" "}
                        {dept.availableDoctorsCount} available
                      </Text>
                    </View>
                    <Badge label={dept.loadState} variant={dept.loadVariant} />
                  </View>

                  <View style={styles.deptDivider} />

                  <View style={styles.deptStatsRow}>
                    <View style={styles.deptStatCol}>
                      <Text style={styles.deptStatVal}>{dept.todayCount}</Text>
                      <Text style={styles.deptStatLbl}>{"Today's Visits"}</Text>
                    </View>
                    <View style={styles.deptStatDivider} />
                    <View style={styles.deptStatCol}>
                      <Text
                        style={[
                          styles.deptStatVal,
                          dept.waitingCount > 0 && { color: "#D97706" },
                        ]}
                      >
                        {dept.waitingCount}
                      </Text>
                      <Text style={styles.deptStatLbl}>In Queue</Text>
                    </View>
                    <View style={styles.deptStatDivider} />
                    <View style={styles.deptStatCol}>
                      <Text style={styles.deptStatVal}>
                        {dept.upcomingCount}
                      </Text>
                      <Text style={styles.deptStatLbl}>Upcoming</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* ----------------- TAB: DOCTOR AVAILABILITY ----------------- */}
      {activeSubTab === "doctors" ? (
        <View style={styles.tabContent}>
          {doctorAvailabilityList.length === 0 ? (
            <EmptyState
              title="No Doctors Found"
              message="No medical staff currently registered in this hospital."
            />
          ) : (
            <View style={styles.docGrid}>
              {doctorAvailabilityList.map((item) => (
                <Card key={item.doctorId} padded style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <View style={styles.docAvatar}>
                      <Ionicons
                        name="person"
                        size={18}
                        color={Palette.primary}
                      />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {formatDoctorName(item.doctorName)}
                      </Text>
                      <Text style={styles.docSpec} numberOfLines={1}>
                        {item.speciality} • {item.department}
                      </Text>
                    </View>
                    <Badge
                      label={item.statusLabel}
                      variant={item.statusVariant}
                    />
                  </View>

                  <View style={styles.docDivider} />

                  <View style={styles.docMetaRow}>
                    <View style={styles.docMetaItem}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.docMetaText}>
                        Today:{" "}
                        <Text style={styles.docMetaBold}>
                          {item.todayAppointmentsCount}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.docMetaItem}>
                      <Ionicons
                        name="hourglass-outline"
                        size={13}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.docMetaText}>
                        Waiting:{" "}
                        <Text style={styles.docMetaBold}>
                          {item.waitingCount}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.docMetaItem}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={Palette.textMuted}
                      />
                      <Text style={styles.docMetaText}>
                        Upcoming:{" "}
                        <Text style={styles.docMetaBold}>
                          {item.upcomingCount}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* ----------------- TAB: DEMAND VIEW ----------------- */}
      {activeSubTab === "demand" ? (
        <View style={styles.tabContent}>
          {/* Range Selector */}
          <View style={styles.rangeSelectorRow}>
            {(
              [
                { key: "today", label: "Today" },
                { key: "next_7_days", label: "Next 7 Days" },
                { key: "month", label: "Next 30 Days" },
              ] as const
            ).map((r) => {
              const active = demandRange === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setDemandRange(r.key)}
                  style={[
                    styles.rangeButton,
                    active && styles.rangeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.rangeButtonText,
                      active && styles.rangeButtonTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Mode Summary */}
          <View style={styles.modeSummaryRow}>
            <View style={styles.modePill}>
              <Ionicons
                name="business-outline"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.modePillText}>
                In-Clinic:{" "}
                <Text style={styles.modePillBold}>
                  {demandData.byType.clinic}
                </Text>
              </Text>
            </View>

            <View style={[styles.modePill, { borderColor: "#DDD6FE" }]}>
              <Ionicons name="videocam-outline" size={14} color="#7C3AED" />
              <Text style={[styles.modePillText, { color: "#7C3AED" }]}>
                Online Video:{" "}
                <Text style={[styles.modePillBold, { color: "#7C3AED" }]}>
                  {demandData.byType.video}
                </Text>
              </Text>
            </View>

            <View style={styles.modePillTotal}>
              <Text style={styles.modeTotalText}>
                Total Volume: {demandData.totalCount}
              </Text>
            </View>
          </View>

          {/* Trend Bars */}
          <Card padded style={styles.chartCard}>
            <Text style={styles.chartTitle}>Appointment Demand Schedule</Text>
            <Text style={styles.chartSubtitle}>
              Scheduled patient distribution across the selected time horizon
            </Text>
            <View style={styles.chartWrap}>
              <TrendBars
                data={demandData.trend}
                color={Palette.primary}
                emptyLabel="No scheduled appointments in this window"
              />
            </View>
          </Card>

          {/* Department Breakdown Bar */}
          <Card padded style={styles.chartCard}>
            <Text style={styles.chartTitle}>Demand by Department</Text>
            <Text style={styles.chartSubtitle}>
              Scheduled volume per hospital specialty
            </Text>
            <View style={styles.barWrap}>
              <AnalyticsBar
                items={demandData.byDepartment}
                color={Palette.primary}
                emptyLabel="No department volume recorded"
              />
            </View>
          </Card>

          {/* Doctor Workload Bar */}
          <Card padded style={styles.chartCard}>
            <Text style={styles.chartTitle}>Demand by Doctor</Text>
            <Text style={styles.chartSubtitle}>
              Top practitioner booking distribution
            </Text>
            <View style={styles.barWrap}>
              <AnalyticsBar
                items={demandData.byDoctor}
                color="#0284C7"
                emptyLabel="No doctor appointments scheduled"
              />
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  tabScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabChipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  tabChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  tabChipTextActive: {
    color: Palette.primary,
    fontWeight: "600",
  },
  tabContent: {
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  utilizationCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  utilizationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  utilizationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  utilizationTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  utilizationBody: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  utilizationMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  utilizationMetric: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  utilizationBold: {
    fontWeight: "600",
    color: Palette.text,
  },
  utilizationEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  utilizationEmptyText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  kpiBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  kpiBoxDesktop: {
    flexBasis: "23%",
  },
  kpiBoxTablet: {
    flexBasis: "48%",
  },
  kpiIconSmall: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  kpiBoxValue: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "700",
  },
  kpiBoxLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  kpiBoxSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  deptGrid: {
    gap: Spacing.sm,
  },
  deptCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  deptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deptInfo: {
    flex: 1,
  },
  deptName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  deptDoctorCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  deptDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  deptStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  deptStatCol: {
    alignItems: "center",
  },
  deptStatVal: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  deptStatLbl: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  deptStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Palette.border,
  },
  docGrid: {
    gap: Spacing.sm,
  },
  docCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  docAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  docSpec: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  docDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  docMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  docMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  docMetaText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  docMetaBold: {
    color: Palette.text,
    fontWeight: "600",
  },
  rangeSelectorRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  rangeButtonActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  rangeButtonText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  rangeButtonTextActive: {
    color: Palette.white,
    fontWeight: "600",
  },
  modeSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modePillText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  modePillBold: {
    fontWeight: "700",
    color: Palette.primary,
  },
  modePillTotal: {
    marginLeft: "auto",
  },
  modeTotalText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  chartCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chartTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  chartSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
    marginBottom: Spacing.md,
  },
  chartWrap: {
    marginTop: Spacing.xs,
  },
  barWrap: {
    marginTop: Spacing.xs,
  },
});
