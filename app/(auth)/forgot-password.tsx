import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { forgotPassword } from '@/services/auth';
import { toErrorMessage } from '@/services/api';
import { isValidEmail } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    const value = identifier.trim();
    if (!value) {
      setError('Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(value);
      router.push({ pathname: '/verify-otp', params: { identifier: value } });
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to send the OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={60} badge />
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subheading}>
            Enter the email address linked to your account and we&apos;ll send you a one-time password (OTP).
          </Text>
        </View>

        <View style={styles.formCard}>
          {error ? <FormMessage type="error" message={error} /> : null}

          <Input
            label="Email address"
            placeholder="you@example.com"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
            variant="filled"
          />

          <Button title="Send OTP" onPress={handleSubmit} loading={loading} icon="paper-plane-outline" />
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
});