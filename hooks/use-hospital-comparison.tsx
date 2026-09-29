/**
 * HealPoint — Smart Hospital Comparison Store & Hook.
 *
 * Manages the client-side comparison tray and active selection state.
 * Allows comparing 2 or 3 active hospitals side-by-side with automatic
 * capacity validation (maximum 3) and reactive UI updates.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";

import type { Hospital } from "@/types";

export const MAX_COMPARE_HOSPITALS = 3;

interface HospitalComparisonContextValue {
  selectedHospitals: Hospital[];
  selectedIds: string[];
  compareCount: number;
  canCompare: boolean;
  isInComparison: (hospitalId?: string) => boolean;
  addHospital: (hospital: Hospital) => boolean;
  removeHospital: (hospitalId: string) => void;
  toggleHospital: (hospital: Hospital) => void;
  clearComparison: () => void;
  setComparisonHospitals: (hospitals: Hospital[]) => void;
}

const HospitalComparisonContext = createContext<
  HospitalComparisonContextValue | undefined
>(undefined);

export function HospitalComparisonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedHospitals, setSelectedHospitals] = useState<Hospital[]>([]);

  const selectedIds = useMemo(
    () => selectedHospitals.map((h) => String(h._id)),
    [selectedHospitals],
  );

  const isInComparison = useCallback(
    (hospitalId?: string): boolean => {
      if (!hospitalId) return false;
      const target = String(hospitalId).trim();
      return selectedHospitals.some(
        (h) => String(h._id) === target || h.slug === target,
      );
    },
    [selectedHospitals],
  );

  const addHospital = useCallback(
    (hospital: Hospital): boolean => {
      if (!hospital || !hospital._id) return false;
      const id = String(hospital._id);

      if (isInComparison(id)) {
        return true;
      }

      if (selectedHospitals.length >= MAX_COMPARE_HOSPITALS) {
        Alert.alert(
          "Comparison Limit Reached",
          `You can compare up to ${MAX_COMPARE_HOSPITALS} hospitals at a time. Remove one from your comparison tray to add "${hospital.name}".`,
          [{ text: "OK" }],
        );
        return false;
      }

      setSelectedHospitals((prev) => [...prev, hospital]);
      return true;
    },
    [selectedHospitals.length, isInComparison],
  );

  const removeHospital = useCallback((hospitalId: string) => {
    const target = String(hospitalId).trim();
    setSelectedHospitals((prev) =>
      prev.filter((h) => String(h._id) !== target && h.slug !== target),
    );
  }, []);

  const toggleHospital = useCallback(
    (hospital: Hospital) => {
      if (!hospital || !hospital._id) return;
      const id = String(hospital._id);
      if (isInComparison(id)) {
        removeHospital(id);
      } else {
        addHospital(hospital);
      }
    },
    [isInComparison, removeHospital, addHospital],
  );

  const clearComparison = useCallback(() => {
    setSelectedHospitals([]);
  }, []);

  const setComparisonHospitals = useCallback((hospitals: Hospital[]) => {
    setSelectedHospitals(hospitals.slice(0, MAX_COMPARE_HOSPITALS));
  }, []);

  const canCompare = selectedHospitals.length >= 2;
  const compareCount = selectedHospitals.length;

  const value = useMemo<HospitalComparisonContextValue>(
    () => ({
      selectedHospitals,
      selectedIds,
      compareCount,
      canCompare,
      isInComparison,
      addHospital,
      removeHospital,
      toggleHospital,
      clearComparison,
      setComparisonHospitals,
    }),
    [
      selectedHospitals,
      selectedIds,
      compareCount,
      canCompare,
      isInComparison,
      addHospital,
      removeHospital,
      toggleHospital,
      clearComparison,
      setComparisonHospitals,
    ],
  );

  return (
    <HospitalComparisonContext.Provider value={value}>
      {children}
    </HospitalComparisonContext.Provider>
  );
}

export function useHospitalComparison(): HospitalComparisonContextValue {
  const ctx = useContext(HospitalComparisonContext);
  if (!ctx) {
    throw new Error(
      "useHospitalComparison must be used within a HospitalComparisonProvider",
    );
  }
  return ctx;
}
