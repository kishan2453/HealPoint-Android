/**
 * HealPoint - Super Admin · Appointment Monitoring.
 *
 * A production-style appointment monitoring system built exclusively on REAL
 * backend data (`GET /appointment/get-all?platform=1` + `/user/get-stats`):
 *   - summary cards with server-exact counts (statusCounts + platform stats)
 *   - real search across patient / doctor / appointment reference / hospital
 *   - status chips + a filter modal (payment, hospital, doctor, department,
 *     date range) with Apply / Clear
 *   - responsive layout: full table on desktop/tablet, card rows on mobile
 *   - sectioned details modal (Patient / Doctor / Hospital / Appointment /
 *     Payment)
 *   - pagination via page/limit with de-dupe (safe even when a backend version
 *     ignores the page param), skeleton, empty, no-results and error states
 *
 * Nothing is hardcoded or faked. Status actions are intentionally NOT shown:
 * the existing backend exposes no authorised admin status-update endpoint for
 * appointments, so a Confirm/Complete/Cancel button would be a dead control.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { AppointmentDetailsModal } from '@/components/admin/AppointmentDetailsModal';
import { AppointmentListSkeleton } from '@/components/admin/AppointmentListSkeleton';
import { AppointmentRow } from '@/components/admin/AppointmentRow';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import {
  appointmentPaymentBadge,
  appointmentStatusBadge,
  StatusBadge,
} from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentHospitalName,
  appointmentPayment,
  appointmentPatientName,
  appointmentReference,
  appointmentSearchable,
  appointmentSortKey,
  isAppointmentOn,
  todayKey,
} from '@/lib/appointments';
import { formatINR, formatDDMMYYYY, toDDMMYYYY } from '@/lib/format';
import { useResponsiveVariant } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import * as userService from '@/services/users';
import type { Appointment } from '@/types';

const PAGE_SIZE = 40;

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancel' },
  { label: 'Missed', value: 'missed' },
  { label: 'Rescheduled', value: 'rescheduled' },
];

const PAYMENT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Pay at clinic', value: 'cash' },
  { label: 'Unpaid', value: 'unpaid' },
];

interface FiltersState {
  status: string;
  payment: string;
  hospital: string;
  doctor: string;
  department: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FiltersState = {
  status: 'all',
  payment: 'all',
  hospital: 'all',
  doctor: 'all',
  department: 'all',
  dateFrom: '',
  dateTo: '',
};

function normalizeStatus(status?: string): string {
  const raw = (status || '').trim().toLowerCase();
  if (raw === 'cancelled') return 'cancel';
  return raw;
}

function matchesStatusFilter(appointment: Appointment, value: string): boolean {
  if (!value || value === 'all') return true;
  return normalizeStatus(appointment.status) === value;
}

function matchesPaymentFilter(appointment: Appointment, value: string): boolean {
  if (!value || value === 'all') return true;
  return appointmentPayment(appointment).status === value;
}

function matchesStringFilter(
  appointment: Appointment,
  dimension: 'hospital' | 'doctor' | 'department',
  value: string,
): boolean {
  if (!value || value === 'all') return true;
  const actual =
    dimension === 'hospital'
      ? appointmentHospitalName(appointment)
      : dimension === 'doctor'
        ? appointmentDoctorName(appointment)
        : appointmentDepartment(appointment) || 'Not available';
  return actual.toLowerCase().trim() === value.toLowerCase().trim();
}

function matchesDateRange(appointment: Appointment, from: string, to: string): boolean {
  if (!from && !to) return true;
  const slot = (appointment.slotDate || '').trim();
  if (!/^\d{2}-\d{2}-\d{4}$/.test(slot)) return false;
  if (from && slot < from) return false;
  if (to && slot > to) return false;
  return true;
}

function uniqueSorted(values: string[]): string[] {
  return [
    ...new Set(
      values.filter(
        (value) => value && value.trim() && value.trim() !== 'Not available' && value.trim() !== 'all',
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function mergeUnique(existing: Appointment[], incoming: Appointment[]): Appointment[] {
  const seen = new Set(existing.map((item) => String(item._id)));
  const merged = [...existing];
  incoming.forEach((item) => {
    const key = String(item._id);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });
  return merged;
}
export default function SuperAdminAppointmentsScreen() {
  const variant = useResponsiveVariant();
  const isTableLayout = variant !== 'mobile';

  // ---- Data state -----------------------------------------------------------
  const [source, setSource] = useState<Appointment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [platformTotal, setPlatformTotal] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [noMore, setNoMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');

  // ---- Filter / search / presentation state ---------------------------------
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FiltersState>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<FiltersState>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest');
  const [selected, setSelected] = useState<Appointment | null>(null);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, apptsRes] = await Promise.all([
        userService.getPlatformStats().catch(() => null),
        appointmentService.getAllAdminAppointments({ platform: true, page: 1, limit: PAGE_SIZE }),
      ]);
      setSource(apptsRes.appointments || []);
      setTotalCount(apptsRes.totalCount || 0);
      if (statsRes?.stats) setPlatformTotal(statsRes.stats.totalAppointments);
      if (apptsRes.statusCounts?.length) {
        const map: Record<string, number> = {};
        apptsRes.statusCounts.forEach((item) => {
          map[String(item._id).toLowerCase()] = item.count;
        });
        setStatusCounts(map);
      }
      setPage(1);
      setNoMore(false);
      setLoadMoreError('');
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load appointments.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || noMore) return;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const res = await appointmentService.getAllAdminAppointments({
        platform: true,
        page: page + 1,
        limit: PAGE_SIZE,
      });
      const incoming = res.appointments || [];
      const merged = mergeUnique(source, incoming);
      const added = merged.length - source.length;
      setSource(merged);
      if (res.totalCount && res.totalCount > totalCount) setTotalCount(res.totalCount);
      setPage((value) => value + 1);
      if (added === 0) setNoMore(true);
    } catch (err) {
      setLoadMoreError(toErrorMessage(err, 'Unable to load more appointments.'));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, noMore, page, source, totalCount]);
// ---- Derived real data -----------------------------------------------------
  const filterOptions = useMemo(() => {
    const hospitals = uniqueSorted(source.map((item) => appointmentHospitalName(item)));
    const doctors = uniqueSorted(source.map((item) => appointmentDoctorName(item)));
    const departments = uniqueSorted(source.map((item) => appointmentDepartment(item) || ''));
    return { hospitals, doctors, departments };
  }, [source]);

  const activeFilterCount =
    (filter.status !== 'all' ? 1 : 0) +
    (filter.payment !== 'all' ? 1 : 0) +
    (filter.hospital !== 'all' ? 1 : 0) +
    (filter.doctor !== 'all' ? 1 : 0) +
    (filter.department !== 'all' ? 1 : 0) +
    (filter.dateFrom || filter.dateTo ? 1 : 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = source.filter((item) => {
      if (!matchesStatusFilter(item, filter.status)) return false;
      if (!matchesPaymentFilter(item, filter.payment)) return false;
      if (!matchesStringFilter(item, 'hospital', filter.hospital)) return false;
      if (!matchesStringFilter(item, 'doctor', filter.doctor)) return false;
      if (!matchesStringFilter(item, 'department', filter.department)) return false;
      if (!matchesDateRange(item, filter.dateFrom, filter.dateTo)) return false;
      if (needle && !appointmentSearchable(item).includes(needle)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const ka = appointmentSortKey(a);
      const kb = appointmentSortKey(b);
      const diff = sortDir === 'oldest' ? ka.datetime - kb.datetime : kb.datetime - ka.datetime;
      if (diff !== 0) return diff;
      return sortDir === 'oldest'
        ? ka.created.localeCompare(kb.created)
        : kb.created.localeCompare(ka.created);
    });
    return list;
  }, [source, filter, query, sortDir]);

  const total = platformTotal ?? totalCount;
  const filtersActive = activeFilterCount > 0 || query.trim().length > 0;

  const todayCount = useMemo(
    () => source.filter((item) => isAppointmentOn(item, todayKey())).length,
    [source],
  );

  const collected = useMemo(
    () =>
      source.reduce((sum, item) => {
        if (appointmentPayment(item).paid) return sum + Number(item.amount || 0);
        return sum;
      }, 0),
    [source],
  );

  const statusValue = (status: string): number | undefined => {
    const normalized = normalizeStatus(status);
    if (statusCounts[normalized] !== undefined) return statusCounts[normalized];
    if (statusCounts[status] !== undefined) return statusCounts[status];
    return undefined;
  };

  function openFilters(): void {
    setDraft(filter);
    setFiltersOpen(true);
  }

  function applyDraft(): void {
    setFilter(draft);
    setFiltersOpen(false);
  }

  function resetAll(): void {
    setFilter(EMPTY_FILTERS);
    setDraft(EMPTY_FILTERS);
    setQuery('');
  }

  const showingInfo = filtersActive
    ? `${visible.length} result(s) · ${source.length} loaded record(s)`
    : `Showing ${visible.length} of ${total}`;
return (
    <AdminModuleScreen
      title="Appointments"
      subtitle={`${total} appointment(s) on the platform`}
      loading={loading}
      error={error}
      onRetry={load}
      loadingComponent={<AppointmentListSkeleton />}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* ---- Summary cards (real values) ---- */}
        <View style={styles.grid}>
          <StatCard label="Total Appointments" value={total} icon="calendar-outline" accent="#2F80ED" hint="Platform-wide" />
          <StatCard label="Pending" value={statusValue('pending') ?? '—'} icon="time-outline" accent="#E89A3C" />
          <StatCard label="Confirmed" value={statusValue('confirmed') ?? '—'} icon="checkmark-circle-outline" accent="#0E9F8E" />
          <StatCard label="Completed" value={statusValue('completed') ?? '—'} icon="checkmark-done-outline" accent="#2E9E5B" />
          <StatCard label="Cancelled" value={statusValue('cancel') ?? '—'} icon="close-circle-outline" accent="#D9435B" />
          <StatCard label="Missed" value={statusValue('missed') ?? '—'} icon="alert-circle-outline" accent="#7B61FF" />
          <StatCard label="Today's" value={todayCount} icon="today-outline" accent="#7B61FF" hint="From loaded records" />
          <StatCard label="Collected" value={formatINR(collected)} icon="wallet-outline" accent="#2E9E5B" hint="Paid · loaded records" />
        </View>

        {/* ---- Search + filters toolbar ---- */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search patient, doctor, appointment ID..." />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open filters"
            onPress={openFilters}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <Ionicons name="options-outline" size={20} color={Palette.primaryDark} />
            <Text style={styles.filterButtonText}>Filters</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ---- Status chips ---- */}
        <FilterChips
          options={STATUS_FILTERS}
          selected={filter.status}
          onSelect={(value) => setFilter((previous) => ({ ...previous, status: value }))}
        />

        {/* ---- Result summary + sort / reset ---- */}
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>{showingInfo}</Text>
          <View style={styles.resultActions}>
            {filtersActive ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
                onPress={resetAll}
                style={({ pressed }) => [styles.iconTextButton, pressed && styles.pressed]}
              >
                <Ionicons name="refresh-outline" size={16} color={Palette.textMuted} />
                <Text style={styles.mutedActionText}>Reset</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle sort order"
              onPress={() => setSortDir((value) => (value === 'newest' ? 'oldest' : 'newest'))}
              style={({ pressed }) => [styles.iconTextButton, pressed && styles.pressed]}
            >
              <Ionicons name={sortDir === 'newest' ? 'arrow-down' : 'arrow-up'} size={16} color={Palette.primaryDark} />
              <Text style={styles.primaryActionText}>{sortDir === 'newest' ? 'Newest first' : 'Oldest first'}</Text>
            </Pressable>
          </View>
        </View>
{/* ---- List: empty / no-results / table / cards ---- */}
        {source.length === 0 ? (
          <EmptyState title="No appointments" message="Bookings will appear here in real time." />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No matching appointments"
            message="Try a different search or filter."
            action={<Button title="Clear search & filters" variant="outline" onPress={resetAll} />}
          />
        ) : isTableLayout ? (
          <View style={styles.tableOuter}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              <View>
                <AppointmentTableHeader />
                {visible.map((item) => (
                  <AppointmentTableRow
                    key={String(item._id)}
                    appointment={item}
                    onPress={() => setSelected(item)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.cardsColumn}>
            {visible.map((item) => (
              <AppointmentRow key={String(item._id)} appointment={item} onPress={() => setSelected(item)} />
            ))}
          </View>
        )}

        {/* ---- Pagination footer ---- */}
        {visible.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {filtersActive
                ? `${visible.length} of ${source.length} loaded record(s) shown`
                : `Showing ${visible.length} of ${total} total · Page ${page}`}
            </Text>
            {loadMoreError ? (
              <View style={styles.loadMoreError}>
                <FormMessage type="error" message={`${loadMoreError} Tap “Load more” to retry.`} />
              </View>
            ) : null}
            {source.length < total && !noMore && !filtersActive && !loadMoreError ? (
              <Button
                title="Load more"
                variant="outline"
                loading={loadingMore}
                onPress={loadMore}
                style={styles.loadMore}
              />
            ) : null}
            {source.length < total && filtersActive && !loadMoreError ? (
              <Button
                title={loadingMore ? 'Loading...' : 'Load more records'}
                variant="outline"
                loading={loadingMore}
                onPress={loadMore}
                style={styles.loadMore}
              />
            ) : null}
            {loadMoreError ? (
              <Button title="Retry" variant="outline" onPress={loadMore} style={styles.loadMore} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ---- Filters modal ---- */}
      <AppointmentFiltersModal
        visible={filtersOpen}
        draft={draft}
        options={filterOptions}
        onChange={setDraft}
        onApply={applyDraft}
        onReset={() => setDraft(EMPTY_FILTERS)}
        onClose={() => setFiltersOpen(false)}
      />

      {/* ---- Details modal ---- */}
      <AppointmentDetailsModal
        appointment={selected}
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </AdminModuleScreen>
  );
}
// ---------------------------------------------------------------------------
// Desktop / tablet table
// ---------------------------------------------------------------------------
interface ColumnSizes {
  ref: number;
  patient: number;
  doctor: number;
  hospital: number;
  department: number;
  dateTime: number;
  status: number;
  payment: number;
  action: number;
}

const COLUMN_SIZES: ColumnSizes = {
  ref: 130,
  patient: 160,
  doctor: 170,
  hospital: 180,
  department: 130,
  dateTime: 150,
  status: 120,
  payment: 130,
  action: 64,
};

const COLUMN_LABELS: (keyof ColumnSizes)[] = [
  'ref',
  'patient',
  'doctor',
  'hospital',
  'department',
  'dateTime',
  'status',
  'payment',
  'action',
];

const COLUMN_HEADERS: Record<keyof ColumnSizes, string> = {
  ref: 'Reference',
  patient: 'Patient',
  doctor: 'Doctor',
  hospital: 'Hospital',
  department: 'Department',
  dateTime: 'Date & Slot',
  status: 'Status',
  payment: 'Payment',
  action: '',
};

function AppointmentTableHeader() {
  return (
    <View style={styles.tableHeaderRow}>
      {COLUMN_LABELS.map((key) => (
        <View key={key} style={{ width: COLUMN_SIZES[key] }}>
          <Text style={styles.tableHeaderCell}>{COLUMN_HEADERS[key]}</Text>
        </View>
      ))}
    </View>
  );
}

function AppointmentTableRow({
  appointment,
  onPress,
}: {
  appointment: Appointment;
  onPress: () => void;
}) {
  const payment = appointmentPayment(appointment);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${appointmentReference(appointment)}`}
      style={({ pressed }) => [styles.tableRow, pressed && styles.tableRowPressed]}
    >
      <View style={{ width: COLUMN_SIZES.ref }}>
        <Text style={styles.cellRef} numberOfLines={1}>
          {appointmentReference(appointment)}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.patient }}>
        <Text style={styles.cellStrong} numberOfLines={1}>
          {appointmentPatientName(appointment)}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.doctor }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {appointmentDoctorName(appointment)}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.hospital }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {appointmentHospitalName(appointment)}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.department }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {appointmentDepartment(appointment) || 'Not available'}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.dateTime }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {formatDDMMYYYY(appointment.slotDate) || '—'} {appointment.slotTime ? `· ${appointment.slotTime}` : ''}
        </Text>
      </View>
      <View style={{ width: COLUMN_SIZES.status }}>
        <StatusBadge value={appointment.status} variant={appointmentStatusBadge(appointment.status)} />
      </View>
      <View style={{ width: COLUMN_SIZES.payment }}>
        <Badge label={payment.label} variant={appointmentPaymentBadge(payment.status)} />
      </View>
      <View style={{ width: COLUMN_SIZES.action, alignItems: 'center' }}>
        <View style={styles.viewIcon}>
          <Ionicons name="eye-outline" size={18} color={Palette.primaryDark} />
        </View>
      </View>
    </Pressable>
  );
}
// ---------------------------------------------------------------------------
// Filters modal
// ---------------------------------------------------------------------------
interface FilterModalOptions {
  hospitals: string[];
  doctors: string[];
  departments: string[];
}

interface AppointmentFiltersModalProps {
  visible: boolean;
  draft: FiltersState;
  options: FilterModalOptions;
  onChange: (next: FiltersState) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

function datePresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const inDays = (days: number): Date => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return [
    { label: 'Today', from: todayKey(), to: todayKey() },
    { label: 'Next 7 days', from: todayKey(), to: toDDMMYYYY(inDays(6)) },
    { label: 'This month', from: toDDMMYYYY(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayKey() },
  ];
}

function ChipSet({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(active ? 'all' : option.value)}
              style={[styles.optionChip, active && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, active && styles.optionChipTextActive]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
function AppointmentFiltersModal({
  visible,
  draft,
  options,
  onChange,
  onApply,
  onReset,
  onClose,
}: AppointmentFiltersModalProps) {
  const presets = datePresets();
  const dateFromInvalid = draft.dateFrom.length > 0 && !/^\d{2}-\d{2}-\d{4}$/.test(draft.dateFrom);
  const dateToInvalid = draft.dateTo.length > 0 && !/^\d{2}-\d{2}-\d{4}$/.test(draft.dateTo);
  const dateInvalid = dateFromInvalid || dateToInvalid;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTexts}>
              <Text style={styles.modalTitle}>Filter appointments</Text>
              <Text style={styles.modalSubtitle}>Options are built from the loaded real records.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={20} color={Palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ChipSet
              title="Payment status"
              options={PAYMENT_FILTERS}
              selected={draft.payment}
              onSelect={(value) => onChange({ ...draft, payment: value })}
            />
            <ChipSet
              title="Hospital"
              options={options.hospitals.map((name) => ({ label: name, value: name }))}
              selected={draft.hospital}
              onSelect={(value) => onChange({ ...draft, hospital: value })}
            />
            <ChipSet
              title="Doctor"
              options={options.doctors.map((name) => ({ label: name, value: name }))}
              selected={draft.doctor}
              onSelect={(value) => onChange({ ...draft, doctor: value })}
            />
            <ChipSet
              title="Department"
              options={options.departments.map((name) => ({ label: name, value: name }))}
              selected={draft.department}
              onSelect={(value) => onChange({ ...draft, department: value })}
            />

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Date range</Text>
              <View style={styles.datePresetRow}>
                {presets.map((preset) => (
                  <Pressable
                    key={preset.label}
                    accessibilityRole="button"
                    onPress={() => onChange({ ...draft, dateFrom: preset.from, dateTo: preset.to })}
                    style={[styles.optionChip, styles.datePresetChip]}
                  >
                    <Text style={styles.optionChipText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.dateInputRow}>
                <Input
                  value={draft.dateFrom}
                  onChangeText={(value) => onChange({ ...draft, dateFrom: value.toUpperCase() })}
                  placeholder="From DD-MM-YYYY"
                  keyboardType="numbers-and-punctuation"
                  containerStyle={styles.dateInput}
                  error={dateFromInvalid ? 'DD-MM-YYYY' : undefined}
                />
                <Input
                  value={draft.dateTo}
                  onChangeText={(value) => onChange({ ...draft, dateTo: value.toUpperCase() })}
                  placeholder="To DD-MM-YYYY"
                  keyboardType="numbers-and-punctuation"
                  containerStyle={styles.dateInput}
                  error={dateToInvalid ? 'DD-MM-YYYY' : undefined}
                />
              </View>
              {dateInvalid ? (
                <FormMessage type="error" message="Enter valid dates in DD-MM-YYYY format." />
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button title="Clear" variant="ghost" onPress={onReset} style={styles.footerBtn} />
            <Button
              title="Apply filters"
              variant="primary"
              onPress={onApply}
              disabled={dateInvalid}
              style={styles.footerBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: Spacing.xxxl, gap: Spacing.md, paddingHorizontal: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },

  // ---- Toolbar ----
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  searchWrap: { flex: 1 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  filterButtonText: { ...Typography.label, color: Palette.primaryDark },
  filterCountBadge: {
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountText: { ...Typography.caption, color: Palette.white, fontWeight: '700' },
  pressed: { opacity: 0.7 },

  // ---- Result row ----
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  resultText: { ...Typography.caption, color: Palette.textMuted },
  resultActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  iconTextButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.xs },
  mutedActionText: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600' },
  primaryActionText: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },

  // ---- Table ----
  tableOuter: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  tableHeaderCell: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  tableRowPressed: { backgroundColor: Palette.primaryLight },
  cellRef: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },
  cellStrong: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  cellText: { ...Typography.bodySmall, color: Palette.text },
  viewIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Card list ----
  cardsColumn: { gap: Spacing.md },

  // ---- Pagination footer ----
  footer: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  footerText: { ...Typography.caption, color: Palette.textMuted },
  loadMore: { minHeight: 46, minWidth: 200, alignSelf: 'center' },
  loadMoreError: { width: '100%' },

  // ---- Filters modal ----
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
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  modalHeaderTexts: { flex: 1, gap: 2 },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalSubtitle: { ...Typography.caption, color: Palette.textMuted },
  iconButton: {
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
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  filterGroupTitle: {
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
  optionChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  optionChipText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Palette.textMuted,
  },
  optionChipTextActive: {
    color: Palette.white,
  },
  datePresetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  datePresetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  dateInputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  dateInput: { flex: 1, minWidth: 180 },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  footerBtn: { flex: 1, minHeight: 48 },
});