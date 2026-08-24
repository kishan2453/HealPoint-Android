/**
 * HealPoint - doctor search domain logic.
 *
 * Everything here is backed by the real `/doctor/get-all` contract (see
 * `controllers/doctorController.js` on the backend). Only query params the
 * backend actually supports are emitted — we never invent a filter.
 *
 * The backend does NOT support server-side pagination or a custom sort order,
 * so:
 *  - results are fetched with a high `limit` and the UI shows an honest
 *    "showing X of Y" note when more exist (no fake pagination);
 *  - "sorting" re-orders the REAL returned data on the client. "Recommended"
 *    keeps the server's default order (available → rating → review count).
 */
import { doctorSpecialty } from '@/lib/doctor';
import type { Doctor, GetAllDoctorsParams } from '@/types';

// ---------------------------------------------------------------------------
// Search state
// ---------------------------------------------------------------------------

export interface DoctorSearchFilters {
  speciality?: string;
  location?: string;
  gender?: string;
  minExperience?: number;
  minRating?: number;
  minFee?: number;
  maxFee?: number;
  availabilityOnly?: boolean;
  consultationType?: 'clinic' | 'video';
}

export type DoctorSort = 'recommended' | 'rating' | 'experience' | 'fee';

export const SORT_OPTIONS: { key: DoctorSort; label: string; caption: string }[] = [
  { key: 'recommended', label: 'Recommended', caption: "HealPoint's default order" },
  { key: 'rating', label: 'Highest Rated', caption: 'Best patient reviews first' },
  { key: 'experience', label: 'Most Experienced', caption: 'Most years of practice first' },
  { key: 'fee', label: 'Lowest Fee', caption: 'Most affordable first' },
];

export function sortLabel(sort: DoctorSort): string {
  return SORT_OPTIONS.find((option) => option.key === sort)?.label || 'Recommended';
}

// ---------------------------------------------------------------------------
// Filter options derived from real catalog data
// ---------------------------------------------------------------------------

export interface DoctorFilterOptions {
  specialities: string[];
  locations: string[];
  genders: string[];
}

const OPTION_LIMIT = 12;

/**
 * Derive selectable filter options from real catalog data only. Location
 * options come from exactly the fields the backend `location` filter searches
 * (doctor.address / clinicInfo.address) so every option yields real results.
 */
export function deriveDoctorFilterOptions(doctors: Doctor[]): DoctorFilterOptions {
  const specialityCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const genders = new Set<string>();

  doctors.forEach((doctor) => {
    const speciality = doctorSpecialty(doctor);
    specialityCounts.set(speciality, (specialityCounts.get(speciality) || 0) + 1);

    [doctor.address, doctor.clinicInfo?.address].forEach((address) => {
      cityCandidates(address).forEach((candidate) => {
        locationCounts.set(candidate, (locationCounts.get(candidate) || 0) + 1);
      });
    });

    const gender = doctor.gender?.trim();
    if (gender) genders.add(gender);
  });

  const byFrequency = (counts: Map<string, number>) =>
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value);

  return {
    specialities: byFrequency(specialityCounts),
    locations: byFrequency(locationCounts).slice(0, OPTION_LIMIT),
    genders: Array.from(genders).sort(),
  };
}

/** Extract short city-like candidates from a stored address string. */
function cityCandidates(address?: string): string[] {
  const value = address?.trim();
  if (!value || value.length < 3) return [];
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];

  const looksLikePlace = (part: string) => /^[A-Za-z][A-Za-z .'-]{1,39}$/.test(part);
  const candidates = new Set<string>();
  const last = parts[parts.length - 1];
  if (looksLikePlace(last)) candidates.add(last);
  const previous = parts[parts.length - 2];
  if (previous && looksLikePlace(previous) && previous !== last) candidates.add(previous);
  return Array.from(candidates);
}

// ---------------------------------------------------------------------------
// Query builder (maps UI state to the REAL backend params)
// ---------------------------------------------------------------------------

export function buildDoctorSearchParams(input: {
  query: string;
  hospitalId?: string;
  filters: DoctorSearchFilters;
  limit?: number;
}): GetAllDoctorsParams {
  const { query, hospitalId, filters, limit = 200 } = input;
  const params: GetAllDoctorsParams = { limit };

  const keyword = query.trim();
  if (keyword) params.search = keyword;
  if (hospitalId) params.hospitalId = hospitalId;
  if (filters.speciality) params.speciality = filters.speciality;
  if (filters.location) params.location = filters.location;
  if (filters.gender) params.gender = filters.gender;
  if (filters.minExperience) params.minExperience = filters.minExperience;
  if (filters.minRating) params.minRating = filters.minRating;
  if (filters.minFee !== undefined) params.minFee = filters.minFee;
  if (filters.maxFee !== undefined) params.maxFee = filters.maxFee;
  if (filters.availabilityOnly) params.availability = true;
  if (filters.consultationType === 'video') params.onlineConsultation = true;
  if (filters.consultationType === 'clinic') params.offlineConsultation = true;

  return params;
}

// ---------------------------------------------------------------------------
// Sorting (client-side over the real returned data; server has no sort param)
// ---------------------------------------------------------------------------

export function sortDoctors(doctors: Doctor[], sort: DoctorSort): Doctor[] {
  const list = [...doctors];
  switch (sort) {
    case 'rating':
      return list.sort(
        (a, b) =>
          (Number(b.rating) || 0) - (Number(a.rating) || 0) ||
          (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0),
      );
    case 'experience':
      return list.sort((a, b) => (Number(b.experience) || 0) - (Number(a.experience) || 0));
    case 'fee':
      return list.sort((a, b) => (Number(a.fees) || 0) - (Number(b.fees) || 0));
    default:
      // "Recommended" = the server's default order (available → rating → count).
      return list;
  }
}

// ---------------------------------------------------------------------------
// Active filter summaries
// ---------------------------------------------------------------------------

export function countActiveFilters(filters: DoctorSearchFilters, hospitalId?: string): number {
  let count = 0;
  if (filters.speciality) count += 1;
  if (filters.location) count += 1;
  if (filters.gender) count += 1;
  if (filters.minExperience) count += 1;
  if (filters.minRating) count += 1;
  if (filters.minFee !== undefined || filters.maxFee !== undefined) count += 1;
  if (filters.availabilityOnly) count += 1;
  if (filters.consultationType) count += 1;
  if (hospitalId) count += 1;
  return count;
}

export function describeActiveFilters(
  filters: DoctorSearchFilters,
  hospitalName?: string,
): { key: string; label: string }[] {
  const items: { key: string; label: string }[] = [];
  if (filters.speciality) items.push({ key: 'speciality', label: filters.speciality });
  if (filters.location) items.push({ key: 'location', label: filters.location });
  if (filters.gender) items.push({ key: 'gender', label: filters.gender });
  if (filters.minExperience) items.push({ key: 'minExperience', label: `${filters.minExperience}+ yrs` });
  if (filters.minRating) items.push({ key: 'minRating', label: `Rating ${filters.minRating}+` });
  if (filters.minFee !== undefined || filters.maxFee !== undefined) {
    if (filters.minFee === undefined) items.push({ key: 'fee', label: `Under ₹${filters.maxFee}` });
    else if (filters.maxFee === undefined) items.push({ key: 'fee', label: `Above ₹${filters.minFee}` });
    else items.push({ key: 'fee', label: `₹${filters.minFee} – ₹${filters.maxFee}` });
  }
  if (filters.availabilityOnly) items.push({ key: 'availabilityOnly', label: 'Available now' });
  if (filters.consultationType === 'video') items.push({ key: 'consultationType', label: 'Video consult' });
  if (filters.consultationType === 'clinic') items.push({ key: 'consultationType', label: 'Clinic visit' });
  if (hospitalName) items.push({ key: 'hospital', label: hospitalName });
  return items;
}

// ---------------------------------------------------------------------------
// Static option sets (each maps 1:1 to a supported backend param)
// ---------------------------------------------------------------------------

export const EXPERIENCE_OPTIONS: { label: string; value?: number }[] = [
  { label: 'Any', value: undefined },
  { label: '5+ yrs', value: 5 },
  { label: '10+ yrs', value: 10 },
  { label: '15+ yrs', value: 15 },
  { label: '20+ yrs', value: 20 },
];

export const RATING_OPTIONS: { label: string; value?: number }[] = [
  { label: 'Any', value: undefined },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
];

export const FEE_OPTIONS: { label: string; minFee?: number; maxFee?: number }[] = [
  { label: 'Any', minFee: undefined, maxFee: undefined },
  { label: 'Under ₹500', maxFee: 500 },
  { label: '₹500 – ₹1,000', minFee: 500, maxFee: 1000 },
  { label: '₹1,000 – ₹2,000', minFee: 1000, maxFee: 2000 },
  { label: 'Above ₹2,000', minFee: 2000 },
];

export const CONSULTATION_TYPE_OPTIONS: { label: string; value?: 'clinic' | 'video' }[] = [
  { label: 'Any', value: undefined },
  { label: 'Clinic', value: 'clinic' },
  { label: 'Video', value: 'video' },
];

