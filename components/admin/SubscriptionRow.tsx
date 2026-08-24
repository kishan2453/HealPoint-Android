/**
 * HealPoint - subscription row used in the Super Admin subscription table.
 * Compact, professional card-style row with plan, status, dates, amount and
 * payment status.
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
import { formatINR, formatISODate } from '@/lib/format';
import type { Subscription } from '@/types';

interface SubscriptionRowProps {
  item: Subscription;
  onPress?: () => void;
}

export function SubscriptionRow({ item, onPress }: SubscriptionRowProps) {
  const hospital = item.hospital || (typeof item.hospitalId === 'object' ? item.hospitalId : null);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {(hospital as { name?: string } | null)?.name || item.hospitalName || 'Hospital'}
            </Text>
            <View style={styles.planRow}>
              <Text style={styles.plan}>{item.planName || item.planKey || 'Plan'}</Text>
              <StatusBadge value={item.status} variant={subscriptionStatusBadge(item.status)} />
            </View>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} /> : null}
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
            <Text style={styles.metaLabel}>Amount</Text>
            <Text style={styles.metaValue}>{formatINR(item.amount)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment</Text>
            <Badge label={String(item.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(item.paymentStatus)} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.cycle}>
            {item.billingCycle === 'yearly' ? 'Yearly' : item.billingCycle === 'monthly' ? 'Monthly' : item.billingCycle || '—'}
          </Text>
          <Text style={styles.autoRenew}>{item.autoRenew ? 'Auto-renew ON' : 'Auto-renew OFF'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleWrap: { flex: 1, gap: Spacing.xs },
  name: { ...Typography.h4, color: Palette.text },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  plan: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
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
  cycle: { ...Typography.caption, color: Palette.textMuted },
  autoRenew: { ...Typography.caption, color: Palette.textMuted },
});