/**
 * HealPoint - premium, role-aware drawer content.
 *
 * Shows the brand header (logo, avatar, name, email, role) then the role's
 * grouped menu. Every item navigates to a real route and closes the drawer.
 */
import { Ionicons } from "@expo/vector-icons";
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HealPointLogo } from "@/components/HealPointLogo";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { drawerMenuForRole } from "@/lib/drawer-menu";
import { getUserImage } from "@/lib/image";
import { canonicalRole } from "@/lib/roles";

function menuHrefPath(href: unknown): string {
  const raw = typeof href === "string" ? href : String(href ?? "");
  return raw.split("?")[0];
}

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { navigation } = props;
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const role = canonicalRole(user?.role);
  const sections = drawerMenuForRole(role);
  const roleLabel = role.replace("_", " ");

  const navigate = (href: unknown) => {
    navigation.closeDrawer();
    // Small delay lets the drawer close before the navigation starts so the
    // transition stays smooth on Android.
    setTimeout(() => {
      router.navigate(href as never);
    }, 60);
  };

  const isActive = (href: unknown) => {
    const target = menuHrefPath(href);
    if (
      !target ||
      target === "/" ||
      target === "/(drawer)" ||
      target === "/(doctor)" ||
      target === "/(admin)" ||
      target === "/(super-admin)"
    ) {
      return pathname === "/";
    }
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigation.closeDrawer();
      router.replace("/login" as never);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.root}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Brand header ---- */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <HealPointLogo size={40} layout="horizontal" />
          </View>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {user?.image ? (
                <Image
                  source={{ uri: getUserImage(user.image) }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={150}
                />
              ) : null}
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {(user?.name || "HP").slice(0, 2).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.profileTexts}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name || "HealPoint User"}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email || ""}
              </Text>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---- Menu sections ---- */}
        <View style={styles.menu}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {section.title.toUpperCase()}
              </Text>
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Pressable
                    key={item.label}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => navigate(item.href)}
                    style={({ pressed }) => [
                      styles.item,
                      active && styles.itemActive,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <View
                      style={[styles.itemIcon, active && styles.itemIconActive]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={active ? Palette.primaryDark : Palette.textMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.itemLabel,
                        active && styles.itemLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {active ? <View style={styles.activeDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* ---- Footer / logout ---- */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Logout"
          onPress={logout}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.logout,
            pressed && styles.itemPressed,
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={Palette.error} />
          ) : (
            <Ionicons name="log-out-outline" size={20} color={Palette.error} />
          )}
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  header: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    ...Typography.h3,
    color: Palette.primaryDark,
  },
  profileTexts: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.h4,
    color: Palette.text,
  },
  email: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  roleText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  menu: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  itemActive: {
    backgroundColor: Palette.primaryLight,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconActive: {
    backgroundColor: Palette.surface,
  },
  itemLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
  },
  itemLabelActive: {
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    padding: Spacing.lg,
    backgroundColor: Palette.surface,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.error,
    paddingVertical: Spacing.md,
  },
  logoutText: {
    ...Typography.label,
    color: Palette.error,
  },
});
