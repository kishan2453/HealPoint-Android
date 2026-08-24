/**
 * HealPoint - Hospital Admin · Subscription & Billing.
 * Shows ONLY this hospital's subscription (server-enforced: /subscription/my).
 * Hospital Admins have no management powers here — every mutation on the
 * subscription is Super Admin only.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import {
  paymentStatusBadge,
  StatusBadge,
  subscriptionStatusBadge,
} from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as subscriptionService from '@/services/subscriptions';
import type { Subscription } from '@/types';

export default function AdminSubscriptionScreen() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await subscriptionService.getMySubscription();
      setSubscription(res.subscription);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load your subscription.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hospitalName =
    subscription?.hospital && typeof subscription.hospital === 'object'
      ? subscription.hospital.name
      : subscription?.hospitalName || 'Your hospital';

  return (
    <AdminModuleScreen
      title="Subscription & Billing"
      subtitle="Your hospital's plan (view only)"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
{subscription ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card padded>
            <Text style={styles.hospitalName}>{hospitalName}</Text>
            <Text style={styles.muted}>Managed by the platform. Contact the Super Admin for plan changes.</Text>
            <View style={styles.badges}>
              <StatusBadge value={subscription.status} variant={subscriptionStatusBadge(subscription.status)} />
              <Badge label={String(subscription.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(subscription.paymentStatus)} />
            </View>
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Your plan</Text>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Plan</Text><Text style={styles.detailValue}>{subscription.planName || subscription.planKey || '—'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.detailValue}>{String(subscription.status).replace(/_/g, ' ')}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Start date</Text><Text style={styles.detailValue}>{formatISODate(subscription.startDate)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Renewal / Expiry</Text><Text style={styles.detailValue}>{formatISODate(subscription.expiryDate)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount</Text><Text style={styles.detailValue}>{formatINR(subscription.amount)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Billing cycle</Text><Text style={styles.detailValue}>{subscription.billingCycle === 'yearly' ? 'Yearly' : subscription.billingCycle === 'monthly' ? 'Monthly' : subscription.billingCycle || '—'}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Auto-renew</Text><Text style={styles.detailValue}>{subscription.autoRenew ? 'On' : 'Off'}</Text></View>
          </Card>

          {subscription.planDetails ? (
            <Card padded>
              <Text style={styles.sectionTitle}>Plan benefits</Text>
              {(subscription.planDetails.features || []).map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Palette.success} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {(subscription.planDetails.features || []).length === 0 ? (
                <Text style={styles.muted}>No features listed for this plan.</Text>
              ) : null}
            </Card>
          ) : null}

          <Card padded>
            <Text style={styles.sectionTitle}>Subscription history</Text>
            {(subscription.history || []).length === 0 ? (
              <Text style={styles.muted}>No history recorded yet.</Text>
            ) : (
              (subscription.history || []).map((entry, index) => (
                <View key={String(entry._id || index)} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyTexts}>
                    <Text style={styles.historyAction}>
                      {String(entry.action || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    <Text style={styles.historyNote}>
                      {entry.note || ''} · {entry.changedByName || ''} · {formatISODate(entry.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      ) : null}
    </AdminModuleScreen>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  hospitalName: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted, marginTop: Spacing.xs },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text, textTransform: 'capitalize' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  featureText: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  historyRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.sm },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.primary, marginTop: 6 },
  historyTexts: { flex: 1, gap: 2 },
  historyAction: { ...Typography.bodyMedium, color: Palette.text },
  historyNote: { ...Typography.caption, color: Palette.textMuted },
});