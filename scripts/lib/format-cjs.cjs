const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function normalizeToDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
    const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    if (value.date) return normalizeToDate(value.date);
    if (value.slotDate) return normalizeToDate(value.slotDate);
    if (value.bookingDate) return normalizeToDate(value.bookingDate);
  }
  return null;
}

function toDDMMYYYY(date) {
  if (!date) return "";
  const dObj = normalizeToDate(date);
  if (!dObj) {
    if (typeof date === "string") {
      const s = date.trim();
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
    }
    return "";
  }
  const d = String(dObj.getDate()).padStart(2, "0");
  const m = String(dObj.getMonth() + 1).padStart(2, "0");
  return `${d}-${m}-${dObj.getFullYear()}`;
}

function formatDDMMYYYY(value, fallback = "-") {
  if (!value) return fallback;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return fallback;
    const d = value.getDate();
    const m = MONTHS_SHORT[value.getMonth()] || String(value.getMonth() + 1);
    const y = value.getFullYear();
    return `${d} ${m} ${y}`;
  }
  if (typeof value !== "string") {
    const dObj = normalizeToDate(value);
    if (dObj) {
      return `${dObj.getDate()} ${MONTHS_SHORT[dObj.getMonth()]} ${dObj.getFullYear()}`;
    }
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const monthIndex = Number(mm) - 1;
    const month = MONTHS_SHORT[monthIndex] || mm;
    return `${Number(dd)} ${month} ${yyyy}`;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const monthIndex = Number(mm) - 1;
    const month = MONTHS_SHORT[monthIndex] || mm;
    return `${Number(dd)} ${month} ${yyyy}`;
  }

  const parsed = normalizeToDate(trimmed);
  if (parsed && !isNaN(parsed.getTime())) {
    return `${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  return trimmed;
}

function parseSlotToMinutes(slot) {
  if (!slot) return 0;
  const match = String(slot).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = (match[3] || "").toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function getNowMinutesIST(mockNow) {
  const date = mockNow || new Date();
  const timeStr = date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [hh, mm] = timeStr.split(":").map(Number);
  return hh * 60 + mm;
}

function isDateTodayIST(dateInput, mockNow) {
  const dObj = normalizeToDate(dateInput);
  if (!dObj) return false;
  const targetStr = toDDMMYYYY(dObj);

  const now = mockNow || new Date();
  const istDateStr = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  const [dd, mm, yyyy] = istDateStr.split("/").map(Number);
  const todayIST = `${String(dd).padStart(2, "0")}-${String(mm).padStart(2, "0")}-${yyyy}`;

  return targetStr === todayIST;
}

function isDatePastIST(dateInput, mockNow) {
  const dObj = normalizeToDate(dateInput);
  if (!dObj) return false;

  const now = mockNow || new Date();
  const istDateStr = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  const [dd, mm, yyyy] = istDateStr.split("/").map(Number);
  const todayMid = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  const targetMid = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0, 0);

  return targetMid.getTime() < todayMid.getTime();
}

function isSlotPassedIST(slotDate, slotTime, mockNow) {
  if (isDatePastIST(slotDate, mockNow)) return true;
  if (isDateTodayIST(slotDate, mockNow)) {
    const currentMin = getNowMinutesIST(mockNow);
    const slotMin = parseSlotToMinutes(slotTime);
    return slotMin <= currentMin;
  }
  return false;
}

module.exports = {
  normalizeToDate,
  toDDMMYYYY,
  formatDDMMYYYY,
  parseSlotToMinutes,
  getNowMinutesIST,
  isDateTodayIST,
  isDatePastIST,
  isSlotPassedIST,
};
