import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

export interface TrendBar {
  key: string;
  label: string;
  count: number;
}

interface TrendBarsProps {
  /** Chronological trend buckets with real counts. Empty => empty state. */
  data: TrendBar[];
  color?: string;
  emptyLabel?: string;
}

export function TrendBars({ data, color = Palette.primary, emptyLabel = 'No data in this period' }: TrendBarsProps) {
  const max = Math.max(...data.map((item) => item.count), 1);
  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {data.map((item) => {
        const height = Math.max((item.count / max) * 100, 6);
        const heightValue: `${number}%` = `${height}%`;
        return (
          <View key={item.key} style={styles.column}>
            <Text style={styles.value} numberOfLines={1}>{item.count}</Text>
            <View style={styles.trackCol}>
              <View style={[styles.bar, { height: heightValue, backgroundColor: color }]} />
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, minHeight: 160, overflow: 'hidden' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  emptyText: { ...Typography.bodySmall, color: Palette.textMuted },
  column: { flex: 1, alignItems: 'center', gap: 4, minWidth: 22 },
  value: { ...Typography.caption, color: Palette.text, fontWeight: '600' },
  trackCol: { width: '100%', height: 110, justifyContent: 'flex-end', backgroundColor: Palette.background, borderRadius: Radius.sm, overflow: 'hidden' },
  bar: { width: '100%', borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm },
  label: { ...Typography.caption, color: Palette.textMuted, transform: [{ rotate: '-45deg' }], marginTop: 6, maxWidth: 90 },
});