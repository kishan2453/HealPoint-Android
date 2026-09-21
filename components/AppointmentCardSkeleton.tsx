/**
 * HealPoint - appointment card loading skeleton.
 *
 * Mirrors the AppointmentCard layout so the loading state feels like a real
 * list, with a gentle opacity pulse. Skeleton is decorative and excluded from
 * accessibility.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { Palette, Radius, Shadows, Spacing } from '@/constants/theme';

const skeletonColor = '#DDE8E5';

export function AppointmentCardSkeleton() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.card, { opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.topRow}>
        <View style={styles.avatar} />
        <View style={styles.heading}>
          <View style={[styles.line, styles.nameLine]} />
          <View style={[styles.line, styles.specialtyLine]} />
          <View style={[styles.line, styles.hospitalLine]} />
        </View>
        <View style={[styles.line, styles.badge]} />
      </View>
      <View style={[styles.line, styles.metaLine]} />
      <View style={[styles.line, styles.typeChip]} />
      <View style={styles.divider} />
      <View style={styles.bottomRow}>
        <View style={styles.feeBlock}>
          <View style={[styles.line, styles.feeLine]} />
          <View style={[styles.line, styles.captionLine]} />
        </View>
        <View style={[styles.line, styles.badge]} />
      </View>
    </Animated.View>
  );
}

export function AppointmentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={index < count - 1 ? styles.item : undefined}>
          <AppointmentCardSkeleton />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  item: {
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: skeletonColor,
  },
  heading: {
    flex: 1,
    gap: Spacing.sm,
  },
  line: {
    borderRadius: Radius.xs,
    backgroundColor: skeletonColor,
  },
  nameLine: {
    width: '55%',
    height: 16,
  },
  specialtyLine: {
    width: '40%',
    height: 12,
  },
  hospitalLine: {
    width: '70%',
    height: 12,
  },
  badge: {
    height: 22,
    width: 76,
    borderRadius: Radius.pill,
  },
  metaLine: {
    width: '60%',
    height: 14,
    marginTop: Spacing.xs,
  },
  typeChip: {
    width: 130,
    height: 22,
    borderRadius: Radius.pill,
  },
  divider: {
    height: 1,
    backgroundColor: skeletonColor,
    marginVertical: Spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  feeBlock: {
    gap: 4,
  },
  feeLine: {
    width: 90,
    height: 18,
  },
  captionLine: {
    width: 110,
    height: 12,
  },
});