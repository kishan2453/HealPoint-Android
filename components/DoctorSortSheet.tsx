/**
 * HealPoint - doctor search sort sheet.
 *
 * The backend `/doctor/get-all` endpoint has no sort query param, so sorting
 * re-orders the real returned data on the client. "Recommended" keeps the
 * server's default order.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { SORT_OPTIONS, type DoctorSort } from '@/lib/doctor-search';

interface DoctorSortSheetProps {
  visible: boolean;
  sort: DoctorSort;
  onSelect: (sort: DoctorSort) => void;
  onClose: () => void;
}

export function DoctorSortSheet({ visible, sort, onSelect, onClose }: DoctorSortSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sorting"
          style={styles.backdrop}
          onPress={onClose}
        />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sort doctors</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={Palette.textMuted} />
            </Pressable>
          </View>
          <View style={styles.list}>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? Palette.primary : Palette.textMuted}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{option.label}</Text>
                    <Text style={styles.rowCaption}>{option.caption}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 20, 18, 0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
    marginTop: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
  },
  rowLabelActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  rowCaption: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
});
