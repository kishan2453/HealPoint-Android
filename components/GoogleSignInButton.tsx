/**
 * HealPoint - "Continue with Google" button.
 *
 * Standard outline-style OAuth button with the Google "G" mark. Reused by both
 * the Login and Sign Up screens so the flow is consistent. It is only rendered
 * when Google credentials are actually configured (see `isGoogleSignInConfigured`),
 * and it never uses fake authentication.
 */
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, loading = false, disabled = false }: GoogleSignInButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        Shadows.card,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Palette.text} />
      ) : (
        <>
          <FontAwesome5 name="google" size={19} color={Palette.google} />
          <Text style={styles.label}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: Radius.md + 2,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...Typography.button,
    color: Palette.text,
  },
});
