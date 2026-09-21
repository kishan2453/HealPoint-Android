/**
 * HealPoint - Super Admin · Subscription Details.
 * Full view of one hospital subscription + authorized lifecycle actions.
 * Backend enforces Super Admin for every mutation here.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import {
  paymentStatusBadge,
  StatusBadge,
  subscriptionStatusBadge,
} from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatISODate } from '@/lib/format';
import {
  isExpiringSoon,
  remainingDaysLabel,
  subscriptionDurationLabel,
} from '@/lib/subscription';
import { toErrorMessage } from '@/services/api';
import * as subscriptionService from '@/services/subscriptions';
import type { Subscription, SubscriptionPlan } from '@/types';

type ActionType = 'activate' | 'suspend' | 'cancel' | 'paid' | 'renew' | 'extend' | 'changePlan';

export default function SuperAdminSubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [detailRes, plansRes] = await Promise.all([
        subscriptionService.getSubscriptionDetails(id),
        subscriptionService.getPlans(),
      ]);
      setSubscription(detailRes.subscription);
      setPlans(plansRes.plans || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load subscription.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async () => {
    if (!subscription || !pendingAction) return;
    setActionLoading(true);
    setError('');
    setActionError('');
    setNotice('');
    try {
      if (pendingAction === 'activate') {
        const res = await subscriptionService.activateSubscription(subscription._id);
        setSubscription(res.subscription);
        setNotice('Subscription activated.');
      } else if (pendingAction === 'suspend') {
        const res = await subscriptionService.suspendSubscription(subscription._id);
        setSubscription(res.subscription);
        setNotice('Subscription suspended.');
      } else if (pendingAction === 'cancel') {
        const res = await subscriptionService.cancelSubscription(subscription._id);
        setSubscription(res.subscription);
        setNotice('Subscription cancelled.');
      } else if (pendingAction === 'paid') {
        const res = await subscriptionService.updateSubscriptionPaymentStatus(subscription._id, {
          paymentStatus: 'paid',
          amount: subscription.amount,
        });
        setSubscription(res.subscription);
        setNotice('Current cycle marked as paid.');
      } else if (pendingAction === 'renew') {
        const res = await subscriptionService.renewSubscription(subscription._id, {
          note: 'Renewed by Super Admin',
        });
        setSubscription(res.subscription);
        setNotice('Subscription renewed.');
      } else if (pendingAction === 'extend') {
        const res = await subscriptionService.extendSubscription(subscription._id, {
          days: 30,
          note: 'Extended by 30 days',
        });
        setSubscription(res.subscription);
        setNotice('Subscription extended by 30 days.');
      }
      setPendingAction(null);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Action failed.'));
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const changePlanTo = async (plan: SubscriptionPlan) => {
    if (!subscription) return;
    setActionLoading(true);
    setError('');
    setActionError('');
    setNotice('');
    try {
      const res = await subscriptionService.changeSubscriptionPlan(subscription._id, {
        planId: plan._id,
        planKey: plan.key,
        billingCycle: plan.key === 'free' ? 'none' : 'monthly',
      });
      setSubscription(res.subscription);
      setChangePlanOpen(false);
      setNotice(`Plan changed to ${plan.name}.`);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Plan change failed.'));
      setChangePlanOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const hospital = subscription?.hospital || (typeof subscription?.hospitalId === 'object' ? subscription.hospitalId : null);
  const hospitalName = (hospital as { name?: string } | null)?.name || subscription?.hospitalName || 'Hospital';
return (
    <AdminModuleScreen
      title="Subscription Details"
      subtitle={hospitalName}
      loading={loading}
      error={error}
      onRetry={load}
      right={
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={22} color={Palette.text} />
        </Pressable>
      }
    >
      {subscription ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrap}>
          {notice ? <FormMessage type="success" message={notice} /> : null}
          {actionError ? <FormMessage type="error" message={actionError} /> : null}

          <Card padded>
            <Text style={styles.hospitalName}>{hospitalName}</Text>
            <Text style={styles.muted}>
              {(hospital as { location?: { address?: string; city?: string } } | null)?.location?.address || ''}
            </Text>
            <View style={styles.badges}>
              <StatusBadge value={subscription.status} variant={subscriptionStatusBadge(subscription.status)} />
              <Badge label={String(subscription.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(subscription.paymentStatus)} />
              {isExpiringSoon(subscription) ? <Badge label="Expiring soon" variant="warning" /> : null}
            </View>
            <Text style={styles.remaining}>{remainingDaysLabel(subscription.expiryDate)}</Text>
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Current subscription</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan</Text>
              <Text style={styles.detailValue}>{subscription.planName || subscription.planKey || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Start date</Text>
              <Text style={styles.detailValue}>{formatISODate(subscription.startDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Renewal / Expiry</Text>
              <Text style={styles.detailValue}>{formatISODate(subscription.expiryDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>{formatINR(subscription.amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Billing cycle</Text>
              <Text style={styles.detailValue}>
                {subscription.billingCycle === 'yearly' ? 'Yearly' : subscription.billingCycle === 'monthly' ? 'Monthly' : subscription.billingCycle || '—'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{subscriptionDurationLabel(subscription.startDate, subscription.expiryDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Auto-renew</Text>
              <Text style={styles.detailValue}>{subscription.autoRenew ? 'On' : 'Off'}</Text>
            </View>
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionGrid}>
              <Button title="Change Plan" variant="secondary" fullWidth={false} style={styles.actionBtn} icon="swap-horizontal-outline" onPress={() => setChangePlanOpen(true)} />
              <Button title="Renew" variant="secondary" fullWidth={false} style={styles.actionBtn} icon="refresh-outline" onPress={() => setPendingAction('renew')} />
              <Button title="+30 days" variant="secondary" fullWidth={false} style={styles.actionBtn} icon="calendar-outline" onPress={() => setPendingAction('extend')} />
              <Button title="Activate" variant="secondary" fullWidth={false} style={styles.actionBtn} icon="play-outline" onPress={() => setPendingAction('activate')} />
              <Button title="Suspend" variant="outline" fullWidth={false} style={styles.actionBtn} icon="pause-outline" onPress={() => setPendingAction('suspend')} />
              <Button title="Mark Paid" variant="outline" fullWidth={false} style={styles.actionBtn} icon="checkmark-done-outline" onPress={() => setPendingAction('paid')} />
              <Button title="Cancel" variant="danger" fullWidth={false} style={styles.actionBtn} icon="close-circle-outline" onPress={() => setPendingAction('cancel')} />
            </View>
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
                      {entry.note || ''} · {entry.changedByName || 'Admin'} · {formatISODate(entry.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Payment history</Text>
            {(subscription.payments || []).length === 0 ? (
              <Text style={styles.muted}>No payment records yet.</Text>
            ) : (
              (subscription.payments || []).map((payment, index) => (
                <View key={String(payment._id || index)} style={styles.paymentRow}>
                  <View style={styles.paymentTexts}>
                    <Text style={styles.paymentAmount}>{formatINR(payment.amount)}</Text>
                    <Text style={styles.paymentDate}>
                      {payment.billingCycle} · {formatISODate(payment.createdAt)}
                    </Text>
                  </View>
                  <Badge label={String(payment.paymentStatus || 'pending')} variant={paymentStatusBadge(payment.paymentStatus)} />
                </View>
              ))
            )}
          </Card>
          </View>
        </ScrollView>
      ) : null}
      <ConfirmDialog
        visible={Boolean(pendingAction)}
        title={
          pendingAction === 'activate'
            ? 'Activate subscription?'
            : pendingAction === 'suspend'
              ? 'Suspend subscription?'
              : pendingAction === 'cancel'
                ? 'Cancel subscription?'
                : pendingAction === 'renew'
                  ? 'Renew subscription?'
                  : pendingAction === 'extend'
                    ? 'Extend subscription by 30 days?'
                    : 'Mark as paid?'
        }
        message={
          pendingAction === 'activate'
            ? 'This hospital subscription will be marked active.'
            : pendingAction === 'suspend'
              ? 'This hospital subscription will be temporarily suspended.'
              : pendingAction === 'cancel'
                ? 'This will permanently cancel the hospital subscription. The action is recorded.'
                : pendingAction === 'renew'
                  ? 'This will record a renewal for the hospital subscription.'
                  : pendingAction === 'extend'
                    ? 'This will add 30 days to the current expiry date.'
                    : 'Mark the current cycle payment as paid.'
        }
        confirmLabel={
          pendingAction === 'activate'
            ? 'Activate'
            : pendingAction === 'suspend'
              ? 'Suspend'
              : pendingAction === 'cancel'
                ? 'Cancel subscription'
                : pendingAction === 'renew'
                  ? 'Renew'
                  : pendingAction === 'extend'
                    ? 'Extend 30 days'
                    : 'Mark paid'
        }
        tone={pendingAction === 'cancel' ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />

      <Modal visible={changePlanOpen} transparent animationType="fade" onRequestClose={() => setChangePlanOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change subscription plan</Text>
            <Text style={styles.modalSubtitle}>Select the new plan for {hospitalName}.</Text>
            <ScrollView style={styles.modalList}>
              {plans.map((plan) => {
                const active = plan._id === subscription?.planId;
                return (
                  <Pressable
                    key={plan._id}
                    style={[styles.planOption, active && styles.planOptionActive]}
                    onPress={() => changePlanTo(plan)}
                    disabled={actionLoading}
                  >
                    <View style={styles.planOptionTexts}>
                      <Text style={styles.planOptionName}>{plan.name}</Text>
                      <Text style={styles.planOptionPrice}>
                        {formatINR(plan.monthlyPrice)}/mo · {formatINR(plan.yearlyPrice)}/yr
                      </Text>
                    </View>
                    {active ? <Badge label="Current" variant="primary" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title="Cancel" variant="outline" onPress={() => setChangePlanOpen(false)} disabled={actionLoading} />
          </View>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  contentWrap: { width: '100%', maxWidth: 1000, alignSelf: 'center', gap: Spacing.md },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hospitalName: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  remaining: { ...Typography.label, color: Palette.primaryDark, marginTop: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexGrow: 1, minWidth: 140, minHeight: 44 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  featureText: { ...Typography.bodySmall, color: Palette.text, flex: 1 },
  historyRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.sm },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.primary, marginTop: 6 },
  historyTexts: { flex: 1, gap: 2 },
  historyAction: { ...Typography.bodyMedium, color: Palette.text },
  historyNote: { ...Typography.caption, color: Palette.textMuted },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  paymentTexts: { flex: 1, gap: 2 },
  paymentAmount: { ...Typography.bodyMedium, color: Palette.text },
  paymentDate: { ...Typography.caption, color: Palette.textMuted },
  backdrop: { flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { width: '100%', maxWidth: 460, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalSubtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  modalList: { maxHeight: 360, gap: Spacing.sm },
  planOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  planOptionActive: { borderColor: Palette.primary, backgroundColor: Palette.primaryLight },
  planOptionTexts: { flex: 1, gap: 2 },
  planOptionName: { ...Typography.bodyMedium, color: Palette.text },
  planOptionPrice: { ...Typography.caption, color: Palette.textMuted },
});