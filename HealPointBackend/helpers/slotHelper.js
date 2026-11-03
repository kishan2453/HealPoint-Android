import appointmentModel from "../models/appointmentModel.js";

export const MAX_HOURLY_CAPACITY = 15;

export const parseHourFromSlot = (slot) => {
  if (!slot) return 9;
  const match = String(slot).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 9;
  let hour = Number(match[1]);
  const meridiem = (match[3] || "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour;
};

export const formatHourLabel = (hour24) => {
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const nextH = (hour24 + 1) % 12 === 0 ? 12 : (hour24 + 1) % 12;
  const nextMeridiem = hour24 + 1 >= 12 ? "PM" : "AM";
  return `${String(h).padStart(2, "0")}:00 ${meridiem} - ${String(nextH).padStart(2, "0")}:00 ${nextMeridiem}`;
};

export const parseDateString = (str) => {
  if (!str) return null;
  if (str instanceof Date) {
    return isNaN(str.getTime()) ? null : str;
  }
  if (typeof str === "number") {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(str).trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day);
  }
  // YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const normalizeDateDDMMYYYY = (dateInput) => {
  if (!dateInput) return "";
  let dateObj = dateInput;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    dateObj = parseDateString(dateInput);
  }
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    const s = String(dateInput).trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
    return "";
  }
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}-${m}-${y}`;
};

export const generateDoctorSlotsForDate = async (doctor, targetDate) => {
  // If doctor is globally unavailable or inactive
  if (!doctor.isActive || doctor.available === false) {
    return {
      availableSlots: [],
      reason: "Doctor is currently not available for appointments",
      hourlyCapacity: {},
    };
  }

  const parsedDate = parseDateString(targetDate);
  if (!parsedDate) {
    return {
      availableSlots: [],
      reason: "Invalid appointment date format",
      hourlyCapacity: {},
    };
  }

  const normalizedTarget = normalizeDateDDMMYYYY(parsedDate);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = dayNames[parsedDate.getDay()];

  // Check weekly working schedule
  let startTimeStr = "09:00 AM";
  let endTimeStr = "05:00 PM";
  let isWorkingDay = true;

  if (Array.isArray(doctor.weeklySchedule) && doctor.weeklySchedule.length > 0) {
    const dayConfig = doctor.weeklySchedule.find(
      (w) => w.day && w.day.toLowerCase() === dayOfWeek.toLowerCase()
    );
    if (dayConfig) {
      if (dayConfig.enabled === false) {
        isWorkingDay = false;
      } else {
        if (dayConfig.startTime) startTimeStr = dayConfig.startTime;
        if (dayConfig.endTime) endTimeStr = dayConfig.endTime;
      }
    } else {
      if (dayOfWeek === "Sunday") isWorkingDay = false;
    }
  } else {
    // Default practice schedule (Mon - Sat)
    if (dayOfWeek === "Sunday") isWorkingDay = false;
  }

  if (!isWorkingDay) {
    return {
      availableSlots: [],
      reason: `Doctor does not practice on ${dayOfWeek}s`,
      hourlyCapacity: {},
    };
  }

  // Check if doctor has registered leave or all-day block for this date
  const isLeave = (doctor.blockedSlots || []).some((b) => {
    if (!b.date) return false;
    const bDate = parseDateString(b.date);
    const bNorm = bDate ? normalizeDateDDMMYYYY(bDate) : b.date;
    const isMatchingDate = bNorm === normalizedTarget || b.date === targetDate;
    const isAllDay =
      !b.slotTime ||
      b.slotTime.toLowerCase() === "all day" ||
      b.slotTime.toLowerCase() === "all_day" ||
      (b.reason && b.reason.toLowerCase().includes("leave"));
    return isMatchingDate && isAllDay;
  });

  if (isLeave) {
    return {
      availableSlots: [],
      reason: "Doctor is on leave on this date",
      hourlyCapacity: {},
    };
  }

  // Parse time into minutes
  const parseTimeToMinutes = (tStr) => {
    const match = String(tStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 540;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const meridiem = (match[3] || "").toUpperCase();
    if (meridiem === "PM" && h !== 12) h += 12;
    if (meridiem === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const startMin = parseTimeToMinutes(startTimeStr);
  const endMin = parseTimeToMinutes(endTimeStr);
  const duration = Math.max(15, Number(doctor.slotDurationMinutes) || 30);

  // Generate candidate time slots
  const candidateSlots = [];
  for (let m = startMin; m < endMin; m += duration) {
    const hour24 = Math.floor(m / 60);
    const minute = m % 60;
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const slotString = `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
    candidateSlots.push({ slotString, hour24, minute });
  }

  // Find all valid non-cancelled appointments for this doctor on this date
  const existingAppts = await appointmentModel.find({
    doctorId: doctor._id,
    $or: [
      { slotDate: normalizedTarget },
      { slotDate: targetDate },
    ],
    status: { $nin: ["cancel", "cancelled"] },
  }).select("slotTime status");

  // Calculate bookings per hour window
  const hourlyCount = {};
  existingAppts.forEach((a) => {
    if (a.slotTime) {
      const h = parseHourFromSlot(a.slotTime);
      hourlyCount[h] = (hourlyCount[h] || 0) + 1;
    }
  });

  // Build hourly capacity breakdown
  const hourlyCapacity = {};
  for (let h = Math.floor(startMin / 60); h <= Math.floor(endMin / 60); h++) {
    const booked = hourlyCount[h] || 0;
    hourlyCapacity[h] = {
      hour: h,
      label: formatHourLabel(h),
      booked,
      limit: MAX_HOURLY_CAPACITY,
      isFull: booked >= MAX_HOURLY_CAPACITY,
    };
  }

  // Check specific blocked slots
  const blockedSlotTimes = new Set();
  (doctor.blockedSlots || []).forEach((b) => {
    if (b.date) {
      const bDate = parseDateString(b.date);
      const bNorm = bDate ? normalizeDateDDMMYYYY(bDate) : b.date;
      if (bNorm === normalizedTarget || b.date === targetDate) {
        if (b.slotTime && b.slotTime.toLowerCase() !== "all day") {
          blockedSlotTimes.add(b.slotTime.trim().toUpperCase());
        }
      }
    }
  });

  // If booking for today, exclude slots that have already passed
  const now = new Date();
  const isToday =
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  // Parse doctor break times
  const breaksList = [];
  if (Array.isArray(doctor.breakTimes)) {
    breaksList.push(...doctor.breakTimes);
  }
  if (Array.isArray(doctor.weeklySchedule)) {
    const dayConfig = doctor.weeklySchedule.find(
      (w) => w.day && w.day.toLowerCase() === dayOfWeek.toLowerCase()
    );
    if (dayConfig && Array.isArray(dayConfig.breaks)) {
      breaksList.push(...dayConfig.breaks);
    }
  }

  const parsedBreaks = breaksList
    .filter((b) => b && b.startTime && b.endTime)
    .map((b) => ({
      start: parseTimeToMinutes(b.startTime),
      end: parseTimeToMinutes(b.endTime),
      name: b.name || "Break",
    }));

  // Filter valid slots
  const availableSlots = candidateSlots
    .filter(({ slotString, hour24, minute }) => {
      const slotTotalMinutes = hour24 * 60 + minute;

      // Doctor break times check
      const isInBreak = parsedBreaks.some(
        (b) => slotTotalMinutes >= b.start && slotTotalMinutes < b.end
      );
      if (isInBreak) return false;

      // 1. If today, slot must not be in past
      if (isToday) {
        if (slotTotalMinutes <= currentTotalMinutes + 5) {
          return false;
        }
      }

      // 2. Maximum 15 bookings per doctor per hour
      if ((hourlyCount[hour24] || 0) >= MAX_HOURLY_CAPACITY) {
        return false;
      }

      // 3. Slot must not be individually blocked
      if (blockedSlotTimes.has(slotString.toUpperCase())) {
        return false;
      }

      return true;
    })
    .map((c) => c.slotString);

  return {
    availableSlots,
    totalSlots: availableSlots.length,
    hourlyCapacity,
    reason:
      availableSlots.length === 0
        ? "All appointment slots are fully booked or unavailable for this date"
        : undefined,
  };
};

export const getHourlyBookingCount = async (doctorId, slotDate, slotTime, excludeAppointmentId = null) => {
  if (!doctorId || !slotDate || !slotTime) return 0;
  const parsedDate = parseDateString(slotDate);
  const normalizedTarget = parsedDate ? normalizeDateDDMMYYYY(parsedDate) : slotDate;
  const targetHour = parseHourFromSlot(slotTime);

  const query = {
    doctorId,
    $or: [
      { slotDate: normalizedTarget },
      { slotDate: slotDate },
    ],
    status: { $nin: ["cancel", "cancelled"] },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const appointments = await appointmentModel.find(query).select("slotTime status");
  let count = 0;
  for (const appt of appointments) {
    if (appt.slotTime && parseHourFromSlot(appt.slotTime) === targetHour) {
      count++;
    }
  }
  return count;
};

export const getSmartSlotSuggestionsHelper = async (doctor, targetDate) => {
  const primaryResult = await generateDoctorSlotsForDate(doctor, targetDate);
  const alternativeSuggestions = [];

  const parsedBase = parseDateString(targetDate) || new Date();
  for (let offset = 1; offset <= 5; offset++) {
    const nextDate = new Date(parsedBase);
    nextDate.setDate(nextDate.getDate() + offset);
    const nextDateStr = normalizeDateDDMMYYYY(nextDate);
    const nextResult = await generateDoctorSlotsForDate(doctor, nextDateStr);

    if (nextResult.availableSlots && nextResult.availableSlots.length > 0) {
      alternativeSuggestions.push({
        date: nextDateStr,
        dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][nextDate.getDay()],
        availableCount: nextResult.availableSlots.length,
        sampleSlots: nextResult.availableSlots.slice(0, 4),
      });
      if (alternativeSuggestions.length >= 3) break;
    }
  }

  return {
    ...primaryResult,
    targetDate,
    alternativeSuggestions,
  };
};
