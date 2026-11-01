import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "@/hooks/use-network";
import { useLanguage } from "@/hooks/use-language";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";

export function OfflineBanner() {
  const { isOffline, isChecking, checkConnection } = useNetwork();
  const { t, highContrast } = useLanguage();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setShowRestored(false);
    } else if (wasOffline) {
      // Just reconnected
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.container,
          styles.restoredContainer,
          highContrast && styles.highContrastBorder,
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color="#047857" />
        <Text style={[styles.restoredText, highContrast && styles.highContrastText]}>
          {t("offline.backOnline", "Internet connection restored. Live sync active.")}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.container,
        styles.offlineContainer,
        highContrast && styles.highContrastBorder,
      ]}
    >
      <View style={styles.iconCol}>
        <Ionicons name="cloud-offline-outline" size={20} color="#B91C1C" />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, highContrast && styles.highContrastText]}>
          {t("offline.bannerTitle", "You are currently offline")}
        </Text>
        <Text style={[styles.subtitle, highContrast && styles.highContrastSubtext]}>
          {t(
            "offline.bannerSubtitle",
            "Viewing cached medical records. Internet required for bookings & payments.",
          )}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("btn.retry", "Retry connection check")}
        accessibilityHint="Tap to re-check your internet connection"
        onPress={() => checkConnection()}
        style={({ pressed }) => [
          styles.retryBtn,
          pressed && styles.pressed,
          highContrast && styles.highContrastBtn,
        ]}
        hitSlop={8}
      >
        {isChecking ? (
          <ActivityIndicator size="small" color="#B91C1C" />
        ) : (
          <Text style={styles.retryBtnText}>{t("btn.retry", "Retry")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
  },
  offlineContainer: {
    backgroundColor: "#FEE2E2",
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
  },
  restoredContainer: {
    backgroundColor: "#ECFDF5",
    borderBottomWidth: 1,
    borderBottomColor: "#A7F3D0",
  },
  iconCol: {
    marginRight: Spacing.sm,
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...Typography.body,
    fontWeight: "700",
    color: "#991B1B",
    fontSize: 13,
  },
  subtitle: {
    ...Typography.caption,
    color: "#7F1D1D",
    fontSize: 11,
    marginTop: 1,
  },
  restoredText: {
    ...Typography.body,
    color: "#065F46",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: Spacing.sm,
  },
  retryBtn: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    minWidth: 54,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#B91C1C",
  },
  pressed: {
    opacity: 0.7,
  },
  highContrastBorder: {
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
  },
  highContrastText: {
    color: "#000000",
    fontWeight: "800",
  },
  highContrastSubtext: {
    color: "#111827",
    fontWeight: "600",
  },
  highContrastBtn: {
    borderColor: "#000000",
    borderWidth: 2,
  },
});
