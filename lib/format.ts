/**
 * HealPoint - presentation helpers.
 */

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format a JS Date as the backend's `DD-MM-YYYY` slot format. */
export function toDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getFullYear()}`;
}

/** Human-friendly display from a `DD-MM-YYYY` string -> e.g. `19 Aug 2026`. */
export function formatDDMMYYYY(value?: string, fallback = '-'): string {
  if (!value) return fallback;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return value;
  const [, dd, mm, yyyy] = match;
  const monthIndex = Number(mm) - 1;
  const month = MONTHS_SHORT[monthIndex] || mm;
  return `${Number(dd)} ${month} ${yyyy}`;
}

/** `24 Aug` style label for a date row in the date picker. */
export function dateLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function weekdayLabel(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

export function formatINR(amount?: number | null): string {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString('en-IN')}`;
}

/** Format an ISO date string (backend timestamps) as `19 Aug 2026`. */
export function formatISODate(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
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
  return value?.trim().split(/\s+/)[0] || '';
}