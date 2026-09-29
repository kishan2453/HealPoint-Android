/**
 * HealPoint - Smart Notification & Event Orchestration Center (Patient & Doctor).
 *
 * Real notifications from the backend (`GET /notification/get-all`) scoped to
 * the logged-in user's token. Features real-time Socket.IO synchronization,
 * multi-portal routing, category filtering, priority indicators (Normal, High, Critical),
 * and interactive Notification Preferences & Quiet Hours management.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { cleanDuplicateDoctorTitle, formatISODate } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as notificationService from "@/services/notifications";
import { subscribeToNotificationSync } from "@/services/socket";
import type { Notification, NotificationPreferences } from "@/types";

const LIST_LIMIT = 50;

/** Known user-side routes a notification `link` may safely point to. */
const INTERNAL_LINK =
  /^\/(appointment|booking|payment|doctor|hospital|profile|notification|consultation|health|reviews|subscription)(\/|$)/;

type FilterCategory =
  | "all"
  | "unread"
  | "appointments"
  | "clinical"
  | "referrals"
  | "documents"
  | "billing"
  | "security";

const CATEGORY_TABS: {
  id: FilterCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "all", label: "All", icon: "layers-outline" },
  { id: "unread", label: "Unread", icon: "mail-unread-outline" },
  { id: "appointments", label: "Appointments", icon: "calendar-outline" },
  { id: "clinical", label: "Clinical", icon: "medkit-outline" },
  { id: "referrals", label: "Referrals", icon: "git-network-outline" },
  { id: "documents", label: "Documents", icon: "document-text-outline" },
  { id: "billing", label: "Billing", icon: "card-outline" },
  { id: "security", label: "Security", icon: "shield-outline" },
];

function notificationVisual(type?: string): {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
} {
  const key = (type || "").trim().toLowerCase();
  if (key.startsWith("payment") || key.startsWith("subscription")) {
    return { icon: "card-outline", tint: Palette.success };
  }
  if (key.includes("prescription") || key.includes("medication")) {
    return { icon: "receipt-outline", tint: Palette.primary };
  }
  if (key.includes("report")) {
    return { icon: "fitness-outline", tint: "#E89A3C" };
  }
  if (key.startsWith("referral")) {
    return { icon: "git-network-outline", tint: "#7B61FF" };
  }
  if (key.startsWith("handover")) {
    return { icon: "swap-horizontal-outline", tint: "#0E9F8E" };
  }
  if (key.startsWith("consent")) {
    return { icon: "shield-checkmark-outline", tint: "#27AE60" };
  }
  if (key.startsWith("document_") || key.includes("ocr")) {
    return { icon: "document-attach-outline", tint: "#0284C7" };
  }
  if (
    key.startsWith("appointment") ||
    key === "booking" ||
    key === "reschedule" ||
    key === "cancel"
  ) {
    return { icon: "calendar-outline", tint: Palette.primaryDark };
  }
  if (key.includes("reminder") || key === "appointment_reminder") {
    return { icon: "alarm-outline", tint: "#D97706" };
  }
  if (key.startsWith("review")) {
    return { icon: "star-outline", tint: "#F59E0B" };
  }
  if (key === "message_received") {
    return { icon: "chatbubble-outline", tint: "#2F80ED" };
  }
  if (
    key.includes("security") ||
    key === "system_alert" ||
    key === "admin_action"
  ) {
    return { icon: "alert-circle-outline", tint: Palette.error };
  }
  return { icon: "notifications-outline", tint: Palette.primaryDark };
}

/** Relative time for recent items; absolute date once older than a week. */
function timeLabel(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatISODate(value);
}

/** Resolves smart deep routing for any backend notification. */
function getNotificationRoute(notification: Notification): string | null {
  const rawLink = (notification.link || "").trim();
  const normalizedLink = rawLink
    .replace(/^\/user\/consultations\//, "/consultation/")
    .replace(/^\/user\/appointments\//, "/appointment/");
  if (normalizedLink && INTERNAL_LINK.test(normalizedLink))
    return normalizedLink;

  const type = (notification.type || "").toLowerCase();
  const refModel = (notification.refModel || "").toLowerCase();
  const refId = notification.refId ? String(notification.refId) : "";

  if (
    type === "meeting_ready" ||
    type === "consultation_status" ||
    type === "consultation_completed" ||
    type === "online_consultation" ||
    type === "online_consultation_ready"
  ) {
    if (refId) return `/consultation/${refId}`;
    return "/(drawer)/consultations";
  }

  if (
    refModel === "appointment" ||
    type.startsWith("appointment") ||
    type === "booking"
  ) {
    if (refId) return `/appointment/${refId}`;
    return "/(drawer)/appointments";
  }
  if (type.includes("prescription")) {
    return "/(drawer)/health/prescriptions";
  }
  if (type.includes("report")) {
    return "/(drawer)/health/reports";
  }
  if (type.startsWith("referral") || type.includes("clinical_referral")) {
    return "/(drawer)/health/referrals";
  }
  if (type.startsWith("handover") || type.includes("clinical_handover")) {
    return "/(drawer)/health/handovers";
  }
  if (type.startsWith("consent") || type.includes("clinical_consent")) {
    return "/(drawer)/health/consent";
  }
  if (type.startsWith("document_") || type.includes("ocr")) {
    return "/(drawer)/health-wallet";
  }
  if (type.startsWith("subscription")) {
    return "/(drawer)/subscription";
  }
  if (type.startsWith("payment")) {
    return "/(drawer)/payments/history";
  }
  if (type === "message_received") {
    return "/(drawer)/consultations";
  }
  if (type.startsWith("review")) {
    return "/(drawer)/reviews";
  }
  if (refModel === "doctor" && refId) {
    return `/doctor/${refId}`;
  }
  if (refModel === "hospital" && refId) {
    return `/hospital/${refId}`;
  }
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const hasLoaded = useRef(false);
  const activeUserIdRef = useRef<string | undefined>(userId);

  // Preferences Modal state
  const [prefsModalVisible, setPrefsModalVisible] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [prefsSuccess, setPrefsSuccess] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    channels: { inApp: true, push: true, email: true, sms: true },
    categories: {
      appointments: true,
      payments: true,
      consultations: true,
      prescriptions: true,
      reports: true,
      referrals: true,
      consent: true,
      documents: true,
      subscriptions: true,
      security: true,
    },
    quietHours: { enabled: false, startHour: 22, endHour: 7 },
  });

  const load = useCallback(
    async (background = false) => {
      const requestUserId = userId;
      if (!requestUserId) {
        hasLoaded.current = false;
        setNotifications([]);
        setError("");
        setRefreshError("");
        setLoading(false);
        return;
      }

      if (!hasLoaded.current && !background) setLoading(true);
      try {
        const res = await notificationService.getNotifications({
          limit: LIST_LIMIT,
        });
        if (activeUserIdRef.current !== requestUserId) return;

        const list = [...(res.notifications || [])].sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });
        hasLoaded.current = true;
        setNotifications(list);
        setError("");
        setRefreshError("");
      } catch (err) {
        if (activeUserIdRef.current !== requestUserId) return;
        if (!hasLoaded.current) {
          setNotifications([]);
          setError(toErrorMessage(err, "Unable to load notifications."));
        } else {
          setRefreshError(
            "Could not refresh notifications. Pull down to try again.",
          );
        }
      } finally {
        if (activeUserIdRef.current === requestUserId) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    activeUserIdRef.current = userId;
    hasLoaded.current = false;
    setNotifications([]);
    setError("");
    setRefreshError("");
    setLoading(Boolean(userId));
    if (userId) load();
  }, [load, userId]);

  useScreenFocus(() => {
    load(true);
  });

  // Real-time WebSocket synchronization
  useEffect(() => {
    const unsubscribe = subscribeToNotificationSync(
      (newNotif: Notification) => {
        if (!newNotif?._id) return;
        setNotifications((prev) => {
          if (prev.some((item) => item._id === newNotif._id)) return prev;
          return [newNotif, ...prev];
        });
      },
    );
    return unsubscribe;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  const markAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true, deliveryStatus: "read" })),
      );
    } catch {
      // Keep state truthful
    } finally {
      setMarkingAll(false);
    }
  };

  const markOne = async (notification: Notification) => {
    const wasUnread = !notification.isRead;
    if (wasUnread) {
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notification._id
            ? { ...item, isRead: true, deliveryStatus: "read" }
            : item,
        ),
      );
      try {
        await notificationService.updateNotificationRead(
          notification._id,
          true,
        );
      } catch {
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id ? { ...item, isRead: false } : item,
          ),
        );
      }
    }
    const target = getNotificationRoute(notification);
    if (target) {
      router.push(target as never);
    }
  };

  const deleteOne = async (id: string) => {
    setNotifications((prev) => prev.filter((item) => item._id !== id));
    try {
      await notificationService.deleteNotification(id);
    } catch {
      load(true);
    }
  };

  const openPreferences = async () => {
    setPrefsModalVisible(true);
    setPrefsLoading(true);
    setPrefsError("");
    setPrefsSuccess("");
    try {
      const res = await notificationService.getNotificationPreferences();
      if (res.preferences) {
        setPreferences(res.preferences);
      }
    } catch (err) {
      setPrefsError(toErrorMessage(err, "Failed to load preferences"));
    } finally {
      setPrefsLoading(false);
    }
  };

  const savePreferences = async () => {
    setPrefsSaving(true);
    setPrefsError("");
    setPrefsSuccess("");
    try {
      await notificationService.updateNotificationPreferences(preferences);
      setPrefsSuccess("Preferences saved successfully!");
      setTimeout(() => {
        setPrefsModalVisible(false);
        setPrefsSuccess("");
      }, 1200);
    } catch (err) {
      setPrefsError(toErrorMessage(err, "Failed to save preferences"));
    } finally {
      setPrefsSaving(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (activeCategory === "unread") {
      return notifications.filter((item) => !item.isRead);
    }
    if (activeCategory === "appointments") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "appointments" ||
          t.startsWith("appointment") ||
          t === "booking" ||
          item.refModel === "appointment"
        );
      });
    }
    if (activeCategory === "clinical") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "prescriptions" ||
          cat === "reports" ||
          cat === "consultations" ||
          t.includes("prescription") ||
          t.includes("report") ||
          t.includes("consultation")
        );
      });
    }
    if (activeCategory === "referrals") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "referrals" ||
          t.includes("referral") ||
          t.includes("handover")
        );
      });
    }
    if (activeCategory === "documents") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "documents" || t.startsWith("document_") || t.includes("ocr")
        );
      });
    }
    if (activeCategory === "billing") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "payments" ||
          cat === "subscriptions" ||
          t.startsWith("payment") ||
          t.startsWith("subscription")
        );
      });
    }
    if (activeCategory === "security") {
      return notifications.filter((item) => {
        const cat = item.category?.toLowerCase();
        const t = (item.type || "").toLowerCase();
        return (
          cat === "security" || t.includes("security") || t === "system_alert"
        );
      });
    }
    return notifications;
  }, [notifications, activeCategory]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Palette.primary}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
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
          <Text style={styles.headerTitle}>Notification Center</Text>
          {notifications.length > 0 ? (
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                : "All caught up"}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notification Settings"
          onPress={openPreferences}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={Palette.primaryDark}
          />
        </Pressable>

        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            onPress={markAll}
            disabled={markingAll}
            style={({ pressed }) => [
              styles.markAllButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <Text style={styles.markAll}>Mark read</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Category Pills */}
      {!loading && !error && notifications.length > 0 ? (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {CATEGORY_TABS.map((tab) => {
              const active = activeCategory === tab.id;
              const count =
                tab.id === "all"
                  ? notifications.length
                  : tab.id === "unread"
                    ? unreadCount
                    : 0;

              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveCategory(tab.id)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    active && styles.filterChipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? Palette.white : Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {count > 0 ? (
                    <View
                      style={[
                        styles.chipBadge,
                        active
                          ? styles.chipBadgeActive
                          : styles.chipBadgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipBadgeText,
                          active
                            ? styles.chipBadgeTextActive
                            : styles.chipBadgeTextInactive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* List or States */}
      {loading ? (
        <Loading label="Loading notifications..." />
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <ErrorState message={error} onRetry={() => load(true)} />
        </ScrollView>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            title={
              activeCategory === "unread"
                ? "No unread alerts"
                : activeCategory === "appointments"
                  ? "No appointment alerts"
                  : activeCategory === "clinical"
                    ? "No medical alerts"
                    : activeCategory === "referrals"
                      ? "No referral alerts"
                      : activeCategory === "documents"
                        ? "No document alerts"
                        : activeCategory === "billing"
                          ? "No payment alerts"
                          : activeCategory === "security"
                            ? "No security alerts"
                            : "No notifications yet"
            }
            message="Live events and healthcare notifications will appear here in real time."
          />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => markOne(item)}
              onDelete={() => deleteOne(item._id)}
            />
          )}
          refreshControl={refreshControl}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            refreshError ? (
              <View style={styles.refreshError}>
                <FormMessage type="warning" message={refreshError} />
              </View>
            ) : null
          }
          initialNumToRender={12}
          windowSize={7}
        />
      )}

      {/* Notification Preferences Modal */}
      <Modal
        visible={prefsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrefsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Notification Settings</Text>
                <Text style={styles.modalSubtitle}>
                  Control your channels, categories & quiet hours
                </Text>
              </View>
              <Pressable
                onPress={() => setPrefsModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {prefsLoading ? (
              <View style={{ padding: Spacing.xl }}>
                <Loading label="Loading preferences..." />
              </View>
            ) : (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {prefsError ? (
                  <FormMessage type="error" message={prefsError} />
                ) : null}
                {prefsSuccess ? (
                  <FormMessage type="success" message={prefsSuccess} />
                ) : null}

                {/* Delivery Channels */}
                <Text style={styles.prefSectionHeader}>Delivery Channels</Text>
                <View style={styles.prefCard}>
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons
                        name="phone-portrait-outline"
                        size={18}
                        color={Palette.primary}
                      />
                      <Text style={styles.prefLabel}>In-App Alerts</Text>
                    </View>
                    <Switch
                      value={preferences.channels.inApp}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          channels: { ...p.channels, inApp: val },
                        }))
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons
                        name="notifications-outline"
                        size={18}
                        color={Palette.primary}
                      />
                      <Text style={styles.prefLabel}>Device Push</Text>
                    </View>
                    <Switch
                      value={preferences.channels.push}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          channels: { ...p.channels, push: val },
                        }))
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons
                        name="mail-outline"
                        size={18}
                        color={Palette.primary}
                      />
                      <Text style={styles.prefLabel}>Email Notifications</Text>
                    </View>
                    <Switch
                      value={preferences.channels.email}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          channels: { ...p.channels, email: val },
                        }))
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons
                        name="chatbox-ellipses-outline"
                        size={18}
                        color={Palette.primary}
                      />
                      <Text style={styles.prefLabel}>SMS Notifications</Text>
                    </View>
                    <Switch
                      value={preferences.channels.sms}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          channels: { ...p.channels, sms: val },
                        }))
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                </View>

                {/* Categories */}
                <Text style={styles.prefSectionHeader}>
                  Notification Categories
                </Text>
                <View style={styles.prefCard}>
                  {[
                    {
                      key: "appointments",
                      label: "Appointments & Visits",
                      icon: "calendar-outline",
                    },
                    {
                      key: "consultations",
                      label: "Consultations & Video",
                      icon: "videocam-outline",
                    },
                    {
                      key: "prescriptions",
                      label: "Prescriptions & Meds",
                      icon: "receipt-outline",
                    },
                    {
                      key: "reports",
                      label: "Lab Reports & Tests",
                      icon: "fitness-outline",
                    },
                    {
                      key: "referrals",
                      label: "Referrals & Handovers",
                      icon: "git-network-outline",
                    },
                    {
                      key: "consent",
                      label: "Consent & Approvals",
                      icon: "shield-checkmark-outline",
                    },
                    {
                      key: "documents",
                      label: "Document Intelligence",
                      icon: "document-text-outline",
                    },
                    {
                      key: "payments",
                      label: "Payments & Receipts",
                      icon: "card-outline",
                    },
                    {
                      key: "subscriptions",
                      label: "Subscription Plans",
                      icon: "star-outline",
                    },
                  ].map((item, idx, arr) => (
                    <React.Fragment key={item.key}>
                      <View style={styles.prefRow}>
                        <View style={styles.prefInfo}>
                          <Ionicons
                            name={item.icon as never}
                            size={18}
                            color={Palette.primaryDark}
                          />
                          <Text style={styles.prefLabel}>{item.label}</Text>
                        </View>
                        <Switch
                          value={
                            preferences.categories[
                              item.key as keyof typeof preferences.categories
                            ]
                          }
                          onValueChange={(val) =>
                            setPreferences((p) => ({
                              ...p,
                              categories: { ...p.categories, [item.key]: val },
                            }))
                          }
                          trackColor={{
                            false: Palette.border,
                            true: Palette.primary,
                          }}
                        />
                      </View>
                      {idx < arr.length - 1 ? (
                        <View style={styles.prefDivider} />
                      ) : null}
                    </React.Fragment>
                  ))}
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={Palette.error}
                      />
                      <Text style={[styles.prefLabel, { color: Palette.text }]}>
                        Security Alerts (Mandatory)
                      </Text>
                    </View>
                    <Switch
                      value={true}
                      disabled
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                </View>

                {/* Quiet Hours */}
                <Text style={styles.prefSectionHeader}>Quiet Hours</Text>
                <View style={styles.prefCard}>
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons name="moon-outline" size={18} color="#7B61FF" />
                      <View>
                        <Text style={styles.prefLabel}>Enable Quiet Hours</Text>
                        <Text style={styles.prefSubLabel}>
                          Mutes non-critical alerts between 10 PM and 7 AM
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.quietHours.enabled}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          quietHours: { ...p.quietHours, enabled: val },
                        }))
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primary,
                      }}
                    />
                  </View>
                </View>

                <View style={{ height: Spacing.xl }} />
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setPrefsModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={savePreferences}
                disabled={prefsSaving || prefsLoading}
                style={[styles.modalSaveBtn, prefsSaving && { opacity: 0.7 }]}
              >
                {prefsSaving ? (
                  <ActivityIndicator size="small" color={Palette.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save Settings</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const NotificationRow = React.memo(function NotificationRow({
  notification,
  onPress,
  onDelete,
}: {
  notification: Notification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const unread = !notification.isRead;
  const visual = notificationVisual(notification.type);
  const isCritical = notification.priority === "critical";
  const isHighPriority = notification.priority === "high";
  const hasRoute = Boolean(getNotificationRoute(notification));
  const cleanTitle = cleanDuplicateDoctorTitle(notification.title || "");
  const cleanMessage = cleanDuplicateDoctorTitle(notification.message || "");
  const familyMember = notification.metadata?.familyMemberName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread" : "Read"} notification: ${cleanTitle}. ${cleanMessage}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        unread && styles.itemUnread,
        isCritical && styles.itemCritical,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isCritical
              ? "rgba(239, 68, 68, 0.15)"
              : `${visual.tint}18`,
          },
        ]}
      >
        <Ionicons
          name={isCritical ? "alert-circle" : visual.icon}
          size={20}
          color={isCritical ? Palette.error : visual.tint}
        />
      </View>

      <View style={styles.itemBody}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.itemTitle, unread && styles.itemTitleUnread]}
            numberOfLines={2}
          >
            {cleanTitle}
          </Text>
          {unread ? <View style={styles.dotUnread} /> : null}
        </View>

        {familyMember ? (
          <View style={styles.familyBadge}>
            <Ionicons
              name="people-outline"
              size={11}
              color={Palette.primaryDark}
            />
            <Text style={styles.familyBadgeText}>Patient: {familyMember}</Text>
          </View>
        ) : null}

        <Text style={styles.itemMessage} numberOfLines={3}>
          {cleanMessage}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.itemTime}>
            {timeLabel(notification.createdAt)}
          </Text>
          {isCritical ? (
            <View style={styles.criticalBadge}>
              <Ionicons name="warning" size={10} color={Palette.error} />
              <Text style={styles.criticalText}>Critical</Text>
            </View>
          ) : isHighPriority ? (
            <View style={styles.priorityBadge}>
              <Ionicons name="flash" size={10} color="#D97706" />
              <Text style={styles.priorityText}>High</Text>
            </View>
          ) : null}
          {hasRoute ? (
            <View style={styles.actionPrompt}>
              <Text style={styles.actionPromptText}>View details</Text>
              <Ionicons
                name="arrow-forward"
                size={11}
                color={Palette.primaryDark}
              />
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete notification"
        onPress={(e) => {
          e.stopPropagation?.();
          onDelete();
        }}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={16} color={Palette.textMuted} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  markAllButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  markAll: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  filterBar: {
    paddingBottom: Spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  chipBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  chipBadgeInactive: {
    backgroundColor: Palette.border,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  chipBadgeTextActive: {
    color: Palette.white,
  },
  chipBadgeTextInactive: {
    color: Palette.textMuted,
  },
  stateContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.sm,
  },
  refreshError: {
    marginBottom: Spacing.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
  },
  itemUnread: {
    backgroundColor: Palette.surface,
    borderColor: "rgba(14, 159, 142, 0.35)",
    borderLeftWidth: 4,
    borderLeftColor: Palette.primary,
  },
  itemCritical: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.error,
    backgroundColor: "rgba(239, 68, 68, 0.02)",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  itemTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
    flex: 1,
  },
  itemTitleUnread: {
    fontWeight: "700",
    color: Palette.text,
  },
  dotUnread: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginTop: 6,
  },
  familyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginVertical: 2,
  },
  familyBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  itemMessage: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
    flexWrap: "wrap",
  },
  itemTime: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  priorityText: {
    fontSize: 10,
    color: "#D97706",
    fontWeight: "700",
  },
  criticalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  criticalText: {
    fontSize: 10,
    color: Palette.error,
    fontWeight: "700",
  },
  actionPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  actionPromptText: {
    fontSize: 11,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Palette.border,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  prefSectionHeader: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  prefCard: {
    backgroundColor: Palette.background,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  prefInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  prefLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  prefSubLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  prefDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: 4,
  },
  modalFooter: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderColor: Palette.border,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  modalSaveBtn: {
    flex: 2,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveText: {
    ...Typography.bodyMedium,
    color: Palette.white,
    fontWeight: "700",
  },
});
