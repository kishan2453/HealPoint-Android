/**
 * HealPoint - Doctor Profile (premium). Every field comes from the real
 * backend doctor record; sections with no data are hidden. Actions: Book
 * appointment (real backend), Call / Email via system dialer & mail app (shown
 * only when the backend provides them), and Favorite (real favorites list).
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/FavoriteButton';
import { ReviewModal } from '@/components/ReviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  doctorHospitalName,
  doctorLocationText,
  doctorSpecialty,
  isDoctorAvailable,
  nextAvailableSlot,
} from '@/lib/doctor';
import { formatINR } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import { toErrorMessage } from '@/services/api';
import { getDoctorDetails } from '@/services/doctors';
import type { Doctor, DoctorProfileTimeline } from '@/types';

export default function DoctorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewVisible, setReviewVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await getDoctorDetails(id);
      setDoctor(res.doctor);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctor details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openBooking = () => {
    if (!doctor) return;
    router.push({ pathname: '/booking/[doctorId]', params: { doctorId: String(doctor._id) } });
  };

  const callDoctor = () => {
    if (!doctor?.phone) return;
    Linking.openURL(`tel:${doctor.phone.replace(/[^+\d]/g, '')}`);
  };

  const emailDoctor = () => {
    if (!doctor?.email) return;
    Linking.openURL(`mailto:${doctor.email}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading doctor profile..." />
      </SafeAreaView>
    );
  }

  if (error || !doctor) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || 'Doctor not found.'} onRetry={load} />
      </SafeAreaView>
    );
  }

  // ============================ DERIVED =================================
  const doctorId = String(doctor._id);
  const specialty = doctorSpecialty(doctor);
  const hospital = doctorHospitalName(doctor);
  const location = doctorLocationText(doctor);
  const accepting = isDoctorAvailable(doctor);
  const available = doctor.available === true;
  const nextSlot = nextAvailableSlot(doctor);
  const languages = (doctor.languages || []).filter((value) => Boolean(value && value.trim()));
  const consultationTypes = doctor.consultationTypes || [];
  const reviews = doctor.reviews || [];
  const weeklySchedule = (doctor.weeklySchedule || []).filter((day) => day && day.enabled !== false);
  const verified = doctor.verificationStatus === 'Verified';

  const serviceRows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
  if (consultationTypes.length > 0) {
    serviceRows.push({
      icon: 'videocam',
      label: 'Consultation',
      value: consultationTypes
        .map((type) => (type === 'video' ? 'Video consultation' : type === 'clinic' ? 'Clinic visit' : type))
        .join(' · '),
    });
  }
  if (doctor.department) {
    serviceRows.push({ icon: 'medical', label: 'Department', value: doctor.department });
  }

  // ============================ RENDER =================================
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* ---------------- Hero ---------------- */}
        <View style={styles.hero}>
          <Image
            source={{ uri: getDoctorImage(doctor) }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heroShadeTop} />
          <View style={styles.heroShadeBottom} />
          <View style={styles.heroTopBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>
            <View style={styles.fab}>
              <FavoriteButton doctorId={doctorId} size={24} />
            </View>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.name}>{doctor.name}</Text>
            <Text style={styles.specialty} numberOfLines={2}>
              {specialty}
              {doctor.degree ? ` · ${doctor.degree}` : ''}
            </Text>
            <View style={styles.heroBadges}>
              {verified ? <Badge label="Verified" variant="primary" /> : null}
              <Badge label={accepting ? 'Available now' : 'Not available'} variant={accepting ? 'success' : 'warning'} />
            </View>
          </View>
        </View>

        {/* ---------------- Key stats ---------------- */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Ionicons name="star" size={20} color={Palette.gold} />
            <Text style={styles.statValue}>{Number(doctor.rating || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={Palette.primary} />
            <Text style={styles.statValue}>{doctor.reviewCount || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="briefcase-outline" size={20} color={Palette.primary} />
            <Text style={styles.statValue}>{doctor.experience || 0}+</Text>
            <Text style={styles.statLabel}>Years exp.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="wallet-outline" size={20} color={Palette.primary} />
            <Text style={styles.statValue}>{formatINR(doctor.fees)}</Text>
            <Text style={styles.statLabel}>Consultation</Text>
          </View>
        </View>

        {/* ---------------- Contact actions ---------------- */}
        <View style={styles.actionRow}>
          {doctor.phone ? (
            <Button title="Call clinic" variant="outline" onPress={callDoctor} style={styles.actionButton} />
          ) : null}
          {doctor.email ? (
            <Button title="Email" variant="outline" onPress={emailDoctor} style={styles.actionButton} />
          ) : null}
        </View>


        {/* ---------------- About ---------------- */}
        {doctor.about ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bodyText}>{doctor.about}</Text>
          </Card>
        ) : null}

        {/* ---------------- Services ---------------- */}
        {serviceRows.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Services</Text>
            {serviceRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name={row.icon} size={18} color={Palette.primary} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ---------------- Languages ---------------- */}
        {languages.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.chipRow}>
              {languages.map((language) => (
                <View key={language} style={styles.chip}>
                  <Ionicons name="chatbubbles-outline" size={14} color={Palette.primaryDark} />
                  <Text style={styles.chipText}>{language}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Hospital & location ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hospital & location</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="business" size={18} color={Palette.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Hospital / clinic</Text>
              <Text style={styles.infoValue}>{hospital}</Text>
            </View>
          </View>
          {location ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{location}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* ---------------- Availability ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.availabilityRow}>
            <Ionicons
              name={accepting ? 'checkmark-circle' : 'time-outline'}
              size={20}
              color={accepting ? Palette.success : Palette.warning}
            />
            <View style={styles.availabilityText}>
              <Text style={[styles.availabilityStatus, accepting ? styles.available : styles.unavailable]}>
                {accepting ? 'Currently accepting appointments' : 'Currently not accepting appointments'}
              </Text>
              {nextSlot ? (
                <Text style={styles.availabilityDetail}>
                  Next available · {nextSlot.date} at {nextSlot.time}
                </Text>
              ) : null}
              {doctor.availabilitySchedule ? (
                <Text style={styles.availabilityDetail}>{doctor.availabilitySchedule}</Text>
              ) : null}
            </View>
          </View>
          {weeklySchedule.length > 0 ? (
            <View style={styles.weeklyWrap}>
              {weeklySchedule.map((day, index) => (
                <View key={`${day.day}-${index}`} style={styles.weeklyRow}>
                  <Text style={styles.weeklyDay}>{day.day}</Text>
                  <Text style={styles.weeklyTime}>
                    {day.startTime} - {day.endTime}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* ---------------- Contact ---------------- */}
        {doctor.phone || doctor.email ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contact</Text>
            {doctor.phone ? (
              <Pressable accessibilityRole="button" onPress={callDoctor} style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
                <View style={styles.infoIcon}>
                  <Ionicons name="call-outline" size={18} color={Palette.primary} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={[styles.infoValue, styles.linkValue]}>{doctor.phone}</Text>
                </View>
              </Pressable>
            ) : null}
            {doctor.email ? (
              <Pressable accessibilityRole="button" onPress={emailDoctor} style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}>
                <View style={styles.infoIcon}>
                  <Ionicons name="mail-outline" size={18} color={Palette.primary} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={[styles.infoValue, styles.linkValue]} numberOfLines={1}>
                    {doctor.email}
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </Card>
        ) : null}


        {/* ---------------- Education / Experience ---------------- */}
        {doctor.qualificationTimeline && doctor.qualificationTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Qualification</Text>
            {doctor.qualificationTimeline.map((item, index) => (
              <TimelineItem key={`qual-${index}`} item={item} />
            ))}
          </Card>
        ) : null}
        {doctor.educationTimeline && doctor.educationTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Education</Text>
            {doctor.educationTimeline.map((item, index) => (
              <TimelineItem key={`edu-${index}`} item={item} />
            ))}
          </Card>
        ) : null}
        {doctor.experienceTimeline && doctor.experienceTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Professional experience</Text>
            {doctor.experienceTimeline.map((item, index) => (
              <TimelineItem key={`exp-${index}`} item={item} />
            ))}
          </Card>
        ) : null}

        {/* ---------------- Awards & achievements ---------------- */}
        {(doctor.awards && doctor.awards.length > 0) || (doctor.achievements && doctor.achievements.length > 0) ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Awards & achievements</Text>
            {(doctor.awards || []).map((award, index) => (
              <View key={`award-${index}`} style={styles.achievementRow}>
                <Ionicons name="trophy-outline" size={16} color={Palette.gold} />
                <Text style={styles.bodyText}>{award}</Text>
              </View>
            ))}
            {(doctor.achievements || []).map((achievement, index) => (
              <View key={`ach-${index}`} style={styles.achievementRow}>
                <Ionicons name="ribbon-outline" size={16} color={Palette.primary} />
                <Text style={styles.bodyText}>{achievement}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ---------------- Reviews ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.sectionTitle}>Patient reviews ({doctor.reviewCount || reviews.length})</Text>
            <Pressable accessibilityRole="button" onPress={() => setReviewVisible(true)} hitSlop={8}>
              <Text style={styles.writeReview}>Write a review</Text>
            </Pressable>
          </View>
          {reviews.length === 0 ? (
            <Text style={styles.bodyText}>No patient reviews yet.</Text>
          ) : (
            reviews.map((review) => (
              <View key={String(review._id || review.createdAt || review.comment)} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewName}>{review.name || 'Patient'}</Text>
                  <View style={styles.reviewStars}>
                    <Ionicons name="star" size={14} color={Palette.gold} />
                    <Text style={styles.reviewRating}>{Number(review.rating).toFixed(1)}</Text>
                  </View>
                </View>
                {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
                <Text style={styles.bodyText}>{review.comment}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* ---------------- Sticky booking bar ---------------- */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomFee}>
          <Text style={styles.bottomFeeLabel}>Consultation</Text>
          <Text style={styles.bottomFeeValue}>{formatINR(doctor.fees)}</Text>
        </View>
        <Button
          title={available ? 'Book appointment' : 'Currently unavailable'}
          onPress={openBooking}
          disabled={!available}
          style={styles.bottomButton}
        />
      </View>

      <ReviewModal
        visible={reviewVisible}
        doctorId={doctorId}
        doctorName={doctor.name}
        onClose={() => setReviewVisible(false)}
      />
    </SafeAreaView>
  );
}

function TimelineItem({ item }: { item: DoctorProfileTimeline }) {
  const title = item.title || item.institute || item.hospital || '';
  const sub = item.institute || item.hospital || '';
  const year = item.year || (item.startYear ? `${item.startYear}${item.endYear ? ` - ${item.endYear}` : ''}` : '');
  return (
    <View style={styles.timelineItem}>
      {title ? <Text style={styles.timelineTitle}>{title}</Text> : null}
      {sub && sub !== title ? <Text style={styles.timelineSub}>{sub}</Text> : null}
      {year ? <Text style={styles.timelineYear}>{year}</Text> : null}
      {item.description ? <Text style={styles.bodyText}>{item.description}</Text> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    paddingBottom: Spacing.xxxl,
  },
  pressed: {
    opacity: 0.6,
  },
  // ---- Hero ----
  hero: {
    height: 360,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Palette.primaryLight,
  },
  heroShadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(9, 20, 18, 0.12)',
  },
  heroShadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(9, 20, 18, 0.48)',
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  fab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.h2,
    color: Palette.white,
  },
  specialty: {
    ...Typography.bodyMedium,
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '600',
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  // ---- Stats ----
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xxxl,
    paddingVertical: Spacing.lg,
    ...Shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  statValue: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Palette.divider,
  },
  // ---- Actions ----
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
  },

  // ---- Sections ----
  sectionCard: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.md,
  },
  bodyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  linkValue: {
    color: Palette.primaryDark,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  availabilityText: {
    flex: 1,
    gap: 2,
  },
  availabilityStatus: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  available: {
    color: Palette.success,
  },
  unavailable: {
    color: Palette.warning,
  },
  availabilityDetail: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  weeklyWrap: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.sm,
  },
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  weeklyDay: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '600',
  },
  weeklyTime: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  timelineItem: {
    marginBottom: Spacing.md,
    gap: 2,
  },
  timelineTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  timelineSub: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  timelineYear: {
    ...Typography.caption,
    color: Palette.primaryDark,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  writeReview: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
  reviewItem: {
    marginBottom: Spacing.lg,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRating: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '700',
  },
  reviewTitle: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontStyle: 'italic',
  },
  // ---- Sticky booking bar ----
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    ...Shadows.navbar,
  },
  bottomFee: {
    gap: 2,
  },
  bottomFeeLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  bottomFeeValue: {
    ...Typography.h4,
    color: Palette.text,
  },
  bottomButton: {
    flex: 1,
  },
});

