/**
 * HealPoint - heart toggle that saves a doctor or hospital to the patient's account.
 */
import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Palette } from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";

interface FavoriteButtonProps {
  doctorId?: string;
  hospitalId?: string;
  type?: "doctor" | "hospital";
  size?: number;
  style?: StyleProp<ViewStyle>;
  activeColor?: string;
  inactiveColor?: string;
}

export function FavoriteButton({
  doctorId,
  hospitalId,
  type = hospitalId ? "hospital" : "doctor",
  size = 24,
  style,
  activeColor = Palette.error,
  inactiveColor = Palette.textMuted,
}: FavoriteButtonProps) {
  const {
    isFavorite,
    isFavoriteHospital,
    toggleFavorite,
    toggleFavoriteHospital,
  } = useFavorites();

  const isHospital = type === "hospital" || Boolean(hospitalId);
  const targetId = isHospital ? hospitalId : doctorId;
  const active = targetId
    ? isHospital
      ? isFavoriteHospital(targetId)
      : isFavorite(targetId)
    : false;

  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = async () => {
    if (!targetId) return;

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.78,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3.5,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      if (isHospital) {
        await toggleFavoriteHospital(targetId);
      } else {
        await toggleFavorite(targetId);
      }
    } catch {
      // Failure state is rolled back by the favorites store
    }
  };

  const label = active
    ? isHospital
      ? "Remove hospital from favorites"
      : "Remove doctor from favorites"
    : isHospital
      ? "Save hospital to favorites"
      : "Save doctor to favorites";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      hitSlop={10}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? "heart" : "heart-outline"}
          size={size}
          color={active ? activeColor : inactiveColor}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
