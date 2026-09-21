/**
 * HealPoint - skeleton placeholder for the Hospital Admin patient list.
 * Pure layout skeleton (no fake data): gentle blocks that reflect the shape
 * of a real patient row while the API is loading.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing } from '@/constants/theme';

export function PatientListSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading patients...">
      {[0, 1, 2, 3, 4].map((key) => (
        <Card key={key} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={[styles.line, styles.lineName]} />
              <View style={[styles.line, styles.lineContact]} />
            </View>
            <View style={styles.chip} />
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.chip, { width: 96 }]} />
            <View style={[styles.chip, { width: 84 }]} />
            <View style={[styles.chip, { width: 74 }]} />
          </View>
          <View style={[styles.line, styles.lineDate]} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.background },
  lines: { flex: 1, gap: Spacing.xs },
  line: { height: 12, borderRadius: Radius.sm, backgroundColor: Palette.background },
  lineName: { width: '54%', height: 15 },
  lineContact: { width: '40%' },
  lineDate: { width: '58%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { height: 28, borderRadius: Radius.pill, backgroundColor: Palette.background },
});