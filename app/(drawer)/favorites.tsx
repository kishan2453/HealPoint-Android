/**
 * HealPoint - Favorites screen (inside the patient drawer).
 *
 * Shows the doctor catalog filtered down to the doctors the patient has saved.
 * Tapping a card opens the doctor profile.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { DoctorCard } from '@/components/DoctorCard';
import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { useDoctors } from '@/hooks/use-doctors';
import { useFavorites } from '@/hooks/use-favorites';
import { useScreenFocus } from '@/hooks/use-screen-focus';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favoriteIds, refresh: refreshFavorites } = useFavorites();
  const { doctors, loading, error, refetch } = useDoctors({ limit: 200 });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refreshFavorites(), refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  useScreenFocus(() => {
    refreshFavorites();
    refetch();
  });

  const favorites = doctors.filter((doctor) => favoriteIds.has(String(doctor._id)));

  return (
    <View style={styles.safe}>
      <DrawerHeader title="Favorites" subtitle={`${favorites.length} saved doctor${favorites.length === 1 ? '' : 's'}`} />

      {loading ? (
        <Loading label="Loading favorites..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : favorites.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          message="Tap the heart on any doctor profile to save them here for quick access."
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/doctors')} style={styles.browseButton}>
              <Text style={styles.browseButtonText}>Browse doctors</Text>
            </Pressable>
          }
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item, index }) => <DoctorCard doctor={item} index={index} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
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
  browseButton: {
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  browseButtonText: {
    ...Typography.label,
    color: Palette.white,
  },
});
