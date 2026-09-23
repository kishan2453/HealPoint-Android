import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RoleRoute } from "@/components/RoleRoute";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { StatCard } from "@/components/admin/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { ErrorState } from "@/components/ui/ErrorState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatINR, formatISODate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { canonicalRole } from "@/lib/roles";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import * as notificationsService from "@/services/notifications";
import * as subscriptionService from "@/services/subscriptions";
import { OperationsCenter } from "@/components/admin/OperationsCenter";
import type { Subscription } from "@/types";

interface QuickLinkItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  accent: string;
  badge?: string | number;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"operations" | "modules">(
    "operations",
  );
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof adminService.getHospitalAdminDashboard>
  > | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [dashRes, notifRes, subRes] = await Promise.all([
        adminService.getHospitalAdminDashboard(),
        notificationsService.getNotifications({ limit: 1 }).catch(() => null),
        subscriptionService.getMySubscription().catch(() => null),
      ]);
      setDashboard(dashRes);
      if (notifRes && typeof notifRes.unreadCount === "number") {
        setUnreadCount(notifRes.unreadCount);
      } else if (dashRes.notifications) {
        setUnreadCount(dashRes.notifications.filter((n) => !n.isRead).length);
      }
      if (subRes?.subscription) {
        setSubscription(subRes.subscription);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load the dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const role = canonicalRole(user?.role);
  const totals = dashboard?.dashboard?.totals;
  const hospital = dashboard?.hospital;

  // Compute review stats
  const reviews = dashboard?.reviews || [];
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? (
          reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviewCount
        ).toFixed(1)
      : hospital?.rating
        ? Number(hospital.rating).toFixed(1)
        : "5.0";

  const quickLinks: QuickLinkItem[] = [
    {
      label: "Operations Center",
      icon: "pulse-outline",
      href: "/admin/operations",
      accent: "#059669",
    },
    {
      label: "Online Consultations",
      icon: "videocam-outline",
      href: "/admin/consultations",
      accent: "#7C3AED",
    },
    {
      label: "Doctors",
      icon: "medkit-outline",
      href: "/admin/doctors",
      accent: "#2F80ED",
    },
    {
      label: "Appointments",
      icon: "calendar-outline",
      href: "/admin/appointments",
      accent: "#0E9F8E",
    },
    {
      label: "Slot Management",
      icon: "hourglass-outline",
      href: "/admin/slots",
      accent: "#7B61FF",
    },
    {
      label: "Doctor Verification",
      icon: "shield-checkmark-outline",
      href: "/admin/doctor-verification",
      accent: "#2F80ED",
    },
    {
      label: "Availability",
      icon: "time-outline",
      href: "/admin/doctor-availability",
      accent: "#E89A3C",
    },
    {
      label: "Patients",
      icon: "people-outline",
      href: "/admin/patients",
      accent: "#E89A3C",
    },
    {
      label: "Departments",
      icon: "layers-outline",
      href: "/admin/departments",
      accent: "#0E9F8E",
    },
    {
      label: "Hospital Profile",
      icon: "business-outline",
      href: "/admin/hospital-profile",
      accent: "#2F80ED",
    },
    {
      label: "Hospital Gallery",
      icon: "images-outline",
      href: "/admin/gallery",
      accent: "#7B61FF",
    },
    {
      label: "Reviews",
      icon: "star-outline",
      href: "/admin/reviews",
      accent: "#F2994A",
    },
    {
      label: "Notifications",
      icon: "notifications-outline",
      href: "/admin/notifications",
      accent: "#EB5757",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: "Video Guides",
      icon: "videocam-outline",
      href: "/admin/video-guide",
      accent: "#27AE60",
    },
    {
      label: "Earnings",
      icon: "cash-outline",
      href: "/admin/earnings",
      accent: "#2F80ED",
    },
    {
      label: "Subscription",
      icon: "card-outline",
      href: "/admin/subscription",
      accent: "#9B51E0",
    },
    {
      label: "Support & Help",
      icon: "help-buoy-outline",
      href: "/admin/support",
      accent: "#2F80ED",
    },
    {
      label: "Security",
      icon: "shield-outline",
      href: "/admin/security",
      accent: "#EB5757",
    },
  ];

  return (
    <RoleRoute allowedRoles={["admin", "super_admin"]}>
      <View style={styles.safe}>
        {/* TOP HEADER */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: "#2F80ED1A" }]}>
            <Ionicons name="shield-checkmark" size={26} color="#2F80ED" />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title} numberOfLines={1}>
              {hospital?.name || "Hospital Admin"}
            </Text>
            <Text style={styles.subtitle}>
              {role === "super_admin"
                ? "Super Admin Mode"
                : "Hospital Operations"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.notifBtn}
              onPress={() => router.push("/admin/notifications" as never)}
              accessibilityLabel="Notifications"
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={Palette.text}
              />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <DrawerToggleButton />
          </View>
        </View>

        {/* VIEW MODE SELECTOR */}
        <View style={styles.segmentContainer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode("operations")}
            style={[
              styles.segmentBtn,
              viewMode === "operations" && styles.segmentBtnActive,
            ]}
          >
            <Ionicons
              name="pulse"
              size={15}
              color={
                viewMode === "operations" ? Palette.white : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.segmentText,
                viewMode === "operations" && styles.segmentTextActive,
              ]}
            >
              Operations Center
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode("modules")}
            style={[
              styles.segmentBtn,
              viewMode === "modules" && styles.segmentBtnActive,
            ]}
          >
            <Ionicons
              name="grid"
              size={15}
              color={viewMode === "modules" ? Palette.white : Palette.textMuted}
            />
            <Text
              style={[
                styles.segmentText,
                viewMode === "modules" && styles.segmentTextActive,
              ]}
            >
              Overview & Modules
            </Text>
          </Pressable>
        </View>

        {viewMode === "operations" ? (
          <View style={{ flex: 1 }}>
            <OperationsCenter />
          </View>
        ) : loading ? (
          <Loading label="Loading hospital data..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Palette.primary}
              />
            }
          >
            {/* SUBSCRIPTION SUMMARY BANNER */}
            {subscription && (
              <Pressable
                onPress={() => router.push("/admin/subscription" as never)}
              >
                <Card padded style={styles.subCard}>
                  <View style={styles.subLeft}>
                    <View style={styles.subBadgeRow}>
                      <Text style={styles.subPlanName}>
                        {(subscription.planName ||
                          subscription.planKey?.toUpperCase() ||
                          "FREE") + " PLAN"}
                      </Text>
                      <Badge
                        label={subscription.status.toUpperCase()}
                        variant={
                          subscription.status === "active"
                            ? "success"
                            : "warning"
                        }
                      />
                    </View>
                    <Text style={styles.subExpiry}>
                      {subscription.expiryDate
                        ? "Valid until " +
                          formatISODate(subscription.expiryDate)
                        : "Lifetime Free Tier"}
                    </Text>
                  </View>
                  <View style={styles.subCta}>
                    <Text style={styles.subCtaText}>Manage</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={Palette.primary}
                    />
                  </View>
                </Card>
              </Pressable>
            )}

            {/* KEY METRICS GRID */}
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.grid}>
              <StatCard
                label="Doctors"
                value={totals?.doctors ?? 0}
                icon="medkit-outline"
                accent="#2F80ED"
              />
              <StatCard
                label="Patients"
                value={totals?.patients ?? 0}
                icon="people-outline"
                accent="#E89A3C"
              />
              <StatCard
                label="Today"
                value={totals?.today ?? 0}
                icon="calendar-outline"
                accent="#0E9F8E"
              />
              <StatCard
                label="Pending"
                value={totals?.pending ?? 0}
                icon="time-outline"
                accent="#D9435B"
              />
              <StatCard
                label="Completed"
                value={totals?.completed ?? 0}
                icon="checkmark-done-outline"
                accent="#2E9E5B"
              />
              <StatCard
                label="Revenue"
                value={formatINR(totals?.revenue)}
                icon="wallet-outline"
                accent="#7B61FF"
              />
              <StatCard
                label="Rating"
                value={avgRating + " ★ (" + reviewCount + ")"}
                icon="star-outline"
                accent="#F2994A"
              />
              <StatCard
                label="Unread Notifs"
                value={unreadCount}
                icon="notifications-outline"
                accent="#EB5757"
              />
            </View>

            {/* QUICK ACCESS GRID */}
            <Text style={styles.sectionTitle}>Hospital Modules</Text>
            <View style={styles.grid}>
              {quickLinks.map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => router.push(link.href as never)}
                  style={styles.quickCardWrapper}
                >
                  <Card style={styles.quickCard}>
                    <View style={styles.quickCardTop}>
                      <View
                        style={[
                          styles.quickIcon,
                          { backgroundColor: link.accent + "1F" },
                        ]}
                      >
                        <Ionicons
                          name={link.icon}
                          size={22}
                          color={link.accent}
                        />
                      </View>
                      {link.badge !== undefined && (
                        <View style={styles.quickBadge}>
                          <Text style={styles.quickBadgeText}>
                            {link.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.quickLabel}>{link.label}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </RoleRoute>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTexts: { flex: 1 },
  title: { ...Typography.h3, color: Palette.text, fontWeight: "700" },
  subtitle: { ...Typography.caption, color: Palette.textMuted },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Palette.error,
    borderRadius: Radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: Palette.white,
    fontSize: 9,
    fontWeight: "700",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  segmentBtnActive: {
    backgroundColor: Palette.primary,
  },
  segmentText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  segmentTextActive: {
    color: Palette.white,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.primaryLight,
    borderRadius: Radius.lg,
  },
  subLeft: {
    gap: 4,
  },
  subBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  subPlanName: {
    ...Typography.label,
    color: Palette.primary,
    fontWeight: "700",
  },
  subExpiry: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  subCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  subCtaText: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickCardWrapper: {
    width: "47%",
  },
  quickCard: {
    alignItems: "flex-start",
    gap: Spacing.sm,
    width: "100%",
    padding: Spacing.md,
  },
  quickCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadge: {
    backgroundColor: Palette.error,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  quickLabel: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
});
