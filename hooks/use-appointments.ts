/**
 * HealPoint - patient appointments hook (real `/appointment/get-user-appointments`).
 * Splits the user's appointments into upcoming and past buckets.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import * as appointmentService from "@/services/appointments";
import { isCancelledError, toErrorMessage } from "@/services/api";
import {
  subscribeToAppointmentSync,
  subscribeToQueueSync,
} from "@/services/socket";
import type { Appointment } from "@/types";

const UPCOMING_STATUSES = ["pending", "confirmed", "rescheduled"];

function dateValue(value?: string): number {
  if (!value) return 0;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return 0;
  const [, dd, mm, yyyy] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
}

function todayKey(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
}

export function useAppointments() {
  const { user } = useAuth();
  const userId = user?._id;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // True once the backend has returned data for the *current* user. It is reset
  // when the user changes so a full-screen loader (never another patient's
  // data) is shown while the fresh list is fetched.
  const hasLoaded = useRef(false);
  // Guards against a stale in-flight response for a *previous* user resolving
  // after login switched (would otherwise leak one patient's data to another).
  const activeUserIdRef = useRef<string | undefined>(userId);
  // Aborts the in-flight appointments fetch on unmount / user switch so a
  // stale response can never overwrite the new user's list — and the abort
  // stays silent (CANCELLED) instead of showing a timeout error.
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const requestUserId = userId;
    if (!requestUserId) {
      abortRef.current?.abort();
      setAppointments([]);
      setError("");
      hasLoaded.current = false;
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Full-screen loading only for the very first fetch. Background refreshes
    // (pull-to-refresh, focus re-fetch) keep the existing list on screen while
    // they run instead of flashing the spinner.
    if (!hasLoaded.current) setLoading(true);
    try {
      const res = await appointmentService.getUserAppointments(requestUserId, {
        signal: controller.signal,
      });
      if (
        activeUserIdRef.current !== requestUserId ||
        controller.signal.aborted
      )
        return;
      // The backend key is intentionally the misspelled `appoinmtent`.
      const list = res.appoinmtent || [];
      hasLoaded.current = true;
      setAppointments(list);
      setError("");
    } catch (err) {
      if (
        activeUserIdRef.current !== requestUserId ||
        controller.signal.aborted ||
        isCancelledError(err)
      )
        return;
      // When a background refresh fails we prefer keeping the last good data;
      // the error screen is only shown when nothing has loaded yet.
      if (!hasLoaded.current) {
        setAppointments([]);
        setError(toErrorMessage(err, "Unable to load your appointments."));
      }
    } finally {
      if (
        activeUserIdRef.current === requestUserId &&
        !controller.signal.aborted
      )
        setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // When the logged-in user changes (login/logout/switch account) the old
    // user's appointments are cleared immediately so they are never visible to
    // someone else.
    activeUserIdRef.current = userId;
    hasLoaded.current = false;
    setAppointments([]);
    setError("");
    setLoading(true);
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load, userId]);

  // Real-time cross-portal sync: automatically refresh when an appointment or queue updates
  useEffect(() => {
    if (!userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        load();
      }, 300);
    };

    const unsubscribeAppt = subscribeToAppointmentSync((payload) => {
      if (!payload.userId || String(payload.userId) === String(userId)) {
        triggerRefresh();
      }
    });

    const unsubscribeQueue = subscribeToQueueSync((payload) => {
      if (!payload.userId || String(payload.userId) === String(userId)) {
        triggerRefresh();
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeAppt();
      unsubscribeQueue();
    };
  }, [load, userId]);

  const today = appointments
    .filter((appointment) => appointment.slotDate === todayKey())
    .sort((a, b) => (a.slotTime || "").localeCompare(b.slotTime || ""));

  const upcoming = appointments
    .filter(
      (appointment) =>
        UPCOMING_STATUSES.includes(appointment.status) &&
        appointment.slotDate !== todayKey(),
    )
    .sort((a, b) => dateValue(a.slotDate) - dateValue(b.slotDate));

  const completed = appointments
    .filter((appointment) => appointment.status === "completed")
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  const cancelled = appointments
    .filter(
      (appointment) =>
        appointment.status === "cancel" || appointment.status === "missed",
    )
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  const past = appointments
    .filter((appointment) => !UPCOMING_STATUSES.includes(appointment.status))
    .sort((a, b) => dateValue(b.slotDate) - dateValue(a.slotDate));

  return {
    appointments,
    upcoming,
    today,
    completed,
    cancelled,
    past,
    loading,
    error,
    refetch: load,
  };
}
