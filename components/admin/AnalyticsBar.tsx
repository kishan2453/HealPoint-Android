import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

export interface AnalyticsBarItem {
  label: string;
  count: number;
}

interface AnalyticsBarProps {
  items: AnalyticsBarItem[];
  color?: string;
  max?: number;
  emptyLabel?: string;
}

export function AnalyticsBar({ items, color = Palette.primary, max, emptyLabel = 'No data yet' }: AnalyticsBarProps) {
  const total = max ?? Math.max(0, ...items.map((item) => item.count));
  if (items.length === 0 || total <= 0) {
    return <View style={styles.emptyWrap}><Text style={styles.emptyText}>{emptyLabel}</Text></View>;
  }
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const width = Math.max((item.count / total) * 100, 4);
        const widthValue: `${number}%` = `${width}%`;
        return (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: widthValue, backgroundColor: color }]} />
            </View>
            <Text style={styles.count}>{item.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  emptyText: { ...Typography.bodySmall, color: Palette.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { ...Typography.bodySmall, color: Palette.text, width: 110 },
  track: { flex:1, height:8, borderRadius: Radius.pill, backgroundColor: Palette.background, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  count: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600', width:36, textAlign: 'right' },
});