/**
 * HealPoint - Hospital Admin · Video Guides.
 * Structured interactive training & workflow video guides for hospital staff.
 * Fetches real platform-configured videos from /hospital-admin/video-guides.
 */
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AdminModuleScreen } from "@/components/admin/AdminModuleScreen";
import { FilterChips } from "@/components/admin/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { toErrorMessage } from "@/services/api";
import * as adminService from "@/services/admin";
import type { HospitalVideoGuide } from "@/services/admin";

const CATEGORY_CHIPS = [
  { label: "All Guides", value: "all" },
  { label: "Patient Guide", value: "Patient Guide" },
  { label: "Doctor Operations", value: "Doctor Operations" },
  { label: "Scheduling", value: "Scheduling" },
  { label: "Departments", value: "Departments" },
  { label: "Quality & Reviews", value: "Quality & Reviews" },
];

export default function AdminVideoGuideScreen() {
  const [guides, setGuides] = useState<HospitalVideoGuide[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeGuide, setActiveGuide] = useState<HospitalVideoGuide | null>(
    null,
  );

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await adminService.getHospitalVideoGuides();
      setGuides(res.guides || []);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load video guides."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Open / play video
  const handlePlay = (guide: HospitalVideoGuide) => {
    setActiveGuide(guide);
  };

  const openInBrowser = async (url?: string) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.warn("Cannot open video URL:", err);
    }
  };

  // Filter guides by category and search term
  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      if (categoryFilter !== "all") {
        if ((g.category || "").toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (g.title || "").toLowerCase();
        const desc = (g.description || "").toLowerCase();
        const tags = (g.tags || []).join(" ").toLowerCase();
        return title.includes(q) || desc.includes(q) || tags.includes(q);
      }
      return true;
    });
  }, [guides, categoryFilter, searchQuery]);

  return (
    <AdminModuleScreen
      title="Video Guides & Tutorials"
      subtitle="Interactive workflow walkthroughs and staff training"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={filteredGuides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Search Input */}
            <Input
              placeholder="Search guides by title, category, or topic..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon="search-outline"
              containerStyle={styles.searchInput}
            />

            {/* Category Filter Chips */}
            <FilterChips
              options={CATEGORY_CHIPS}
              selected={categoryFilter}
              onSelect={setCategoryFilter}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No video guides found"
            message={
              searchQuery || categoryFilter !== "all"
                ? 'Try adjusting your search query or selecting "All Guides".'
                : "Platform training videos will appear here."
            }
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.videoCard}>
            {/* Thumbnail / Media Header */}
            <Pressable
              style={styles.thumbnailContainer}
              onPress={() => handlePlay(item)}
              accessibilityLabel={`Play ${item.title}`}
            >
              <View style={styles.thumbnailPlaceholder}>
                <View style={styles.playCircle}>
                  <Ionicons
                    name="play"
                    size={26}
                    color="#FFF"
                    style={{ marginLeft: 2 }}
                  />
                </View>
              </View>

              {/* Badges Over Thumbnail */}
              <View style={styles.thumbnailBadgesRow}>
                <Badge label={item.category || "Guide"} variant="primary" />
                {item.duration ? (
                  <View style={styles.durationChip}>
                    <Ionicons name="time-outline" size={12} color="#FFF" />
                    <Text style={styles.durationText}>{item.duration}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>

            {/* Content Details */}
            <View style={styles.cardBody}>
              <Text style={styles.videoTitle}>{item.title}</Text>
              <Text style={styles.videoDescription} numberOfLines={3}>
                {item.description}
              </Text>

              {/* Tags Row */}
              {item.tags && item.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {item.tags.map((tag) => (
                    <View key={tag} style={styles.tagChip}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.cardActions}>
                <Button
                  title="Watch Guide"
                  icon="play-circle-outline"
                  variant="primary"
                  fullWidth={false}
                  style={styles.watchBtn}
                  onPress={() => handlePlay(item)}
                />
                {item.videoUrl && item.videoUrl.startsWith("http") ? (
                  <Button
                    title="Open Video Link"
                    icon="open-outline"
                    variant="outline"
                    fullWidth={false}
                    style={styles.linkBtn}
                    onPress={() => openInBrowser(item.videoUrl)}
                  />
                ) : null}
              </View>
            </View>
          </Card>
        )}
      />

      {/* Video Guide Player Modal */}
      <Modal
        visible={Boolean(activeGuide)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveGuide(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveGuide(null)}
            accessibilityLabel="Close player"
          />
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalCategory}>
                  {activeGuide?.category}
                </Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {activeGuide?.title}
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setActiveGuide(null)}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {/* Simulated Player / Media Display */}
            <View style={styles.playerContainer}>
              <View style={styles.playerScreen}>
                <Ionicons name="videocam" size={48} color={Palette.primary} />
                <Text style={styles.playerStatusText}>
                  {activeGuide?.videoUrl
                    ? "Ready to stream guide video"
                    : "Video content coming soon"}
                </Text>
                {activeGuide?.duration ? (
                  <Text style={styles.playerDurationText}>
                    Duration: {activeGuide.duration}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Description */}
            <Text style={styles.modalDescription}>
              {activeGuide?.description}
            </Text>

            {/* Direct Play / Stream Actions */}
            <View style={styles.modalActions}>
              {activeGuide?.videoUrl &&
              activeGuide.videoUrl.startsWith("http") ? (
                <Button
                  title="Stream Video in Browser"
                  icon="open-outline"
                  variant="primary"
                  onPress={() => {
                    openInBrowser(activeGuide.videoUrl);
                    setActiveGuide(null);
                  }}
                />
              ) : null}
              <Button
                title="Done"
                variant="outline"
                onPress={() => setActiveGuide(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  headerContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    marginVertical: Spacing.xxs,
  },
  videoCard: {
    padding: 0,
    overflow: "hidden",
    borderRadius: Radius.lg,
    gap: 0,
  },
  thumbnailContainer: {
    width: "100%",
    height: 150,
    backgroundColor: "#1E293B",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  thumbnailBadgesRow: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  durationText: {
    ...Typography.caption,
    color: "#FFF",
    fontWeight: "600",
  },
  cardBody: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  videoTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  videoDescription: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginVertical: Spacing.xxs,
  },
  tagChip: {
    backgroundColor: `${Palette.primary}12`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  tagText: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  watchBtn: {
    flex: 1,
    minHeight: 38,
  },
  linkBtn: {
    flex: 1,
    minHeight: 38,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: "85%",
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  modalTitleGroup: {
    flex: 1,
    gap: 2,
  },
  modalCategory: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  modalCloseBtn: {
    padding: Spacing.xxs,
  },
  playerContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#0F172A",
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  playerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  playerStatusText: {
    ...Typography.bodySmall,
    color: "#FFF",
    fontWeight: "600",
  },
  playerDurationText: {
    ...Typography.caption,
    color: "rgba(255, 255, 255, 0.6)",
  },
  modalDescription: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 22,
  },
  modalActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
