import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { HospitalImage } from '@/components/HospitalImage';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { getDoctorImage } from '@/lib/image';
import { getPublicHospitalDetails } from '@/services/hospitals';
import { toErrorMessage } from '@/services/api';
import type { Hospital } from '@/types';

export default function HospitalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    setError('');
    getPublicHospitalDetails(id)
      .then((res) => {
        if (active) setHospital(res.hospital);
      })
      .catch((err) => {
        if (active) setError(toErrorMessage(err, 'Unable to load hospital details.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const { width } = useWindowDimensions();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const address = [hospital?.location?.address, hospital?.location?.city, hospital?.location?.state]
    .filter(Boolean)
    .join(', ');
  const phone = hospital?.contact?.reception || hospital?.contact?.emergency || '';
  const doctors = hospital?.doctors || [];
  const gallery = hospital?.galleryImages || [];
  const galleryColumns = 3;
  const galleryGap = Spacing.sm;
  const galleryCell = (width - Spacing.lg * 2 - Spacing.lg * 2 - galleryGap * (galleryColumns - 1)) / galleryColumns;

  const browseDoctors = () =>
    router.push({ pathname: '/doctors', params: { hospitalId: String(hospital?._id) } });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading label="Loading hospital profile..." />
      </SafeAreaView>
    );
  }

  if (error || !hospital) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState message={error || 'Hospital not found.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Hospital profile</Text>
          </View>
        </View>

        <View style={styles.coverWrap}>
          <HospitalImage
            hospital={hospital}
            style={styles.cover}
            contentFit="cover"
            accessibilityLabel={`${hospital.name} photo`}
          />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{hospital.name}</Text>
          <Text style={styles.rating}>
            <Ionicons name="star" size={14} color={Palette.gold} /> {Number(hospital.rating || 0).toFixed(1)} ·{' '}
            {hospital.reviewCount || 0} reviews
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={20} color={Palette.primary} />
            <Text style={styles.statValue}>{hospital.doctorCount || 0}</Text>
            <Text style={styles.statLabel}>Doctors</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Palette.success} />
            <Text style={styles.statValue}>{hospital.availableDoctorCount ?? hospital.doctorCount ?? 0}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="bed-outline" size={20} color={Palette.info} />
            <Text style={styles.statValue}>{hospital.beds || 0}</Text>
            <Text style={styles.statLabel}>Beds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="pulse-outline" size={20} color={Palette.warning} />
            <Text style={styles.statValue}>{hospital.icuBeds || 0}</Text>
            <Text style={styles.statLabel}>ICU</Text>
          </View>
        </View>

        {(hospital.emergencyFacility || hospital.icu) ? (
          <View style={styles.badgeRow}>
            {hospital.emergencyFacility ? <Badge label="Emergency facility" variant="error" /> : null}
            {hospital.icu ? <Badge label="ICU available" variant="warning" /> : null}
          </View>
        ) : null}

        {hospital.about ? (
          <Card padded>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bodyText}>{hospital.about}</Text>
          </Card>
        ) : null}

        <Card padded>
          <Text style={styles.sectionTitle}>Contact & location</Text>
          {address ? (
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={18} color={Palette.primary} />
              <Text style={styles.bodyText}>{address}</Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color={Palette.primary} />
              <Text style={styles.bodyText}>{phone}</Text>
            </View>
          ) : null}
          {hospital.contact?.email ? (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={Palette.primary} />
              <Text style={styles.bodyText}>{hospital.contact.email}</Text>
            </View>
          ) : null}
          {hospital.contact?.website ? (
            <View style={styles.contactRow}>
              <Ionicons name="globe-outline" size={18} color={Palette.primary} />
              <Text style={styles.bodyText}>{hospital.contact.website}</Text>
            </View>
          ) : null}
          {hospital.opdTimings ? (
            <View style={styles.contactRow}>
              <Ionicons name="time-outline" size={18} color={Palette.primary} />
              <Text style={styles.bodyText}>OPD: {hospital.opdTimings}</Text>
            </View>
          ) : null}
        </Card>

        {hospital.departments && hospital.departments.length > 0 ? (
          <Card padded>
            <Text style={styles.sectionTitle}>Departments</Text>
            <View style={styles.chipRow}>
              {hospital.departments.map((department) => (
                <View key={department} style={styles.chip}>
                  <Text style={styles.chipText}>{department}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {hospital.services && hospital.services.length > 0 ? (
          <Card padded>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.chipRow}>
              {hospital.services.map((service) => (
                <View key={service} style={styles.chip}>
                  <Text style={styles.chipText}>{service}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Doctors at this hospital */}
        <Card padded>
          <Text style={styles.sectionTitle}>Doctors at this hospital ({doctors.length})</Text>
          {doctors.length === 0 ? (
            <Text style={styles.bodyText}>No doctors listed for this hospital right now.</Text>
          ) : (
            doctors.map((doctor) => (
              <Pressable
                key={String(doctor._id)}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/doctor/[id]', params: { id: String(doctor._id) } })}
                style={({ pressed }) => [styles.doctorRow, pressed && styles.pressed]}
              >
                <Image source={{ uri: getDoctorImage(doctor) }} style={styles.doctorAvatar} contentFit="cover" transition={200} />
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName}>{doctor.name}</Text>
                  <Text style={styles.doctorSpecialty}>{doctor.speciality || doctor.department || 'Specialist'}</Text>
                </View>
                <View style={styles.doctorMeta}>
                  <Text style={styles.doctorFee}>₹{doctor.fees || 0}</Text>
                  {doctor.available ? <Badge label="Available" variant="success" /> : <Badge label="Unavailable" variant="neutral" />}
                </View>
              </Pressable>
            ))
          )}
        </Card>

        {/* Gallery */}
        {gallery.length > 0 ? (
          <Card padded>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <View style={styles.galleryGrid}>
              {gallery.map((item, index) => (
                <Pressable
                  key={`${String(item.src)}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${index + 1}`}
                  onPress={() => setLightbox(index)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <HospitalImage
                    source={item.src}
                    style={[styles.galleryImage, { width: galleryCell, height: galleryCell * 0.8 }]}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Gallery lightbox */}
        <Modal visible={lightbox !== null} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <View style={styles.lightbox}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setLightbox(null)} accessibilityLabel="Close preview" />
            {lightbox !== null && gallery[lightbox] ? (
              <HospitalImage
                source={gallery[lightbox].src}
                style={styles.lightboxImage}
                contentFit="contain"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setLightbox(null)}
              style={styles.lightboxClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={28} color={Palette.white} />
            </Pressable>
            {lightbox !== null && gallery[lightbox]?.title ? (
              <Text style={styles.lightboxCaption}>{gallery[lightbox].title}</Text>
            ) : null}
          </View>
        </Modal>

        {/* Reviews */}
        <Card padded>
          <Text style={styles.sectionTitle}>Reviews ({hospital.reviewCount || 0})</Text>
          {!hospital.reviews || hospital.reviews.length === 0 ? (
            <Text style={styles.bodyText}>No patient reviews yet.</Text>
          ) : (
            hospital.reviews.map((review) => (
              <View key={String(review._id)} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewName}>{review.name || 'Patient'}</Text>
                  <View style={styles.reviewStars}>
                    <Ionicons name="star" size={14} color={Palette.gold} />
                    <Text style={styles.reviewRating}>{Number(review.rating).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.bodyText}>{review.comment}</Text>
              </View>
            ))
          )}
        </Card>

        <Button title="Book a doctor here" variant="primary" onPress={browseDoctors} />
        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
  },
  coverWrap: {
    height: 180,
  },
  cover: {
    width: '100%',
    height: '100%',
    backgroundColor: Palette.primaryLight,
  },
  titleBlock: {
    paddingHorizontal: Spacing.lg,
    gap: 4,
    marginTop: Spacing.md,
  },
  name: {
    ...Typography.h2,
    color: Palette.text,
  },
  rating: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
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
    backgroundColor: Palette.border,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  bodyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primaryLight,
  },
  doctorInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  doctorFee: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '700',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  galleryImage: {
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  lightboxImage: {
    width: '100%',
    height: '72%',
    borderRadius: Radius.md,
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCaption: {
    position: 'absolute',
    bottom: 48,
    ...Typography.caption,
    color: Palette.white,
    textAlign: 'center',
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
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
});