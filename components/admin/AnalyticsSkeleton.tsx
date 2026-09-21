import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing } from '@/constants/theme';

/** Skeleton placeholder for the analytics dashboard while real data loads. */
export function AnalyticsSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading analytics...">
      <View style={styles.kpiRow}>
        {[0, 1, 2, 3].map((key0) => (
          <Card key={key0} style={styles.kpi}>
            <View style={[styles.line, styles.icon]} />
            <View style={[styles.line, styles.value]} />
            <View style={[styles.line, styles.label]} />
          </Card>
        ))}
      </View>
      <Card style={styles.card}>
        <View style={[styles.line, styles.title]} />
        <View style={styles.chart}>
          {[0, 1, 2, 3, 4, 5].map((key1) => (
            <View key={key1} style={[styles.bar, { height: [46, 72, 30, 88, 54, 68][key1] }]} />
          ))}
        </View>
      </Card>
      <Card style={styles.card}>
        <View style={[styles.line, styles.title]} />
        <View style={styles.chart}>
          {[0, 1, 2, 3, 4].map((key2) => (
            <View key={key2} style={[styles.line, styles.rowLine]} />
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  kpi: { flex: 1, minWidth: 150, gap: Spacing.xs, padding: Spacing.lg },
  line: { backgroundColor: Palette.background, borderRadius: Radius.sm },
  icon: { width: 38, height: 38, borderRadius: Radius.md },
  value: { width: '62%', height: 20 },
  label: { width: '78%', height: 12 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  title: { width: '44%', height: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: 140 },
  bar: { flex: 1, backgroundColor: Palette.background, borderRadius: Radius.sm },
  rowLine: { width: '100%', height: 14 },
});