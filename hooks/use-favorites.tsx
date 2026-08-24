/**
 * HealPoint - favorites store.
 *
 * Backed by the real `/user/favorites` endpoints. The set of favorite doctor
 * ids is loaded once per login and updated optimistically on toggle, rolling
 * back to the server state if the API call fails. No frontend-only system.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import * as authService from '@/services/auth';

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (doctorId: string) => boolean;
  toggleFavorite: (doctorId: string) => Promise<void>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const res = await authService.getFavorites();
      setFavoriteIds(new Set((res.favorites || []).map((item) => String(item.doctorId || item._id))));
    } catch {
      // Keep the previous set on failure; toggles still re-validate server-side.
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = useCallback((doctorId: string) => favoriteIds.has(String(doctorId)), [favoriteIds]);

  const toggleFavorite = useCallback(
    async (doctorId: string) => {
      const id = String(doctorId);
      const wasFavorite = favoriteIds.has(id);

      // Optimistic update.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        if (wasFavorite) {
          await authService.removeFavorite(id);
        } else {
          await authService.addFavorite(id);
        }
      } catch {
        // Roll back to the server truth.
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [favoriteIds],
  );

  const value = useMemo(
    () => ({ favoriteIds, isFavorite, toggleFavorite, isLoading, refresh }),
    [favoriteIds, isFavorite, toggleFavorite, isLoading, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used inside a <FavoritesProvider>');
  }
  return context;
}