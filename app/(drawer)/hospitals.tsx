import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HospitalCard } from '@/components/HospitalCard';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useHospitals } from '@/hooks/use-hospitals';

export default function HospitalsScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { hospitals, loading, error, refetch } = useHospitals();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return hospitals;
    return hospitals.filter((hospital) =>
      [
        hospital.name,
        hospital.slug,
        hospital.location?.address,
        hospital.location?.city,
        hospital.location?.state,
        ...(hospital.departments || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [hospitals, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton />
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Hospitals</Text>
            <Text style={styles.subtitle}>
              {loading ? 'Loading...' : `${filtered.length} of ${hospitals.length} hospitals`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, city, or department"
        />
      </View>

      {loading ? (
        <Loading label="Loading hospitals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No hospitals for this search' : 'No hospitals available'}
          message={
            search
              ? 'Try clearing your search text to see every active hospital on the platform.'
              : 'Please check back later — new hospitals are added regularly.'
          }
          action={
            search ? (
              <Pressable accessibilityRole="button" onPress={() => setSearch('')} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear search</Text>
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: Spacing.xxl }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  separator: {
    height: Spacing.lg,
  },
  clearButton: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  clearButtonText: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
});