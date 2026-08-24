import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { PASSWORD_HELP, isValidEmail, isValidStrongPassword } from '@/lib/validation';
import { toErrorMessage } from '@/services/api';
import { isGoogleSignInConfigured, useGoogleSignIn } from '@/services/google';

type Strength = { score: number; label: string; color: string };

function passwordStrength(value: string): Strength {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-z]/.test(value)) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (score <= 2) return { score, label: 'Weak', color: Palette.error };
  if (score <= 3) return { score, label: 'Fair', color: Palette.warning };
  return { score, label: 'Strong', color: Palette.success };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, signInWithToken } = useAuth();
  const google = useGoogleSignIn();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
    terms?: string;
  }>({});
  const [generalMessage, setGeneralMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Google Sign-In lifecycle.
  useEffect(() => {
    if (google.status.status === 'success') {
      const { token, user } = google.status.response;
      setGeneralMessage('');
      signInWithToken(token, user)
        .then(() => router.replace(homeRouteForRole(user?.role)))
        .catch(() => setGeneralMessage('Unable to complete Google Sign-In. Please try again.'));
    } else if (google.status.status === 'error') {
      setGeneralMessage(google.status.message);
    } else if (google.status.status === 'not_configured') {
      setGeneralMessage('Google Sign-In is currently unavailable. Please use email & password to continue.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.status]);

  const googleConfigured = isGoogleSignInConfigured();

  const strength = passwordStrength(password);
  const filledSegments = Math.max(0, Math.min(3, Math.round((strength.score / 5) * 3)));

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = 'Full name is required';
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isValidStrongPassword(password)) errors.password = PASSWORD_HELP;
    if (password !== confirm) errors.confirm = 'Passwords do not match';
    if (!accepted) errors.terms = 'Please accept the Terms & Privacy Policy to continue';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setGeneralMessage('');
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      router.replace({ pathname: '/login', params: { registered: '1' } });
    } catch (error) {
      setGeneralMessage(toErrorMessage(error, 'Unable to create account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGeneralMessage('');
    google.signIn();
  };

  const googleLoading = google.status.status === 'loading';
  const submitDisabled = loading || googleLoading;
  const fieldGroupGap = { gap: Spacing.sm };

  return (
    <AuthShell>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={64} badge />
          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.subheading}>Join HealPoint to book appointments and manage your health.</Text>
        </View>

        <View style={styles.formCard}>
          {generalMessage ? <FormMessage type="error" message={generalMessage} /> : null}

          <Input
            label="Full name"
            placeholder="Your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
            leftIcon="person-outline"
            error={fieldErrors.name}
            variant="filled"
          />
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
          <View style={fieldGroupGap}>
            <Input
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
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
            {password.length > 0 ? (
              <View style={styles.strengthRow}>
                <View style={styles.strengthSegments}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        {
                          backgroundColor: i < filledSegments ? strength.color : Palette.divider,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            ) : null}
          </View>
          <Input
            label="Confirm password"
            placeholder="Repeat your password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            textContentType="newPassword"
            leftIcon="lock-closed-outline"
            error={fieldErrors.confirm}
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

          <View style={styles.termsRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="I agree to the Terms and Privacy Policy"
              accessibilityState={{ checked: accepted }}
              onPress={() => setAccepted((v) => !v)}
              hitSlop={8}
              style={styles.checkbox}
            >
              <Ionicons
                name={accepted ? 'checkbox' : 'square-outline'}
                size={22}
                color={accepted ? Palette.primary : Palette.textMuted}
              />
            </Pressable>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>
          {fieldErrors.terms ? <Text style={styles.termsError}>{fieldErrors.terms}</Text> : null}

          <Button
            title="Create Account"
            onPress={handleSubmit}
            loading={loading}
            disabled={submitDisabled}
            icon="person-add-outline"
          />

          {googleConfigured ? (
            <>
              <OrDivider />
              <GoogleSignInButton onPress={handleGoogle} loading={googleLoading} disabled={loading} />
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.push('/login')} hitSlop={8} style={styles.footerButton}>
            <Text style={styles.footerLink}>Login</Text>
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
    paddingVertical: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
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
    gap: Spacing.md,
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
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  strengthSegments: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    ...Typography.caption,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
  },
  termsLink: {
    color: Palette.primary,
    fontWeight: '600',
  },
  termsError: {
    ...Typography.caption,
    color: Palette.error,
    marginTop: -Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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

