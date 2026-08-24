import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { isValidStrongPassword, PASSWORD_HELP } from '@/lib/validation';
import { toErrorMessage } from '@/services/api';
import { updatePassword } from '@/services/auth';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    setSuccess(false);
    if (!oldPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!isValidStrongPassword(newPassword)) {
      setError(PASSWORD_HELP);
      return;
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (!user?._id) return;
    setSaving(true);
    try {
      await updatePassword(user._id, { oldPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to change password. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Change password</Text>
          </View>
        </View>

        {success ? (
          <FormMessage type="success" message="Password updated successfully." />
        ) : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        <Input
          label="Current password"
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          placeholder="••••••••"
          containerStyle={{ marginTop: Spacing.lg }}
        />
        <Input
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Create a new password"
        />
        <Input
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Repeat your new password"
        />

        <Button title="Update password" onPress={submit} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
  },
});