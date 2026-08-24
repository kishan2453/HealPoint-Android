import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { toErrorMessage } from '@/services/api';
import { verifyOtp } from '@/services/auth';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const identifier = (params.identifier || '').trim();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!identifier) {
      setError('Missing account identifier. Please start the reset flow again.');
      return;
    }
    if (otp.trim().length < 4) {
      setError('Please enter the OTP you received.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(identifier, otp.trim());
      router.replace({ pathname: '/reset-password', params: { token: res.resetToken } });
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to verify the OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={60} badge />
          <Text style={styles.heading}>Enter the OTP</Text>
          <Text style={styles.subheading}>
            We sent a one-time password to <Text style={styles.email}>{identifier || 'your account'}</Text>. It
            expires in 5 minutes.
          </Text>
        </View>

        <View style={styles.formCard}>
          {error ? <FormMessage type="error" message={error} /> : null}

          <Input
            label="One-time password"
            placeholder="••••••"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            leftIcon="keypad-outline"
            variant="filled"
          />

          <Button title="Verify OTP" onPress={handleSubmit} loading={loading} icon="shield-checkmark-outline" />
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
  email: {
    fontWeight: '600',
    color: Palette.primaryDark,
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