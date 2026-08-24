import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import type { AppointmentDetails } from '@/types';

const CANCELABLE = ['pending', 'confirmed', 'rescheduled'];

function statusBadge(status?: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', variant: 'success' };
    case 'pending':
      return { label: 'Pending', variant: 'warning' };
    case 'rescheduled':
      return { label: 'Rescheduled', variant: 'neutral' };
    case 'completed':
      return { label: 'Completed', variant: 'primary' };
    case 'cancel':
      return { label: 'Cancelled', variant: 'error' };
    case 'missed':
      return { label: 'Missed', variant: 'error' };
    default:
      return { label: status || 'Unknown', variant: 'neutral' };
  }
}

function paymentStatusLabel(paymentStatus?: string, paid?: boolean): string {
  if (paid) return 'Paid';
  switch ((paymentStatus || '').trim().toLowerCase()) {
    case 'success':
    case 'paid':
    case 'succeeded':
      return 'Paid';
    case 'failed':
      return 'Payment failed';
    case 'cancelled':
    case 'cancel':
      return 'Payment cancelled';
    case 'refunded':
      return 'Refunded';
    case 'pending':
      return 'Payment pending';
    default:
      return 'Unpaid';
  }
}

function paymentStatusVariant(paymentStatus?: string, paid?: boolean): BadgeVariant {
  if (paid) return 'success';
  switch ((paymentStatus || '').trim().toLowerCase()) {
    case 'success':
    case 'paid':
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'error';
    case 'cancelled':
    case 'cancel':
    case 'refunded':
      return 'neutral';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await appointmentService.getUserAppointmentDetails(id);
      setAppointment(res.appointmentDetails);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load appointment details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useScreenFocus(() => {
    load();
  });

  const status = appointment?.bookingStatus;
  const isActionable = Boolean(status && CANCELABLE.includes(status));

  const rawPaymentStatus = (appointment?.paymentStatus || '').trim().toLowerCase();
  const isPaid =
    appointment?.payment === true || ['success', 'paid', 'succeeded', 'captured'].includes(rawPaymentStatus);
  const payAttemptFailed = ['failed', 'cancelled'].includes(rawPaymentStatus);
  const canPayOnline =
    isActionable && !isPaid && Number(appointment?.amount || 0) > 0;

  const openReschedule = () => {
    if (!id) return;
    router.push({ pathname: '/appointment/reschedule/[id]', params: { id } });
  };

  const confirmCancel = async () => {
    if (!id) return;
    setCancelling(true);
    setActionMessage('');
    try {
      await appointmentService.cancelAppointment(id);
      setCancelVisible(false);
      setActionMessage('Your appointment has been cancelled. The slot has been released.');
      await load();
    } catch (err) {
      setActionMessage(toErrorMessage(err, 'Unable to cancel the appointment. Please try again.'));
    } finally {
      setCancelling(false);
    }
  };

  const badge = statusBadge(status);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading appointment..." />
      </SafeAreaView>
    );
  }

  if (error || !appointment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || 'Appointment not found.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Appointment details</Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} />
        </View>

        {actionMessage ? (
          <FormMessage
            type={actionMessage.toLowerCase().includes('cancelled') ? 'info' : 'error'}
            message={actionMessage}
          />
        ) : null}

<Card padded>
          <Text style={styles.appointmentId}>
            Appointment {appointment.appointmentId || appointment.mongoAppointmentId}
          </Text>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Doctor</Text>
            <Text style={styles.infoValue}>{appointment.doctorName || 'Doctor'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Hospital</Text>
            <Text style={styles.infoValue}>{appointment.hospitalName || 'Hospital'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDDMMYYYY(appointment.bookingDate)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{appointment.bookingTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Fee</Text>
            <Text style={styles.infoValue}>{formatINR(appointment.amount)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={18} color={Palette.primary} />
            <Text style={styles.infoLabel}>Payment</Text>
            <Badge
              label={paymentStatusLabel(appointment.paymentStatus, appointment.payment)}
              variant={paymentStatusVariant(appointment.paymentStatus, appointment.payment)}
            />
          </View>
        </Card>

{(appointment.consultationType === 'video' && id) ? (
          <View style={styles.actions}>
            <Button
              title="Open video consultation"
              variant="primary"
              icon="videocam"
              onPress={() => router.push({ pathname: '/consultation/[id]', params: { id } })}
            />
          </View>
        ) : null}

{canPayOnline ? (
          <View style={styles.actions}>
            <Button
              title={payAttemptFailed ? 'Retry Payment · Online' : 'Pay Online · Razorpay'}
              variant="secondary"
              onPress={() => {
                if (!id) return;
                router.push({ pathname: '/payment/[appointmentId]', params: { appointmentId: id } });
              }}
            />
          </View>
        ) : null}

        {isActionable ? (
          <View style={styles.actions}>
            <Button title="Reschedule appointment" variant="secondary" onPress={openReschedule} />
            <Button title="Cancel appointment" variant="outline" onPress={() => setCancelVisible(true)} />
          </View>
        ) : null}

        <ConfirmDialog
          visible={cancelVisible}
          title="Cancel appointment?"
          message={`Are you sure you want to cancel your appointment with ${appointment.doctorName || 'this doctor'} on ${formatDDMMYYYY(appointment.bookingDate)} at ${appointment.bookingTime}? The slot will be released for other patients.`}
          confirmLabel="Yes, cancel"
          cancelLabel="Keep appointment"
          tone="danger"
          loading={cancelling}
          onConfirm={confirmCancel}
          onCancel={() => setCancelVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
  },
  appointmentId: {
    ...Typography.label,
    color: Palette.primaryDark,
    marginBottom: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    width: 84,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    gap: Spacing.sm,
  },
});