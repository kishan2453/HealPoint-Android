import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import "react-native-reanimated";

import { AuthProvider } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { FavoritesProvider } from "@/hooks/use-favorites";

export const unstable_settings = {
  anchor: "(drawer)",
};

// Completes any pending expo-auth-session browser flow when the app is opened
// via redirect (required for Google Sign-In to return to the app).
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <FavoritesProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation:
                  Platform.OS === "android" ? "fade_from_bottom" : "default",
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(drawer)" />
              <Stack.Screen name="(doctor)" />
              <Stack.Screen name="(admin)" />
              <Stack.Screen name="(super-admin)" />
              <Stack.Screen name="doctor/[id]" />
              <Stack.Screen name="hospital/[id]" />
              <Stack.Screen name="appointment/[id]" />
              <Stack.Screen
                name="ai-assistant"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="payment/[appointmentId]"
                options={{ title: "Secure payment" }}
              />
              <Stack.Screen
                name="appointment/reschedule/[id]"
                options={{
                  presentation: "modal",
                  title: "Reschedule appointment",
                }}
              />
              <Stack.Screen
                name="booking/[doctorId]"
                options={{ presentation: "modal", title: "Book appointment" }}
              />
              <Stack.Screen
                name="profile/edit"
                options={{ presentation: "modal", title: "Edit profile" }}
              />
              <Stack.Screen
                name="profile/change-password"
                options={{ presentation: "modal", title: "Change password" }}
              />
              <Stack.Screen
                name="notification/index"
                options={{ presentation: "modal", title: "Notifications" }}
              />
              <Stack.Screen
                name="settings/index"
                options={{ presentation: "modal", title: "Settings" }}
              />
              <Stack.Screen name="doctor/appointments" />
              <Stack.Screen name="doctor/patients" />
              <Stack.Screen name="doctor/availability" />
              <Stack.Screen name="doctor/profile" />
              <Stack.Screen name="admin/doctors" />
              <Stack.Screen name="admin/patients" />
              <Stack.Screen name="admin/hospitals" />
              <Stack.Screen name="admin/hospital-profile" />
              <Stack.Screen name="admin/doctor-verification" />
              <Stack.Screen name="admin/doctor-availability" />
              <Stack.Screen name="admin/departments" />
              <Stack.Screen name="admin/appointments" />
              <Stack.Screen name="admin/slots" />
              <Stack.Screen name="admin/payments" />
              <Stack.Screen name="admin/earnings" />
              <Stack.Screen name="admin/reviews" />
              <Stack.Screen name="admin/notifications" />
              <Stack.Screen name="admin/gallery" />
              <Stack.Screen name="admin/video-guide" />
              <Stack.Screen name="admin/subscription" />
              <Stack.Screen name="admin/reports" />
              <Stack.Screen name="super-admin/admins" />
              <Stack.Screen name="super-admin/doctors" />
              <Stack.Screen name="super-admin/patients" />
              <Stack.Screen name="super-admin/hospitals" />
              <Stack.Screen name="super-admin/specialties" />
              <Stack.Screen name="super-admin/payments" />
              <Stack.Screen name="super-admin/reports" />
              <Stack.Screen name="super-admin/system-settings" />
              <Stack.Screen name="super-admin/audit-logs" />
              <Stack.Screen name="super-admin/notifications" />
              <Stack.Screen name="super-admin/analytics" />
              <Stack.Screen name="super-admin/subscriptions" />
              <Stack.Screen name="super-admin/subscription/[id]" />
              <Stack.Screen name="super-admin/hospital/[id]" />
              <Stack.Screen name="super-admin/users" />
              <Stack.Screen name="super-admin/reviews" />
              <Stack.Screen name="super-admin/earnings" />
              <Stack.Screen name="super-admin/plans" />
              <Stack.Screen name="super-admin/messages" />
            </Stack>
            <StatusBar style="auto" />
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * HealPoint – startup error boundary.
 *
 * Expo Router wraps every screen in this layout with a `Try` that hands any
 * uncaught JavaScript error – from a missing/incorrect native module, an
 * import/syntax failure surfaced during render, or a runtime exception – to
 * this component instead of letting Expo Go dismiss it into the generic blue
 * "Something went wrong" screen.
 *
 * In development the FULL underlying error (name, message, stack) is shown so
 * the actual root cause is visible on the device. The error is deliberately
 * NOT hidden behind a friendly message.
 */
type StartupErrorBoundaryProps = {
  error: Error;
  retry: () => void;
};

export function ErrorBoundary({ error, retry }: StartupErrorBoundaryProps) {
  const name = error?.name || "Error";
  const message = error?.message || "Unknown error";
  const stack = __DEV__ && error?.stack ? error.stack : "";

  return (
    <View style={styles.errorContainer}>
      <ScrollView
        style={styles.errorScroll}
        contentContainerStyle={{ padding: 24 }}
        testID="healpoint_startup_error"
      >
        <Text style={styles.errorTitle}>HealPoint failed to start</Text>

        <Text style={styles.errorMessage}>{`${name}: ${message}`}</Text>

        {__DEV__ && stack ? (
          <Text selectable allowFontScaling style={styles.errorStack}>
            {stack}
          </Text>
        ) : null}

        <Text style={styles.errorHint}>
          {Platform.OS === "web"
            ? "This is a JavaScript startup error."
            : "If this mentions a native module (reanimated, secure-store, razorpay, …), the phone’s Expo Go build does not bundle it. Open with a development build (npx expo run:android) or install the Expo Go version that matches this project’s Expo SDK."}
        </Text>
      </ScrollView>

      <Pressable onPress={retry} style={styles.retryButton}>
        {({ hovered, pressed }) => (
          <Text
            style={[
              styles.retryText,
              (hovered || pressed) && styles.retryTextActive,
            ]}
          >
            Retry
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: "#0E9F8E",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorScroll: {
    flex: 1,
    backgroundColor: "#0E9F8E",
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  errorMessage: {
    color: "#FFF7E6",
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 16,
  },
  errorStack: {
    color: "#1B2A28",
    fontSize: 12,
    fontFamily: Platform.select({
      default: "monospace",
      ios: "monospace",
      android: "monospace",
    }),
    lineHeight: 16,
    marginBottom: 16,
  },
  errorHint: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
    backgroundColor: "#0E9F8E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    marginTop: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  retryTextActive: {
    color: "#062A25",
  },
});
