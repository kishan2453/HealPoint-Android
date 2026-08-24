/**
 * HealPoint - robust hospital image component.
 *
 * Fixes the broken hospital photos problem end to end:
 *  - resolves the hospital's own image across every backend field
 *  - supports https URLs, `data:` URIs and server-relative `/uploads/...`
 *    paths (relative paths would otherwise render as broken base64 on Android)
 *  - shows the branded HealPoint hospital placeholder while loading AND when a
 *    URL is missing or fails (never a broken-image icon)
 *  - memory+disk caching, smooth cross-fade and stable recycling keys
 *
 * Every hospital uses its own image; the placeholder is only ever a fallback.
 */
import { Image, type ImageContentFit } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import {
  HOSPITAL_PLACEHOLDER,
  resolveHospitalImage,
  resolveImageSource,
} from '@/lib/image';
import type { Hospital } from '@/types';

interface HospitalImageProps {
  /** Pre-resolved image value (URL / data URI / relative path). Takes priority. */
  source?: string;
  /** Hospital object — the best available image is picked automatically. */
  hospital?: Partial<Hospital> | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
  accessibilityLabel?: string;
}

export function HospitalImage({
  source,
  hospital,
  style,
  contentFit = 'cover',
  transition = 250,
  priority = 'normal',
  accessibilityLabel,
}: HospitalImageProps) {
  const resolved =
    source !== undefined && source !== null
      ? resolveImageSource(source)
      : resolveHospitalImage(hospital);

  // When the URI changes (new hospital / new gallery item) reset the error so
  // the next image gets a fair chance instead of staying on the fallback.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <View style={[styles.wrap, style]} accessible accessibilityLabel={accessibilityLabel}>
      {/* Branded placeholder — always present underneath while loading/on error. */}
      <Image
        source={HOSPITAL_PLACEHOLDER}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      {resolved && !failed ? (
        <Image
          source={{ uri: resolved }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={transition}
          cachePolicy="memory-disk"
          recyclingKey={resolved}
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#0B857B',
  },
});
