/**
 * HealPoint - status badge that maps backend status values to Badge colours.
 * Used across the Super Admin + Hospital Admin portals (subscription status,
 * doctor verification status, payment status...).
 */
import React from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';

type StatusValue = string | number | null | undefined;

const SUBSCRIPTION_STATUS: Record<string, BadgeVariant> = {
  trial: 'primary',
  active: 'success',
  past_due: 'warning',
  expired: 'error',
  cancelled: 'neutral',
  suspended: 'error',
};

const VERIFICATION_STATUS: Record<string, BadgeVariant> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'error',
  'correction requested': 'warning',
  suspended: 'error',
  blocked: 'error',
};

const PAYMENT_STATUS: Record<string, BadgeVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  refunded: 'neutral',
  'n/a': 'neutral',
};

const APPOINTMENT_STATUS: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'primary',
  completed: 'success',
  cancel: 'error',
  rescheduled: 'primary',
  missed: 'neutral',
};

function badgeFor(value: StatusValue, map: Record<string, BadgeVariant>): BadgeVariant {
  const key = String(value ?? '').trim().toLowerCase();
  return map[key] || 'neutral';
}

export function subscriptionStatusBadge(status: StatusValue): BadgeVariant {
  return badgeFor(status, SUBSCRIPTION_STATUS);
}

export function verificationStatusBadge(status: StatusValue): BadgeVariant {
  return badgeFor(status, VERIFICATION_STATUS);
}

export function paymentStatusBadge(status: StatusValue): BadgeVariant {
  return badgeFor(status, PAYMENT_STATUS);
}

export function appointmentStatusBadge(status: StatusValue): BadgeVariant {
  return badgeFor(status, APPOINTMENT_STATUS);
}

/** Badge variant for the normalized appointment-payment state (see lib/appointments). */
export function appointmentPaymentBadge(status: StatusValue): BadgeVariant {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    case 'refunded':
    case 'cancelled':
      return 'neutral';
    case 'cash':
      return 'primary';
    default:
      return 'neutral';
  }
}

export function formatStatusLabel(value: StatusValue): string {
  const text = String(value ?? 'Unknown').replace(/[_-]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface StatusBadgeProps {
  value: StatusValue;
  variant?: BadgeVariant;
}

export function StatusBadge({ value, variant }: StatusBadgeProps) {
  const resolvedVariant =
    variant ?? badgeFor(value, {
      ...SUBSCRIPTION_STATUS,
      ...VERIFICATION_STATUS,
      ...PAYMENT_STATUS,
      ...APPOINTMENT_STATUS,
    });
  return <Badge label={formatStatusLabel(value)} variant={resolvedVariant} />;
}