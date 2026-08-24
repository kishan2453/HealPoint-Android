import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { dateLabel, formatDDMMYYYY, toDDMMYYYY, weekdayLabel } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import type { Appointment } from '@/types';

export default function RescheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

  const [doctorId, setDoctorId] = useState('');
  const [current, setCurrent] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const days = useMemo(() => {
    const list: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      list.push(date);
    }
    return list;
  }, []);

  // Resolve the appointment + its doctorId from the raw user appointments so we
  // can ask the real slot API for the right doctor.
  useEffect(() => {
    let active = true;
    if (!id || !user?._id) return;
    setLoading(true);
    appointmentService
      .getUserAppointments(user._id)
      .then((res) => {
        if (!active) return;
        const record = (res.appoinmtent || []).find((item) => String(item._id) === String(id));
        if (!record) {
          setError('Appointment not found.');
          return;
        }
        setCurrent(record);
        const doc = record.doctorId;
        setDoctorId(typeof doc === 'object' && doc ? String(doc._id) : String(doc || ''));
      })
      .catch((err) => {
        if (active) setError(toErrorMessage(err, 'Unable to load the appointment.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?._id]);

  // Fetch real available slots for the selected date.
  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    setSlotsLoading(true);
    setSlotsError('');
    setSelectedSlot('');
    appointmentService
      .getAvailableSlots(doctorId, toDDMMYYYY(selectedDate))
      .then((res) => {
        if (!active) return;
        setAvailableSlots(res.availableSlots || []);
        if (res.availableSlots?.length) setSelectedSlot(res.availableSlots[0]);
      })
      .catch((err) => {
        if (active) {
          setAvailableSlots([]);
          setSlotsError(toErrorMessage(err, 'Unable to load available slots.'));
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [doctorId, selectedDate]);

  const selectedDateStr = toDDMMYYYY(selectedDate);

const confirmReschedule = async () => {
    setSubmitError('');
    if (!id || !selectedSlot) {
      setSubmitError('Please select a time slot.');
      return;
    }
    setSubmitting(true);
    try {
      await appointmentService.rescheduleAppointment(id, {
        slotDate: selectedDateStr,
        slotTime: selectedSlot,
        reason: reason.trim() || 'Rescheduled by patient',
      });
      router.replace({ pathname: '/appointment/[id]', params: { id } });
    } catch (err) {
      const message = toErrorMessage(err, 'Unable to reschedule. Please try again.');
      setSubmitError(message);
      if (/just booked|already booked|already taken|unavailable/i.test(message)) {
        try {
          const res = await appointmentService.getAvailableSlots(doctorId, selectedDateStr);
          setAvailableSlots(res.availableSlots || []);
          setSelectedSlot(res.availableSlots?.[0] || '');
        } catch {
          // keep current slots on refresh failure
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading appointment..." />
      </SafeAreaView>
    );
  }

  if (error || !current) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || 'Appointment not found.'} />
      </SafeAreaView>
    );
  }

  const currentDoctorName =
    current.doctorId && typeof current.doctorId === 'object' && 'name' in current.doctorId
      ? current.doctorId.name
      : 'Doctor';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Reschedule appointment</Text>
          </View>
        </View>

        <Card padded>
          <Text style={styles.currentLabel}>Current appointment</Text>
          <Text style={styles.currentDoctor}>{currentDoctorName}</Text>
          <Text style={styles.currentMeta}>
            {formatDDMMYYYY(current.slotDate)} · {current.slotTime}
          </Text>
        </Card>

        {submitError ? <FormMessage type="error" message={submitError} /> : null}

        <Text style={styles.sectionTitle}>Select new date</Text>
        <View style={styles.dateRow}>
          {days.map((date) => {
            const active = toDDMMYYYY(date) === selectedDateStr;
            return (
              <Pressable
                key={toDDMMYYYY(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedDate(date)}
                style={[styles.dateCell, active && styles.dateCellActive]}
              >
                <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>{weekdayLabel(date)}</Text>
                <Text style={[styles.dateNumber, active && styles.dateTextActive]}>{date.getDate()}</Text>
                <Text style={[styles.dateMonth, active && styles.dateTextActive]}>
                  {dateLabel(date).split(' ')[1]}
                </Text>
              </Pressable>
            );
          })}
        </View>

<Text style={styles.sectionTitle}>Select new time slot</Text>
        {slotsLoading ? (
          <Loading label="Checking availability..." fullScreen={false} />
        ) : slotsError ? (
          <FormMessage type="error" message={slotsError} />
        ) : availableSlots.length === 0 ? (
          <FormMessage type="info" message="No appointments available for this date. Please choose another date." />
        ) : (
          <View style={styles.slotGrid}>
            {availableSlots.map((slot) => {
              const active = slot === selectedSlot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedSlot(slot)}
                  style={[styles.slot, active && styles.slotActive]}
                >
                  <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Input
          label="Reason (optional)"
          placeholder="e.g. Work schedule conflict"
          value={reason}
          onChangeText={setReason}
          containerStyle={{ marginTop: Spacing.sm }}
        />

        <Button
          title="Confirm new time"
          onPress={confirmReschedule}
          loading={submitting}
          disabled={!selectedSlot}
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
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
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
  currentLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  currentDoctor: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: 2,
  },
  currentMeta: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dateCell: {
    width: 52,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  dateCellActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dateWeekday: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  dateNumber: {
    ...Typography.h4,
    color: Palette.text,
    marginVertical: 2,
  },
  dateMonth: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  dateTextActive: {
    color: Palette.white,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  slot: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  slotActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  slotText: {
    ...Typography.bodySmall,
    color: Palette.text,
  },
  slotTextActive: {
    color: Palette.white,
    fontWeight: '700',
  },
});