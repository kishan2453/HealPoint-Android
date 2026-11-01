/**
 * HealPoint - Emergency SOS & Real-Time Response Hook.
 * Manages active emergency alerts, ambulance live dispatch status,
 * emergency contacts, and real-time Socket.IO broadcasts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import * as emergencyService from "@/services/emergency";
import { subscribeToEmergencyStatus } from "@/services/socket";
import type {
  EmergencyContactItem,
  EmergencyLocation,
  EmergencyRequest,
  EmergencyType,
} from "@/types";

export function useEmergency() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState<EmergencyRequest | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [contacts, setContacts] = useState<EmergencyContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");

  const inFlightRef = useRef(false);

  // Fetch current GPS location
  const getCurrentLocation = useCallback(async (): Promise<EmergencyLocation | undefined> => {
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  sharedAt: new Date().toISOString(),
                });
              },
              () => resolve(undefined),
              { timeout: 5000, enableHighAccuracy: true }
            );
          });
        }
        return undefined;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return undefined;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let address = "";
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          address = [geo.name, geo.street, geo.city, geo.postalCode]
            .filter(Boolean)
            .join(", ");
        }
      } catch {
        // reverse geocoding is optional
      }

      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || undefined,
        address: address || undefined,
        sharedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("[useEmergency] Location capture warning:", err);
      return undefined;
    }
  }, []);

  const refreshActive = useCallback(async () => {
    if (!isAuthenticated || authLoading) return;
    try {
      const res = await emergencyService.getActiveEmergency();
      setActiveEmergency(res.activeEmergency || null);
    } catch (err) {
      // keep quiet on network blips
    }
  }, [isAuthenticated, authLoading]);

  const refreshHistory = useCallback(async () => {
    if (!isAuthenticated || authLoading) return;
    try {
      const res = await emergencyService.getMyEmergencyHistory();
      setEmergencies(res.emergencies || []);
    } catch (err) {
      // ignore
    }
  }, [isAuthenticated, authLoading]);

  const refreshContacts = useCallback(async () => {
    if (!isAuthenticated || authLoading) return;
    try {
      const res = await emergencyService.getEmergencyContacts();
      setContacts(res.contacts || []);
    } catch (err) {
      // ignore
    }
  }, [isAuthenticated, authLoading]);

  const loadAll = useCallback(async () => {
    if (inFlightRef.current || authLoading || !isAuthenticated) {
      if (!authLoading && !isAuthenticated) setLoading(false);
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      const [activeRes, histRes, contactsRes] = await Promise.allSettled([
        emergencyService.getActiveEmergency(),
        emergencyService.getMyEmergencyHistory(),
        emergencyService.getEmergencyContacts(),
      ]);

      if (activeRes.status === "fulfilled") {
        setActiveEmergency(activeRes.value.activeEmergency || null);
      }
      if (histRes.status === "fulfilled") {
        setEmergencies(histRes.value.emergencies || []);
      }
      if (contactsRes.status === "fulfilled") {
        setContacts(contactsRes.value.contacts || []);
      }
    } catch (err) {
      setError("Unable to load emergency services. Please try again.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    loadAll();

    // Subscribe to live emergency socket events
    const unsubscribe = subscribeToEmergencyStatus((payload) => {
      refreshActive();
      refreshHistory();
    });

    return () => {
      unsubscribe();
    };
  }, [loadAll, refreshActive, refreshHistory]);

  const triggerSOS = useCallback(
    async (options?: {
      emergencyType?: EmergencyType;
      notes?: string;
      hospitalId?: string;
    }): Promise<EmergencyRequest> => {
      setTriggering(true);
      setError("");

      try {
        const location = await getCurrentLocation();
        const res = await emergencyService.triggerEmergencySOS({
          emergencyType: options?.emergencyType || "other",
          severity: "critical",
          notes: options?.notes || "Emergency SOS triggered",
          hospitalId: options?.hospitalId,
          location,
          emergencyContacts: contacts,
        });

        setActiveEmergency(res.data);
        await refreshHistory();
        return res.data;
      } catch (err: any) {
        const msg = err?.message || "Failed to trigger emergency SOS. Please dial 112 / 108 directly!";
        setError(msg);
        throw err;
      } finally {
        setTriggering(false);
      }
    },
    [contacts, getCurrentLocation, refreshHistory]
  );

  const cancelActiveEmergency = useCallback(
    async (reason = "Cancelled by patient"): Promise<void> => {
      if (!activeEmergency?._id) return;
      setTriggering(true);
      try {
        await emergencyService.cancelEmergency(activeEmergency._id, reason);
        setActiveEmergency(null);
        await refreshHistory();
      } catch (err: any) {
        setError(err?.message || "Failed to cancel emergency request.");
        throw err;
      } finally {
        setTriggering(false);
      }
    },
    [activeEmergency, refreshHistory]
  );

  const saveContact = useCallback(
    async (contact: {
      name: string;
      phone: string;
      relation?: string;
      isPrimary?: boolean;
      contactId?: string;
    }) => {
      const res = await emergencyService.saveEmergencyContact(contact);
      setContacts(res.contacts || []);
    },
    []
  );

  const removeContact = useCallback(async (contactId: string) => {
    const res = await emergencyService.deleteEmergencyContact(contactId);
    setContacts(res.contacts || []);
  }, []);

  return {
    activeEmergency,
    emergencies,
    contacts,
    loading,
    triggering,
    error,
    triggerSOS,
    cancelActiveEmergency,
    saveContact,
    removeContact,
    refreshActive,
    refreshHistory,
    refreshContacts,
    refreshAll: loadAll,
  };
}

