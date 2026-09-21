import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { isValidStrongPassword, PASSWORD_HELP } from "@/lib/validation";
import { toErrorMessage } from "@/services/api";
import { updatePassword } from "@/services/auth";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm;

  const isGoogleUser =
    user?.authProvider === "google" || Boolean(user?.googleId);

  const submit = async () => {
    setError("");
    setSuccess(false);
    if (!oldPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (!isValidStrongPassword(newPassword)) {
      setError(PASSWORD_HELP);
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (!user?._id) return;
    setSaving(true);
    try {
      await updatePassword(user._id, { oldPassword, newPassword });
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(
        toErrorMessage(
          err,
          "Unable to change password. Please check your current password.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Change Password</Text>
            <Text style={styles.headerSubtitle}>Account security & access</Text>
          </View>
        </View>

        {isGoogleUser ? (
          <Card style={styles.oauthCard}>
            <View style={styles.oauthRow}>
              <View style={styles.oauthIconWrap}>
                <Ionicons
                  name="logo-google"
                  size={22}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.oauthTexts}>
                <Text style={styles.oauthTitle}>Google Sign-In Connected</Text>
                <Text style={styles.oauthDetail}>
                  Your account is secured with Google OAuth ({user?.email}). You
                  can create or update a master password for direct login.
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {success ? (
          <Card style={styles.successCard}>
            <View style={styles.successRow}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={Palette.success}
              />
              <View style={styles.successTexts}>
                <Text style={styles.successTitle}>
                  Password Updated Successfully
                </Text>
                <Text style={styles.successDetail}>
                  Your new credentials are now active on HealPoint. All other
                  active sessions have been secured.
                </Text>
              </View>
            </View>
            <Button
              title="Return to Profile"
              variant="outline"
              onPress={() => router.back()}
              style={styles.returnBtn}
            />
          </Card>
        ) : null}

        {error ? <FormMessage type="error" message={error} /> : null}

        <View style={styles.formCard}>
          <Input
            label="Current password"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={!showOld}
            placeholder="••••••••"
            leftIcon="lock-closed-outline"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showOld ? "Hide password" : "Show password"}
                onPress={() => setShowOld((prev) => !prev)}
                style={styles.eyeSlot}
                hitSlop={8}
              >
                <Ionicons
                  name={showOld ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(auth)/forgot-password" as never)}
            style={styles.forgotLink}
            hitSlop={8}
          >
            <Text style={styles.forgotText}>Forgot current password?</Text>
          </Pressable>

          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            placeholder="Create a strong password"
            leftIcon="shield-checkmark-outline"
            containerStyle={{ marginTop: Spacing.md }}
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showNew ? "Hide password" : "Show password"}
                onPress={() => setShowNew((prev) => !prev)}
                style={styles.eyeSlot}
                hitSlop={8}
              >
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          {/* Real-time Checklist */}
          {newPassword.length > 0 ? (
            <View style={styles.checklist}>
              <View style={styles.checkItem}>
                <Ionicons
                  name={hasLength ? "checkmark-circle" : "ellipse-outline"}
                  size={15}
                  color={hasLength ? Palette.success : Palette.textMuted}
                />
                <Text
                  style={[
                    styles.checkText,
                    hasLength && styles.checkTextActive,
                  ]}
                >
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons
                  name={
                    hasUpper && hasLower
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={15}
                  color={
                    hasUpper && hasLower ? Palette.success : Palette.textMuted
                  }
                />
                <Text
                  style={[
                    styles.checkText,
                    hasUpper && hasLower && styles.checkTextActive,
                  ]}
                >
                  Uppercase & lowercase letters
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons
                  name={hasNumber ? "checkmark-circle" : "ellipse-outline"}
                  size={15}
                  color={hasNumber ? Palette.success : Palette.textMuted}
                />
                <Text
                  style={[
                    styles.checkText,
                    hasNumber && styles.checkTextActive,
                  ]}
                >
                  At least one number (0-9)
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons
                  name={hasSpecial ? "checkmark-circle" : "ellipse-outline"}
                  size={15}
                  color={hasSpecial ? Palette.success : Palette.textMuted}
                />
                <Text
                  style={[
                    styles.checkText,
                    hasSpecial && styles.checkTextActive,
                  ]}
                >
                  Special symbol (e.g. ! @ # $ %)
                </Text>
              </View>
            </View>
          ) : null}

          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            placeholder="Re-enter your new password"
            leftIcon="lock-closed-outline"
            containerStyle={{ marginTop: Spacing.md }}
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirm ? "Hide password" : "Show password"
                }
                onPress={() => setShowConfirm((prev) => !prev)}
                style={styles.eyeSlot}
                hitSlop={8}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          {confirm.length > 0 ? (
            <View style={styles.matchIndicator}>
              <Ionicons
                name={passwordsMatch ? "checkmark-circle" : "close-circle"}
                size={14}
                color={passwordsMatch ? Palette.success : Palette.error}
              />
              <Text
                style={[
                  styles.matchText,
                  { color: passwordsMatch ? Palette.success : Palette.error },
                ]}
              >
                {passwordsMatch
                  ? "Passwords match"
                  : "Passwords do not match yet"}
              </Text>
            </View>
          ) : null}

          <Button
            title="Update Password"
            onPress={submit}
            loading={saving}
            icon="shield-checkmark-outline"
            style={styles.submitBtn}
          />
        </View>

        {/* Security Notice */}
        <View style={styles.securityNote}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={Palette.textMuted}
          />
          <Text style={styles.securityNoteText}>
            For your protection, never share your HealPoint password with
            anyone. Our support team will never request your password.
          </Text>
        </View>
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
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  pressed: {
    opacity: 0.6,
  },
  oauthCard: {
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
  },
  oauthRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  oauthIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  oauthTexts: {
    flex: 1,
    gap: 3,
  },
  oauthTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  oauthDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  successCard: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    gap: Spacing.sm,
  },
  successRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  successTexts: {
    flex: 1,
    gap: 2,
  },
  successTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.success,
  },
  successDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  returnBtn: {
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  formCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  eyeSlot: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: Spacing.xs,
  },
  forgotText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  checklist: {
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  checkTextActive: {
    color: Palette.text,
    fontWeight: "600",
  },
  matchIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xs,
    marginLeft: 2,
  },
  matchText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: Spacing.lg,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  securityNoteText: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
    flex: 1,
  },
});
