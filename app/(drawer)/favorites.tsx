/**
 * HealPoint - Favorites screen (inside the patient drawer).
 *
 * Professional dual-tab experience for saved doctors and saved hospitals.
 * Powered by real backend favorites with instant synchronization and optimistic updates.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DoctorCard } from "@/components/DoctorCard";
import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { HospitalCard } from "@/components/HospitalCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useDoctors } from "@/hooks/use-doctors";
import { useFavorites } from "@/hooks/use-favorites";
import { useHospitals } from "@/hooks/use-hospitals";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import type { Doctor, Hospital } from "@/types";

type TabKey = "doctors" | "hospitals";

export default function FavoritesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("doctors");
  const [refreshing, setRefreshing] = useState(false);

  const {
    favoriteIds,
    favoriteHospitalIds,
    savedDoctors,
    savedHospitals,
    isLoading: favoritesLoading,
    refresh: refreshFavorites,
  } = useFavorites();

  const {
    doctors,
    loading: doctorsLoading,
    error: doctorsError,
    refetch: refetchDoctors,
  } = useDoctors({ limit: 50 });

  const {
    hospitals,
    loading: hospitalsLoading,
    error: hospitalsError,
    refetch: refetchHospitals,
  } = useHospitals();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refreshFavorites(),
        refetchDoctors(),
        refetchHospitals(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useScreenFocus(() => {
    refreshFavorites();
    refetchDoctors();
    refetchHospitals();
  });

  // Reconcile saved doctors with catalog data
  const doctorList = useMemo<Doctor[]>(() => {
    const map = new Map<string, Doctor>();
    for (const doc of savedDoctors) {
      const id = String(doc._id || doc.doctorId);
      if (id && favoriteIds.has(id)) {
        map.set(id, doc);
      }
    }
    for (const doc of doctors) {
      const id = String(doc._id);
      if (id && favoriteIds.has(id)) {
        map.set(id, { ...(map.get(id) || {}), ...doc });
      }
    }
    return Array.from(map.values());
  }, [savedDoctors, doctors, favoriteIds]);

  // Reconcile saved hospitals with catalog data
  const hospitalList = useMemo<Hospital[]>(() => {
    const map = new Map<string, Hospital>();
    for (const hosp of savedHospitals) {
      const id = String(hosp._id || hosp.hospitalId);
      if (id && favoriteHospitalIds.has(id)) {
        map.set(id, hosp);
      }
    }
    for (const hosp of hospitals) {
      const id = String(hosp._id);
      if (id && favoriteHospitalIds.has(id)) {
        map.set(id, { ...(map.get(id) || {}), ...hosp });
      }
    }
    return Array.from(map.values());
  }, [savedHospitals, hospitals, favoriteHospitalIds]);

  const initialLoading =
    (activeTab === "doctors" && doctorsLoading && doctorList.length === 0) ||
    (activeTab === "hospitals" &&
      hospitalsLoading &&
      hospitalList.length === 0) ||
    (favoritesLoading && doctorList.length === 0 && hospitalList.length === 0);

  const currentError = activeTab === "doctors" ? doctorsError : hospitalsError;

  const handleRetry = () => {
    refreshFavorites();
    if (activeTab === "doctors") {
      refetchDoctors();
    } else {
      refetchHospitals();
    }
  };

  const subtitleText = `${doctorList.length} saved doctor${doctorList.length === 1 ? "" : "s"} · ${hospitalList.length} saved hospital${hospitalList.length === 1 ? "" : "s"}`;

  return (
    <View style={styles.safe}>
      <DrawerHeader title="Favorites" subtitle={subtitleText} />

      {/* Segmented Dual Tabs */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={`Saved doctors, ${doctorList.length} items`}
            accessibilityState={{ selected: activeTab === "doctors" }}
            onPress={() => setActiveTab("doctors")}
            style={[
              styles.tabItem,
              activeTab === "doctors" && styles.tabItemActive,
            ]}
          >
            <Ionicons
              name={activeTab === "doctors" ? "medkit" : "medkit-outline"}
              size={18}
              color={
                activeTab === "doctors"
                  ? Palette.primaryDark
                  : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "doctors" && styles.tabLabelActive,
              ]}
            >
              Doctors
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === "doctors" && styles.tabBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === "doctors" && styles.tabBadgeTextActive,
                ]}
              >
                {doctorList.length}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={`Saved hospitals, ${hospitalList.length} items`}
            accessibilityState={{ selected: activeTab === "hospitals" }}
            onPress={() => setActiveTab("hospitals")}
            style={[
              styles.tabItem,
              activeTab === "hospitals" && styles.tabItemActive,
            ]}
          >
            <Ionicons
              name={activeTab === "hospitals" ? "business" : "business-outline"}
              size={18}
              color={
                activeTab === "hospitals"
                  ? Palette.primaryDark
                  : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === "hospitals" && styles.tabLabelActive,
              ]}
            >
              Hospitals
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === "hospitals" && styles.tabBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === "hospitals" && styles.tabBadgeTextActive,
                ]}
              >
                {hospitalList.length}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Main Tab Content */}
      {initialLoading ? (
        <Loading label={`Loading saved ${activeTab}...`} />
      ) : currentError &&
        (activeTab === "doctors"
          ? doctorList.length === 0
          : hospitalList.length === 0) ? (
        <ErrorState message={currentError} onRetry={handleRetry} />
      ) : activeTab === "doctors" ? (
        doctorList.length === 0 ? (
          <EmptyState
            title="No favorite doctors yet"
            message="Tap the heart icon on any doctor profile to save them here for one-tap booking and quick follow-ups."
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(drawer)/doctors")}
                style={styles.browseButton}
              >
                <Ionicons name="search" size={18} color={Palette.white} />
                <Text style={styles.browseButtonText}>Browse Doctors</Text>
              </Pressable>
            }
          />
        ) : (
          <FlatList
            data={doctorList}
            keyExtractor={(item) => String(item._id)}
            renderItem={({ item, index }) => (
              <DoctorCard doctor={item} index={index} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Palette.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : hospitalList.length === 0 ? (
        <EmptyState
          title="No favorite hospitals yet"
          message="Keep emergency centers, partner clinics, and preferred multi-specialty hospitals saved for fast access."
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(drawer)/hospitals")}
              style={styles.browseButton}
            >
              <Ionicons name="business" size={18} color={Palette.white} />
              <Text style={styles.browseButtonText}>Browse Hospitals</Text>
            </Pressable>
          }
        />
      ) : (
        <FlatList
          data={hospitalList}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => <HospitalCard hospital={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  tabBarWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  tabItemActive: {
    backgroundColor: Palette.surface,
    ...Shadows.card,
  },
  tabLabel: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: "rgba(100, 116, 139, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeActive: {
    backgroundColor: Palette.primaryLight,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  tabBadgeTextActive: {
    color: Palette.primaryDark,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.md,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignSelf: "stretch",
    marginTop: Spacing.xs,
  },
  browseButtonText: {
    ...Typography.label,
    color: Palette.white,
    fontWeight: "700",
  },
});
