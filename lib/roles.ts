/**
 * HealPoint - role resolution helpers.
 *
 * The backend is the source of truth for a user's role. These helpers only
 * *interpret* the role returned by the server (never set it) and map it to a
 * canonical value + the right home route. Legacy display strings from previous
 * versions are normalised here so old accounts keep working.
 */

import type { Href } from 'expo-router';

export type CanonicalRole = 'patient' | 'doctor' | 'admin' | 'super_admin';

/**
 * Home (protected) routes must match expo-router's typed routes exactly.
 *
 * NOTE: a route group that contains only an `index.tsx` is addressed by its
 * group prefix (e.g. `/(doctor)`), NOT by `/(doctor)/index`. The `index.tsx`
 * file name is dropped when the URL is resolved, so `/(doctor)/index` would
 * collapse to `/` — the same screen as the root `app/index.tsx` auth router,
 * which would create an infinite redirect loop. Always use the group-prefixed
 * form.
 */
export type HomeRoute = '/(drawer)' | '/(doctor)' | '/(admin)' | '/(super-admin)';

/** Normalise any role value (or legacy display string) to a canonical role. */
export function canonicalRole(role?: string): CanonicalRole {
  const r = (role || '').trim().toLowerCase();
  if (r === 'doctor') return 'doctor';
  if (r === 'admin' || r === 'administrator' || r === 'hospital admin') return 'admin';
  if (r === 'super_admin' || r === 'super admin') return 'super_admin';
  return 'patient';
}

/**
 * The initial (protected) route for a given role. Unknown/missing → patient.
 *
 * The patient home is the anchored `(drawer)` group. Some typed-route
 * generators collapse an anchored group's prefix to `/`, so the value is cast
 * to keep the redirect working under every generator while remaining fully
 * navigable at runtime.
 */
export function homeRouteForRole(role?: string): Href {
  const r = canonicalRole(role);
  if (r === 'doctor') return '/(doctor)';
  if (r === 'admin') return '/(admin)';
  if (r === 'super_admin') return '/(super-admin)';
  return '/(drawer)' as unknown as Href;
}
