/**
 * HealPoint - inline form feedback (error / success / info).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Radius, Spacing, Typography } from '@/constants/theme';

type MessageType = 'error' | 'success' | 'info' | 'warning';

interface FormMessageProps {
  type: MessageType;
  message: string;
}

const theme: Record<MessageType, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { bg: '#FDE8E8', text: '#B3264A', icon: 'alert-circle' },
  success: { bg: '#E2F5E9', text: '#1F7A44', icon: 'checkmark-circle' },
  info: { bg: '#E7F1FE', text: '#1D5FA8', icon: 'information-circle' },
  warning: { bg: '#FDF0DC', text: '#9A6410', icon: 'warning' },
};

export function FormMessage({ type, message }: FormMessageProps) {
  const colors = theme[type];
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Ionicons name={colors.icon} size={20} color={colors.text} />
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  text: {
    ...Typography.bodySmall,
    flex: 1,
  },
});