/**
 * HealPoint - Super Admin · Subscription Plans.
 * View + secure CRUD for the platform plan catalog. Prices/features live in the
 * database (never hard-coded in this frontend).
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as subscriptionService from '@/services/subscriptions';
import type { SubscriptionPlan } from '@/types';

const EMPTY_FORM = {
  key: '',
  name: '',
  monthlyPrice: '',
  yearlyPrice: '',
  features: '',
  trialDays: '',
  sortOrder: '',
};

export default function SuperAdminPlansScreen() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await subscriptionService.getPlans();
      setPlans(res.plans || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load plans.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = (plan: SubscriptionPlan | null) => {
    setEditing(plan);
    setForm(
      plan
        ? {
            key: plan.key,
            name: plan.name,
            monthlyPrice: String(plan.monthlyPrice ?? ''),
            yearlyPrice: String(plan.yearlyPrice ?? ''),
            features: (plan.features || []).join(', '),
            trialDays: String(plan.trialDays ?? ''),
            sortOrder: String(plan.sortOrder ?? ''),
          }
        : EMPTY_FORM,
    );
    setEditorOpen(true);
  };

  const savePlan = async () => {
    if (!form.name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        monthlyPrice: Number(form.monthlyPrice) || 0,
        yearlyPrice: Number(form.yearlyPrice) || 0,
        trialDays: Number(form.trialDays) || 0,
        sortOrder: Number(form.sortOrder) || 0,
        features: form.features.split(',').map((item) => item.trim()).filter(Boolean),
      };
      if (editing) {
        await subscriptionService.updatePlan(editing._id, payload);
      } else {
        if (!form.key.trim()) {
          setError('Plan key is required for new plans.');
          setSaving(false);
          return;
        }
        await subscriptionService.createPlan({ key: form.key.trim().toLowerCase(), ...payload, isActive: true });
      }
      setEditorOpen(false);
      load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to save plan.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (plan: SubscriptionPlan) => {
    try {
      await subscriptionService.togglePlan(plan._id, !plan.isActive);
      load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to update plan status.'));
    }
  };
  return (
    <AdminModuleScreen
      title="Subscription Plans"
      subtitle="Platform plan catalog stored in the database"
      loading={loading}
      error={error}
      onRetry={load}
      right={
        <Pressable onPress={() => openEditor(null)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={Palette.white} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {plans.map((plan) => (
          <Card key={plan._id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planTitleWrap}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.badges}>
                  {plan.isActive ? <Badge label="Active" variant="success" /> : <Badge label="Inactive" variant="neutral" />}
                  <Badge label={`${plan.subscriberCount ?? 0} hospital(s)`} variant="primary" />
                </View>
              </View>
              <Ionicons name={plan.key === 'free' ? 'gift-outline' : 'pricetag-outline'} size={28} color={Palette.primary} />
            </View>
            <View style={styles.prices}>
              <Text style={styles.price}>{formatINR(plan.monthlyPrice)}<Text style={styles.pricePeriod}>/mo</Text></Text>
              <Text style={styles.price}>{formatINR(plan.yearlyPrice)}<Text style={styles.pricePeriod}>/yr</Text></Text>
            </View>
            {(plan.features || []).map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={17} color={Palette.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            <View style={styles.planActions}>
              <Button title="Edit" variant="outline" fullWidth={false} style={styles.planActionBtn} onPress={() => openEditor(plan)} />
              <Button
                title={plan.isActive ? 'Deactivate' : 'Activate'}
                variant={plan.isActive ? 'secondary' : 'primary'}
                fullWidth={false}
                style={styles.planActionBtn}
                onPress={() => toggle(plan)}
              />
            </View>
          </Card>
        ))}
        <Button title="Create new plan" variant="secondary" icon="add-circle-outline" onPress={() => openEditor(null)} />
      </ScrollView>
      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? `Edit ${editing.name}` : 'Create plan'}</Text>
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Plan key {editing ? `(${editing.key})` : ''}*</Text>
              <TextInput
                style={styles.input}
                value={form.key}
                onChangeText={(text) => setForm((prev) => ({ ...prev, key: text }))}
                placeholder="e.g. premium"
                editable={!editing}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.label}>Name*</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))} placeholder="Premium" />
              <View style={styles.twoCol}>
                <View style={styles.twoColItem}>
                  <Text style={styles.label}>Monthly price (₹)</Text>
                  <TextInput style={styles.input} value={form.monthlyPrice} onChangeText={(text) => setForm((prev) => ({ ...prev, monthlyPrice: text }))} keyboardType="numeric" placeholder="4999" />
                </View>
                <View style={styles.twoColItem}>
                  <Text style={styles.label}>Yearly price (₹)</Text>
                  <TextInput style={styles.input} value={form.yearlyPrice} onChangeText={(text) => setForm((prev) => ({ ...prev, yearlyPrice: text }))} keyboardType="numeric" placeholder="49990" />
                </View>
              </View>
              <Text style={styles.label}>Trial days</Text>
              <TextInput style={styles.input} value={form.trialDays} onChangeText={(text) => setForm((prev) => ({ ...prev, trialDays: text }))} keyboardType="numeric" placeholder="14" />
              <Text style={styles.label}>Features (comma-separated)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.features}
                onChangeText={(text) => setForm((prev) => ({ ...prev, features: text }))}
                placeholder="Unlimited doctors, Priority support"
                multiline
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" fullWidth={false} style={styles.modalActionBtn} onPress={() => setEditorOpen(false)} disabled={saving} />
              <Button title={editing ? 'Save changes' : 'Create plan'} fullWidth={false} style={styles.modalActionBtn} onPress={savePlan} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  addButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  planCard: { gap: Spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  planTitleWrap: { flex: 1, gap: Spacing.xs },
  planName: { ...Typography.h4, color: Palette.text },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  prices: { flexDirection: 'row', gap: Spacing.xl },
  price: { ...Typography.h4, color: Palette.text },
  pricePeriod: { ...Typography.caption, color: Palette.textMuted },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  featureText: { ...Typography.bodySmall, color: Palette.textMuted, flex: 1 },
  planActions: { flexDirection: 'row', gap: Spacing.sm },
  planActionBtn: { flex: 1, minHeight: 44 },
  backdrop: { flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { ...Typography.h4, color: Palette.text },
  form: { maxHeight: 420, gap: Spacing.sm },
  label: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600', marginTop: Spacing.xs },
  input: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, color: Palette.text, backgroundColor: Palette.surface },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  twoColItem: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalActionBtn: { flex: 1 },
});