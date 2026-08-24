import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { Palette, Spacing, Typography } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <AuthShell scroll={false} splitOnDesktop={false}>
      <View style={styles.hero}>
        <HealPointLogo size={96} badge showWordmark={false} />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>HealPoint</Text>
          <Text style={styles.tagline}>
            Find the right doctor, book appointments and manage your health - all in one place.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Login" onPress={() => router.push('/login')} icon="log-in-outline" />
        <Button title="Create an account" variant="outline" onPress={() => router.push('/register')} icon="person-add-outline" />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Palette.text,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tagline: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
});
