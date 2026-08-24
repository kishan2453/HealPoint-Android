/**
 * HealPoint - reusable text input with label + error + keyboard-safe options.
 * Supports an optional leading icon and an optional right slot (e.g. a
 * show/hide-password toggle) so form screens stay consistent.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  /** Leading icon shown inside the input (e.g. "mail-outline"). */
  leftIcon?: IconName;
  /** Optional trailing element (e.g. a password visibility toggle button). */
  rightSlot?: React.ReactNode;
  /**
   * Visual style of the field.
   *  - `outline` (default): white surface with a border.
   *  - `filled`: tinted, softer surface used on premium forms.
   */
  variant?: 'outline' | 'filled';
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  leftIcon,
  rightSlot,
  variant = 'outline',
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(halo, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [focused, halo]);

  const haloOpacity = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.14],
  });

  const filled = variant === 'filled';
  const isError = Boolean(error);
  const accent = isError ? Palette.error : Palette.primary;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, isError && styles.labelError]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          filled ? styles.inputFilled : styles.inputOutline,
          isError ? styles.inputError : null,
          focused && !isError ? { borderColor: accent } : null,
          filled ? null : Shadows.card,
        ]}
      >
        {/* Focus halo: a soft teal wash that fades in while typing. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { backgroundColor: filled ? Palette.primary : 'rgba(14, 159, 142, 0.10)' },
            { opacity: haloOpacity },
          ]}
        />
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isError ? Palette.error : focused ? Palette.primary : Palette.textMuted}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={label || props.placeholder}
          style={[styles.input, filled && styles.inputFilledText, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Palette.text,
  },
  labelError: {
    color: Palette.error,
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  inputOutline: {
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  inputFilled: {
    borderColor: 'transparent',
    backgroundColor: Palette.primaryLight,
  },
  leftIcon: {
    marginLeft: Spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Palette.text,
  },
  inputFilledText: {
    fontWeight: '500',
  },
  rightSlot: {
    paddingRight: Spacing.sm,
  },
  inputError: {
    borderColor: Palette.error,
  },
  error: {
    ...Typography.caption,
    color: Palette.error,
  },
});
