/**
 * HealPoint - skeleton placeholder for the Super Admin hospital list.
 * Pure layout skeleton (no fake data): gentle shimmer-free blocks that reflect
 * the shape of a real hospital row while the API is loading.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing } from '@/constants/theme';

export function HospitalListSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading hospitals...">
      {[0, 1, 2, 3].map((key) => (
        <Card key={key} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={[styles.line, styles.lineName]} />
              <View style={[styles.line, styles.lineAddress]} />
              <View style={[styles.line, styles.lineSub]} />
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.chip, { width: 70 }]} />
            <View style={[styles.chip, { width: 90 }]} />
            <View style={[styles.chip, { width: 60 }]} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.background },
  lines: { flex: 1, gap: Spacing.xs },
  line: { height: 12, borderRadius: Radius.sm, backgroundColor: Palette.background },
  lineName: { width: '60%', height: 15 },
  lineAddress: { width: '85%' },
  lineSub: { width: '45%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingTop: Spacing.xs },
  chip: { height: 28, borderRadius: Radius.pill, backgroundColor: Palette.background },
});