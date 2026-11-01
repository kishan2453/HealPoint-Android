/**
 * HealPoint - favorites store.
 *
 * Backed by real `/user/favorites` and `/user/favorites/hospitals` endpoints.
 * Both doctor and hospital favorite IDs and enriched lists are synchronized
 * with backend MongoDB persistence, cached locally for instant rendering on reload,
 * and updated optimistically on toggle with automatic rollback on error.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import {
  deleteStorageItemSync,
  getStorageItemSync,
  setStorageItemSync,
} from "@/lib/storage";
import * as authService from "@/services/auth";
import type { Doctor, Hospital } from "@/types";

export type SavedDoctorItem = Doctor & { addedAt?: string; doctorId?: string };
export type SavedHospitalItem = Hospital & {
  addedAt?: string;
  hospitalId?: string;
};

const STORAGE_KEY_DOCS = "healpoint.favorites.doctors";
const STORAGE_KEY_HOSPS = "healpoint.favorites.hospitals";

function loadCachedDoctors(): SavedDoctorItem[] {
  try {
    const raw = getStorageItemSync(STORAGE_KEY_DOCS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCachedHospitals(): SavedHospitalItem[] {
  try {
    const raw = getStorageItemSync(STORAGE_KEY_HOSPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  favoriteHospitalIds: Set<string>;
  isFavorite: (doctorId: string) => boolean;
  isFavoriteHospital: (hospitalId: string) => boolean;
  toggleFavorite: (doctorId: string) => Promise<void>;
  toggleFavoriteHospital: (hospitalId: string) => Promise<void>;
  savedDoctors: SavedDoctorItem[];
  savedHospitals: SavedHospitalItem[];
  doctorCount: number;
  hospitalCount: number;
  totalCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined,
);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Initialize immediately from synchronous storage to eliminate any render flicker
  const initialDocs = useMemo(() => loadCachedDoctors(), []);
  const initialHosps = useMemo(() => loadCachedHospitals(), []);

  const [savedDoctors, setSavedDoctors] = useState<SavedDoctorItem[]>(initialDocs);
  const [savedHospitals, setSavedHospitals] = useState<SavedHospitalItem[]>(initialHosps);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(initialDocs.map((item) => String(item._id || item.doctorId))),
  );
  const [favoriteHospitalIds, setFavoriteHospitalIds] = useState<Set<string>>(
    () => new Set(initialHosps.map((item) => String(item._id || item.hospitalId))),
  );

  const [isLoading, setIsLoading] = useState(false);
  const isRefreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    // If auth state is still initializing, don't clear anything!
    if (authLoading) return;

    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      setFavoriteHospitalIds(new Set());
      setSavedDoctors([]);
      setSavedHospitals([]);
      deleteStorageItemSync(STORAGE_KEY_DOCS);
      deleteStorageItemSync(STORAGE_KEY_HOSPS);
      return;
    }

    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsLoading(true);

    try {
      const [docRes, hospRes] = await Promise.allSettled([
        authService.getFavorites(),
        authService.getFavoriteHospitals(),
      ]);

      if (docRes.status === "fulfilled" && docRes.value?.success) {
        const docs = docRes.value.favorites || [];
        setSavedDoctors(docs);
        setFavoriteIds(
          new Set(docs.map((item) => String(item._id || item.doctorId))),
        );
        setStorageItemSync(STORAGE_KEY_DOCS, JSON.stringify(docs));
      }

      if (hospRes.status === "fulfilled" && hospRes.value?.success) {
        const hosps = hospRes.value.favorites || [];
        setSavedHospitals(hosps);
        setFavoriteHospitalIds(
          new Set(hosps.map((item) => String(item._id || item.hospitalId))),
        );
        setStorageItemSync(STORAGE_KEY_HOSPS, JSON.stringify(hosps));
      }
    } catch (err) {
      console.warn("[useFavorites] refresh error:", err);
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      refresh();
    }
  }, [refresh, authLoading, isAuthenticated]);

  const isFavorite = useCallback(
    (doctorId: string) => Boolean(doctorId && favoriteIds.has(String(doctorId))),
    [favoriteIds],
  );

  const isFavoriteHospital = useCallback(
    (hospitalId: string) =>
      Boolean(hospitalId && favoriteHospitalIds.has(String(hospitalId))),
    [favoriteHospitalIds],
  );

  const toggleFavorite = useCallback(
    async (doctorId: string) => {
      if (!doctorId) return;
      const id = String(doctorId);
      const wasFavorite = favoriteIds.has(id);

      // Optimistic update
      const nextFavoriteIds = new Set(favoriteIds);
      let nextSavedDoctors = [...savedDoctors];

      if (wasFavorite) {
        nextFavoriteIds.delete(id);
        nextSavedDoctors = nextSavedDoctors.filter(
          (d) => String(d._id) !== id && String(d.doctorId) !== id,
        );
      } else {
        nextFavoriteIds.add(id);
      }

      setFavoriteIds(nextFavoriteIds);
      setSavedDoctors(nextSavedDoctors);
      setStorageItemSync(STORAGE_KEY_DOCS, JSON.stringify(nextSavedDoctors));

      try {
        if (wasFavorite) {
          await authService.removeFavorite(id);
        } else {
          await authService.addFavorite(id);
          // Re-fetch to enrich with complete doctor document from server
          authService
            .getFavorites()
            .then((res) => {
              if (res.success && Array.isArray(res.favorites)) {
                setSavedDoctors(res.favorites);
                setFavoriteIds(
                  new Set(
                    res.favorites.map((item) =>
                      String(item._id || item.doctorId),
                    ),
                  ),
                );
                setStorageItemSync(STORAGE_KEY_DOCS, JSON.stringify(res.favorites));
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("[useFavorites] toggleFavorite failed:", err);
        // Roll back to previous state
        setFavoriteIds(favoriteIds);
        setSavedDoctors(savedDoctors);
        setStorageItemSync(STORAGE_KEY_DOCS, JSON.stringify(savedDoctors));
        refresh();
      }
    },
    [favoriteIds, savedDoctors, refresh],
  );

  const toggleFavoriteHospital = useCallback(
    async (hospitalId: string) => {
      if (!hospitalId) return;
      const id = String(hospitalId);
      const wasFavorite = favoriteHospitalIds.has(id);

      // Optimistic update
      const nextHospitalIds = new Set(favoriteHospitalIds);
      let nextSavedHospitals = [...savedHospitals];

      if (wasFavorite) {
        nextHospitalIds.delete(id);
        nextSavedHospitals = nextSavedHospitals.filter(
          (h) => String(h._id) !== id && String(h.hospitalId) !== id,
        );
      } else {
        nextHospitalIds.add(id);
      }

      setFavoriteHospitalIds(nextHospitalIds);
      setSavedHospitals(nextSavedHospitals);
      setStorageItemSync(STORAGE_KEY_HOSPS, JSON.stringify(nextSavedHospitals));

      try {
        if (wasFavorite) {
          await authService.removeFavoriteHospital(id);
        } else {
          await authService.addFavoriteHospital(id);
          authService
            .getFavoriteHospitals()
            .then((res) => {
              if (res.success && Array.isArray(res.favorites)) {
                setSavedHospitals(res.favorites);
                setFavoriteHospitalIds(
                  new Set(
                    res.favorites.map((item) =>
                      String(item._id || item.hospitalId),
                    ),
                  ),
                );
                setStorageItemSync(STORAGE_KEY_HOSPS, JSON.stringify(res.favorites));
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("[useFavorites] toggleFavoriteHospital failed:", err);
        // Roll back
        setFavoriteHospitalIds(favoriteHospitalIds);
        setSavedHospitals(savedHospitals);
        setStorageItemSync(STORAGE_KEY_HOSPS, JSON.stringify(savedHospitals));
        refresh();
      }
    },
    [favoriteHospitalIds, savedHospitals, refresh],
  );

  const value = useMemo(
    () => ({
      favoriteIds,
      favoriteHospitalIds,
      isFavorite,
      isFavoriteHospital,
      toggleFavorite,
      toggleFavoriteHospital,
      savedDoctors,
      savedHospitals,
      doctorCount: favoriteIds.size,
      hospitalCount: favoriteHospitalIds.size,
      totalCount: favoriteIds.size + favoriteHospitalIds.size,
      isLoading,
      refresh,
    }),
    [
      favoriteIds,
      favoriteHospitalIds,
      isFavorite,
      isFavoriteHospital,
      toggleFavorite,
      toggleFavoriteHospital,
      savedDoctors,
      savedHospitals,
      isLoading,
      refresh,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used inside a <FavoritesProvider>");
  }
  return context;
}
