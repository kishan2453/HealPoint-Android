/**
 * HealPoint - Hospital Admin · Notifications Screen.
 * Real MongoDB notifications scoped to this hospital admin, with live unread badge,
 * read/unread status filters, category icons, single/bulk mark as read, and delete.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { FilterChips } from "@/components/admin/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatISODate } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as notificationsService from "@/services/notifications";
import type { Notification } from "@/types";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Read", value: "read" },
];

const TYPE_FILTERS = [
  { label: "All Types", value: "all" },
  { label: "Appointments", value: "appointment" },
  { label: "Doctor Updates", value: "doctor" },
  { label: "System", value: "system" },
];

function resolveNotificationConfig(type?: string): {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route?: string;
} {
  const t = String(type || "").toLowerCase();
  if (t.includes("appointment")) {
    return {
      name: "calendar",
      color: "#0E9F8E",
      bgColor: "#0E9F8E1A",
      route: "/admin/appointments",
    };
  }
  if (t.includes("doctor") || t.includes("verification")) {
    return {
      name: "medkit",
      color: "#2F80ED",
      bgColor: "#2F80ED1A",
      route: "/admin/doctors",
    };
  }
  if (t.includes("payment") || t.includes("subscription")) {
    return {
      name: "card",
      color: "#7B61FF",
      bgColor: "#7B61FF1A",
      route: "/admin/subscription",
    };
  }
  if (t.includes("review")) {
    return {
      name: "star",
      color: "#F2994A",
      bgColor: "#F2994A1A",
      route: "/admin/reviews",
    };
  }
  return {
    name: "notifications",
    color: "#5F6F6C",
    bgColor: "#5F6F6C1A",
  };
}

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState("all");

  // Modal / Action State
  const [markingAll, setMarkingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError("");
      try {
        const res = await notificationsService.getNotifications({
          status: statusFilter,
          type: typeFilter !== "all" ? typeFilter : undefined,
        });
        setNotifications(res.notifications || []);
        setUnreadCount(
          typeof res.unreadCount === "number" ? res.unreadCount : 0,
        );
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load notifications."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, typeFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to mark all as read."));
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleReadStatus = async (item: Notification) => {
    const nextState = !item.isRead;
    try {
      await notificationsService.updateNotificationRead(
        String(item._id),
        nextState,
      );
      setNotifications((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, isRead: nextState } : n)),
      );
      setUnreadCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    } catch (err) {
      setError(toErrorMessage(err, "Unable to update notification status."));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await notificationsService.deleteNotification(String(deleteTarget._id));
      setNotifications((prev) =>
        prev.filter((n) => n._id !== deleteTarget._id),
      );
      if (!deleteTarget.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to delete notification."));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (typeFilter === "all") return notifications;
    return notifications.filter((n) => {
      const t = String(n.type || "").toLowerCase();
      return t.includes(typeFilter);
    });
  }, [notifications, typeFilter]);

  return (
    <AdminModuleScreen
      title="Notifications"
      subtitle={unreadCount + " unread alert" + (unreadCount === 1 ? "" : "s")}
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Stats & Mark All Read */}
            <View style={styles.topActionsRow}>
              <View style={styles.badgeRow}>
                <Badge
                  label={unreadCount + " Unread"}
                  variant={unreadCount > 0 ? "primary" : "neutral"}
                />
                <Text style={styles.totalText}>
                  {notifications.length +
                    " total notification" +
                    (notifications.length === 1 ? "" : "s")}
                </Text>
              </View>
              {unreadCount > 0 && (
                <Button
                  title="Mark all read"
                  variant="outline"
                  fullWidth={false}
                  loading={markingAll}
                  style={styles.markAllBtn}
                  onPress={handleMarkAllRead}
                />
              )}
            </View>

            {/* Status Filter Chips */}
            <FilterChips
              options={STATUS_FILTERS}
              selected={statusFilter}
              onSelect={(val) =>
                setStatusFilter(val as "all" | "read" | "unread")
              }
            />

            {/* Type Filter Chips */}
            <FilterChips
              options={TYPE_FILTERS}
              selected={typeFilter}
              onSelect={setTypeFilter}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            message={
              statusFilter !== "all" || typeFilter !== "all"
                ? "No notifications match your current filters."
                : "You are all caught up! New alerts will appear here."
            }
          />
        }
        renderItem={({ item }) => {
          const config = resolveNotificationConfig(item.type);
          const isHighPriority = item.priority === "high";

          return (
            <Card style={[styles.card, !item.isRead && styles.cardUnread]}>
              <View style={styles.cardMain}>
                {/* Icon Circle */}
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: config.bgColor },
                  ]}
                >
                  <Ionicons name={config.name} size={20} color={config.color} />
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.titleText,
                        !item.isRead && styles.titleTextUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {item.title || "Notification"}
                    </Text>
                    {isHighPriority ? (
                      <Badge label="High" variant="error" />
                    ) : item.isRead ? (
                      <Badge label="Read" variant="neutral" />
                    ) : (
                      <Badge label="New" variant="primary" />
                    )}
                  </View>

                  {item.message ? (
                    <Text style={styles.messageText}>{item.message}</Text>
                  ) : null}

                  <View style={styles.metaRow}>
                    <Text style={styles.dateText}>
                      {formatISODate(item.createdAt)}
                    </Text>
                    {item.actorName ? (
                      <Text style={styles.actorText}>By {item.actorName}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Bottom Quick Action Bar */}
              <View style={styles.cardFooter}>
                <Pressable
                  style={styles.footerBtn}
                  onPress={() => toggleReadStatus(item)}
                  accessibilityLabel="Toggle read status"
                >
                  <Ionicons
                    name={
                      item.isRead ? "mail-unread-outline" : "mail-open-outline"
                    }
                    size={16}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.footerBtnText}>
                    {item.isRead ? "Mark as unread" : "Mark as read"}
                  </Text>
                </Pressable>

                {config.route ? (
                  <Pressable
                    style={styles.footerBtn}
                    onPress={() => router.push(config.route as never)}
                    accessibilityLabel="Open related view"
                  >
                    <Ionicons
                      name="arrow-forward-circle-outline"
                      size={16}
                      color={Palette.primary}
                    />
                    <Text
                      style={[styles.footerBtnText, { color: Palette.primary }]}
                    >
                      View details
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => setDeleteTarget(item)}
                  accessibilityLabel="Delete notification"
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={Palette.error}
                  />
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? It will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  topActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  totalText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  markAllBtn: {
    minHeight: 34,
    paddingHorizontal: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
    backgroundColor: Palette.surface,
  },
  cardMain: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  titleText: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
  },
  titleTextUnread: {
    fontWeight: "700",
  },
  messageText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  dateText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  actorText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  footerBtnText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  deleteBtn: {
    padding: 4,
  },
});
