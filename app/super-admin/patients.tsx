/**
 * HealPoint - Super Admin · Patients.
 *
 * Professional patient/ user management page backing by REAL existing backend
 * endpoints — nothing is invented:
 *   - patient list + server-side search + status filter (GET /user/admin/users
 *     with role=patient&search=&isActive=&page=&limit=). Server-side search
 *     covers name/email/phone exactly as the Users module already does.
 *   - summary cards from REAL platform counts (Total/Active/Inactive patients via
 *     the same endpoint with server-side `isActive` filters; total appointments from
 *     GET /user/get-stats). No hardcoded numbers.
 *   - details view shows the patient's REAL profile fields (from the sanitized
 *     admin user list record) plus their REAL appointments (fetched via the
 *     platform `/appointment/get-all?platform=1` list and filtered by the patient's
 *     real `userId` — doctor/hospital names come from the populated relationships, no
 *     hardcoded names).
 *   - activate/suspend via the existing-style backend endpoint
 *     PATCH /user/admin/users/:id/status (route-guarded to Super Admin; the
 *     backend persists `isActive` to MongoDB and the response only contains the
 *     sanitised user — never a password or hash).
 *
 * Layout is responsive: a professional table on desktop/laptop, card rows on
 * tablet and phone. Details modal, status confirmation, skeleton, empty and
 * error states all follow the existing HealPoint design system.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { useResponsiveVariant } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import { getAllAdminAppointments } from '@/services/appointments';
import { getPlatformStats, getPlatformUsers, updatePatientStatus } from '@/services/users';
import type { Appointment, PlatformUser } from '@/types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

function patientInitials(name?: string): string {
  return (name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

/** The patient's real id from an appointment (userId is populated in platform mode). */
function appointmentPatientId(appointment: Appointment): string | null {
  const userId = appointment.userId as unknown as { _id?: unknown } | string | null;
  if (userId && typeof userId === 'object' && userId._id) return String(userId._id);
  if (typeof userId === 'string' && userId) return userId;
  return null;
}

function appointmentDoctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId as unknown;
  if (doctor && typeof doctor === 'object' && typeof (doctor as { name?: unknown }).name === 'string') {
    return (doctor as { name: string }).name;
  }
  return 'Doctor';
}

function appointmentDoctorDepartment(appointment: Appointment): string {
  const doctor = appointment.doctorId as unknown;
  if (doctor && typeof doctor === 'object' && typeof (doctor as { department?: unknown }).department === 'string') {
    return (doctor as { department: string }).department;
  }
  return '';
}

function appointmentHospitalName(appointment: Appointment): string {
  if (appointment.hospitalName) return appointment.hospitalName;

  const hospital = appointment.hospitalId as unknown;
  if (hospital && typeof hospital === 'object' && typeof (hospital as { name?: unknown }).name === 'string') {
    return (hospital as { name: string }).name;
  }
  if (typeof appointment.hospitalId === 'string') return 'Hospital';
  return 'Unassigned';
}

function appointmentStatusValue(status: string): string {
  if (!status) return 'pending';
  if (status.toLowerCase() === 'cancel') return 'cancelled';
  return status.toLowerCase();
}
export default function SuperAdminPatientsScreen() {
  const variant = useResponsiveVariant();
  const isDesktop = variant === 'desktop';

  const [patients, setPatients] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Summary counts (exact server-side counts; limit=1 keeps them light).
  const [totals, setTotals] = useState({ total: 0, active: 0, inactive: 0, appointments: 0 });

  // Filters + search.
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [statusAction, setStatusAction] = useState<{ patient: PlatformUser; activate: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Patient details modal + appointments state.
  const [detailsAppointments, setDetailsAppointments] = useState<Appointment[] | null>(null);
  const [detailsLoadingAppointments, setDetailsLoadingAppointments] = useState(false);
  const [detailsErrorAppointments, setDetailsErrorAppointments] = useState('');
  const appointmentsCache = useRef(new Map<string, Appointment[]>());

  const loadCounts = useCallback(async () => {
    try {
      const [totalRes, activeRes, inactiveRes, statsRes] = await Promise.all([
        getPlatformUsers({ role: 'patient', limit: 1 }),
        getPlatformUsers({ role: 'patient', isActive: 'true', limit: 1 }),
        getPlatformUsers({ role: 'patient', isActive: 'false', limit: 1 }),
        getPlatformStats().catch(() => null),
      ]);
      setTotals({
        total: totalRes.totalCount || 0,
        active: activeRes.totalCount || 0,
        inactive: inactiveRes.totalCount || 0,
        appointments: statsRes?.stats?.totalAppointments ?? 0,
      });
    } catch {
      // Summary cards are best-effort — never block the list for them.
    }
  }, []);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const res = await getPlatformUsers({
          search: query.trim() || undefined,
          role: 'patient',
          isActive: status === 'all' ? undefined : status,
          page: nextPage,
          limit: 30,
        });
        setPatients(append ? (prev) => [...prev, ...res.users] : res.users);
        setTotal(res.totalCount);
        setPage(nextPage);
      } catch (err) {
        setError(toErrorMessage(err, 'Unable to load patients.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, status],
  );

  // Debounced server-side search: wait for the user to stop typing, then load.
  useEffect(() => {
    const timer = setTimeout(() => load(1), 350);
    return () => clearTimeout(timer);
  }, [query, status, load]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const onEndReached = () => {
    if (!loading && !loadingMore && patients.length < total) load(page + 1, true);
  };

  function clearFilters() {
    setQuery('');
    setStatus('all');
  }

  function openDetails(patient: PlatformUser) {
    setSelected(patient);
    setDetailsAppointments(null);
    setDetailsErrorAppointments('');
    const cached = appointmentsCache.current.get(String(patient._id));
    if (cached) {
      setDetailsAppointments(cached);
      return;
    }
    setDetailsLoadingAppointments(true);
    getAllAdminAppointments({ platform: true, limit: 200 })
      .then((res) => {
        const mine = (res.appointments || []).filter(
          (a) => appointmentPatientId(a) === String(patient._id),
        );
        appointmentsCache.current.set(String(patient._id), mine);
        setDetailsAppointments(mine);
      })
      .catch((err) => setDetailsErrorAppointments(toErrorMessage(err, 'Unable to load appointments.')))
      .finally(() => setDetailsLoadingAppointments(false));
  }

  async function runStatusAction() {
    if (!statusAction) return;
    const { patient, activate } = statusAction;
    setStatusLoading(true);
    setActionError('');
    try {
      await updatePatientStatus(String(patient._id), activate);
      setStatusAction(null);
      setSelected(null);
      load(1);
      loadCounts();
    } catch (err) {
      setStatusAction(null);
      setActionError(
        toErrorMessage(err, activate ? 'Unable to activate patient.' : 'Unable to suspend patient.'),
      );
    } finally {
      setStatusLoading(false);
    }
  }

  const headerSection = (
    <View style={styles.headerWrap}>
      <View style={styles.grid}>
        <StatCard label="Patients" value={totals.total} icon="people-outline" accent="#2F80ED" hint="Total accounts" />
        <StatCard label="Active" value={totals.active} icon="checkmark-done-outline" accent="#2E9E5B" hint="Can sign in" />
        <StatCard label="Inactive" value={totals.inactive} icon="pause-circle-outline" accent="#D9435B" hint="Suspended" />
        <StatCard label="Appointments" value={totals.appointments} icon="calendar-outline" accent="#E89A3C" hint="Platform total" />
      </View>

      {actionError ? <FormMessage type="error" message={actionError} /> : null}

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search patient name, email or phone..."
      />
      <FilterChips options={STATUS_FILTERS} selected={status} onSelect={setStatus} />

      <View style={styles.resultRow}>
        <Text style={styles.resultText}>
          Showing {patients.length} of {total} patients
        </Text>
        {query.trim() || status !== 'all' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search and filters"
            onPress={clearFilters}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <AdminModuleScreen
      title="Patients"
      subtitle={`${total} patient account(s)`}
      loading={loading}
      loadingComponent={<PatientsSkeleton />}
      error={error}
      onRetry={() => load(1)}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh patients"
          onPress={() => load(1)}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={20} color={Palette.primaryDark} />
        </Pressable>
      }
    >
      {isDesktop ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.desktopContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(1)} />}
        >
          <View style={styles.desktopPage}>
            {headerSection}
            <Card padded={false} style={styles.tableCard}>
              {patients.length > 0 ? <PatientsTableHeader /> : null}
              {patients.map((patient) => (
                <PatientsTableRow
                  key={String(patient._id)}
                  patient={patient}
                  onView={() => openDetails(patient)}
                  onToggleStatus={() => setStatusAction({ patient, activate: patient.isActive === false })}
                />
              ))}
              {loadingMore ? (
                <ActivityIndicator color={Palette.primary} style={styles.tableLoadMore} />
              ) : null}
              {patients.length === 0 && !loading ? (
                <View style={styles.tableEmpty}>
                  <EmptyState
                    title={total === 0 ? 'No patients found' : 'No matching patients'}
                    message={
                      total === 0
                        ? 'Patient accounts will appear here once users register.'
                        : 'Try a different search or filter.'
                    }
                  />
                </View>
              ) : null}
            </Card>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          data={patients}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(1)} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={headerSection}
          ListEmptyComponent={
            !loading ? (
              total === 0 ? (
                <EmptyState
                  title="No patients found"
                  message="Patient accounts will appear here once users register."
                />
              ) : (
                <EmptyState title="No matching patients" message="Try a different search or filter." />
              )
            ) : null
          }
          renderItem={({ item }) => (
            <PatientCardRow
              patient={item}
              onPress={() => openDetails(item)}
              onToggleStatus={() => setStatusAction({ patient: item, activate: item.isActive === false })}
            />
          )}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={Palette.primary} style={styles.footer} /> : null
          }
        />
      )}
      {/* ---- Patient details modal (real profile + real appointments) ---- */}
      {selected ? (
        <PatientDetailsModal
          patient={selected}
          appointments={detailsAppointments}
          appointmentsLoading={detailsLoadingAppointments}
          appointmentsError={detailsErrorAppointments}
          onToggleStatus={() => {
            setSelected(null);
            setDetailsAppointments(null);
            setStatusAction({ patient: selected, activate: selected.isActive === false });
          }}
          onClose={() => {
            setSelected(null);
            setDetailsAppointments(null);
            setDetailsErrorAppointments('');
          }}
        />
      ) : null}

      {/* ---- Suspend / Activate confirmation ---- */}
      <ConfirmDialog
        visible={Boolean(statusAction)}
        title={statusAction?.activate ? 'Activate patient?' : 'Suspend patient?'}
        message={
          statusAction?.activate
            ? `${statusAction?.patient?.name || 'This patient'} will be able to sign in and book appointments again.`
            : `${statusAction?.patient?.name || 'This patient'} will no longer be able to sign in until reactivated. Existing appointment history is preserved.`
        }
        confirmLabel={statusAction?.activate ? 'Activate' : 'Suspend'}
        tone={statusAction?.activate ? 'primary' : 'danger'}
        loading={statusLoading}
        onConfirm={runStatusAction}
        onCancel={() => setStatusAction(null)}
      />
    </AdminModuleScreen>
  );
}
/** Column header for the desktop table. */
function PatientsTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <View style={styles.colPatient}>
        <Text style={styles.tableHeaderCell}>Patient</Text>
      </View>
      <View style={styles.colContact}>
        <Text style={styles.tableHeaderCell}>Contact</Text>
      </View>
      <View style={styles.colStatus}>
        <Text style={styles.tableHeaderCell}>Status</Text>
      </View>
      <View style={styles.colJoined}>
        <Text style={styles.tableHeaderCell}>Registered</Text>
      </View>
      <View style={[styles.colActions, styles.tableHeaderActions]}>
        <Text style={styles.tableHeaderCell}>Actions</Text>
      </View>
    </View>
  );
}

function PatientActionButton({
  icon,
  label,
  onPress,
  tone = 'primary',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'danger' | 'success';
}) {
  const color =
    tone === 'danger' ? Palette.error : tone === 'success' ? Palette.success : Palette.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.tableIconBtn, pressed && styles.iconPressed]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Desktop/laptop table row. */
function PatientsTableRow({
  patient,
  onView,
  onToggleStatus,
}: {
  patient: PlatformUser;
  onView: () => void;
  onToggleStatus: () => void;
}) {
  const isActive = patient.isActive !== false;
  return (
    <View style={styles.tableRow}>
      <View style={styles.colPatient}>
        <PatientAvatar name={patient.name} image={patient.image} size={36} />
        <View style={styles.tablePatientTexts}>
          <Text style={styles.tableName} numberOfLines={1}>{patient.name || 'Patient'}</Text>
          <Text style={styles.muted} numberOfLines={1}>{patient.email || 'No email'}</Text>
        </View>
      </View>
      <View style={styles.colContact}>
        <Text style={styles.tableCell} numberOfLines={1}>{patient.phone || '—'}</Text>
      </View>
      <View style={styles.colStatus}>
        <StatusBadge value={isActive ? 'active' : 'inactive'} />
      </View>
      <View style={styles.colJoined}>
        <Text style={styles.tableCell} numberOfLines={1}>{formatISODate(patient.createdAt)}</Text>
      </View>
      <View style={styles.colActions}>
        <PatientActionButton icon="eye-outline" label="View patient details" tone="primary" onPress={onView} />
        <PatientActionButton
          icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          label={isActive ? 'Suspend patient' : 'Activate patient'}
          tone={isActive ? 'danger' : 'success'}
          onPress={onToggleStatus}
        />
      </View>
    </View>
  );
}

/** Mobile / tablet patient card — press for details, button for status. */
function PatientCardRow({
  patient,
  onPress,
  onToggleStatus,
}: {
  patient: PlatformUser;
  onPress: () => void;
  onToggleStatus: () => void;
}) {
  const isActive = patient.isActive !== false;
  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${patient.name || 'this patient'}`}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <View style={styles.rowHeader}>
          <PatientAvatar name={patient.name} image={patient.image} size={48} />
          <View style={styles.rowTitles}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{patient.name || 'Patient'}</Text>
              <StatusBadge value={isActive ? 'active' : 'inactive'} />
            </View>
            <Text style={styles.muted} numberOfLines={1}>{patient.email || 'No email'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
        </View>
        <View style={styles.metaRow}>
          {patient.phone ? (
            <Text style={styles.meta} numberOfLines={1}>
              <Ionicons name="call-outline" size={13} color={Palette.textMuted} /> {patient.phone}
            </Text>
          ) : null}
          {patient.createdAt ? (
            <Text style={styles.meta} numberOfLines={1}>
              <Ionicons name="calendar-outline" size={13} color={Palette.textMuted} /> Joined {formatISODate(patient.createdAt)}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Button
          title={isActive ? 'Suspend' : 'Activate'}
          variant={isActive ? 'danger' : 'secondary'}
          fullWidth={false}
          icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          style={styles.actionButton}
          onPress={onToggleStatus}
        />
      </View>
    </Card>
  );
}

/** Rounded avatar with photo fallback to initials. */
function PatientAvatar({ name, image, size = 48 }: { name?: string; image?: string; size?: number }) {
  const initials = patientInitials(name);
  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}
interface PatientDetailsModalProps {
  patient: PlatformUser;
  appointments: Appointment[] | null;
  appointmentsLoading: boolean;
  appointmentsError: string;
  onToggleStatus: () => void;
  onClose: () => void;
}

/** Professional patient details modal — real profile + real appointments. */
function PatientDetailsModal({
  patient,
  appointments,
  appointmentsLoading,
  appointmentsError,
  onToggleStatus,
  onClose,
}: PatientDetailsModalProps) {
  const isActive = patient.isActive !== false;
  const joined = formatISODate(patient.createdAt);
  const appointmentsCount = appointments?.length ?? (appointmentsLoading ? undefined : null);

  const accountInfo = [
    { label: 'Email', value: patient.email || '—' },
    { label: 'Phone', value: patient.phone || '—' },
    { label: 'Gender', value: patient.gender || 'Not available' },
    { label: 'Date of birth', value: patient.dob ? formatISODate(patient.dob) : 'Not available' },
    { label: 'Status', value: isActive ? 'Active' : 'Inactive' },
    { label: 'Registered', value: joined },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <Card style={styles.detailsCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <PatientAvatar name={patient.name} image={patient.image} size={72} />
              <View style={styles.modalHeaderTexts}>
                <Text style={styles.detailsName} numberOfLines={2}>{patient.name || 'Patient'}</Text>
                <Text style={styles.modalEmail} numberOfLines={1}>{patient.email || 'No email'}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close details" hitSlop={8}>
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <StatusBadge value={isActive ? 'active' : 'inactive'} />
              <Badge label="Patient" variant="primary" />
              {appointmentsCount !== undefined && appointmentsCount !== null ? (
                <Badge label={`${appointmentsCount} appointment(s)`} variant="neutral" />
              ) : null}
            </View>

            <View style={styles.detailGrid}>
              {accountInfo.map((item) => (
                <View key={item.label} style={styles.detailCol}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Appointments</Text>
              {appointmentsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Palette.primary} size="small" />
                  <Text style={styles.sectionValue}>Loading appointments…</Text>
                </View>
              ) : appointmentsError ? (
                <Text style={styles.errorText}>{appointmentsError}</Text>
              ) : appointments && appointments.length > 0 ? (
                <View style={styles.apptList}>
                  {appointments.slice(0, 8).map((a) => {
                    const statusLabel = appointmentStatusValue(a.status);
                    return (
                      <View key={String(a._id)} style={styles.apptRow}>
                        <View style={styles.apptIcon}>
                          <Ionicons name="calendar-outline" size={16} color={Palette.primaryDark} />
                        </View>
                        <View style={styles.apptTexts}>
                          <Text style={styles.apptDoctor} numberOfLines={1}>{appointmentDoctorName(a)}</Text>
                          <Text style={styles.apptMeta} numberOfLines={1}>
                            {appointmentHospitalName(a)}
                            {appointmentDoctorDepartment(a) ? ` · ${appointmentDoctorDepartment(a)}` : ''}
                          </Text>
                          <Text style={styles.apptMeta} numberOfLines={1}>
                            {formatISODate(a.slotDate)} · {a.slotTime || '—'}
                          </Text>
                        </View>
                        <StatusBadge value={statusLabel} />
                      </View>
                    );
                  })}
                  {appointments.length > 8 ? (
                    <Text style={styles.moreHint}>+{appointments.length - 8} more appointment(s)</Text>
                  ) : null}
                </View>
              ) : appointments && appointments.length === 0 ? (
                <Text style={styles.sectionValue}>No appointments yet.</Text>
              ) : (
                <Text style={styles.sectionValue}>Appointment history unavailable.</Text>
              )}
            </View>

            <View style={styles.actionBlock}>
              <Text style={styles.blockLabel}>Account actions</Text>
              <View style={styles.actionGrid}>
                <Button
                  title={isActive ? 'Suspend account' : 'Activate account'}
                  variant={isActive ? 'danger' : 'secondary'}
                  icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  style={styles.actionBtn}
                  onPress={onToggleStatus}
                />
              </View>
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}
/** Skeleton shown while the patient list loads. */
function PatientsSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((key) => (
        <Card key={key} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, { width: 48, height: 48, borderRadius: 24 }]} />
            <View style={styles.skeletonTexts}>
              <View style={[styles.skeletonBlock, { width: '55%', height: 14 }]} />
              <View style={[styles.skeletonBlock, { width: '80%', height: 12 }]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, { width: '40%', height: 12, marginTop: Spacing.md }]} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  cardPressed: { opacity: 0.75 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header / summary
  headerWrap: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  resultText: { ...Typography.caption, color: Palette.textMuted },
  clearText: { ...Typography.bodySmall, color: Palette.primary, fontWeight: '600' },
  // Desktop table
  desktopContent: { paddingBottom: Spacing.xxxl },
  desktopPage: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tableCard: { borderColor: Palette.border },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.primaryLight,
  },
  tableHeaderCell: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableHeaderActions: { justifyContent: 'flex-end' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  tableName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  tableCell: { ...Typography.bodySmall, color: Palette.text },
  tablePatientTexts: { flex: 1, gap: 2 },
  tableLoadMore: { paddingVertical: Spacing.lg },
  tableEmpty: { paddingVertical: Spacing.lg },
  tableIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primaryLight,
  },
  iconPressed: { opacity: 0.6, transform: [{ scale: 0.95 }] },
  colPatient: { flex: 2.4, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: Spacing.sm },
  colContact: { flex: 1.9, paddingRight: Spacing.sm },
  colStatus: { flex: 1.1, paddingRight: Spacing.sm },
  colJoined: { flex: 1.3, paddingRight: Spacing.sm },
  colActions: { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.xs },
  // Mobile / tablet cards
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  name: { ...Typography.h4, color: Palette.text, flexShrink: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  meta: { ...Typography.caption, color: Palette.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1, minHeight: 44 },
  footer: { paddingVertical: Spacing.lg },
  avatar: { backgroundColor: Palette.primaryLight },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.label, color: Palette.primaryDark, fontWeight: '700' },
  // Modal shared
  backdrop: { flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalHeaderTexts: { flex: 1, gap: 2 },
  modalContent: { padding: Spacing.xl, gap: Spacing.md },
  detailsCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  detailsName: { ...Typography.h4, color: Palette.text },
  modalEmail: { ...Typography.caption, color: Palette.textMuted },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  detailCol: { flex: 1, minWidth: '40%', gap: 2 },
  detailLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { ...Typography.bodySmall, color: Palette.text },
  sectionCard: {
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  sectionTitle: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  sectionValue: { ...Typography.bodySmall, color: Palette.text },
  errorText: { ...Typography.bodySmall, color: Palette.error },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  apptList: { gap: Spacing.sm },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  apptIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptTexts: { flex: 1, gap: 1 },
  apptDoctor: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  apptMeta: { ...Typography.caption, color: Palette.textMuted },
  moreHint: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },
  actionBlock: { gap: Spacing.sm },
  blockLabel: { ...Typography.label, color: Palette.text },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexGrow: 1, minWidth: 160, minHeight: 44 },
  // Skeleton
  skeletonList: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  skeletonCard: { gap: Spacing.xs },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  skeletonTexts: { flex: 1, gap: Spacing.sm },
  skeletonBlock: { backgroundColor: Palette.divider, borderRadius: Radius.sm },
});
