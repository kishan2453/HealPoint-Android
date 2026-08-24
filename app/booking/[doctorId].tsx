/**
 * HealPoint - Book appointment (premium flow).
 *
 * Date -> Time -> Confirm. Time slots come from the real backend
 * (`/appointment/get-available-slots`) which subtracts already-booked slots, so
 * unavailable slots are never shown. Double-booking is prevented server-side;
 * if a slot is taken between fetch and confirm, the backend returns 409 and the
 * picker is refreshed automatically. Online payment continues on the Razorpay
 * payment screen; cash shows an immediate confirmation with the appointment ID.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { dateLabel, formatDDMMYYYY, formatINR, toDDMMYYYY, weekdayLabel } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import { isRazorpayCheckoutAvailable } from '@/lib/razorpay';
import { isValidIndianPhone } from '@/lib/validation';
import { ApiClientError, toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import { getDoctorDetails } from '@/services/doctors';
import type { ConsultationType, Doctor, PaymentMethod } from '@/types';

const STEPS = ['Date', 'Time', 'Confirm'] as const;
type StepKey = (typeof STEPS)[number];

export default function BookingScreen() {
  const router = useRouter();
  const {
    doctorId,
    type,
    mode,
  } = useLocalSearchParams<{ doctorId?: string; type?: string; mode?: string }>();
  const { user } = useAuth();

  // When the patient comes from "Consult Online", the consultation type is
  // always video and the mode may be scheduled or instant. The backend also
  // persists consultationMode on the appointment.
  const requestedType: ConsultationType | null =
    type === 'video' || type === 'clinic' ? type : null;
  const requestedMode = mode === 'instant' ? ('instant' as const) : ('scheduled' as const);

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const [consultationType, setConsultationType] = useState<ConsultationType>(requestedType ?? 'clinic');
  const consultationMode = requestedMode;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(requestedType === 'video' ? 'online' : 'cash');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [successAppointmentId, setSuccessAppointmentId] = useState('');
  const [successReference, setSuccessReference] = useState('');

  const phoneValid = isValidIndianPhone(user?.phone || '');
  const onlineAvailable = isRazorpayCheckoutAvailable();

  // Next 7 selectable days starting today.
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

  // Load the doctor's real profile.
  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    setLoadingDoctor(true);
    getDoctorDetails(doctorId)
      .then((res) => {
        if (!active) return;
        setDoctor(res.doctor);
      })
      .catch((err) => {
        if (active) setLoadError(toErrorMessage(err, 'Unable to load doctor details.'));
      })
      .finally(() => {
        if (active) setLoadingDoctor(false);
      });
    return () => {
      active = false;
    };
  }, [doctorId]);

  // Fetch real available slots whenever the date changes (server subtracts
  // already-booked slots, so unavailable ones are never shown).
  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    setSlotsLoading(true);
    setSlotsError('');
    setSelectedSlot('');

    const dateStr = toDDMMYYYY(selectedDate);
    appointmentService
      .getAvailableSlots(doctorId, dateStr)
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
  const isLeaveDate = Boolean(doctor?.leaveDates?.includes(selectedDateStr));

  const confirmBooking = async () => {
    setBookingError('');
    if (!doctor || !doctorId) return;
    if (paymentMethod === 'online' && !onlineAvailable) {
      setBookingError(
        'Online payment needs the HealPoint Android development build or installed APK. Please use Pay at clinic or install the native build.',
      );
      return;
    }
    if (!doctor.available) {
      setBookingError('This doctor is currently not accepting appointments.');
      return;
    }
    if (isLeaveDate) {
      setBookingError('The doctor is on leave on this date. Please choose another date.');
      return;
    }
    if (!selectedSlot) {
      setBookingError('Please select a time slot.');
      return;
    }
    if (!phoneValid) {
      setBookingError('Add a valid phone number to your profile before booking an appointment.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await appointmentService.bookAppointment({
        doctorId,
        slotDate: selectedDateStr,
        slotTime: selectedSlot,
        paymentMethod,
        consultationType,
        consultationMode: consultationType === 'video' ? consultationMode : 'scheduled',
      });
      const booked = res.appointment as unknown as
        | { _id?: string; appointmentId?: string; displayAppointmentId?: string }
        | undefined;
      const bookedId = String(booked?._id || '');

      // Online payment: the appointment exists on the server; take the patient
      // straight to the secure Razorpay payment screen (order creation,
      // checkout, server-side signature verification all happen there).
      if (paymentMethod === 'online') {
        if (!bookedId) {
          setBookingError(
            'Your appointment was created but we could not open payment. Find it under "My appointments" and choose Pay Online.',
          );
        } else {
          router.replace({
            pathname: '/payment/[appointmentId]',
            params: { appointmentId: bookedId },
          });
        }
        return;
      }

      setSuccessAppointmentId(bookedId);
      setSuccessReference(String(booked?.appointmentId || booked?.displayAppointmentId || bookedId));
    } catch (err) {
      const message = toErrorMessage(err, 'Booking failed. Please try again.');
      const serverMessage = err instanceof ApiClientError ? err.serverMessage || '' : '';
      // Surface specific backend payment messages (e.g. Razorpay temporarily
      // unavailable, appointment saved — retry later) instead of hiding them.
      setBookingError(
        /online payment|payment order|razorpay/i.test(serverMessage) ? serverMessage : message,
      );
      // A slot that was just booked must disappear from the picker.
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

if (loadingDoctor) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading booking..." />
      </SafeAreaView>
    );
  }

  if (loadError || !doctor) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={loadError || 'Doctor not found.'} />
      </SafeAreaView>
    );
  }

  const consultationTypes = doctor.consultationTypes || ['clinic'];

  // Stepper state: Date is always reachable; Time is confirmable once a slot is
  // picked; Confirm is the final action once a time is chosen.
  const stepStatus = (step: StepKey): 'done' | 'active' | 'pending' => {
    if (step === 'Date') return 'done';
    if (step === 'Time') return selectedSlot ? 'done' : 'active';
    return selectedSlot ? 'active' : 'pending';
  };

  // ---------------- Confirmation (cash) ----------------
  if (successAppointmentId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.confirmContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmIconWrap}>
            <View style={[styles.confirmIcon, styles.confirmIconSuccess]}>
              <Ionicons name="checkmark" size={44} color={Palette.white} />
            </View>
          </View>
          <Text style={styles.confirmTitle}>Appointment requested</Text>
          <Text style={styles.confirmSubtitle}>
            Your request has been submitted. The clinic will confirm shortly. You can manage it under My
            Appointments.
          </Text>

          <Card padded style={styles.confirmCard}>
            <ConfirmRow label="Doctor" value={doctor.name} />
            <ConfirmRow label="Hospital" value={doctor.hospitalName || doctor.clinicInfo?.name || '—'} />
            <ConfirmRow label="Date" value={formatDDMMYYYY(selectedDateStr)} />
            <ConfirmRow label="Time" value={selectedSlot} />
            <ConfirmRow
              label="Consultation"
              value={consultationType === 'video' ? 'Video consultation' : 'Clinic visit'}
            />
            <ConfirmRow label="Consultation fee" value={formatINR(doctor.fees)} />
            <ConfirmRow label="Payment" value="Pay at clinic" />
            <ConfirmRow label="Appointment ID" value={successReference || successAppointmentId} />
          </Card>

          <View style={styles.confirmActions}>
            <Button
              title="View consultation"
              onPress={() =>
                router.replace({
                  pathname: consultationType === 'video' ? '/consultation/[id]' : '/appointment/[id]',
                  params: { id: successAppointmentId },
                })
              }
            />
            <Button title="Go to home" variant="outline" onPress={() => router.replace('/')} />
            <Button
              title="Book another appointment"
              variant="ghost"
              onPress={() => {
                setSuccessAppointmentId('');
                setSelectedSlot('');
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const specialtyLabel = doctor.speciality || doctor.specialization || doctor.department || 'General physician';
return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/doctors'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Book appointment</Text>
            <Text style={styles.headerSubtitle}>Plan your visit with {doctor.name.replace(/^Dr\.?\s*/i, '')}</Text>
          </View>
        </View>

        {/* ---------------- Doctor summary ---------------- */}
        <Card padded style={styles.doctorCard}>
          <Image source={{ uri: getDoctorImage(doctor) }} style={styles.doctorAvatar} contentFit="cover" />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {doctor.name}
            </Text>
            <Text style={styles.doctorSpecialty} numberOfLines={1}>
              {specialtyLabel}
            </Text>
            <Text style={styles.doctorHospital} numberOfLines={1}>
              {doctor.hospitalName || doctor.clinicInfo?.name || 'Hospital details pending'}
            </Text>
            <View style={styles.doctorMetaRow}>
              <Text style={styles.doctorFee}>{formatINR(doctor.fees)}</Text>
              {doctor.verificationStatus === 'Verified' ? <Badge label="Verified" variant="primary" /> : null}
              {!doctor.available ? <Badge label="Unavailable" variant="warning" /> : null}
            </View>
          </View>
        </Card>

        {/* ---------------- Stepper ---------------- */}
        <View style={styles.stepper}>
          {STEPS.map((step, index) => {
            const status = stepStatus(step);
            return (
              <View key={step} style={styles.stepWrap}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      status === 'done' && styles.stepCircleDone,
                      status === 'active' && styles.stepCircleActive,
                    ]}
                  >
                    {status === 'done' ? (
                      <Ionicons name="checkmark" size={14} color={Palette.white} />
                    ) : (
                      <Text style={[styles.stepNumber, status === 'active' && styles.stepNumberActive]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, (status === 'done' || status === 'active') && styles.stepLabelActive]}>
                    {step}
                  </Text>
                </View>
                {index < STEPS.length - 1 ? (
                  <View style={[styles.stepLine, status === 'done' && styles.stepLineDone]} />
                ) : null}
              </View>
            );
          })}
        </View>

        {bookingError ? <FormMessage type="error" message={bookingError} /> : null}
{/* ---------------- Step 1: Date ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepBadge}>1</Text>
            <Text style={styles.stepTitle}>Select date</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
            style={styles.dateScroll}
          >
            {days.map((date) => {
              const active = toDDMMYYYY(date) === selectedDateStr;
              const isToday = toDDMMYYYY(date) === toDDMMYYYY(new Date());
              return (
                <Pressable
                  key={toDDMMYYYY(date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(date)}
                  style={[styles.dateTile, active && styles.dateTileActive]}
                >
                  <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                    {isToday ? 'Today' : weekdayLabel(date)}
                  </Text>
                  <Text style={[styles.dateDay, active && styles.dateTextActive]}>{date.getDate()}</Text>
                  <Text style={[styles.dateMonth, active && styles.dateTextActive]}>
                    {dateLabel(date).split(' ')[1]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        {/* ---------------- Step 2: Time slot ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepBadge}>2</Text>
            <Text style={styles.stepTitle}>Select time slot</Text>
            <View style={styles.stepLive}>
              <Ionicons name="pulse" size={12} color={Palette.success} />
              <Text style={styles.stepLiveText}>Live</Text>
            </View>
          </View>

          {isLeaveDate ? (
            <FormMessage type="warning" message="The doctor is on leave on this date. Please choose another day." />
          ) : slotsLoading ? (
            <View style={styles.slotGrid}>
              {[...Array(6)].map((_, index) => (
                <View key={index} style={styles.slotSkeleton} />
              ))}
            </View>
          ) : slotsError ? (
            <Text style={styles.slotsStateText}>{slotsError}</Text>
          ) : availableSlots.length === 0 ? (
            <Text style={styles.slotsStateText}>No slots are available on this date. Please choose another day.</Text>
          ) : (
            <>
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
              <Text style={styles.realtimeNote}>
                Slots are updated in real time — a slot booked by someone else is removed automatically.
              </Text>
            </>
          )}
        </Card>
{/* ---------------- Consultation type ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <View style={[styles.stepBadge, styles.stepBadgeIcon]}>
              <Ionicons name="videocam" size={14} color={Palette.white} />
            </View>
            <Text style={styles.stepTitle}>Consultation type</Text>
          </View>
          <View style={styles.typeRow}>
            {consultationTypes.includes('clinic') ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: consultationType === 'clinic' }}
                onPress={() => setConsultationType('clinic')}
                style={[styles.typeChip, consultationType === 'clinic' && styles.typeChipActive]}
              >
                <Ionicons
                  name="business"
                  size={18}
                  color={consultationType === 'clinic' ? Palette.white : Palette.textMuted}
                />
                <View>
                  <Text style={[styles.typeTitle, consultationType === 'clinic' && styles.typeTextActive]}>
                    Clinic visit
                  </Text>
                  <Text style={[styles.typeSub, consultationType === 'clinic' && styles.typeTextActive]}>
                    Visit the hospital
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {consultationTypes.includes('video') ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: consultationType === 'video' }}
                onPress={() => setConsultationType('video')}
                style={[styles.typeChip, consultationType === 'video' && styles.typeChipActive]}
              >
                <Ionicons
                  name="videocam"
                  size={18}
                  color={consultationType === 'video' ? Palette.white : Palette.textMuted}
                />
                <View>
                  <Text style={[styles.typeTitle, consultationType === 'video' && styles.typeTextActive]}>
                    Video consult
                  </Text>
                  <Text style={[styles.typeSub, consultationType === 'video' && styles.typeTextActive]}>
                    Connect online
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </Card>
{/* ---------------- Step 3: Review & confirm ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepBadge}>3</Text>
            <Text style={styles.stepTitle}>Review & confirm</Text>
          </View>

          <Text style={styles.payLabel}>Payment method</Text>
          <View style={styles.payRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === 'cash' }}
              onPress={() => setPaymentMethod('cash')}
              style={[styles.payCard, paymentMethod === 'cash' && styles.payCardActive]}
            >
              <Ionicons
                name="cash-outline"
                size={22}
                color={paymentMethod === 'cash' ? Palette.white : Palette.textMuted}
              />
              <Text style={[styles.payTitle, paymentMethod === 'cash' && styles.payTextActive]}>Pay at clinic</Text>
              <Text style={[styles.paySub, paymentMethod === 'cash' && styles.payTextActive]}>Cash / UPI on arrival</Text>
            </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: paymentMethod === 'online' }}
                onPress={() => setPaymentMethod('online')}
                disabled={!onlineAvailable}
                style={[
                  styles.payCard,
                  !onlineAvailable && styles.payCardDisabled,
                  paymentMethod === 'online' && styles.payCardActive,
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={22}
                  color={paymentMethod === 'online' ? Palette.white : Palette.textMuted}
                />
                <Text style={[styles.payTitle, paymentMethod === 'online' && styles.payTextActive]}>
                  {onlineAvailable ? 'Pay online' : 'Online unavailable'}
                </Text>
                <Text style={[styles.paySub, paymentMethod === 'online' && styles.payTextActive]}>
                  {onlineAvailable ? 'Secure gateway' : 'Native build required'}
                </Text>
            </Pressable>
          </View>
          {paymentMethod === 'online' && !onlineAvailable ? (
            <FormMessage type="info" message="Online payment is not available in this build. Pay at the clinic instead." />
          ) : null}

          <View style={styles.summary}>
            <SummaryRow label="Doctor" value={doctor.name} />
            <SummaryRow label="Hospital" value={doctor.hospitalName || doctor.clinicInfo?.name || '—'} />
            <SummaryRow label="Date" value={formatDDMMYYYY(selectedDateStr)} />
            <SummaryRow label="Time" value={selectedSlot || 'Choose a slot'} />
            <SummaryRow
              label="Type"
              value={consultationType === 'video' ? 'Video consultation' : 'Clinic visit'}
            />
            <SummaryRow
              label="Payment"
              value={paymentMethod === 'online' ? 'Online (Razorpay)' : 'Pay at clinic'}
            />
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatINR(doctor.fees)}
              {paymentMethod === 'cash' ? ' · due at clinic' : ''}
            </Text>
          </View>

          <Button
            title={submitting ? 'Booking...' : 'Confirm booking'}
            onPress={confirmBooking}
            loading={submitting}
            disabled={!selectedSlot || !doctor.available}
            style={styles.confirmButton}
          />
          {!phoneValid ? (
            <Text style={styles.hint}>
              Add a valid phone number to your profile (under Profile → Edit) to book an appointment.
            </Text>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue}>{value}</Text>
    </View>
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
  pressed: {
    opacity: 0.6,
  },
  // ---- Header ----
  header: {
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
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  // ---- Doctor summary ----
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  doctorInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.h4,
    color: Palette.text,
  },
  doctorSpecialty: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  doctorHospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  doctorFee: {
    ...Typography.label,
    color: Palette.text,
  },
  // ---- Stepper ----
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: Palette.success,
  },
  stepCircleActive: {
    backgroundColor: Palette.primary,
  },
  stepNumber: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: '700',
  },
  stepNumberActive: {
    color: Palette.white,
  },
  stepLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  stepLabelActive: {
    color: Palette.primaryDark,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Palette.border,
    marginHorizontal: Spacing.sm,
  },
  stepLineDone: {
    backgroundColor: Palette.success,
  },
  // ---- Step cards ----
  stepCard: {
    gap: Spacing.md,
  },
  stepHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.primary,
    color: Palette.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  stepBadgeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: undefined,
    paddingHorizontal: 0,
  },
  stepTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  stepLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  stepLiveText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: '700',
  },
  dateScroll: {
    marginHorizontal: -Spacing.lg,
  },
  dateRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  dateTile: {
    alignItems: 'center',
    gap: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 64,
  },
  dateTileActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dateWeekday: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: 'capitalize',
  },
  dateDay: {
    ...Typography.h4,
    color: Palette.text,
  },
  dateMonth: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: 'uppercase',
  },
  dateTextActive: {
    color: Palette.white,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slot: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    minWidth: 92,
    alignItems: 'center',
  },
  slotActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  slotText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '600',
  },
  slotTextActive: {
    color: Palette.white,
  },
  slotSkeleton: {
    width: 92,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: '#DDE8E5',
  },
  slotsStateText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  realtimeNote: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
  },
  typeChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  typeTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '700',
  },
  typeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  typeTextActive: {
    color: Palette.white,
  },
  payLabel: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  payRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  payCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    gap: 2,
  },
  payCardActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  payCardDisabled: {
    opacity: 0.55,
  },
  payTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  paySub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  payTextActive: {
    color: Palette.white,
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
  },
  summaryValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  totalLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  totalValue: {
    ...Typography.h4,
    color: Palette.primaryDark,
  },
  confirmButton: {
    marginTop: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Palette.warning,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  // ---- Confirmation view ----
  confirmContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  confirmIconWrap: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  confirmIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIconSuccess: {
    backgroundColor: Palette.success,
  },
  confirmTitle: {
    ...Typography.h2,
    color: Palette.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  confirmCard: {
    marginTop: Spacing.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  confirmLabel: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
  },
  confirmValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  confirmActions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
