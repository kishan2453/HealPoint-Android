/**
 * HealPoint - Notifications (patient).
 *
 * Real notifications from the backend (`GET /notification/get-all`) scoped to
 * the logged-in user's token. Unread notifications are clearly highlighted;
 * tapping one marks it read (existing `PATCH /notification/read/:id`) and -- when
 * the notification carries a `link` to a known user-side screen -- opens that
 * screen. "Mark all read" uses the existing `PATCH /notification/mark-all`.
 *
 * Nothing here is mocked: loading/empty/error states and read-state changes all
 * reflect real backend data.
 *
 * The screen is scoped to the current user: on login switch the previous user's
 * notifications are cleared immediately and stale in-flight responses for a
 * previous user are discarded so one patient's notifications can never leak
 * to another.
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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import type { Notification } from "@/types";

const LIST_LIMIT = 50;

/** Known user-side routes a notification `link` may safely point to. */
const INTERNAL_LINK =
  /^\/(appointment|booking|payment|doctor|hospital|profile|notification|consultation|health|reviews)(\/|$)/;

type FilterCategory =
  | "all"
  | "unread"
  | "appointments"
  | "clinical"
  | "billing";

const CATEGORY_TABS: { id: FilterCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "appointments", label: "Appointments" },
  { id: "clinical", label: "Clinical" },
  { id: "billing", label: "Billing" },
];

function notificationVisual(type?: string): {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
} {
  const key = (type || "").trim().toLowerCase();
  if (key.startsWith("payment") || key.startsWith("subscription")) {
    return { icon: "card-outline", tint: Palette.success };
  }
  if (key === "prescription_uploaded") {
    return { icon: "document-text-outline", tint: Palette.primary };
  }
  if (key === "report_uploaded") {
    return { icon: "fitness-outline", tint: "#E89A3C" };
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
  if (key === "system_alert" || key === "admin_action") {
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
    type === "online_consultation"
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
  if (type === "prescription_uploaded") {
    return "/(drawer)/health/prescriptions";
  }
  if (type === "report_uploaded") {
    return "/(drawer)/health/reports";
  }
  if (type.startsWith("payment") || type.startsWith("subscription")) {
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
        prev.map((item) => ({ ...item, isRead: true })),
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
          item._id === notification._id ? { ...item, isRead: true } : item,
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
      // Reload on failure
      load(true);
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
        const t = (item.type || "").toLowerCase();
        return (
          t.startsWith("appointment") ||
          t === "booking" ||
          item.refModel === "appointment"
        );
      });
    }
    if (activeCategory === "clinical") {
      return notifications.filter((item) => {
        const t = (item.type || "").toLowerCase();
        return (
          t === "prescription_uploaded" ||
          t === "report_uploaded" ||
          t === "message_received"
        );
      });
    }
    if (activeCategory === "billing") {
      return notifications.filter((item) => {
        const t = (item.type || "").toLowerCase();
        return t.startsWith("payment") || t.startsWith("subscription");
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
          <Text style={styles.headerTitle}>Notifications</Text>
          {notifications.length > 0 ? (
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                : "All caught up"}
            </Text>
          ) : null}
        </View>
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
              <Text style={styles.markAll}>Mark all read</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
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
                ? "No unread notifications"
                : activeCategory === "appointments"
                  ? "No appointment alerts"
                  : activeCategory === "clinical"
                    ? "No medical record alerts"
                    : activeCategory === "billing"
                      ? "No payment notifications"
                      : "No notifications yet"
            }
            message={
              activeCategory === "unread"
                ? "You are all caught up on your healthcare updates!"
                : "Appointment updates, doctor notes, and alerts will appear here."
            }
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
  const isHighPriority = notification.priority === "high";
  const hasRoute = Boolean(getNotificationRoute(notification));
  const cleanTitle = cleanDuplicateDoctorTitle(notification.title || "");
  const cleanMessage = cleanDuplicateDoctorTitle(notification.message || "");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread" : "Read"} notification: ${cleanTitle}. ${cleanMessage}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        unread && styles.itemUnread,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: `${visual.tint}18` }]}
      >
        <Ionicons name={visual.icon} size={20} color={visual.tint} />
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

        <Text style={styles.itemMessage} numberOfLines={3}>
          {cleanMessage}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.itemTime}>
            {timeLabel(notification.createdAt)}
          </Text>
          {isHighPriority ? (
            <View style={styles.priorityBadge}>
              <Ionicons name="flash" size={10} color={Palette.error} />
              <Text style={styles.priorityText}>Priority</Text>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },
  markAll: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 44,
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
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  priorityText: {
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
});
