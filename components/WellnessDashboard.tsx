/**
 * HealPoint - WellnessDashboard.
 *
 * A premium, animated "Care Score" dashboard for the patient home screen.
 * Built entirely with `react-native` Views + `react-native-reanimated` (no SVG
 * dependency) so it is reliable on Android, iOS and web.
 *
 * - Pulsing concentric rings behind the score (infinite Reanimated loop).
 * - A count-up score rendered with <AnimatedNumber/>.
 * - Animated progress bars that spring to their target on mount.
 * - Staggered card entrance animations.
 *
 * All numbers are passed in by the caller (real backend data) — this component
 * never fabricates health data.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export interface WellnessMetric {
  key: string;
  label: string;
  value: number;
  /** Optional cap used to render the progress bar (defaults to `value`). */
  total?: number;
  icon: IconName;
  color: string;
}

interface WellnessDashboardProps {
  /** 0 - 100 engagement score derived from real data by the caller. */
  score: number;
  scoreLabel?: string;
  scoreCaption?: string;
  metrics: WellnessMetric[];
  style?: ViewStyle;
}

const RING_DURATION = 3000;
const RING_SIZE = 210;

/** One infinite-pulse ring layer behind the score. */
function PulseRing({ color, delayMs }: { color: string; delayMs: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: RING_DURATION }),
          withTiming(0, { duration: RING_DURATION }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    opacity: 0.55 - pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulseRing, { borderColor: color, borderWidth: 2 }, animatedStyle]}
    />
  );
}

/** Animated horizontal progress bar that springs from 0 to `progress`. */
function AnimatedBar({ color, progress }: { color: string; progress: number }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(Math.max(0, Math.min(1, progress)), {
      damping: 20,
      stiffness: 90,
      mass: 0.8,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scale.value }],
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, barStyle]} />
    </View>
  );
}

export function WellnessDashboard({
  score,
  scoreLabel = 'Care Score',
  scoreCaption = 'Based on your recent activity with HealPoint',
  metrics,
  style,
}: WellnessDashboardProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const scoreColor =
    clampedScore >= 75 ? Palette.success : clampedScore >= 45 ? Palette.warning : Palette.error;

  return (
    <View style={[styles.wrap, style]}>
      {/* Hero score card */}
      <Animated.View entering={FadeInDown.delay(60).springify().damping(16)} style={styles.heroCard}>
        <PulseRing color={Palette.primary} delayMs={0} />
        <PulseRing color={Palette.accent} delayMs={900} />
        <PulseRing color={Palette.gold} delayMs={1800} />

        <View style={styles.heroRow}>
          <View style={styles.scoreBadge}>
            <AnimatedNumber
              value={clampedScore}
              duration={1400}
              style={[styles.scoreValue, { color: scoreColor }]}
            />
            <Text style={styles.scoreMax}>/ 100</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{scoreLabel}</Text>
            <Text style={styles.heroCaption}>{scoreCaption}</Text>
            <View style={[styles.heroDot, { backgroundColor: scoreColor }]} />
          </View>
        </View>
      </Animated.View>

      {/* Metric cards */}
      {metrics.map((metric, index) => {
        const total = metric.total && metric.total > 0 ? metric.total : metric.value;
        const progress = total > 0 ? metric.value / total : 0;
        return (
          <Animated.View
            key={metric.key}
            entering={FadeInDown.delay(140 + index * 90).springify().damping(18)}
            style={styles.metricCard}
          >
            <View style={styles.metricTopRow}>
              <View style={[styles.metricIcon, { backgroundColor: `${metric.color}1A` }]}>
                <Ionicons name={metric.icon} size={18} color={metric.color} />
              </View>
              <Text style={styles.metricLabel} numberOfLines={1}>
                {metric.label}
              </Text>
              <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
            </View>
            <AnimatedBar color={metric.color} progress={progress} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.md,
  },
  heroCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    ...(Shadows.card as object),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 190,
    padding: Spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -RING_SIZE / 2,
    marginLeft: -RING_SIZE / 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    ...Typography.h1,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '800',
    letterSpacing: -2,
  },
  scoreMax: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginLeft: Spacing.xs,
  },
  heroText: {
    flex: 1,
    gap: Spacing.xs,
  },
  heroTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  heroCaption: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  heroDot: {
    width: 28,
    height: 5,
    borderRadius: 3,
    marginTop: Spacing.xs,
  },
  metricCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...(Shadows.card as object),
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
  },
  metricValue: {
    ...Typography.h4,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primaryLight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transformOrigin: 'left',
  },
});
