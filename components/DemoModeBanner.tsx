import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette, Radius, Spacing } from "@/constants/theme";

export function DemoModeBanner() {
  const [modalVisible, setModalVisible] = useState(false);

  const showDemoNotice = () => {
    Alert.alert(
      "HEALPOINT DEMO PLATFORM",
      "HealPoint is an educational project and developer portfolio demonstration platform.\n\n• Not a real hospital, clinic, or healthcare service.\n• All doctor, hospital, and patient identities are synthetic.\n• Emergency SOS is strictly an internal simulation.\n• Payments are demo transactions with 0 real charges.",
      [{ text: "Close", style: "default" }]
    );
  };

  return (
    <Pressable
      style={styles.banner}
      onPress={showDemoNotice}
      accessibilityRole="button"
      accessibilityLabel="HealPoint Demo Platform Indicator. Tap for information."
    >
      <View style={styles.content}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>DEMO MODE</Text>
        </View>
        <Text style={styles.text} numberOfLines={1}>
          Educational simulation only · Not a real healthcare service
        </Text>
        <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#0284C7", // HealPoint Royal Blue
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pill: {
    backgroundColor: "#F59E0B",
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pillText: {
    color: "#0F172A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
});
