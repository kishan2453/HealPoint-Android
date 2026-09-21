/**
 * HealPoint - Hospital Admin - Advanced Calendar + Conflict Center + Bulk
 * Scheduling results, built EXCLUSIVELY on the REAL slot inventory (same Slot
 * collection + hospital isolation as Parts 1-4). No second scheduling system,
 * no fake data: every chip/count comes from the backend APIs.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as slotService from '@/services/slots';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayShort(ddmmyyyy: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(ddmmyyyy || ''));
  if (!match) return '';
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return DAY_NAMES[date.getDay()] || '';
}

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

function severityVariant(severity: string): 'error' | 'warning' | 'neutral' {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  return 'neutral';
}

function statusVariant(status: string): 'success' | 'primary' | 'warning' | 'neutral' {
  if (status === 'available') return 'success';
  if (status === 'booked') return 'primary';
  if (status === 'blocked') return 'warning';
  return 'neutral';
}

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'duplicate_slot' || type === 'overlapping_slots') return 'copy-outline';
  if (type === 'appointment_outside_working_hours') return 'time-outline';
  if (type.includes('leave')) return 'airplane-outline';
  if (type.includes('holiday')) return 'flag-outline';
  if (type.includes('override')) return 'calendar-outline';
  if (type.includes('break')) return 'cafe-outline';
  return 'alert-circle';
}

export interface ScheduleDashboardProps {
  doctorIds: string[];
  fromDate: string;
  toDate: string;
  selectedDepartment?: string;
  onResult?: (result: slotService.BulkApplyResponse['data']) => void;
}

const slotStatusColor = (status: string): string => {
  switch (status) {
    case 'available': return Palette.success;
    case 'booked': return Palette.info;
    case 'blocked': return Palette.warning;
    case 'cancelled': return Palette.textMuted;
    default: return Palette.textMuted;
  }
};

function formatHm(hhmm: string): string {
  return String(hhmm || '').slice(0, 5);
}

export function ScheduleDashboard({
  doctorIds,
  fromDate,
  toDate,
  selectedDepartment,
  onResult,
}: ScheduleDashboardProps) {
  const [calendar, setCalendar] = useState<slotService.HospitalCalendarResponse | null>(null);
  const [conflicts, setConflicts] = useState<slotService.ConflictListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'day' | 'week' | 'month' | 'list'>('week');
  const [selectedConflict, setSelectedConflict] = useState<slotService.SchedulingConflict | null>(null);
  const [actionResult, setActionResult] = useState<slotService.BulkApplyResponse['data'] | null>(null);
  const [selectedDate, setSelectedDate] = useState(fromDate);
  const doctorKey = doctorIds.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ids = doctorKey ? doctorKey.split(',') : [];
      if (!ids.length) {
        setCalendar(null);
        setConflicts(null);
        setLoading(false);
        return;
      }
      const calRes = await slotService.getHospitalCalendar(ids, fromDate, toDate, selectedDepartment || undefined);
      setCalendar(calRes);
      const conflictRes = await slotService.getSchedulingConflicts(ids[0], fromDate, toDate);
      setConflicts(conflictRes);
      setError('');
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load the scheduling calendar.'));
    } finally {
      setLoading(false);
    }
  }, [doctorKey, fromDate, toDate, selectedDepartment]);

  useEffect(() => {
    load();
  }, [load]);

  const perDate = calendar?.data?.perDate || [];
  const perDoctor = calendar?.data?.perDoctor || [];
  const conflictList = conflicts?.data?.conflicts || [];
  const summary = conflicts?.data?.summary;

  if (loading) return <Loading label="Loading scheduling calendar..." />;
  if (error) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" variant="outline" onPress={load} />
      </View>
    );
  }

  const doctorForDate = (date: string) =>
    perDoctor.map((d) => {
      const dd = d.perDate.find((p) => p.date === date);
      return { doctorName: d.doctorName || 'Doctor', slots: dd?.slots || [], appointments: dd?.appointments || [] };
    });

  const renderSlot = (s: slotService.SlotItem) => (
    <Pressable key={s.startTime} accessibilityRole="button" style={({ pressed }) => [styles.slotRow, pressed && styles.pressed]}>
      <Ionicons name="time-outline" size={14} color={slotStatusColor(s.status)} />
      <Text style={styles.slotTime}>{formatSlotTime(s.startTime)} – {formatSlotTime(s.endTime)}</Text>
      <Badge label={s.status} variant={statusVariant(s.status)} />
    </Pressable>
  );

  const renderDay = (date: string) => {
    const groups = doctorForDate(date);
    return (
      <View style={styles.dayCard}>
        <Text style={styles.cardTitle}>{weekdayShort(date)} · {formatDDMMYYYY(date)}</Text>
        {groups.length === 0 ? <Text style={styles.noSlots}>No doctors selected.</Text> : null}
        {groups.map((g) => (
          <View key={g.doctorName} style={styles.doctorGroup}>
            <Text style={styles.doctorName}>{g.doctorName}</Text>
            {g.slots.length === 0 ? <Text style={styles.noSlots}>No slots this day</Text> : null}
            {g.slots.map(renderSlot)}
            {g.appointments.length ? (
              <View style={styles.apptRow}>
                <Ionicons name="person-outline" size={14} color={Palette.info} />
                <Text style={styles.apptText}>
                  {g.appointments.length} appointment(s) · {g.appointments.map((a) => `${formatSlotTime(a.slotTime || '')} ${a.status || ''}`).join(', ')}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.toolbar}>
        {(['day', 'week', 'month', 'list'] as const).map((v) => (
          <Pressable key={v} onPress={() => setView(v)} style={({ pressed }) => [styles.viewChip, view === v && styles.viewChipActive, pressed && styles.pressed]}>
            <Text style={[styles.viewChipText, view === v && styles.viewChipTextActive]}>{v[0].toUpperCase() + v.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'list' ? (
        <Card padded>
          <Text style={styles.cardTitle}>All events in range</Text>
          {perDate.map((d) => (
            <View key={d.date} style={styles.dayCardSmall}>
              <View style={styles.listHeader}>
                <Text style={styles.listDate}>{formatDDMMYYYY(d.date)}</Text>
                <Badge label={`${d.available} free · ${d.booked} booked · ${d.blocked} blocked`} variant="neutral" />
              </View>
              {doctorForDate(d.date).map((g) =>
                g.slots.slice(0, 12).map((s) => (
                  <View key={`${d.date}-${g.doctorName}-${s.startTime}`} style={styles.eventRow}>
                    <Text style={styles.eventTime}>{formatHm(s.startTime)}</Text>
                    <Text style={styles.eventDoctor} numberOfLines={1}>{g.doctorName}</Text>
                    <Badge label={s.status} variant={statusVariant(s.status)} />
                  </View>
                ))
              )}
            </View>
          ))}
        </Card>
      ) : view === 'month' ? (
        <Card padded={false}>
          <View style={styles.monthGrid}>
            {DAY_NAMES.map((d) => <Text key={d} style={styles.monthHead}>{d}</Text>)}
            {perDate.map((d) => (
              <Pressable key={d.date} onPress={() => { setSelectedDate(d.date); setView('day'); }} accessibilityRole="button" style={({ pressed }) => [styles.monthCell, pressed && styles.pressed]}>
                <Text style={styles.monthDayNum}>{Number(String(d.date).slice(0, 2))}</Text>
                {d.holiday > 0 ? <Text style={styles.monthMark}>H</Text> : null}
                {d.leave > 0 ? <Text style={[styles.monthMark, styles.monthMarkLeave]}>L</Text> : null}
                {d.override > 0 ? <Text style={[styles.monthMark, styles.monthMarkOverride]}>O</Text> : null}
                <Text style={styles.monthCount}>{d.booked + d.available + d.blocked} slot(s)</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <View style={view === 'day' ? styles.dayWrap : styles.weekWrap}>
          {(view === 'day' ? [selectedDate] : perDate.slice(0, 7).map((d) => d.date)).map((date) => (
            <View key={date} style={styles.dayCardWrap}>{renderDay(date)}</View>
          ))}
        </View>
      )}

      <Card padded>
        <Text style={styles.cardTitle}>Conflict Center</Text>
        {summary ? (
          <View style={styles.summaryRow}>
            <Text style={styles.statValue}>{summary.critical}</Text>
            <Text style={styles.statLabel}>critical</Text>
            <Text style={styles.statValue}>{summary.warning}</Text>
            <Text style={styles.statLabel}>warnings</Text>
            <Text style={styles.statValue}>{summary.total}</Text>
            <Text style={styles.statLabel}>total</Text>
          </View>
        ) : null}
        {conflictList.length === 0 ? (
          <Text style={styles.noSlots}>No conflicts detected in this range.</Text>
        ) : (
          conflictList.slice(0, 10).map((c) => (
            <Pressable key={c.id} onPress={() => setSelectedConflict(c)} style={({ pressed }) => [styles.conflictRow, pressed && styles.pressed]}>
              <Ionicons name={iconFor(c.type)} size={16} color={c.severity === 'critical' ? Palette.error : Palette.warning} />
              <View style={styles.conflictTexts}>
                <Text style={styles.conflictTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.conflictMeta} numberOfLines={1}>
                  {c.doctorName} · {c.date ? formatDDMMYYYY(c.date) : '—'} {c.startTime ? formatSlotTime(c.startTime) : ''}
                </Text>
              </View>
              <Badge label={c.severity} variant={severityVariant(c.severity)} />
            </Pressable>
          ))
        )}
      </Card>

      {actionResult ? (
        <Card padded>
          <Text style={styles.cardTitle}>Bulk operation result</Text>
          <View style={styles.resultGrid}>
            <Text style={styles.resultValue}>{actionResult.created || 0}</Text><Text style={styles.resultLabel}>Created</Text>
            <Text style={styles.resultValue}>{actionResult.skipped || 0}</Text><Text style={styles.resultLabel}>Skipped</Text>
            <Text style={styles.resultValue}>{actionResult.alreadyExisting || 0}</Text><Text style={styles.resultLabel}>Already existed</Text>
            <Text style={styles.resultValue}>{actionResult.bookedProtected || 0}</Text><Text style={styles.resultLabel}>Booked/protected</Text>
            <Text style={styles.resultValue}>{actionResult.blocked || 0}</Text><Text style={styles.resultLabel}>Blocked</Text>
            <Text style={styles.resultValue}>{actionResult.leaveConflicts || 0}</Text><Text style={styles.resultLabel}>Leave conflicts</Text>
            <Text style={styles.resultValue}>{actionResult.holidayConflicts || 0}</Text><Text style={styles.resultLabel}>Holiday conflicts</Text>
            <Text style={styles.resultValue}>{actionResult.overrideConflicts || 0}</Text><Text style={styles.resultLabel}>Override conflicts</Text>
            <Text style={styles.resultValue}>{actionResult.otherConflicts || 0}</Text><Text style={styles.resultLabel}>Other conflicts</Text>
            <Text style={styles.resultValue}>{actionResult.failed || 0}</Text><Text style={styles.resultLabel}>Failed</Text>
          </View>
          <Pressable onPress={() => setActionResult(null)} style={({ pressed }) => [styles.dismissResult, pressed && styles.pressed]}>
            <Text style={styles.dismissResultText}>Dismiss</Text>
          </Pressable>
        </Card>
      ) : null}

      {selectedConflict ? (
        <ConfirmDialog
          visible
          title={selectedConflict.title}
          message={`${selectedConflict.detail}\n\nRecommended: ${selectedConflict.recommendedAction || 'Review the schedule.'}`}
          cancelLabel="Close"
          confirmLabel="Mark reviewed"
          onConfirm={() => setSelectedConflict(null)}
          onCancel={() => setSelectedConflict(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  viewChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
    backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center',
  },
  viewChipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
  viewChipText: { ...Typography.bodySmall, color: Palette.textMuted, fontWeight: '600' },
  viewChipTextActive: { color: Palette.white },
  pressed: { opacity: 0.8 },
  cardTitle: { ...Typography.label, color: Palette.text },
  dayWrap: { gap: Spacing.md },
  weekWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  dayCardWrap: { width: '100%' },
  dayCard: {
    backgroundColor: Palette.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Palette.border, padding: Spacing.md, gap: Spacing.sm,
  },
  dayCardSmall: { gap: Spacing.xs, marginTop: Spacing.sm },
  doctorGroup: { gap: Spacing.xs },
  doctorName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  noSlots: { ...Typography.caption, color: Palette.textMuted },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderRadius: Radius.sm,
  },
  slotTime: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  apptText: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listDate: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderRadius: Radius.sm,
  },
  eventTime: { ...Typography.caption, color: Palette.textMuted, minWidth: 52 },
  eventDoctor: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  monthHead: { ...Typography.caption, color: Palette.textMuted, width: '14.28%', textAlign: 'center' },
  monthCell: {
    width: '14.28%', minHeight: 64, borderRadius: Radius.sm, borderWidth: 1,
    borderColor: Palette.border, backgroundColor: Palette.surface,
    padding: Spacing.xs, gap: 2,
  },
  monthDayNum: { ...Typography.caption, color: Palette.text, fontWeight: '600' },
  monthMark: { ...Typography.caption, color: Palette.warning, fontWeight: '700' },
  monthMarkLeave: { color: Palette.textMuted },
  monthMarkOverride: { color: Palette.primaryDark },
  monthCount: { ...Typography.caption, color: Palette.textMuted },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  statValue: { ...Typography.h4, color: Palette.text },
  statLabel: { ...Typography.caption, color: Palette.textMuted },
  conflictRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Palette.border, backgroundColor: Palette.surface,
  },
  conflictTexts: { flex: 1, gap: 2 },
  conflictTitle: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  conflictMeta: { ...Typography.caption, color: Palette.textMuted },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  resultValue: { ...Typography.h4, color: Palette.text, minWidth: 74 },
  resultLabel: { ...Typography.caption, color: Palette.textMuted, minWidth: 74 },
  dismissResult: {
    alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary,
    marginTop: Spacing.sm,
  },
  dismissResultText: { ...Typography.bodySmall, color: Palette.primary, fontWeight: '600' },
  errorWrap: { alignItems: 'center', gap: Spacing.md, padding: Spacing.xl },
  errorText: { ...Typography.bodySmall, color: Palette.textMuted, textAlign: 'center' },
});