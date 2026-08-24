/**
 * HealPoint - scrollable keyboard-safe screen shell.
 * Handles SafeArea, background color and keyboard avoiding so every form screen
 * stays consistent and usable on Android.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  scroll?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({
  children,
  style,
  contentStyle,
  scroll = true,
  keyboardShouldPersistTaps = 'handled',
  edges = ['top', 'bottom', 'left', 'right'],
}: ScreenProps) {
  const content = (
    <View style={[styles.inner, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, style]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
});