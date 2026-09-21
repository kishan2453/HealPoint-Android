/**
 * HealPoint - Super Admin appointment details modal.
 *
 * Real backend data only, organised into clear sections (PATIENT / DOCTOR /
 * HOSPITAL / APPOINTMENT / PAYMENT). Missing fields fall back to
 * "Not available". Razorpay order/payment ids are NOT shown here because the
 * platform list endpoint does not expose them — we never invent references.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentDoctorSpecialty,
  appointmentHospitalName,
  appointmentPatientEmail,
  appointmentPatientName,
  appointmentPatientPhone,
  appointmentPayment,
  appointmentReference,
} from '@/lib/appointments';
import { appointmentPaymentBadge, appointmentStatusBadge, StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY, formatINR, formatISODate } from '@/lib/format';
import type { Appointment } from '@/types';

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  visible: boolean;
  onClose: () => void;
  /**
   * Optional action buttons rendered in the footer (Hospital Admin workflows
   * such as Confirm/Complete/Cancel/Reschedule). Super Admin keeps omitting
   * this prop — the modal stays read-only when `actions` is not provided.
   */
  actions?: AppointmentDetailAction[] | null;
}

export interface AppointmentDetailAction {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}

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

const UNAVAILABLE = 'Not available';
export function AppointmentDetailsModal({ appointment, visible, onClose, actions }: AppointmentDetailsModalProps) {
  const payment = appointment ? appointmentPayment(appointment) : null;
  const department = appointment ? appointmentDepartment(appointment) : '';
  // Non-secret Razorpay references. The backend never returns the signature to
  // Hospital Admin clients, and these identifiers are safe to display.
  const razorpayOrderId = (appointment as { razorpayOrderId?: string } | null)?.razorpayOrderId || '';
  const razorpayPaymentId = (appointment as { razorpayPaymentId?: string } | null)?.razorpayPaymentId || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          {/* ---- Header ---- */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTexts}>
              <Text style={styles.reference} numberOfLines={1}>
                {appointment ? appointmentReference(appointment) : ''}
              </Text>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Appointment details
              </Text>
            </View>
            {appointment ? (
              <StatusBadge value={appointment.status} variant={appointmentStatusBadge(appointment.status)} />
            ) : null}
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

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {!appointment ? (
              <Text style={styles.muted}>No appointment selected.</Text>
            ) : (
              <>
                <Section title="Patient">
                  <DetailRow label="Name" value={appointmentPatientName(appointment)} />
                  <DetailRow label="Phone" value={appointmentPatientPhone(appointment) || UNAVAILABLE} />
                  <DetailRow label="Email" value={appointmentPatientEmail(appointment) || UNAVAILABLE} last />
                </Section>

                <Section title="Doctor">
                  <DetailRow label="Name" value={appointmentDoctorName(appointment)} />
                  <DetailRow label="Specialization" value={appointmentDoctorSpecialty(appointment) || UNAVAILABLE} />
                  <DetailRow label="Department" value={department || UNAVAILABLE} last />
                </Section>

                <Section title="Hospital">
                  <DetailRow label="Hospital" value={appointmentHospitalName(appointment)} />
                  <DetailRow label="Department" value={department || UNAVAILABLE} last />
                </Section>

                <Section title="Appointment">
                  <DetailRow label="Date" value={formatDDMMYYYY(appointment.slotDate) || UNAVAILABLE} />
                  <DetailRow label="Time" value={appointment.slotTime || UNAVAILABLE} />
                  <DetailRow label="Slot" value={appointment.slotTime || UNAVAILABLE} />
                  <DetailRow label="Status" value={appointment.status || UNAVAILABLE} />
                  <DetailRow
                    label="Type"
                    value={
                      appointment.consultationType === 'video'
                        ? 'Video consultation'
                        : appointment.consultationType === 'clinic'
                          ? 'Clinic visit'
                          : UNAVAILABLE
                    }
                  />
                  <DetailRow label="Booked on" value={formatISODate(appointment.createdAt) || UNAVAILABLE} last />
                </Section>

                <Section title="Payment">
                  <DetailRow label="Status" value={payment?.label || UNAVAILABLE} />
                  <DetailRow
                    label="Method"
                    value={
                      appointment.paymentMethod === 'online'
                        ? 'Online (Razorpay)'
                        : appointment.paymentMethod === 'cash'
                          ? 'Cash at clinic'
                          : UNAVAILABLE
                    }
                  />
                  <DetailRow label="Amount" value={Number(appointment.amount) > 0 ? formatINR(appointment.amount) : UNAVAILABLE} />
                  {razorpayOrderId ? <DetailRow label="Razorpay order" value={razorpayOrderId} /> : null}
                  {razorpayPaymentId ? <DetailRow label="Razorpay payment" value={razorpayPaymentId} /> : null}
                  <View style={styles.paymentFooter}>
                    <Badge label={payment?.label || UNAVAILABLE} variant={appointmentPaymentBadge(payment?.status)} />
                    <Text style={styles.paymentHint}>
                      {payment?.paid ? 'Payment completed' : 'No payment recorded for this booking yet.'}
                    </Text>
                  </View>
                </Section>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {actions && actions.length > 0 ? (
              <View style={styles.actionsRow}>
                {actions.map((action) => (
                  <Button
                    key={action.key}
                    title={action.label}
                    icon={action.icon}
                    variant={action.variant ?? 'outline'}
                    onPress={action.onPress}
                    disabled={action.disabled}
                    style={styles.footerButton}
                  />
                ))}
              </View>
            ) : null}
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
    maxWidth: 640,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '90%',
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
  reference: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  modalTitle: { ...Typography.h4, color: Palette.text },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  modalContent: { padding: Spacing.lg, gap: Spacing.lg },
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
  paymentFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  paymentHint: { ...Typography.caption, color: Palette.textMuted, flexShrink: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  modalFooter: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Palette.divider },
  actionsRow: { gap: Spacing.sm, marginBottom: Spacing.sm },
  footerButton: { minHeight: 48 },
});