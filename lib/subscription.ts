/**
 * HealPoint - subscription presentation helpers (Super Admin portal).
 *
 * All durations, remaining days and prices are derived from REAL backend
 * fields (startDate, expiryDate, amount, billingCycle) - nothing is invented.
 * The helper surfaces "Expiring soon" only when the expiry date actually
 * exists and the subscription is still active/trial.
 */
import { formatINR } from '@/lib/format';
import type { Subscription, SubscriptionBillingCycle } from '@/types';

/** A subscription is considered "expiring soon" within this many days of its expiry date. */
export const EXPIRING_SOON_DAYS = 30;

/** Fallback marker used when a value is missing (plain ASCII hyphen). */
const DASH = '-';

/** Label for the backend billing cycle value. Supports the platform's real duration values. */
export function billingCycleLabel(cycle?: SubscriptionBillingCycle | string): string {
  const value = String(cycle || '').trim().toLowerCase();
  switch (value) {
    case 'monthly': return '1 Month';
    case 'yearly': return '1 Year';
    case 'none': return DASH;
    default: return cycle || DASH;
  }
}

/** Whole days from today until the given ISO date. Negative = past; null = no date. */
export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

/** Human readable remaining-time label for an expiry date. */
export function remainingDaysLabel(value?: string | null, fallback = DASH): string {
  const days = daysUntil(value);
  if (days === null) return fallback;
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  return `Expires in ${days}d`;
}

/** True only for active/trial subscriptions whose expiry date is within the window. */
export function isExpiringSoon(sub: { status?: string; expiryDate?: string }): boolean {
  const status = String(sub.status || '').toLowerCase();
  if (status !== 'active' && status !== 'trial') return false;
  const days = daysUntil(sub.expiryDate);
  return days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS;
}

/** The subscription's duration computed from the real start/expiry dates. */
export function subscriptionDurationLabel(startDate?: string, expiryDate?: string): string {
  if (!startDate || !expiryDate) return DASH;
  const start = new Date(startDate);
  const end = new Date(expiryDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return DASH;
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (days <= 0) return DASH;
  if (days < 31) return days === 1 ? '1 day' : `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.round(months / 12);
  return months % 12 === 0 ? (years === 1 ? '1 year' : `${years} years`) : `${months} months`;
}

/** Price label like `Rs.999 / month` using the subscription's real amount + cycle. */
export function planPriceLabel(sub: Subscription): string {
  const value = Number(sub.amount || 0);
  if (value <= 0) return 'Rs.0';
  if ((sub.billingCycle || '').toLowerCase() === 'yearly') return `${formatINR(value)} / year`;
  return `${formatINR(value)} / month`;
}

/** The most reliable hospital id for a subscription record. */
export function subscriptionHospitalId(sub: Subscription): string | null {
  if (typeof sub.hospital === 'object' && sub.hospital?._id) return String(sub.hospital._id);
  if (typeof sub.hospitalId === 'object' && sub.hospitalId?._id) return String(sub.hospitalId._id);
  if (typeof sub.hospitalId === 'string') return String(sub.hospitalId);
  if (typeof sub.hospital === 'string') return String(sub.hospital);
  return null;
}