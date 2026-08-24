import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import { resetPassword } from '@/services/auth';
import { isValidStrongPassword, PASSWORD_HELP } from '@/lib/validation';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (params.token || '').trim();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setFieldError('');
    if (!token) {
      setError('This reset link is invalid. Please start the reset flow again.');
      return;
    }
    if (!isValidStrongPassword(newPassword)) {
      setFieldError(PASSWORD_HELP);
      return;
    }
    if (newPassword !== confirm) {
      setFieldError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ resetToken: token, newPassword });
      router.replace('/login');
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to reset your password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={60} badge />
          <Text style={styles.heading}>Set a new password</Text>
          <Text style={styles.subheading}>Choose a strong password you haven&apos;t used before.</Text>
        </View>

        <View style={styles.formCard}>
          {error ? <FormMessage type="error" message={error} /> : null}

          <Input
            label="New password"
            placeholder="Create a new password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            error={fieldError}
            variant="filled"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />
          <Input
            label="Confirm new password"
            placeholder="Repeat your new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            leftIcon="lock-closed-outline"
            variant="filled"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={8}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          <Button title="Reset password" onPress={handleSubmit} loading={loading} icon="checkmark-circle-outline" />
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heading: {
    ...Typography.h2,
    color: Palette.text,
    marginTop: Spacing.lg,
    letterSpacing: -0.4,
  },
  subheading: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 320,
  },
  formCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: AUTH_CARD_MAX_WIDTH,
    alignSelf: 'center',
    ...Shadows.card,
  },
  visibilityButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});