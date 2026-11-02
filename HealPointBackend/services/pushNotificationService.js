/**
 * HealPoint Healthcare — Expo Push Notification Service.
 *
 * Implements:
 *  - Official Expo Push API dispatch (https://exp.host/--/api/v2/push/send)
 *  - Token validation (ExponentPushToken[...] & ExpoPushToken[...])
 *  - User notification preferences enforcement (quiet hours, channels, category opt-outs)
 *  - Automatic pruning of dead/invalid tokens (DeviceNotRegistered)
 *  - Non-blocking asynchronous dispatch with zero impact on transactional paths
 */
import userModel from "../models/userModel.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Validates whether a token string is a valid Expo Push token.
 */
export function isExpoPushToken(token) {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  return (
    (trimmed.startsWith("ExponentPushToken[") || trimmed.startsWith("ExpoPushToken[")) &&
    trimmed.endsWith("]")
  );
}

/**
 * Checks whether current time falls within user's configured quiet hours.
 */
export function isInQuietHours(quietHours) {
  if (!quietHours || !quietHours.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let startMinutes = 22 * 60; // 22:00
  let endMinutes = 7 * 60; // 07:00

  if (typeof quietHours.startHour === "number") {
    startMinutes = quietHours.startHour * 60;
  } else if (typeof quietHours.start === "string" && quietHours.start.includes(":")) {
    const [h, m] = quietHours.start.split(":").map(Number);
    startMinutes = (h || 0) * 60 + (m || 0);
  }

  if (typeof quietHours.endHour === "number") {
    endMinutes = quietHours.endHour * 60;
  } else if (typeof quietHours.end === "string" && quietHours.end.includes(":")) {
    const [h, m] = quietHours.end.split(":").map(Number);
    endMinutes = (h || 0) * 60 + (m || 0);
  }

  // Overnight range (e.g. 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Same-day range (e.g. 13:00 to 15:00)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Sends push notification to a specific patient/user by userId.
 */
export async function sendExpoPushNotification({
  recipientUserId,
  title,
  body,
  data = {},
  priority = "high",
  channelId = "healpoint_alerts",
}) {
  if (!recipientUserId) return { success: false, reason: "No recipientUserId specified" };

  // Standalone Demo Mode: Suppress external push for SOS emergency alerts immediately
  const categoryName = (data.category || data.type || "").toLowerCase();
  if (
    (categoryName === "emergency" || categoryName === "sos") &&
    process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true"
  ) {
    console.log("[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.");
    return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
  }

  try {
    const user = await userModel.findById(recipientUserId).lean();
    if (!user) return { success: false, reason: "User not found" };

    const prefs = user.notificationPreferences || {};

    // 1. Check Push Channel Preference
    if (prefs.channels && prefs.channels.push === false) {
      return { success: false, reason: "User has disabled push notifications" };
    }

    // 2. Check Category Preference
    const categoryKey = (data.category || data.type || "").toLowerCase();
    if (categoryKey && prefs.categories && prefs.categories[categoryKey] === false) {
      return { success: false, reason: `User has disabled notifications for category: ${categoryKey}` };
    }

    // Standalone Demo Mode: Suppress external push for SOS emergency alerts
    const categoryName = (data.category || data.type || "").toLowerCase();
    if (
      (categoryName === "emergency" || categoryName === "sos") &&
      process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true"
    ) {
      console.log(`[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.`);
      return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
    }

    // 3. Check Quiet Hours (urgent alerts bypass quiet hours)
    if (priority !== "urgent" && isInQuietHours(prefs.quietHours)) {
      return { success: false, reason: "Notification suppressed during quiet hours" };
    }

    // 4. Collect and Deduplicate Push Tokens
    const tokenSet = new Set();
    if (Array.isArray(user.pushTokens)) {
      user.pushTokens.forEach((pt) => {
        if (pt && pt.token && isExpoPushToken(pt.token)) tokenSet.add(pt.token.trim());
      });
    }
    if (Array.isArray(user.deviceTokens)) {
      user.deviceTokens.forEach((dt) => {
        if (dt && dt.token && isExpoPushToken(dt.token)) tokenSet.add(dt.token.trim());
      });
    }
    if (user.pushToken && isExpoPushToken(user.pushToken)) {
      tokenSet.add(user.pushToken.trim());
    }

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) {
      return { success: false, reason: "No valid Expo push tokens found for user" };
    }

    // 5. Build Expo Push Messages
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: {
        ...data,
        link: data.link || "",
        timestamp: new Date().toISOString(),
      },
      priority: priority === "urgent" ? "high" : priority,
      channelId,
    }));

    // 6. Dispatch via Expo Push API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn(`[PushService] Expo push API returned HTTP ${response.status}`);
      return { success: false, status: response.status };
    }

    const result = await response.json();
    const tickets = result.data || [];

    // 7. Prune Inactive / Unregistered Tokens
    const deadTokens = [];
    tickets.forEach((ticket, idx) => {
      if (ticket.status === "error") {
        if (ticket.details?.error === "DeviceNotRegistered") {
          deadTokens.push(tokens[idx]);
        } else {
          console.warn(`[PushService] Expo ticket error for token ${tokens[idx]}:`, ticket.message);
        }
      }
    });

    if (deadTokens.length > 0) {
      await userModel.findByIdAndUpdate(recipientUserId, {
        $pull: {
          pushTokens: { token: { $in: deadTokens } },
          deviceTokens: { token: { $in: deadTokens } },
        },
      });
    }

    return {
      success: true,
      deliveredTokensCount: tokens.length - deadTokens.length,
      deadTokensPruned: deadTokens.length,
    };
  } catch (error) {
    console.warn("[PushService] Dispatch error (non-fatal):", error.message);
    return { success: false, error: error.message };
  }
}

export default {
  isExpoPushToken,
  isInQuietHours,
  sendExpoPushNotification,
};
