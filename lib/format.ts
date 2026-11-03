/**
 * HealPoint - presentation helpers.
 */

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Safely normalize string, number, or Date input to a valid JS Date. */
export function normalizeToDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const date = new Date(y, m, d);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    // YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1;
      const d = parseInt(ymdMatch[3], 10);
      const date = new Date(y, m, d);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Format a JS Date (or valid date string/number) as the backend's `DD-MM-YYYY` slot format. */
export function toDDMMYYYY(date?: Date | string | number | null): string {
  const dObj = normalizeToDate(date);
  if (!dObj) return "";
  const d = String(dObj.getDate()).padStart(2, "0");
  const m = String(dObj.getMonth() + 1).padStart(2, "0");
  return `${d}-${m}-${dObj.getFullYear()}`;
}

/** Human-friendly display from a `DD-MM-YYYY` string or ISO timestamp -> e.g. `19 Aug 2026`. */
export function formatDDMMYYYY(value?: string, fallback = "-"): string {
  if (!value) return fallback;
  const trimmed = value.trim();

  // 1. DD-MM-YYYY match
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const monthIndex = Number(mm) - 1;
    const month = MONTHS_SHORT[monthIndex] || mm;
    return `${Number(dd)} ${month} ${yyyy}`;
  }

  // 2. YYYY-MM-DD match (e.g. 2026-10-30 or ISO timestamp)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const monthIndex = Number(mm) - 1;
    const month = MONTHS_SHORT[monthIndex] || mm;
    return `${Number(dd)} ${month} ${yyyy}`;
  }

  // 3. Fallback to JS Date if valid
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()} ${MONTHS_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  return trimmed;
}

/**
 * Formats any date or ISO string into a human-friendly "DD Mon YYYY · H:MM AM/PM".
 * Example: `30 Oct 2026 · 9:01 AM`
 */
export function formatSmartDateTime(
  value?: string | Date | null,
  fallback = "-",
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDDMMYYYY(
      typeof value === "string" ? value : undefined,
      fallback,
    );
  }
  const datePart = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;

  // If input was a string without time components
  if (
    typeof value === "string" &&
    !value.includes("T") &&
    !value.includes(":")
  ) {
    return datePart;
  }

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timePart = `${hours}:${minutes} ${ampm}`;
  return `${datePart} · ${timePart}`;
}

/** `24 Aug` style label for a date row in the date picker. */
export function dateLabel(date?: Date | string | number | null): string {
  const dObj = normalizeToDate(date);
  if (!dObj) return "-";
  return `${dObj.getDate()} ${MONTHS_SHORT[dObj.getMonth()]}`;
}

export function weekdayLabel(date?: Date | string | number | null): string {
  const dObj = normalizeToDate(date);
  if (!dObj) return "-";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dObj.getDay()];
}

export function formatINR(amount?: number | null): string {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Format an ISO date string (backend timestamps) as `19 Aug 2026`. */
export function formatISODate(
  value?: string | Date | null,
  fallback = "-",
): string {
  if (!value) return fallback;
  const date = normalizeToDate(value);
  if (!date) return String(value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format a Razorpay amount (stored in the currency's smallest unit — paise for
 * INR) as a human-readable INR string.
 */
export function formatINRPaise(paise?: number | null): string {
  const value = Number(paise || 0);
  return formatINR(value / 100);
}

/** First name for greetings. */
export function firstName(value?: string): string {
  return value?.trim().split(/\s+/)[0] || "";
}

/**
 * First name for patient greetings, safely stripping accidental or duplicate "Dr."
 * prefixes for normal patients so they are never greeted as "Dr.".
 */
export function cleanPatientFirstName(name?: string, isDoctor = false): string {
  if (!name) return "";
  let cleaned = name.trim();
  if (!isDoctor) {
    cleaned = cleaned.replace(/^dr\.?\s+/i, "");
  }
  return cleaned.split(/\s+/)[0] || "";
}

/**
 * Normalizes any doctor's display name to ensure exactly one "Dr." prefix.
 *
 * Rules:
 *  - "Krishan Desai"        → "Dr. Krishan Desai"
 *  - "Dr. Krishan Desai"    → "Dr. Krishan Desai"
 *  - "Dr. Dr. Ketul Parmar" → "Dr. Ketul Parmar"
 *  - "Dr. Dr.Ketul Parmar"  → "Dr. Ketul Parmar"
 *  - "DR. Devid Miller"     → "Dr. Devid Miller"
 *  - "dr mehul"             → "Dr. Mehul"
 *  - "Doctor" / "" / null   → fallback (default: "Doctor")
 */
export function formatDoctorName(
  rawName?: string | null,
  fallback = "Doctor",
): string {
  if (!rawName || typeof rawName !== "string") return fallback;
  const trimmed = rawName.trim();
  if (!trimmed) return fallback;

  // Repeatedly strip any leading variants of "dr", "dr.", "dr ", case-insensitively
  let cleanName = trimmed;
  while (/^(dr\.?|dr\b)\s*/i.test(cleanName)) {
    cleanName = cleanName.replace(/^(dr\.?|dr\b)\s*/i, "").trim();
  }

  if (!cleanName || cleanName.toLowerCase() === "doctor") {
    return fallback;
  }
  return `Dr. ${cleanName}`;
}

/**
 * Strips all "Dr." / "Dr" / "DR." prefixes from a doctor's name.
 * e.g. "Dr. Dr. Ketul Parmar" → "Ketul Parmar"
 */
export function stripDoctorTitle(rawName?: string | null): string {
  if (!rawName || typeof rawName !== "string") return "";
  let cleanName = rawName.trim();
  while (/^(dr\.?|dr\b)\s*/i.test(cleanName)) {
    cleanName = cleanName.replace(/^(dr\.?|dr\b)\s*/i, "").trim();
  }
  return cleanName;
}

/**
 * Cleans any duplicate "Dr. Dr." or "Dr Dr." occurrences inside notification or
 * body text strings.
 */
export function cleanDuplicateDoctorTitle(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\bDr\.?\s+Dr\.?\s*/gi, "Dr. ");
}
