/**
 * HealPoint - Hospital Admin · Appointments (own hospital only).
 *
 * Professional hospital-scoped appointment management page built exclusively on
 * REAL backend endpoints (`GET /hospital-admin/appointments`, status updates,
 * cancellations and real slot rescheduling). Appointments are strictly scoped
 * to the authenticated hospital admin's hospital.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import {
  AppointmentDetailAction,
  AppointmentDetailsModal,
} from "@/components/admin/AppointmentDetailsModal";
import { AppointmentListSkeleton } from "@/components/admin/AppointmentListSkeleton";
import { AppointmentRow } from "@/components/admin/AppointmentRow";
import { FilterChips } from "@/components/admin/FilterChips";
import { RescheduleModal } from "@/components/admin/RescheduleModal";
import { StatCard } from "@/components/admin/StatCard";
import {
  appointmentPaymentBadge,
  appointmentStatusBadge,
  StatusBadge,
} from "@/components/admin/StatusBadge";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { SearchBar } from "@/components/ui/SearchBar";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentPayment,
  appointmentPatientName,
  appointmentReference,
} from "@/lib/appointments";
import { formatDDMMYYYY } from "@/lib/format";
import { useResponsiveVariant } from "@/lib/responsive";
import * as adminService from "@/services/admin";
import { toErrorMessage } from "@/services/api";
import type { Appointment } from "@/types";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancel" },
];

const COLUMN_SIZES = {
  ref: 110,
  patient: 150,
  doctor: 140,
  department: 130,
  dateTime: 150,
  status: 110,
  payment: 110,
  action: 60,
};

export default function AdminAppointmentsScreen() {
  const variant = useResponsiveVariant();
  const isTableLayout = variant !== "mobile";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] =
    useState<adminService.HospitalAdminAppointmentsStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hospitalName, setHospitalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] =
    useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalError, setCancelModalError] = useState("");

  const load = useCallback(
    async (asRefresh = false, targetPage = 1) => {
      if (asRefresh) {
        setRefreshing(true);
      } else if (targetPage === 1) {
        setLoading(true);
      }
      setError("");
      try {
        const res = await adminService.getHospitalAdminAppointments({
          search: query,
          status: statusFilter !== "all" ? statusFilter : undefined,
          page: targetPage,
          limit: PAGE_SIZE,
        });

        const list = res.appointments || [];
        if (targetPage > 1) {
          const seen = new Set(appointments.map((a) => String(a._id)));
          setAppointments([
            ...appointments,
            ...list.filter((a) => !seen.has(String(a._id))),
          ]);
        } else {
          setAppointments(list);
        }

        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(res.page || targetPage);
        if (res.stats) setStats(res.stats);
        if (res.hospitalName) setHospitalName(res.hospitalName);
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load appointments."));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [query, statusFilter, appointments],
  );

  useEffect(() => {
    void load(false, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter]);

  const loadMore = useCallback(async () => {
    if (page >= totalPages || loadingMore) return;
    setLoadingMore(true);
    await load(false, page + 1);
  }, [page, totalPages, loadingMore, load]);

  // Handle status update
  const handleUpdateStatus = useCallback(
    async (appointmentId: string, nextStatus: string) => {
      setActionError("");
      setActionSuccess("");
      try {
        await adminService.updateHospitalAdminAppointmentStatus(appointmentId, {
          status: nextStatus,
        });
        setActionSuccess(`Appointment status updated to ${nextStatus}.`);
        setSelected(null);
        await load(true, 1);
      } catch (err) {
        setActionError(
          toErrorMessage(err, "Failed to update appointment status."),
        );
      }
    },
    [load],
  );

  // Handle cancellation
  const handleCancelSubmit = useCallback(async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelModalError("Please specify a reason for cancellation.");
      return;
    }
    setCancelling(true);
    setCancelModalError("");
    try {
      await adminService.cancelHospitalAdminAppointment(
        String(cancelTarget._id),
        cancelReason.trim(),
      );
      setCancelTarget(null);
      setCancelReason("");
      setSelected(null);
      setActionSuccess("Appointment successfully cancelled.");
      await load(true, 1);
    } catch (err) {
      setCancelModalError(toErrorMessage(err, "Failed to cancel appointment."));
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, load]);

  // Handle reschedule
  const handleRescheduleSubmit = useCallback(
    async (payload: {
      slotDate: string;
      slotTime: string;
      reason: string;
    }): Promise<string> => {
      if (!rescheduleAppointment) return "No appointment selected";
      try {
        await adminService.rescheduleHospitalAdminAppointment(
          String(rescheduleAppointment._id),
          payload,
        );
        setRescheduleAppointment(null);
        setSelected(null);
        setActionSuccess("Appointment rescheduled successfully.");
        await load(true, 1);
        return "";
      } catch (err) {
        return toErrorMessage(err, "Reschedule failed");
      }
    },
    [rescheduleAppointment, load],
  );

  // Build detail actions for selected appointment
  const detailActions: AppointmentDetailAction[] = React.useMemo(() => {
    if (!selected) return [];
    const actions: AppointmentDetailAction[] = [];
    const status = String(selected.status || "").toLowerCase();

    if (status === "pending") {
      actions.push({
        key: "confirm",
        label: "Confirm",
        icon: "checkmark-circle-outline",
        variant: "primary",
        onPress: () => handleUpdateStatus(String(selected._id), "confirmed"),
      });
    }

    if (status === "confirmed") {
      actions.push({
        key: "complete",
        label: "Complete",
        icon: "checkmark-done-outline",
        variant: "primary",
        onPress: () => handleUpdateStatus(String(selected._id), "completed"),
      });
    }

    if (status === "pending" || status === "confirmed") {
      actions.push({
        key: "reschedule",
        label: "Reschedule",
        icon: "time-outline",
        variant: "outline",
        onPress: () => {
          setRescheduleAppointment(selected);
        },
      });
      actions.push({
        key: "cancel",
        label: "Cancel",
        icon: "close-circle-outline",
        variant: "danger",
        onPress: () => {
          setCancelTarget(selected);
          setCancelReason("");
          setCancelModalError("");
        },
      });
    }

    return actions;
  }, [selected, handleUpdateStatus]);

  return (
    <RoleGuard allowedRoles={["admin", "super_admin"]}>
      <AdminModuleScreen
        title="Appointments"
        subtitle={hospitalName || "Your Hospital"}
        loading={loading}
        error={error}
        onRetry={() => load(false, 1)}
        loadingComponent={<AppointmentListSkeleton />}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true, 1)}
            />
          }
        >
          {/* Notifications / Alerts */}
          {actionSuccess ? (
            <FormMessage type="success" message={actionSuccess} />
          ) : null}
          {actionError ? (
            <FormMessage type="error" message={actionError} />
          ) : null}

          {/* Stats Cards */}
          {stats ? (
            <View style={styles.grid}>
              <StatCard
                label="Total"
                value={stats.total}
                icon="calendar-outline"
                accent="#2F80ED"
              />
              <StatCard
                label="Today"
                value={stats.today}
                icon="today-outline"
                accent="#7B61FF"
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                icon="time-outline"
                accent="#E89A3C"
              />
              <StatCard
                label="Confirmed"
                value={stats.confirmed}
                icon="checkmark-circle-outline"
                accent="#0E9F8E"
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                icon="checkmark-done-outline"
                accent="#2E9E5B"
              />
              <StatCard
                label="Cancelled"
                value={stats.cancelled}
                icon="close-circle-outline"
                accent="#D9435B"
              />
            </View>
          ) : null}

          {/* Search Toolbar */}
          <View style={styles.toolbar}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search patient, doctor, appointment ID..."
            />
          </View>

          {/* Filter Chips */}
          <FilterChips
            options={STATUS_FILTERS}
            selected={statusFilter}
            onSelect={setStatusFilter}
          />

          {/* Results Summary */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Showing {appointments.length} of {total} appointment
              {total === 1 ? "" : "s"}
            </Text>
          </View>

          {/* Appointments List / Table */}
          {appointments.length === 0 ? (
            <EmptyState
              title="No appointments found"
              message={
                query || statusFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Appointments booked at your hospital will appear here."
              }
            />
          ) : isTableLayout ? (
            <View style={styles.tableOuter}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
              >
                <View>
                  <View style={styles.tableHeaderRow}>
                    <View style={{ width: COLUMN_SIZES.ref }}>
                      <Text style={styles.tableHeaderCell}>Reference</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.patient }}>
                      <Text style={styles.tableHeaderCell}>Patient</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.doctor }}>
                      <Text style={styles.tableHeaderCell}>Doctor</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.department }}>
                      <Text style={styles.tableHeaderCell}>Department</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.dateTime }}>
                      <Text style={styles.tableHeaderCell}>Date & Time</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.status }}>
                      <Text style={styles.tableHeaderCell}>Status</Text>
                    </View>
                    <View style={{ width: COLUMN_SIZES.payment }}>
                      <Text style={styles.tableHeaderCell}>Payment</Text>
                    </View>
                    <View
                      style={{
                        width: COLUMN_SIZES.action,
                        alignItems: "center",
                      }}
                    >
                      <Text style={styles.tableHeaderCell}>Action</Text>
                    </View>
                  </View>

                  {appointments.map((appt) => {
                    const pmt = appointmentPayment(appt);
                    return (
                      <Pressable
                        key={String(appt._id)}
                        onPress={() => setSelected(appt)}
                        style={({ pressed }) => [
                          styles.tableRow,
                          pressed && styles.tableRowPressed,
                        ]}
                      >
                        <View style={{ width: COLUMN_SIZES.ref }}>
                          <Text style={styles.cellRef} numberOfLines={1}>
                            {appointmentReference(appt)}
                          </Text>
                        </View>
                        <View style={{ width: COLUMN_SIZES.patient }}>
                          <Text style={styles.cellStrong} numberOfLines={1}>
                            {appointmentPatientName(appt)}
                          </Text>
                        </View>
                        <View style={{ width: COLUMN_SIZES.doctor }}>
                          <Text style={styles.cellText} numberOfLines={1}>
                            {appointmentDoctorName(appt)}
                          </Text>
                        </View>
                        <View style={{ width: COLUMN_SIZES.department }}>
                          <Text style={styles.cellText} numberOfLines={1}>
                            {appointmentDepartment(appt) || "—"}
                          </Text>
                        </View>
                        <View style={{ width: COLUMN_SIZES.dateTime }}>
                          <Text style={styles.cellText} numberOfLines={1}>
                            {formatDDMMYYYY(appt.slotDate)}{" "}
                            {appt.slotTime ? `· ${appt.slotTime}` : ""}
                          </Text>
                        </View>
                        <View style={{ width: COLUMN_SIZES.status }}>
                          <StatusBadge
                            value={appt.status}
                            variant={appointmentStatusBadge(appt.status)}
                          />
                        </View>
                        <View style={{ width: COLUMN_SIZES.payment }}>
                          <Badge
                            label={pmt.label}
                            variant={appointmentPaymentBadge(pmt.status)}
                          />
                        </View>
                        <View
                          style={{
                            width: COLUMN_SIZES.action,
                            alignItems: "center",
                          }}
                        >
                          <View style={styles.viewIcon}>
                            <Ionicons
                              name="eye-outline"
                              size={18}
                              color={Palette.primaryDark}
                            />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.cardsColumn}>
              {appointments.map((appt) => (
                <AppointmentRow
                  key={String(appt._id)}
                  appointment={appt}
                  onPress={() => setSelected(appt)}
                />
              ))}
            </View>
          )}

          {/* Pagination */}
          {page < totalPages ? (
            <View style={styles.footer}>
              <Button
                title="Load More"
                variant="outline"
                loading={loadingMore}
                onPress={loadMore}
                style={styles.loadMoreButton}
              />
            </View>
          ) : null}
        </ScrollView>

        {/* Appointment Details Modal */}
        <AppointmentDetailsModal
          appointment={selected}
          visible={!!selected && !rescheduleAppointment && !cancelTarget}
          onClose={() => setSelected(null)}
          actions={detailActions}
        />

        {/* Reschedule Modal */}
        {rescheduleAppointment ? (
          <RescheduleModal
            visible={!!rescheduleAppointment}
            appointment={rescheduleAppointment}
            onClose={() => setRescheduleAppointment(null)}
            onSubmit={handleRescheduleSubmit}
          />
        ) : null}

        {/* Cancel Reason Modal */}
        <Modal
          visible={!!cancelTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setCancelTarget(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cancel Appointment</Text>
              <Text style={styles.modalDescription}>
                Are you sure you want to cancel appointment{" "}
                {cancelTarget ? appointmentReference(cancelTarget) : ""}? Please
                provide a cancellation reason for the patient and doctor.
              </Text>

              {cancelModalError ? (
                <FormMessage type="error" message={cancelModalError} />
              ) : null}

              <Input
                label="Cancellation Reason"
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Doctor unavailable, emergency department maintenance"
                multiline
                numberOfLines={3}
                style={styles.modalInput}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Keep Appointment"
                  variant="outline"
                  onPress={() => setCancelTarget(null)}
                  disabled={cancelling}
                  style={styles.modalActionBtn}
                />
                <Button
                  title="Confirm Cancel"
                  variant="danger"
                  loading={cancelling}
                  onPress={handleCancelSubmit}
                  style={styles.modalActionBtn}
                />
              </View>
            </View>
          </View>
        </Modal>
      </AdminModuleScreen>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  toolbar: {
    marginBottom: Spacing.xs,
  },
  summaryRow: {
    paddingVertical: Spacing.xs,
  },
  summaryText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
  },
  cardsColumn: {
    gap: Spacing.sm,
  },
  tableOuter: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tableHeaderCell: {
    fontSize: Typography.caption.fontSize,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  tableRowPressed: {
    backgroundColor: "#f8fafc",
  },
  cellRef: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  cellStrong: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: "600",
    color: Palette.text,
  },
  cellText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.text,
  },
  viewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  loadMoreButton: {
    minWidth: 160,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#fff",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Palette.text,
  },
  modalDescription: {
    fontSize: Typography.bodySmall.fontSize,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalActionBtn: {
    minWidth: 130,
  },
});
