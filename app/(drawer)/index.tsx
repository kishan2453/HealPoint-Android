/**
 * HealPoint - Home dashboard (redesigned patient home).
 *
 * A premium healthcare home built entirely from real backend data (doctors,
 * hospitals, appointments, notifications). Nothing on this screen is mocked:
 * availability is only ever shown when the backend confirms it, and every
 * button routes to a working screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DoctorFeatureCard } from '@/components/DoctorFeatureCard';
import { DoctorMiniCard } from '@/components/DoctorMiniCard';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { HospitalCard } from '@/components/HospitalCard';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAppointments } from '@/hooks/use-appointments';
import { useAuth } from '@/hooks/use-auth';
import { useDoctors } from '@/hooks/use-doctors';
import { useHospitals } from '@/hooks/use-hospitals';
import { useNotificationBadge } from '@/hooks/use-notifications';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { doctorSearchableText, doctorSpecialty, isDoctorAvailable } from '@/lib/doctor';
import { firstName, formatDDMMYYYY, formatINR } from '@/lib/format';
import { getDoctorImage, getUserImage } from '@/lib/image';
import type { Appointment, AppointmentStatus, User } from '@/types';

const DOCTOR_POOL_SIZE = 120;
const FEATURED_DOCTORS = 5;
const SPECIALITY_CHIPS = 6;

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function userLocationLabel(user?: User | null): string {
  return user?.address?.trim() || '';
}

/** Last comma-separated segment of the profile address serves as the user's city. */
function userCity(user?: User | null): string {
  const city = (user?.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return (city || '').toLowerCase();
}

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'primary' },
  cancel: { label: 'Cancelled', variant: 'error' },
  rescheduled: { label: 'Rescheduled', variant: 'neutral' },
  missed: { label: 'Missed', variant: 'error' },
};

function appointmentDoctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object' && 'name' in doctor) {
    return doctor.name || 'Doctor';
  }
  return 'Doctor';
}

function appointmentStatus(appointment: Appointment) {
  const status = (appointment.status || 'pending') as AppointmentStatus;
  return APPOINTMENT_STATUS_LABEL[status] || APPOINTMENT_STATUS_LABEL.pending;
}

// ---------------------------------------------------------------------------
// Static navigation maps (all routes exist and are fully functional)
// ---------------------------------------------------------------------------

interface QuickAction {
  key: string;
  label: string;
  icon: IconName;
  tint: string;
  path: '/doctors' | '/hospitals' | '/appointments' | '/consult-online';
  params?: Record<string, string>;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'consult', label: 'Consult Online', icon: 'videocam', tint: Palette.primary, path: '/consult-online' },
  { key: 'doctors', label: 'Find Doctor', icon: 'search', tint: '#2F80ED', path: '/doctors' },
  { key: 'hospitals', label: 'Hospitals', icon: 'business', tint: '#E89A3C', path: '/hospitals' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar', tint: '#9356D6', path: '/appointments' },
  {
    key: 'favorites',
    label: 'Favorites',
    icon: 'heart',
    tint: '#D9435B',
    path: '/doctors',
    params: { favorites: '1' },
  },
];

interface Service {
  key: string;
  label: string;
  caption: string;
  icon: IconName;
  tint: string;
  path: '/doctors' | '/hospitals' | '/consult-online';
  params?: Record<string, string>;
}

const SERVICES: Service[] = [
  {
    key: 'video',
    label: 'Video consult',
    caption: 'Consult a doctor online with Google Meet',
    icon: 'videocam',
    tint: '#2F80ED',
    path: '/consult-online',
  },
  {
    key: 'clinic',
    label: 'Clinic visit',
    caption: 'Book an in-person visit',
    icon: 'medical',
    tint: Palette.primary,
    path: '/doctors',
  },
  {
    key: 'hospital',
    label: 'Hospital care',
    caption: 'Explore hospitals near you',
    icon: 'business',
    tint: '#E89A3C',
    path: '/hospitals',
  },
  {
    key: 'emergency',
    label: 'Emergency',
    caption: '24/7 care & ICU support',
    icon: 'medkit',
    tint: '#D9435B',
    path: '/hospitals',
  },
];
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { today, upcoming, loading: appointmentsLoading, refetch: refetchAppointments } = useAppointments();
  const {
    doctors,
    loading: doctorsLoading,
    error: doctorsError,
    refetch: refetchDoctors,
  } = useDoctors({ limit: DOCTOR_POOL_SIZE });
  const { hospitals, loading: hospitalsLoading, error: hospitalsError, refetch: refetchHospitals } = useHospitals();
  const { unreadCount, refresh: refreshNotifications } = useNotificationBadge();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // A fresh appointment booked/cancelled elsewhere appears as soon as the
  // Home tab regains focus.
  useScreenFocus(() => {
    refetchAppointments();
  });

  const city = userCity(user);
  const locationLabel = userLocationLabel(user);
  const nextAppointment = today[0] || upcoming[0];
  const upcomingCount = upcoming.length + today.length;

  // --- Search: real client-side matching across name/specialty/hospital/location.
  const normalizedQuery = search.trim().toLowerCase();
  const matchingDoctors = useMemo(() => {
    if (!normalizedQuery) return [];
    return doctors.filter((doctor) => doctorSearchableText(doctor).includes(normalizedQuery));
  }, [doctors, normalizedQuery]);
  const searchResults = matchingDoctors.slice(0, 5);
  const searchCount = matchingDoctors.length;

  // --- Specialty chips derived from the real catalog (most common first).
  const specialities = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((doctor) => {
      const label = doctorSpecialty(doctor);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, SPECIALITY_CHIPS)
      .map(([label]) => label);
  }, [doctors]);

  // --- Doctor rows -----------------------------------------------------------
  const availableDoctors = useMemo(() => doctors.filter(isDoctorAvailable), [doctors]);
  const topDoctors = useMemo(
    () =>
      [...doctors]
        .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
        .slice(0, FEATURED_DOCTORS),
    [doctors],
  );

  // --- Nearby (only when the profile actually carries a location) ------------
  const nearbyHospitals = useMemo(() => {
    if (!city || !hospitals.length) return [];
    return hospitals.filter((hospital) => {
      const loc = hospital.location;
      return [loc?.city, loc?.address, loc?.state].some((value) =>
        value?.toLowerCase().includes(city),
      );
    });
  }, [hospitals, city]);

  const nearbyDoctorCount = useMemo(() => {
    if (!city || !doctors.length) return 0;
    return doctors.filter((doctor) => doctorSearchableText(doctor).includes(city)).length;
  }, [doctors, city]);

  const cityOfHospitals = useMemo(() => {
    const first = nearbyHospitals[0];
    return first?.location?.city || first?.location?.address || 'your city';
  }, [nearbyHospitals]);

  const displayHospitals = useMemo(() => {
    if (nearbyHospitals.length) return nearbyHospitals.slice(0, 6);
    return [...hospitals]
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 6);
  }, [hospitals, nearbyHospitals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchAppointments(),
      refetchDoctors(),
      refetchHospitals(),
      refreshNotifications(),
    ]);
    setRefreshing(false);
  };

  const openDoctor = (id: string) => router.push({ pathname: '/doctor/[id]', params: { id } });

  const runQuickAction = (action: QuickAction) => {
    if (action.params) {
      router.push({ pathname: action.path, params: action.params });
    } else {
      router.push(action.path);
    }
  };

  const openService = (service: Service) => {
    if (service.params) {
      router.push({ pathname: service.path, params: service.params });
    } else {
      router.push(service.path);
    }
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ---------------- Hero header ---------------- */}
      <View style={styles.hero}>
        <View style={styles.heroCircleA} />
        <View style={styles.heroCircleB} />
        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}>
                <View style={styles.brandCrossV} />
                <View style={styles.brandCrossH} />
              </View>
              <Text style={styles.brandWordmark}>HealPoint</Text>
            </View>
            <View style={styles.heroActions}>
              <DrawerToggleButton color={Palette.primaryDark} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                onPress={() => router.push('/notification')}
                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
              >
                <Ionicons name="notifications-outline" size={22} color={Palette.white} />
                {unreadCount > 0 ? (
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={({ pressed }) => [styles.heroAvatarButton, pressed && styles.pressed]}
              >
                {user?.image ? (
                  <Image
                    source={{ uri: getUserImage(user.image) }}
                    style={styles.heroAvatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <Ionicons name="person" size={20} color={Palette.primary} />
                )}
              </Pressable>
            </View>
          </View>

          <Text style={styles.heroGreeting}>
            {greetingForHour(new Date().getHours())},{' '}
            <Text style={styles.heroGreetingName}>{firstName(user?.name) || 'there'}</Text> 👋
          </Text>
          <Text style={styles.heroTagline}>Find the right doctor and book your visit in seconds.</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [styles.locationPill, pressed && styles.pressed]}
          >
            <Ionicons name="location" size={14} color={Palette.white} />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {locationLabel || 'Set your location'}
            </Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </SafeAreaView>
      </View>

      {/* ---------------- Search ---------------- */}
      <View style={styles.searchShell}>
        <Card style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={22} color={Palette.primary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search doctors, specialties, hospitals..."
              placeholderTextColor={Palette.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search doctors, specialties, hospitals, locations"
            />
            {search.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearch('')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={Palette.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {!search && specialities.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.specialityContent}
            >
              {specialities.map((label) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  onPress={() => setSearch(label)}
                  style={styles.specialityChip}
                >
                  <Ionicons name="pulse" size={14} color={Palette.primaryDark} />
                  <Text style={styles.specialityChipText}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {search.length > 0 && normalizedQuery ? (
            <View style={styles.resultsBox}>
              <Text style={styles.resultsCount}>
                {searchCount === 0
                  ? 'No matching doctors'
                  : `${searchCount} doctor${searchCount === 1 ? '' : 's'} found`}
              </Text>
              {searchResults.map((doctor) => (
                <Pressable
                  key={String(doctor._id)}
                  accessibilityRole="button"
                  onPress={() => openDoctor(String(doctor._id))}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.rowPressed]}
                >
                  <Image
                    source={{ uri: getDoctorImage(doctor) }}
                    style={styles.resultAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {doctor.name}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {doctorSpecialty(doctor)} • {formatINR(doctor.fees)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                </Pressable>
              ))}
              {searchCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/doctors', params: { search: search.trim() } })
                  }
                  style={({ pressed }) => [styles.viewAllButton, pressed && styles.rowPressed]}
                >
                  <Text style={styles.viewAllText}>
                    {searchCount > searchResults.length
                      ? `View all ${searchCount} results`
                      : 'View these doctors'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={Palette.primaryDark} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      </View>

      {/* ---------------- Quick actions ---------------- */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => runQuickAction(action)}
            style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
          >
            <View style={[styles.quickTileIcon, { backgroundColor: `${action.tint}1A` }]}>
              <Ionicons name={action.icon} size={22} color={action.tint} />
              {action.key === 'appointments' && upcomingCount > 0 ? (
                <View style={[styles.quickBadge, { backgroundColor: action.tint }]}>
                  <Text style={styles.quickBadgeText}>{upcomingCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.quickTileLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ---------------- Health services ---------------- */}
      <View style={styles.section}>
        <SectionHeader title="Health services" subtitle="Everything you can do on HealPoint" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalContent}
        >
          {SERVICES.map((service) => (
            <Pressable
              key={service.key}
              accessibilityRole="button"
              onPress={() => openService(service)}
              style={({ pressed }) => [styles.serviceTile, pressed && styles.pressed]}
            >
              <View style={[styles.serviceIcon, { backgroundColor: `${service.tint}1A` }]}>
                <Ionicons name={service.icon} size={22} color={service.tint} />
              </View>
              <Text style={styles.serviceLabel} numberOfLines={1}>
                {service.label}
              </Text>
              <Text style={styles.serviceCaption} numberOfLines={2}>
                {service.caption}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {/* ---------------- Upcoming appointment ---------------- */}
      <View style={styles.section}>
        <SectionHeader
          title="Upcoming appointment"
          actionLabel="View all"
          onAction={() => router.push('/appointments')}
        />
        {appointmentsLoading ? (
          <Loading fullScreen={false} label="Checking your appointments..." />
        ) : nextAppointment ? (
          <View style={styles.nextApptCard}>
            <View style={styles.nextApptHeader}>
              <View style={styles.nextApptIcon}>
                <Ionicons name="calendar" size={18} color={Palette.white} />
              </View>
              <View style={styles.nextApptTitles}>
                <Text style={styles.nextApptRowLabel}>Next visit</Text>
                <Text style={styles.nextApptDoctor} numberOfLines={1}>
                  {appointmentDoctorName(nextAppointment)}
                </Text>
              </View>
              <Badge
                label={appointmentStatus(nextAppointment).label}
                variant={appointmentStatus(nextAppointment).variant}
              />
            </View>
            <View style={styles.nextApptRow}>
              <Ionicons name="time-outline" size={16} color={Palette.primary} />
              <Text style={styles.nextApptRowText}>
                {formatDDMMYYYY(nextAppointment.slotDate)} • {nextAppointment.slotTime}
              </Text>
            </View>
            <View style={styles.nextApptRow}>
              <Ionicons name="business-outline" size={16} color={Palette.primary} />
              <Text style={styles.nextApptRowText} numberOfLines={1}>
                {nextAppointment.hospitalName || 'Clinic visit'}
              </Text>
            </View>
            <View style={styles.nextApptFooter}>
              <View>
                <Text style={styles.nextApptFeeLabel}>Consultation fee</Text>
                <Text style={styles.nextApptFee}>{formatINR(nextAppointment.amount)}</Text>
              </View>
              <Button
                title="View details"
                variant="secondary"
                style={styles.nextApptButton}
                onPress={() =>
                  router.push({
                    pathname: '/appointment/[id]',
                    params: { id: String(nextAppointment._id) },
                  })
                }
              />
            </View>
          </View>
        ) : (
          <View style={styles.ctaCard}>
            <View style={styles.ctaRow}>
              <View style={styles.ctaIcon}>
                <Ionicons name="shield-checkmark" size={26} color={Palette.primary} />
              </View>
              <View style={styles.ctaTexts}>
                <Text style={styles.ctaTitle}>Book a consultation</Text>
                <Text style={styles.ctaText}>
                  Find a trusted doctor near you — it only takes a minute.
                </Text>
              </View>
            </View>
            <Button
              title="Find doctors"
              onPress={() => router.push({ pathname: '/doctors' })}
              style={styles.ctaButton}
            />
          </View>
        )}
      </View>

      {/* ---------------- Available doctors ---------------- */}
      <View style={styles.section}>
        <SectionHeader
          title="Available doctors"
          subtitle={
            doctorsLoading
              ? 'Checking live availability...'
              : nearbyDoctorCount > 0
                ? `${nearbyDoctorCount} near you · ${availableDoctors.length} with open slots`
                : `${availableDoctors.length} doctors with open slots`
          }
          actionLabel="See all"
          onAction={() => router.push({ pathname: '/doctors' })}
        />
        {doctorsLoading ? (
          <Loading fullScreen={false} label="Loading doctors..." />
        ) : doctorsError ? (
          <ErrorState message={doctorsError} onRetry={refetchDoctors} />
        ) : availableDoctors.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {availableDoctors.map((doctor, index) => (
              <DoctorFeatureCard key={String(doctor._id)} doctor={doctor} index={index} />
            ))}
          </ScrollView>
        ) : (
          <Card padded>
            <Text style={styles.infoBody}>No doctors have live slots right now.</Text>
            <View style={styles.infoAction}>
              <Button
                title="Browse all doctors"
                variant="outline"
                onPress={() => router.push({ pathname: '/doctors' })}
              />
            </View>
          </Card>
        )}
      </View>
      {/* ---------------- Top rated doctors ---------------- */}
      {topDoctors.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Top rated doctors"
            subtitle="Highest rated on HealPoint"
            actionLabel="See all"
            onAction={() => router.push({ pathname: '/doctors' })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {topDoctors.map((doctor, index) => (
              <DoctorMiniCard key={String(doctor._id)} doctor={doctor} index={index} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ---------------- Hospitals / nearby ---------------- */}
      {hospitalsError ? (
        <View style={styles.section}>
          <ErrorState message={hospitalsError} onRetry={refetchHospitals} />
        </View>
      ) : hospitalsLoading ? (
        <View style={styles.section}>
          <SectionHeader title="Hospitals & clinics" />
          <Loading fullScreen={false} label="Loading hospitals..." />
        </View>
      ) : displayHospitals.length ? (
        <View style={styles.section}>
          <SectionHeader
            title={nearbyHospitals.length ? 'Hospitals near you' : 'Hospitals & clinics'}
            subtitle={
              nearbyHospitals.length
                ? `Near ${cityOfHospitals}`
                : `${hospitals.length} hospitals on HealPoint`
            }
            actionLabel="See all"
            onAction={() => router.push({ pathname: '/hospitals' })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {displayHospitals.map((hospital) => (
              <View key={String(hospital._id)} style={styles.hospitalCardWrap}>
                <HospitalCard hospital={hospital} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenContent: {
    paddingBottom: Spacing.xxxl,
  },
  pressed: {
    opacity: 0.85,
  },
  rowPressed: {
    opacity: 0.75,
  },

  // ---- Hero ---------------------------------------------------------------
  hero: {
    backgroundColor: Palette.primary,
    overflow: 'hidden',
    paddingBottom: Spacing.huge,
  },
  heroSafe: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  heroCircleA: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroCircleB: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCrossV: {
    position: 'absolute',
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: Palette.white,
  },
  brandCrossH: {
    position: 'absolute',
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.white,
  },
  brandWordmark: {
    ...Typography.h4,
    color: Palette.white,
    fontWeight: '700',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.primary,
  },
  heroBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
  heroAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatar: {
    width: 40,
    height: 40,
  },
  heroGreeting: {
    ...Typography.h1,
    color: Palette.white,
    fontWeight: '700',
    marginTop: Spacing.xl,
  },
  heroGreetingName: {
    fontWeight: '800',
  },
  heroTagline: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xs,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.lg,
    maxWidth: '100%',
  },
  locationPillText: {
    ...Typography.bodySmall,
    color: Palette.white,
    fontWeight: '600',
    flexShrink: 1,
  },

  // ---- Search -------------------------------------------------------------
  searchShell: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xxl,
  },
  searchCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Palette.text,
    paddingVertical: Spacing.sm,
  },
  specialityContent: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  specialityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  specialityChipText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  resultsBox: {
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.sm,
    gap: 2,
  },
  resultsCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    ...Typography.label,
    color: Palette.text,
  },
  resultMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  viewAllText: {
    ...Typography.label,
    color: Palette.primaryDark,
  },

  // ---- Quick actions ------------------------------------------------------
  quickGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: Spacing.md,
    ...Shadows.card,
  },
  quickTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  quickBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
  quickTileLabel: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ---- Content sections ---------------------------------------------------
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  horizontalContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  serviceTile: {
    width: 136,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  serviceCaption: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  // ---- Upcoming appointment ----
  nextApptCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  nextApptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  nextApptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextApptTitles: {
    flex: 1,
    gap: 1,
  },
  nextApptRowLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  nextApptDoctor: {
    ...Typography.h4,
    color: Palette.text,
  },
  nextApptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nextApptRowText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    flex: 1,
  },
  nextApptFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  nextApptFeeLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  nextApptFee: {
    ...Typography.h4,
    color: Palette.text,
  },
  nextApptButton: {
    minHeight: 44,
    minWidth: 140,
  },

  ctaCard: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ctaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTexts: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  ctaText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  ctaButton: {
    minHeight: 46,
  },

  infoBody: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  infoAction: {
    marginTop: Spacing.sm,
  },
  hospitalCardWrap: {
    width: 280,
  },
});