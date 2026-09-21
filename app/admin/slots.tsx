/**
 * HealPoint - Hospital Admin - Smart Slot Generation & Management.
 *
 * Premium slot workspace: pick a doctor -> preview the real generation plan
 * (no inserts) -> confirm or bulk-generate a range -> manage a live timeline
 * (block/unblock). Every count is computed by the backend from the doctor's
 * REAL schedule + existing slots - nothing is fabricated client-side.
 *
 * Security is server-enforced (the admin's own hospital is always used; a
 * foreign doctor returns 403). This screen renders what the API returns.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { ScheduleDashboard } from '@/components/admin/ScheduleDashboard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY, formatISODate, toDDMMYYYY } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import * as slotService from '@/services/slots';
import { getDoctorDetails } from '@/services/doctors';
import type { Doctor } from '@/types';

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function toDD(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

/** 24h "HH:mm" -> "09:00 AM" label. */
function formatSlotTime(hhmm: string): string {
  const parts = String(hhmm || '').split(':');
  if (parts.length !== 2) return hhmm || '';
  let h = Number(parts[0]) % 24;
  const m = parts[1];
  const ap = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  return `${String(h).padStart(2, '0')}:${m} ${ap}`;
}

const STATUS_THEME: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  available: { label: 'Available', color: Palette.success, bg: '#E2F5E9', icon: 'checkmark-circle' },
  booked: { label: 'Booked', color: Palette.info, bg: '#E7F1FE', icon: 'calendar' },
  blocked: { label: 'Blocked', color: Palette.warning, bg: '#FDF0DC', icon: 'lock-closed' },
  cancelled: { label: 'Cancelled', color: Palette.textMuted, bg: '#EEF1F0', icon: 'close-circle' },
  expired: { label: 'Expired', color: Palette.textMuted, bg: '#EEF1F0', icon: 'time' },
};

export default function AdminSlotsScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [rangeMode, setRangeMode] = useState<'week' | 'month'>('week');
  const [fromDate, setFromDate] = useState(() => toDD(new Date()));
  const [toDate, setToDate] = useState(() => toDD(addDays(new Date(), 6)));
  const [preview, setPreview] = useState<slotService.SlotPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [calendar, setCalendar] = useState<slotService.SlotCalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<slotService.SlotGenerateResponse | slotService.SlotRegenerateResponse | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<slotService.SlotItem | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [actionError, setActionError] = useState('');
const loadDoctors = useCallback(async () => {
    setDoctorsLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalDoctors();
      setDoctors(res.data || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setDoctorsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  const loadDoctor = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await getDoctorDetails(id);
      setDoctor(res.doctor || null);
    } catch {
      // Non-fatal; preview errors surface separately.
    }
  }, []);

  useEffect(() => {
    void loadDoctor(selectedDoctorId);
  }, [selectedDoctorId, loadDoctor]);

  const computeRange = useCallback((mode: 'week' | 'month') => {
    const start = new Date();
    if (mode === 'week') {
      setFromDate(toDD(start));
      setToDate(toDD(addDays(start, 6)));
    } else {
      setFromDate(toDD(start));
      setToDate(toDD(addDays(start, 29)));
    }
  }, []);

  useEffect(() => {
    computeRange(rangeMode);
  }, [rangeMode, computeRange]);

  const previewSlots = useCallback(async () => {
    if (!selectedDoctorId) return;
    setPreviewLoading(true);
    setError('');
    setActionError('');
    setResult(null);
    try {
      const res = await slotService.previewSlots(selectedDoctorId, fromDate, toDate);
      setPreview(res);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to preview slots.'));
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedDoctorId, fromDate, toDate]);

  const loadCalendar = useCallback(async () => {
    if (!selectedDoctorId) return;
    setCalendarLoading(true);
    setActionError('');
    try {
      const res = await slotService.getSlotCalendar(selectedDoctorId, fromDate, toDate);
      setCalendar(res);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Unable to load the slot calendar.'));
    } finally {
      setCalendarLoading(false);
    }
  }, [selectedDoctorId, fromDate, toDate]);

  useEffect(() => {
    if (selectedDoctorId) {
      void loadCalendar();
      void previewSlots();
    }
  }, [selectedDoctorId, loadCalendar, previewSlots]);

  const runGenerate = useCallback(
    async (isRegenerate: boolean) => {
      if (!selectedDoctorId) return;
      setGenerating(true);
      setError('');
      setActionError('');
      try {
        if (isRegenerate) {
          const res = await slotService.regenerateSlots(selectedDoctorId, fromDate, toDate);
          setResult(res);
        } else {
          const res = await slotService.generateSlots(selectedDoctorId, fromDate, toDate);
          setResult(res);
        }
        setConfirmVisible(false);
        await loadCalendar();
        void previewSlots();
      } catch (err) {
        setError(toErrorMessage(err, 'Unable to generate slots.'));
        setConfirmVisible(false);
      } finally {
        setGenerating(false);
      }
    },
    [selectedDoctorId, fromDate, toDate, loadCalendar, previewSlots],
  );

  const runBlock = useCallback(async () => {
    if (!selectedSlot || !selectedDoctorId) return;
    setBlocking(true);
    setActionError('');
    try {
      await slotService.blockSlot(selectedDoctorId, selectedSlot.date, selectedSlot.startTime, 'Doctor Meeting');
      setSelectedSlot(null);
      await loadCalendar();
      void previewSlots();
    } catch (err) {
      setActionError(toErrorMessage(err, 'Unable to block slot.'));
    } finally {
      setBlocking(false);
    }
  }, [selectedSlot, selectedDoctorId, loadCalendar, previewSlots]);

  const runUnblock = useCallback(async () => {
    if (!selectedSlot || !selectedDoctorId) return;
    setBlocking(true);
    setActionError('');
    try {
      await slotService.unblockSlot(selectedDoctorId, selectedSlot.date, selectedSlot.startTime);
      setSelectedSlot(null);
      await loadCalendar();
      void previewSlots();
    } catch (err) {
      setActionError(toErrorMessage(err, 'Unable to unblock slot.'));
    } finally {
      setBlocking(false);
    }
  }, [selectedSlot, selectedDoctorId, loadCalendar, previewSlots]);

  // ---- Part 5: Bulk scheduling (preview -> confirm -> apply) ----
  const [bulkPreview, setBulkPreview] = useState<slotService.BulkPreviewResponse | null>(null);
  const [bulkDays, setBulkDays] = useState<number[]>([1, 3, 5]);
  const [bulkBehavior, setBulkBehavior] = useState<'generate_missing' | 'regenerate_available'>('generate_missing');
  const [bulkDuration, setBulkDuration] = useState<number | null>(null);
  const [bulkPreviewing, setBulkPreviewing] = useState(false);
  const [bulkConfirmVisible, setBulkConfirmVisible] = useState(false);
  const [bulkResult, setBulkResult] = useState<slotService.BulkApplyResponse['data'] | null>(null);
  const [bulkError, setBulkError] = useState('');

  const previewBulk = useCallback(async () => {
    if (!selectedDoctorId) return;
    setBulkPreviewing(true);
    setBulkError('');
    setBulkPreview(null);
    try {
      const res = await slotService.previewBulkScheduling(selectedDoctorId, {
        fromDate,
        toDate,
        daysOfWeek: bulkDays,
        behavior: bulkBehavior,
        slotDurationMinutes: bulkDuration,
      });
      setBulkPreview(res);
    } catch (err) {
      setBulkError(toErrorMessage(err, 'Unable to preview bulk scheduling.'));
    } finally {
      setBulkPreviewing(false);
    }
  }, [selectedDoctorId, fromDate, toDate, bulkDays, bulkBehavior, bulkDuration]);

  const runBulkApply = useCallback(async () => {
    if (!selectedDoctorId) return;
    setGenerating(true);
    setBulkError('');
    try {
      const res = await slotService.applyBulkScheduling(selectedDoctorId, {
        fromDate,
        toDate,
        daysOfWeek: bulkDays,
        behavior: bulkBehavior,
        slotDurationMinutes: bulkDuration,
        confirm: true,
      });
      setBulkResult(res.data);
      setBulkConfirmVisible(false);
      await loadCalendar();
      void previewSlots();
    } catch (err) {
      setBulkError(toErrorMessage(err, 'Unable to apply bulk scheduling.'));
    } finally {
      setGenerating(false);
    }
  }, [selectedDoctorId, fromDate, toDate, bulkDays, bulkBehavior, bulkDuration, loadCalendar, previewSlots]);

  const bulkTotals = bulkPreview?.data?.totals;

  const bulkDayChip = (value: number, label: string) => (
    <Pressable
      onPress={() => {
        setBulkDays((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort()));
      }}
      style={({ pressed }) => [
        styles.bulkDayChip,
        bulkDays.includes(value) && styles.bulkDayChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.bulkDayText, bulkDays.includes(value) && styles.bulkDayTextActive]}>{label}</Text>
    </Pressable>
  );

  const totals = preview?.data?.totals;
const calendarDays = calendar?.data?.perDate || [];
const resultData = result?.data as
    | slotService.SlotGenerateResponse['data']
    | slotService.SlotRegenerateResponse['data']
    | null;
  const resultCreated =
    (resultData as slotService.SlotGenerateResponse['data'])?.created ?? 0;
  const resultExisting =
    (resultData as slotService.SlotGenerateResponse['data'])?.alreadyExisting ?? 0;
  const resultSkipped =
    ((resultData as slotService.SlotGenerateResponse['data'])?.skippedLeave ?? 0) +
    ((resultData as slotService.SlotGenerateResponse['data'])?.skippedHoliday ?? 0) +
    ((resultData as slotService.SlotGenerateResponse['data'])?.skippedOverride ?? 0);
  const resultConflicts =
    (resultData as slotService.SlotGenerateResponse['data'])?.conflicts ?? 0;
return (
    <AdminModuleScreen
      title="Slot Management"
      subtitle="Smart slot generation & availability"
      allowedRoles={['admin']}
      loading={doctorsLoading}
      error={error}
      onRetry={loadDoctors}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: '#0E9F8E1A' }]}>
            <Ionicons name="time-outline" size={26} color={Palette.primary} />
          </View>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>Smart Slot Generation</Text>
            <Text style={styles.heroSub}>Materializes your doctors&apos; real schedules into bookable slots.</Text>
          </View>
        </View>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>1 · Choose doctor</Text>
          {doctors.length === 0 ? (
            <FormMessage type="info" message="No doctors found for your hospital yet." />
          ) : (
            <View style={styles.doctorChips}>
              {doctors.map((d) => {
                const active = String(d._id) === selectedDoctorId;
                return (
                  <Pressable key={String(d._id)} accessibilityRole="button" onPress={() => setSelectedDoctorId(String(d._id))}>
                    <View style={[styles.doctorChip, active && styles.doctorChipActive]}>
                      <Text style={[styles.doctorChipName, active && styles.doctorChipTextActive]} numberOfLines={1}>
                        {d.name || 'Doctor'}
                      </Text>
                      <Text style={[styles.doctorChipSub, active && styles.doctorChipTextActive]} numberOfLines={1}>
                        {d.speciality || d.department || 'General'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {doctor ? (
            <View style={styles.doctorMeta}>
              <Ionicons name="medkit-outline" size={16} color={Palette.primary} />
              <Text style={styles.doctorMetaText}>
                {doctor.name} · {doctor.speciality || doctor.department || 'General'} · {doctor.slotDurationMinutes || 30} min slots
              </Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>2 · Working schedule</Text>
          {doctor?.weeklySchedule && doctor.weeklySchedule.length > 0 ? (
            <View style={styles.scheduleRows}>
              {doctor.weeklySchedule
                .filter((d) => d && d.enabled !== false)
                .map((day) => (
                  <View key={`${day.day}-${day.startTime}`} style={styles.scheduleRow}>
                    <Text style={styles.scheduleDay}>{day.day}</Text>
                    <Text style={styles.scheduleTime}>
                      {day.startTime} - {day.endTime}
                      {day.sessions?.length ? ` (${day.sessions.length} sessions)` : ''}
                    </Text>
                  </View>
                ))}
            </View>
          ) : (
            <FormMessage type="warning" message="No weekly schedule configured for this doctor." />
          )}
          {doctor?.leaves && doctor.leaves.length > 0 ? (
            <View style={styles.leaveRow}>
              <Ionicons name="warning" size={14} color={Palette.warning} />
              <Text style={styles.leaveText}>
                {doctor.leaves.length} leave record(s) - these dates are excluded from generation.
              </Text>
            </View>
          ) : null}
          {doctor?.blockedHolidays && doctor.blockedHolidays.length > 0 ? (
            <View style={styles.leaveRow}>
              <Ionicons name="warning" size={14} color={Palette.warning} />
              <Text style={styles.leaveText}>
                {doctor.blockedHolidays.length} holiday(s) - these dates are excluded from generation.
              </Text>
            </View>
          ) : null}
        </Card>
<Card style={styles.section}>
          <Text style={styles.sectionTitle}>3 · Date range</Text>
          <View style={styles.modeChips}>
            {(['week', 'month'] as const).map((mode) => {
              const active = rangeMode === mode;
              return (
                <Pressable key={mode} accessibilityRole="button" onPress={() => setRangeMode(mode)}>
                  <View style={[styles.modeChip, active && styles.modeChipActive]}>
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {mode === 'week' ? 'Next 7 days' : 'Next 30 days'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.rangeRow}>
            <Text style={styles.rangeValue}>{formatDDMMYYYY(fromDate)}</Text>
            <Ionicons name="arrow-forward" size={16} color={Palette.textMuted} />
            <Text style={styles.rangeValue}>{formatDDMMYYYY(toDate)}</Text>
          </View>
          <View style={styles.previewActions}>
            <Button
              title="Preview slots"
              variant="secondary"
              icon="eye-outline"
              loading={previewLoading}
              disabled={!selectedDoctorId || generating}
              onPress={previewSlots}
              style={styles.actionButton}
            />
            <Button
              title="Generate"
              variant="ghost"
              icon="sparkles-outline"
              disabled={!selectedDoctorId || previewLoading || generating || !totals || totals.expected === 0}
              onPress={() => setConfirmVisible(true)}
              style={styles.actionButton}
            />
          </View>
        </Card>

        {preview?.data ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>4 · Generation preview</Text>
            {totals ? (
              <View style={styles.statsRow}>
                {[
                  { label: 'New slots', value: Math.max(0, totals.expected - totals.alreadyExisting), accent: Palette.primary },
                  { label: 'Existing', value: totals.alreadyExisting, accent: Palette.info },
                  { label: 'Booked', value: totals.booked, accent: Palette.warning },
                  { label: 'Skipped dates', value: totals.skipped, accent: Palette.textMuted },
                ].map((s) => (
                  <View key={s.label} style={[styles.statChip, { backgroundColor: `${s.accent}1F` }]}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.dateReasons}>
              {preview.data.perDate.map((day) => (
                <View key={day.date} style={styles.dateReasonRow}>
                  <Text style={styles.dateReasonLabel}>{formatDDMMYYYY(day.date)}</Text>
                  <View style={styles.dateReasonBadge}>
                    <Text style={styles.dateReasonText}>
                      {day.reason === 'open' ? `${day.expected} slots` : day.reason.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
{selectedDoctorId ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>5 · Slot timeline</Text>
            <View style={styles.legend}>
              {Object.values(STATUS_THEME).map((t) => (
                <View key={t.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                  <Text style={styles.legendText}>{t.label}</Text>
                </View>
              ))}
            </View>
            {actionError ? <FormMessage type="error" message={actionError} /> : null}
            {calendarLoading ? (
              <FormMessage type="info" message="Loading slot calendar..." />
            ) : calendarDays.length === 0 ? (
              <FormMessage type="info" message="No slots in this range. Generate first." />
            ) : (
              calendarDays.map((day) => (
                <View key={day.date} style={styles.dayBlock}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{formatDDMMYYYY(day.date)}</Text>
                    <Text style={styles.dayCount}>{day.slots.length} slots</Text>
                  </View>
                  <View style={styles.slotGrid}>
                    {day.slots.map((slotItem) => (
                      <Pressable
                        key={`${day.date}-${slotItem.startTime}`}
                        accessibilityRole="button"
                        onPress={() => setSelectedSlot(slotItem)}
                        style={({ pressed }) => [styles.slotCard, pressed && styles.pressed]}
                      >
                        {(() => {
                          const theme = STATUS_THEME[slotItem.status] || STATUS_THEME.expired;
                          return (
                            <View style={styles.slotInner}>
                              <View style={[styles.slotIcon, { backgroundColor: theme.bg }]}>
                                <Ionicons name={theme.icon} size={14} color={theme.color} />
                              </View>
                              <View style={styles.slotTexts}>
                                <Text style={styles.slotTime}>{formatSlotTime(slotItem.startTime)}</Text>
                                <Text style={[styles.slotStatus, { color: theme.color }]}>{theme.label}</Text>
                              </View>
                            </View>
                          );
                        })()}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            )}
          </Card>
        ) : null}

        {result ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Operation result</Text>
            <View style={styles.statsRow}>
              {[
                { label: 'Created', value: resultCreated, accent: Palette.success },
                { label: 'Already existed', value: resultExisting, accent: Palette.info },
                { label: 'Skipped', value: resultSkipped, accent: Palette.textMuted },
                { label: 'Conflicts', value: resultConflicts, accent: Palette.error },
              ].map((s) => (
                <View key={s.label} style={[styles.statChip, { backgroundColor: `${s.accent}1F` }]}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
        {selectedDoctorId ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>6 · Bulk scheduling (advanced)</Text>
            <Text style={styles.bulkHint}>
              Apply a schedule across a date range. A real preview always appears before anything writes.
            </Text>
            <View style={styles.bulkDaysRow}>
              {([['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]] as const).map(([label, v]) => bulkDayChip(v, label))}
            </View>
            <View style={styles.bulkDaysRow}>
              {(['generate_missing', 'regenerate_available'] as const).map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setBulkBehavior(b)}
                  style={({ pressed }) => [styles.bulkDayChip, bulkBehavior === b && styles.bulkDayChipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.bulkDayText, bulkBehavior === b && styles.bulkDayTextActive]}>
                    {b === 'generate_missing' ? 'Add missing only' : 'Regenerate available'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {bulkError ? <FormMessage type="error" message={bulkError} /> : null}
            <View style={styles.previewActions}>
              <Button title="Preview bulk plan" variant="secondary" icon="eye-outline" loading={bulkPreviewing} disabled={!selectedDoctorId} onPress={previewBulk} style={styles.actionButton} />
              {bulkPreview?.data ? (
                <Button title="Apply (with confirm)" variant="ghost" icon="sparkles-outline" disabled={!bulkTotals || bulkTotals.expectedSlots === 0} onPress={() => setBulkConfirmVisible(true)} style={styles.actionButton} />
              ) : null}
            </View>
            {bulkPreview?.data && bulkTotals ? (
              <View style={styles.statsRow}>
                {[
                  { label: 'Dates', value: bulkTotals.datesAffected, accent: Palette.info },
                  { label: 'Expected', value: bulkTotals.expectedSlots, accent: Palette.primary },
                  { label: 'New', value: bulkTotals.newSlots, accent: Palette.success },
                  { label: 'Existing', value: bulkTotals.existingSlots, accent: Palette.info },
                  { label: 'Booked/protected', value: bulkTotals.bookedSlots, accent: Palette.warning },
                  { label: 'Leave', value: bulkTotals.leaveDates, accent: Palette.warning },
                  { label: 'Holiday', value: bulkTotals.holidayDates, accent: Palette.error },
                  { label: 'Override', value: bulkTotals.overrideDates, accent: Palette.primary },
                  { label: 'Conflicts', value: bulkTotals.conflicts, accent: Palette.error },
                ].map((s) => (
                  <View key={s.label} style={[styles.statChip, { backgroundColor: `${s.accent}1F` }]}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {bulkPreview?.data?.perDate ? (
              <View style={styles.dateReasons}>
                {bulkPreview.data.perDate.map((day) => (
                  <View key={day.date} style={styles.dateReasonRow}>
                    <Text style={styles.dateReasonLabel}>{formatDDMMYYYY(day.date)}</Text>
                    <View style={styles.dateReasonBadge}>
                      <Text style={styles.dateReasonText}>
                        {day.reason === 'open' ? `${day.created} new / ${day.existing} existing / ${day.expected} expected` : day.reason.replace('_', ' ')}
                      </Text>
                    </View>
                    {day.leave ? <Badge label="Leave" variant="neutral" /> : null}
                    {day.holiday ? <Badge label="Holiday" variant="warning" /> : null}
                    {day.override ? <Badge label="Override" variant="primary" /> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {bulkResult ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Bulk operation result (real backend numbers)</Text>
            <View style={styles.statsRow}>
              {[
                { label: 'Created', value: bulkResult.created || 0, accent: Palette.success },
                { label: 'Skipped', value: bulkResult.skipped || 0, accent: Palette.textMuted },
                { label: 'Already existed', value: bulkResult.alreadyExisting || 0, accent: Palette.info },
                { label: 'Booked/protected', value: bulkResult.bookedProtected || 0, accent: Palette.warning },
                { label: 'Blocked', value: bulkResult.blocked || 0, accent: Palette.warning },
                { label: 'Leave', value: bulkResult.leaveConflicts || 0, accent: Palette.warning },
                { label: 'Holiday', value: bulkResult.holidayConflicts || 0, accent: Palette.error },
                { label: 'Override', value: bulkResult.overrideConflicts || 0, accent: Palette.primary },
                { label: 'Other conf', value: bulkResult.otherConflicts || 0, accent: Palette.error },
                { label: 'Failed', value: bulkResult.failed || 0, accent: Palette.error },
              ].map((s) => (
                <View key={s.label} style={[styles.statChip, { backgroundColor: `${s.accent}1F` }]}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {selectedDoctorId ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>7 · Scheduling control center</Text>
            <ScheduleDashboard
              key={`${selectedDoctorId}-${fromDate}-${toDate}`}
              doctorIds={[selectedDoctorId]}
              fromDate={fromDate}
              toDate={toDate}
              onResult={(r) => { if (r) setBulkResult(r); }}
            />
          </Card>
        ) : null}

        {bulkConfirmVisible ? (
          <ConfirmDialog
            visible
            title="Apply bulk schedule?"
            message={`This will ${bulkBehavior === 'regenerate_available' ? 'regenerate available' : 'generate missing'} slots for ${bulkTotals?.datesAffected ?? 0} date(s), creating up to ${bulkTotals?.newSlots ?? 0} new slot(s). Booked/paid slots are NEVER touched. This action is idempotent and safe to repeat.`}
            confirmLabel="Apply"
            cancelLabel="Cancel"
            loading={generating}
            onConfirm={runBulkApply}
            onCancel={() => setBulkConfirmVisible(false)}
          />
        ) : null}
      </ScrollView>

      {selectedSlot ? (
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedSlot(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Slot details</Text>
              <Pressable accessibilityRole="button" onPress={() => setSelectedSlot(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color={Palette.textMuted} />
              </Pressable>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Date</Text>
              <Text style={styles.modalValue}>{formatDDMMYYYY(selectedSlot.date)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Time</Text>
              <Text style={styles.modalValue}>{formatSlotTime(selectedSlot.startTime)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Status</Text>
              <Badge label={(STATUS_THEME[selectedSlot.status] || STATUS_THEME.expired).label} variant="neutral" />
            </View>
            {selectedSlot.status === 'blocked' && selectedSlot.blockReason ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Blocked reason</Text>
                <Text style={styles.modalValue}>{selectedSlot.blockReason}</Text>
              </View>
            ) : null}
            {selectedSlot.blockedAt ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Blocked on</Text>
                <Text style={styles.modalValue}>{formatISODate(selectedSlot.blockedAt)}</Text>
              </View>
            ) : null}
            {selectedSlot.appointmentId ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Appointment ref</Text>
                <Text style={styles.modalValue}>{selectedSlot.appointmentId}</Text>
              </View>
            ) : null}
            {actionError ? <FormMessage type="error" message={actionError} /> : null}
            <View style={styles.modalActions}>
              {selectedSlot.status === 'available' ? (
                <Button title="Block slot" variant="outline" icon="lock-closed" loading={blocking} onPress={runBlock} style={styles.modalButton} />
              ) : null}
              {selectedSlot.status === 'blocked' ? (
                <Button title="Unblock slot" variant="primary" icon="lock-open" loading={blocking} onPress={runUnblock} style={styles.modalButton} />
              ) : null}
              <Button title="Close" variant="ghost" onPress={() => setSelectedSlot(null)} style={styles.modalButton} />
            </View>
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmVisible}
        title="Generate slots?"
        message={totals ? `This will create ${Math.max(0, totals.expected - totals.alreadyExisting)} new slot(s) across ${totals.dates} date(s). Existing booked slots are never touched.` : 'Continue?'}
        confirmLabel="Confirm Generate"
        loading={generating}
        onConfirm={() => runGenerate(false)}
        onCancel={() => setConfirmVisible(false)}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroIcon: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  heroTexts: { flex: 1 },
  heroTitle: { ...Typography.h3, color: Palette.text },
  heroSub: { ...Typography.bodySmall, color: Palette.textMuted },
  section: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text },
  doctorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  doctorChip: {
    minWidth: 120,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    gap: 6,
  },
  doctorChipActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },
  doctorChipName: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  doctorChipSub: { ...Typography.caption, color: Palette.textMuted },
  doctorChipTextActive: { color: Palette.primaryDark },
  doctorMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  doctorMetaText: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  scheduleRows: { gap: 2 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: Spacing.xs },
  scheduleDay: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  scheduleTime: { ...Typography.bodySmall, color: Palette.textMuted },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  leaveText: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  modeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  modeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modeChipActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },
  modeChipText: { ...Typography.bodySmall, color: Palette.text },
  modeChipTextActive: { color: Palette.primaryDark, fontWeight: '600' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'space-between' },
  rangeValue: { ...Typography.bodyMedium, color: Palette.primaryDark, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statChip: {
    minWidth: 84,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'flex-start',
  },
  statValue: { ...Typography.h4, color: Palette.text },
  statLabel: { ...Typography.caption, color: Palette.textMuted },
  dateReasons: { gap: Spacing.xs },
  dateReasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateReasonLabel: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  dateReasonBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  dateReasonText: { ...Typography.caption, color: Palette.primaryDark },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...Typography.caption, color: Palette.textMuted },
  dayBlock: { gap: Spacing.sm, marginTop: Spacing.xs },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  dayCount: { ...Typography.caption, color: Palette.textMuted },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slotCard: {
    width: 118,
    padding: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  slotInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  slotIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  slotTexts: { flex: 1 },
  slotTime: { ...Typography.bodySmall, color: Palette.text },
  slotStatus: { ...Typography.caption, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  footerText: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  modalBackdrop: { flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Palette.overlay, justifyContent: 'center', padding: Spacing.xxl },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  modalLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  modalValue: { ...Typography.bodySmall, color: Palette.text, flexShrink: 1 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalButton: { flex: 1 },
  bulkHint: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.xs },
  bulkDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  bulkDayChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  bulkDayChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  bulkDayText: { ...Typography.bodySmall, color: Palette.textMuted, fontWeight: '600' },
  bulkDayTextActive: { color: Palette.white },
  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  bulkLabel: { ...Typography.label, color: Palette.text, flex: 1 },
  bulkInput: {
    borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 15, color: Palette.text, backgroundColor: Palette.surface, minWidth: 110,
  },
});
