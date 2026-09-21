import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { HospitalImage } from "@/components/HospitalImage";
import { FavoriteButton } from "@/components/FavoriteButton";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDoctorName, formatINR, formatISODate } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import { getPublicHospitalDetails } from "@/services/hospitals";
import type { Doctor, Hospital } from "@/types";

export default function HospitalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { width } = useWindowDimensions();

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    getPublicHospitalDetails(id)
      .then((res) => {
        setHospital(res.hospital);
      })
      .catch((err) => {
        setError(toErrorMessage(err, "Unable to load hospital details."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const address = useMemo(() => {
    return [
      hospital?.location?.address,
      hospital?.location?.city,
      hospital?.location?.state,
      hospital?.location?.pincode,
    ]
      .filter(Boolean)
      .join(", ");
  }, [hospital?.location]);

  const phone =
    hospital?.contact?.reception || hospital?.contact?.emergency || "";

  const doctors = useMemo(() => hospital?.doctors || [], [hospital?.doctors]);
  const gallery = useMemo(
    () => hospital?.galleryImages || [],
    [hospital?.galleryImages],
  );

  // Gallery responsive metrics
  const galleryColumns = 3;
  const galleryGap = Spacing.sm;
  const galleryCell = Math.floor(
    (width -
      Spacing.lg * 2 -
      Spacing.lg * 2 -
      galleryGap * (galleryColumns - 1)) /
      galleryColumns,
  );

  // Compute doctor count per department
  const departmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    doctors.forEach((doc) => {
      const dept = doc.department || doc.speciality;
      if (dept) {
        map[dept] = (map[dept] || 0) + 1;
      }
    });
    return map;
  }, [doctors]);

  // Filtered doctors list based on selected department
  const filteredDoctors = useMemo(() => {
    if (!selectedDepartment) return doctors;
    return doctors.filter((doc) => {
      const matchSpecialty =
        doc.speciality?.toLowerCase() === selectedDepartment.toLowerCase();
      const matchDepartment =
        doc.department?.toLowerCase() === selectedDepartment.toLowerCase();
      return matchSpecialty || matchDepartment;
    });
  }, [doctors, selectedDepartment]);

  const browseAllDoctors = () => {
    router.push({
      pathname: "/doctors",
      params: {
        hospitalId: String(hospital?._id),
        ...(selectedDepartment ? { department: selectedDepartment } : {}),
      },
    });
  };

  const handleShare = async () => {
    if (!hospital) return;
    try {
      await Share.share({
        title: hospital.name,
        message: `${hospital.name} on HealPoint\n${address ? `${address}\n` : ""}Book appointments with top specialists: https://healpoint.app/hospital/${hospital._id}`,
      });
    } catch {
      // Ignored
    }
  };

  const handleCall = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/[^+\d]/g, "")}`);
  };

  const handleDirections = () => {
    const mapsUrl = hospital?.location?.mapsUrl;
    if (mapsUrl) {
      Linking.openURL(mapsUrl);
      return;
    }
    if (address || hospital?.name) {
      const query = encodeURIComponent(
        `${hospital?.name || ""} ${address || ""}`.trim(),
      );
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`,
      );
    }
  };

  const handleEmail = () => {
    if (!hospital?.contact?.email) return;
    Linking.openURL(`mailto:${hospital.contact.email}`);
  };

  const handleWebsite = () => {
    if (!hospital?.contact?.website) return;
    const url = hospital.contact.website.startsWith("http")
      ? hospital.contact.website
      : `https://${hospital.contact.website}`;
    Linking.openURL(url);
  };

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
        <ErrorState
          message={error || "Hospital not found."}
          onRetry={loadData}
        />
      </SafeAreaView>
    );
  }

  const verified = hospital.isActive !== false;
  const ratingVal = Number(hospital.rating || 0);
  const reviewsCount =
    hospital.reviewCount || (hospital.reviews ? hospital.reviews.length : 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ---------------- Top App Bar ---------------- */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Palette.text} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Hospital Details
        </Text>
        <View style={styles.topBarActions}>
          {phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call hospital"
              onPress={handleCall}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="call-outline" size={20} color={Palette.primary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share hospital"
            onPress={handleShare}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={Palette.text}
            />
          </Pressable>
          {id ? (
            <FavoriteButton
              hospitalId={String(id)}
              size={20}
              style={styles.iconBtn}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Hero Cover Image ---------------- */}
        <View style={styles.coverWrap}>
          <HospitalImage
            hospital={hospital}
            style={styles.cover}
            contentFit="cover"
            accessibilityLabel={`${hospital.name} photo`}
          />
          <View style={styles.coverGradient} />
          <View style={styles.coverBadges}>
            {verified ? (
              <Badge label="Verified Facility" variant="primary" />
            ) : null}
            {hospital.emergencyFacility ? (
              <Badge label="24/7 Emergency" variant="error" />
            ) : null}
            {hospital.icu ? (
              <Badge label="ICU Available" variant="warning" />
            ) : null}
          </View>
        </View>

        {/* ---------------- Title & Location Block ---------------- */}
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{hospital.name}</Text>
          <View style={styles.ratingRow}>
            <View style={styles.starBadge}>
              <Ionicons name="star" size={14} color={Palette.gold} />
              <Text style={styles.ratingText}>{ratingVal.toFixed(1)}</Text>
            </View>
            <Text style={styles.reviewSummary}>
              ({reviewsCount}{" "}
              {reviewsCount === 1 ? "patient review" : "patient reviews"})
            </Text>
          </View>
          {address ? (
            <View style={styles.locRow}>
              <Ionicons name="location" size={16} color={Palette.primary} />
              <Text style={styles.locText} numberOfLines={2}>
                {address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ---------------- Key Stats Strip ---------------- */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={20} color={Palette.primary} />
            <Text style={styles.statValue}>
              {hospital.doctorCount || doctors.length || 0}
            </Text>
            <Text style={styles.statLabel}>Doctors</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={Palette.success}
            />
            <Text style={styles.statValue}>
              {hospital.availableDoctorCount ??
                hospital.doctorCount ??
                doctors.length ??
                0}
            </Text>
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
            <Text style={styles.statLabel}>ICU Beds</Text>
          </View>
        </View>

        {/* ---------------- Quick Action Row ---------------- */}
        <View style={styles.quickActionRow}>
          {phone ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleCall}
              style={({ pressed }) => [
                styles.quickActionBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="call" size={16} color={Palette.primary} />
              <Text style={styles.quickActionLabel}>Call Hospital</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={handleDirections}
            style={({ pressed }) => [
              styles.quickActionBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="navigate" size={16} color={Palette.primary} />
            <Text style={styles.quickActionLabel}>Directions</Text>
          </Pressable>
          {hospital.contact?.email ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleEmail}
              style={({ pressed }) => [
                styles.quickActionBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="mail" size={16} color={Palette.primary} />
              <Text style={styles.quickActionLabel}>Email</Text>
            </Pressable>
          ) : null}
          {hospital.contact?.website ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleWebsite}
              style={({ pressed }) => [
                styles.quickActionBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="globe" size={16} color={Palette.primary} />
              <Text style={styles.quickActionLabel}>Website</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ---------------- Consultation & Timings ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Consultation & Facilities</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoCellLabel}>OPD Timings</Text>
                <Text style={styles.infoCellValue}>
                  {hospital.opdTimings || "9:00 AM - 8:00 PM"}
                </Text>
              </View>
            </View>
            <View style={styles.infoCell}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoCellLabel}>Avg Consultation</Text>
                <Text style={styles.infoCellValue}>
                  {hospital.consultationFee
                    ? `${formatINR(hospital.consultationFee)} avg`
                    : "Varies by doctor"}
                </Text>
              </View>
            </View>
            <View style={styles.infoCell}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name="medkit-outline"
                  size={18}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoCellLabel}>Emergency Care</Text>
                <Text style={styles.infoCellValue}>
                  {hospital.emergencyFacility
                    ? "24/7 Service"
                    : "During OPD hours"}
                </Text>
              </View>
            </View>
            <View style={styles.infoCell}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name="car-outline"
                  size={18}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoCellLabel}>Ambulance Service</Text>
                <Text style={styles.infoCellValue}>
                  {hospital.facilitiesInfo?.ambulance
                    ? "Available 24x7"
                    : "On Request"}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* ---------------- About Hospital ---------------- */}
        {hospital.about ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About {hospital.name}</Text>
            <Text style={styles.bodyText}>{hospital.about}</Text>
          </Card>
        ) : null}

        {/* ---------------- Departments (Interactive Filter) ---------------- */}
        {hospital.departments && hospital.departments.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Departments ({hospital.departments.length})
              </Text>
              {selectedDepartment ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedDepartment(null)}
                  hitSlop={8}
                >
                  <Text style={styles.clearFilterText}>Show All</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.sectionSubtitle}>
              Tap a department to filter doctors affiliated with this hospital:
            </Text>
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedDepartment(null)}
                style={({ pressed }) => [
                  styles.filterChip,
                  selectedDepartment === null && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedDepartment === null && styles.filterChipTextActive,
                  ]}
                >
                  All ({doctors.length})
                </Text>
              </Pressable>
              {hospital.departments.map((dept) => {
                const count = departmentCounts[dept] || 0;
                const isSelected =
                  selectedDepartment?.toLowerCase() === dept.toLowerCase();
                return (
                  <Pressable
                    key={dept}
                    accessibilityRole="button"
                    onPress={() =>
                      setSelectedDepartment(isSelected ? null : dept)
                    }
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {dept} {count > 0 ? `(${count})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Doctors at this Hospital ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Doctors ({filteredDoctors.length}
                {selectedDepartment ? ` in ${selectedDepartment}` : ""})
              </Text>
              {selectedDepartment ? (
                <Text style={styles.sectionSubtitle}>
                  Showing specialists in {selectedDepartment}
                </Text>
              ) : null}
            </View>
            {doctors.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                onPress={browseAllDoctors}
                hitSlop={8}
              >
                <Text style={styles.viewAllText}>View all</Text>
              </Pressable>
            ) : null}
          </View>

          {filteredDoctors.length === 0 ? (
            <View style={styles.emptyDoctorBlock}>
              <Ionicons
                name="medical-outline"
                size={32}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyDoctorTitle}>No doctors found</Text>
              <Text style={styles.bodyText}>
                {selectedDepartment
                  ? `There are currently no doctors listed under ${selectedDepartment} at this hospital.`
                  : "No doctors are currently listed for this hospital."}
              </Text>
              {selectedDepartment ? (
                <Button
                  title="Clear Department Filter"
                  variant="outline"
                  onPress={() => setSelectedDepartment(null)}
                  style={styles.emptyActionBtn}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.doctorList}>
              {filteredDoctors.map((doctor) => (
                <DoctorItemCard
                  key={String(doctor._id)}
                  doctor={doctor}
                  onPressDetails={() =>
                    router.push({
                      pathname: "/doctor/[id]",
                      params: { id: String(doctor._id) },
                    })
                  }
                  onPressBook={() =>
                    router.push({
                      pathname: "/booking/[doctorId]",
                      params: { doctorId: String(doctor._id) },
                    })
                  }
                />
              ))}
            </View>
          )}
        </Card>

        {/* ---------------- Services ---------------- */}
        {hospital.services && hospital.services.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Clinical Services ({hospital.services.length})
            </Text>
            <View style={styles.chipRow}>
              {hospital.services.map((service) => (
                <View key={service} style={styles.serviceChip}>
                  <Ionicons
                    name="shield-checkmark"
                    size={14}
                    color={Palette.primary}
                  />
                  <Text style={styles.serviceChipText}>{service}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Gallery ---------------- */}
        {gallery.length > 0 ? (
          <Card padded style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Hospital Gallery ({gallery.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Tap an image to view full facility photos:
            </Text>
            <View style={styles.galleryGrid}>
              {gallery.map((item, index) => (
                <Pressable
                  key={`${String(item.src)}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${index + 1}`}
                  onPress={() => setLightbox(index)}
                  style={({ pressed }) => [
                    styles.galleryItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <HospitalImage
                    source={item.src}
                    style={[
                      styles.galleryImage,
                      { width: galleryCell, height: galleryCell * 0.85 },
                    ]}
                    contentFit="cover"
                  />
                  {item.category ? (
                    <View style={styles.galleryTag}>
                      <Text style={styles.galleryTagText} numberOfLines={1}>
                        {item.category}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ---------------- Lightbox Modal ---------------- */}
        <Modal
          visible={lightbox !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setLightbox(null)}
        >
          <View style={styles.lightbox}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setLightbox(null)}
              accessibilityLabel="Close preview"
            />
            {lightbox !== null && gallery[lightbox] ? (
              <View style={styles.lightboxContent}>
                <HospitalImage
                  source={gallery[lightbox].src}
                  style={styles.lightboxImage}
                  contentFit="contain"
                />
                <View style={styles.lightboxMeta}>
                  {gallery[lightbox]?.title ? (
                    <Text style={styles.lightboxTitle}>
                      {gallery[lightbox].title}
                    </Text>
                  ) : null}
                  <Text style={styles.lightboxCounter}>
                    {lightbox + 1} of {gallery.length}
                  </Text>
                </View>

                {/* Lightbox Navigation Controls */}
                <View style={styles.lightboxControls}>
                  <Pressable
                    disabled={lightbox <= 0}
                    onPress={() =>
                      setLightbox((prev) =>
                        prev !== null && prev > 0 ? prev - 1 : prev,
                      )
                    }
                    style={({ pressed }) => [
                      styles.lightboxNavBtn,
                      lightbox <= 0 && styles.lightboxNavDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={24}
                      color={Palette.white}
                    />
                  </Pressable>
                  <Pressable
                    disabled={lightbox >= gallery.length - 1}
                    onPress={() =>
                      setLightbox((prev) =>
                        prev !== null && prev < gallery.length - 1
                          ? prev + 1
                          : prev,
                      )
                    }
                    style={({ pressed }) => [
                      styles.lightboxNavBtn,
                      lightbox >= gallery.length - 1 &&
                        styles.lightboxNavDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color={Palette.white}
                    />
                  </Pressable>
                </View>
              </View>
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
          </View>
        </Modal>

        {/* ---------------- Contact & Location Card ---------------- */}
        <Card padded style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact & Location</Text>
          {address ? (
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Ionicons name="location" size={18} color={Palette.primary} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Address</Text>
                <Text style={styles.bodyText}>{address}</Text>
              </View>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Ionicons name="call" size={18} color={Palette.primary} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Reception & Inquiries</Text>
                <Text style={styles.bodyText}>{phone}</Text>
              </View>
            </View>
          ) : null}
          {hospital.contact?.emergency ? (
            <View style={styles.contactRow}>
              <View
                style={[
                  styles.contactIconWrap,
                  { backgroundColor: "rgba(217, 67, 91, 0.12)" },
                ]}
              >
                <Ionicons name="alert-circle" size={18} color={Palette.error} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Emergency Helpline</Text>
                <Text
                  style={[
                    styles.bodyText,
                    { color: Palette.error, fontWeight: "700" },
                  ]}
                >
                  {hospital.contact.emergency}
                </Text>
              </View>
            </View>
          ) : null}
          {hospital.contact?.email ? (
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Ionicons name="mail" size={18} color={Palette.primary} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Official Email</Text>
                <Text style={styles.bodyText}>{hospital.contact.email}</Text>
              </View>
            </View>
          ) : null}
          {hospital.contact?.website ? (
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Ionicons name="globe" size={18} color={Palette.primary} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Website</Text>
                <Text style={styles.bodyText}>{hospital.contact.website}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.contactActions}>
            <Button
              title="Get Directions"
              variant="outline"
              icon="navigate-outline"
              onPress={handleDirections}
              style={styles.contactBtn}
            />
            {phone ? (
              <Button
                title="Call Reception"
                variant="outline"
                icon="call-outline"
                onPress={handleCall}
                style={styles.contactBtn}
              />
            ) : null}
          </View>
        </Card>

        {/* ---------------- Reviews ---------------- */}
        <Card padded style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Patient Reviews ({reviewsCount})
            </Text>
            {ratingVal > 0 ? (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={13} color={Palette.gold} />
                <Text style={styles.ratingBadgeText}>
                  {ratingVal.toFixed(1)} / 5.0
                </Text>
              </View>
            ) : null}
          </View>
          {!hospital.reviews || hospital.reviews.length === 0 ? (
            <View style={styles.emptyReviewBlock}>
              <Ionicons
                name="chatbubbles-outline"
                size={28}
                color={Palette.textMuted}
              />
              <Text style={styles.bodyText}>
                No patient reviews recorded for this hospital yet. Reviews
                appear automatically as verified patients complete consultations
                with affiliated specialists.
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {hospital.reviews.map((review, idx) => (
                <View
                  key={String(review._id || idx)}
                  style={[
                    styles.reviewItem,
                    idx === (hospital.reviews?.length || 0) - 1 &&
                      styles.lastReviewItem,
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUser}>
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
                  <Text style={styles.reviewComment}>{review.comment}</Text>
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
              ))}
            </View>
          )}
        </Card>

        {/* Space at bottom for sticky bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ---------------- Sticky Bottom Action Bar ---------------- */}
      <View style={styles.stickyBottomBar}>
        <View style={styles.stickyInfo}>
          <Text style={styles.stickyLabel}>Consultation</Text>
          <Text style={styles.stickyValue}>
            {doctors.length} {doctors.length === 1 ? "Doctor" : "Doctors"}{" "}
            Available
          </Text>
        </View>
        <Button
          title="Browse Doctors"
          variant="primary"
          icon="calendar-outline"
          onPress={browseAllDoctors}
          style={styles.stickyBtn}
        />
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Doctor Card Component for Hospital Profile
// ---------------------------------------------------------------------------
function DoctorItemCard({
  doctor,
  onPressDetails,
  onPressBook,
}: {
  doctor: Doctor;
  onPressDetails: () => void;
  onPressBook: () => void;
}) {
  const isAvailable = doctor.available !== false;
  const rating = Number(doctor.rating || 0);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPressDetails}
      style={({ pressed }) => [styles.doctorCard, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: getDoctorImage(doctor) }}
        style={styles.doctorAvatar}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.doctorContent}>
        <View style={styles.doctorMainRow}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {formatDoctorName(doctor.name)}
          </Text>
          <Text style={styles.doctorFee}>{formatINR(doctor.fees)}</Text>
        </View>

        <Text style={styles.doctorSpecialty} numberOfLines={1}>
          {doctor.speciality || doctor.department || "Specialist"}
          {doctor.degree ? ` · ${doctor.degree}` : ""}
        </Text>

        <View style={styles.doctorMetaRow}>
          {rating > 0 ? (
            <View style={styles.doctorRatingWrap}>
              <Ionicons name="star" size={12} color={Palette.gold} />
              <Text style={styles.doctorRatingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
          {doctor.experience ? (
            <Text style={styles.doctorExpText}>
              {doctor.experience}+ yrs exp
            </Text>
          ) : null}
          <Badge
            label={isAvailable ? "Available" : "Unavailable"}
            variant={isAvailable ? "success" : "neutral"}
          />
        </View>

        <View style={styles.doctorActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onPressDetails}
            style={({ pressed }) => [
              styles.profileLinkBtn,
              pressed && styles.pressed,
            ]}
            hitSlop={6}
          >
            <Text style={styles.profileLinkText}>View Profile</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Palette.primary}
            />
          </Pressable>
          <Button
            title="Book"
            variant="primary"
            fullWidth={false}
            onPress={onPressBook}
            style={styles.doctorBookBtn}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    zIndex: 10,
  },
  topBarTitle: {
    ...Typography.h4,
    color: Palette.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: Spacing.sm,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  container: {
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  coverWrap: {
    height: 220,
    position: "relative",
    backgroundColor: Palette.primaryLight,
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  coverBadges: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  titleBlock: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.h1,
    color: Palette.text,
    letterSpacing: -0.3,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  starBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(217, 119, 6, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  ratingText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  reviewSummary: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  locText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    ...Shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    ...Typography.h4,
    color: Palette.text,
    marginTop: 2,
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Palette.border,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  quickActionLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  sectionCard: {
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  viewAllText: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
  },
  clearFilterText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  bodyText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  infoCell: {
    width: "47%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
    gap: 1,
  },
  infoCellLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  infoCellValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  filterChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  serviceChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  doctorList: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  doctorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  doctorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primaryLight,
  },
  doctorContent: {
    flex: 1,
    gap: 3,
  },
  doctorMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doctorName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  doctorFee: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  doctorRatingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  doctorRatingText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorExpText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  doctorActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  profileLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  profileLinkText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
  },
  doctorBookBtn: {
    minWidth: 80,
  },
  emptyDoctorBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyDoctorTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  emptyActionBtn: {
    marginTop: Spacing.sm,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  galleryItem: {
    borderRadius: Radius.md,
    overflow: "hidden",
    position: "relative",
    backgroundColor: Palette.primaryLight,
  },
  galleryImage: {
    borderRadius: Radius.md,
  },
  galleryTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  galleryTagText: {
    fontSize: 9,
    fontWeight: "600",
    color: Palette.white,
    textAlign: "center",
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  lightboxContent: {
    width: "100%",
    alignItems: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "65%",
    borderRadius: Radius.md,
  },
  lightboxMeta: {
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.md,
  },
  lightboxTitle: {
    ...Typography.bodyMedium,
    color: Palette.white,
    fontWeight: "600",
    textAlign: "center",
  },
  lightboxCounter: {
    ...Typography.caption,
    color: "rgba(255, 255, 255, 0.7)",
  },
  lightboxControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginTop: Spacing.md,
  },
  lightboxNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxNavDisabled: {
    opacity: 0.3,
  },
  lightboxClose: {
    position: "absolute",
    top: 52,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  contactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  contactTextWrap: {
    flex: 1,
    gap: 1,
  },
  contactLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  contactActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  contactBtn: {
    flex: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(217, 119, 6, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  ratingBadgeText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  emptyReviewBlock: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  reviewsList: {
    marginTop: Spacing.xs,
  },
  reviewItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
    gap: 4,
  },
  lastReviewItem: {
    borderBottomWidth: 0,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewUser: {
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
    marginTop: 2,
  },
  reviewComment: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
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
  stickyBottomBar: {
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
  stickyInfo: {
    gap: 2,
  },
  stickyLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  stickyValue: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  stickyBtn: {
    minWidth: 170,
  },
});
