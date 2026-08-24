/**
 * HealPoint - Consult Online.
 *
 * Premium landing for online (video) consultations. Shows only REAL backend
 * online doctors (GET /consultation/online-doctors) — no mocked doctors, no
 * fake availability. Each card's [Consult Now] / [Schedule] routes into the
 * verified booking + Razorpay flow, after which a real Google Meet link is
 * attached by the doctor.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnlineDoctorCard } from '@/components/OnlineDoctorCard';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { toErrorMessage } from '@/services/api';
import * as consultationService from '@/services/consultations';
import type { OnlineDoctor } from '@/types';

const SPECIALITIES = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pediatrician',
  'Psychiatrist',
  'Orthopedic',
];

export default function ConsultOnlineScreen() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<OnlineDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [speciality, setSpeciality] = useState('');

  const loadDoctors = useCallback(
    async (opts: { search?: string; speciality?: string; quiet?: boolean } = {}) => {
      if (!opts.quiet) setLoading(true);
      setError('');
      try {
        const res = await consultationService.getOnlineDoctors({
          search: opts.search || undefined,
          speciality: opts.speciality || undefined,
        });
        setDoctors(res.doctors || []);
      } catch (err) {
        // Never show raw backend HTML ("Cannot GET …") to patients. The clean
        // API hardening in services/api.ts converts it for us; here we surface
        // the exact friendly message for the Consult Online experience and
        // keep the real technical detail in development logs only.
        setError('Online consultation is temporarily unavailable. Please try again.');
        if (__DEV__) {
          console.warn('[consult-online] Failed to load online doctors.', { detail: toErrorMessage(err) });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useScreenFocus(() => loadDoctors({ quiet: true }));
  useEffect(() => {
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    Keyboard.dismiss();
    loadDoctors({ search: query, speciality });
  };

  const onSelectSpeciality = (value: string) => {
    const next = speciality === value ? '' : value;
    setSpeciality(next);
    loadDoctors({ search: query, speciality: next === '' ? undefined : next, quiet: true });
  };

  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    loadDoctors({ search: query, speciality, quiet: true });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <DrawerToggleButton />
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Consult Online</Text>
          <Text style={styles.headerSubtitle}>Video consultation with verified doctors</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My consultations"
          onPress={() => router.push('/consultations')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="list" size={22} color={Palette.primaryDark} />
        </Pressable>
      </View>

      {/* ---------------- Hero ---------------- */}
      <View style={styles.hero}>
        <Ionicons name="videocam" size={26} color={Palette.white} />
        <View style={styles.heroTexts}>
          <Text style={styles.heroTitle}>Talk to a doctor online</Text>
          <Text style={styles.heroSubtitle}>
            Book a video consultation, pay securely, and join your doctor on Google Meet.
          </Text>
        </View>
      </View>

      {/* ---------------- Search bar ---------------- */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Palette.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by doctor, speciality or concern"
            placeholderTextColor={Palette.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search doctors"
            onPress={onSearch}
            style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>
      </View>
{/* ---------------- Speciality chips ---------------- */}
      <View style={styles.chipsRow}>
        {SPECIALITIES.map((name) => {
          const active = speciality === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelectSpeciality(name)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ---------------- List ---------------- */}
      <FlatList
        data={doctors}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
        }
        ListHeaderComponent={
          <View style={styles.sectionNote}>
            <Text style={styles.sectionNoteText}>
              {loading
                ? 'Finding online doctors…'
                : `${doctors.length} online doctor${doctors.length === 1 ? '' : 's'} available`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading label="Finding online doctors…" />
          ) : error ? (
            <ErrorState message={error} onRetry={onRefresh} />
          ) : (
            <EmptyState
              title="No online doctors found"
              message="Try a different speciality or search term. Doctors become available as slots open."
              action={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setQuery('');
                    setSpeciality('');
                    loadDoctors({ search: '', speciality: undefined });
                  }}
                  style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.resetBtnText}>Show all online doctors</Text>
                </Pressable>
              }
            />
          )
        }
        renderItem={({ item, index }) => <OnlineDoctorCard doctor={item} index={index} />}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.primary,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    ...Typography.h4,
    color: Palette.white,
  },
  heroSubtitle: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.92)',
  },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Palette.text,
    paddingVertical: 0,
  },
  searchBtn: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchBtnText: {
    ...Typography.label,
    color: Palette.white,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  chipTextActive: {
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  sectionNote: {
    marginBottom: Spacing.xs,
  },
  sectionNoteText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: Palette.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  resetBtnText: {
    ...Typography.label,
    color: Palette.primary,
  },
});