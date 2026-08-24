/**
 * HealPoint - drawer toggle (hamburger) button.
 *
 * Works from screens nested inside the drawer navigator (e.g. the patient tab
 * screens) by reaching up to the drawer parent navigation.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

interface DrawerToggleButtonProps {
  color?: string;
  style?: ViewStyle;
}

export function DrawerToggleButton({ color = Palette.text, style }: DrawerToggleButtonProps) {
  const navigation = useNavigation();

  const openDrawer = () => {
    // Handles both layouts: screens nested inside the drawer (parent is the
    // drawer) and flat screens whose `navigation` is the drawer navigator.
    const candidates = [navigation, navigation.getParent?.()];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const drawer = candidate as unknown as {
        openDrawer?: () => void;
        toggleDrawer?: () => void;
      };
      if (typeof drawer.openDrawer === 'function') {
        drawer.openDrawer();
        return;
      }
      if (typeof drawer.toggleDrawer === 'function') {
        drawer.toggleDrawer();
        return;
      }
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={openDrawer}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Ionicons name="menu" size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
  },
  pressed: {
    opacity: 0.6,
  },
});
