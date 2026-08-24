/**
 * HealPoint - real hospital directory (used by admin/super-admin modules).
 */
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { HospitalCard } from '@/components/HospitalCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Spacing } from '@/constants/theme';
import { useHospitals } from '@/hooks/use-hospitals';

export function HospitalDirectory({ title = 'Hospitals' }: { title?: string }) {
  const { hospitals, loading, error, refetch } = useHospitals();

  return (
    <View style={styles.safe}>
      <AppHeader title={title} showBack />
      {loading ? (
        <Loading label="Loading hospitals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <FlatList
          data={hospitals}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
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
