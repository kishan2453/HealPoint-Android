/**
 * HealPoint - Doctor search (marketplace).
 *
 * A fully working search built on the real backend `/doctor/get-all` contract.
 * The Search button fires an actual API request; every filter maps to a query
 * param the backend supports; sorting re-orders the real returned data (the
 * server has no sort param); pagination is NOT faked because the backend does
 * not expose skip/page — instead an honest "showing X of Y" note is shown.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DoctorCard } from "@/components/DoctorCard";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { DoctorListSkeleton } from "@/components/DoctorCardSkeleton";
import { DoctorFilterSheet } from "@/components/DoctorFilterSheet";
import { DoctorSortSheet } from "@/components/DoctorSortSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";
import { useHospitals } from "@/hooks/use-hospitals";
import { useDoctorFilterOptions } from "@/hooks/use-doctor-filter-options";
import { useDoctorSearch } from "@/hooks/use-doctor-search";
import {
  buildDoctorSearchParams,
  countActiveFilters,
  describeActiveFilters,
  sortDoctors,
  sortLabel,
  type DoctorSearchFilters,
  type DoctorSort,
} from "@/lib/doctor-search";

export default function DoctorsScreen() {
  const params = useLocalSearchParams<{
    search?: string;
    speciality?: string;
    department?: string;
    online?: string;
    hospitalId?: string;
    favorites?: string;
  }>();

  const { favoriteIds } = useFavorites();
  const { hospitals } = useHospitals();
  const { doctors, totalCount, loading, error, runSearch } = useDoctorSearch();
  const { options: filterOptions } = useDoctorFilterOptions();

  const initialQuery = typeof params.search === "string" ? params.search : "";
  const initialHospitalId =
    typeof params.hospitalId === "string" ? params.hospitalId : "";
  const initialSpeciality =
    (typeof params.speciality === "string" && params.speciality) ||
    (typeof params.department === "string" && params.department) ||
    "";
  const initialFilters: DoctorSearchFilters = {
    ...(initialSpeciality ? { speciality: initialSpeciality } : {}),
    ...(params.online === "1" ? { consultationType: "video" as const } : {}),
  };

  const [query, setQuery] = useState(initialQuery);
  const [hospitalId, setHospitalId] = useState(initialHospitalId);
  const [favoritesOnly, setFavoritesOnly] = useState(params.favorites === "1");
  const [filters, setFilters] = useState<DoctorSearchFilters>(initialFilters);
  const [sort, setSort] = useState<DoctorSort>("recommended");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await runSearch(buildDoctorSearchParams({ query, hospitalId, filters }));
    } finally {
      setRefreshing(false);
    }
  };

  const appliedParamsRef = useRef<string | null>(null);

  // Run a real search whenever the screen opens or route params change.
  useEffect(() => {
    const signature = `${params.search ?? ""}|${params.speciality ?? ""}|${params.department ?? ""}|${params.online ?? ""}|${params.hospitalId ?? ""}|${params.favorites ?? ""}`;
    if (appliedParamsRef.current === signature) return;
    appliedParamsRef.current = signature;

    const nextQuery = typeof params.search === "string" ? params.search : "";
    const nextHospitalId =
      typeof params.hospitalId === "string" ? params.hospitalId : "";
    const nextFavorites = params.favorites === "1";
    const nextSpeciality =
      (typeof params.speciality === "string" && params.speciality) ||
      (typeof params.department === "string" && params.department) ||
      "";
    const nextFilters: DoctorSearchFilters = {
      ...(nextSpeciality ? { speciality: nextSpeciality } : {}),
      ...(params.online === "1" ? { consultationType: "video" as const } : {}),
    };

    setQuery(nextQuery);
    setHospitalId(nextHospitalId);
    setFavoritesOnly(nextFavorites);
    setFilters(nextFilters);
    runSearch(
      buildDoctorSearchParams({
        query: nextQuery,
        hospitalId: nextHospitalId,
        filters: nextFilters,
      }),
    );
  }, [params, runSearch]);

  // --- Actions (every search press / filter apply = a real API request) -----

  const onSearchPress = () => {
    Keyboard.dismiss();
    runSearch(buildDoctorSearchParams({ query, hospitalId, filters }));
  };

  const onRetry = () => {
    runSearch(buildDoctorSearchParams({ query, hospitalId, filters }));
  };

  const applyFilters = (next: DoctorSearchFilters) => {
    setFilters(next);
    setFiltersVisible(false);
    runSearch(buildDoctorSearchParams({ query, hospitalId, filters: next }));
  };

  const toggleHospital = (id: string) => {
    const next = hospitalId === id ? "" : id;
    setHospitalId(next);
    runSearch(buildDoctorSearchParams({ query, hospitalId: next, filters }));
  };

  const removeActiveFilter = (key: string) => {
    if (key === "hospital") {
      setHospitalId("");
      runSearch(buildDoctorSearchParams({ query, hospitalId: "", filters }));
      return;
    }
    const next = { ...filters };
    delete next[key as keyof DoctorSearchFilters];
    setFilters(next);
    runSearch(buildDoctorSearchParams({ query, hospitalId, filters: next }));
  };

  const clearAll = () => {
    Keyboard.dismiss();
    setQuery("");
    setHospitalId("");
    setFilters({});
    // Also leave the "favorites only" view — arriving from the Home Favorites
    // quick action (…/doctors?favorites=1), "Clear" must drop that filter too.
    setFavoritesOnly(false);
    runSearch(
      buildDoctorSearchParams({ query: "", hospitalId: "", filters: {} }),
    );
  };

  const selectSort = (next: DoctorSort) => {
    setSort(next);
  };

  // --- Derived values ---------------------------------------------------------

  const hasQuery = query.trim().length > 0;
  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, hospitalId),
    [filters, hospitalId],
  );
  const hasActiveFilters = activeFilterCount > 0 || favoritesOnly;

  const activeFilterItems = useMemo(() => {
    const hospital = hospitals.find((item) => String(item._id) === hospitalId);
    return describeActiveFilters(filters, hospital?.name);
  }, [filters, hospitals, hospitalId]);

  // Sorting re-orders the REAL returned data; 'recommended' = server order.
  const sortedDoctors = useMemo(
    () => sortDoctors(doctors, sort),
    [doctors, sort],
  );

  // Favorites is a client-side view over the fetched catalog (the backend has
  // no favorites filter) — applied on top of real results only.
  const visibleDoctors = useMemo(() => {
    if (!favoritesOnly) return sortedDoctors;
    return sortedDoctors.filter((doctor) =>
      favoriteIds.has(String(doctor._id)),
    );
  }, [sortedDoctors, favoritesOnly, favoriteIds]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton />
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Find a doctor</Text>
            <Text style={styles.subtitle}>
              {loading
                ? "Searching doctors..."
                : visibleDoctors.length > 0
                  ? favoritesOnly
                    ? `${visibleDoctors.length} saved doctor${visibleDoctors.length === 1 ? "" : "s"}`
                    : `${visibleDoctors.length} doctor${visibleDoctors.length === 1 ? "" : "s"} found`
                  : "No doctors found"}
            </Text>
          </View>
        </View>
      </View>

      {/* ---------------- Search bar + Search button ---------------- */}
      <View style={styles.searchRow}>
        <View style={styles.searchBarWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Doctor, specialty, hospital, city..."
            onSubmitEditing={onSearchPress}
          />
        </View>
        <Button
          title="Search"
          onPress={onSearchPress}
          loading={loading}
          fullWidth={false}
          style={styles.searchButton}
        />
      </View>

      {/* ---------------- Filter / sort toolbar ---------------- */}
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open filters"
          onPress={() => setFiltersVisible(true)}
          style={({ pressed }) => [
            styles.toolbarButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? Palette.primary : Palette.textMuted}
          />
          <Text
            style={[
              styles.toolbarButtonText,
              activeFilterCount > 0 && styles.toolbarButtonTextActive,
            ]}
          >
            Filters
          </Text>
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort doctors"
          onPress={() => setSortVisible(true)}
          style={({ pressed }) => [
            styles.toolbarButton,
            styles.sortButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="swap-vertical" size={18} color={Palette.textMuted} />
          <Text style={styles.toolbarButtonText} numberOfLines={1}>
            {sortLabel(sort)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Palette.textMuted} />
        </Pressable>

        {hasActiveFilters ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search and filters"
            onPress={clearAll}
            style={({ pressed }) => [
              styles.clearAllButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.clearAllText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---------------- Active filter chips ---------------- */}
      {activeFilterItems.length > 0 || favoritesOnly ? (
        <View style={styles.chipsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {favoritesOnly ? (
              <View style={[styles.activeChip, styles.activeChipSelected]}>
                <Ionicons name="heart" size={13} color={Palette.white} />
                <Text style={styles.activeChipText}>Favorites</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove favorites filter"
                  onPress={() => setFavoritesOnly(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={Palette.white} />
                </Pressable>
              </View>
            ) : null}
            {activeFilterItems.map((item) => (
              <View
                key={item.key}
                style={[styles.activeChip, styles.activeChipSelected]}
              >
                <Text style={styles.activeChipText}>{item.label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.label}`}
                  onPress={() => removeActiveFilter(item.key)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={Palette.white} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ---------------- Hospital quick chips (real catalog) ---------------- */}
      {hospitals.length > 0 ? (
        <View style={styles.chipsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {hospitals.map((hospital) => {
              const active = hospitalId === String(hospital._id);
              return (
                <Pressable
                  key={String(hospital._id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleHospital(String(hospital._id))}
                  style={[
                    styles.hospitalChip,
                    active && styles.hospitalChipActive,
                  ]}
                >
                  <Ionicons
                    name="business"
                    size={13}
                    color={active ? Palette.white : Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.hospitalChipText,
                      active && styles.hospitalChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {hospital.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ---------------- Results ---------------- */}
      {loading ? (
        <DoctorListSkeleton count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : visibleDoctors.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters || hasQuery
              ? "No doctors match your search"
              : "No doctors available"
          }
          message={
            favoritesOnly
              ? "Tap the heart on any doctor card to save them here."
              : hasActiveFilters || hasQuery
                ? "Try a different search term or remove some filters."
                : "Please check back later — new doctors are added regularly."
          }
          action={
            hasActiveFilters || hasQuery ? (
              <Button
                title="Clear search & filters"
                variant="outline"
                onPress={clearAll}
              />
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={visibleDoctors}
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            <View style={styles.listFooter}>
              {totalCount > visibleDoctors.length ? (
                <Text style={styles.footerNote}>
                  Showing {visibleDoctors.length} of {totalCount} doctors. The
                  directory has more — refine your search or filters to find
                  them.
                </Text>
              ) : (
                <Text style={styles.footerNote}>
                  {totalCount} doctor{totalCount === 1 ? "" : "s"} in this
                  result
                </Text>
              )}
            </View>
          }
        />
      )}

      {/* ---------------- Filter / sort sheets ---------------- */}
      <DoctorFilterSheet
        visible={filtersVisible}
        filters={filters}
        options={filterOptions}
        onApply={applyFilters}
        onClose={() => setFiltersVisible(false)}
      />
      <DoctorSortSheet
        visible={sortVisible}
        sort={sort}
        onSelect={selectSort}
        onClose={() => setSortVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBarWrap: {
    flex: 1,
  },
  searchButton: {
    minWidth: 108,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  toolbarButtonText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  toolbarButtonTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  sortButton: {
    flexShrink: 1,
  },
  clearAllButton: {
    marginLeft: "auto",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  clearAllText: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxs,
  },
  badgeText: {
    color: Palette.white,
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  chipsSection: {
    paddingTop: Spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  activeChipSelected: {
    backgroundColor: Palette.primary,
  },
  activeChipText: {
    ...Typography.bodySmall,
    color: Palette.white,
    fontWeight: "600",
    maxWidth: 160,
  },
  hospitalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    maxWidth: 220,
  },
  hospitalChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  hospitalChipText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  hospitalChipTextActive: {
    color: Palette.white,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  separator: {
    height: Spacing.md,
  },
  listFooter: {
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  footerNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
});
