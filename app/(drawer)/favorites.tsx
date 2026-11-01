/**
 * HealPoint - Favorites screen (inside the patient drawer).
 *
 * Professional dual-tab experience for saved doctors and saved hospitals.
 * Powered by real backend MongoDB favorites with instant synchronization,
 * search, specialty filtering, sorting, and direct appointment booking.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
type SortOption = "recent" | "rating";

export default function FavoritesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("doctors");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

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
    // First populate from server-saved list
    for (const doc of savedDoctors) {
      const id = String(doc._id || doc.doctorId);
      if (id && favoriteIds.has(id)) {
        map.set(id, { ...doc, _id: id });
      }
    }
    // Enrich with catalog details if available
    for (const doc of doctors) {
      const id = String(doc._id);
      if (id && favoriteIds.has(id)) {
        map.set(id, { ...(map.get(id) || {}), ...doc, _id: id });
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
        map.set(id, { ...hosp, _id: id });
      }
    }
    for (const hosp of hospitals) {
      const id = String(hosp._id);
      if (id && favoriteHospitalIds.has(id)) {
        map.set(id, { ...(map.get(id) || {}), ...hosp, _id: id });
      }
    }
    return Array.from(map.values());
  }, [savedHospitals, hospitals, favoriteHospitalIds]);

  // Extract unique specialties from saved doctors
  const availableSpecialties = useMemo(() => {
    const set = new Set<string>();
    doctorList.forEach((d) => {
      const spec = d.speciality || d.specialization || d.department;
      if (spec) set.add(spec);
    });
    return ["All", ...Array.from(set)];
  }, [doctorList]);

  // Filtered and sorted doctors
  const displayedDoctors = useMemo(() => {
    let list = doctorList.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        doc.name?.toLowerCase().includes(q) ||
        doc.speciality?.toLowerCase().includes(q) ||
        doc.specialization?.toLowerCase().includes(q) ||
        doc.hospitalName?.toLowerCase().includes(q);

      const docSpec = doc.speciality || doc.specialization || doc.department || "";
      const matchesSpec =
        selectedSpecialty === "All" ||
        docSpec.toLowerCase() === selectedSpecialty.toLowerCase();

      return matchesQuery && matchesSpec;
    });

    if (sortBy === "rating") {
      list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return list;
  }, [doctorList, searchQuery, selectedSpecialty, sortBy]);

  // Filtered and sorted hospitals
  const displayedHospitals = useMemo(() => {
    let list = hospitalList.filter((hosp) => {
      const q = searchQuery.toLowerCase().trim();
      const loc = hosp.location;
      const addr = [loc?.address, loc?.city, loc?.state].filter(Boolean).join(" ");
      return (
        !q ||
        hosp.name?.toLowerCase().includes(q) ||
        addr.toLowerCase().includes(q) ||
        (Array.isArray(hosp.departments) &&
          hosp.departments.some((d) => d.toLowerCase().includes(q)))
      );
    });

    if (sortBy === "rating") {
      list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return list;
  }, [hospitalList, searchQuery, sortBy]);

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

  const subtitleText = `${doctorList.length} saved doctor${
    doctorList.length === 1 ? "" : "s"
  } · ${hospitalList.length} saved hospital${
    hospitalList.length === 1 ? "" : "s"
  }`;

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
            onPress={() => {
              setActiveTab("doctors");
              setSearchQuery("");
            }}
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
            onPress={() => {
              setActiveTab("hospitals");
              setSearchQuery("");
            }}
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

      {/* Search & Filter Bar (Only shown when there are saved items) */}
      {((activeTab === "doctors" && doctorList.length > 0) ||
        (activeTab === "hospitals" && hospitalList.length > 0)) && (
        <View style={styles.controlsSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={Palette.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeTab === "doctors"
                    ? "Search by doctor, specialty, or clinic..."
                    : "Search by hospital or city..."
                }
                placeholderTextColor={Palette.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Sort Toggle Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sortBy === "recent" ? "rating" : "recently added"}`}
              onPress={() => setSortBy((prev) => (prev === "recent" ? "rating" : "recent"))}
              style={[styles.sortButton, sortBy === "rating" && styles.sortButtonActive]}
            >
              <Ionicons
                name={sortBy === "rating" ? "star" : "time-outline"}
                size={16}
                color={sortBy === "rating" ? Palette.primaryDark : Palette.textMuted}
              />
              <Text
                style={[
                  styles.sortButtonText,
                  sortBy === "rating" && styles.sortButtonTextActive,
                ]}
              >
                {sortBy === "rating" ? "Top Rated" : "Recent"}
              </Text>
            </Pressable>
          </View>

          {/* Specialty Filter Chips for Doctors */}
          {activeTab === "doctors" && availableSpecialties.length > 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.specialtyChipsWrap}
            >
              {availableSpecialties.map((spec) => {
                const isSelected = selectedSpecialty === spec;
                return (
                  <Pressable
                    key={spec}
                    onPress={() => setSelectedSpecialty(spec)}
                    style={[
                      styles.specialtyChip,
                      isSelected && styles.specialtyChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.specialtyChipText,
                        isSelected && styles.specialtyChipTextActive,
                      ]}
                    >
                      {spec}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

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
            message="Tap the heart icon on any doctor profile or search card to save them here for one-tap booking and instant follow-ups."
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
        ) : displayedDoctors.length === 0 ? (
          <View style={styles.emptySearchWrap}>
            <Ionicons name="search-outline" size={48} color={Palette.textMuted} />
            <Text style={styles.emptySearchTitle}>No matching doctors</Text>
            <Text style={styles.emptySearchText}>
              No doctors found matching &ldquo;{searchQuery}&rdquo;. Try another search or clear filters.
            </Text>
            <Pressable
              onPress={() => {
                setSearchQuery("");
                setSelectedSpecialty("All");
              }}
              style={styles.clearFilterBtn}
            >
              <Text style={styles.clearFilterBtnText}>Clear Filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={displayedDoctors}
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
      ) : displayedHospitals.length === 0 ? (
        <View style={styles.emptySearchWrap}>
          <Ionicons name="search-outline" size={48} color={Palette.textMuted} />
          <Text style={styles.emptySearchTitle}>No matching hospitals</Text>
          <Text style={styles.emptySearchText}>
            No hospitals found matching &ldquo;{searchQuery}&rdquo;.
          </Text>
          <Pressable
            onPress={() => setSearchQuery("")}
            style={styles.clearFilterBtn}
          >
            <Text style={styles.clearFilterBtnText}>Clear Search</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayedHospitals}
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
  controlsSection: {
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Palette.text,
    paddingVertical: 0,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  sortButtonActive: {
    borderColor: Palette.primaryLight,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  sortButtonTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  specialtyChipsWrap: {
    paddingVertical: 4,
    gap: 8,
  },
  specialtyChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  specialtyChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  specialtyChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  specialtyChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
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
  emptySearchWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
    gap: 12,
  },
  emptySearchTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  emptySearchText: {
    fontSize: 14,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  clearFilterBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
  },
  clearFilterBtnText: {
    color: Palette.white,
    fontWeight: "700",
    fontSize: 13,
  },
});
