/** HealPoint - Super Admin · Reports & Analytics dashboard. */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { AnalyticsBar } from '@/components/admin/AnalyticsBar';
import { AnalyticsSkeleton } from '@/components/admin/AnalyticsSkeleton';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { TrendBars } from '@/components/admin/TrendBars';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import {
  appointmentCreatedInRange,
  appointmentStatusBreakdown,
  appointmentSummaryRows,
  appointmentTrend,
  buildAppointmentsCsv,
  dateRangePresets,
  doctorSummaryRows,
  findRangePreset,
  hospitalSummaryRows,
  normalizeStatus,
  paidAppointmentCount,
  paidRevenue,
  patientCreatedInRange,
  patientTrend,
  paymentBreakdown,
  statusCount,
  topDepartments,
  topDoctors,
  topHospitals,
  uniquePatientCount,
} from '@/lib/analytics';
import { appointmentDepartment, appointmentDoctorName, appointmentHospitalName } from '@/lib/appointments';
import { formatINR } from '@/lib/format';
import { useResponsiveVariant } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import * as consultationService from '@/services/consultations';
import * as doctorService from '@/services/doctors';
import * as hospitalService from '@/services/hospitals';
import * as subscriptionService from '@/services/subscriptions';
import * as userService from '@/services/users';
import type { Appointment, Doctor, Hospital, PlatformUser, PlatformAnalytics, PlatformStats, SubscriptionOverview, SuperAdminConsultationStats } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancel' },
  { label: 'Missed', value: 'missed' },
];

export default function ReportsAnalyticsScreen() {
  const variant = useResponsiveVariant();
  const isTabletOrDesktop = variant === 'desktop' || variant === 'tablet';

  const [rangeKey, setRangeKey] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState('');

  // Real data
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [consultationStats, setConsultationStats] = useState<SuperAdminConsultationStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [patients, setPatients] = useState<PlatformUser[]>([]);
const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, analyticsRes, overviewRes, consultRes, apptsRes, docRes, hosRes, patientRes] =
        await Promise.all([
          userService.getPlatformStats().catch(() => null),
          userService.getPlatformAnalytics().catch(() => null),
          subscriptionService.getSubscriptionOverview().catch(() => null),
          consultationService.getSuperAdminConsultationStats().catch(() => null),
          appointmentService.getAllAdminAppointments({ platform: true, limit: 200 }),
          doctorService.getAllDoctors({ platform: true, limit: 200 }).catch(() => ({ doctors: [] })),
          hospitalService.getAdminHospitals().catch(() => ({ hospitals: [] })),
          userService.getPlatformUsers({ role: 'patient', limit: 200 }).catch(() => ({ users: [] })),
        ]);
      setStats(statsRes?.stats || null);
      setAnalytics(analyticsRes?.analytics || null);
      setOverview(overviewRes?.overview || null);
      setConsultationStats(consultRes || null);
      setAppointments(apptsRes?.appointments || []);
      setDoctors(docRes?.doctors || []);
      setHospitals(hosRes?.hospitals || []);
      setPatients(patientRes?.users || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load analytics.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const range = useMemo(() => findRangePreset(rangeKey), [rangeKey]);
  const presets = useMemo(() => dateRangePresets(), []);

  /** Appointments in the current date range, then optionally filtered further. */
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      if (!appointmentCreatedInRange(appointment, range)) return false;
      if (hospitalFilter !== 'all' && appointmentHospitalName(appointment) !== hospitalFilter) return false;
      if (doctorFilter !== 'all' && appointmentDoctorName(appointment) !== doctorFilter) return false;
      if (departmentFilter !== 'all' && (appointmentDepartment(appointment) || 'Not available') !== departmentFilter) return false;
      if (statusFilter !== 'all' && normalizeStatus(appointment.status) !== statusFilter) return false;
      return true;
    });
  }, [appointments, range, hospitalFilter, doctorFilter, departmentFilter, statusFilter]);

  /** Patient registrations within the current date range. */
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => patientCreatedInRange(patient, range));
  }, [patients, range]);

  const hospitalOptions = useMemo(() => {
    return [...new Set(appointments.map((appointment) => appointmentHospitalName(appointment)))].sort((a, b) => a.localeCompare(b));
  }, [appointments]);
  const doctorOptions = useMemo(() => {
    return [...new Set(appointments.map((appointment) => appointmentDoctorName(appointment)))].sort((a, b) => a.localeCompare(b));
  }, [appointments]);
  const departmentOptions = useMemo(() => {
    return [...new Set(appointments.map((appointment) => appointmentDepartment(appointment) || 'Not available'))].sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  // Derivative analytics (all from REAL filtered records)
  const net = filteredAppointments.length;
  const completed = statusCount(filteredAppointments, 'completed');
  const cancelled = statusCount(filteredAppointments, 'cancel') + statusCount(filteredAppointments, 'missed');
  const pending = statusCount(filteredAppointments, 'pending');
  const confirmed = statusCount(filteredAppointments, 'confirmed');
  const revenue = paidRevenue(filteredAppointments);
  const paidCount = paidAppointmentCount(filteredAppointments);
  const uniquePatients = uniquePatientCount(filteredAppointments);

  const trend = useMemo(() => appointmentTrend(filteredAppointments, range), [filteredAppointments, range]);
  const regTrend = useMemo(() => patientTrend(filteredPatients, range), [filteredPatients, range]);

  const statusBreakdown = useMemo(() => appointmentStatusBreakdown(filteredAppointments), [filteredAppointments]);
  const paymentRows = useMemo(() => paymentBreakdown(filteredAppointments), [filteredAppointments]);

  const topHospitalRows = useMemo(() => topHospitals(filteredAppointments, 6), [filteredAppointments]);
  const topDoctorRows = useMemo(() => topDoctors(filteredAppointments, 6), [filteredAppointments]);
  const topDepartmentRows = useMemo(() => topDepartments(filteredAppointments, 6), [filteredAppointments]);

  const summaryRows = useMemo(() => appointmentSummaryRows(filteredAppointments), [filteredAppointments]);
  const hospitalSummary = useMemo(() => hospitalSummaryRows(hospitals, filteredAppointments), [hospitals, filteredAppointments]);
  const doctorSummary = useMemo(() => doctorSummaryRows(doctors, filteredAppointments), [doctors, filteredAppointments]);

  const activeFilterCount =
    (hospitalFilter !== 'all' ? 1 : 0) +
    (doctorFilter !== 'all' ? 1 : 0) +
    (departmentFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);
const doExport = useCallback(async () => {
    if (filteredAppointments.length === 0) {
      setExported('Nothing to export for the current filters.');
      return;
    }
    setExporting(true);
    try {
      const file = buildAppointmentsCsv(filteredAppointments, range, Date.now());
      // Share the real CSV text (columns + rows) so the recipient can save it.
      await Share.share({ message: file.content, title: file.filename });
      setExported(`CSV ready: ${file.filename} (${filteredAppointments.length} row(s))`);
    } catch (err) {
      setExported(toErrorMessage(err, 'Export failed.'));
    } finally {
      setExporting(false);
    }
  }, [filteredAppointments, range]);

  function resetFilters() {
    setHospitalFilter('all');
    setDoctorFilter('all');
    setDepartmentFilter('all');
    setStatusFilter('all');
  }
return (
    <AdminModuleScreen
      title="Reports & Analytics"
      subtitle={`${range.label} · ${filteredAppointments.length} matching appointment(s)`}
      loading={loading}
      error={error}
      onRetry={load}
      loadingComponent={<AnalyticsSkeleton />}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* ---- Date range chips ---- */}
        <View style={styles.rangeRow}>
          <View style={styles.rangeChips}>
            <FilterChips
              options={presets.map((preset) => ({ label: preset.label, value: preset.key }))}
              selected={rangeKey}
              onSelect={setRangeKey}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowFilters(true)}
            style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          >
            {activeFilterCount > 0 ? <View style={styles.dot} /> : null}
            <Ionicons name="options-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.filterBtnText}>Filters</Text>
          </Pressable>
        </View>

        {/* ---- KPI cards ---- */}
        <View style={styles.grid}>
          <StatCard label="Appointments" value={net} icon="calendar-outline" accent="#2F80ED" hint={range.label} />
          <StatCard label="Completed" value={completed} icon="checkmark-done-outline" accent="#2E9E5B" />
          <StatCard label="Cancelled" value={cancelled} icon="close-circle-outline" accent="#D9435B" />
          <StatCard label="Pending" value={pending} icon="time-outline" accent="#E89A3C" />
          <StatCard label="Confirmed" value={confirmed} icon="checkmark-circle-outline" accent="#0E9F8E" />
          <StatCard label="Unique Patients" value={uniquePatients} icon="people-outline" accent="#7B61FF" />
          <StatCard label="Paid" value={paidCount} icon="card-outline" accent="#2E9E5B" />
          <StatCard label="Revenue (paid)" value={formatINR(revenue)} icon="wallet-outline" accent="#0E9F8E" />
        </View>

        {/* ---- Platform overview (real totals, independent of range filter) ---- */}
        <Card padded style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Platform overview</Text>
          <View style={styles.highlightRow}>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{stats?.totalHospitals ?? analytics?.totalHospitals ?? 0}</Text>
              <Text style={styles.highlightLabel}>Hospitals</Text>
            </View>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{stats?.totalDoctors ?? analytics?.totalDoctors ?? 0}</Text>
              <Text style={styles.highlightLabel}>Doctors</Text>
            </View>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{stats?.totalPatients ?? analytics?.totalPatients ?? 0}</Text>
              <Text style={styles.highlightLabel}>Patients</Text>
            </View>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{stats?.totalAppointments ?? analytics?.totalAppointments ?? 0}</Text>
              <Text style={styles.highlightLabel}>All appointments</Text>
            </View>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{stats?.totalUsers ?? 0}</Text>
              <Text style={styles.highlightLabel}>Total users</Text>
            </View>
            <View style={styles.highlightCell}>
              <Text style={styles.highlightValue}>{formatINR(stats?.earnings ?? 0)}</Text>
              <Text style={styles.highlightLabel}>Platform earnings</Text>
            </View>
          </View>
        </Card>

        {(overview || consultationStats) ? (
          <Card padded style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightRow}>
              {overview ? (
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightValue}>{overview.activeSubscriptions ?? overview.activeCount ?? 0}</Text>
                  <Text style={styles.highlightLabel}>Active subscriptions</Text>
                </View>
              ) : null}
              {overview ? (
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightValue}>{formatINR(overview.revenue ?? 0)}</Text>
                  <Text style={styles.highlightLabel}>Subscription revenue</Text>
                </View>
              ) : null}
              {consultationStats ? (
                <View style={styles.highlightCell}>
                  <Text style={styles.highlightValue}>{consultationStats.stats?.total ?? 0}</Text>
                  <Text style={styles.highlightLabel}>Online consultations</Text>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* ---- Appointment trend ---- */}
        <Card padded>
          <Text style={styles.sectionTitle}>Appointment trend</Text>
          {trend.length === 0 ? (
            <EmptyState title="No appointments in this range" message="Try widening the date range." />
          ) : (
            <TrendBars data={trend} />
          )}
        </Card>

        {/* ---- Patient registrations trend ---- */}
        <Card padded>
          <Text style={styles.sectionTitle}>New patient registrations</Text>
          {regTrend.length === 0 ? (
            <EmptyState title="No registrations in this range" message="Try widening the date range." />
          ) : (
            <TrendBars data={regTrend} color="#7B61FF" />
          )}
        </Card>

        {/* ---- Status distribution ---- */}
        <Card padded>
          <Text style={styles.sectionTitle}>Appointment status</Text>
          {statusBreakdown.length === 0 ? (
            <EmptyState title="No appointments in this range" />
          ) : (
            <AnalyticsBar items={statusBreakdown.map((s) => ({ label: s.status, count: s.count }))} color="#2E9E5B" />
          )}
        </Card>

        {/* ---- Payment distribution ---- */}
        <Card padded>
          <Text style={styles.sectionTitle}>Payment status</Text>
          {paymentRows.length === 0 ? (
            <EmptyState title="No payment data in this range" />
          ) : (
            <AnalyticsBar items={paymentRows.map((p) => ({ label: p.label, count: p.count }))} color="#0E9F8E" />
          )}
        </Card>
{/* ---- Top hospitals / doctors / departments ---- */}
        <View style={isTabletOrDesktop ? styles.cols2 : undefined}>
          <Card padded>
            <Text style={styles.sectionTitle}>Top hospitals</Text>
            {topHospitalRows.length === 0 ? <EmptyState title="No hospitals in range" /> : <AnalyticsBar items={topHospitalRows} color="#2F80ED" />}
          </Card>
          <Card padded>
            <Text style={styles.sectionTitle}>Top doctors</Text>
            {topDoctorRows.length === 0 ? <EmptyState title="No doctors in range" /> : <AnalyticsBar items={topDoctorRows} color="#7B61FF" />}
          </Card>
          <Card padded>
            <Text style={styles.sectionTitle}>Top departments</Text>
            {topDepartmentRows.length === 0 ? <EmptyState title="No departments in range" /> : <AnalyticsBar items={topDepartmentRows} color="#E89A3C" />}
          </Card>
        </View>

        {/* ---- Export ---- */}
        <Card padded style={styles.exportCard}>
          <View style={styles.exportRow}>
            <View style={styles.exportTexts}>
              <Text style={styles.sectionTitle}>Export report</Text>
              <Text style={styles.muted}>Current filter: {range.label} · {filteredAppointments.length} record(s). CSV only contains real data.</Text>
            </View>
            <Button
              title={exporting ? 'Preparing...' : 'Export CSV'}
              variant="outline"
              loading={exporting}
              icon="download-outline"
              disabled={filteredAppointments.length === 0}
              onPress={doExport}
              style={styles.exportBtn}
            />
          </View>
          {exported ? <FormMessage type={exported.startsWith('Nothing') || exported.startsWith('Export failed') ? 'error' : 'success'} message={exported} /> : null}
        </Card>

        {/* ---- Report tables (aggregated real data) ---- */}
        <View style={styles.tablesWrap}>
          <Card padded>
            <Text style={styles.sectionTitle}>Appointment summary · Hospital / Doctor</Text>
            {summaryRows.length === 0 ? (
              <EmptyState title="No appointments in this range" />
            ) : summaryRows.slice(0, 8).map((row, index) => (
              <View key={row.hospital + '|' + row.doctor + '|' + index} style={styles.tableRowLine}>
                <Text style={styles.tableCellMain} numberOfLines={1}>{row.doctor}</Text>
                <Text style={styles.tableCellSub} numberOfLines={1}>{row.hospital}</Text>
                <Text style={styles.tableCellNumber}>{row.appointments}</Text>
              </View>
            ))}
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Hospital summary</Text>
            {hospitalSummary.length === 0 ? (
              <EmptyState title="No hospitals" />
            ) : hospitalSummary.slice(0, 8).map((row, index) => (
              <View key={row.hospital + '|' + index} style={styles.tableRowLine}>
                <Text style={styles.tableCellMain} numberOfLines={1}>{row.hospital}</Text>
                <Text style={styles.tableCellSub} numberOfLines={1}>{row.active ? 'Active' : 'Inactive'}</Text>
                <Text style={styles.tableCellNumber}>{row.appointments}</Text>
              </View>
            ))}
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Doctor summary</Text>
            {doctorSummary.length === 0 ? (
              <EmptyState title="No doctors" />
            ) : doctorSummary.slice(0, 8).map((row, index) => (
              <View key={row.doctor + '|' + index} style={styles.tableRowLine}>
                <Text style={styles.tableCellMain} numberOfLines={1}>{row.doctor}</Text>
                <Text style={styles.tableCellSub} numberOfLines={1}>{row.completed} completed</Text>
                <Text style={styles.tableCellNumber}>{row.appointments}</Text>
              </View>
            ))}
          </Card>
        </View>

        {/* ---- Filters modal ---- */}
        <FiltersModal
          visible={showFilters}
          hospitals={hospitalOptions}
          doctors={doctorOptions}
          departments={departmentOptions}
          hospital={hospitalFilter}
          doctor={doctorFilter}
          department={departmentFilter}
          status={statusFilter}
          onChangeHospital={setHospitalFilter}
          onChangeDoctor={setDoctorFilter}
          onChangeDepartment={setDepartmentFilter}
          onChangeStatus={setStatusFilter}
          onReset={resetFilters}
          onClose={() => setShowFilters(false)}
        />
      </ScrollView>
    </AdminModuleScreen>
  );
}
// ---------------------------------------------------------------------------
// Filters modal
// ---------------------------------------------------------------------------
function ChipRow({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(active ? 'all' : option)}
              style={[styles.optionChip, active && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]} numberOfLines={1}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
interface FiltersModalProps {
  visible: boolean;
  hospitals: string[];
  doctors: string[];
  departments: string[];
  hospital: string;
  doctor: string;
  department: string;
  status: string;
  onChangeHospital: (v: string) => void;
  onChangeDoctor: (v: string) => void;
  onChangeDepartment: (v: string) => void;
  onChangeStatus: (v: string) => void;
  onReset: () => void;
  onClose: () => void;
}

function FiltersModal({
  visible,
  hospitals,
  doctors,
  departments,
  hospital,
  doctor,
  department,
  status,
  onChangeHospital,
  onChangeDoctor,
  onChangeDepartment,
  onChangeStatus,
  onReset,
  onClose,
}: FiltersModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Analytics filters</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={Palette.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ChipRow title="Hospital" options={['all', ...hospitals]} selected={hospital} onSelect={onChangeHospital} />
            <ChipRow title="Doctor" options={['all', ...doctors]} selected={doctor} onSelect={onChangeDoctor} />
            <ChipRow title="Department" options={['all', ...departments]} selected={department} onSelect={onChangeDepartment} />
            <ChipRow title="Status" options={['all', ...STATUS_FILTERS.map((s) => s.value)]} selected={status} onSelect={onChangeStatus} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button title="Reset" variant="ghost" onPress={onReset} style={styles.footerBtn} />
            <Button title="Done" variant="primary" onPress={onClose} style={styles.footerBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: Spacing.xxxl, gap: Spacing.md, paddingHorizontal: Spacing.lg },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rangeChips: { flex: 1 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  filterBtnText: { ...Typography.label, color: Palette.primaryDark },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.primary },
  pressed: { opacity: 0.7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  summaryCard: { gap: Spacing.sm },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  highlightCell: { flex: 1, minWidth: 120, gap: 2 },
  highlightValue: { ...Typography.h3, color: Palette.text },
  highlightLabel: { ...Typography.caption, color: Palette.textMuted },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.xs },
  muted: { ...Typography.caption, color: Palette.textMuted },
  cols2: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  exportCard: { gap: Spacing.md },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  exportTexts: { flex: 1, gap: 2 },
  exportBtn: { minHeight: 44 },
  tablesWrap: {
    gap: Spacing.md,
  },
  tableRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  tableCellMain: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600', flex: 1 },
  tableCellSub: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  tableCellNumber: { ...Typography.label, color: Palette.primaryDark },
  // Filters modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  modalTitle: { ...Typography.h4, color: Palette.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { padding: Spacing.lg, gap: Spacing.lg },
  filterGroup: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  filterTitle: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  optionChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  optionChipText: { ...Typography.bodySmall, fontWeight: '600', color: Palette.textMuted },
  optionChipTextActive: { color: Palette.white },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  footerBtn: { flex: 1, minHeight: 48 },
});