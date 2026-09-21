/**
 * HealPoint - search bar with clear action.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Palette, Radius, Spacing } from "@/constants/theme";

interface SearchBarProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  containerStyle,
  ...props
}: SearchBarProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={20} color={Palette.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        {...props}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText("")}
          hitSlop={8}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Ionicons name="close-circle" size={20} color={Palette.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Palette.text,
    paddingVertical: Spacing.sm,
  },
  clear: {
    padding: 2,
  },
  pressed: {
    opacity: 0.5,
  },
});
