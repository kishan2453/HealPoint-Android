/**
 * HealPoint - Payment History (inside the patient drawer).
 *
 * Real data from the user's appointments: every booking with an amount shows
 * its payment status. Tapping a row opens the appointment details.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAppointments } from '@/hooks/use-appointments';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import type { Appointment } from '@/types';

function appointmentDoctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object' && 'name' in doctor) {
    return doctor.name || 'Doctor';
  }
  return 'Doctor';
}

function paymentLabel(appointment: Appointment): { label: string; variant: BadgeVariant } {
  const status = (appointment.paymentStatus || '').toUpperCase();
  if (status === 'SUCCESS' || appointment.payment === true) {
    return { label: 'Paid', variant: 'success' };
  }
  if (status === 'FAILED') return { label: 'Failed', variant: 'error' };
  if (status === 'REFUNDED') return { label: 'Refunded', variant: 'neutral' };
  return { label: 'Pending', variant: 'warning' };
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { appointments, loading, error, refetch } = useAppointments();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  useScreenFocus(() => refetch());

  const history = [...appointments]
    .filter((item) => Number(item.amount) > 0)
    .sort((a, b) => String(b.slotDate || '').localeCompare(String(a.slotDate || '')));

  return (
    <View style={styles.safe}>
      <DrawerHeader title="Payment History" subtitle={`${history.length} transactions`} />

      {loading ? (
        <Loading label="Loading payment history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : history.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="When you book and pay for appointments, your transactions will appear here."
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const payment = paymentLabel(item);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View payment for ${appointmentDoctorName(item)}`}
                onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: String(item._id) } })}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="card" size={18} color={Palette.primaryDark} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {appointmentDoctorName(item)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.slotDate ? formatDDMMYYYY(item.slotDate) : 'Date pending'}
                    {item.slotTime ? ` · ${item.slotTime}` : ''}
                  </Text>
                  {item.hospitalName ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.hospitalName}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>{formatINR(Number(item.amount))}</Text>
                  <Badge label={payment.label} variant={payment.variant} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.85,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  rowMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '700',
  },
});
