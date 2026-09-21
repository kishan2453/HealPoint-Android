/**
 * HealPoint - Super Admin · System Settings.
 *
 * Real platform settings from GET/PATCH /settings (Super Admin only).
 * The supported field is the patient-side "How to Book a Doctor?" guide video
 * URL. Loading, error + retry, empty and success states are all handled.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import { getPlatformSettings, updatePlatformSettings } from '@/services/settings';

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function SystemSettingsScreen() {
  const [guideVideoUrl, setGuideVideoUrl] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPlatformSettings();
      setGuideVideoUrl(res.settings?.guideVideoUrl || '');
      setUpdatedAt(res.settings?.updatedAt);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load platform settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!isValidUrl(guideVideoUrl)) {
      setError('Please enter a valid http(s) URL, or leave it empty to hide the guide video.');
      setSuccess('');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await updatePlatformSettings({ guideVideoUrl: guideVideoUrl.trim() });
      setSuccess(res.message || 'Platform settings saved successfully.');
      setUpdatedAt(res.settings?.updatedAt);
      load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to save platform settings.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModuleScreen
      title="System Settings"
      subtitle="Platform configuration"
      loading={loading}
      error={error}
      onRetry={load}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card padded>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="videocam-outline" size={18} color={Palette.primaryDark} />
              </View>
              <Text style={styles.sectionTitle}>User-side guide video</Text>
            </View>
            <Text style={styles.sectionDescription}>
              This is the "How to Book a Doctor?" video shown to patients on the User Side. Paste a public
              YouTube or direct mp4 URL, or clear the field to hide the video player entirely.
            </Text>

            <Input
              label="Guide video URL"
              placeholder="https://example.com/guide.mp4"
              value={guideVideoUrl}
              onChangeText={(text) => {
                setGuideVideoUrl(text);
                setError('');
                setSuccess('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!saving}
              leftIcon="link-outline"
              containerStyle={styles.input}
            />
            <Text style={styles.hint}>Leave empty to hide the guide video from patients.</Text>

            {success ? <FormMessage type="success" message={success} /> : null}
            {error ? <FormMessage type="error" message={error} /> : null}

            <Button
              title="Save settings"
              variant="primary"
              icon="save-outline"
              loading={saving}
              onPress={save}
              style={styles.saveButton}
            />
          </Card>

          <Card padded>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#E7F1FE' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#1D5FA8" />
              </View>
              <Text style={styles.sectionTitle}>Access & security</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Who can edit</Text>
              <Text style={styles.detailValue}>Super Admin only</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last updated</Text>
              <Text style={styles.detailValue}>{updatedAt ? new Date(updatedAt).toLocaleString('en-IN') : 'Never'}</Text>
            </View>
            <Text style={styles.hint}>
              Settings are stored server-side and enforced by the backend. No secrets are ever exposed.
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </AdminModuleScreen>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...Typography.label, color: Palette.text, flex: 1 },
  sectionDescription: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20, marginBottom: Spacing.md },
  input: { marginBottom: Spacing.xs },
  hint: { ...Typography.caption, color: Palette.textMuted, marginBottom: Spacing.md },
  saveButton: { marginTop: Spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
    gap: Spacing.md,
  },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
});
