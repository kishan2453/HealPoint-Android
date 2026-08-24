/**
 * HealPoint - Hospital Admin · Hospital Profile.
 * Reads the live hospital from /hospital-admin/dashboard and lets the admin
 * update basic profile fields (about, OPD timings) via /hospital-admin/profile.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { Hospital } from '@/types';

export default function HospitalAdminProfileScreen() {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [about, setAbout] = useState('');
  const [opdTimings, setOpdTimings] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalAdminDashboard();
      setHospital(res.hospital || null);
      setAbout(res.hospital?.about || '');
      setOpdTimings(res.hospital?.opdTimings || '');
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load hospital profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await adminService.updateHospitalProfile({ about, opdTimings });
      await load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to save profile.'));
    } finally {
      setSaving(false);
    }
  };

  const location = hospital?.location;
  const contact = hospital?.contact;

  return (
    <AdminModuleScreen
      title="Hospital Profile"
      subtitle="Your hospital information"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card padded>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{hospital?.name || 'Hospital'}</Text>
              {hospital?.isActive ? <Badge label="Active" variant="success" /> : <Badge label="Inactive" variant="neutral" />}
            </View>
            <Text style={styles.muted}>
              {[location?.address, location?.city, location?.state, location?.pincode].filter(Boolean).join(', ') || 'Location not set'}
            </Text>
            <Text style={styles.muted}>{contact?.email || 'No email'} · {contact?.reception || 'No phone'}</Text>
          </Card>

          <Card padded>
            <Text style={styles.sectionTitle}>Edit details</Text>
            <Text style={styles.label}>About</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={about}
              onChangeText={setAbout}
              placeholder="Hospital description..."
              multiline
            />
            <Text style={styles.label}>OPD timings</Text>
            <TextInput
              style={styles.input}
              value={opdTimings}
              onChangeText={setOpdTimings}
              placeholder="Mon - Sat, 09:00 AM - 06:00 PM"
            />
            <Button title="Save changes" onPress={save} loading={saving} style={styles.saveButton} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.h4, color: Palette.text, flex: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted, marginTop: Spacing.xs },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.sm },
  label: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600', marginTop: Spacing.sm },
  input: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, color: Palette.text, backgroundColor: Palette.surface },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  saveButton: { marginTop: Spacing.lg },
});