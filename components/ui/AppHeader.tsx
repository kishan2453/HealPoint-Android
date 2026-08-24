/**
 * HealPoint - app header with optional back navigation.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Typography } from '@/constants/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function AppHeader({ title, subtitle, showBack = true, right, style }: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, style]}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Palette.text} />
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : <View style={styles.backButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  right: {
    alignItems: 'flex-end',
  },
});