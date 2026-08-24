/**
 * HealPoint - doctor card loading skeleton.
 *
 * Mirrors the DoctorCard layout so the loading state feels like a real result
 * list, with a gentle opacity pulse. Skeleton is decorative and excluded from
 * accessibility.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { Palette, Radius, Shadows, Spacing } from '@/constants/theme';

export function DoctorCardSkeleton() {
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
      </View>
      <View style={styles.metaRow}>
        <View style={[styles.line, styles.metaChip]} />
        <View style={[styles.line, styles.metaChip]} />
        <View style={[styles.line, styles.metaChip]} />
      </View>
      <View style={styles.badgeRow}>
        <View style={[styles.line, styles.badge]} />
        <View style={[styles.line, styles.badge]} />
      </View>
    </Animated.View>
  );
}

export function DoctorListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={index < count - 1 ? styles.item : undefined}>
          <DoctorCardSkeleton />
        </View>
      ))}
    </ScrollView>
  );
}

const skeletonColor = '#DDE8E5';

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
    gap: Spacing.md,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
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
    width: '60%',
    height: 16,
  },
  specialtyLine: {
    width: '45%',
    height: 12,
  },
  hospitalLine: {
    width: '75%',
    height: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaChip: {
    height: 14,
    width: 72,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badge: {
    height: 20,
    width: 64,
    borderRadius: Radius.pill,
  },
});
