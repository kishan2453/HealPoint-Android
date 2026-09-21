/**
 * HealPoint - Hospital Admin · Patients (own hospital only).
 *
 * Professional hospital-scoped patient management page built exclusively on
 * REAL backend endpoints (`GET /hospital-admin/patients` +
 * `GET /hospital-admin/patients/:id`). The patient set is derived server-side
 * from the authenticated hospital's OWN appointments — a Hospital Admin can
 * never see patients with no record at their hospital.
 *
 * Server-side search (name/email/phone/appointment reference), paginated list
 * (desktop table + mobile cards), details modal with real profile fields (no
 * credentials), visit summary, next appointment and REAL appointment history.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { PatientDetailsModal } from '@/components/admin/PatientDetailsModal';
import { PatientListSkeleton } from '@/components/admin/PatientListSkeleton';
import { PatientRow } from '@/components/admin/PatientRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY } from '@/lib/format';
import { useResponsiveVariant } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { Appointment } from '@/types';

const PAGE_SIZE = 20;

export default function AdminPatientsScreen() {
  const variant = useResponsiveVariant();
  const isTableLayout = variant !== 'mobile';

  const [patients, setPatients] = useState<adminService.HospitalAdminPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hospitalName, setHospitalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState<adminService.HospitalAdminPatient | null>(null);
  const [detailsAppointments, setDetailsAppointments] = useState<Appointment[]>([]);
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsTotalPages, setDetailsTotalPages] = useState(1);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
const load = useCallback(
    async (asRefresh: boolean, targetPage: number) => {
      if (!asRefresh) setLoading(true);
      setError('');
      setLoadMoreError('');
      try {
        const res = await adminService.getHospitalPatients({
          search: query,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        const list = res.patients || [];
        if (targetPage > 1) {
          const seen = new Set(patients.map((item) => String(item._id)));
          setPatients([...patients, ...list.filter((item) => !seen.has(String(item._id)))]);
        } else {
          setPatients(list);
        }
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(res.page || targetPage);
        if (res.hospitalName) setHospitalName(res.hospitalName);
      } catch (err) {
        if (!asRefresh) setError(toErrorMessage(err, 'Unable to load patients.'));
        else setLoadMoreError(toErrorMessage(err, 'Unable to load more patients.'));
      } finally {
        if (!asRefresh) setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, patients],
  );

  useEffect(() => {
    void load(false, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const loadMore = useCallback(async () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    setLoadMoreError('');
    await load(true, page + 1);
  }, [page, totalPages, load]);
const openDetails = useCallback(
    async (patient: adminService.HospitalAdminPatient) => {
      setSelected(patient);
      setDetailsAppointments([]);
      setDetailsTotal(0);
      setDetailsPage(1);
      setDetailsTotalPages(1);
      setDetailsLoading(true);
      setDetailsError('');
      try {
        const res = await adminService.getHospitalPatientDetails(String(patient._id), 1, 10);
        if (res.patient) setSelected(res.patient);
        setDetailsAppointments(res.appointments || []);
        setDetailsTotal(res.total || 0);
        setDetailsPage(res.page || 1);
        setDetailsTotalPages(res.totalPages || 1);
      } catch (err) {
        setDetailsError(toErrorMessage(err, 'Unable to load patient details.'));
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  const loadMoreDetails = useCallback(async () => {
    if (!selected || detailsPage >= detailsTotalPages) return;
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const res = await adminService.getHospitalPatientDetails(String(selected._id), detailsPage + 1, 10);
      const seen = new Set(detailsAppointments.map((item) => String(item._id)));
      setDetailsAppointments([
        ...detailsAppointments,
        ...(res.appointments || []).filter((item) => !seen.has(String(item._id))),
      ]);
      setDetailsPage(res.page || detailsPage + 1);
      setDetailsTotalPages(res.totalPages || detailsTotalPages);
    } catch (err) {
      setDetailsError(toErrorMessage(err, 'Unable to load more appointments.'));
    } finally {
      setDetailsLoading(false);
    }
  }, [selected, detailsPage, detailsTotalPages, detailsAppointments]);

  const closeDetails = useCallback(() => {
    setSelected(null);
    setDetailsAppointments([]);
    setDetailsTotal(0);
    setDetailsError('');
  }, []);
return (
    <AdminModuleScreen
      title="Patients"
      subtitle={hospitalName || 'Your hospital'}
      allowedRoles={['admin', 'super_admin']}
      loading={loading}
      error={error}
      onRetry={() => load(false, 1)}
      loadingComponent={<PatientListSkeleton />}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, email, phone, appointment ID..." />
        </View>

        {loadMoreError ? <FormMessage type="error" message={loadMoreError} /> : null}

        {patients.length === 0 ? (
          <EmptyState
            title="No patients"
            message="Patients with appointments at your hospital will appear here."
          />
        ) : isTableLayout ? (
          <View style={styles.tableOuter}>
            <PatientsTableHeader />
            {patients.map((patient) => (
              <PatientsTableRow key={String(patient._id)} patient={patient} onPress={() => openDetails(patient)} />
            ))}
          </View>
        ) : (
          <View style={styles.cardsColumn}>
            {patients.map((patient) => (
              <PatientRow key={String(patient._id)} patient={patient} onPress={() => openDetails(patient)} />
            ))}
          </View>
        )}

        {patients.length > 0 ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Showing {Math.min(patients.length, total)} of {total} · Page {page} of {Math.max(totalPages, 1)}
            </Text>
            {page < totalPages && !loadMoreError ? (
              <Button title="Load more" variant="outline" loading={loadingMore} onPress={loadMore} style={styles.loadMore} />
            ) : null}
            {loadMoreError ? (
              <Button title="Retry" variant="outline" onPress={loadMore} style={styles.loadMore} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <PatientDetailsModal
        patient={selected}
        appointments={detailsAppointments}
        appointmentsTotal={detailsTotal}
        appointmentsLoading={detailsLoading}
        appointmentsError={detailsError}
        hasMoreAppointments={detailsPage < detailsTotalPages}
        onLoadMoreAppointments={loadMoreDetails}
        onClose={closeDetails}
      />
    </AdminModuleScreen>
  );
}
// ---------------------------------------------------------------------------
// Desktop / tablet table
// ---------------------------------------------------------------------------
const COLUMN_WIDTHS = {
  name: 180,
  contact: 180,
  visits: 120,
  last: 150,
  upcoming: 200,
  action: 64,
};

function PatientsTableHeader() {
  return (
    <View style={styles.tableHeaderRow}>
      <View style={{ width: COLUMN_WIDTHS.name }}>
        <Text style={styles.tableHeaderCell}>Patient</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.contact }}>
        <Text style={styles.tableHeaderCell}>Contact</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.visits }}>
        <Text style={styles.tableHeaderCell}>Appointments</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.last }}>
        <Text style={styles.tableHeaderCell}>Last visit</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.upcoming }}>
        <Text style={styles.tableHeaderCell}>Upcoming</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.action }}>
        <Text style={styles.tableHeaderCell} />
      </View>
    </View>
  );
}

function PatientsTableRow({
  patient,
  onPress,
}: {
  patient: adminService.HospitalAdminPatient;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${patient.name}`}
      style={({ pressed }) => [styles.tableRow, pressed && styles.tableRowPressed]}
    >
      <View style={{ width: COLUMN_WIDTHS.name }}>
        <Text style={styles.cellStrong} numberOfLines={1}>{patient.name || 'Not available'}</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.contact }}>
        <Text style={styles.cellText} numberOfLines={1}>{patient.phone || patient.email || '—'}</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.visits }}>
        <Text style={styles.cellText} numberOfLines={1}>{String(patient.appointmentCount || 0)}</Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.last }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {formatDDMMYYYY(patient.lastAppointment?.slotDate) || '—'}
        </Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.upcoming }}>
        <Text style={styles.cellText} numberOfLines={1}>
          {formatDDMMYYYY(patient.upcomingAppointment?.slotDate) || '—'}
        </Text>
      </View>
      <View style={{ width: COLUMN_WIDTHS.action }}>
        <View style={styles.viewIcon}>
          <Text style={styles.viewIconText}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  cardsColumn: { gap: Spacing.md },
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
  viewIconText: { ...Typography.h4, color: Palette.primaryDark, fontWeight: '700' },
  footer: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  footerText: { ...Typography.caption, color: Palette.textMuted },
  loadMore: { minHeight: 46, minWidth: 200, alignSelf: 'center' },
});
