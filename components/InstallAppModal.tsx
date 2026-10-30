import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { getStorageItem, setStorageItem } from "@/lib/storage";

const DISMISS_KEY = "healpoint_install_dismissed_at";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppModal() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    // 1. Check if already installed or running in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) {
      return;
    }

    // 2. Check 7-day cooldown
    async function checkCooldownAndInit() {
      try {
        const lastDismissed = await getStorageItem(DISMISS_KEY);
        if (lastDismissed) {
          const diff = Date.now() - parseInt(lastDismissed, 10);
          if (diff < COOLDOWN_MS) {
            return; // Still in cooldown period
          }
        }
      } catch {
        // Continue if reading storage fails
      }

      // Check if iOS Safari
      const ua = window.navigator.userAgent || "";
      const isIosDevice =
        /iPad|iPhone|iPod/.test(ua) &&
        !(window as unknown as { MSStream?: unknown }).MSStream;
      setIsIos(isIosDevice);

      // Listen for Chrome/Android beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      // On iOS Safari, beforeinstallprompt is not supported, so show prompt after delay
      let iosTimer: ReturnType<typeof setTimeout> | null = null;
      if (isIosDevice) {
        iosTimer = setTimeout(() => {
          setVisible(true);
        }, 3000);
      }

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        if (iosTimer) clearTimeout(iosTimer);
      };
    }

    const cleanupPromise = checkCooldownAndInit();
    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  const handleDismiss = async () => {
    setVisible(false);
    setShowIosGuide(false);
    try {
      await setStorageItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore error
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
        }
      } catch {
        // Fallback
      } finally {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // Generic web fallback
      alert(
        "To install HealPoint, open your browser menu (⋮) and tap 'Install app' or 'Add to Home screen'."
      );
      handleDismiss();
    }
  };

  if (!visible || Platform.OS !== "web") {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={Palette.textMuted} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="fitness" size={28} color={Palette.primary} />
            </View>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>Fast & Offline Access</Text>
            </View>
          </View>

          <Text style={styles.title}>Install HealPoint</Text>
          <Text style={styles.description}>
            Install HealPoint for quicker access to appointments,
            prescriptions, health records, and reminders.
          </Text>

          {showIosGuide ? (
            <View style={styles.iosGuideBox}>
              <Text style={styles.iosGuideTitle}>How to install on iOS:</Text>
              <View style={styles.iosStepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <Text style={styles.iosStepText}>
                  Tap the <Text style={styles.boldText}>Share</Text> button in
                  Safari's bottom toolbar{" "}
                  <Ionicons name="share-outline" size={15} color={Palette.primary} />
                </Text>
              </View>
              <View style={styles.iosStepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <Text style={styles.iosStepText}>
                  Scroll down and tap{" "}
                  <Text style={styles.boldText}>Add to Home Screen</Text>{" "}
                  <Ionicons
                    name="add-circle-outline"
                    size={15}
                    color={Palette.primary}
                  />
                </Text>
              </View>
              <View style={styles.iosStepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <Text style={styles.iosStepText}>
                  Tap <Text style={styles.boldText}>Add</Text> in the top-right
                  corner
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons
                  name="flash-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.featureText}>Instant home screen launch</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="notifications-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.featureText}>
                  Live appointment alerts & reminders
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.featureText}>
                  Zero download storage space needed
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title="Maybe Later"
              variant="outline"
              onPress={handleDismiss}
              style={styles.actionBtn}
            />
            <Button
              title={showIosGuide ? "Got It" : "Install App"}
              variant="primary"
              icon="download-outline"
              onPress={showIosGuide ? handleDismiss : handleInstallClick}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Palette.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    position: "relative",
    ...Shadows.lg,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  badgeWrap: {
    backgroundColor: "rgba(14, 159, 142, 0.10)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
    fontSize: 11,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "700",
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  description: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  featureList: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
    fontSize: 12,
  },
  iosGuideBox: {
    width: "100%",
    backgroundColor: "#F0FDFA",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.20)",
  },
  iosGuideTitle: {
    ...Typography.bodyMedium,
    color: Palette.primaryDark,
    fontWeight: "700",
    marginBottom: 2,
  },
  iosStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: Palette.white,
    fontSize: 11,
    fontWeight: "700",
  },
  iosStepText: {
    ...Typography.caption,
    color: Palette.text,
    flex: 1,
    fontSize: 12,
  },
  boldText: {
    fontWeight: "700",
    color: Palette.text,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
