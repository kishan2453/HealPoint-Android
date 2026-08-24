/**
 * HealPoint - real doctor directory (used by admin/super-admin modules).
 */
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { DoctorCard } from '@/components/DoctorCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Spacing } from '@/constants/theme';
import { useDoctors } from '@/hooks/use-doctors';

export function DoctorDirectory({ title = 'Doctors' }: { title?: string }) {
  const { doctors, loading, error, refetch } = useDoctors({ limit: 100 });

  return (
    <View style={styles.safe}>
      <AppHeader title={title} showBack />
      {loading ? (
        <Loading label="Loading doctors..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item, index }) => <DoctorCard doctor={item} index={index} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.md,
  },
});
