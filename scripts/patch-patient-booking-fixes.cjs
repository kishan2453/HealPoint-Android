const fs = require('fs');
const path = require('path');

// 1. Patch app/booking/[doctorId].tsx
const bookingPath = path.join(__dirname, '..', 'app', 'booking', '[doctorId].tsx');
let bContent = fs.readFileSync(bookingPath, 'utf8');
const bCrlf = bContent.includes('\r\n');
bContent = bContent.replace(/\r\n/g, '\n');

// 1.1 Imports
const importTarget = `import {
  dateLabel,
  formatDDMMYYYY,
  formatDoctorName,
  formatINR,
  stripDoctorTitle,
  toDDMMYYYY,
  weekdayLabel,
} from "@/lib/format";`;

const importReplacement = `import {
  dateLabel,
  formatDDMMYYYY,
  formatDoctorName,
  formatINR,
  isDatePastIST,
  isDateTodayIST,
  isSlotPassedIST,
  parseSlotToMinutes,
  stripDoctorTitle,
  toDDMMYYYY,
  weekdayLabel,
} from "@/lib/format";`;

if (bContent.includes(importTarget)) {
  bContent = bContent.replace(importTarget, importReplacement);
  console.log('✓ Booking: imports patched');
} else {
  console.error('Booking: importTarget not found');
}

// 1.2 Slot fetching filter
const fetchTarget = `        const slots = res.availableSlots || [];
        setAvailableSlots(slots);
        if (slots.length > 0) {
          setSelectedSlot(slots[0]);
          setSmartSuggestions([]);
        } else {`;

const fetchReplacement = `        const slots = res.availableSlots || [];
        setAvailableSlots(slots);
        const futureSlots = isDateTodayIST(selectedDate)
          ? slots.filter((s: string) => !isSlotPassedIST(selectedDate, s))
          : slots;
        if (futureSlots.length > 0) {
          setSelectedSlot(futureSlots[0]);
          setSmartSuggestions([]);
        } else {`;

if (bContent.includes(fetchTarget)) {
  bContent = bContent.replace(fetchTarget, fetchReplacement);
  console.log('✓ Booking: slot fetching patched');
} else {
  console.error('Booking: fetchTarget not found');
}

// 1.3 Visible slots & categorization
const catTarget = `  const selectedDateStr = toDDMMYYYY(selectedDate);
  const isLeaveDate = Boolean(doctor?.leaveDates?.includes(selectedDateStr));
  const { morning, afternoon, evening } = useMemo(
    () => categorizeSlots(availableSlots),
    [availableSlots],
  );`;

const catReplacement = `  const selectedDateStr = toDDMMYYYY(selectedDate);
  const isLeaveDate = Boolean(doctor?.leaveDates?.includes(selectedDateStr));
  const isPastDate = isDatePastIST(selectedDate);
  const isTodayDate = isDateTodayIST(selectedDate);

  const visibleSlots = useMemo(() => {
    if (isPastDate) return [];
    if (isTodayDate) {
      return availableSlots.filter((slot) => !isSlotPassedIST(selectedDate, slot));
    }
    return availableSlots;
  }, [availableSlots, selectedDate, isPastDate, isTodayDate]);

  const { morning, afternoon, evening } = useMemo(
    () => categorizeSlots(visibleSlots),
    [visibleSlots],
  );`;

if (bContent.includes(catTarget)) {
  bContent = bContent.replace(catTarget, catReplacement);
  console.log('✓ Booking: visibleSlots categorization patched');
} else {
  console.error('Booking: catTarget not found');
}

// 1.4 confirmBooking validation
const confirmTarget = `    if (isLeaveDate) {
      setBookingError(
        "The doctor is on leave on this date. Please choose another date.",
      );
      return;
    }
    if (!selectedSlot) {`;

const confirmReplacement = `    if (isLeaveDate) {
      setBookingError(
        "The doctor is on leave on this date. Please choose another date.",
      );
      return;
    }
    if (isPastDate) {
      setBookingError(
        "Cannot book appointments for past dates. Please select today or a future date.",
      );
      return;
    }
    if (isTodayDate && isSlotPassedIST(selectedDate, selectedSlot)) {
      setBookingError(
        "Selected time slot has already passed for today. Please select a future slot.",
      );
      return;
    }
    if (!selectedSlot) {`;

if (bContent.includes(confirmTarget)) {
  bContent = bContent.replace(confirmTarget, confirmReplacement);
  console.log('✓ Booking: confirmBooking past validation patched');
} else {
  console.error('Booking: confirmTarget not found');
}

// 1.5 Step subtitle and remove fake Live Sync
const subTarget = `              <Text style={styles.stepSubtitle}>
                {availableSlots.length > 0
                  ? \`\${availableSlots.length} available slots for \${formatDDMMYYYY(selectedDateStr)}\`
                  : "Real-time doctor schedule"}
              </Text>
            </View>
            <View style={styles.stepLive}>
              <Ionicons name="pulse" size={13} color={Palette.success} />
              <Text style={styles.stepLiveText}>Live Sync</Text>
            </View>
          </View>`;

const subReplacement = `              <Text style={styles.stepSubtitle}>
                {visibleSlots.length > 0
                  ? \`\${visibleSlots.length} available slots for \${formatDDMMYYYY(selectedDateStr)}\`
                  : isTodayDate
                    ? "No more appointment slots are available for today"
                    : isPastDate
                      ? "Past date selected"
                      : "Real-time doctor schedule"}
              </Text>
            </View>
          </View>`;

if (bContent.includes(subTarget)) {
  bContent = bContent.replace(subTarget, subReplacement);
  console.log('✓ Booking: subtitle & fake Live Sync removed');
} else {
  console.error('Booking: subTarget not found');
}

// 1.6 Empty slots box text
const emptyTarget = `          ) : availableSlots.length === 0 ? (
            <View style={styles.emptySlotsBox}>
              <Ionicons
                name="calendar-outline"
                size={36}
                color={Palette.textMuted}
              />
              <Text style={styles.emptySlotsTitle}>No Available Slots for this Date</Text>
              <Text style={styles.emptySlotsText}>
                All appointment slots are fully booked. Choose an alternative suggested date or join the waitlist.
              </Text>`;

const emptyReplacement = `          ) : visibleSlots.length === 0 ? (
            <View style={styles.emptySlotsBox}>
              <Ionicons
                name="calendar-outline"
                size={36}
                color={Palette.textMuted}
              />
              <Text style={styles.emptySlotsTitle}>
                {isPastDate
                  ? "Past Date Selected"
                  : isTodayDate
                    ? "No More Slots Available Today"
                    : "No Available Slots for this Date"}
              </Text>
              <Text style={styles.emptySlotsText}>
                {isPastDate
                  ? "Cannot book appointments for past dates. Please select today or a future date."
                  : isTodayDate
                    ? "No more appointment slots are available for today. Please select another date."
                    : "All appointment slots are fully booked. Choose an alternative suggested date or join the waitlist."}
              </Text>`;

if (bContent.includes(emptyTarget)) {
  bContent = bContent.replace(emptyTarget, emptyReplacement);
  console.log('✓ Booking: empty slots box updated');
} else {
  console.error('Booking: emptyTarget not found');
}

// 1.7 Confirm button disabled condition
const btnTarget = `            onPress={confirmBooking}
            loading={submitting}
            disabled={!selectedSlot || !doctor.available || isLeaveDate}
            style={styles.confirmButton}`;

const btnReplacement = `            onPress={confirmBooking}
            loading={submitting}
            disabled={!selectedSlot || !doctor.available || isLeaveDate || isPastDate || visibleSlots.length === 0 || submitting}
            style={styles.confirmButton}`;

if (bContent.includes(btnTarget)) {
  bContent = bContent.replace(btnTarget, btnReplacement);
  console.log('✓ Booking: button disabled condition patched');
} else {
  console.error('Booking: btnTarget not found');
}

if (bCrlf) bContent = bContent.replace(/\n/g, '\r\n');
fs.writeFileSync(bookingPath, bContent, 'utf8');
console.log('app/booking/[doctorId].tsx saved successfully');

// 2. Patch app/payment/[appointmentId].tsx
const payPath = path.join(__dirname, '..', 'app', 'payment', '[appointmentId].tsx');
let pContent = fs.readFileSync(payPath, 'utf8');
const pCrlf = pContent.includes('\r\n');
pContent = pContent.replace(/\r\n/g, '\n');

pContent = pContent.replace(
  /{detailRow\("Date", formatDDMMYYYY\(appointment\?\.bookingDate\)\)}/g,
  '{detailRow("Date", formatDDMMYYYY(appointment?.slotDate || appointment?.bookingDate || appointment?.date))}'
);

if (pCrlf) pContent = pContent.replace(/\n/g, '\r\n');
fs.writeFileSync(payPath, pContent, 'utf8');
console.log('app/payment/[appointmentId].tsx saved successfully');
