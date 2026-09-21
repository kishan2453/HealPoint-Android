import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HospitalSelect } from '@/components/doctor/HospitalSelect';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { homeRouteForRole } from '@/lib/roles';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { isValidEmail, isNonEmpty } from '@/lib/validation';
import { ApiClientError, toErrorMessage } from '@/services/api';
import type { Hospital } from '@/types';

export default function DoctorLoginScreen() {
  const router = useRouter();
  const { signInAsDoctor } = useAuth();
  const { registered, email: prefillEmail } = useLocalSearchParams<{
    registered?: string;
    email?: string;
  }>();

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    hospital?: string;
    email?: string;
    password?: string;
  }>({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Friendly confirmation + email prefill after a successful doctor signup.
  useEffect(() => {
    if (registered === '1') {
      setGeneralError('');
      setSuccessMessage(
        'Account created. Your profile is pending hospital admin verification — you can sign in once it is approved.',
      );
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
      setPassword('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered, prefillEmail]);

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!hospital?._id) errors.hospital = 'Please select your hospital.';
    if (!isNonEmpty(email) || !isValidEmail(email)) errors.email = 'Enter a valid doctor email address';
    if (!isNonEmpty(password)) errors.password = 'Password is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (loading) return;
    setGeneralError('');
    setSuccessMessage('');
    if (!validate()) return;
    if (!hospital?._id) return;

    setLoading(true);
    try {
      const doctor = await signInAsDoctor(email.trim(), password, hospital._id);
      router.replace(homeRouteForRole(doctor?.role));
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.category === 'FORBIDDEN') {
          // Backend sends precise reasons: wrong hospital, inactive or
          // suspended account. NEVER swallow them into a generic error.
          setGeneralError(
            error.serverMessage || 'Your doctor account cannot sign in right now.',
          );
        } else if (error.category === 'UNAUTHORIZED' || error.category === 'NOT_FOUND') {
          setGeneralError('Invalid doctor email or password.');
        } else if (error.category === 'NETWORK' || error.category === 'TIMEOUT') {
          setGeneralError('Unable to connect to HealPoint. Please try again.');
        } else {
          setGeneralError(toErrorMessage(error, 'Unable to login. Please try again.'));
        }
      } else {
        setGeneralError(toErrorMessage(error, 'Unable to login. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell brand="doctor" showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={72} badge />
          <Text style={styles.badgeText}>HealPoint Doctor Portal</Text>
          <Text style={styles.heading}>Welcome back, Doctor</Text>
          <Text style={styles.subheading}>
            Sign in with the hospital you are registered at to manage appointments and patients.
          </Text>
        </View>

        <View style={styles.formCard}>
          {generalError ? <FormMessage type="error" message={generalError} /> : null}
          {successMessage ? <FormMessage type="success" message={successMessage} /> : null}

          <HospitalSelect
            label="Hospital"
            placeholder="Select your hospital"
            value={hospital?._id || ''}
            error={fieldErrors.hospital}
            onChange={(next) => {
              setHospital(next);
              setFieldErrors((errors) => ({ ...errors, hospital: undefined }));
            }}
          />

          <Input
            label="Doctor Email"
            placeholder="doctor@hospital.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((errors) => ({ ...errors, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            leftIcon="mail-outline"
            error={fieldErrors.email}
            variant="filled"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((errors) => ({ ...errors, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            textContentType="password"
            leftIcon="lock-closed-outline"
            error={fieldErrors.password}
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

          <Pressable
            onPress={() => router.push('/doctor-forgot-password' as never)}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <Button
            title="Sign In"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            icon="log-in-outline"
          />
          <Text style={styles.loadingHint}>
            {loading ? 'Signing in…' : ''}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have a doctor account?</Text>
          <Pressable
            onPress={() => router.push('/doctor-signup' as never)}
            hitSlop={8}
            style={styles.footerButton}
          >
            <Text style={styles.footerLink}>Create Doctor Account</Text>
            <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
          </Pressable>
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
    ...Typography.h1,
    color: Palette.text,
    marginTop: Spacing.xs,
    letterSpacing: -0.5,
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.xs,
  },
  link: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: '600',
  },
  loadingHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  footerText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLink: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: '700',
  },
});