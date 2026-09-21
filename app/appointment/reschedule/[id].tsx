/**
 * HealPoint - Reschedule Appointment.
 *
 * Allows patient to select a new date & time slot for an active appointment.
 * Validates doctor availability, sessions, leaves, and double-booking atomically.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  dateLabel,
  formatDDMMYYYY,
  formatDoctorName,
  toDDMMYYYY,
  weekdayLabel,
} from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type { AppointmentDetails } from "@/types";

function parseHourFromSlot(slot: string): number {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 9;
  let hour = Number(match[1]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour;
}

function categorizeSlots(slots: string[]) {
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];

  slots.forEach((slot) => {
    const h = parseHourFromSlot(slot);
    if (h < 12) morning.push(slot);
    else if (h < 16) afternoon.push(slot);
    else evening.push(slot);
  });

  return { morning, afternoon, evening };
}

export default function RescheduleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(
    null,
  );
  const [doctorId, setDoctorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  // Load appointment details
  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    appointmentService
      .getUserAppointmentDetails(id)
      .then((res) => {
        if (!active) return;
        const details = res.appointmentDetails;
        setAppointment(details);
        setDoctorId(String(details.doctorId || ""));
      })
      .catch((err) => {
        if (active)
          setError(toErrorMessage(err, "Unable to load the appointment."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Fetch real available slots for selected date
  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    setSlotsLoading(true);
    setSlotsError("");
    setSelectedSlot("");
    appointmentService
      .getAvailableSlots(doctorId, toDDMMYYYY(selectedDate))
      .then((res) => {
        if (!active) return;
        const slots = res.availableSlots || [];
        setAvailableSlots(slots);
        if (slots.length > 0) setSelectedSlot(slots[0]);
      })
      .catch((err) => {
        if (active) {
          setAvailableSlots([]);
          setSlotsError(toErrorMessage(err, "Unable to load available slots."));
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
  const { morning, afternoon, evening } = useMemo(
    () => categorizeSlots(availableSlots),
    [availableSlots],
  );

  const confirmReschedule = async () => {
    setSubmitError("");
    if (!id || !selectedSlot) {
      setSubmitError("Please select a new time slot.");
      return;
    }

    if (
      selectedDateStr === appointment?.bookingDate &&
      selectedSlot === appointment?.bookingTime
    ) {
      setSubmitError("Please choose a different date or time slot.");
      return;
    }

    setSubmitting(true);
    try {
      await appointmentService.rescheduleAppointment(id, {
        slotDate: selectedDateStr,
        slotTime: selectedSlot,
        reason: reason.trim() || "Rescheduled by patient",
      });
      router.replace({ pathname: "/appointment/[id]", params: { id } });
    } catch (err) {
      const message = toErrorMessage(
        err,
        "Unable to reschedule. Please try again.",
      );
      setSubmitError(message);
      if (
        /just booked|already booked|already taken|unavailable/i.test(message)
      ) {
        try {
          const res = await appointmentService.getAvailableSlots(
            doctorId,
            selectedDateStr,
          );
          setAvailableSlots(res.availableSlots || []);
          setSelectedSlot(res.availableSlots?.[0] || "");
        } catch {
          // preserve slots on refresh failure
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

  if (error || !appointment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || "Appointment not found."} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Reschedule Appointment</Text>
            <Text style={styles.headerSubtitle}>
              Select an alternative slot with{" "}
              {formatDoctorName(appointment.doctorName)}
            </Text>
          </View>
        </View>

        {/* Current Booking Banner */}
        <Card padded style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={Palette.primaryDark}
            />
            <Text style={styles.currentLabel}>Current Appointment</Text>
          </View>
          <Text style={styles.currentDoctor}>
            {formatDoctorName(appointment.doctorName, "Attending Doctor")}
          </Text>
          <Text style={styles.currentMeta}>
            {formatDDMMYYYY(appointment.bookingDate)} at{" "}
            {appointment.bookingTime}
          </Text>
        </Card>

        {submitError ? (
          <FormMessage type="error" message={submitError} />
        ) : null}

        {/* Date Selector */}
        <Card padded style={styles.stepCard}>
          <Text style={styles.sectionTitle}>Select New Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
            style={styles.dateScroll}
          >
            {days.map((date) => {
              const dateStr = toDDMMYYYY(date);
              const active = dateStr === selectedDateStr;
              const isToday = dateStr === toDDMMYYYY(new Date());

              return (
                <Pressable
                  key={dateStr}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(date)}
                  style={[styles.dateCell, active && styles.dateCellActive]}
                >
                  <Text
                    style={[
                      styles.dateWeekday,
                      active && styles.dateTextActive,
                    ]}
                  >
                    {isToday ? "Today" : weekdayLabel(date)}
                  </Text>
                  <Text
                    style={[styles.dateNumber, active && styles.dateTextActive]}
                  >
                    {date.getDate()}
                  </Text>
                  <Text
                    style={[styles.dateMonth, active && styles.dateTextActive]}
                  >
                    {dateLabel(date).split(" ")[1]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        {/* Slot Selector */}
        <Card padded style={styles.stepCard}>
          <View style={styles.slotHeaderRow}>
            <Text style={styles.sectionTitle}>Select New Time Slot</Text>
            {availableSlots.length > 0 ? (
              <Text style={styles.slotCountText}>
                {availableSlots.length} available
              </Text>
            ) : null}
          </View>

          {slotsLoading ? (
            <Loading label="Checking availability..." fullScreen={false} />
          ) : slotsError ? (
            <FormMessage type="error" message={slotsError} />
          ) : availableSlots.length === 0 ? (
            <FormMessage
              type="info"
              message="No available slots for this date. Please choose another day."
            />
          ) : (
            <View style={styles.sessionsContainer}>
              {morning.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <Text style={styles.sessionTitle}>Morning Session</Text>
                  <View style={styles.slotGrid}>
                    {morning.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={[styles.slot, active && styles.slotActive]}
                        >
                          <Text
                            style={[
                              styles.slotText,
                              active && styles.slotTextActive,
                            ]}
                          >
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {afternoon.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <Text style={styles.sessionTitle}>Afternoon Session</Text>
                  <View style={styles.slotGrid}>
                    {afternoon.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={[styles.slot, active && styles.slotActive]}
                        >
                          <Text
                            style={[
                              styles.slotText,
                              active && styles.slotTextActive,
                            ]}
                          >
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {evening.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <Text style={styles.sessionTitle}>Evening Session</Text>
                  <View style={styles.slotGrid}>
                    {evening.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={[styles.slot, active && styles.slotActive]}
                        >
                          <Text
                            style={[
                              styles.slotText,
                              active && styles.slotTextActive,
                            ]}
                          >
                            {slot}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {/* Reason Input */}
        <Input
          label="Rescheduling Reason (Optional)"
          placeholder="e.g. Schedule conflict or personal emergency"
          value={reason}
          onChangeText={setReason}
        />

        <Button
          title={submitting ? "Rescheduling..." : "Confirm Reschedule"}
          icon="calendar"
          onPress={confirmReschedule}
          loading={submitting}
          disabled={!selectedSlot}
          style={styles.confirmBtn}
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  currentCard: {
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    borderColor: "rgba(14, 159, 142, 0.2)",
    borderWidth: 1,
    borderRadius: Radius.lg,
    gap: 2,
  },
  currentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  currentDoctor: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: 2,
  },
  currentMeta: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  stepCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Palette.text,
  },
  dateScroll: {
    marginHorizontal: -Spacing.md,
  },
  dateRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dateCell: {
    width: 58,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    gap: 2,
  },
  dateCellActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
    ...Shadows.sm,
  },
  dateWeekday: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  dateNumber: {
    ...Typography.h4,
    color: Palette.text,
  },
  dateMonth: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "uppercase",
    fontSize: 10,
    fontWeight: "700",
  },
  dateTextActive: {
    color: Palette.white,
  },
  slotHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotCountText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  sessionsContainer: {
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  sessionGroup: {
    gap: Spacing.xs,
  },
  sessionTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slot: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
    backgroundColor: Palette.surface,
    minWidth: 92,
    alignItems: "center",
  },
  slotActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  slotText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
  },
  slotTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  confirmBtn: {
    marginTop: Spacing.xs,
  },
});
