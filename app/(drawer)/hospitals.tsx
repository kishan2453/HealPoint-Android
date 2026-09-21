import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HospitalCard } from "@/components/HospitalCard";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { SearchBar } from "@/components/ui/SearchBar";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useHospitals } from "@/hooks/use-hospitals";

type SortOption = "recommended" | "rating" | "doctors" | "name";

export default function HospitalsScreen() {
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [refreshing, setRefreshing] = useState(false);
  const { hospitals, loading, error, refetch } = useHospitals();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setSelectedDepartment(null);
    setOnlineOnly(false);
    setAvailableOnly(false);
    setTopRatedOnly(false);
    setSortBy("recommended");
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    selectedDepartment ||
    onlineOnly ||
    availableOnly ||
    topRatedOnly ||
    sortBy !== "recommended",
  );

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => {
      (h.departments || []).forEach((d) => {
        if (d && d.length > 2) set.add(d);
      });
    });
    return Array.from(set).sort();
  }, [hospitals]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = hospitals;

    if (query) {
      list = list.filter((hospital) =>
        [
          hospital.name,
          hospital.slug,
          hospital.location?.address,
          hospital.location?.city,
          hospital.location?.state,
          ...(hospital.departments || []),
          ...(hospital.specializations || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (selectedDepartment) {
      const target = selectedDepartment.toLowerCase();
      list = list.filter((h) =>
        (h.departments || []).some((d) => {
          const dl = d.toLowerCase();
          return dl.includes(target) || target.includes(dl);
        }),
      );
    }

    if (onlineOnly) {
      list = list.filter((h) => h.onlineConsultationAvailable);
    }

    if (availableOnly) {
      list = list.filter((h) => (h.availableDoctorCount || 0) > 0);
    }

    if (topRatedOnly) {
      list = list.filter((h) => (h.rating || 0) >= 4.5);
    }

    if (sortBy === "rating") {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "doctors") {
      list = [...list].sort(
        (a, b) => (b.doctorCount || 0) - (a.doctorCount || 0),
      );
    } else if (sortBy === "name") {
      list = [...list].sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
    }

    return list;
  }, [
    hospitals,
    search,
    selectedDepartment,
    onlineOnly,
    availableOnly,
    topRatedOnly,
    sortBy,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <DrawerToggleButton />
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Explore Hospitals</Text>
            <Text style={styles.subtitle}>
              {loading
                ? "Loading hospitals..."
                : `${filtered.length} of ${hospitals.length} verified hospitals in Ahmedabad, Gujarat`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search hospital, city, department, specialty..."
        />
      </View>

      {/* Filter Pills Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {/* Online OPD Filter */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setOnlineOnly((prev) => !prev)}
            style={({ pressed }) => [
              styles.filterPill,
              onlineOnly && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="videocam-outline"
              size={15}
              color={onlineOnly ? Palette.white : Palette.text}
            />
            <Text
              style={[
                styles.filterPillText,
                onlineOnly && styles.filterPillTextActive,
              ]}
            >
              Video OPD
            </Text>
          </Pressable>

          {/* Available Doctors Filter */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAvailableOnly((prev) => !prev)}
            style={({ pressed }) => [
              styles.filterPill,
              availableOnly && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={15}
              color={availableOnly ? Palette.white : Palette.text}
            />
            <Text
              style={[
                styles.filterPillText,
                availableOnly && styles.filterPillTextActive,
              ]}
            >
              Doctors Available
            </Text>
          </Pressable>

          {/* Top Rated (4.5+) Filter */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setTopRatedOnly((prev) => !prev)}
            style={({ pressed }) => [
              styles.filterPill,
              topRatedOnly && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="star"
              size={14}
              color={topRatedOnly ? Palette.white : Palette.gold}
            />
            <Text
              style={[
                styles.filterPillText,
                topRatedOnly && styles.filterPillTextActive,
              ]}
            >
              Top Rated (4.5+)
            </Text>
          </Pressable>

          {/* Sort By Toggle */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const options: SortOption[] = [
                "recommended",
                "rating",
                "doctors",
                "name",
              ];
              const nextIndex = (options.indexOf(sortBy) + 1) % options.length;
              setSortBy(options[nextIndex]);
            }}
            style={({ pressed }) => [
              styles.filterPill,
              sortBy !== "recommended" && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="swap-vertical"
              size={14}
              color={sortBy !== "recommended" ? Palette.white : Palette.text}
            />
            <Text
              style={[
                styles.filterPillText,
                sortBy !== "recommended" && styles.filterPillTextActive,
              ]}
            >
              Sort:{" "}
              {sortBy === "rating"
                ? "Rating"
                : sortBy === "doctors"
                  ? "Doctors"
                  : sortBy === "name"
                    ? "A-Z"
                    : "Default"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Department Quick Filter Pills */}
      {availableDepartments.length > 0 ? (
        <View style={styles.departmentBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.departmentPillsContainer}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedDepartment(null)}
              style={({ pressed }) => [
                styles.deptPill,
                selectedDepartment === null && styles.deptPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.deptPillText,
                  selectedDepartment === null && styles.deptPillTextActive,
                ]}
              >
                All Departments
              </Text>
            </Pressable>
            {availableDepartments.map((dept) => {
              const isSelected = selectedDepartment === dept;
              return (
                <Pressable
                  key={dept}
                  accessibilityRole="button"
                  onPress={() =>
                    setSelectedDepartment(isSelected ? null : dept)
                  }
                  style={({ pressed }) => [
                    styles.deptPill,
                    isSelected && styles.deptPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.deptPillText,
                      isSelected && styles.deptPillTextActive,
                    ]}
                  >
                    {dept}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Active Filter Clear Bar */}
      {hasActiveFilters ? (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersLabel}>
            Filtered: {filtered.length} found
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={clearAllFilters}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="close-circle" size={14} color={Palette.primary} />
            <Text style={styles.resetBtnText}>Reset Filters</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <Loading label="Loading hospitals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? "No hospitals match current filters"
              : "No hospitals available"
          }
          message={
            hasActiveFilters
              ? "Try resetting your search or clearing department/feature filters to see all 7 accredited hospitals."
              : "Please check back later — new hospitals are added regularly."
          }
          action={
            hasActiveFilters ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearAllFilters}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.clearButtonText}>Reset All Filters</Text>
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <FlatList
          data={filtered}
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
          ListFooterComponent={<View style={{ height: Spacing.xxl }} />}
        />
      )}
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
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  filterBar: {
    paddingVertical: Spacing.xs,
  },
  filterPillsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    alignItems: "center",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterPillText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: Palette.white,
  },
  departmentBar: {
    paddingVertical: Spacing.xs,
  },
  departmentPillsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    alignItems: "center",
  },
  deptPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  deptPillActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  deptPillText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "500",
  },
  deptPillTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  activeFiltersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  activeFiltersLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  resetBtnText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  separator: {
    height: Spacing.lg,
  },
  clearButton: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    alignSelf: "stretch",
  },
  clearButtonText: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
