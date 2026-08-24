/**
 * HealPoint - development-only backend connection diagnostic.
 *
 * Renders nothing in release builds. In development it shows the resolved API
 * base URL, whether it still points at the placeholder, and lets the developer
 * probe `/health` with one tap — so LAN/backend problems are diagnosed without
 * hiding them or exposing internals to end users.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { describeApiEndpoint, isApiUrlConfigured } from '@/lib/env';
import { checkServerHealth } from '@/services/api';

export function DevApiStatus() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!__DEV__) return null;

  const configured = isApiUrlConfigured();

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    const res = await checkServerHealth();
    setResult(res.ok ? `✓ ${res.message}` : `✗ ${res.message}`);
    setChecking(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: configured ? Palette.success : Palette.warning }]} />
        <Text style={styles.label} numberOfLines={1}>
          API: {describeApiEndpoint()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={runCheck}
        disabled={checking}
        style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}
      >
        {checking ? (
          <ActivityIndicator size="small" color={Palette.primary} />
        ) : (
          <Text style={styles.testLabel}>Test backend connection</Text>
        )}
      </Pressable>
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xxl,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(14, 159, 142, 0.06)',
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  testButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  testLabel: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: '600',
  },
  result: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
});
