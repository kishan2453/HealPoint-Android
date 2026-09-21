/**
 * HealPoint - Premium Healthcare Onboarding & Welcome Experience.
 *
 * Professional, healthcare-focused introduction for first-time users:
 *   - Verified doctor network & clinical specialties
 *   - Accredited hospitals, OPD schedules & emergency facilities
 *   - Seamless in-clinic & Google Meet video appointment booking
 *   - Encrypted digital health locker & prescriptions
 *
 * Ensures seamless persistence: first-time users see onboarding, while
 * returning and logged-out users navigate straight to Login/Home.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HealPointLogo } from "@/components/HealPointLogo";
import { Button } from "@/components/ui/Button";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

interface OnboardingSlide {
  id: string;
  badge: string;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  primaryIcon: keyof typeof Ionicons.glyphMap;
  secondaryIcon: keyof typeof Ionicons.glyphMap;
  statText: string;
  statLabel: string;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "doctors",
    badge: "VERIFIED SPECIALISTS",
    badgeIcon: "shield-checkmark",
    title: "Find Trusted Doctors",
    subtitle:
      "Connect with certified medical specialists across cardiology, neurology, pediatrics, and more with verified ratings.",
    accent: Palette.primary,
    primaryIcon: "medkit",
    secondaryIcon: "star",
    statText: "500+ Doctors",
    statLabel: "Verified Specialists",
  },
  {
    id: "hospitals",
    badge: "ACCREDITED CARE",
    badgeIcon: "business",
    title: "Discover Top Hospitals",
    subtitle:
      "Explore leading healthcare centers, specialized departments, and 24×7 emergency facilities in your city.",
    accent: "#2A69AC",
    primaryIcon: "fitness",
    secondaryIcon: "location",
    statText: "Top Hospitals",
    statLabel: "NABH Accredited",
  },
  {
    id: "appointments",
    badge: "SMART SCHEDULING",
    badgeIcon: "calendar",
    title: "Instant & Video Bookings",
    subtitle:
      "Book queue-free in-clinic consultations or connect with verified specialists via Google Meet video appointments.",
    accent: "#0E9F8E",
    primaryIcon: "videocam",
    secondaryIcon: "time",
    statText: "In-Clinic & Video",
    statLabel: "Zero Waiting Times",
  },
  {
    id: "records",
    badge: "HEALTH LOCKER",
    badgeIcon: "lock-closed",
    title: "Prescriptions & Records",
    subtitle:
      "Safely access your encrypted medical history, lab diagnostics, and digital doctor prescriptions anytime on your phone.",
    accent: "#10B981",
    primaryIcon: "document-text",
    secondaryIcon: "shield-checkmark",
    statText: "100% Encrypted",
    statLabel: "Private Health Data",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { markOnboardingCompleted } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  // Limit slide width on wide screens (tablets, desktop web)
  const slideWidth = Math.min(screenWidth, 480);

  const handleSkip = useCallback(async () => {
    await markOnboardingCompleted();
    router.replace("/login");
  }, [markOnboardingCompleted, router]);

  const handleNext = useCallback(() => {
    if (activeIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }
  }, [activeIndex]);

  const handleGetStarted = useCallback(async () => {
    await markOnboardingCompleted();
    router.replace("/login");
  }, [markOnboardingCompleted, router]);

  const handleRegister = useCallback(async () => {
    await markOnboardingCompleted();
    router.push("/register");
  }, [markOnboardingCompleted, router]);

  const handleDoctorLogin = useCallback(async () => {
    await markOnboardingCompleted();
    router.push("/doctor-login" as never);
  }, [markOnboardingCompleted, router]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / screenWidth);
      if (index >= 0 && index < ONBOARDING_SLIDES.length) {
        setActiveIndex(index);
      }
    },
    [screenWidth],
  );

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  const renderSlide: ListRenderItem<OnboardingSlide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: screenWidth }]}>
        <View style={[styles.slideInner, { width: slideWidth }]}>
          {/* Healthcare Hero Visual Badge */}
          <View style={styles.heroVisualContainer}>
            {/* Outer soft ambient halo */}
            <View
              style={[
                styles.heroHaloOuter,
                { backgroundColor: `${item.accent}0D` },
              ]}
            />
            {/* Middle concentric ring */}
            <View
              style={[
                styles.heroRingMiddle,
                { borderColor: `${item.accent}24` },
              ]}
            />

            {/* Central Icon Emblem Squircle */}
            <View
              style={[styles.heroIconBox, { backgroundColor: item.accent }]}
            >
              <Ionicons
                name={item.primaryIcon}
                size={44}
                color={Palette.white}
              />

              {/* Floating secondary badge */}
              <View style={styles.secondaryFloatingBadge}>
                <Ionicons
                  name={item.secondaryIcon}
                  size={16}
                  color={item.accent}
                />
              </View>
            </View>

            {/* Verified Stat Pill */}
            <View style={styles.statPill}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={Palette.primaryDark}
              />
              <Text style={styles.statText}>{item.statText}</Text>
              <Text style={styles.statSeparator}>•</Text>
              <Text style={styles.statLabel}>{item.statLabel}</Text>
            </View>
          </View>

          {/* Slide Text Content */}
          <View style={styles.textContainer}>
            {/* Category Tag */}
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: `${item.accent}14` },
              ]}
            >
              <Ionicons name={item.badgeIcon} size={13} color={item.accent} />
              <Text style={[styles.categoryBadgeText, { color: item.accent }]}>
                {item.badge}
              </Text>
            </View>

            {/* Main Headline */}
            <Text style={styles.slideTitle}>{item.title}</Text>

            {/* Description Subtitle */}
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </View>
    ),
    [screenWidth, slideWidth],
  );

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* Soft ambient background decoration */}
      <View pointerEvents="none" style={styles.backgroundDecor}>
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />
        <View style={styles.crossDecorTop}>
          <View style={styles.crossV} />
          <View style={styles.crossH} />
        </View>
      </View>

      {/* Top Header Bar */}
      <View style={styles.header}>
        <HealPointLogo size={36} layout="horizontal" showWordmark={true} />

        {!isLastSlide ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
            hitSlop={8}
          >
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Palette.textMuted}
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login directly"
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
            hitSlop={8}
          >
            <Text style={styles.skipText}>Sign In</Text>
            <Ionicons name="log-in-outline" size={14} color={Palette.primary} />
          </Pressable>
        )}
      </View>

      {/* Swipeable Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          bounces={false}
          scrollEventThrottle={16}
        />
      </View>

      {/* Bottom Controls & Navigation */}
      <View style={[styles.bottomContainer, { maxWidth: slideWidth }]}>
        {/* Pagination Dots */}
        <View style={styles.paginationRow}>
          {ONBOARDING_SLIDES.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <Pressable
                key={slide.id}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({
                    index: idx,
                    animated: true,
                  });
                  setActiveIndex(idx);
                }}
                hitSlop={8}
                style={[
                  styles.dot,
                  isActive ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGroup}>
          {!isLastSlide ? (
            <Button title="Next" onPress={handleNext} icon="arrow-forward" />
          ) : (
            <>
              <Button
                title="Get Started"
                onPress={handleGetStarted}
                icon="arrow-forward"
              />
              <Button
                title="Create an account"
                variant="outline"
                onPress={handleRegister}
                icon="person-add-outline"
              />
            </>
          )}

          {/* Doctor Portal Secondary Link */}
          <Pressable
            accessibilityRole="button"
            onPress={handleDoctorLogin}
            style={({ pressed }) => [
              styles.doctorLink,
              pressed && styles.doctorLinkPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="medkit" size={15} color={Palette.primaryDark} />
            <Text style={styles.doctorLinkText}>
              Are you a Doctor? Sign in to Doctor Portal
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFB",
  },
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  glowTopRight: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -100,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(42, 105, 172, 0.06)",
  },
  crossDecorTop: {
    position: "absolute",
    top: 70,
    left: 24,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.12,
  },
  crossV: {
    position: "absolute",
    width: 6,
    height: 26,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  crossH: {
    position: "absolute",
    width: 26,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === "android" ? Spacing.md : Spacing.sm,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  skipButtonPressed: {
    opacity: 0.7,
  },
  skipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: "center",
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  slideInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
  },
  heroVisualContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxl,
    position: "relative",
  },
  heroHaloOuter: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  heroRingMiddle: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  heroIconBox: {
    width: 108,
    height: 108,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
    position: "relative",
  },
  secondaryFloatingBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  statPill: {
    position: "absolute",
    bottom: -16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
  },
  statText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    fontSize: 12,
  },
  statSeparator: {
    color: Palette.textMuted,
    fontSize: 10,
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  textContainer: {
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  categoryBadgeText: {
    ...Typography.caption,
    fontWeight: "800",
    letterSpacing: 0.8,
    fontSize: 11,
  },
  slideTitle: {
    ...Typography.h1,
    color: Palette.text,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    fontSize: 26,
    lineHeight: 32,
  },
  slideSubtitle: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
  },
  bottomContainer: {
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === "android" ? Spacing.lg : Spacing.md,
    gap: Spacing.lg,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: Radius.pill,
  },
  activeDot: {
    width: 26,
    backgroundColor: Palette.primary,
  },
  inactiveDot: {
    width: 7,
    backgroundColor: "rgba(148, 163, 184, 0.3)",
  },
  actionGroup: {
    gap: Spacing.sm,
    width: "100%",
  },
  doctorLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: "center",
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.18)",
  },
  doctorLinkPressed: {
    opacity: 0.7,
  },
  doctorLinkText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
});
