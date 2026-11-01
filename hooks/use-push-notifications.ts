/**
 * HealPoint Healthcare — Hook for Push Notifications & Deep Routing.
 *
 * Automatically registers device token when user is logged in,
 * and handles notification tap events for seamless deep linking.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "./use-auth";
import {
  registerForPushNotificationsAsync,
  setupNotificationListeners,
} from "@/services/pushNotifications";

export function usePushNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;
  const isRegisteredRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      isRegisteredRef.current = false;
      return;
    }

    if (!isRegisteredRef.current) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) isRegisteredRef.current = true;
      });
    }

    // Set up listeners for received and tapped notifications
    const cleanup = setupNotificationListeners(
      (notification) => {
        // Can be used to sync unread badge or show subtle in-app notification banner
      },
      (link) => {
        if (link && typeof link === "string" && link.startsWith("/")) {
          try {
            router.push(link as any);
          } catch (err) {
            console.warn("[usePushNotifications] Navigation error for link:", link, err);
          }
        }
      }
    );

    return cleanup;
  }, [userId, router]);
}

export default usePushNotifications;
