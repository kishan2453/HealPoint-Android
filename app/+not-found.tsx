import { Link, Stack } from "expo-router";
import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Page Not Found", headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="medical-outline" size={64} color="#0D9488" />
        </View>
        <Text style={styles.errorCode}>404</Text>
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.message}>
          The page or screen you are looking for doesn't exist or may have been moved.
        </Text>
        <Link href="/" asChild>
          <Pressable style={styles.linkButton}>
            <Ionicons name="home-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.linkText}>Return to Home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorCode: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 420,
    lineHeight: 20,
    marginBottom: 28,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D9488",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  linkText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
