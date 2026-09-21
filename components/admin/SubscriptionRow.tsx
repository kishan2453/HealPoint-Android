/**
 * HealPoint - subscription row used in the Super Admin subscription table.
 * Compact, professional card-style row with plan, price, status, dates,
 * duration, remaining days and payment status. Every value is derived from
 * the real backend subscription record — nothing is invented here.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  paymentStatusBadge,
  StatusBadge,
  subscriptionStatusBadge,
} from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import {
  billingCycleLabel,
  isExpiringSoon,
  planPriceLabel,
  remainingDaysLabel,
  subscriptionDurationLabel,
} from '@/lib/subscription';
import type { Subscription } from '@/types';

interface SubscriptionRowProps {
  item: Subscription;
  onPress?: () => void;
}

function subscriberEmail(item: Subscription): string | null {
  const hospital = item.hospital || (typeof item.hospitalId === 'object' ? item.hospitalId : null);
  const contact = (hospital as { contact?: { email?: string } } | null)?.contact?.email;
  const email = hospital && typeof hospital === 'object' ? (hospital as { email?: string } | null)?.email : undefined;
  return String(contact || email || '').trim() || null;
}

export function SubscriptionRow({ item, onPress }: SubscriptionRowProps) {
  const hospital = item.hospital || (typeof item.hospitalId === 'object' ? item.hospitalId : null);
  const expiringSoon = isExpiringSoon(item);
  const duration = subscriptionDurationLabel(item.startDate, item.expiryDate);
  const email = subscriberEmail(item);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {(hospital as { name?: string } | null)?.name || item.hospitalName || 'Hospital'}
            </Text>
            {email ? (
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
            <View style={styles.planRow}>
              <Text style={styles.plan} numberOfLines={1}>{item.planName || item.planKey || 'Plan'}</Text>
              <StatusBadge value={item.status} variant={subscriptionStatusBadge(item.status)} />
              {expiringSoon ? <Badge label="Expiring soon" variant="warning" /> : null}
            </View>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} /> : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceValue}>{planPriceLabel(item)}</Text>
          <Text style={styles.priceCycle}>{billingCycleLabel(item.billingCycle)}</Text>
          {duration !== '—' ? <Text style={styles.priceCycle}>· {duration}</Text> : null}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Start</Text>
            <Text style={styles.metaValue}>{formatISODate(item.startDate)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Renewal / Expiry</Text>
            <Text style={styles.metaValue}>{formatISODate(item.expiryDate)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Badge label={String(item.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(item.paymentStatus)} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.cycle} numberOfLines={1}>
            {remainingDaysLabel(item.expiryDate)} · {item.autoRenew ? 'Auto-renew ON' : 'Auto-renew OFF'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleWrap: { flex: 1, gap: Spacing.xs, minWidth: 0 },
  name: { ...Typography.h4, color: Palette.text },
  email: { ...Typography.caption, color: Palette.textMuted },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  plan: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600', flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  priceValue: { ...Typography.label, color: Palette.text },
  priceCycle: { ...Typography.caption, color: Palette.textMuted },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  metaCol: { flex: 1, minWidth: '40%', gap: 2 },
  metaLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { ...Typography.bodySmall, color: Palette.text },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycle: { ...Typography.caption, color: Palette.textMuted, flexShrink: 1 },
});