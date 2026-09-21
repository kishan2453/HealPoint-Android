/**
 * HealPoint - skeleton placeholder for the Super Admin doctor list.
 * Pure layout skeleton (no fake data): gentle blocks that reflect the shape of
 * a real doctor row while the API is loading.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing } from '@/constants/theme';

export function DoctorListSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading doctors...">
      {[0, 1, 2, 3, 4].map((key) => (
        <Card key={key} style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatar} />
            <View style={styles.lines}>
              <View style={[styles.line, styles.lineName]} />
              <View style={[styles.line, styles.lineSpecialty]} />
              <View style={[styles.line, styles.lineHospital]} />
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={[styles.chip, { width: 72 }]} />
            <View style={[styles.chip, { width: 56 }]} />
            <View style={[styles.chip, { width: 84 }]} />
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.chip, { width: 96 }]} />
            <View style={[styles.chip, { width: 110 }]} />
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
  avatar: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Palette.background },
  lines: { flex: 1, gap: Spacing.xs },
  line: { height: 12, borderRadius: Radius.sm, backgroundColor: Palette.background },
  lineName: { width: '62%', height: 15 },
  lineSpecialty: { width: '70%' },
  lineHospital: { width: '48%' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingTop: Spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingTop: Spacing.xs },
  chip: { height: 28, borderRadius: Radius.pill, backgroundColor: Palette.background },
});