/**
 * HealPoint Healthcare — Expo Push Notification Service (Expo SDK 54).
 *
 * Implements:
 *  - Android notification channel setup ("healpoint_alerts")
 *  - System notification permission request & status check
 *  - Expo Push Token registration with backend (/api/v1/notification/register-push-token)
 *  - Foreground notification presentation handler
 *  - Background & foreground notification response listeners (deep link tap handling)
 *  - Graceful fallback on web and simulators
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./notifications";

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers device for Expo Push Notifications and posts the token to HealPoint backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Web platform does not support Expo Push tokens directly
  if (Platform.OS === "web") {
    return null;
  }

  // Simulator / Emulator check
  if (!Device.isDevice) {
    console.info("[PushNotification] Physical device recommended for native push notification testing.");
    return null;
  }

  try {
    // 1. Android Notification Channel Setup
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("healpoint_alerts", {
        name: "HealPoint Alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563EB",
        sound: "default",
      });
    }

    // 2. Permission Check & Request
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[PushNotification] Notification permissions not granted by user.");
      return null;
    }

    // 3. Obtain Expo Push Token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;

    // 4. Send token to HealPoint backend
    if (token) {
      await registerPushToken(token);
      console.log("[PushNotification] Device registered successfully:", token);
      return token;
    }

    return null;
  } catch (error: any) {
    console.warn("[PushNotification] Registration error (graceful fallback):", error?.message || error);
    return null;
  }
}

/**
 * Attaches deep link router listener when user taps a push notification.
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (link: string, data: any) => void
) {
  if (Platform.OS === "web") {
    return () => {};
  }

  // Foreground notification received listener
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    }
  );

  // Notification response listener (user tapped notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data || {};
      const link = (data.link as string) || (data.route as string) || "";
      if (onNotificationTapped) {
        onNotificationTapped(link, data);
      }
    }
  );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export default {
  registerForPushNotificationsAsync,
  setupNotificationListeners,
};
