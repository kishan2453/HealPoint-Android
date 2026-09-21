/**
 * HealPoint - Hospital Admin · Reschedule workflow (real scheduling system).
 *
 * The doctor is locked to the appointment's REAL doctor (the backend reschedule
 * contract always keeps the doctor). The admin picks a future date and the same
 * slot engine used by patient booking returns genuinely available slots —
 * blocked/booked/leave/holiday/break slots never appear. On save the backend
 * re-validates atomically (conflict query + unique partial index): if another
 * booking claimed the slot first it returns 409 and the original appointment is
 * preserved untouched. Nothing here is fake or cached.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  appointmentDoctorName,
  appointmentReference,
} from "@/lib/appointments";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import {
  dateLabel,
  formatDDMMYYYY,
  toDDMMYYYY,
  weekdayLabel,
} from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import { getAvailableSlots } from "@/services/appointments";
import type { Appointment } from "@/types";

interface RescheduleModalProps {
  visible: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  /** Performs the real API call. Return an empty string on success. */
  onSubmit: (payload: {
    slotDate: string;
    slotTime: string;
    reason: string;
  }) => Promise<string>;
}

const RANGE_DAYS = 21;

function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function parseDD(dateKey: string): Date {
  const [dd, mm, yyyy] = dateKey.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export function RescheduleModal({
  visible,
  appointment,
  onClose,
  onSubmit,
}: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    toDDMMYYYY(startOfTomorrow()),
  );
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const doctorId = appointment
    ? typeof appointment.doctorId === "object"
      ? String(appointment.doctorId?._id || "")
      : String(appointment.doctorId)
    : "";

  useEffect(() => {
    if (visible) {
      setSelectedDate(toDDMMYYYY(startOfTomorrow()));
      setSlots([]);
      setSlotsError("");
      setSelectedSlot("");
      setReason("");
      setSubmitError("");
      setDoctorName(appointment ? appointmentDoctorName(appointment) : "");
    }
  }, [visible, appointment]);

  const loadSlots = useCallback(
    async (date: string) => {
      if (!visible || !doctorId) return;
      setSlotsLoading(true);
      setSlotsError("");
      try {
        const res = await getAvailableSlots(doctorId, date);
        setSlots(res.availableSlots || []);
        setSelectedSlot("");
      } catch (err) {
        setSlots([]);
        setSlotsError(toErrorMessage(err, "Unable to load available slots."));
      } finally {
        setSlotsLoading(false);
      }
    },
    [visible, doctorId],
  );

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const dates: { key: string }[] = [];
  {
    const cursor = startOfTomorrow();
    for (let i = 0; i < RANGE_DAYS; i++) {
      dates.push({ key: toDDMMYYYY(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const runSubmit = async () => {
    if (!appointment || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const error = await onSubmit({
        slotDate: selectedDate,
        slotTime: selectedSlot,
        reason: reason.trim(),
      });
      setSubmitError(error);
    } catch (err) {
      setSubmitError(
        toErrorMessage(err, "Unable to reschedule the appointment."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={submitting ? undefined : onClose}
          accessibilityLabel="Dismiss"
        />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTexts}>
              <Text style={styles.reference} numberOfLines={1}>
                {appointment ? appointmentReference(appointment) : ""}
              </Text>
              <Text style={styles.title}>Reschedule appointment</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={20} color={Palette.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {appointment ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Appointment</Text>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="medkit-outline"
                    size={16}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.metaText}>
                    Dr. {doctorName.replace(/^(?:dr\.?|doctor)\s+/gi, "")}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.metaText}>
                    {formatDDMMYYYY(appointment.slotDate)} ·{" "}
                    {appointment.slotTime || "—"}
                  </Text>
                </View>
                <Text style={styles.hint}>
                  The doctor stays the same when rescheduling. Pick a new date
                  and an available slot below.
                </Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRow}
              >
                {dates.map(({ key }) => {
                  const parsed = parseDD(key);
                  const selected = key === selectedDate;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedDate(key)}
                      style={({ pressed }) => [
                        styles.dateChip,
                        selected && styles.dateChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateWeekday,
                          selected && styles.dateTextSelected,
                        ]}
                      >
                        {weekdayLabel(parsed)}
                      </Text>
                      <Text
                        style={[
                          styles.dateDay,
                          selected && styles.dateTextSelected,
                        ]}
                      >
                        {dateLabel(parsed)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Available slots · {formatDDMMYYYY(selectedDate)}
              </Text>
              {slotsLoading ? (
                <Text style={styles.muted}>Checking the schedule…</Text>
              ) : slotsError ? (
                <FormMessage type="error" message={slotsError} />
              ) : slots.length === 0 ? (
                <View style={styles.emptySlots}>
                  <Ionicons
                    name="hourglass-outline"
                    size={22}
                    color={Palette.warning}
                  />
                  <Text style={styles.muted}>
                    No available slots on this date. The slot engine excludes
                    breaks, leave, holidays and blocked/booked times. Try
                    another date.
                  </Text>
                </View>
              ) : (
                <View style={styles.slotGrid}>
                  {slots.map((slot) => {
                    const selected = slot === selectedSlot;
                    return (
                      <Pressable
                        key={slot}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedSlot(selected ? "" : slot)}
                        style={({ pressed }) => [
                          styles.slotChip,
                          selected && styles.slotChipSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            selected && styles.slotTextSelected,
                          ]}
                        >
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Input
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Patient requested a later time"
              maxLength={200}
            />

            {submitError ? (
              <FormMessage type="error" message={submitError} />
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Reschedule appointment"
              loading={submitting}
              disabled={!selectedSlot}
              icon="calendar-outline"
              onPress={runSubmit}
            />
            <Button
              title="Close"
              variant="outline"
              onPress={onClose}
              style={styles.footerSecondary}
              disabled={submitting}
            />
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
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 620,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: "92%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  headerTexts: { flex: 1, gap: 2 },
  reference: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  title: { ...Typography.h4, color: Palette.text },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  section: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  metaText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "500",
    flexShrink: 1,
  },
  hint: { ...Typography.caption, color: Palette.textMuted },
  dateRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  dateChip: {
    minWidth: 72,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: "center",
    gap: 2,
  },
  dateChipSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dateWeekday: { ...Typography.caption, color: Palette.textMuted },
  dateDay: { ...Typography.bodySmall, fontWeight: "600", color: Palette.text },
  dateTextSelected: { color: Palette.white },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  emptySlots: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  slotChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    minWidth: 96,
    alignItems: "center",
  },
  slotChipSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  slotText: { ...Typography.bodySmall, fontWeight: "600", color: Palette.text },
  slotTextSelected: { color: Palette.white },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    gap: Spacing.sm,
  },
  footerSecondary: { minHeight: 48 },
});
