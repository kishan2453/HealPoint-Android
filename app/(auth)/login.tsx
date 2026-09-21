import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { isValidEmail, isNonEmpty } from "@/lib/validation";
import { ApiClientError, toErrorMessage } from "@/services/api";
import { isGoogleSignInConfigured, useGoogleSignIn } from "@/services/google";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithToken } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const google = useGoogleSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [generalError, setGeneralError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (registered === "1") {
      setGeneralError("");
      setSuccessMessage(
        "Account created successfully. Please login to continue.",
      );
    }
  }, [registered]);

  useEffect(() => {
    if (google.status.status === "success") {
      const { token, user } = google.status.response;
      setGeneralError("");
      signInWithToken(token, user)
        .then(() => router.replace(homeRouteForRole(user?.role)))
        .catch(() =>
          setGeneralError(
            "Unable to complete Google Sign-In. Please try again.",
          ),
        );
    } else if (google.status.status === "error") {
      setGeneralError(google.status.message);
    } else if (google.status.status === "not_configured") {
      setGeneralError(
        "Google Sign-In is currently unavailable. Please use email & password to continue.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.status]);

  const googleConfigured = isGoogleSignInConfigured();

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!isNonEmpty(email) || !isValidEmail(email))
      errors.email = "Enter a valid email address";
    if (!isNonEmpty(password)) errors.password = "Password is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (loading || googleLoading) return;
    setGeneralError("");
    setSuccessMessage("");
    if (!validate()) return;
    setLoading(true);
    try {
      const loggedInUser = await signIn(email.trim(), password);
      router.replace(homeRouteForRole(loggedInUser?.role));
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.category === "UNAUTHORIZED" || error.category === "NOT_FOUND")
      ) {
        setGeneralError("Email or password is incorrect.");
      } else {
        setGeneralError(
          toErrorMessage(error, "Unable to login. Please try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGeneralError("");
    setSuccessMessage("");
    google.signIn();
  };

  const googleLoading = google.status.status === "loading";
  const submitDisabled = loading || googleLoading;

  return (
    <AuthShell>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={76} badge />
          <View style={styles.trustBadge}>
            <Ionicons
              name="shield-checkmark"
              size={13}
              color={Palette.primaryDark}
            />
            <Text style={styles.trustBadgeText}>Secure Health Network</Text>
          </View>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>
            Login to manage your appointments, prescriptions and health.
          </Text>
        </View>

        <View style={styles.formCard}>
          {generalError ? (
            <FormMessage type="error" message={generalError} />
          ) : null}
          {successMessage ? (
            <FormMessage type="success" message={successMessage} />
          ) : null}

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

          <Pressable
            onPress={() => router.push("/forgot-password")}
            style={styles.forgotRow}
            hitSlop={8}
          >
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
              <GoogleSignInButton
                onPress={handleGoogle}
                loading={googleLoading}
                disabled={loading}
              />
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to HealPoint?</Text>
          <Pressable
            onPress={() => router.push("/register")}
            hitSlop={8}
            style={styles.footerButton}
          >
            <Text style={styles.footerLink}>Create account</Text>
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
  visibilityButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: -Spacing.xs,
  },
  link: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "600",
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
