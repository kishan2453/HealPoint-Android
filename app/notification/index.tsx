/**
 * HealPoint Healthcare — Smart Patient Notification Center 2.0.
 *
 * Real-data healthcare event inbox strictly scoped to the authenticated patient.
 * Features:
 * - Real unread count & instant WebSocket synchronization (Socket.IO).
 * - Liquid Glass UI with visual distinction between read & unread alerts.
 * - Dynamic category filtering (only shows categories present in real data).
 * - In-memory live search across titles, messages, categories, and family members.
 * - Date-based section grouping (Today, Yesterday, Earlier).
 * - Actionable notifications with safe deep linking (Appointments, Payments, Consultations,
 *   Prescriptions, Lab Reports, Follow-Ups, Subscriptions, Digital Pass, Health Wallet, Support, Security).
 * - Patient-scoped Mark All Read & Dismissal/Deletion with optimistic sync.
 * - Page-based infinite scroll pagination.
 * - Interactive Notification Preferences & Quiet Hours management modal.
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
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

// ============================================================================
// DATE GROUPING HELPERS
// ============================================================================
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isYesterday(d: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d, yesterday);
}

function getGroupKey(dateString?: string): "Today" | "Yesterday" | "Earlier" {
  if (!dateString) return "Earlier";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  if (isSameDay(date, now)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return "Earlier";
}

function formatNotificationTime(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) return "Just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatISODate(dateString);
}

// ============================================================================
// CATEGORY DEFINITIONS & MATCHERS
// ============================================================================
interface CategoryDefinition {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  matcher: (n: Notification) => boolean;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "appointments",
    label: "Appointments",
    icon: "calendar-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "appointments" ||
        t.startsWith("appointment") ||
        t === "booking" ||
        t === "reschedule" ||
        t === "cancel" ||
        n.refModel === "appointment"
      );
    },
  },
  {
    id: "payments",
    label: "Payments",
    icon: "card-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "payments" ||
        t.startsWith("payment") ||
        t.includes("refund") ||
        t.includes("receipt")
      );
    },
  },
  {
    id: "consultations",
    label: "Consultations",
    icon: "videocam-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "consultations" ||
        t.includes("consultation") ||
        t === "meeting_ready" ||
        t === "doctor_ready" ||
        t === "online_consultation_ready"
      );
    },
  },
  {
    id: "prescriptions",
    label: "Prescriptions",
    icon: "receipt-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "prescriptions" ||
        t.includes("prescription") ||
        t.includes("medication")
      );
    },
  },
  {
    id: "reports",
    label: "Reports",
    icon: "fitness-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return c === "reports" || t.includes("report") || t.includes("lab_");
    },
  },
  {
    id: "followups",
    label: "Follow-Ups",
    icon: "repeat-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return c === "followups" || t.startsWith("followup");
    },
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: "star-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return c === "subscriptions" || t.startsWith("subscription");
    },
  },
  {
    id: "documents",
    label: "Documents",
    icon: "document-text-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return c === "documents" || t.startsWith("document") || t.includes("ocr");
    },
  },
  {
    id: "referrals",
    label: "Referrals",
    icon: "git-network-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "referrals" ||
        c === "consent" ||
        t.startsWith("referral") ||
        t.startsWith("handover") ||
        t.startsWith("consent") ||
        t.includes("clinical_referral") ||
        t.includes("clinical_handover") ||
        t.includes("clinical_consent")
      );
    },
  },
  {
    id: "support",
    label: "Support",
    icon: "help-buoy-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "support" ||
        t.startsWith("support") ||
        t.startsWith("case_") ||
        t === "service_desk"
      );
    },
  },
  {
    id: "security",
    label: "Security",
    icon: "shield-outline",
    matcher: (n) => {
      const c = (n.category || "").toLowerCase();
      const t = (n.type || "").toLowerCase();
      return (
        c === "security" ||
        t.startsWith("security") ||
        t === "system_alert" ||
        t === "admin_action"
      );
    },
  },
];

// ============================================================================
// VISUAL & ACTION RESOLVERS
// ============================================================================
export interface ActionInfo {
  label: string;
  route: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function getNotificationAction(notification: Notification): ActionInfo | null {
  const type = (notification.type || "").toLowerCase();
  const refModel = (notification.refModel || "").toLowerCase();
  const refId = notification.refId ? String(notification.refId) : "";
  const link = (notification.link || "").trim();

  // If link is a validated internal route
  if (link && INTERNAL_LINK.test(link)) {
    return {
      label: "View Details",
      route: link,
      icon: "arrow-forward-outline",
    };
  }

  // Digital Pass & QR Check-In
  if (
    type === "checkin_success" ||
    type === "checkin_confirmed" ||
    type === "patient_checked_in" ||
    type === "checkin_available"
  ) {
    return {
      label: "Digital Pass",
      route: refId ? `/appointment/pass/${refId}` : "/(drawer)/care-passport",
      icon: "qr-code-outline",
    };
  }

  // Queue Updates
  if (
    type === "queue_update" ||
    type === "queue_token_assigned" ||
    type === "queue_position_changed"
  ) {
    return {
      label: "View Queue",
      route: refId ? `/appointment/${refId}` : "/(drawer)/appointments",
      icon: "people-outline",
    };
  }

  // Consultations & Video
  if (
    type === "meeting_ready" ||
    type === "doctor_ready" ||
    type === "consultation_ready" ||
    type === "consultation_started" ||
    type === "online_consultation_ready" ||
    type === "online_consultation"
  ) {
    return {
      label: "Join Consultation",
      route: refId ? `/consultation/${refId}` : "/(drawer)/consultations",
      icon: "videocam-outline",
    };
  }

  if (type === "consultation_completed" || type === "consultation_status") {
    return {
      label: "View Summary",
      route: refId ? `/consultation/${refId}` : "/(drawer)/consultations",
      icon: "document-text-outline",
    };
  }

  // Appointments
  if (
    refModel === "appointment" ||
    type.startsWith("appointment") ||
    type === "booking" ||
    type === "reschedule" ||
    type === "cancel"
  ) {
    if (type.includes("rejected") || type.includes("cancelled")) {
      return {
        label: "View Details",
        route: refId ? `/appointment/${refId}` : "/(drawer)/appointments",
        icon: "calendar-outline",
      };
    }
    return {
      label: "View Appointment",
      route: refId ? `/appointment/${refId}` : "/(drawer)/appointments",
      icon: "calendar-outline",
    };
  }

  // Prescriptions & Meds
  if (type.includes("prescription") || type.includes("medication")) {
    return {
      label: "View Prescription",
      route: "/(drawer)/health/prescriptions",
      icon: "receipt-outline",
    };
  }

  // Lab Reports
  if (type.includes("report") || type.includes("lab_")) {
    return {
      label: "View Report",
      route: "/(drawer)/health/reports",
      icon: "fitness-outline",
    };
  }

  // Follow-ups
  if (type.startsWith("followup")) {
    return {
      label: "View Follow-Up",
      route: "/(drawer)/health/follow-ups",
      icon: "repeat-outline",
    };
  }

  // Referrals
  if (type.startsWith("referral") || type.includes("clinical_referral")) {
    return {
      label: "View Referral",
      route: "/(drawer)/health/referrals",
      icon: "git-network-outline",
    };
  }

  // Handovers & Care Continuity
  if (type.startsWith("handover") || type.includes("clinical_handover")) {
    return {
      label: "Care Continuity",
      route: "/(drawer)/care-continuity",
      icon: "swap-horizontal-outline",
    };
  }

  // Consent
  if (type.startsWith("consent") || type.includes("clinical_consent")) {
    return {
      label: "Care Passport",
      route: "/(drawer)/care-passport",
      icon: "shield-checkmark-outline",
    };
  }

  // Subscriptions
  if (type.startsWith("subscription")) {
    return {
      label: "View Subscription",
      route: "/(drawer)/subscription",
      icon: "star-outline",
    };
  }

  // Payments
  if (type.startsWith("payment")) {
    if (type.includes("fail")) {
      return {
        label: "View Payment",
        route: refId ? `/payment/${refId}` : "/(drawer)/payments/history",
        icon: "card-outline",
      };
    }
    return {
      label: "View Receipt",
      route: "/(drawer)/payments/history",
      icon: "receipt-outline",
    };
  }

  // Documents & OCR
  if (type.startsWith("document") || type.includes("ocr")) {
    return {
      label: "Health Wallet",
      route: "/(drawer)/health-wallet",
      icon: "folder-open-outline",
    };
  }

  // Support & Service Desk
  if (
    type.startsWith("support") ||
    type.startsWith("case_") ||
    type === "service_desk"
  ) {
    return {
      label: "View Support",
      route: "/(drawer)/support",
      icon: "help-buoy-outline",
    };
  }

  // Security
  if (type.startsWith("security") || type === "system_alert") {
    return {
      label: "Security Settings",
      route: "/profile/change-password",
      icon: "lock-closed-outline",
    };
  }

  // Doctor or Hospital ref
  if (refModel === "doctor" && refId) {
    return {
      label: "View Doctor",
      route: `/doctor/${refId}`,
      icon: "medkit-outline",
    };
  }

  if (refModel === "hospital" && refId) {
    return {
      label: "View Hospital",
      route: `/hospital/${refId}`,
      icon: "business-outline",
    };
  }

  return null;
}

export function getNotificationVisual(
  type?: string,
  category?: string,
): {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
} {
  const t = (type || "").trim().toLowerCase();
  const c = (category || "").trim().toLowerCase();

  if (c === "payments" || t.startsWith("payment")) {
    return {
      icon: "card-outline",
      tint: Palette.success,
      bg: "rgba(16, 185, 129, 0.12)",
    };
  }
  if (
    c === "prescriptions" ||
    t.includes("prescription") ||
    t.includes("medication")
  ) {
    return {
      icon: "receipt-outline",
      tint: "#0284C7",
      bg: "rgba(2, 132, 199, 0.12)",
    };
  }
  if (c === "reports" || t.includes("report") || t.includes("lab_")) {
    return {
      icon: "fitness-outline",
      tint: "#D97706",
      bg: "rgba(217, 119, 6, 0.12)",
    };
  }
  if (
    c === "consultations" ||
    t.includes("consultation") ||
    t.includes("meeting")
  ) {
    return {
      icon: "videocam-outline",
      tint: "#6366F1",
      bg: "rgba(99, 102, 241, 0.12)",
    };
  }
  if (c === "followups" || t.startsWith("followup")) {
    return {
      icon: "repeat-outline",
      tint: "#8B5CF6",
      bg: "rgba(139, 92, 246, 0.12)",
    };
  }
  if (c === "subscriptions" || t.startsWith("subscription")) {
    return {
      icon: "star-outline",
      tint: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.12)",
    };
  }
  if (c === "referrals" || t.startsWith("referral")) {
    return {
      icon: "git-network-outline",
      tint: "#7C3AED",
      bg: "rgba(124, 58, 237, 0.12)",
    };
  }
  if (t.startsWith("handover")) {
    return {
      icon: "swap-horizontal-outline",
      tint: "#0D9488",
      bg: "rgba(13, 148, 136, 0.12)",
    };
  }
  if (c === "consent" || t.startsWith("consent")) {
    return {
      icon: "shield-checkmark-outline",
      tint: "#059669",
      bg: "rgba(5, 150, 105, 0.12)",
    };
  }
  if (c === "documents" || t.startsWith("document") || t.includes("ocr")) {
    return {
      icon: "document-text-outline",
      tint: "#0284C7",
      bg: "rgba(2, 132, 199, 0.12)",
    };
  }
  if (c === "support" || t.startsWith("support") || t.startsWith("case_")) {
    return {
      icon: "help-buoy-outline",
      tint: "#0EA5E9",
      bg: "rgba(14, 165, 233, 0.12)",
    };
  }
  if (
    t === "checkin_success" ||
    t === "checkin_confirmed" ||
    t.includes("checkin")
  ) {
    return {
      icon: "qr-code-outline",
      tint: Palette.primaryDark,
      bg: "rgba(14, 159, 142, 0.12)",
    };
  }
  if (t.includes("queue")) {
    return {
      icon: "people-outline",
      tint: "#0284C7",
      bg: "rgba(2, 132, 199, 0.12)",
    };
  }
  if (
    c === "appointments" ||
    t.startsWith("appointment") ||
    t === "booking" ||
    t === "reschedule" ||
    t === "cancel"
  ) {
    return {
      icon: "calendar-outline",
      tint: Palette.primaryDark,
      bg: "rgba(14, 159, 142, 0.12)",
    };
  }
  if (
    c === "security" ||
    t.startsWith("security") ||
    t === "system_alert" ||
    t === "admin_action"
  ) {
    return {
      icon: "shield-outline",
      tint: Palette.error,
      bg: "rgba(239, 68, 68, 0.12)",
    };
  }
  if (t === "message_received") {
    return {
      icon: "chatbubble-ellipses-outline",
      tint: "#2563EB",
      bg: "rgba(37, 99, 235, 0.12)",
    };
  }
  return {
    icon: "notifications-outline",
    tint: Palette.primaryDark,
    bg: "rgba(14, 159, 142, 0.12)",
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  // Main state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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

  // Load initial notifications (patient-scoped)
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
          page: 1,
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
        setPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
        setError("");
        setRefreshError("");
      } catch (err) {
        if (activeUserIdRef.current !== requestUserId) return;
        if (!hasLoaded.current) {
          setNotifications([]);
          setError(toErrorMessage(err, "Unable to load notifications."));
        } else {
          setRefreshError("Could not refresh notifications. Pull down to try again.");
        }
      } finally {
        if (activeUserIdRef.current === requestUserId) setLoading(false);
      }
    },
    [userId],
  );

  // Load more pages for infinite scroll
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || page >= totalPages || !userId) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await notificationService.getNotifications({
        page: nextPage,
        limit: LIST_LIMIT,
      });

      if (res.notifications && res.notifications.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((i) => i._id));
          const fresh = res.notifications.filter((i) => !existingIds.has(i._id));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
        setTotalPages(res.totalPages || nextPage);
      }
    } catch {
      // Silent failure for infinite scroll
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, page, totalPages, userId]);

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

  // Real-time WebSocket synchronization (idempotent, deduplicated)
  useEffect(() => {
    const unsubscribe = subscribeToNotificationSync((newNotif: Notification) => {
      if (!newNotif?._id) return;
      setNotifications((prev) => {
        // Prevent duplicates by _id or eventId
        if (
          prev.some(
            (item) =>
              item._id === newNotif._id ||
              (Boolean(item.eventId) && item.eventId === newNotif.eventId) ||
              (Boolean(item.dedupKey) && item.dedupKey === newNotif.dedupKey),
          )
        ) {
          return prev;
        }
        return [newNotif, ...prev];
      });
    });
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

  // Real unread count derived from loaded dataset
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  // Dynamic category pills (Rule 2: Only show categories for which real data exists)
  const availableTabs = useMemo(() => {
    const tabs: {
      id: string;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      count: number;
    }[] = [
      {
        id: "all",
        label: "All",
        icon: "layers-outline",
        count: notifications.length,
      },
    ];

    if (unreadCount > 0) {
      tabs.push({
        id: "unread",
        label: "Unread",
        icon: "mail-unread-outline",
        count: unreadCount,
      });
    }

    for (const def of CATEGORY_DEFINITIONS) {
      const matchCount = notifications.filter(def.matcher).length;
      if (matchCount > 0) {
        tabs.push({
          id: def.id,
          label: def.label,
          icon: def.icon,
          count: matchCount,
        });
      }
    }

    return tabs;
  }, [notifications, unreadCount]);

  // Adjust active tab if it no longer exists
  useEffect(() => {
    if (activeTab !== "all" && activeTab !== "unread") {
      const exists = availableTabs.some((t) => t.id === activeTab);
      if (!exists) {
        setActiveTab("all");
      }
    }
  }, [availableTabs, activeTab]);

  // Filtered notifications by active tab and search query
  const filteredNotifications = useMemo(() => {
    let list = notifications;

    // Filter by tab
    if (activeTab === "unread") {
      list = list.filter((n) => !n.isRead);
    } else if (activeTab !== "all") {
      const def = CATEGORY_DEFINITIONS.find((d) => d.id === activeTab);
      if (def) {
        list = list.filter(def.matcher);
      }
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const title = (n.title || "").toLowerCase();
        const message = (n.message || "").toLowerCase();
        const category = (n.category || "").toLowerCase();
        const type = (n.type || "").toLowerCase();
        const actor = (n.actorName || "").toLowerCase();
        const family = (n.metadata?.familyMemberName || "").toLowerCase();
        return (
          title.includes(q) ||
          message.includes(q) ||
          category.includes(q) ||
          type.includes(q) ||
          actor.includes(q) ||
          family.includes(q)
        );
      });
    }

    return list;
  }, [notifications, activeTab, searchQuery]);

  // Date-based grouping: Today, Yesterday, Earlier
  const groupedSections = useMemo(() => {
    const groups: {
      Today: Notification[];
      Yesterday: Notification[];
      Earlier: Notification[];
    } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const item of filteredNotifications) {
      const key = getGroupKey(item.createdAt);
      groups[key].push(item);
    }

    const sections: { title: "Today" | "Yesterday" | "Earlier"; data: Notification[] }[] = [];
    if (groups.Today.length > 0) {
      sections.push({ title: "Today", data: groups.Today });
    }
    if (groups.Yesterday.length > 0) {
      sections.push({ title: "Yesterday", data: groups.Yesterday });
    }
    if (groups.Earlier.length > 0) {
      sections.push({ title: "Earlier", data: groups.Earlier });
    }

    return sections;
  }, [filteredNotifications]);

  // Actions: Mark All as Read
  const handleMarkAll = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true, deliveryStatus: "read" })),
      );
    } catch (err) {
      Alert.alert("Notice", toErrorMessage(err, "Could not mark all notifications as read."));
    } finally {
      setMarkingAll(false);
    }
  };

  // Actions: Mark Single Notification Read & Deep Link
  const handleNotificationPress = async (notification: Notification) => {
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
        await notificationService.updateNotificationRead(notification._id, true);
      } catch {
        // Rollback on failure
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notification._id ? { ...item, isRead: false } : item,
          ),
        );
      }
    }

    const action = getNotificationAction(notification);
    if (action?.route) {
      try {
        router.push(action.route as never);
      } catch {
        Alert.alert(
          "Notice",
          "The referenced record could not be loaded or is no longer available.",
        );
      }
    }
  };

  // Actions: Dismiss/Delete single notification
  const handleDeleteNotification = (notification: Notification) => {
    Alert.alert(
      "Dismiss Notification",
      "Are you sure you want to dismiss this notification from your inbox?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          style: "destructive",
          onPress: async () => {
            const previous = [...notifications];
            setNotifications((prev) => prev.filter((item) => item._id !== notification._id));
            try {
              await notificationService.deleteNotification(notification._id);
            } catch {
              // Rollback if server delete fails
              setNotifications(previous);
              Alert.alert("Notice", "Unable to dismiss notification. Please try again.");
            }
          },
        },
      ],
    );
  };

  // Preferences management
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
      }, 1000);
    } catch (err) {
      setPrefsError(toErrorMessage(err, "Failed to save preferences"));
    } finally {
      setPrefsSaving(false);
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Palette.primary}
      colors={[Palette.primary]}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* 1. PREMIUM HEADER */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={Palette.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.statusIndicatorRow}>
            {unreadCount > 0 ? (
              <View style={styles.unreadStatusBadge}>
                <View style={styles.statusDotActive} />
                <Text style={styles.unreadStatusText}>
                  {unreadCount} unread alert{unreadCount > 1 ? "s" : ""}
                </Text>
              </View>
            ) : (
              <View style={styles.caughtUpBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Palette.success} />
                <Text style={styles.caughtUpText}>All caught up</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Action: Mark All as Read */}
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            onPress={handleMarkAll}
            disabled={markingAll}
            style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <Text style={styles.markAllText}>Mark Read</Text>
            )}
          </Pressable>
        ) : null}

        {/* Quick Action: Notification Preferences */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
          onPress={openPreferences}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="options-outline" size={20} color={Palette.text} />
        </Pressable>
      </View>

      {/* 2. SEARCH BAR */}
      {!loading && !error && notifications.length > 0 ? (
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={Palette.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notifications..."
              placeholderTextColor={Palette.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={17} color={Palette.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 3. DYNAMIC CATEGORY PILLS (Real-data only) */}
      {!loading && !error && availableTabs.length > 1 ? (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {availableTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveTab(tab.id)}
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
                  <View
                    style={[
                      styles.chipBadge,
                      active ? styles.chipBadgeActive : styles.chipBadgeInactive,
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
                      {tab.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* 4. MAIN CONTENT AREA */}
      {loading ? (
        <Loading label="Loading notification center..." />
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
          {searchQuery ? (
            <EmptyState
              title="No matching alerts"
              message={`No notifications found matching "${searchQuery}".`}
              action={
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>Clear Search</Text>
                </Pressable>
              }
            />
          ) : activeTab === "unread" ? (
            <EmptyState
              title="No unread alerts"
              message="You are completely up to date with all appointments, bills, and health updates."
              action={
                <Pressable
                  onPress={() => setActiveTab("all")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>View All Alerts</Text>
                </Pressable>
              }
            />
          ) : activeTab === "appointments" ? (
            <EmptyState
              title="No appointment updates"
              message="Upcoming visits, confirmations, and reschedules will appear here."
              action={
                <Pressable
                  onPress={() => router.push("/(drawer)/appointments")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>View Appointments</Text>
                </Pressable>
              }
            />
          ) : activeTab === "payments" ? (
            <EmptyState
              title="No payment updates"
              message="Payment receipts and billing alerts will be listed here."
              action={
                <Pressable
                  onPress={() => router.push("/(drawer)/payments/history")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>Payment History</Text>
                </Pressable>
              }
            />
          ) : activeTab === "subscriptions" ? (
            <EmptyState
              title="No subscription alerts"
              message="Plan activations, renewals, and quota updates appear here."
              action={
                <Pressable
                  onPress={() => router.push("/(drawer)/subscription")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>View Plans</Text>
                </Pressable>
              }
            />
          ) : (
            <EmptyState
              title="No notifications yet"
              message="Important healthcare events, reminders, and doctor updates will appear here in real time."
              action={
                <Pressable
                  onPress={() => router.push("/(drawer)/doctors")}
                  style={styles.emptyActionBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>Explore Care Services</Text>
                </Pressable>
              }
            />
          )}
        </ScrollView>
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <NotificationItemRow
              notification={item}
              onPress={() => handleNotificationPress(item)}
              onDelete={() => handleDeleteNotification(item)}
            />
          )}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeaderWrap}>
              <View style={styles.sectionHeaderCard}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{data.length}</Text>
                </View>
              </View>
            </View>
          )}
          refreshControl={refreshControl}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            refreshError ? (
              <View style={styles.refreshError}>
                <FormMessage type="warning" message={refreshError} />
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Palette.primary} />
                <Text style={styles.footerLoaderText}>Loading earlier notifications...</Text>
              </View>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
          initialNumToRender={12}
          windowSize={7}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* 5. PREFERENCES MODAL */}
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
                  Control delivery channels, categories & quiet hours
                </Text>
              </View>
              <Pressable
                onPress={() => setPrefsModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {prefsLoading ? (
              <View style={{ padding: Spacing.xl }}>
                <Loading label="Loading preferences..." />
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {prefsError ? <FormMessage type="error" message={prefsError} /> : null}
                {prefsSuccess ? <FormMessage type="success" message={prefsSuccess} /> : null}

                {/* Delivery Channels */}
                <Text style={styles.prefSectionHeader}>Delivery Channels</Text>
                <View style={styles.prefCard}>
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons name="phone-portrait-outline" size={18} color={Palette.primary} />
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
                      trackColor={{ false: Palette.border, true: Palette.primary }}
                    />
                  </View>
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons name="notifications-outline" size={18} color={Palette.primary} />
                      <Text style={styles.prefLabel}>Device Push Notifications</Text>
                    </View>
                    <Switch
                      value={preferences.channels.push}
                      onValueChange={(val) =>
                        setPreferences((p) => ({
                          ...p,
                          channels: { ...p.channels, push: val },
                        }))
                      }
                      trackColor={{ false: Palette.border, true: Palette.primary }}
                    />
                  </View>
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons name="mail-outline" size={18} color={Palette.primary} />
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
                      trackColor={{ false: Palette.border, true: Palette.primary }}
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
                      trackColor={{ false: Palette.border, true: Palette.primary }}
                    />
                  </View>
                </View>

                {/* Categories */}
                <Text style={styles.prefSectionHeader}>Notification Categories</Text>
                <View style={styles.prefCard}>
                  {[
                    { key: "appointments", label: "Appointments & Visits", icon: "calendar-outline" },
                    { key: "consultations", label: "Consultations & Video", icon: "videocam-outline" },
                    { key: "prescriptions", label: "Prescriptions & Meds", icon: "receipt-outline" },
                    { key: "reports", label: "Lab Reports & Tests", icon: "fitness-outline" },
                    { key: "referrals", label: "Referrals & Handovers", icon: "git-network-outline" },
                    { key: "consent", label: "Consent & Approvals", icon: "shield-checkmark-outline" },
                    { key: "documents", label: "Document Processing", icon: "document-text-outline" },
                    { key: "payments", label: "Payments & Receipts", icon: "card-outline" },
                    { key: "subscriptions", label: "Subscription Plans", icon: "star-outline" },
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
                          trackColor={{ false: Palette.border, true: Palette.primary }}
                        />
                      </View>
                      {idx < arr.length - 1 ? <View style={styles.prefDivider} /> : null}
                    </React.Fragment>
                  ))}
                  <View style={styles.prefDivider} />
                  <View style={styles.prefRow}>
                    <View style={styles.prefInfo}>
                      <Ionicons name="lock-closed-outline" size={18} color={Palette.error} />
                      <Text style={[styles.prefLabel, { color: Palette.text }]}>
                        Security Alerts (Mandatory)
                      </Text>
                    </View>
                    <Switch
                      value={true}
                      disabled
                      trackColor={{ false: Palette.border, true: Palette.primary }}
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
                          Mutes non-critical alerts between 10:00 PM and 7:00 AM
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
                      trackColor={{ false: Palette.border, true: Palette.primary }}
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

// ============================================================================
// NOTIFICATION ITEM ROW COMPONENT
// ============================================================================
const NotificationItemRow = React.memo(function NotificationItemRow({
  notification,
  onPress,
  onDelete,
}: {
  notification: Notification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const unread = !notification.isRead;
  const visual = getNotificationVisual(notification.type, notification.category);
  const action = getNotificationAction(notification);
  const isCritical = notification.priority === "critical";
  const isHighPriority = notification.priority === "high";
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
      {/* Category / Event Icon */}
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isCritical ? "rgba(239, 68, 68, 0.15)" : visual.bg,
          },
        ]}
      >
        <Ionicons
          name={isCritical ? "alert-circle" : visual.icon}
          size={20}
          color={isCritical ? Palette.error : visual.tint}
        />
      </View>

      {/* Main Content */}
      <View style={styles.itemBody}>
        {/* Title & Unread Indicator */}
        <View style={styles.titleRow}>
          <Text
            style={[styles.itemTitle, unread && styles.itemTitleUnread]}
            numberOfLines={2}
          >
            {cleanTitle}
          </Text>
          {unread ? <View style={styles.dotUnread} /> : null}
        </View>

        {/* Family Member Tag */}
        {familyMember ? (
          <View style={styles.familyBadge}>
            <Ionicons name="people-outline" size={11} color={Palette.primaryDark} />
            <Text style={styles.familyBadgeText}>Patient: {familyMember}</Text>
          </View>
        ) : null}

        {/* Message */}
        <Text style={styles.itemMessage} numberOfLines={3}>
          {cleanMessage}
        </Text>

        {/* Meta / Footer row */}
        <View style={styles.metaRow}>
          <Text style={styles.itemTime}>
            {formatNotificationTime(notification.createdAt)}
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

          {/* Action Prompt */}
          {action ? (
            <View style={styles.actionPrompt}>
              {action.icon ? (
                <Ionicons name={action.icon} size={12} color={Palette.primaryDark} />
              ) : null}
              <Text style={styles.actionPromptText}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={11} color={Palette.primaryDark} />
            </View>
          ) : null}
        </View>
      </View>

      {/* Dismiss / Delete button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={(e) => {
          e.stopPropagation?.();
          onDelete();
        }}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="close" size={16} color={Palette.textMuted} />
      </Pressable>
    </Pressable>
  );
});

// ============================================================================
// STYLES
// ============================================================================
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
  statusIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  unreadStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  unreadStatusText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  caughtUpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  caughtUpText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "600",
  },
  markAllButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  markAllText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
    paddingVertical: 0,
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
    paddingVertical: 6,
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
  emptyActionBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionText: {
    ...Typography.bodySmall,
    color: Palette.white,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
  },
  sectionHeaderWrap: {
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  sectionHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Palette.surface,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 6,
  },
  sectionHeaderText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCountBadge: {
    backgroundColor: Palette.border,
    borderRadius: Radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sectionCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  itemSeparator: {
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
    backgroundColor: "rgba(14, 159, 142, 0.03)",
    borderColor: "rgba(14, 159, 142, 0.3)",
    borderLeftWidth: 4,
    borderLeftColor: Palette.primary,
  },
  itemCritical: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.error,
    backgroundColor: "rgba(239, 68, 68, 0.03)",
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
    gap: 4,
    marginLeft: "auto",
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  actionPromptText: {
    fontSize: 11,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  footerLoaderText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  footerSpacer: {
    height: Spacing.xxl,
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
