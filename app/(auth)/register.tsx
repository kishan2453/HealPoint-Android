import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { HealPointLogo } from "@/components/HealPointLogo";
import { OrDivider } from "@/components/OrDivider";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { homeRouteForRole } from "@/lib/roles";
import { AUTH_CARD_MAX_WIDTH } from "@/lib/responsive";
import {
  PASSWORD_HELP,
  getPasswordValidation,
  isValidEmail,
  isValidStrongPassword,
} from "@/lib/validation";
import { ApiClientError, toErrorMessage } from "@/services/api";
import { isGoogleSignInConfigured, useGoogleSignIn } from "@/services/google";

type Strength = { score: number; label: string; color: string };

function passwordStrength(value: string): Strength {
  const result = getPasswordValidation(value);
  let score = 0;
  if (result.hasMinLength) score++;
  if (result.hasLowercase) score++;
  if (result.hasUppercase) score++;
  if (result.hasNumber) score++;
  if (result.hasSpecial) score++;
  if (result.isValid) {
    return { score: 5, label: "Strong", color: Palette.success };
  }
  if (score <= 2) return { score, label: "Weak", color: Palette.error };
  if (score <= 4) return { score, label: "Fair", color: Palette.warning };
  return { score, label: "Strong", color: Palette.success };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, signInWithToken } = useAuth();
  const google = useGoogleSignIn();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
    terms?: string;
  }>({});
  const [generalMessage, setGeneralMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (google.status.status === "success") {
      const { token, user } = google.status.response;
      setGeneralMessage("");
      signInWithToken(token, user)
        .then(() => router.replace(homeRouteForRole(user?.role)))
        .catch(() =>
          setGeneralMessage(
            "Unable to complete Google Sign-In. Please try again.",
          ),
        );
    } else if (google.status.status === "error") {
      setGeneralMessage(google.status.message);
    } else if (google.status.status === "not_configured") {
      setGeneralMessage(
        "Google Sign-In is currently unavailable. Please use email & password to continue.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.status]);

  const googleConfigured = isGoogleSignInConfigured();

  const strength = passwordStrength(password);
  const filledSegments = Math.max(
    0,
    Math.min(3, Math.round((strength.score / 5) * 3)),
  );

  const handleNameChange = (text: string) => {
    setName(text);
    if (fieldErrors.name && text.trim()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email && isValidEmail(text.trim())) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    const pwdValidation = getPasswordValidation(text);

    setFieldErrors((prev) => {
      const next = { ...prev };
      if (pwdValidation.isValid) {
        delete next.password;
      } else if (passwordTouched || prev.password) {
        next.password = pwdValidation.errorMessage;
      }

      // Revalidate confirm password against new password if confirm has content
      if (confirm.length > 0 || prev.confirm) {
        if (text === confirm) {
          delete next.confirm;
        } else {
          next.confirm = "Passwords do not match";
        }
      }
      return next;
    });
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    const pwdValidation = getPasswordValidation(password);
    if (!pwdValidation.isValid && password.length > 0) {
      setFieldErrors((prev) => ({
        ...prev,
        password: pwdValidation.errorMessage,
      }));
    }
  };

  const handleConfirmChange = (text: string) => {
    setConfirm(text);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (text.length > 0 && text !== password) {
        next.confirm = "Passwords do not match";
      } else {
        delete next.confirm;
      }
      return next;
    });
  };

  const handleConfirmBlur = () => {
    setConfirmTouched(true);
    if (confirm.length > 0 && confirm !== password) {
      setFieldErrors((prev) => ({
        ...prev,
        confirm: "Passwords do not match",
      }));
    }
  };

  const handleTermsToggle = () => {
    setAccepted((v) => {
      const nextVal = !v;
      if (nextVal && fieldErrors.terms) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.terms;
          return next;
        });
      }
      return nextVal;
    });
  };

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = "Full name is required";
    if (!isValidEmail(email.trim()))
      errors.email = "Enter a valid email address";
    const pwdValidation = getPasswordValidation(password);
    if (!pwdValidation.isValid) {
      errors.password = pwdValidation.errorMessage || PASSWORD_HELP;
    }
    if (password !== confirm) errors.confirm = "Passwords do not match";
    if (!accepted)
      errors.terms = "You must accept the Terms and Privacy Policy";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (loading || googleLoading) return;
    setGeneralMessage("");
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace({ pathname: "/login", params: { registered: "1" } });
    } catch (error) {
      if (
        (error instanceof ApiClientError &&
          (error.status === 409 ||
            /already exists/i.test(error.message) ||
            /already exists/i.test(error.serverMessage || ""))) ||
        (error instanceof Error && /already exists/i.test(error.message))
      ) {
        setGeneralMessage(
          "An account with this email already exists. Please log in instead.",
        );
      } else {
        setGeneralMessage(
          toErrorMessage(error, "Unable to create account. Please try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGeneralMessage("");
    google.signIn();
  };

  const googleLoading = google.status.status === "loading";
  const pwdValidation = getPasswordValidation(password);
  const isFormValid = Boolean(
    name.trim() &&
    isValidEmail(email.trim()) &&
    pwdValidation.isValid &&
    password === confirm &&
    accepted,
  );
  const submitDisabled = loading || googleLoading || !isFormValid;

  return (
    <AuthShell>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={76} badge />
          <View style={styles.trustBadge}>
            <Ionicons name="sparkles" size={13} color={Palette.primaryDark} />
            <Text style={styles.trustBadgeText}>New Patient Registration</Text>
          </View>
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>
            Join HealPoint to book trusted doctors and manage your health.
          </Text>
        </View>

        <View style={styles.formCard}>
          {generalMessage ? (
            <FormMessage type="error" message={generalMessage} />
          ) : null}

          <Input
            label="Full Name"
            placeholder="Kishan Rajput"
            value={name}
            onChangeText={handleNameChange}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            leftIcon="person-outline"
            error={fieldErrors.name}
            variant="filled"
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            leftIcon="mail-outline"
            error={fieldErrors.email}
            variant="filled"
          />

          <View style={styles.passwordContainer}>
            <Input
              label="Password"
              placeholder="Create a strong password"
              value={password}
              onChangeText={handlePasswordChange}
              onBlur={handlePasswordBlur}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              leftIcon="lock-closed-outline"
              error={fieldErrors.password}
              variant="filled"
              rightSlot={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  style={styles.visibilityButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={Palette.textMuted}
                  />
                </Pressable>
              }
            />

            {password.length > 0 ? (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2].map((idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            idx < filledSegments
                              ? strength.color
                              : Palette.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            ) : null}
          </View>

          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirm}
            onChangeText={handleConfirmChange}
            onBlur={handleConfirmBlur}
            secureTextEntry={!showConfirm}
            textContentType="newPassword"
            leftIcon="shield-checkmark-outline"
            error={fieldErrors.confirm}
            variant="filled"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirm ? "Hide password" : "Show password"
                }
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={8}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
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
              onPress={handleTermsToggle}
              hitSlop={8}
              style={styles.checkbox}
            >
              <Ionicons
                name={accepted ? "checkbox" : "square-outline"}
                size={22}
                color={accepted ? Palette.primary : Palette.textMuted}
              />
            </Pressable>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>
          {fieldErrors.terms ? (
            <Text style={styles.termsError}>{fieldErrors.terms}</Text>
          ) : null}

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
              <GoogleSignInButton
                onPress={handleGoogle}
                loading={googleLoading}
                disabled={loading}
              />
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable
            onPress={() => router.push("/login")}
            hitSlop={8}
            style={styles.footerButton}
          >
            <Text style={styles.footerLink}>Login</Text>
            <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/doctor-login" as never)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.doctorRow,
            pressed && styles.doctorRowPressed,
          ]}
        >
          <Ionicons name="medkit" size={15} color={Palette.primaryDark} />
          <Text style={styles.doctorLink}>
            Are you a Doctor? Sign in to Doctor Portal
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
  },
  trustBadgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heading: {
    ...Typography.h1,
    color: Palette.text,
    marginTop: Spacing.sm,
    letterSpacing: -0.5,
  },
  subheading: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: Spacing.xs,
    maxWidth: 320,
    lineHeight: 21,
  },
  formCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
    width: "100%",
    maxWidth: AUTH_CARD_MAX_WIDTH,
    alignSelf: "center",
    ...Shadows.card,
  },
  passwordContainer: {
    gap: Spacing.xs,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xs,
    marginTop: 2,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
    marginRight: Spacing.md,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: Radius.pill,
  },
  strengthLabel: {
    ...Typography.caption,
    fontWeight: "700",
  },
  visibilityButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkbox: {
    padding: 2,
  },
  termsText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
  },
  termsLink: {
    color: Palette.primary,
    fontWeight: "600",
  },
  termsError: {
    ...Typography.caption,
    color: Palette.error,
    marginTop: -Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerLink: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: "center",
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.18)",
  },
  doctorRowPressed: {
    opacity: 0.7,
  },
  doctorLink: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
});
