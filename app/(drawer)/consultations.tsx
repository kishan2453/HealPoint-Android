/**
 * HealPoint - My Consultations.
 *
 * The patient's own online (video) consultations — upcoming, waiting,
 * completed and cancelled. Powered entirely by real backend data
 * (GET /consultation/patient/:userId); meeting URLs are never shown here and
 * are only fetched when opening a specific consultation.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { consultationStatusLabel, meetingStatusLabel } from '@/lib/meet';
import { toErrorMessage } from '@/services/api';
import * as consultationService from '@/services/consultations';
import type { PatientConsultation } from '@/types';

const ACTIVE_STATUSES: string[] = ['pending', 'confirmed', 'rescheduled'];
const CLOSED_STATUSES: string[] = ['cancel', 'missed'];

function rowBadge(c: PatientConsultation): { label: string; variant: BadgeVariant } {
  if (c.status === 'completed') return { label: 'Completed', variant: 'primary' };
  if (CLOSED_STATUSES.includes(c.status)) return { label: 'Cancelled', variant: 'neutral' };
  if (ACTIVE_STATUSES.includes(c.status)) return { label: 'Upcoming', variant: 'success' };
  return { label: 'Waiting', variant: 'warning' };
}

function sortKey(c: PatientConsultation): number {
  if (c.status === 'completed') return 2;
  if (CLOSED_STATUSES.includes(c.status)) return 3;
  return 1;
}

function ConsultationCard({ item }: { item: PatientConsultation }) {
  const router = useRouter();
  const doctor = item.doctor;
  const badge = rowBadge(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open consultation with ${doctor?.name || 'doctor'}`}
      onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: item._id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardRow}>
        <Image
          source={{ uri: doctor?.image || undefined }}
          style={styles.avatar}
          contentFit="cover"
        />
        <View style={styles.cardBody}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {doctor?.name || 'Doctor'}
          </Text>
          <Text style={styles.specialty} numberOfLines={1}>
            {doctor?.speciality || 'Video consultation'}
          </Text>
          <Text style={styles.time} numberOfLines={1}>
            {item.slotDate || '—'} · {item.slotTime || '—'}
          </Text>
        </View>
        <View style={styles.cardStatus}>
          <Badge label={badge.label} variant={badge.variant} />
          <Text style={styles.miniText}>{meetingStatusLabel(item.meetingStatus)}</Text>
          <Text style={styles.miniText}>{consultationStatusLabel(item.consultationStatus)}</Text>
        </View>
      </View>
    </Pressable>
  );
}
export default function ConsultationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id;

  const [items, setItems] = useState<PatientConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await consultationService.getUserConsultations(userId);
      setItems([...res.consultations].sort((a, b) => sortKey(a) - sortKey(b)));
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load your consultations.'));
    } finally {
      setLoading(false);
    }
  };

  useScreenFocus(load);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const counts = {
    upcoming: items.filter((c) => ACTIVE_STATUSES.includes(c.status)).length,
    completed: items.filter((c) => c.status === 'completed').length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <DrawerToggleButton />
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>My Consultations</Text>
          <Text style={styles.headerSubtitle}>
            {loading || error
              ? 'Online consultations'
              : `${counts.upcoming} upcoming · ${counts.completed} completed`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Consult online"
          onPress={() => router.push('/consult-online')}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="add" size={24} color={Palette.white} />
        </Pressable>
      </View>

      <View style={styles.tip}>
        <Ionicons name="videocam" size={16} color={Palette.primaryDark} />
        <Text style={styles.tipText}>
          Open a consultation to see your Care Journey, prescription and, when ready, your Google Meet join link.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <Loading label="Loading your consultations…" />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <EmptyState
              title="No consultations yet"
              message="Start an online consultation with a verified doctor and it will appear here."
              action={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/consult-online')}
                  style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
                >
                  <Text style={styles.ctaText}>Consult online</Text>
                </Pressable>
              }
            />
          )
        }
        renderItem={({ item }) => <ConsultationCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitles: { flex: 1 },
  headerTitle: { ...Typography.h3, color: Palette.text },
  headerSubtitle: { ...Typography.caption, color: Palette.textMuted },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tipText: { flex: 1, ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },
  list: { padding: Spacing.lg, gap: Spacing.lg },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Palette.primaryLight },
  cardBody: { flex: 1, gap: 2 },
  doctorName: { ...Typography.h4, color: Palette.text },
  specialty: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
  time: { ...Typography.caption, color: Palette.textMuted },
  cardStatus: { flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  miniText: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600' },
  cta: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaText: { ...Typography.label, color: Palette.white },
});