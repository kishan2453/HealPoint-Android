import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { toErrorMessage } from "@/services/api";

const PREFS_KEY = "healpoint.prefs.notifications";

interface NotificationPreferences {
  appointments: boolean;
  prescriptions: boolean;
  billing: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  appointments: true,
  prescriptions: true,
  billing: true,
};

type Row = {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

type Section = {
  key: string;
  title: string;
  rows: Row[];
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut, changeAccountEmail } = useAuth();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  // Change Email Modal State
  const [changeEmailVisible, setChangeEmailVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  useEffect(() => {
    async function loadPrefs() {
      try {
        const stored = await getStorageItem(PREFS_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch {
        // Fallback to default
      }
    }
    loadPrefs();
  }, []);

  const togglePref = async (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await setStorageItem(PREFS_KEY, JSON.stringify(updated));
    } catch {
      // Best-effort persistence
    }
  };

  const handleUpdateEmail = async () => {
    setEmailError("");
    setEmailSuccess("");
    if (!currentPassword) {
      setEmailError("Current password is required for account verification.");
      return;
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEmailError("Please enter a valid new email address.");
      return;
    }
    if (cleanEmail === user?.email?.toLowerCase()) {
      setEmailError("New email must be different from your current email.");
      return;
    }

    setEmailSubmitting(true);
    try {
      await changeAccountEmail(currentPassword, cleanEmail);
      setEmailSuccess("Registered account email successfully updated!");
      setTimeout(() => {
        setChangeEmailVisible(false);
        setCurrentPassword("");
        setNewEmail("");
        setEmailSuccess("");
      }, 1200);
    } catch (err) {
      setEmailError(toErrorMessage(err, "Failed to update email. Please check your password."));
    } finally {
      setEmailSubmitting(false);
    }
  };

  const sections: Section[] = [
    {
      key: "account",
      title: "Account & Clinical Records",
      rows: [
        {
          key: "edit",
          label: "Edit profile",
          description:
            "Update your name, contact, address and medical profile.",
          icon: "create-outline",
          tint: Palette.primary,
          onPress: () => router.push("/profile/edit"),
        },
        {
          key: "password",
          label: "Change password & security",
          description:
            "Manage your credentials, password and account security.",
          icon: "lock-closed-outline",
          tint: "#E89A3C",
          onPress: () => router.push("/profile/change-password"),
        },
        {
          key: "records",
          label: "Medical records & EMR",
          description:
            "View full clinical consultations, prescriptions and test reports.",
          icon: "fitness-outline",
          tint: "#0E9F8E",
          onPress: () => router.push("/health/records"),
        },
        {
          key: "family",
          label: "Family members",
          description:
            "Manage profiles and records for your family dependents.",
          icon: "people-outline",
          tint: "#2F80ED",
          onPress: () => router.push("/health/family"),
        },
      ],
    },
    {
      key: "support",
      title: "Help, Support & Legal",
      rows: [
        {
          key: "help",
          label: "Help center & FAQs",
          description:
            "Frequently asked questions, guides and support tickets.",
          icon: "help-buoy-outline",
          tint: Palette.primaryDark,
          onPress: () => router.push("/support"),
        },
        {
          key: "helpline",
          label: "24×7 Emergency helpline",
          description:
            "Call our patient support team immediately (+91 98100 00000).",
          icon: "call-outline",
          tint: Palette.error,
          onPress: () =>
            Linking.openURL("tel:+919810000000").catch(() => undefined),
        },
        {
          key: "privacy",
          label: "Privacy Policy",
          description:
            "How your personal health data is protected and encrypted.",
          icon: "shield-checkmark-outline",
          tint: Palette.success,
          onPress: () => router.push("/privacy"),
        },
        {
          key: "terms",
          label: "Terms of Service",
          description: "Platform agreements and patient consultation terms.",
          icon: "reader-outline",
          tint: Palette.info,
          onPress: () => router.push("/terms"),
        },
      ],
    },
  ];

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      setLogoutVisible(false);
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const isGoogleUser =
    user?.authProvider === "google" || Boolean(user?.googleId);

  const renderSection = (section: Section) => (
    <View key={section.key} style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Card padded={false} style={styles.menuCard}>
        {section.rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.menuRow,
              index < section.rows.length - 1 && styles.menuRowBorder,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[styles.menuIcon, { backgroundColor: `${row.tint}18` }]}
            >
              <Ionicons name={row.icon} size={20} color={row.tint} />
            </View>
            <View style={styles.menuTexts}>
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Text style={styles.menuDescription}>{row.description}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Palette.textMuted}
            />
          </Pressable>
        ))}
      </Card>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { paddingTop: Math.max(insets.top, 14) }]}
      edges={["left", "right"]}
    >
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
            <Text style={styles.headerTitle}>Settings & Preferences</Text>
          </View>
        </View>

        {/* Security & Identity Overview Card */}
        <Card style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <View style={styles.shieldIconWrap}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={Palette.primary}
              />
            </View>
            <View style={styles.securityTexts}>
              <Text style={styles.securityName}>
                {user?.name || "Verified Patient"}
              </Text>
              <Text style={styles.securityEmail}>
                {user?.email || "No email"}
              </Text>
            </View>
            <View style={styles.authBadge}>
              <Ionicons
                name={isGoogleUser ? "logo-google" : "key-outline"}
                size={12}
                color={Palette.primaryDark}
              />
              <Text style={styles.authBadgeText}>
                {isGoogleUser ? "Google OAuth" : "Password"}
              </Text>
            </View>
          </View>
          <View style={styles.securityDivider} />
          <View style={styles.securityFooter}>
            <Ionicons name="lock-closed" size={13} color={Palette.success} />
            <Text style={styles.securityStatusText}>
              Device session encrypted with native SecureStore hardware
              keychain.
            </Text>
          </View>
        </Card>

        {/* Registered Account Email Card */}
        <Card style={styles.emailCard}>
          <View style={styles.emailCardHeader}>
            <View style={styles.emailIconWrap}>
              <Ionicons name="mail" size={20} color={Palette.primary} />
            </View>
            <View style={styles.emailCardTexts}>
              <Text style={styles.emailCardLabel}>Registered Account Email</Text>
              <Text style={styles.emailCardValue} numberOfLines={1}>
                {user?.email || "No email registered"}
              </Text>
            </View>
            <View style={styles.emailVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Palette.success} />
              <Text style={styles.emailVerifiedText}>Verified & Active</Text>
            </View>
          </View>
          <View style={styles.emailCardDivider} />
          <View style={styles.emailCardActions}>
            <Text style={styles.emailCardDesc}>
              Used for appointment confirmations, clinical reminders and account security.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change email"
              onPress={() => {
                setEmailError("");
                setEmailSuccess("");
                setChangeEmailVisible(true);
              }}
              style={({ pressed }) => [styles.changeEmailBtn, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" size={15} color={Palette.primary} />
              <Text style={styles.changeEmailBtnText}>Change Email</Text>
            </Pressable>
          </View>
        </Card>

        {/* Render Navigable Sections */}
        {sections.slice(0, 1).map(renderSection)}

        {/* Notification Preferences with Real Persisted Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <Card padded={false} style={styles.menuCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Notification Center"
              onPress={() => router.push("/notification")}
              style={({ pressed }) => [
                styles.menuRow,
                styles.menuRowBorder,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(47, 128, 237, 0.12)" },
                ]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#2F80ED"
                />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>Notification center</Text>
                <Text style={styles.menuDescription}>
                  View and manage all historical alerts and reminders.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Palette.textMuted}
              />
            </Pressable>

            {/* Toggle: Appointment Reminders */}
            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(14, 159, 142, 0.12)" },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>Appointment reminders</Text>
                <Text style={styles.menuDescription}>
                  Receive alerts before upcoming doctor appointments.
                </Text>
              </View>
              <Switch
                value={prefs.appointments}
                onValueChange={() => togglePref("appointments")}
                trackColor={{ false: Palette.border, true: Palette.primary }}
                thumbColor={
                  Platform.OS === "android" ? Palette.white : undefined
                }
              />
            </View>

            {/* Toggle: Prescriptions & Reports */}
            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(232, 154, 60, 0.12)" },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#E89A3C"
                />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>
                  Prescriptions & lab reports
                </Text>
                <Text style={styles.menuDescription}>
                  Notify immediately when new records are uploaded.
                </Text>
              </View>
              <Switch
                value={prefs.prescriptions}
                onValueChange={() => togglePref("prescriptions")}
                trackColor={{ false: Palette.border, true: Palette.primary }}
                thumbColor={
                  Platform.OS === "android" ? Palette.white : undefined
                }
              />
            </View>

            {/* Toggle: Billing & Payment Receipts */}
            <View style={styles.menuRow}>
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(16, 185, 129, 0.12)" },
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={Palette.success}
                />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>Billing & payment receipts</Text>
                <Text style={styles.menuDescription}>
                  Send transaction receipts and payment confirmations.
                </Text>
              </View>
              <Switch
                value={prefs.billing}
                onValueChange={() => togglePref("billing")}
                trackColor={{ false: Palette.border, true: Palette.primary }}
                thumbColor={
                  Platform.OS === "android" ? Palette.white : undefined
                }
              />
            </View>
          </Card>
        </View>

        {/* Render Help, Support & Legal Section */}
        {sections.slice(1).map(renderSection)}

        {/* Session / Logout Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session</Text>
          <Card padded={false} style={styles.menuCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={() => setLogoutVisible(true)}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: "rgba(239, 68, 68, 0.12)" },
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={Palette.error}
                />
              </View>
              <View style={styles.menuTexts}>
                <Text style={[styles.menuLabel, styles.logoutLabel]}>
                  Sign out of HealPoint
                </Text>
                <Text style={styles.menuDescription}>
                  Safely end your session on this mobile device.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Palette.error}
              />
            </Pressable>
          </Card>
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>HealPoint Healthcare</Text>
          <Text style={styles.aboutBody}>
            Version 1.0.0 (Production Release)
          </Text>
          <Text style={styles.aboutBody}>
            Certified Secure Medical Appointment & Telehealth Platform
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Sign Out?"
        message="Are you sure you want to sign out? Your medical history, prescriptions and appointments remain securely saved."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        tone="danger"
        loading={loggingOut}
        onConfirm={confirmLogout}
        onCancel={() => setLogoutVisible(false)}
      />

      {/* Change Registered Email Modal */}
      <Modal
        visible={changeEmailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!emailSubmitting) {
            setChangeEmailVisible(false);
            setEmailError("");
            setEmailSuccess("");
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="mail-unread-outline" size={24} color={Palette.primary} />
              </View>
              <View style={styles.modalHeaderTextWrap}>
                <Text style={styles.modalTitle}>Change Registered Email</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your current password to authorize this security update.
                </Text>
              </View>
            </View>

            {emailError ? (
              <FormMessage type="error" message={emailError} />
            ) : null}
            {emailSuccess ? (
              <FormMessage type="success" message={emailSuccess} />
            ) : null}

            <View style={styles.modalForm}>
              <Input
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightSlot={
                  <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={8}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                }
              />

              <Input
                label="New Email Address"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="e.g. name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => {
                  setChangeEmailVisible(false);
                  setEmailError("");
                  setEmailSuccess("");
                }}
                disabled={emailSubmitting}
                style={styles.modalBtn}
              />
              <Button
                variant="primary"
                title={emailSubmitting ? "Updating..." : "Update Email"}
                onPress={handleUpdateEmail}
                loading={emailSubmitting}
                disabled={emailSubmitting}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: "#0F172A",
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
  securityCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  shieldIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  securityTexts: {
    flex: 1,
    gap: 2,
  },
  securityName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  securityEmail: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  authBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  authBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  securityDivider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.sm,
  },
  securityFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  securityStatusText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTexts: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  menuDescription: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  logoutLabel: {
    color: Palette.error,
    fontWeight: "700",
  },
  about: {
    marginTop: Spacing.xxl,
    alignItems: "center",
    gap: 3,
  },
  aboutTitle: {
    ...Typography.label,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  aboutBody: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  emailCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
    marginBottom: Spacing.xl,
  },
  emailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emailCardTexts: {
    flex: 1,
  },
  emailCardLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emailCardValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
    marginTop: 1,
  },
  emailVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  emailVerifiedText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.success,
  },
  emailCardDivider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.sm,
  },
  emailCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  emailCardDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  changeEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: "rgba(14, 159, 142, 0.10)",
  },
  changeEmailBtnText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: Palette.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  modalForm: {
    gap: Spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalBtn: {
    flex: 1,
  },
});
