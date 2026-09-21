/**
 * HealPoint - My Profile (Patient Portal).
 *
 * Displays the real authenticated user's profile with an HD healthcare-themed
 * visual treatment, live appointment metrics, medical records shortcuts,
 * personal information, security controls, and safe session logout.
 * personal information, medical profile (blood group, allergies, chronic conditions),
 * 24x7 emergency helpline, security controls, and safe session logout.
 *
 * 100% Real Backend Data: sourced from useAuth() and useAppointments().
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatISODate } from "@/lib/format";
import { getUserImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile, isLoading } = useAuth();
  const {
    appointments,
    upcoming,
    today,
    completed,
    refetch: refetchAppts,
  } = useAppointments();
  const {
    favoriteIds,
    favoriteHospitalIds,
    refresh: refreshFavorites,
  } = useFavorites();
  const savedCount = favoriteIds.size + favoriteHospitalIds.size;

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refetchAppts()]);
      await Promise.all([refreshProfile(), refetchAppts(), refreshFavorites()]);
      setLoadError("");
    } catch (err) {
      setLoadError(toErrorMessage(err, "Unable to refresh your profile."));
    } finally {
      setRefreshing(false);
    }
  };

  useScreenFocus(() => {
    onRefresh();
  });

  const items: MenuItem[] = [
    {
      key: "edit",
      label: "Edit Profile Information",
      icon: "create-outline",
      tint: Palette.primary,
      onPress: () => router.push("/profile/edit"),
    },
    {
      key: "password",
      label: "Change Password & Security",
      icon: "lock-closed-outline",
      tint: "#E89A3C",
      onPress: () => router.push("/profile/change-password"),
    },
    {
      key: "settings",
      label: "Account Preferences",
      icon: "settings-outline",
      tint: "#2F80ED",
      onPress: () => router.push("/settings"),
    },
    {
      key: "support",
      label: "Help & Support Center",
      icon: "help-buoy-outline",
      tint: "#0D9488",
      onPress: () => router.push("/support"),
    },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      setLogoutVisible(false);
      router.replace("/(auth)/welcome");
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLoading && !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading profile..." />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          title="Not signed in"
          message="Please sign in to view your healthcare profile."
          onRetry={() => router.replace("/(auth)/login")}
        />
      </SafeAreaView>
    );
  }

  const avatarUri = getUserImage(user.image);
  const upcomingCount = upcoming.length + today.length;
  const totalVisits = appointments.length;
  const completedCount = completed.length;
  const isGoogleUser = user.authProvider === "google" || Boolean(user.googleId);
  const hasPersonalInfo = Boolean(
    user.phone || user.gender || user.dob || user.address,
  );
  const hasMedicalProfile = Boolean(
    user.bloodGroup ||
    (user.allergies && user.allergies.length > 0) ||
    (user.chronicConditions && user.chronicConditions.length > 0),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Background Vector Art */}
      {/* Background Subtle Gradient Blobs */}
      <View pointerEvents="none" style={styles.screenDecor}>
        <View style={styles.screenGlowTop} />
        <View style={styles.screenGlowBottom} />
        <View style={styles.screenCross}>
          <View style={styles.screenCrossV} />
          <View style={styles.screenCrossH} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Header Bar */}
        <View style={styles.topHeader}>
          <DrawerToggleButton />
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>My Health Profile</Text>
            <Text style={styles.headerSubtitle}>
              Personal details & clinical healthcare records
            </Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>

        {loadError ? <FormMessage type="error" message={loadError} /> : null}

        {/* ---------------- Profile Identity Banner ---------------- */}
        <Animated.View
          style={{
            opacity: entranceAnim,
            transform: [
              {
                translateY: entranceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          }}
        >
          <Card style={styles.identityCard}>
            <View style={styles.identityRow}>
              {/* Double-Ring Avatar */}
              <View style={styles.avatarOuterRing}>
                <View style={styles.avatarInnerRing}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatar}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>
                        {user.name ? user.name.slice(0, 2).toUpperCase() : "HP"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name || "Patient"}
                  </Text>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={Palette.primary}
                  />
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email || "No email"}
                </Text>
                {user.phone ? (
                  <Text style={styles.userPhone}>
                    <Ionicons
                      name="call-outline"
                      size={12}
                      color={Palette.textMuted}
                    />{" "}
                    {user.phone}
                  </Text>
                ) : null}
                <View style={styles.badgeRow}>
                  <Badge label="Verified Patient" variant="success" />
                  <Badge
                    label={isGoogleUser ? "Google Account" : "Password Account"}
                    variant="primary"
                  />
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ---------------- Real Appointment Stats ---------------- */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalVisits}</Text>
            <Text style={styles.statTitle}>Total Visits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text
              style={[
                styles.statNumber,
                { color: upcomingCount > 0 ? Palette.primary : Palette.text },
              ]}
            >
              {upcomingCount}
            </Text>
            <Text style={styles.statTitle}>Upcoming</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: Palette.success }]}>
              {completedCount}
            </Text>
            <Text style={styles.statTitle}>Completed</Text>
          </View>
        </View>

        {/* ---------------- Clinical & Medical Profile ---------------- */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="heart-circle-outline"
              size={20}
              color={Palette.error}
            />
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionHeaderTitle}>Medical Profile</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Clinical indicators shared with your consulting doctors
              </Text>
            </View>
          </View>

          <View style={styles.medicalProfileContent}>
            {/* Blood Group */}
            <View style={styles.medicalFieldRow}>
              <View style={styles.medicalIconBox}>
                <Ionicons name="water" size={17} color={Palette.error} />
              </View>
              <View style={styles.medicalFieldTexts}>
                <Text style={styles.medicalFieldLabel}>Blood Group</Text>
                <Text
                  style={[
                    styles.medicalFieldValue,
                    user.bloodGroup ? styles.bloodGroupActive : null,
                  ]}
                >
                  {user.bloodGroup ? user.bloodGroup : "Not specified"}
                </Text>
              </View>
              {user.bloodGroup ? (
                <Badge label={user.bloodGroup} variant="error" />
              ) : null}
            </View>

            {/* Allergies */}
            <View style={styles.medicalFieldRowStacked}>
              <View style={styles.medicalRowTop}>
                <Ionicons
                  name="alert-circle-outline"
                  size={15}
                  color="#E89A3C"
                />
                <Text style={styles.medicalFieldLabel}>Known Allergies</Text>
              </View>
              {user.allergies && user.allergies.length > 0 ? (
                <View style={styles.tagChipsWrap}>
                  {user.allergies.map((allergy: string, i: number) => (
                    <View key={i} style={styles.allergyChip}>
                      <Text style={styles.allergyChipText}>{allergy}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyMedicalNote}>
                  No drug or food allergies recorded.
                </Text>
              )}
            </View>

            {/* Chronic Conditions */}
            <View style={styles.medicalFieldRowStacked}>
              <View style={styles.medicalRowTop}>
                <Ionicons
                  name="pulse-outline"
                  size={15}
                  color={Palette.primary}
                />
                <Text style={styles.medicalFieldLabel}>
                  Chronic Health Conditions
                </Text>
              </View>
              {user.chronicConditions && user.chronicConditions.length > 0 ? (
                <View style={styles.tagChipsWrap}>
                  {user.chronicConditions.map((cond: string, i: number) => (
                    <View key={i} style={styles.conditionChip}>
                      <Text style={styles.conditionChipText}>{cond}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyMedicalNote}>
                  No chronic health conditions recorded.
                </Text>
              )}
            </View>
          </View>

          <Button
            title={
              hasMedicalProfile
                ? "Update Medical Profile"
                : "Add Blood Group & Allergies"
            }
            variant="outline"
            icon="create-outline"
            onPress={() => router.push("/profile/edit")}
            style={styles.editBtn}
          />
        </Card>

        {/* ---------------- Health Records Hub ---------------- */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="fitness-outline"
              size={18}
              color={Palette.primary}
            />
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionHeaderTitle}>
                Medical Records & Care Hub
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Prescriptions, diagnostic reports & saved care
              </Text>
            </View>
          </View>

          <View style={styles.quickLinksGrid}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Medical Records"
              onPress={() => router.push("/health/records")}
              style={({ pressed }) => [
                styles.quickLinkTile,
                pressed && styles.tilePressed,
              ]}
            >
              <View
                style={[
                  styles.quickLinkIconWrap,
                  { backgroundColor: "rgba(14, 159, 142, 0.12)" },
                ]}
              >
                <Ionicons name="fitness" size={22} color={Palette.primary} />
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                Medical Records
              </Text>
              <Text style={styles.quickLinkSub} numberOfLines={1}>
                Clinical EMR
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Prescriptions"
              onPress={() => router.push("/health/prescriptions")}
              style={({ pressed }) => [
                styles.quickLinkTile,
                pressed && styles.tilePressed,
              ]}
            >
              <View
                style={[
                  styles.quickLinkIconWrap,
                  { backgroundColor: "rgba(16, 185, 129, 0.12)" },
                ]}
              >
                <Ionicons name="document-text" size={22} color="#10B981" />
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                Prescriptions
              </Text>
              <Text style={styles.quickLinkSub} numberOfLines={1}>
                Medication plans
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Diagnostic Reports"
              onPress={() => router.push("/health/reports")}
              style={({ pressed }) => [
                styles.quickLinkTile,
                pressed && styles.tilePressed,
              ]}
            >
              <View
                style={[
                  styles.quickLinkIconWrap,
                  { backgroundColor: "rgba(2, 132, 199, 0.12)" },
                ]}
              >
                <Ionicons name="bar-chart" size={22} color="#0284C7" />
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                Lab Reports
              </Text>
              <Text style={styles.quickLinkSub} numberOfLines={1}>
                Diagnostics & tests
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Saved Care"
              onPress={() => router.push("/favorites")}
              style={({ pressed }) => [
                styles.quickLinkTile,
                pressed && styles.tilePressed,
              ]}
            >
              <View
                style={[
                  styles.quickLinkIconWrap,
                  { backgroundColor: "rgba(225, 29, 72, 0.12)" },
                ]}
              >
                <Ionicons name="heart" size={22} color="#E11D48" />
                {savedCount > 0 ? (
                  <View style={styles.quickLinkBadge}>
                    <Text style={styles.quickLinkBadgeText}>
                      {savedCount > 9 ? "9+" : savedCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.quickLinkTitle} numberOfLines={1}>
                Saved Care
              </Text>
              <Text style={styles.quickLinkSub} numberOfLines={1}>
                {savedCount > 0 ? `${savedCount} saved` : "Doctors & clinics"}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* ---------------- Personal Details ---------------- */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="person-circle-outline"
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.sectionHeaderTitle}>Personal Information</Text>
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionHeaderTitle}>
                Personal Information
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Contact and identification details
              </Text>
            </View>
          </View>

          {hasPersonalInfo ? (
            <View style={styles.infoList}>
              {user.phone ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name="call-outline"
                      size={17}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phone Number</Text>
                    <Text style={styles.infoValue}>{user.phone}</Text>
                  </View>
                </View>
              ) : null}

              {user.gender ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name="transgender-outline"
                      size={17}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Gender</Text>
                    <Text style={styles.infoValue}>
                      {user.gender.charAt(0).toUpperCase() +
                        user.gender.slice(1)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {user.dob ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name="calendar-outline"
                      size={17}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Date of Birth</Text>
                    <Text style={styles.infoValue}>
                      {formatDDMMYYYY(user.dob)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {user.address ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name="location-outline"
                      size={17}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>{user.address}</Text>
                  </View>
                </View>
              ) : null}

              {user.createdAt ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Patient Since</Text>
                    <Text style={styles.infoValue}>
                      {formatISODate(user.createdAt)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.bodyText}>
              Complete your profile with phone number, date of birth, and
              address for smoother appointment bookings.
            </Text>
          )}

          <Button
            title="Edit Personal Information"
            variant="outline"
            icon="create-outline"
            onPress={() => router.push("/profile/edit")}
            style={styles.editBtn}
          />
        </Card>

        {/* ---------------- Account & Security ---------------- */}
        {/* ---------------- 24x7 Emergency Assistance ---------------- */}
        <Card style={styles.emergencyCard}>
          <View style={styles.emergencyRow}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="call" size={20} color={Palette.error} />
            </View>
            <View style={styles.emergencyTexts}>
              <Text style={styles.emergencyTitle}>
                24×7 Emergency & Urgent Care
              </Text>
              <Text style={styles.emergencyDesc}>
                Immediate triage and hospital emergency hotline assistance.
              </Text>
            </View>
          </View>
          <Button
            title="Call Helpline: +91 98100 00000"
            variant="outline"
            icon="call-outline"
            onPress={() =>
              Linking.openURL("tel:+919810000000").catch(() => undefined)
            }
            style={styles.emergencyCallBtn}
          />
        </Card>

        {/* ---------------- Privacy & Health Security ---------------- */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={Palette.primary}
            />
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionHeaderTitle}>
                Privacy & Data Protection
              </Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Protected Health Information (PHI) standards
              </Text>
            </View>
          </View>

          <View style={styles.privacyNoteBox}>
            <Ionicons name="lock-closed" size={16} color={Palette.primary} />
            <Text style={styles.privacyNoteText}>
              Your personal health information is securely transmitted over TLS
              and protected by HealPoint access control policies. Only your
              account and authorized medical personnel can view your medical
              records.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Privacy Policy"
            onPress={() => router.push("/privacy")}
            style={({ pressed }) => [
              styles.privacyLinkRow,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="reader-outline" size={18} color={Palette.primary} />
            <Text style={styles.privacyLinkText}>
              Review HealPoint Privacy Policy & Patient Rights
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Palette.textMuted}
            />
          </Pressable>
        </Card>

        {/* ---------------- Account & Security Menu ---------------- */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={18} color={Palette.primary} />
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionHeaderTitle}>Account & Security</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Authentication, password & preferences
              </Text>
            </View>
          </View>

          <View style={styles.menuList}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.menuIconBox,
                    { backgroundColor: `${item.tint}18` },
                  ]}
                >
                  <Ionicons name={item.icon} size={18} color={item.tint} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Palette.textMuted}
                />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Logout CTA */}
        <Button
          title="Sign Out of HealPoint"
          variant="outline"
          icon="log-out-outline"
          onPress={() => setLogoutVisible(true)}
          style={styles.logoutBtn}
        />

        <ConfirmDialog
          visible={logoutVisible}
          title="Sign Out?"
          message="Are you sure you want to sign out of HealPoint? Your health data and upcoming appointments will remain securely saved."
          confirmLabel="Sign Out"
          cancelLabel="Stay Signed In"
          tone="danger"
          loading={loggingOut}
          onConfirm={handleLogout}
          onCancel={() => setLogoutVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  screenGlowTop: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  screenGlowBottom: {
    position: "absolute",
    bottom: 80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(34, 167, 160, 0.06)",
  },
  screenCross: {
    position: "absolute",
    top: "30%",
    right: 20,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  screenCrossV: {
    position: "absolute",
    width: 8,
    height: 28,
    borderRadius: 4,
    backgroundColor: "rgba(14, 159, 142, 0.07)",
  },
  screenCrossH: {
    position: "absolute",
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(14, 159, 142, 0.07)",
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  headerPlaceholder: {
    width: 40,
  },
  identityCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.18)",
    ...Shadows.card,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  avatarOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "rgba(14, 159, 142, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInnerRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: "hidden",
    backgroundColor: Palette.primaryLight,
  },
  avatar: {
    width: 74,
    height: 74,
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primaryLight,
  },
  avatarInitials: {
    ...Typography.h3,
    color: Palette.primaryDark,
    fontWeight: "800",
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  userName: {
    ...Typography.h3,
    color: Palette.text,
    flexShrink: 1,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  userPhone: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: Spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignSelf: "flex-start",
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: Spacing.md + 2,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statNumber: {
    ...Typography.h3,
    fontWeight: "800",
    color: Palette.text,
  },
  statTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Palette.border,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.md,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionHeaderTitle: {
    ...Typography.label,
    color: Palette.text,
    fontSize: 15,
  },
  sectionHeaderSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  medicalProfileContent: {
    gap: Spacing.md,
  },
  medicalFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  medicalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(225, 29, 72, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  medicalFieldTexts: {
    flex: 1,
  },
  medicalFieldLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  medicalFieldValue: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  bloodGroupActive: {
    color: Palette.error,
    fontWeight: "800",
  },
  medicalFieldRowStacked: {
    gap: 4,
  },
  medicalRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  allergyChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(232, 154, 60, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(232, 154, 60, 0.3)",
  },
  allergyChipText: {
    ...Typography.caption,
    color: "#B45309",
    fontWeight: "600",
  },
  conditionChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.3)",
  },
  conditionChipText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  emptyMedicalNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  quickLinksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  quickLinkTile: {
    width: "48%",
    minHeight: 112,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  quickLinkIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  quickLinkBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  quickLinkBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  quickLinkTitle: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    textAlign: "center",
  },
  quickLinkSub: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
  },
  infoList: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: "600",
    color: Palette.text,
  },
  bodyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  editBtn: {
    marginTop: Spacing.xs,
  },
  emergencyCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
    gap: Spacing.md,
    ...Shadows.card,
  },
  emergencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  emergencyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTexts: {
    flex: 1,
  },
  emergencyTitle: {
    ...Typography.label,
    color: Palette.error,
    fontSize: 14,
  },
  emergencyDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  emergencyCallBtn: {
    borderColor: Palette.error,
  },
  privacyNoteBox: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  privacyNoteText: {
    flex: 1,
    ...Typography.caption,
    color: Palette.primaryDark,
    lineHeight: 18,
  },
  privacyLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  privacyLinkText: {
    flex: 1,
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.primary,
  },
  menuList: {
    gap: Spacing.xs,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    ...Typography.body,
    fontWeight: "500",
    color: Palette.text,
    flex: 1,
  },
  logoutBtn: {
    borderColor: Palette.error,
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  tilePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
});
