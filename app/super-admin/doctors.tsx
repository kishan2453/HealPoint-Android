/**
 * HealPoint - Super Admin · Doctors.
 *
 * Professional platform-wide doctor management backed by REAL data only:
 *   - full platform doctor list from `/doctor/get-all` (super-admin platform
 *     mode, which the previous generic directory never requested — it silently
 *     fell back to the public/patient list)
 *   - REAL backend search (name / speciality / hospital) through `search`
 *   - verification filter via the supported `verificationStatus` param +
 *     hospital/status filters derived from the returned records
 *   - real appointment counts from `/appointment/get-all` (platform) — the
 *     same endpoint already used by the Super Admin Hospital & Appointments
 *     screens
 *   - verified actions only: Approve/Reject verification and
 *     Available/Unavailable (both proven endpoints used by the existing
 *     Super Admin / Hospital Admin modules). Nothing is faked locally.
 *
 * Loading skeleton, "No doctors found" empty state and "Unable to load
 * doctors" retry state are all handled so the page never gets stuck loading.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { DoctorEmailAuditCard } from '@/components/admin/DoctorEmailAuditCard';
import { DoctorListSkeleton } from '@/components/admin/DoctorListSkeleton';
import { DoctorRow } from '@/components/admin/DoctorRow';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge, verificationStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import { doctorHospitalName, doctorSpecialty, nextAvailableSlot } from '@/lib/doctor';
import { buildDoctorEmailAudit } from '@/lib/doctor-email';
import { useResponsiveVariant } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import * as appointmentService from '@/services/appointments';
import { getAllDoctors, getDoctorDetails } from '@/services/doctors';
import type { Appointment, Doctor } from '@/types';

const VERIFICATION_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Verified', value: 'Verified' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Correction', value: 'Correction Requested' },
];

const STATUS_FILTERS = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

type DoctorAction = 'approve' | 'reject' | 'available' | 'unavailable';

function doctorActive(doctor: Doctor): boolean {
  return doctor.isActive !== false;
}

function appointmentDoctorId(item: Appointment): string | null {
  if (typeof item.doctorId === 'object' && item.doctorId?._id) return String(item.doctorId._id);
  if (typeof item.doctorId === 'string') return String(item.doctorId);
  return null;
}
export default function SuperAdminDoctorsScreen() {
  const variant = useResponsiveVariant();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [verificationCounts, setVerificationCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loadedAll, setLoadedAll] = useState(0);
  const [query, setQuery] = useState('');
  const [verif, setVerif] = useState('all');
  const [status, setStatus] = useState('all');
  const [hospital, setHospital] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [pendingAction, setPendingAction] = useState<{ doctor: Doctor; type: DoctorAction } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState('');

  /** Real doctor list from the platform endpoint (backend `search` + `verificationStatus`). */
  const loadDoctors = useCallback(async (asRefresh = false, searchOverride?: string, verifOverride?: string) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const search = searchOverride !== undefined ? searchOverride : query.trim();
      const verifValue = verifOverride !== undefined ? verifOverride : verif;
      const res = await getAllDoctors({
        platform: true,
        search: search || undefined,
        verificationStatus: verifValue === 'all' ? undefined : verifValue,
        limit: 200,
      });
      setDoctors(res.doctors || []);
      setTotal(res.totalCount || 0);
      setLoadedAll((res.doctors || []).length);
      const verificationMap: Record<string, number> = {};
      (res.verificationCounts || []).forEach((item) => {
        verificationMap[item._id] = item.count;
      });
      setVerificationCounts(verificationMap);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, verif]);

  /** Real appointment counts per doctor — fetched once with the platform endpoint. */
  const loadAppointmentCounts = useCallback(async () => {
    try {
      const apptRes = await appointmentService.getAllAdminAppointments({ platform: true, limit: 200 });
      const countMap: Record<string, number> = {};
      (apptRes.appointments || []).forEach((appt) => {
        const docId = appointmentDoctorId(appt);
        if (docId) countMap[docId] = (countMap[docId] || 0) + 1;
      });
      setAppointmentCounts(countMap);
    } catch {
      // Appointment counts are an enhancement — the doctor list still loads.
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    loadAppointmentCounts();
  }, [loadAppointmentCounts]);

  // ---- Filters derived from the REAL loaded records -------------------------
  const hospitalOptions = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((doctor) => {
      const name = doctorHospitalName(doctor);
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => ({ label: name, value: name }));
  }, [doctors]);

  const visibleDoctors = useMemo(() => {
    let list = doctors;
    if (status === 'inactive') list = list.filter((d) => !doctorActive(d));
    if (status === 'active') list = list.filter((d) => doctorActive(d));
    if (hospital !== 'all') list = list.filter((d) => doctorHospitalName(d) === hospital);
    return list;
  }, [doctors, status, hospital]);
const stats = useMemo(() => {
    const active = doctors.filter((d) => doctorActive(d)).length;
    const raw: Record<string, number> = {};
    doctors.forEach((d) => {
      const key = String(d.verificationStatus || 'Pending');
      raw[key] = (raw[key] || 0) + 1;
    });
    // Prefer server-provided counts when they cover the whole catalog.
    const pending =
      verificationCounts.Pending ??
      verificationCounts.pending ??
      raw.Pending ??
      raw.pending ??
      0;
    return {
      total: total || doctors.length,
      active,
      pending,
      verified: raw.Verified ?? raw.verified ?? 0,
      loaded: loadedAll || doctors.length,
    };
  }, [doctors, total, verificationCounts, loadedAll]);

  /** Email ↔ login consistency audit, computed from the REAL loaded records. */
  const emailAudit = useMemo(() => buildDoctorEmailAudit(doctors), [doctors]);

  const openDetails = (doctor: Doctor) => {
    setSelected(doctor);
    setNotice('');
    // Fetch the fuller record for the details view (public endpoint). Quiet:
    // the list record already renders instantly; details enrich in place.
    getDoctorDetails(String(doctor._id))
      .then((res) => {
        setSelected((prev) => (prev && String(prev._id) === doctor._id ? res.doctor : prev));
      })
      .catch(() => {
        // Keep showing the list record — details never block the modal.
      });
  };

  /** Update a doctor in both the list and the open details modal (real change). */
  const applyLocalUpdate = (doctorId: string, updater: (d: Doctor) => Doctor) => {
    setDoctors((prev) => prev.map((d) => (String(d._id) === doctorId ? updater(d) : d)));
    setSelected((prev) => (prev && String(prev._id) === doctorId ? updater(prev) : prev));
  };

  const runAction = async () => {
    if (!pendingAction) return;
    const { doctor, type } = pendingAction;
    setActionLoading(true);
    setNotice('');
    try {
      if (type === 'approve') {
        await adminService.updateDoctorVerificationStatus(String(doctor._id), {
          status: 'Verified',
          note: 'Approved by Super Admin',
        });
        applyLocalUpdate(doctor._id, (d) => ({ ...d, verificationStatus: 'Verified' }));
        setNotice(`${doctor.name} was verified.`);
      } else if (type === 'reject') {
        await adminService.updateDoctorVerificationStatus(String(doctor._id), {
          status: 'Rejected',
          note: 'Rejected by Super Admin',
        });
        applyLocalUpdate(doctor._id, (d) => ({ ...d, verificationStatus: 'Rejected' }));
        setNotice(`${doctor.name} was rejected.`);
      } else {
        const available = type === 'available';
        await adminService.toggleDoctorAvailability(String(doctor._id), available);
        applyLocalUpdate(doctor._id, (d) => ({ ...d, available, onlineStatus: available ? 'online' : 'offline' }));
        setNotice(`${doctor.name} marked ${available ? 'available' : 'unavailable'}.`);
      }
      setPendingAction(null);
      loadDoctors(); // refresh real backend state in the background
    } catch (err) {
      setError(toErrorMessage(err, 'Action failed.'));
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const isDesktop = variant === 'desktop';
  const numColumns = isDesktop ? 2 : 1;

  return (
    <AdminModuleScreen
      title="Doctors"
      subtitle={`${stats.total} doctor(s) on the platform`}
      loading={loading}
      loadingComponent={<DoctorListSkeleton />}
      error={error}
      onRetry={() => loadDoctors(true)}
    >
      <FlatList
        key={numColumns}
        data={visibleDoctors}
        keyExtractor={(item) => String(item._id)}
        numColumns={numColumns}
        columnWrapperStyle={isDesktop ? styles.columns : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDoctors(true)} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <DoctorEmailAuditCard audit={emailAudit} />
            <View style={styles.grid}>
              <StatCard label="Doctors" value={stats.total} icon="medkit-outline" accent="#0E9F8E" />
              <StatCard label="Active" value={stats.active} icon="checkmark-done-outline" accent="#2E9E5B" />
              <StatCard label="Pending verification" value={stats.pending} icon="time-outline" accent="#E89A3C" />
              <StatCard label="Verified" value={stats.verified} icon="shield-checkmark-outline" accent="#2E9E5B" />
            </View>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search doctor, speciality or hospital..."
            />
            <FilterChips options={VERIFICATION_FILTERS} selected={verif} onSelect={setVerif} />
            <FilterChips options={STATUS_FILTERS} selected={status} onSelect={setStatus} />
            <FilterChips
              options={[{ label: 'All Hospitals', value: 'all' }, ...hospitalOptions]}
              selected={hospital}
              onSelect={setHospital}
            />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            doctors.length === 0 ? (
              <EmptyState title="No doctors found" message="Doctors will appear here once they are added to the platform." />
            ) : (
              <EmptyState title="No matching doctors" message="Try a different search or filter." />
            )
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={isDesktop ? styles.cell : undefined}>
            <DoctorRow
              doctor={item}
              index={index}
              appointmentCount={appointmentCounts[String(item._id)]}
              onPress={() => openDetails(item)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      {selected ? (
        <DoctorDetailsModal
          doctor={selected}
          appointmentCount={appointmentCounts[String(selected._id)]}
          notice={notice}
          actionLoading={actionLoading}
          pendingAction={pendingAction}
          onRequestAction={(type) => setPendingAction({ doctor: selected, type })}
          onCancelAction={() => setPendingAction(null)}
          onRunAction={runAction}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </AdminModuleScreen>
  );
}

interface DoctorDetailsModalProps {
  doctor: Doctor;
  appointmentCount?: number;
  notice: string;
  actionLoading: boolean;
  pendingAction: { doctor: Doctor; type: DoctorAction } | null;
  onRequestAction: (type: DoctorAction) => void;
  onCancelAction: () => void;
  onRunAction: () => void;
  onClose: () => void;
}

/** Professional Super Admin doctor details modal — everything from the REAL record. */
function DoctorDetailsModal({
  doctor,
  appointmentCount,
  notice,
  actionLoading,
  pendingAction,
  onRequestAction,
  onCancelAction,
  onRunAction,
  onClose,
}: DoctorDetailsModalProps) {
  const specialty = doctorSpecialty(doctor);
  const hospitalName = doctorHospitalName(doctor);
  const hospital = typeof doctor.hospitalId === 'object' ? doctor.hospitalId : undefined;
  const nextSlot = nextAvailableSlot(doctor);
  const slotCount = (doctor.timeSlots || []).filter((slot) => slot.isAvailable !== false).length;
  const isVerified = String(doctor.verificationStatus || '').toLowerCase() === 'verified';
  const isRejected = String(doctor.verificationStatus || '').toLowerCase() === 'rejected';
  const active = doctorActive(doctor);
  const availableNow = doctor.available === true || doctor.onlineStatus === 'online';
  const skills = [
    { label: 'Department', value: doctor.department || '—' },
    { label: 'Degree', value: doctor.degree || '—' },
    { label: 'Experience', value: `${doctor.experience ?? 0} yrs` },
    { label: 'Consultation fee', value: formatINR(doctor.fees) },
    { label: 'Rating', value: `${Number(doctor.rating || 0).toFixed(1)} (${doctor.reviewCount || 0})` },
    { label: 'Gender', value: doctor.gender || '—' },
    { label: 'Languages', value: (doctor.languages || []).join(', ') || '—' },
    { label: 'Appointments', value: String(appointmentCount ?? 0) },
    { label: 'Available slots', value: String(slotCount) },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={actionLoading ? undefined : onClose} accessibilityLabel="Dismiss" />
        <Card style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Image
                source={{ uri: getDoctorImage(doctor) }}
                style={styles.modalAvatar}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.modalHeaderTexts}>
                <Text style={styles.modalName} numberOfLines={2}>{doctor.name || 'Doctor'}</Text>
                <Text style={styles.modalSpecialty} numberOfLines={2}>{specialty}</Text>
                <Text style={styles.modalHospital} numberOfLines={2}>
                  <Ionicons name="business-outline" size={13} color={Palette.textMuted} /> {hospitalName}
                </Text>
                <Text style={styles.modalEmail} numberOfLines={1}>
                  <Ionicons name="mail-outline" size={13} color={Palette.textMuted} /> {doctor.email || doctor.clinicInfo?.email || 'No email stored'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} disabled={actionLoading} accessibilityLabel="Close details" hitSlop={8}>
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <Badge label={active ? 'Active' : 'Inactive'} variant={active ? 'success' : 'neutral'} />
              <Badge label={availableNow ? 'Available now' : 'Unavailable'} variant={availableNow ? 'success' : 'warning'} />
              <StatusBadge value={doctor.verificationStatus} variant={verificationStatusBadge(doctor.verificationStatus)} />
            </View>

            {notice ? <FormMessage type="success" message={notice} /> : null}

            <View style={styles.detailGrid}>
              {skills.map((skill) => (
                <View key={skill.label} style={styles.detailCol}>
                  <Text style={styles.detailLabel}>{skill.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{skill.value}</Text>
                </View>
              ))}
            </View>
<View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Next available slot</Text>
              <Text style={styles.sectionValue}>
                {nextSlot ? `${nextSlot.date} · ${nextSlot.time}` : 'No upcoming slot available'}
              </Text>
            </View>

            {hospital?.location?.address || hospital?.location?.city ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Hospital address</Text>
                <Text style={styles.sectionValue}>
                  {[hospital?.location?.address, hospital?.location?.city, hospital?.location?.state].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}

            {doctor.about ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.sectionValue}>{doctor.about}</Text>
              </View>
            ) : null}

            <View style={styles.actionBlock}>
              <Text style={styles.blockLabel}>Status actions</Text>
              <View style={styles.actionGrid}>
                {!isVerified ? (
                  <Button title="Approve" variant="secondary" fullWidth={false} style={styles.actionBtn} icon="shield-checkmark-outline" onPress={() => onRequestAction('approve')} />
                ) : null}
                {!isRejected ? (
                  <Button title="Reject" variant="outline" fullWidth={false} style={styles.actionBtn} icon="close-circle-outline" onPress={() => onRequestAction('reject')} />
                ) : null}
                <Button
                  title={availableNow ? 'Mark unavailable' : 'Mark available'}
                  variant={availableNow ? 'ghost' : 'secondary'}
                  fullWidth={false}
                  style={styles.actionBtn}
                  icon="time-outline"
                  onPress={() => onRequestAction(availableNow ? 'unavailable' : 'available')}
                />
              </View>
            </View>
          </ScrollView>

          <ConfirmDialog
            visible={Boolean(pendingAction)}
            title={confirmTitle(pendingAction)}
            message={confirmMessage(pendingAction)}
            confirmLabel={confirmLabel(pendingAction)}
            tone={pendingAction?.type === 'reject' ? 'danger' : 'primary'}
            loading={actionLoading}
            onConfirm={onRunAction}
            onCancel={onCancelAction}
          />
        </Card>
      </View>
    </Modal>
  );
}
function confirmTitle(action: { doctor: Doctor; type: DoctorAction } | null): string {
  switch (action?.type) {
    case 'approve': return `Approve ${action.doctor.name || 'this doctor'}?`;
    case 'reject': return `Reject ${action.doctor.name || 'this doctor'}?`;
    case 'available': return `Mark ${action.doctor.name || 'this doctor'} available?`;
    case 'unavailable': return `Mark ${action.doctor.name || 'this doctor'} unavailable?`;
    default: return 'Continue?';
  }
}

function confirmMessage(action: { doctor: Doctor; type: DoctorAction } | null): string {
  switch (action?.type) {
    case 'approve':
      return `${action.doctor.name || 'This doctor'} will be verified and allowed on the platform. This action is recorded in the doctor's verification log.`;
    case 'reject':
      return `${action.doctor.name || 'This doctor'} will be rejected. This action is recorded in the doctor's verification log.`;
    case 'available':
      return `${action.doctor.name || 'This doctor'} will be marked available so patients can book appointments.`;
    case 'unavailable':
      return `${action.doctor.name || 'This doctor'} will be marked unavailable and stop accepting new bookings.`;
    default:
      return 'Are you sure you want to continue?';
  }
}

function confirmLabel(action: { doctor: Doctor; type: DoctorAction } | null): string {
  switch (action?.type) {
    case 'approve': return 'Approve';
    case 'reject': return 'Reject';
    case 'available': return 'Mark available';
    case 'unavailable': return 'Mark unavailable';
    default: return 'Confirm';
  }
}

const styles = StyleSheet.create({
  headerWrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  listContent: { paddingBottom: Spacing.xxxl },
  separator: { height: Spacing.md },
  columns: { gap: Spacing.md },
  cell: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalContent: { padding: Spacing.xl, gap: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  modalHeaderTexts: { flex: 1, gap: 2 },
  modalName: { ...Typography.h4, color: Palette.text },
  modalSpecialty: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
  modalHospital: { ...Typography.caption, color: Palette.textMuted },
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
  actionBlock: { gap: Spacing.sm },
  blockLabel: { ...Typography.label, color: Palette.text },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexGrow: 1, minWidth: 150, minHeight: 44 },
});