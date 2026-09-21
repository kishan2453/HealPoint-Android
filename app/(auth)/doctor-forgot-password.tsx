import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { isValidEmail, isNonEmpty } from '@/lib/validation';
import { ApiClientError, toErrorMessage } from '@/services/api';
import { doctorForgotPassword } from '@/services/auth';

export default function DoctorForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setMessage('');
    const value = email.trim();
    if (!isNonEmpty(value)) {
      setError('Please enter your registered doctor email.');
      return;
    }
    if (!isValidEmail(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await doctorForgotPassword(value);
      // Backend returns the REAL next step for doctor accounts (admin-desk
      // password issuance) — we never fake an email-sent success.
      setMessage(res.message || 'Password reset request received.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.category === 'NETWORK' || err.category === 'TIMEOUT') {
          setError('Unable to connect to HealPoint. Please try again.');
        } else {
          setError(err.serverMessage || toErrorMessage(err, 'Unable to process your request.'));
        }
      } else {
        setError(toErrorMessage(err, 'Unable to process your request.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell brand="doctor" showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={60} badge />
          <Text style={styles.badgeText}>HealPoint Doctor Portal</Text>
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subheading}>
            Enter the registered doctor email to verify your account. New passwords are issued at the
            hospital admin desk.
          </Text>
        </View>

        <View style={styles.formCard}>
          {error ? <FormMessage type="error" message={error} /> : null}
          {message ? <FormMessage type="success" message={message} /> : null}

          <Input
            label="Doctor email"
            placeholder="doctor@hospital.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
            variant="filled"
          />

          <Button
            title="Request password reset"
            onPress={handleSubmit}
            loading={loading}
            icon="paper-plane-outline"
          />

          <Button
            title="Back to login"
            variant="ghost"
            onPress={() => router.replace('/doctor-login' as never)}
          />
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
  badgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
  },
  heading: {
    ...Typography.h2,
    color: Palette.text,
    marginTop: Spacing.xs,
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
    ...Shadows.card,
  },
});