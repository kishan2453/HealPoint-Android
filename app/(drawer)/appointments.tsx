import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppointmentCard } from '@/components/AppointmentCard';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAppointments } from '@/hooks/use-appointments';
import { useScreenFocus } from '@/hooks/use-screen-focus';

type Tab = 'upcoming' | 'today' | 'completed' | 'cancelled';

const SEGMENTS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
];

export default function AppointmentsScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const { upcoming, today, completed, cancelled, loading, error, refetch } = useAppointments();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh on every focus so a freshly booked/cancelled/rescheduled
  // appointment appears immediately without a manual reload.
  useScreenFocus(() => {
    refetch();
  });

  const data =
    tab === 'upcoming' ? upcoming : tab === 'today' ? today : tab === 'completed' ? completed : cancelled;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton />
          <Text style={styles.title}>My appointments</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {SEGMENTS.map((segment) => {
            const active = tab === segment.key;
            const count =
              segment.key === 'upcoming'
                ? upcoming.length
                : segment.key === 'today'
                  ? today.length
                  : segment.key === 'completed'
                    ? completed.length
                    : cancelled.length;
            return (
              <Pressable
                key={segment.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(segment.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons name={segment.icon} size={16} color={active ? Palette.white : Palette.textMuted} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {segment.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {loading ? (
        <Loading label="Loading appointments..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState
          title={
            tab === 'upcoming'
              ? 'No upcoming appointments'
              : tab === 'today'
                ? 'No appointments today'
                : tab === 'completed'
                  ? 'No completed appointments'
                  : 'No cancelled appointments'
          }
          message={
            tab === 'upcoming'
              ? 'Book a consultation with a trusted doctor to see it here.'
              : tab === 'today'
                ? 'Your appointments for today will appear here.'
                : 'Past appointments will appear here as they complete.'
          }
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => <AppointmentCard appointment={item} />}
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
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  tabsScroll: {
    flexGrow: 0,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Palette.primary,
  },
  tabText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Palette.white,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: Spacing.md,
  },
});