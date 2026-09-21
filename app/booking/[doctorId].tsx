/**
 * HealPoint - Book Appointment (Production Premium Flow).
 *
 * Doctor -> Date -> Time Slot (Sessions & Live Availability) -> Details -> Confirm -> Payment.
 *
 * Powered by real backend scheduling APIs with atomic double-booking protection,
 * live slot synchronization, honest leave date detection, and seamless Razorpay handoff.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import {
  dateLabel,
  formatDDMMYYYY,
  formatDoctorName,
  formatINR,
  stripDoctorTitle,
  toDDMMYYYY,
  weekdayLabel,
} from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { isRazorpayCheckoutAvailable } from "@/lib/razorpay";
import { isValidIndianPhone } from "@/lib/validation";
import { ApiClientError, toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import { getDoctorDetails } from "@/services/doctors";
import type { ConsultationType, Doctor, PaymentMethod } from "@/types";

const STEPS = ["Date", "Time", "Confirm"] as const;
type StepKey = (typeof STEPS)[number];

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

function BookingConfirmationView({
  doctor,
  specialtyLabel,
  hospitalName,
  selectedDateStr,
  selectedSlot,
  consultationType,
  successAppointmentId,
  successReference,
  onViewPass,
  onViewDetails,
  onGoToAppointments,
  onGoHome,
}: {
  doctor: Doctor;
  specialtyLabel: string;
  hospitalName: string;
  selectedDateStr: string;
  selectedSlot: string;
  consultationType: ConsultationType;
  successAppointmentId: string;
  successReference: string;
  onViewPass: () => void;
  onViewDetails: () => void;
  onGoToAppointments: () => void;
  onGoHome: () => void;
}) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const pulse = useRef(new Animated.Value(0.9)).current;
  const pulseOp = useRef(new Animated.Value(0.55)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.35,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOp, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 0.9,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOp, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();

    Animated.timing(contentFade, {
      toValue: 1,
      duration: 350,
      delay: 150,
      useNativeDriver: true,
    }).start();

    return () => loop.stop();
  }, [scale, pulse, pulseOp, contentFade]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.confirmContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Ambient Success Shield with spring scale and expanding pulse */}
        <View style={styles.confirmIconWrap}>
          <Animated.View
            style={[
              styles.confirmPulseRing,
              {
                transform: [{ scale: pulse }],
                opacity: pulseOp,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.confirmIconCircle,
              {
                transform: [{ scale }],
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={46} color={Palette.white} />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            width: "100%",
            alignItems: "center",
            opacity: contentFade,
            transform: [
              {
                translateY: contentFade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <Text style={styles.confirmTitle}>Appointment Confirmed</Text>
          <Text style={styles.confirmSubtitle}>
            Your appointment has been registered and sent to the clinic
            schedule.
          </Text>

          {/* Reference Badge */}
          <View style={styles.referenceBadgeWrap}>
            <Text style={styles.referenceLabel}>Booking Reference ID</Text>
            <Text style={styles.referenceValue}>
              {successReference || successAppointmentId}
            </Text>
          </View>

          {/* Full Summary Card */}
          <Card padded style={styles.confirmCard}>
            <ConfirmRow
              icon="person"
              label="Attending Doctor"
              value={formatDoctorName(doctor.name)}
            />
            <ConfirmRow
              icon="medkit"
              label="Department"
              value={specialtyLabel}
            />
            <ConfirmRow
              icon="business"
              label="Hospital / Clinic"
              value={hospitalName}
            />
            <ConfirmRow
              icon="calendar"
              label="Date"
              value={formatDDMMYYYY(selectedDateStr)}
            />
            <ConfirmRow icon="time" label="Time Slot" value={selectedSlot} />
            <ConfirmRow
              icon={consultationType === "video" ? "videocam" : "medical"}
              label="Consultation"
              value={
                consultationType === "video"
                  ? "Online Video Consultation"
                  : "In-Person Clinic Visit"
              }
            />
            <ConfirmRow
              icon="wallet"
              label="Consultation Fee"
              value={formatINR(doctor.fees)}
            />
            <ConfirmRow
              icon="card"
              label="Payment Mode"
              value="Pay at Clinic (Cash / UPI on arrival)"
            />
          </Card>

          {/* Actions */}
          <View style={styles.confirmActions}>
            <Button
              title="View Digital Hospital Pass"
              variant="primary"
              icon="card-outline"
              onPress={onViewPass}
            />
            <Button
              title="View Appointment Details"
              variant="outline"
              icon="document-text-outline"
              onPress={onViewDetails}
            />
            <Button
              title="Go to My Appointments"
              variant="ghost"
              icon="calendar-outline"
              onPress={onGoToAppointments}
            />
            <Button title="Return to Home" variant="ghost" onPress={onGoHome} />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function BookingScreen() {
  const router = useRouter();
  const { doctorId, type, mode } = useLocalSearchParams<{
    doctorId?: string;
    type?: string;
    mode?: string;
  }>();
  const { user } = useAuth();

  const requestedType: ConsultationType | null =
    type === "video" || type === "clinic" ? type : null;
  const requestedMode =
    mode === "instant" ? ("instant" as const) : ("scheduled" as const);

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [consultationType, setConsultationType] = useState<ConsultationType>(
    requestedType ?? "clinic",
  );
  const consultationMode = requestedMode;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    requestedType === "video" ? "online" : "cash",
  );
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [successAppointmentId, setSuccessAppointmentId] = useState("");
  const [successReference, setSuccessReference] = useState("");

  const phoneValid = isValidIndianPhone(user?.phone || "");
  const onlineAvailable = isRazorpayCheckoutAvailable();

  // Next 7 days starting from today
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

  // Load doctor details
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
        if (active)
          setLoadError(toErrorMessage(err, "Unable to load doctor details."));
      })
      .finally(() => {
        if (active) setLoadingDoctor(false);
      });
    return () => {
      active = false;
    };
  }, [doctorId]);

  // Fetch real available slots when date or doctor changes
  useEffect(() => {
    let active = true;
    if (!doctorId) return;
    setSlotsLoading(true);
    setSlotsError("");
    setSelectedSlot("");

    const dateStr = toDDMMYYYY(selectedDate);
    appointmentService
      .getAvailableSlots(doctorId, dateStr)
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
  const isLeaveDate = Boolean(doctor?.leaveDates?.includes(selectedDateStr));
  const { morning, afternoon, evening } = useMemo(
    () => categorizeSlots(availableSlots),
    [availableSlots],
  );

  const confirmBooking = async () => {
    setBookingError("");
    if (!doctor || !doctorId) return;

    if (!doctor.available) {
      setBookingError("This doctor is currently not accepting appointments.");
      return;
    }
    if (isLeaveDate) {
      setBookingError(
        "The doctor is on leave on this date. Please choose another date.",
      );
      return;
    }
    if (!selectedSlot) {
      setBookingError("Please select an available time slot.");
      return;
    }
    if (!phoneValid) {
      setBookingError(
        "Please add a valid phone number to your profile before booking.",
      );
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
        consultationMode:
          consultationType === "video" ? consultationMode : "scheduled",
      });

      const booked = res.appointment as unknown as
        | {
            _id?: string;
            appointmentId?: string;
            displayAppointmentId?: string;
          }
        | undefined;
      const bookedId = String(booked?._id || "");

      // For online payment, route immediately to the secure Razorpay payment flow
      if (paymentMethod === "online") {
        if (!bookedId) {
          setBookingError(
            'Your appointment was created. Please locate it under "My Appointments" to complete payment.',
          );
        } else {
          router.replace({
            pathname: "/payment/[appointmentId]",
            params: { appointmentId: bookedId },
          });
        }
        return;
      }

      setSuccessAppointmentId(bookedId);
      setSuccessReference(
        String(
          booked?.appointmentId || booked?.displayAppointmentId || bookedId,
        ),
      );
    } catch (err) {
      const message = toErrorMessage(err, "Booking failed. Please try again.");
      const serverMessage =
        err instanceof ApiClientError ? err.serverMessage || "" : "";
      setBookingError(
        /online payment|payment order|razorpay/i.test(serverMessage)
          ? serverMessage
          : message,
      );

      // If slot conflict occurs, immediately refresh the real available slots
      if (
        /just booked|already booked|already taken|unavailable|409/i.test(
          message,
        )
      ) {
        try {
          const fresh = await appointmentService.getAvailableSlots(
            doctorId,
            selectedDateStr,
          );
          setAvailableSlots(fresh.availableSlots || []);
          setSelectedSlot(fresh.availableSlots?.[0] || "");
        } catch {
          // preserve current state on network error
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDoctor) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading appointment details..." />
      </SafeAreaView>
    );
  }

  if (loadError || !doctor) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={loadError || "Doctor profile not found."} />
      </SafeAreaView>
    );
  }

  const consultationTypes = doctor.consultationTypes || ["clinic"];
  const specialtyLabel =
    doctor.speciality ||
    doctor.specialization ||
    doctor.department ||
    "General Physician";
  const hospitalName =
    doctor.hospitalName ||
    doctor.clinicInfo?.name ||
    "Affiliated Medical Center";

  const stepStatus = (step: StepKey): "done" | "active" | "pending" => {
    if (step === "Date") return "done";
    if (step === "Time") return selectedSlot ? "done" : "active";
    return selectedSlot ? "active" : "pending";
  };

  // -------------------------------------------------------------
  // Confirmation Screen (Pay at Clinic / Booked Successfully)
  // -------------------------------------------------------------
  if (successAppointmentId && doctor) {
    return (
      <BookingConfirmationView
        doctor={doctor}
        specialtyLabel={specialtyLabel}
        hospitalName={hospitalName}
        selectedDateStr={selectedDateStr}
        selectedSlot={selectedSlot}
        consultationType={consultationType}
        successAppointmentId={successAppointmentId}
        successReference={successReference}
        onViewPass={() =>
          router.replace({
            pathname: "/appointment/pass/[id]" as any,
            params: { id: successAppointmentId },
          })
        }
        onViewDetails={() =>
          router.replace({
            pathname: "/appointment/[id]",
            params: { id: successAppointmentId },
          })
        }
        onGoToAppointments={() => router.replace("/(drawer)/appointments")}
        onGoHome={() => router.replace("/(drawer)")}
      />
    );
  }

  // -------------------------------------------------------------
  // Main Booking Stepper & Picker Flow
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/doctors")
            }
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Book Appointment</Text>
            <Text style={styles.headerSubtitle}>
              Reserve your visit with {stripDoctorTitle(doctor.name)}
            </Text>
          </View>
        </View>

        {/* Doctor Summary Banner */}
        <Card padded style={styles.doctorCard}>
          <Image
            source={{ uri: getDoctorImage(doctor) }}
            style={styles.doctorAvatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.doctorInfo}>
            <View style={styles.doctorTitleRow}>
              <Text style={styles.doctorName} numberOfLines={1}>
                {formatDoctorName(doctor.name)}
              </Text>
              {doctor.verificationStatus === "Verified" ? (
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={Palette.primary}
                />
              ) : null}
            </View>
            <Text style={styles.doctorSpecialty} numberOfLines={1}>
              {specialtyLabel}
            </Text>
            <Text style={styles.doctorHospital} numberOfLines={1}>
              <Ionicons name="business" size={12} color={Palette.textMuted} />{" "}
              {hospitalName}
            </Text>
            <View style={styles.doctorMetaRow}>
              <Text style={styles.doctorFee}>{formatINR(doctor.fees)}</Text>
              <Text style={styles.doctorFeeSub}>/ consultation</Text>
              {!doctor.available ? (
                <Badge label="Currently Unavailable" variant="warning" />
              ) : null}
            </View>
          </View>
        </Card>

        {/* Visual Progress Stepper */}
        <View style={styles.stepper}>
          {STEPS.map((step, index) => {
            const status = stepStatus(step);
            return (
              <View key={step} style={styles.stepWrap}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      status === "done" && styles.stepCircleDone,
                      status === "active" && styles.stepCircleActive,
                    ]}
                  >
                    {status === "done" ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={Palette.white}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          status === "active" && styles.stepNumberActive,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      (status === "done" || status === "active") &&
                        styles.stepLabelActive,
                    ]}
                  >
                    {step}
                  </Text>
                </View>
                {index < STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.stepLine,
                      status === "done" && styles.stepLineDone,
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {bookingError ? (
          <FormMessage type="error" message={bookingError} />
        ) : null}

        {/* ---------------- Step 1: Date ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberBadgeText}>1</Text>
            </View>
            <View style={styles.stepHeadingTextWrap}>
              <Text style={styles.stepTitle}>Select Date</Text>
              <Text style={styles.stepSubtitle}>
                Choose an appointment date from the upcoming week
              </Text>
            </View>
          </View>

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
              const onLeave = Boolean(doctor.leaveDates?.includes(dateStr));

              return (
                <Pressable
                  key={dateStr}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedDate(date)}
                  style={({ pressed }) => [
                    styles.dateTile,
                    active && styles.dateTileActive,
                    onLeave && styles.dateTileLeave,
                    pressed && !onLeave && styles.dateTilePressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateWeekday,
                      active && styles.dateTextActive,
                      onLeave && styles.dateTextLeave,
                    ]}
                  >
                    {isToday ? "Today" : weekdayLabel(date)}
                  </Text>
                  <Text
                    style={[
                      styles.dateDay,
                      active && styles.dateTextActive,
                      onLeave && styles.dateTextLeave,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  <Text
                    style={[
                      styles.dateMonth,
                      active && styles.dateTextActive,
                      onLeave && styles.dateTextLeave,
                    ]}
                  >
                    {dateLabel(date).split(" ")[1]}
                  </Text>
                  {onLeave ? (
                    <View style={styles.leaveBadge}>
                      <Text style={styles.leaveBadgeText}>Leave</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        {/* ---------------- Step 2: Time Slot ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberBadgeText}>2</Text>
            </View>
            <View style={styles.stepHeadingTextWrap}>
              <Text style={styles.stepTitle}>Select Time Slot</Text>
              <Text style={styles.stepSubtitle}>
                {availableSlots.length > 0
                  ? `${availableSlots.length} available slots for ${formatDDMMYYYY(selectedDateStr)}`
                  : "Real-time doctor schedule"}
              </Text>
            </View>
            <View style={styles.stepLive}>
              <Ionicons name="pulse" size={13} color={Palette.success} />
              <Text style={styles.stepLiveText}>Live Sync</Text>
            </View>
          </View>

          {isLeaveDate ? (
            <FormMessage
              type="warning"
              message="The doctor is scheduled on leave on this date. Please select another date above."
            />
          ) : slotsLoading ? (
            <View style={styles.slotLoadingWrap}>
              <Loading fullScreen={false} label="Loading schedule..." />
            </View>
          ) : slotsError ? (
            <Text style={styles.slotsStateText}>{slotsError}</Text>
          ) : availableSlots.length === 0 ? (
            <View style={styles.emptySlotsBox}>
              <Ionicons
                name="calendar-outline"
                size={36}
                color={Palette.textMuted}
              />
              <Text style={styles.emptySlotsTitle}>No Available Slots</Text>
              <Text style={styles.emptySlotsText}>
                All appointment slots are fully booked or unavailable for this
                day. Please pick another date.
              </Text>
            </View>
          ) : (
            <View style={styles.sessionsContainer}>
              {/* Morning Session */}
              {morning.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <View style={styles.sessionHeader}>
                    <Ionicons
                      name="sunny-outline"
                      size={16}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.sessionTitle}>Morning</Text>
                    <Text style={styles.sessionCount}>
                      {morning.length} slots
                    </Text>
                  </View>
                  <View style={styles.slotGrid}>
                    {morning.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={({ pressed }) => [
                            styles.slot,
                            active && styles.slotActive,
                            pressed && styles.slotPressed,
                          ]}
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

              {/* Afternoon Session */}
              {afternoon.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <View style={styles.sessionHeader}>
                    <Ionicons
                      name="partly-sunny-outline"
                      size={16}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.sessionTitle}>Afternoon</Text>
                    <Text style={styles.sessionCount}>
                      {afternoon.length} slots
                    </Text>
                  </View>
                  <View style={styles.slotGrid}>
                    {afternoon.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={({ pressed }) => [
                            styles.slot,
                            active && styles.slotActive,
                            pressed && styles.slotPressed,
                          ]}
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

              {/* Evening Session */}
              {evening.length > 0 ? (
                <View style={styles.sessionGroup}>
                  <View style={styles.sessionHeader}>
                    <Ionicons
                      name="moon-outline"
                      size={16}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.sessionTitle}>Evening</Text>
                    <Text style={styles.sessionCount}>
                      {evening.length} slots
                    </Text>
                  </View>
                  <View style={styles.slotGrid}>
                    {evening.map((slot) => {
                      const active = slot === selectedSlot;
                      return (
                        <Pressable
                          key={slot}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelectedSlot(slot)}
                          style={({ pressed }) => [
                            styles.slot,
                            active && styles.slotActive,
                            pressed && styles.slotPressed,
                          ]}
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

              <Text style={styles.realtimeNote}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={12}
                  color={Palette.primaryDark}
                />{" "}
                Slots are reserved atomically. Double booking is prevented
                server-side.
              </Text>
            </View>
          )}
        </Card>

        {/* ---------------- Consultation Type ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <View style={[styles.stepNumberBadge, styles.stepNumberBadgeIcon]}>
              <Ionicons name="medkit" size={14} color={Palette.white} />
            </View>
            <View style={styles.stepHeadingTextWrap}>
              <Text style={styles.stepTitle}>Consultation Type</Text>
              <Text style={styles.stepSubtitle}>
                Select in-person clinic examination or secure teleconsultation
              </Text>
            </View>
          </View>

          <View style={styles.typeRow}>
            {consultationTypes.includes("clinic") ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: consultationType === "clinic" }}
                onPress={() => setConsultationType("clinic")}
                style={[
                  styles.typeChip,
                  consultationType === "clinic" && styles.typeChipActive,
                ]}
              >
                <View
                  style={[
                    styles.typeIconBox,
                    consultationType === "clinic" && styles.typeIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name="business"
                    size={20}
                    color={
                      consultationType === "clinic"
                        ? Palette.white
                        : Palette.primary
                    }
                  />
                </View>
                <View style={styles.typeChipTexts}>
                  <Text
                    style={[
                      styles.typeTitle,
                      consultationType === "clinic" && styles.typeTextActive,
                    ]}
                  >
                    Clinic Visit
                  </Text>
                  <Text
                    style={[
                      styles.typeSub,
                      consultationType === "clinic" && styles.typeTextActive,
                    ]}
                  >
                    In-person visit at hospital
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {consultationTypes.includes("video") ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: consultationType === "video" }}
                onPress={() => setConsultationType("video")}
                style={[
                  styles.typeChip,
                  consultationType === "video" && styles.typeChipActive,
                ]}
              >
                <View
                  style={[
                    styles.typeIconBox,
                    consultationType === "video" && styles.typeIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={
                      consultationType === "video"
                        ? Palette.white
                        : Palette.primary
                    }
                  />
                </View>
                <View style={styles.typeChipTexts}>
                  <Text
                    style={[
                      styles.typeTitle,
                      consultationType === "video" && styles.typeTextActive,
                    ]}
                  >
                    Video Consultation
                  </Text>
                  <Text
                    style={[
                      styles.typeSub,
                      consultationType === "video" && styles.typeTextActive,
                    ]}
                  >
                    Secure Google Meet session
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {/* ---------------- Step 3: Review & Payment ---------------- */}
        <Card padded style={styles.stepCard}>
          <View style={styles.stepHeading}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberBadgeText}>3</Text>
            </View>
            <View style={styles.stepHeadingTextWrap}>
              <Text style={styles.stepTitle}>Review & Confirm</Text>
              <Text style={styles.stepSubtitle}>
                Verify appointment details and select payment method
              </Text>
            </View>
          </View>

          <Text style={styles.payLabel}>Payment Method</Text>
          <View style={styles.payRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === "cash" }}
              onPress={() => setPaymentMethod("cash")}
              style={[
                styles.payCard,
                paymentMethod === "cash" && styles.payCardActive,
              ]}
            >
              <Ionicons
                name="cash-outline"
                size={24}
                color={
                  paymentMethod === "cash" ? Palette.white : Palette.primaryDark
                }
              />
              <Text
                style={[
                  styles.payTitle,
                  paymentMethod === "cash" && styles.payTextActive,
                ]}
              >
                Pay at Clinic
              </Text>
              <Text
                style={[
                  styles.paySub,
                  paymentMethod === "cash" && styles.payTextActive,
                ]}
              >
                Cash / UPI on arrival
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === "online" }}
              onPress={() => setPaymentMethod("online")}
              style={[
                styles.payCard,
                paymentMethod === "online" && styles.payCardActive,
              ]}
            >
              <Ionicons
                name="card-outline"
                size={24}
                color={
                  paymentMethod === "online"
                    ? Palette.white
                    : Palette.primaryDark
                }
              />
              <Text
                style={[
                  styles.payTitle,
                  paymentMethod === "online" && styles.payTextActive,
                ]}
              >
                Pay Online
              </Text>
              <Text
                style={[
                  styles.paySub,
                  paymentMethod === "online" && styles.payTextActive,
                ]}
              >
                Secure Razorpay
              </Text>
            </Pressable>
          </View>

          {paymentMethod === "online" && !onlineAvailable ? (
            <FormMessage
              type="info"
              message="Razorpay native module is active in production builds. For test execution, booking will still be registered securely with online_pending status."
            />
          ) : null}

          {/* Booking Summary Box */}
          <View style={styles.summary}>
            <SummaryRow label="Doctor" value={formatDoctorName(doctor.name)} />
            <SummaryRow label="Department" value={specialtyLabel} />
            <SummaryRow label="Hospital" value={hospitalName} />
            <SummaryRow
              label="Appointment Date"
              value={formatDDMMYYYY(selectedDateStr)}
            />
            <SummaryRow
              label="Selected Slot"
              value={selectedSlot || "Choose a slot"}
            />
            <SummaryRow
              label="Consultation"
              value={
                consultationType === "video"
                  ? "Video Consultation"
                  : "Clinic Visit"
              }
            />
            <SummaryRow
              label="Payment Method"
              value={
                paymentMethod === "online"
                  ? "Online (Razorpay)"
                  : "Pay at Clinic"
              }
            />
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Consultation Fee</Text>
            <Text style={styles.totalValue}>
              {formatINR(doctor.fees)}
              {paymentMethod === "cash" ? " · on arrival" : ""}
            </Text>
          </View>

          <Button
            title={
              submitting ? "Confirming Booking..." : "Confirm & Book Visit"
            }
            icon="calendar"
            onPress={confirmBooking}
            loading={submitting}
            disabled={!selectedSlot || !doctor.available || isLeaveDate}
            style={styles.confirmButton}
          />

          {!phoneValid ? (
            <Text style={styles.phoneHint}>
              * Please update your profile with a valid phone number before
              confirming booking.
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

function ConfirmRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.confirmRow}>
      <View style={styles.confirmRowLeft}>
        <Ionicons name={icon} size={17} color={Palette.primary} />
        <Text style={styles.confirmLabel}>{label}</Text>
      </View>
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
    opacity: 0.7,
  },
  header: {
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
  doctorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
    ...Shadows.card,
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
  doctorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  doctorName: {
    ...Typography.h4,
    color: Palette.text,
    flexShrink: 1,
  },
  doctorSpecialty: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  doctorHospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
  },
  doctorFee: {
    ...Typography.label,
    color: Palette.primary,
    fontWeight: "800",
  },
  doctorFeeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  stepItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
  stepCard: {
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.12)",
    ...Shadows.card,
  },
  stepHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberBadgeText: {
    color: Palette.white,
    fontSize: 13,
    fontWeight: "800",
  },
  stepNumberBadgeIcon: {
    backgroundColor: Palette.primaryDark,
  },
  stepHeadingTextWrap: {
    flex: 1,
    gap: 1,
  },
  stepTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  stepSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  stepLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  stepLiveText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "700",
    fontSize: 11,
  },
  dateScroll: {
    marginHorizontal: -Spacing.lg,
  },
  dateRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  dateTile: {
    alignItems: "center",
    gap: 3,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minWidth: 68,
  },
  dateTileActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
    ...Shadows.sm,
  },
  dateTileLeave: {
    borderColor: "rgba(232, 154, 60, 0.4)",
    backgroundColor: "rgba(232, 154, 60, 0.05)",
  },
  dateTilePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  dateWeekday: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  dateDay: {
    ...Typography.h3,
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
  dateTextLeave: {
    color: Palette.warning,
  },
  leaveBadge: {
    backgroundColor: Palette.warning,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    marginTop: 2,
  },
  leaveBadgeText: {
    color: Palette.white,
    fontSize: 9,
    fontWeight: "700",
  },
  slotLoadingWrap: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  slotsStateText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  emptySlotsBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xl,
  },
  emptySlotsTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  emptySlotsText: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  sessionsContainer: {
    gap: Spacing.md,
  },
  sessionGroup: {
    gap: Spacing.xs,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 2,
  },
  sessionTitle: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
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
  slotPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
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
  realtimeNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: Spacing.xs,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
  },
  typeChipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconBoxActive: {
    backgroundColor: Palette.primary,
  },
  typeChipTexts: {
    flex: 1,
    gap: 1,
  },
  typeTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
  },
  typeSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  typeTextActive: {
    color: Palette.primaryDark,
  },
  payLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  payRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  payCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    padding: Spacing.md,
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  payCardActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  payTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
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
    marginTop: Spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  summaryValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  totalLabel: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  totalValue: {
    ...Typography.h4,
    color: Palette.primaryDark,
    fontWeight: "800",
  },
  confirmButton: {
    marginTop: Spacing.xs,
  },
  phoneHint: {
    ...Typography.caption,
    color: Palette.warning,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  confirmContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  confirmIconWrap: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  confirmPulseRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(46, 158, 91, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Palette.success,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  confirmTitle: {
    ...Typography.h2,
    color: Palette.text,
    textAlign: "center",
  },
  confirmSubtitle: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  referenceBadgeWrap: {
    alignSelf: "center",
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: "center",
    gap: 2,
    marginTop: Spacing.xs,
  },
  referenceLabel: {
    fontSize: 10,
    color: Palette.primaryDark,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  referenceValue: {
    ...Typography.h4,
    color: Palette.primary,
    fontWeight: "800",
  },
  confirmCard: {
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
    ...Shadows.card,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  confirmRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  confirmLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  confirmValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  confirmActions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
