import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette, Spacing } from "@/constants/theme";

export function DemoModeBanner() {
  const showNotice = () => {
    Alert.alert(
      "ANAND HEALPOINT — EDUCATIONAL SIMULATION",
      "Anand HealPoint is an educational healthcare appointment simulation platform for student demonstration and portfolio evaluation.\n\n• Educational simulation only.\n• Not a real healthcare provider or emergency service.\n• All appointments, doctors, and hospitals are simulated.\n• Online payments operate in simulation sandbox with zero real charges.",
      [{ text: "Close", style: "default" }]
    );
  };

  return (
    <Pressable
      style={styles.banner}
      onPress={showNotice}
      accessibilityRole="button"
      accessibilityLabel="Educational simulation notice. Tap for information."
    >
      <View style={styles.content}>
        <Ionicons name="school-outline" size={14} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={1}>
          Educational simulation only. This is not a real healthcare provider or emergency service.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#1E40AF", // Deep Royal Navy Blue
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
