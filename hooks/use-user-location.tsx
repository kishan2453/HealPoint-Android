/**
 * HealPoint - Real User Location Hook & State Management.
 *
 * Implements device geolocation detection, reverse geocoding to human-readable
 * locality/city without exposing precise coordinates, persistence, and
 * fallback to user profile address or interactive manual city selection.
 */
// Safely load expo-location to prevent crashing dev clients or builds missing native ExpoLocation module
let LocationModule: typeof import("expo-location") | null = null;
try {
  LocationModule = require("expo-location");
} catch {
  LocationModule = null;
}
import { getStorageItem, setStorageItem } from "@/lib/storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Palette, Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";

const LOCATION_STORAGE_KEY = "healpoint.user.location";

export interface UserCoordinates {
  lat: number;
  lng: number;
}

export interface UserLocationState {
  locality: string;
  city: string;
  state: string;
  displayLabel: string;
  coordinates: UserCoordinates | null;
  loading: boolean;
  permissionStatus: "granted" | "denied" | "undetermined";
  isManual: boolean;
}

const DEFAULT_CITIES = [
  { city: "Ahmedabad", state: "Gujarat", locality: "Ahmedabad, Gujarat" },
  { city: "Gandhinagar", state: "Gujarat", locality: "Gandhinagar, Gujarat" },
  { city: "Surat", state: "Gujarat", locality: "Surat, Gujarat" },
  { city: "Vadodara", state: "Gujarat", locality: "Vadodara, Gujarat" },
  { city: "Rajkot", state: "Gujarat", locality: "Rajkot, Gujarat" },
  { city: "Bhavnagar", state: "Gujarat", locality: "Bhavnagar, Gujarat" },
  { city: "Mumbai", state: "Maharashtra", locality: "Mumbai, Maharashtra" },
  { city: "Pune", state: "Maharashtra", locality: "Pune, Maharashtra" },
  { city: "Delhi", state: "Delhi", locality: "New Delhi, Delhi" },
  { city: "Bengaluru", state: "Karnataka", locality: "Bengaluru, Karnataka" },
];

/**
 * Haversine formula to compute great-circle distance between two points in km.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

interface LocationContextValue extends UserLocationState {
  requestDeviceLocation: () => Promise<void>;
  selectCity: (city: string, state: string, locality?: string) => void;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  calculateDistanceTo: (targetLat?: number, targetLng?: number) => string | null;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locality, setLocality] = useState<string>("Ahmedabad, Gujarat");
  const [city, setCity] = useState<string>("Ahmedabad");
  const [stateName, setStateName] = useState<string>("Gujarat");
  const [coordinates, setCoordinates] = useState<UserCoordinates | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [isManual, setIsManual] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Restore stored location or derive from authenticated user profile
  useEffect(() => {
    (async () => {
      try {
        const stored = await getStorageItem(LOCATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.city) {
            setCity(parsed.city);
            setLocality(parsed.locality || `${parsed.city}, ${parsed.state || "Gujarat"}`);
            setStateName(parsed.state || "Gujarat");
            if (parsed.coordinates) setCoordinates(parsed.coordinates);
            setIsManual(Boolean(parsed.isManual));
            return;
          }
        }
      } catch {}

      // Fallback: derive from user profile address if available
      if (user?.address) {
        const parts = user.address.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const detectedCity = parts[parts.length - 2];
          const detectedState = parts[parts.length - 1];
          setCity(detectedCity);
          setStateName(detectedState);
          setLocality(`${detectedCity}, ${detectedState}`);
        } else if (parts.length === 1) {
          setCity(parts[0]);
          setLocality(`${parts[0]}, Gujarat`);
        }
      }
    })();
  }, [user?.address]);

  // Request native GPS location with explanation and graceful fallback
  const requestDeviceLocation = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS !== "web" && LocationModule) {
        try {
          const { status } = await LocationModule.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setPermissionStatus("denied");
            setLoading(false);
            Alert.alert(
              "Location Permission Needed",
              "HealPoint uses your location to discover nearby doctors and hospitals and calculate travel distance. You can select your city manually.",
              [
                { text: "Select City Manually", onPress: () => setModalVisible(true) },
                { text: "Cancel", style: "cancel" },
              ],
            );
            return;
          }

          const pos = await LocationModule.getCurrentPositionAsync({
            accuracy: LocationModule.Accuracy?.Balanced ?? 3,
          });
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoordinates({ lat, lng });
          setPermissionStatus("granted");

          try {
            const rev = await LocationModule.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (rev && rev.length > 0) {
              const detectedCity = rev[0].city || rev[0].subregion || rev[0].district || "Ahmedabad";
              const detectedState = rev[0].region || "Gujarat";
              const detectedLocality = `${detectedCity}, ${detectedState}`;

              setCity(detectedCity);
              setStateName(detectedState);
              setLocality(detectedLocality);
              setIsManual(false);

              await setStorageItem(
                LOCATION_STORAGE_KEY,
                JSON.stringify({
                  city: detectedCity,
                  state: detectedState,
                  locality: detectedLocality,
                  coordinates: { lat, lng },
                  isManual: false,
                }),
              );
            }
          } catch {
            // Keep coordinates even if reverse geocode fails
          }
          setLoading(false);
          return;
        } catch (nativeErr) {
          console.warn("[use-user-location] Native location request failed:", nativeErr);
        }
      }

      // Web platform or fallback geolocation
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoordinates({ lat, lng });
          setPermissionStatus("granted");

          // Reverse-geocode coordinates to locality/city via OpenStreetMap Nominatim
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
              {
                headers: {
                  "User-Agent": "HealPointMobile/1.0",
                  Accept: "application/json",
                },
              },
            );
            if (response.ok) {
              const data = await response.json();
              const addr = data.address || {};
              const detectedCity =
                addr.city || addr.town || addr.village || addr.suburb || addr.county || "Ahmedabad";
              const detectedState = addr.state || "Gujarat";
              const detectedLocality = `${detectedCity}, ${detectedState}`;

              setCity(detectedCity);
              setStateName(detectedState);
              setLocality(detectedLocality);
              setIsManual(false);

              await setStorageItem(
                LOCATION_STORAGE_KEY,
                JSON.stringify({
                  city: detectedCity,
                  state: detectedState,
                  locality: detectedLocality,
                  coordinates: { lat, lng },
                  isManual: false,
                }),
              );
            }
          } catch {
            // If reverse geocode network fails, maintain coordinates
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          setLoading(false);
          setPermissionStatus("denied");
          Alert.alert(
            "Location Access",
            "HealPoint uses your location to discover nearby doctors and hospitals and calculate travel distance. You can select your city manually.",
            [
              { text: "Select City Manually", onPress: () => setModalVisible(true) },
              { text: "Cancel", style: "cancel" },
            ],
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
      return;
    }

    setLoading(false);
    setPermissionStatus("denied");
    Alert.alert(
      "Select Location",
      "Please select your preferred city manually to view local healthcare providers.",
      [
        { text: "Select City", onPress: () => setModalVisible(true) },
        { text: "Cancel", style: "cancel" },
      ],
    );
  } catch {
    setLoading(false);
    setPermissionStatus("denied");
  }
  }, []);

  const selectCity = useCallback(async (selectedCity: string, selectedState: string, customLocality?: string) => {
    const loc = customLocality || `${selectedCity}, ${selectedState}`;
    setCity(selectedCity);
    setStateName(selectedState);
    setLocality(loc);
    setIsManual(true);
    setModalVisible(false);

    try {
      await setStorageItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({
          city: selectedCity,
          state: selectedState,
          locality: loc,
          coordinates,
          isManual: true,
        }),
      );
    } catch {}
  }, [coordinates]);

  const calculateDistanceTo = useCallback(
    (targetLat?: number, targetLng?: number): string | null => {
      if (!coordinates || targetLat == null || targetLng == null) return null;
      if (isNaN(targetLat) || isNaN(targetLng)) return null;
      const dist = calculateHaversineDistance(
        coordinates.lat,
        coordinates.lng,
        targetLat,
        targetLng,
      );
      return `${dist.toFixed(1)} km`;
    },
    [coordinates],
  );

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DEFAULT_CITIES;
    return DEFAULT_CITIES.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.locality.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const value = useMemo(
    () => ({
      locality,
      city,
      state: stateName,
      displayLabel: locality || `${city}, ${stateName}`,
      coordinates,
      loading,
      permissionStatus,
      isManual,
      requestDeviceLocation,
      selectCity,
      openLocationModal: () => setModalVisible(true),
      closeLocationModal: () => setModalVisible(false),
      calculateDistanceTo,
    }),
    [
      locality,
      city,
      stateName,
      coordinates,
      loading,
      permissionStatus,
      isManual,
      requestDeviceLocation,
      selectCity,
      calculateDistanceTo,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}

      {/* Interactive Location Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={modalStyles.backdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={modalStyles.handle} />

            <View style={modalStyles.headerRow}>
              <View>
                <Text style={modalStyles.title}>Select Your Location</Text>
                <Text style={modalStyles.sub}>
                  Choose your city for discovering nearby doctors and hospitals
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setModalVisible(false)}
                style={modalStyles.closeBtn}
              >
                <Ionicons name="close" size={20} color={Palette.textMuted} />
              </Pressable>
            </View>

            {/* GPS Detection Option */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Detect Current GPS Location"
              onPress={() => {
                requestDeviceLocation();
                setModalVisible(false);
              }}
              style={({ pressed }) => [
                modalStyles.gpsTile,
                pressed && modalStyles.pressed,
              ]}
            >
              <View style={modalStyles.gpsIconCircle}>
                <Ionicons name="locate" size={20} color={Palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.gpsTitle}>Use Current Location</Text>
                <Text style={modalStyles.gpsSub}>Enable GPS to detect locality automatically</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </Pressable>

            {/* Search Input */}
            <View style={modalStyles.searchWrap}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search city or locality..."
                placeholderTextColor={Palette.textMuted}
                style={modalStyles.searchInput}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={Palette.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* City Options List */}
            <ScrollView style={modalStyles.list} showsVerticalScrollIndicator={false}>
              <Text style={modalStyles.sectionLabel}>Popular Cities</Text>
              {filteredCities.map((item) => {
                const isSelected = item.city.toLowerCase() === city.toLowerCase();
                return (
                  <Pressable
                    key={item.city}
                    accessibilityRole="button"
                    accessibilityLabel={item.locality}
                    onPress={() => selectCity(item.city, item.state, item.locality)}
                    style={({ pressed }) => [
                      modalStyles.cityItem,
                      isSelected && modalStyles.cityItemSelected,
                      pressed && modalStyles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={isSelected ? Palette.primary : Palette.textMuted}
                    />
                    <Text
                      style={[
                        modalStyles.cityText,
                        isSelected && modalStyles.cityTextSelected,
                      ]}
                    >
                      {item.locality}
                    </Text>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={Palette.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LocationContext.Provider>
  );
}

export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    // Graceful fallback if called outside provider
    return {
      locality: "Ahmedabad, Gujarat",
      city: "Ahmedabad",
      state: "Gujarat",
      displayLabel: "Ahmedabad, Gujarat",
      coordinates: null,
      loading: false,
      permissionStatus: "undetermined",
      isManual: true,
      requestDeviceLocation: async () => {},
      selectCity: () => {},
      openLocationModal: () => {},
      closeLocationModal: () => {},
      calculateDistanceTo: () => null,
    };
  }
  return ctx;
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    maxHeight: "80%",
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
  },
  sub: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.pill,
    backgroundColor: "#F1F5F9",
  },
  gpsTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.6)",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  gpsIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  gpsSub: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Palette.text,
    paddingVertical: 2,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  list: {
    maxHeight: 280,
  },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: Radius.md,
  },
  cityItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  cityText: {
    flex: 1,
    fontSize: 14,
    color: Palette.text,
    fontWeight: "500",
  },
  cityTextSelected: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
