/**
 * HealPoint - image resolution helpers.
 *
 * Mirrors the web client's `imageSrc` + doctor portrait fallback so the same
 * stored data (https URLs, raw base64 or relative `/uploads/...` paths from the
 * backend) renders correctly. Relative server paths are resolved against the
 * same backend that serves the API so images never silently become broken
 * base64 strings on Android.
 */
import { API_URL } from '@/lib/env';
import type { Doctor, Hospital } from '@/types';

// Professional medical portrait photos (same pool as the web client).
const PORTRAITS = [
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1551601651-2a8555f1a136?q=95&w=1200&dpr=2',
  'https://images.unsplash.com/photo-1584982751601-97dcc096659c?q=95&w=1200&dpr=2',
];

/**
 * Branded HealPoint hospital placeholder (local asset) used as the loading
 * placeholder and the final fallback whenever a hospital has no usable image
 * or its URL cannot be loaded. Never a broken image icon.
 */
export const HOSPITAL_PLACEHOLDER =
  require('@/assets/images/hospital-placeholder.png') as number | string;

function hashValue(value = ''): number {
  return String(value)
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
}

/** Scheme+host of the backend (e.g. `http://192.168.1.5:8080`). */
export function getApiOrigin(): string {
  const match = /^(https?:\/\/[^/]+)/i.exec(API_URL);
  return match ? match[1] : API_URL;
}

/** True when the string is (reasonably) a raw base64 payload, not a file path. */
function looksLikeBase64(value: string): boolean {
  return /^[A-Za-z0-9+/=]{40,}$/.test(value);
}

/** True when the string looks like a relative file path ending in an image ext. */
function looksLikeRelativePath(value: string): boolean {
  return /^(?:[a-zA-Z0-9_\-./])+\.(?:png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(value);
}

/**
 * Turn a stored image into a renderable source.
 *
 * Supported inputs:
 *  - `https://`, `http://`, `data:`, `blob:` URLs → used as-is.
 *  - `/uploads/x.jpg` or `uploads/x.jpg` → resolved against the backend origin.
 *  - raw base64 strings → wrapped in a `data:` URI.
 */
export function resolveImageSource(image?: string, fallback = ''): string {
  if (!image) return fallback;
  const trimmed = String(image).trim();
  if (!trimmed) return fallback;

  // Absolute URLs / data URIs are already renderable.
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    // Unsplash needs explicit sizing params or it can return tiny images.
    if (/^https:\/\/images\.unsplash\.com\//i.test(trimmed)) {
      const separator = trimmed.includes('?') ? '&' : '?';
      return /[?&]q=/i.test(trimmed)
        ? trimmed
        : `${trimmed}${separator}q=95&w=1800&dpr=2`;
    }
    return trimmed;
  }

  // Raw base64 payload (PNG `iVBOR...`, JPEG `/9j/...`, GIF `R0lG...`). Check
  // BEFORE server-relative paths because base64 JPEGs start with `/`.
  if (looksLikeBase64(trimmed)) {
    const mime = trimmed.startsWith('iVBOR')
      ? 'image/png'
      : trimmed.startsWith('R0lG')
        ? 'image/gif'
        : 'image/jpeg';
    return `data:${mime};base64,${trimmed}`;
  }

  // Server-relative image paths (the backend serves uploads on the same host).
  if (trimmed.startsWith('/')) {
    return `${getApiOrigin()}${trimmed}`;
  }
  if (looksLikeRelativePath(trimmed)) {
    return `${getApiOrigin()}/${trimmed}`;
  }

  // Anything else is treated as base64 to stay compatible with legacy data,
  // but clearly-invalid short strings degrade to the fallback.
  if (trimmed.length >= 20) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return fallback;
}

/** Best doctor photo: stored HD/profile image, else a stable portrait fallback. */
export function getDoctorImage(doctor?: Doctor | { _id: string; name?: string; email?: string; image?: string; hdProfilePicture?: string }, index?: number): string {
  const source = doctor?.hdProfilePicture || doctor?.image;
  if (source) {
    return resolveImageSource(source);
  }
  const seed =
    typeof index === 'number'
      ? index
      : hashValue(doctor?._id || doctor?.email || doctor?.name);
  return PORTRAITS[seed % PORTRAITS.length];
}

/**
 * Best hospital/building image from a single stored value.
 * Returns '' when nothing usable exists — callers should use the branded
 * placeholder in that case (see `resolveHospitalImage` / `HospitalImage`).
 */
export function getHospitalImage(image?: string, fallback = ''): string {
  return resolveImageSource(image, fallback);
}

/**
 * Best hospital image across every image field the backend stores
 * (`coverImage` → `logo` → first `hospitalImages` → first `gallery` →
 * first composed `galleryImages`). Every hospital keeps its own image — no
 * shared/random picture.
 */
export function resolveHospitalImage(hospital?: Partial<Hospital> | null): string {
  if (!hospital) return '';
  const candidates = [
    hospital.coverImage,
    hospital.logo,
    hospital.hospitalImages?.[0],
    hospital.gallery?.[0],
    hospital.galleryImages?.[0]?.src,
  ];
  const first = candidates.find((item) => item && String(item).trim().length > 0);
  return getHospitalImage(first);
}

/** Patient profile photo (base64 or https stored on the user document). */
export function getUserImage(image?: string): string {
  return resolveImageSource(image);
}

// ---------------------------------------------------------------------------
// Subscription plan artwork
// ---------------------------------------------------------------------------

/**
 * Healthcare-themed plan artwork pool (original HealPoint branding, no stock
 * watermarks). Keyed by the plan key so every plan keeps a consistent,
 * medical-themed visual. A plan's own stored `imageUrl` always wins.
 */
const PLAN_ART: Record<string, string> = {
  free: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=90&w=1600&dpr=2',
  basic: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=90&w=1600&dpr=2',
  professional: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?q=90&w=1600&dpr=2',
  premium: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?q=90&w=1600&dpr=2',
  enterprise: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?q=90&w=1600&dpr=2',
};

const GENERAL_PLAN_ART =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=90&w=1600&dpr=2';

/**
 * Best plan picture for a subscription plan:
 *  - the plan's own stored `imageUrl` when present (resolved exactly like every
 *    other stored HealPoint image), else
 *  - a stable healthcare-themed illustration matched to the plan key, else
 *  - the general medical banner.
 */
export function getPlanImage(plan?: {
  key?: string;
  imageUrl?: string;
}): string {
  if (plan?.imageUrl && String(plan.imageUrl).trim()) {
    return resolveImageSource(plan.imageUrl, GENERAL_PLAN_ART);
  }
  const key = String(plan?.key || '').trim().toLowerCase();
  return PLAN_ART[key] || GENERAL_PLAN_ART;
}