/**
 * HealPoint - favorites store.
 *
 * Backed by real `/user/favorites` and `/user/favorites/hospitals` endpoints.
 * Both doctor and hospital favorite IDs and enriched lists are synchronized
 * with backend persistence and updated optimistically on toggle with automatic rollback.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import * as authService from "@/services/auth";
import type { Doctor, Hospital } from "@/types";

export type SavedDoctorItem = Doctor & { addedAt?: string; doctorId?: string };
export type SavedHospitalItem = Hospital & {
  addedAt?: string;
  hospitalId?: string;
};

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  favoriteHospitalIds: Set<string>;
  isFavorite: (doctorId: string) => boolean;
  isFavoriteHospital: (hospitalId: string) => boolean;
  toggleFavorite: (doctorId: string) => Promise<void>;
  toggleFavoriteHospital: (hospitalId: string) => Promise<void>;
  savedDoctors: SavedDoctorItem[];
  savedHospitals: SavedHospitalItem[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(
  undefined,
);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteHospitalIds, setFavoriteHospitalIds] = useState<Set<string>>(
    new Set(),
  );
  const [savedDoctors, setSavedDoctors] = useState<SavedDoctorItem[]>([]);
  const [savedHospitals, setSavedHospitals] = useState<SavedHospitalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      setFavoriteHospitalIds(new Set());
      setSavedDoctors([]);
      setSavedHospitals([]);
      return;
    }
    setIsLoading(true);
    try {
      const [docRes, hospRes] = await Promise.allSettled([
        authService.getFavorites(),
        authService.getFavoriteHospitals(),
      ]);

      if (docRes.status === "fulfilled") {
        const docs = docRes.value.favorites || [];
        setSavedDoctors(docs);
        setFavoriteIds(
          new Set(docs.map((item) => String(item._id || item.doctorId))),
        );
      }

      if (hospRes.status === "fulfilled") {
        const hosps = hospRes.value.favorites || [];
        setSavedHospitals(hosps);
        setFavoriteHospitalIds(
          new Set(hosps.map((item) => String(item._id || item.hospitalId))),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (doctorId: string) => favoriteIds.has(String(doctorId)),
    [favoriteIds],
  );

  const isFavoriteHospital = useCallback(
    (hospitalId: string) => favoriteHospitalIds.has(String(hospitalId)),
    [favoriteHospitalIds],
  );

  const toggleFavorite = useCallback(
    async (doctorId: string) => {
      const id = String(doctorId);
      const wasFavorite = favoriteIds.has(id);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });

      if (wasFavorite) {
        setSavedDoctors((prev) =>
          prev.filter((d) => String(d._id) !== id && String(d.doctorId) !== id),
        );
      }

      try {
        if (wasFavorite) {
          await authService.removeFavorite(id);
        } else {
          await authService.addFavorite(id);
          // Re-fetch to get enriched doctor data in savedDoctors
          authService
            .getFavorites()
            .then((res) => {
              if (res.favorites) {
                setSavedDoctors(res.favorites);
                setFavoriteIds(
                  new Set(
                    res.favorites.map((item) =>
                      String(item._id || item.doctorId),
                    ),
                  ),
                );
              }
            })
            .catch(() => {});
        }
      } catch {
        // Roll back to server truth
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(id);
          else next.delete(id);
          return next;
        });
        refresh();
      }
    },
    [favoriteIds, refresh],
  );

  const toggleFavoriteHospital = useCallback(
    async (hospitalId: string) => {
      const id = String(hospitalId);
      const wasFavorite = favoriteHospitalIds.has(id);

      // Optimistic update
      setFavoriteHospitalIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });

      if (wasFavorite) {
        setSavedHospitals((prev) =>
          prev.filter(
            (h) => String(h._id) !== id && String(h.hospitalId) !== id,
          ),
        );
      }

      try {
        if (wasFavorite) {
          await authService.removeFavoriteHospital(id);
        } else {
          await authService.addFavoriteHospital(id);
          // Re-fetch to get enriched hospital data in savedHospitals
          authService
            .getFavoriteHospitals()
            .then((res) => {
              if (res.favorites) {
                setSavedHospitals(res.favorites);
                setFavoriteHospitalIds(
                  new Set(
                    res.favorites.map((item) =>
                      String(item._id || item.hospitalId),
                    ),
                  ),
                );
              }
            })
            .catch(() => {});
        }
      } catch {
        // Roll back to server truth
        setFavoriteHospitalIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(id);
          else next.delete(id);
          return next;
        });
        refresh();
      }
    },
    [favoriteHospitalIds, refresh],
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
