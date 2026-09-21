/**
 * HealPoint - branded splash screen shown while the auth session restores.
 *
 * Subtle, premium healthcare animation: smooth logo entrance, soft pulse ring,
 * and elegant fade-and-rise transition into Login/Home.
 */
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { HealPointLogo } from "@/components/HealPointLogo";
import { Palette, Spacing, Typography } from "@/constants/theme";

export function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const tagAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance animation (scale + fade)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(tagAnim, {
        toValue: 1,
        duration: 500,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Gentle ambient pulse ring (looping softly)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.35,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [fadeAnim, scaleAnim, pulseAnim, pulseOpacity, tagAnim]);

  return (
    <View style={styles.container}>
      {/* Soft ambient background glow */}
      <View pointerEvents="none" style={styles.backdropGlow} />

      {/* Animated logo group */}
      <View style={styles.logoGroup}>
        {/* Ambient pulse ring behind mark */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <HealPointLogo size={88} showWordmark={true} />
        </Animated.View>
      </View>

      {/* Subtle indicator & tagline */}
      <Animated.View style={[styles.bottomGroup, { opacity: tagAnim }]}>
        <ActivityIndicator
          size="small"
          color={Palette.primary}
          style={styles.spinner}
        />
        <Text style={styles.secureText}>Trusted Healthcare Network</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.xl,
  },
  backdropGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(14, 159, 142, 0.07)",
  },
  logoGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: Palette.primary,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomGroup: {
    position: "absolute",
    bottom: 56,
    alignItems: "center",
    gap: Spacing.sm,
  },
  spinner: {
    transform: [{ scale: 0.9 }],
  },
  secureText: {
    ...Typography.caption,
    color: Palette.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "600",
  },
});
