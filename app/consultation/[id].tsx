/**
 * HealPoint - Consultation detail (waiting room + Care Journey).
 *
 * The unique HealPoint timeline and the real Google Meet integration:
 *   Booked → Payment Confirmed → Doctor Confirmed → Meeting Ready → Waiting →
 *   Google Meet Consultation → Prescription → Follow-up → Completed
 *
 * Secure by design: the meeting URL is fetched from the backend only for the
 * owning patient (GET /consultation/patient/detail/:id) and opens the real
 * Google Meet URL with safe external-link handling. It is never faked here.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import { consultationStatusLabel, meetingStatusLabel, openGoogleMeetUrl } from '@/lib/meet';
import { toErrorMessage } from '@/services/api';
import * as consultationService from '@/services/consultations';
import type { CareJourney, PatientConsultationDetail } from '@/types';

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

function paymentLabel(c: PatientConsultationDetail): { label: string; variant: BadgeVariant } {
  const raw = (c.paymentStatus || '').trim().toLowerCase();
  if (c.payment === true || raw === 'paid' || raw === 'success') {
    return { label: 'Paid', variant: 'success' };
  }
  if (raw === 'failed') return { label: 'Payment failed', variant: 'error' };
  if (raw === 'refunded') return { label: 'Refunded', variant: 'neutral' };
  return { label: 'Payment pending', variant: 'warning' };
}

function consultStateLabel(status?: string): string {
  return consultationStatusLabel(status);
}

function doctorNameOf(c: PatientConsultationDetail): string {
  return c.doctor?.name || 'Doctor';
}

function doctorSpecialtyOf(c: PatientConsultationDetail): string {
  return c.doctor?.speciality || c.doctor?.department || 'Video consultation';
}
function JourneyStep({ step, state }: {
  step: { key: string; label: string };
  state: 'done' | 'current' | 'todo';
}) {
  return (
    <View style={styles.journeyStep}>
      <View
        style={[
          styles.journeyDot,
          state === 'done' && styles.journeyDotDone,
          state === 'current' && styles.journeyDotCurrent,
        ]}
      >
        {state === 'done' ? (
          <Ionicons name="checkmark" size={13} color={Palette.white} />
        ) : state === 'current' ? (
          <Text style={styles.journeyDotCurrentText}>•</Text>
        ) : null}
      </View>
      <Text style={[styles.journeyLabel, state === 'done' && styles.journeyLabelDone, state === 'current' && styles.journeyLabelCurrent]}>
        {step.label}
      </Text>
    </View>
  );
}

function JourneyTimeline({ journey }: { journey: CareJourney }) {
  const current = Math.min(journey.currentIndex, journey.steps.length - 1);
  return (
    <Card padded style={styles.journeyCard}>
      <View style={styles.journeyHeader}>
        <Text style={styles.journeyTitle}>Your care journey</Text>
        <Badge label={`Step ${current + 1} of ${journey.steps.length}`} variant="primary" />
      </View>
      <View style={styles.journeyRow}>
        {journey.steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return <JourneyStep key={step.key} step={step} state={state} />;
        })}
      </View>
    </Card>
  );
}

export default function ConsultationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [consultation, setConsultation] = useState<PatientConsultationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await consultationService.getUserConsultation(String(id));
      setConsultation(res.consultation);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load this consultation.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useScreenFocus(load);
  useEffect(() => {
    load();
  }, [load]);

  const openMeeting = () => {
    if (!consultation) return;
    const opened = openGoogleMeetUrl(consultation.meetingUrl);
    if (!opened) {
      setError(
        consultation.meetingUrl
          ? 'This is not a valid Google Meet link. The doctor will share a working link before your consultation.'
          : 'Video meeting has not been created yet. The doctor will add the Google Meet link before your consultation.',
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Loading label="Opening your consultation…" />
      </SafeAreaView>
    );
  }

  if (error || !consultation) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ErrorState message={error || 'Consultation not found.'} onRetry={load} />
      </SafeAreaView>
    );
  }

  const badge = statusBadge(consultation.status);
  const pay = paymentLabel(consultation);
  const meetingStatus = consultation.meetingStatus || 'not_created';
  const consultStatus = consultation.consultationStatus || 'waiting';
  const joinAllowed = consultation.join?.allowed === true;
  const joinReason = consultation.join?.reason;
  const isCompleted = consultation.status === 'completed' || consultStatus === 'completed';
  const isCancelled = consultation.status === 'cancel' || consultation.status === 'missed';
  const hasPrescription = Boolean(consultation.prescription || consultation.diagnosis);
  const hasFollowUp = Boolean(consultation.followUpAdvice);
  const doctorImage = getDoctorImage(consultation.doctor || undefined);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/consultations'))}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Video consultation</Text>
            <Text style={styles.headerSubtitle}>{consultation.appointmentId || 'Online consultation'}</Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} />
        </View>

        {/* ---------------- Waiting room ---------------- */}
        <Card padded style={styles.waitingCard}>
          <View style={styles.doctorRow}>
            <Image source={{ uri: doctorImage }} style={styles.doctorAvatar} contentFit="cover" />
            <View style={styles.doctorBody}>
              <Text style={styles.doctorName}>{doctorNameOf(consultation)}</Text>
              <Text style={styles.doctorSpecialty}>{doctorSpecialtyOf(consultation)}</Text>
              <Text style={styles.doctorHospital}>{consultation.hospitalName || 'HealPoint online'}</Text>
            </View>
          </View>

          <View style={styles.waitingState}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : isCancelled ? 'close-circle' : 'videocam'}
              size={34}
              color={isCompleted ? Palette.success : isCancelled ? Palette.error : Palette.primary}
            />
            <View style={styles.waitingStateTexts}>
              <Text style={styles.waitingStateTitle}>
                {isCancelled ? 'Consultation cancelled' : isCompleted ? 'Consultation completed' : consultStateLabel(consultStatus)}
              </Text>
              <Text style={styles.waitingStateSubtitle}>
                {isCancelled
                  ? 'No further action is available for this consultation.'
                  : isCompleted
                    ? 'Review your prescription and follow-up details below.'
                    : 'Your consultation will start here. Join on Google Meet when the doctor is ready.'}
              </Text>
            </View>
          </View>
        </Card>

        {/* ---------------- Join / meeting section ---------------- */}
        <Card padded style={styles.meetingCard}>
          <View style={styles.sectionHeading}>
            <Ionicons name="videocam" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Video consultation</Text>
          </View>
          <View style={styles.meetingBadges}>
            <Badge label={`Meeting: ${meetingStatusLabel(meetingStatus)}`} variant={meetingStatus === 'not_created' ? 'neutral' : 'primary'} />
            <Badge label={consultationStatusLabel(consultStatus)} variant={consultStatus === 'in_progress' ? 'success' : 'warning'} />
          </View>

          {isCompleted ? null : isCancelled ? null : joinAllowed && consultation.meetingUrl ? (
            <View style={styles.meetingActions}>
              <Button
                title="Join Google Meet"
                variant="primary"
                icon="videocam"
                onPress={openMeeting}
              />
              <Text style={styles.meetingHint}>
                Opens the real Google Meet link shared by your doctor.
              </Text>
            </View>
          ) : (
            <View style={styles.meetingActions}>
              <Button title="Join Consultation" variant="secondary" icon="videocam" disabled onPress={() => undefined} />
              <Text style={styles.meetingHint}>
                {joinReason || 'Video meeting has not been created yet. Join closer to your consultation time.'}
              </Text>
            </View>
          )}
        </Card>

        {/* ---------------- Care Journey ---------------- */}
        {consultation.careJourney ? <JourneyTimeline journey={consultation.careJourney} /> : null}

        {/* ---------------- Appointment details ---------------- */}
        <Card padded style={styles.infoCard}>
          <View style={styles.sectionHeading}>
            <Ionicons name="information-circle-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Consultation details</Text>
          </View>
          <InfoRow label="Doctor" value={doctorNameOf(consultation)} />
          <InfoRow label="Speciality" value={doctorSpecialtyOf(consultation)} />
          <InfoRow label="Date" value={formatDDMMYYYY(consultation.slotDate || '')} />
          <InfoRow label="Time" value={consultation.slotTime || '—'} />
          <InfoRow label="Type" value={consultation.consultationMode === 'instant' ? 'Instant video consultation' : 'Scheduled video consultation'} />
          <InfoRow label="Reference" value={consultation.appointmentId || consultation._id} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment</Text>
            <Badge label={pay.label} variant={pay.variant} />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fee</Text>
            <Text style={styles.infoValue}>{formatINR(consultation.amount)}</Text>
          </View>
        </Card>

        {/* ---------------- Prescription ---------------- */}
        {hasPrescription ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Ionicons name="document-text-outline" size={20} color={Palette.success} />
              <Text style={styles.sectionTitle}>Prescription</Text>
            </View>
            {consultation.diagnosis ? (
              <View style={styles.prescriptionBlock}>
                <Text style={styles.prescriptionLabel}>Diagnosis</Text>
                <Text style={styles.prescriptionText}>{consultation.diagnosis}</Text>
              </View>
            ) : null}
            {consultation.prescription ? (
              <View style={styles.prescriptionBlock}>
                <Text style={styles.prescriptionLabel}>Prescription</Text>
                <Text style={styles.prescriptionText}>{consultation.prescription}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* ---------------- Follow-up ---------------- */}
        {hasFollowUp ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Ionicons name="calendar-clear-outline" size={20} color={Palette.info} />
              <Text style={styles.sectionTitle}>Follow-up</Text>
            </View>
            <Text style={styles.prescriptionText}>{consultation.followUpAdvice}</Text>
          </Card>
        ) : null}

        {/* ---------------- Disclaimer ---------------- */}
        {!isCancelled && !isCompleted ? (
          <Text style={styles.disclaimer}>
            This page does not provide a diagnosis. Your doctor will discuss your concerns during the consultation.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  headerTitles: { flex: 1, gap: 2 },
  headerTitle: { ...Typography.h3, color: Palette.text },
  headerSubtitle: { ...Typography.caption, color: Palette.textMuted },
  waitingCard: { gap: Spacing.lg },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  doctorAvatar: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  doctorBody: { flex: 1, gap: 2 },
  doctorName: { ...Typography.h4, color: Palette.text },
  doctorSpecialty: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
  doctorHospital: { ...Typography.caption, color: Palette.textMuted },
  waitingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  waitingStateTexts: { flex: 1, gap: 2 },
  waitingStateTitle: { ...Typography.label, color: Palette.text },
  waitingStateSubtitle: { ...Typography.caption, color: Palette.textMuted },
  meetingCard: { gap: Spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { ...Typography.h4, color: Palette.text },
  meetingBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  meetingActions: { gap: Spacing.sm, marginTop: Spacing.xs },
  meetingHint: { ...Typography.caption, color: Palette.textMuted },
  journeyCard: { gap: Spacing.md },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyTitle: { ...Typography.h4, color: Palette.text },
  journeyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  journeyStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  journeyDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyDotDone: { backgroundColor: Palette.success, borderColor: Palette.success },
  journeyDotCurrent: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  journeyDotCurrentText: { color: Palette.primary, fontSize: 14, lineHeight: 16 },
  journeyLabel: { ...Typography.caption, color: Palette.textMuted },
  journeyLabelDone: { color: Palette.success, fontWeight: '600' },
  journeyLabelCurrent: { color: Palette.primary, fontWeight: '700' },
  infoCard: { gap: Spacing.xs },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  infoLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  infoValue: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionCard: { gap: Spacing.md },
  prescriptionBlock: { gap: Spacing.xs },
  prescriptionLabel: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600' },
  prescriptionText: { ...Typography.bodyMedium, color: Palette.text, lineHeight: 22 },
  disclaimer: { ...Typography.caption, color: Palette.textMuted, textAlign: 'center', paddingHorizontal: Spacing.lg },
});