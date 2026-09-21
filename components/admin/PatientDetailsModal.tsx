/**
 * HealPoint - Hospital Admin patient details modal.
 *
 * Shows only information the Hospital Admin is authorized to view (the backend
 * derives the relationship from the admin's OWN hospital). Real profile fields
 * + REAL appointment history returned by GET /hospital-admin/patients/:id.
 * Never shows passwords, tokens or any credential.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { patientInitials } from '@/components/admin/PatientRow';
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentPayment,
  appointmentReference,
} from '@/lib/appointments';
import { appointmentPaymentBadge, appointmentStatusBadge, StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY, formatINR, formatISODate } from '@/lib/format';
import type { HospitalAdminPatient } from '@/services/admin';
import type { Appointment } from '@/types';

interface PatientDetailsModalProps {
  patient: HospitalAdminPatient | null;
  appointments: Appointment[];
  appointmentsTotal: number;
  appointmentsLoading: boolean;
  appointmentsError: string;
  hasMoreAppointments: boolean;
  onLoadMoreAppointments: () => void;
  onClose: () => void;
}

const UNAVAILABLE = 'Not available';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
export function PatientDetailsModal({
  patient,
  appointments,
  appointmentsTotal,
  appointmentsLoading,
  appointmentsError,
  hasMoreAppointments,
  onLoadMoreAppointments,
  onClose,
}: PatientDetailsModalProps) {
  return (
    <Modal visible={Boolean(patient)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{patientInitials(patient?.name)}</Text>
            </View>
            <View style={styles.headerTexts}>
              <Text style={styles.name} numberOfLines={1}>
                {patient?.name || UNAVAILABLE}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {patient?.phone || patient?.email || UNAVAILABLE}
              </Text>
            </View>
            <Badge
              label={patient?.isActive === false ? 'Inactive' : 'Active'}
              variant={patient?.isActive === false ? 'neutral' : 'success'}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={20} color={Palette.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {patient ? (
              <>
                <Section title="Profile">
                  <DetailRow label="Email" value={patient.email || UNAVAILABLE} />
                  <DetailRow label="Phone" value={patient.phone || UNAVAILABLE} />
                  <DetailRow label="Gender" value={patient.gender || UNAVAILABLE} />
                  <DetailRow label="Date of birth" value={formatISODate(patient.dob) || UNAVAILABLE} />
                  <DetailRow label="Registered" value={formatISODate(patient.createdAt) || UNAVAILABLE} last />
                </Section>

                <Section title="Visits at this hospital">
                  <DetailRow label="Appointments" value={String(patient.appointmentCount || 0)} />
                  <DetailRow label="Completed" value={String(patient.completedCount || 0)} />
                  <DetailRow label="Cancelled" value={String(patient.cancelledCount || 0)} />
                  <DetailRow label="Missed" value={String(patient.missedCount || 0)} />
                  <DetailRow label="Total spent" value={formatINR(patient.totalSpent)} last />
                </Section>

                <Section title="Next appointment">
                  {patient.upcomingAppointment?.slotDate ? (
                    <>
                      <DetailRow
                        label="Date & time"
                        value={`${formatDDMMYYYY(patient.upcomingAppointment.slotDate)} · ${patient.upcomingAppointment.slotTime || UNAVAILABLE}`}
                      />
                      <DetailRow
                        label="Status"
                        value={String(patient.upcomingAppointment.status || UNAVAILABLE)}
                        last
                      />
                    </>
                  ) : (
                    <Text style={styles.muted}>No upcoming appointment.</Text>
                  )}
                </Section>

                <Section title={`Appointment history (${appointmentsTotal})`}>
                  {appointmentsLoading ? (
                    <Text style={styles.muted}>Loading appointment history…</Text>
                  ) : appointmentsError ? (
                    <FormMessage type="error" message={appointmentsError} />
                  ) : appointments.length === 0 ? (
                    <Text style={styles.muted}>No appointments found.</Text>
                  ) : (
                    <View style={styles.history}>
                      {appointments.map((appointment) => {
                        const paymentInfo = appointmentPayment(appointment);
                        return (
                          <View key={String(appointment._id)} style={styles.historyRow}>
                            <View style={styles.historyTexts}>
                              <Text style={styles.historyDoctor} numberOfLines={1}>
                                {appointmentDoctorName(appointment)}
                              </Text>
                              <Text style={styles.historyMeta} numberOfLines={1}>
                                {appointmentReference(appointment)} ·{' '}
                                {formatDDMMYYYY(appointment.slotDate) || UNAVAILABLE} ·{' '}
                                {appointment.slotTime || UNAVAILABLE}
                                {appointmentDepartment(appointment)
                                  ? ` · ${appointmentDepartment(appointment)}`
                                  : ''}
                              </Text>
                            </View>
                            <View style={styles.historyBadges}>
                              <StatusBadge value={appointment.status} variant={appointmentStatusBadge(appointment.status)} />
                              <Badge label={paymentInfo.label} variant={appointmentPaymentBadge(paymentInfo.status)} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {hasMoreAppointments ? (
                    <Button
                      title="Load more"
                      variant="outline"
                      loading={appointmentsLoading}
                      onPress={onLoadMoreAppointments}
                      style={styles.loadMore}
                    />
                  ) : null}
                </Section>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Close" variant="outline" onPress={onClose} style={styles.footerButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.h4, color: Palette.primaryDark, fontWeight: '700' },
  headerTexts: { flex: 1, gap: 2 },
  name: { ...Typography.h3, color: Palette.text },
  subtitle: { ...Typography.caption, color: Palette.textMuted },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  section: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    gap: 2,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '500', textAlign: 'right', flexShrink: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  history: { gap: Spacing.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  historyTexts: { flex: 1, gap: 2 },
  historyDoctor: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  historyMeta: { ...Typography.caption, color: Palette.textMuted },
  historyBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  loadMore: { minHeight: 46, alignSelf: 'flex-start' },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Palette.divider },
  footerButton: { minHeight: 48 },
});