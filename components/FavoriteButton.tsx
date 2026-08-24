/**
 * HealPoint - heart toggle that saves a doctor to the patient's account.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette } from '@/constants/theme';
import { useFavorites } from '@/hooks/use-favorites';

interface FavoriteButtonProps {
  doctorId: string;
  size?: number;
}

export function FavoriteButton({ doctorId, size = 24 }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(doctorId);

  const handlePress = async () => {
    try {
      await toggleFavorite(doctorId);
    } catch {
      // Failure state is already rolled back by the favorites store.
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={active ? 'heart' : 'heart-outline'}
        size={size}
        color={active ? Palette.error : Palette.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});