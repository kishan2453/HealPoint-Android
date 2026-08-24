import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { HealPointLogo } from '@/components/HealPointLogo';
import { OrDivider } from '@/components/OrDivider';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { homeRouteForRole } from '@/lib/roles';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { isValidEmail, isNonEmpty } from '@/lib/validation';
import { ApiClientError, toErrorMessage } from '@/services/api';
import { isGoogleSignInConfigured, useGoogleSignIn } from '@/services/google';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithToken } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Show a friendly confirmation when the user just created an account.
  useEffect(() => {
    if (registered === '1') {
      setGeneralError('');
      setSuccessMessage('Account created successfully. Please login to continue.');
    }
  }, [registered]);

  // Google Sign-In lifecycle: persist the issued session, then route by role.
  useEffect(() => {
    if (google.status.status === 'success') {
      const { token, user } = google.status.response;
      setGeneralError('');
      signInWithToken(token, user)
        .then(() => router.replace(homeRouteForRole(user?.role)))
        .catch(() => setGeneralError('Unable to complete Google Sign-In. Please try again.'));
    } else if (google.status.status === 'error') {
      setGeneralError(google.status.message);
    } else if (google.status.status === 'not_configured') {
      setGeneralError('Google Sign-In is currently unavailable. Please use email & password to continue.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.status]);

  const googleConfigured = isGoogleSignInConfigured();

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!isNonEmpty(email) || !isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isNonEmpty(password)) errors.password = 'Password is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // Guard against duplicate submissions while a request is already in flight.
    if (loading || googleLoading) return;
    setGeneralError('');
    setSuccessMessage('');
    if (!validate()) return;
    setLoading(true);
    try {
      const loggedInUser = await signIn(email.trim(), password);
      // Go straight to the role-appropriate dashboard (never back to "/").
      router.replace(homeRouteForRole(loggedInUser?.role));
    } catch (error) {
      if (error instanceof ApiClientError && error.category === 'UNAUTHORIZED') {
        setGeneralError('Email or password is incorrect.');
      } else {
        setGeneralError(toErrorMessage(error, 'Unable to login. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGeneralError('');
    setSuccessMessage('');
    google.signIn();
  };

  const googleLoading = google.status.status === 'loading';
  const submitDisabled = loading || googleLoading;

  return (
    <AuthShell>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={72} badge />
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Login to manage your appointments and health.</Text>
        </View>

        <View style={styles.formCard}>
          {generalError ? <FormMessage type="error" message={generalError} /> : null}
          {successMessage ? <FormMessage type="success" message={successMessage} /> : null}

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
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

          <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgotRow} hitSlop={8}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <Button
            title="Login"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            icon="log-in-outline"
          />

          {googleConfigured ? (
            <>
              <OrDivider />
              <GoogleSignInButton onPress={handleGoogle} loading={googleLoading} disabled={loading} />
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to HealPoint?</Text>
          <Pressable onPress={() => router.push('/register')} hitSlop={8} style={styles.footerButton}>
            <Text style={styles.footerLink}>Create account</Text>
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
  heading: {
    ...Typography.h1,
    color: Palette.text,
    marginTop: Spacing.lg,
    letterSpacing: -0.5,
  },
  subheading: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 300,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
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