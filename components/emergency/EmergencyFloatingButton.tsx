/**
 * HealPoint - Floating Emergency SOS Button.
 * Always accessible 1-tap emergency trigger with animated glow.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Shadows, Typography } from "@/constants/theme";

interface EmergencyFloatingButtonProps {
  onPress?: () => void;
}

export function EmergencyFloatingButton({ onPress }: EmergencyFloatingButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push("/emergency" as any);
    }
  };

  return (
    <Pressable style={styles.floatingButton} onPress={handlePress} hitSlop={8}>
      <View style={styles.innerCircle}>
        <Ionicons name="warning" size={20} color="#FFFFFF" />
        <Text style={styles.sosText}>SOS</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 84,
    right: 20,
    zIndex: 999,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Shadows.lg,
  },
  innerCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  sosText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginTop: -2,
  },
});

