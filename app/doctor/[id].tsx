/**
 * HealPoint - Doctor Profile (Premium Healthcare UI).
 *
 * Displays full doctor details, credentials, hospital affiliation, consultation
 * modes, weekly availability, and patient reviews backed by real backend data.
 *
 * Sourced from GET /doctor/get-details/:id. 100% Real data only.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { FavoriteButton } from "@/components/FavoriteButton";
import { ReviewModal } from "@/components/ReviewModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  doctorHospital,
  doctorHospitalName,
  doctorLocationText,
  doctorSpecialty,
  isDoctorAvailable,
  nextAvailableSlot,
} from "@/lib/doctor";
import { formatDoctorName, formatINR, formatISODate } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import { getDoctorDetails } from "@/services/doctors";
import type { Doctor, DoctorProfileTimeline } from "@/types";

export default function DoctorDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewVisible, setReviewVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await getDoctorDetails(id);
      setDoctor(res.doctor);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load doctor details."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openBooking = () => {
    if (!doctor) return;
    router.push({
      pathname: "/booking/[doctorId]",
      params: { doctorId: String(doctor._id) },
    });
  };

  const callDoctor = () => {
    if (!doctor?.phone) return;
    Linking.openURL(`tel:${doctor.phone.replace(/[^+\d]/g, "")}`);
  };

  const emailDoctor = () => {
    if (!doctor?.email) return;
    Linking.openURL(`mailto:${doctor.email}`);
  };

  const handleShare = async () => {
    if (!doctor) return;
    try {
      await Share.share({
        title: formatDoctorName(doctor.name),
        message: `Consult with ${formatDoctorName(doctor.name)} (${doctor.speciality || "Specialist"}) on HealPoint.\nBook an appointment online: https://healpoint.app/doctor/${doctor._id}`,
      });
    } catch {
      // Dismissed
    }
  };

  const openHospitalProfile = () => {
    if (!doctor) return;
    const hospitalObj = doctorHospital(doctor);
    const targetHospitalId = hospitalObj?._id
      ? String(hospitalObj._id)
      : typeof doctor.hospitalId === "string"
        ? doctor.hospitalId
        : null;

    if (targetHospitalId) {
      router.push({
        pathname: "/hospital/[id]",
        params: { id: targetHospitalId },
      });
    }
  };

  const handleGetDirections = () => {
    if (!doctor) return;
    const loc = doctorLocationText(doctor);
    if (!loc) return;
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${formatDoctorName(doctor.name)} ${loc}`,
      )}`,
    );
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
        <ErrorState message={error || "Doctor not found."} onRetry={load} />
      </SafeAreaView>
    );
  }

  // ============================ DERIVED =================================
  const doctorId = String(doctor._id);
  const specialty = doctorSpecialty(doctor);
  const hospital = doctorHospitalName(doctor);
  const hospitalObj = doctorHospital(doctor);
  const targetHospitalId = hospitalObj?._id
    ? String(hospitalObj._id)
    : typeof doctor.hospitalId === "string"
      ? doctor.hospitalId
      : null;

  const location = doctorLocationText(doctor);
  const accepting = isDoctorAvailable(doctor);
  const available = doctor.available === true;
  const nextSlot = nextAvailableSlot(doctor);
  const languages = (doctor.languages || []).filter((value) =>
    Boolean(value && value.trim()),
  );
  const consultationTypes = doctor.consultationTypes || [];
  const reviews = doctor.reviews || doctor.patientFeedback || [];
  const weeklySchedule = (doctor.weeklySchedule || []).filter(
    (day) => day && day.enabled !== false,
  );
  const verified =
    doctor.verificationStatus === "Verified" || doctor.isActive !== false;
  const ratingVal = Number(doctor.rating || 0);
  const reviewCount = doctor.reviewCount || reviews.length;

  const serviceRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }[] = [];

  if (consultationTypes.length > 0) {
    serviceRows.push({
      icon: "videocam",
      label: "Consultation Modes",
      value: consultationTypes
        .map((type) =>
          type === "video"
            ? "Video Consultation"
            : type === "clinic"
              ? "Clinic Visit"
              : type,
        )
        .join(" • "),
    });
  }
  if (doctor.department) {
    serviceRows.push({
      icon: "medical",
      label: "Clinical Department",
      value: doctor.department,
    });
  }
  if (doctor.specialization) {
    serviceRows.push({
      icon: "shield-checkmark",
      label: "Sub-Specialization",
      value: doctor.specialization,
    });
  }

  // ============================ RENDER =================================
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Subtle ambient healthcare background elements */}
      <View pointerEvents="none" style={styles.screenDecor}>
        <View style={styles.screenGlowTop} />
        <View style={styles.screenGlowBottom} />
        <View style={styles.screenCross}>
          <View style={styles.screenCrossV} />
          <View style={styles.screenCrossH} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Hero Section ---------------- */}
        <View style={styles.hero}>
          <Image
            source={{ uri: getDoctorImage(doctor) }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
          {/* Subtle medical backdrop overlay */}
          <View pointerEvents="none" style={styles.heroBackdropDecor}>
            <View style={styles.heroBackdropAura} />
            <View style={styles.heroBackdropPulseRing} />
            <View style={styles.heroBackdropCross}>
              <View style={styles.heroCrossV} />
              <View style={styles.heroCrossH} />
            </View>
          </View>
          <View style={styles.heroShadeTop} />
          <View style={styles.heroShadeMid} />
          <View style={styles.heroShadeBottom} />

          {/* Navigation Bar */}
          <View style={styles.heroTopBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={Palette.text} />
            </Pressable>
            <View style={styles.topRightActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share doctor"
                onPress={handleShare}
                style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons
                  name="share-social-outline"
                  size={22}
                  color={Palette.text}
                />
              </Pressable>
              <View style={styles.fab}>
                <FavoriteButton doctorId={doctorId} size={24} />
              </View>
            </View>
          </View>

          {/* Hero Typography & Badges */}
          <View style={styles.heroText}>
            <Text style={styles.name}>{formatDoctorName(doctor.name)}</Text>
            <Text style={styles.specialty} numberOfLines={2}>
              {specialty}
              {doctor.degree ? ` · ${doctor.degree}` : ""}
            </Text>

            {/* Clickable Hospital Affiliation Pill */}
            {hospital ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hospital: ${hospital}`}
                onPress={targetHospitalId ? openHospitalProfile : undefined}
                style={({ pressed }) => [
                  styles.heroHospitalPill,
                  targetHospitalId && styles.heroHospitalClickable,
                  pressed && targetHospitalId && styles.pressed,
                ]}
              >
                <Ionicons name="business" size={14} color={Palette.white} />
                <Text style={styles.heroHospitalText} numberOfLines={1}>
                  {hospital}
                </Text>
                {targetHospitalId ? (
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={Palette.white}
                  />
                ) : null}
              </Pressable>
            ) : null}

            <View style={styles.heroBadges}>
              {verified ? (
                <Badge label="Verified Doctor" variant="primary" />
              ) : null}
              <Badge
                label={
                  accepting
                    ? "Available for booking"
                    : "Currently not accepting"
                }
                variant={accepting ? "success" : "warning"}
              />
            </View>
          </View>
        </View>

        {/* ---------------- Key Stats Card ---------------- */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Ionicons name="star" size={20} color={Palette.gold} />
            <Text style={styles.statValue}>{ratingVal.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={Palette.primary}
            />
            <Text style={styles.statValue}>{reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons
              name="briefcase-outline"
              size={20}
              color={Palette.primary}
            />
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

        {/* ---------------- Online Video Consultation Banner ---------------- */}
        <Card padded style={styles.videoConsultCard}>
          <View style={styles.videoConsultHeader}>
            <View style={styles.videoConsultIconWrap}>
              <Ionicons name="videocam" size={22} color={Palette.primary} />
            </View>
            <View style={styles.videoConsultTitleWrap}>
              <View style={styles.videoBadgeRow}>
                <Text style={styles.videoConsultTitle}>
                  Online Video Consultation
                </Text>
                <Badge label="Google Meet" variant="primary" />
              </View>
              <Text style={styles.videoConsultFee}>
                Fee: {formatINR(doctor.fees)} per session
              </Text>
            </View>
          </View>
          <Text style={styles.videoConsultDesc}>
            Connect securely with {formatDoctorName(doctor.name)} from the
            comfort of your home. Upon booking confirmation, an automated
            private Google Meet link will be generated and attached to your
            appointment details.
          </Text>
          <View style={styles.videoFeaturesRow}>
            <View style={styles.videoFeature}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={Palette.success}
              />
              <Text style={styles.videoFeatureText}>End-to-End Encrypted</Text>
            </View>
            <View style={styles.videoFeature}>
              <Ionicons
                name="document-text-outline"
                size={14}
                color={Palette.primary}
              />
              <Text style={styles.videoFeatureText}>Digital Prescription</Text>
            </View>
            <View style={styles.videoFeature}>
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color={Palette.info}
              />
              <Text style={styles.videoFeatureText}>Any Device</Text>
            </View>
          </View>
        </Card>

        {/* ---------------- Contact Actions ---------------- */}
        {doctor.phone || doctor.email ? (
          <View style={styles.actionRow}>
            {doctor.phone ? (
              <Button
                title="Call Clinic"
                variant="outline"
                icon="call-outline"
                onPress={callDoctor}
                style={styles.actionButton}
              />
            ) : null}
            {doctor.email ? (
              <Button
                title="Email"
                variant="outline"
                icon="mail-outline"
                onPress={emailDoctor}
                style={styles.actionButton}
              />
            ) : null}
          </View>
        ) : null}

        {/* ---------------- About Doctor ---------------- */}
        {doctor.about ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              About {formatDoctorName(doctor.name)}
            </Text>
            <Text style={styles.bodyText}>{doctor.about}</Text>
          </Card>
        ) : null}

        {/* ---------------- Services & Department ---------------- */}
        {serviceRows.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Services & Care</Text>
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

        {/* ---------------- Hospital / Clinic Location ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hospital & Location</Text>
          {targetHospitalId ? (
            <Pressable
              accessibilityRole="button"
              onPress={openHospitalProfile}
              style={({ pressed }) => [
                styles.hospitalNavCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.infoIcon}>
                <Ionicons name="business" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Affiliated Hospital</Text>
                <Text style={styles.infoValue}>{hospital}</Text>
                <Text style={styles.hospitalViewLink}>
                  Tap to view hospital details & facilities →
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Palette.primary}
              />
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="business" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Affiliated Hospital</Text>
                <Text style={styles.infoValue}>{hospital}</Text>
              </View>
            </View>
          )}

          {location ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{location}</Text>
              </View>
            </View>
          ) : null}
          {doctor.clinicInfo?.address ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="navigate" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Clinic Address</Text>
                <Text style={styles.infoValue}>
                  {doctor.clinicInfo.address}
                </Text>
              </View>
            </View>
          ) : null}
          {doctor.clinicInfo?.roomNo ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="enter" size={18} color={Palette.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Room / Cabin</Text>
                <Text style={styles.infoValue}>{doctor.clinicInfo.roomNo}</Text>
              </View>
            </View>
          ) : null}

          {location || doctor.clinicInfo?.address ? (
            <Button
              title="Get Directions"
              variant="outline"
              icon="navigate-outline"
              onPress={handleGetDirections}
              style={styles.locationBtn}
            />
          ) : null}
        </Card>

        {/* ---------------- Languages Spoken ---------------- */}
        {languages.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Languages Spoken</Text>
            <View style={styles.chipRow}>
              {languages.map((language) => (
                <View key={language} style={styles.chip}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={14}
                    color={Palette.primaryDark}
                  />
                  <Text style={styles.chipText}>{language}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Live Availability ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Availability & Schedule</Text>
          <View style={styles.availabilityRow}>
            <Ionicons
              name={accepting ? "checkmark-circle" : "time"}
              size={22}
              color={accepting ? Palette.success : Palette.warning}
            />
            <View style={styles.availabilityText}>
              <Text
                style={[
                  styles.availabilityStatus,
                  accepting ? styles.available : styles.unavailable,
                ]}
              >
                {accepting ? "Accepting appointments" : "No slots currently"}
              </Text>
              {nextSlot ? (
                <Text style={styles.availabilityDetail}>
                  Next available: {nextSlot.date} at {nextSlot.time}
                </Text>
              ) : (
                <Text style={styles.availabilityDetail}>
                  Check weekly schedule below or choose another day during
                  booking.
                </Text>
              )}
            </View>
          </View>

          {weeklySchedule.length > 0 ? (
            <View style={styles.weeklyWrap}>
              <Text style={styles.weeklyTitle}>Weekly Working Hours</Text>
              {weeklySchedule.map((day) => (
                <View key={day.day} style={styles.weeklyRow}>
                  <Text style={styles.weeklyDay}>{day.day}</Text>
                  <Text style={styles.weeklyTime}>
                    {day.startTime && day.endTime
                      ? `${day.startTime} - ${day.endTime}`
                      : "Available"}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* ---------------- Education & Qualifications ---------------- */}
        {doctor.qualificationTimeline &&
        doctor.qualificationTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Qualifications</Text>
            {doctor.qualificationTimeline.map((item, index) => (
              <TimelineItem key={`qual-${index}`} item={item} />
            ))}
          </Card>
        ) : null}

        {doctor.educationTimeline && doctor.educationTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Education & Training</Text>
            {doctor.educationTimeline.map((item, index) => (
              <TimelineItem key={`edu-${index}`} item={item} />
            ))}
          </Card>
        ) : null}

        {/* ---------------- Experience Timeline ---------------- */}
        {doctor.experienceTimeline && doctor.experienceTimeline.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Experience & Positions</Text>
            {doctor.experienceTimeline.map((item, index) => (
              <TimelineItem key={`exp-${index}`} item={item} />
            ))}
          </Card>
        ) : null}

        {/* ---------------- Awards & Achievements ---------------- */}
        {(doctor.awards && doctor.awards.length > 0) ||
        (doctor.achievements && doctor.achievements.length > 0) ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Awards & Recognitions</Text>
            {(doctor.awards || []).map((award, index) => (
              <View key={`award-${index}`} style={styles.achievementRow}>
                <Ionicons name="trophy" size={16} color={Palette.gold} />
                <Text style={styles.bodyText}>{award}</Text>
              </View>
            ))}
            {(doctor.achievements || []).map((achievement, index) => (
              <View key={`ach-${index}`} style={styles.achievementRow}>
                <Ionicons name="ribbon" size={16} color={Palette.primary} />
                <Text style={styles.bodyText}>{achievement}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ---------------- Patient Reviews ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.reviewHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Patient Reviews ({reviewCount})
              </Text>
              {ratingVal > 0 ? (
                <View style={styles.starRow}>
                  <Ionicons name="star" size={14} color={Palette.gold} />
                  <Text style={styles.reviewRatingOverall}>
                    {ratingVal.toFixed(1)} out of 5.0
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReviewVisible(true)}
              style={({ pressed }) => [
                styles.writeReviewBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={Palette.primary}
              />
              <Text style={styles.writeReview}>Write a review</Text>
            </Pressable>
          </View>
          {reviews.length === 0 ? (
            <View style={styles.emptyReviewWrap}>
              <Ionicons
                name="chatbubbles-outline"
                size={28}
                color={Palette.textMuted}
              />
              <Text style={styles.bodyText}>
                No reviews yet. Be the first to share your consultation
                experience with {formatDoctorName(doctor.name)}.
              </Text>
            </View>
          ) : (
            reviews.map((review, idx) => (
              <View
                key={String(review._id || review.createdAt || idx)}
                style={[
                  styles.reviewItem,
                  idx === reviews.length - 1 && styles.lastReviewItem,
                ]}
              >
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAuthorWrap}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>
                        {(review.name || "P")[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewName}>
                        {review.name || "Verified Patient"}
                      </Text>
                      {review.createdAt ? (
                        <Text style={styles.reviewDate}>
                          {formatISODate(review.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.reviewStars}>
                    <Ionicons name="star" size={14} color={Palette.gold} />
                    <Text style={styles.reviewRating}>
                      {Number(review.rating).toFixed(1)}
                    </Text>
                  </View>
                </View>
                {review.title ? (
                  <Text style={styles.reviewTitle}>{review.title}</Text>
                ) : null}
                <Text style={styles.bodyText}>{review.comment}</Text>
                {review.tags && review.tags.length > 0 ? (
                  <View style={styles.reviewTagsRow}>
                    {review.tags.map((tag) => (
                      <View key={tag} style={styles.reviewTagBadge}>
                        <Text style={styles.reviewTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* ---------------- Sticky Booking Bar ---------------- */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <View style={styles.bottomFee}>
          <Text style={styles.bottomFeeLabel}>Consultation Fee</Text>
          <Text style={styles.bottomFeeValue}>{formatINR(doctor.fees)}</Text>
        </View>
        <Button
          title={available ? "Book Appointment" : "Currently Unavailable"}
          icon="calendar"
          onPress={openBooking}
          disabled={!available}
          style={styles.bottomButton}
        />
      </View>

      <ReviewModal
        visible={reviewVisible}
        doctorId={doctorId}
        doctorName={formatDoctorName(doctor.name)}
        hospitalId={targetHospitalId || undefined}
        hospitalName={hospital || undefined}
        onClose={() => {
          setReviewVisible(false);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function TimelineItem({ item }: { item: DoctorProfileTimeline }) {
  const title = item.title || item.institute || item.hospital || "";
  const sub = item.institute || item.hospital || "";
  const year =
    item.year ||
    (item.startYear
      ? `${item.startYear}${item.endYear ? ` - ${item.endYear}` : ""}`
      : "");
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineNode}>
        <View style={styles.timelineDot} />
      </View>
      <View style={styles.timelineBody}>
        {title ? <Text style={styles.timelineTitle}>{title}</Text> : null}
        {sub && sub !== title ? (
          <Text style={styles.timelineSub}>{sub}</Text>
        ) : null}
        {year ? <Text style={styles.timelineYear}>{year}</Text> : null}
        {item.description ? (
          <Text style={styles.bodyText}>{item.description}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  screenGlowTop: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  screenGlowBottom: {
    position: "absolute",
    bottom: 80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(34, 167, 160, 0.06)",
  },
  screenCross: {
    position: "absolute",
    top: "30%",
    right: 20,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  screenCrossV: {
    position: "absolute",
    width: 8,
    height: 28,
    borderRadius: 4,
    backgroundColor: "rgba(14, 159, 142, 0.07)",
  },
  screenCrossH: {
    position: "absolute",
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(14, 159, 142, 0.07)",
  },
  container: {
    paddingBottom: 110,
    gap: Spacing.lg,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  hero: {
    height: 390,
    backgroundColor: Palette.primaryDark,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Palette.primaryLight,
  },
  heroBackdropDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  heroBackdropAura: {
    position: "absolute",
    top: 40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(14, 159, 142, 0.15)",
  },
  heroBackdropPulseRing: {
    position: "absolute",
    top: 20,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  heroBackdropCross: {
    position: "absolute",
    top: 30,
    right: 30,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.15,
  },
  heroCrossV: {
    position: "absolute",
    width: 8,
    height: 36,
    borderRadius: 4,
    backgroundColor: Palette.white,
  },
  heroCrossH: {
    position: "absolute",
    width: 36,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.white,
  },
  heroShadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  heroShadeMid: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: "rgba(10, 30, 26, 0.25)",
  },
  heroShadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(8, 26, 22, 0.92)",
  },
  heroTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    zIndex: 10,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  heroText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: 5,
    zIndex: 10,
  },
  name: {
    ...Typography.h1,
    color: Palette.white,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: -0.3,
  },
  specialty: {
    ...Typography.bodyMedium,
    color: "rgba(255, 255, 255, 0.92)",
    fontWeight: "600",
  },
  heroHospitalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
  heroHospitalClickable: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  heroHospitalText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "600",
  },
  heroBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: "wrap",
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: Palette.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
    ...Shadows.card,
  },
  stat: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  statValue: {
    ...Typography.h4,
    color: Palette.text,
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Palette.border,
  },
  videoConsultCard: {
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.25)",
    backgroundColor: "rgba(14, 159, 142, 0.04)",
    ...Shadows.card,
  },
  videoConsultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  videoConsultIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  videoConsultTitleWrap: {
    flex: 1,
    gap: 3,
  },
  videoBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  videoConsultTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  videoConsultFee: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  videoConsultDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  videoFeaturesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(14, 159, 142, 0.12)",
  },
  videoFeature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  videoFeatureText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
  sectionCard: {
    marginHorizontal: Spacing.lg,
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  bodyText: {
    ...Typography.body,
    color: Palette.textMuted,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  hospitalNavCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  hospitalViewLink: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
    marginTop: 2,
  },
  locationBtn: {
    marginTop: Spacing.xs,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  availabilityRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  availabilityText: {
    flex: 1,
    gap: 2,
  },
  availabilityStatus: {
    ...Typography.bodyMedium,
    fontWeight: "700",
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
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  weeklyTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    marginBottom: 2,
  },
  weeklyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  weeklyDay: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  weeklyTime: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  timelineItem: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timelineNode: {
    alignItems: "center",
    width: 14,
    paddingTop: 5,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  timelineTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  timelineSub: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
  },
  timelineYear: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  reviewRatingOverall: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
  },
  writeReview: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  emptyReviewWrap: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  reviewItem: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  lastReviewItem: {
    borderBottomWidth: 0,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewAuthorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  reviewName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  reviewDate: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reviewRating: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  reviewTitle: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  reviewTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  reviewTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
  },
  reviewTagText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
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
    ...Typography.h3,
    color: Palette.primaryDark,
    fontWeight: "800",
  },
  bottomButton: {
    minWidth: 180,
  },
});
