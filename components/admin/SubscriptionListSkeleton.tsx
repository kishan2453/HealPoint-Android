/**
 * HealPoint - skeleton placeholder for the Super Admin subscription list.
 * Pure layout skeleton (no fake data): gentle blocks that reflect the shape of
 * a real subscription row while the overview + list are loading.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing } from '@/constants/theme';

export function SubscriptionListSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading subscriptions...">
      {[0, 1, 2, 3, 4].map((key) => (
        <Card key={key} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={[styles.line, styles.lineName]} />
              <View style={[styles.line, styles.lineContact]} />
              <View style={[styles.line, styles.linePlan]} />
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={[styles.chip, { width: 74 }]} />
            <View style={[styles.chip, { width: 58 }]} />
            <View style={[styles.chip, { width: 92 }]} />
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.chip, { width: 110 }]} />
            <View style={[styles.chip, { width: 130 }]} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.background },
  lines: { flex: 1, gap: Spacing.xs },
  line: { height: 12, borderRadius: Radius.sm, backgroundColor: Palette.background },
  lineName: { width: '55%', height: 15 },
  lineContact: { width: '72%' },
  linePlan: { width: '42%' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingTop: Spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingTop: Spacing.xs },
  chip: { height: 28, borderRadius: Radius.pill, backgroundColor: Palette.background },
});