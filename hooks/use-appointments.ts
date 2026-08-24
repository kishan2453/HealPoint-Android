/**
 * HealPoint - patient appointments hook (real `/appointment/get-user-appointments`).
 * Splits the user's appointments into upcoming and past buckets.
 */
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import * as appointmentService from '@/services/appointments';
import { toErrorMessage } from '@/services/api';
import type { Appointment } from '@/types';

const UPCOMING_STATUSES = ['pending', 'confirmed', 'rescheduled'];

function dateValue(value?: string): number {
  if (!value) return 0;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return 0;
  const [, dd, mm, yyyy] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
}

function todayKey(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

export function useAppointments() {
  const { user } = useAuth();
  const userId = user?._id;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appointmentService.getUserAppointments(userId);
      // The backend key is intentionally the misspelled `appoinmtent`.
      const list = res.appoinmtent || [];
      setAppointments(list);
    } catch (err) {
      setAppointments([]);
      setError(toErrorMessage(err, 'Unable to load your appointments.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const today = appointments
    .filter((appointment) => appointment.slotDate === todayKey())
    .sort((a, b) => (a.slotTime || '').localeCompare(b.slotTime || ''));

  const upcoming = appointments
    .filter(
      (appointment) =>
        UPCOMING_STATUSES.includes(appointment.status) && appointment.slotDate !== todayKey(),
    )
    .sort((a, b) => dateValue(a.slotDate) - dateValue(b.slotDate));

  const completed = appointments
    .filter((appointment) => appointment.status === 'completed')
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  const cancelled = appointments
    .filter((appointment) => appointment.status === 'cancel' || appointment.status === 'missed')
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  const past = appointments
    .filter((appointment) => !UPCOMING_STATUSES.includes(appointment.status))
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  return { appointments, upcoming, today, completed, cancelled, past, loading, error, refetch: load };
}