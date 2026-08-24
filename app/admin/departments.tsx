/**
 * HealPoint - Hospital Admin · Departments & Services.
 * Edit the departments and services of the admin's own hospital.
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

export default function AdminDepartmentsScreen() {
  const [departmentsText, setDepartmentsText] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalAdminDashboard();
      setDepartmentsText((res.hospital?.departments || []).join(', '));
      setServicesText((res.hospital?.services || []).join(', '));
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load hospital details.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toList = (text: string) => text.split(',').map((item) => item.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await adminService.updateHospitalProfile({
        departments: toList(departmentsText),
        services: toList(servicesText),
      });
      await load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to save changes.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Departments & Services"
      subtitle="Comma-separated lists shown on the public hospital profile"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card padded>
            <Text style={styles.sectionTitle}>Departments</Text>
            <View style={styles.badges}>
              {toList(departmentsText).map((item) => (
                <Badge key={item} label={item} variant="primary" />
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={departmentsText}
              onChangeText={setDepartmentsText}
              placeholder="Cardiology, Orthopedics, Pediatrics..."
              multiline
            />
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.badges}>
              {toList(servicesText).map((item) => (
                <Badge key={item} label={item} variant="success" />
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={servicesText}
              onChangeText={setServicesText}
              placeholder="Ambulance, ICU, 24x7 Emergency..."
              multiline
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  sectionTitle: { ...Typography.label, color: Palette.text, marginTop: Spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginVertical: Spacing.sm },
  input: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, color: Palette.text, backgroundColor: Palette.surface },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { marginTop: Spacing.lg },
});