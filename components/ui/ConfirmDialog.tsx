/**
 * HealPoint - confirmation dialog (modal). Used for destructive/important
 * actions such as cancelling an appointment instead of a bare alert().
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <View style={[styles.iconCircle, tone === 'danger' && styles.iconCircleDanger]}>
            <Ionicons
              name={tone === 'danger' ? 'warning' : 'alert-circle'}
              size={28}
              color={tone === 'danger' ? Palette.error : Palette.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="outline" onPress={onCancel} disabled={loading} style={styles.buttons} />
            <Button
              title={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.buttons}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.card,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconCircleDanger: {
    backgroundColor: '#FDE8E8',
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
    textAlign: 'center',
  },
  message: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    width: '100%',
  },
  buttons: {
    flex: 1,
  },
});