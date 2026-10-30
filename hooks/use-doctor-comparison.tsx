/**
 * HealPoint — Smart Doctor Comparison Store & Hook.
 *
 * Manages the client-side comparison tray and active selection state.
 * Allows patients to compare 2 or 3 active doctors side-by-side with
 * capacity enforcement (maximum 3) and reactive UI updates.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";

import { formatDoctorName } from "@/lib/format";
import type { Doctor } from "@/types";

export const MAX_COMPARE_DOCTORS = 3;

interface DoctorComparisonContextValue {
  selectedDoctors: Doctor[];
  selectedIds: string[];
  compareCount: number;
  canCompare: boolean;
  isInComparison: (doctorId?: string) => boolean;
  addDoctor: (doctor: Doctor) => boolean;
  removeDoctor: (doctorId: string) => void;
  toggleDoctor: (doctor: Doctor) => void;
  clearComparison: () => void;
  setComparisonDoctors: (doctors: Doctor[]) => void;
}

const DoctorComparisonContext = createContext<
  DoctorComparisonContextValue | undefined
>(undefined);

export function DoctorComparisonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedDoctors, setSelectedDoctors] = useState<Doctor[]>([]);

  const selectedIds = useMemo(
    () => selectedDoctors.map((d) => String(d._id)),
    [selectedDoctors],
  );

  const isInComparison = useCallback(
    (doctorId?: string): boolean => {
      if (!doctorId) return false;
      const target = String(doctorId).trim();
      return selectedDoctors.some((d) => String(d._id) === target);
    },
    [selectedDoctors],
  );

  const addDoctor = useCallback(
    (doctor: Doctor): boolean => {
      if (!doctor || !doctor._id) return false;
      const id = String(doctor._id);

      if (isInComparison(id)) {
        return true;
      }

      if (selectedDoctors.length >= MAX_COMPARE_DOCTORS) {
        Alert.alert(
          "Comparison Limit Reached",
          `You can compare up to ${MAX_COMPARE_DOCTORS} doctors at a time. Remove one from your comparison list to add "${formatDoctorName(doctor.name)}".`,
          [{ text: "OK" }],
        );
        return false;
      }

      setSelectedDoctors((prev) => [...prev, doctor]);
      return true;
    },
    [selectedDoctors.length, isInComparison],
  );

  const removeDoctor = useCallback((doctorId: string) => {
    const target = String(doctorId).trim();
    setSelectedDoctors((prev) =>
      prev.filter((d) => String(d._id) !== target),
    );
  }, []);

  const toggleDoctor = useCallback(
    (doctor: Doctor) => {
      if (!doctor || !doctor._id) return;
      const id = String(doctor._id);
      if (isInComparison(id)) {
        removeDoctor(id);
      } else {
        addDoctor(doctor);
      }
    },
    [isInComparison, removeDoctor, addDoctor],
  );

  const clearComparison = useCallback(() => {
    setSelectedDoctors([]);
  }, []);

  const setComparisonDoctors = useCallback((doctors: Doctor[]) => {
    setSelectedDoctors(doctors.slice(0, MAX_COMPARE_DOCTORS));
  }, []);

  const canCompare = selectedDoctors.length >= 2;
  const compareCount = selectedDoctors.length;

  const value = useMemo<DoctorComparisonContextValue>(
    () => ({
      selectedDoctors,
      selectedIds,
      compareCount,
      canCompare,
      isInComparison,
      addDoctor,
      removeDoctor,
      toggleDoctor,
      clearComparison,
      setComparisonDoctors,
    }),
    [
      selectedDoctors,
      selectedIds,
      compareCount,
      canCompare,
      isInComparison,
      addDoctor,
      removeDoctor,
      toggleDoctor,
      clearComparison,
      setComparisonDoctors,
    ],
  );

  return (
    <DoctorComparisonContext.Provider value={value}>
      {children}
    </DoctorComparisonContext.Provider>
  );
}

export function useDoctorComparison(): DoctorComparisonContextValue {
  const ctx = useContext(DoctorComparisonContext);
  if (!ctx) {
    throw new Error(
      "useDoctorComparison must be used within a DoctorComparisonProvider",
    );
  }
  return ctx;
}
