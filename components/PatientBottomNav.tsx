/**
 * HealPoint — Instagram-Inspired Mobile Bottom Navigation.
 *
 * Sits persistently at the bottom of patient-facing screens with HealPoint
 * healthcare branding (teal & blue palette), real-time unread badges, active
 * state indicators, and the authenticated user's real profile photo.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette, Shadows } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationBadge } from "@/hooks/use-notifications";
import { getUserImage } from "@/lib/image";

export type PatientNavTab =
  | "home"
  | "video"
  | "messages"
  | "search"
  | "profile"
  | "appointments"
  | "health";

interface PatientBottomNavProps {
  activeTab?: PatientNavTab;
}

export function PatientBottomNav({ activeTab }: PatientBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadCount } = useNotificationBadge({ intervalMs: 30000 });

  // Map route to active tab
  const currentTab: PatientNavTab = useMemo(() => {
    if (activeTab === "appointments") return "appointments";
    if (activeTab === "health") return "home";
    if (activeTab) return activeTab;
    if (!pathname || pathname === "/" || pathname === "/(drawer)" || pathname === "/(drawer)/") {
      return "home";
    }
    if (pathname.includes("consult-online") || (pathname.includes("video") && !pathname.includes("doctors"))) {
      return "video";
    }
    if (
      pathname.includes("doctors") ||
      pathname.includes("search") ||
      pathname.includes("hospitals")
    ) {
      return "search";
    }
    if (pathname.includes("appointments")) {
      return "appointments";
    }
    if (pathname.includes("profile") || pathname.includes("settings")) {
      return "profile";
    }
    return "home";
  }, [activeTab, pathname]);

  const avatarUrl = useMemo(() => {
    return user?.image ? getUserImage(user.image) : "";
  }, [user?.image]);

  const userInitial = useMemo(() => {
    return user?.name ? user.name.trim().charAt(0).toUpperCase() : "P";
  }, [user?.name]);

  const tabs: {
    key: PatientNavTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    route: string;
    showBadge?: boolean;
    isAvatar?: boolean;
  }[] = [
    {
      key: "home",
      label: "Home",
      icon: "home-outline",
      activeIcon: "home",
      route: "/(drawer)",
    },
    {
      key: "search",
      label: "Find Doctor",
      icon: "search-outline",
      activeIcon: "search",
      route: "/(drawer)/doctors",
    },
    {
      key: "video",
      label: "Consult",
      icon: "videocam-outline",
      activeIcon: "videocam",
      route: "/(drawer)/consult-online",
    },
    {
      key: "appointments",
      label: "Appointments",
      icon: "calendar-outline",
      activeIcon: "calendar",
      route: "/(drawer)/appointments",
    },
    {
      key: "profile",
      label: "Profile",
      icon: "person-outline",
      activeIcon: "person",
      route: "/(drawer)/profile",
      isAvatar: true,
    },
  ];

  const handlePress = (tab: (typeof tabs)[0]) => {
    if (tab.key === currentTab) return;
    if (tab.key === "home") {
      router.replace("/(drawer)");
    } else {
      router.push(tab.route as never);
    }
  };

  const bottomPadding = Math.max(insets.bottom, 6);

  return (
    <View style={[styles.outerWrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navContainer}>
        {tabs.map((tab) => {
          const isActive = tab.key === currentTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityState={{ selected: isActive }}
              onPress={() => handlePress(tab)}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              {tab.isAvatar ? (
                <View
                  style={[
                    styles.avatarWrapper,
                    isActive ? styles.avatarWrapperActive : styles.avatarWrapperInactive,
                  ]}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {userInitial}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={isActive ? tab.activeIcon : tab.icon}
                    size={24}
                    color={isActive ? Palette.primary : "#64748B"}
                  />
                  {tab.showBadge ? (
                    <View style={styles.unreadDot} />
                  ) : null}
                </View>
              )}

              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>

              {isActive ? <View style={styles.activePillIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.85)",
    paddingTop: 6,
    ...Shadows.md,
    zIndex: 90,
  },
  navContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    maxWidth: 540,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    minHeight: 44,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.error,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarWrapperActive: {
    borderWidth: 2,
    borderColor: Palette.primary,
  },
  avatarWrapperInactive: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  avatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E6F4F2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  tabLabelActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  activePillIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.primary,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
});
