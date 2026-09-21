/**
 * HealPoint - Hospital Admin · Reviews & Ratings Management Screen.
 * Real reviews from MongoDB scoped to this hospital's doctors.
 * Includes rating analytics score card, 5-star breakdown bars,
 * search, star & status filters, approve/pending toggle, hide/unhide, and delete.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { formatISODate } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as reviewsService from "@/services/reviews";
import type { Review } from "@/types";

const STATUS_FILTERS = [
  { label: "All Reviews", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Hidden", value: "hidden" },
];

const STAR_FILTERS = [
  { label: "All Stars", value: "all" },
  { label: "5 ★", value: "5" },
  { label: "4 ★", value: "4" },
  { label: "3 ★", value: "3" },
  { label: "2 ★", value: "2" },
  { label: "1 ★", value: "1" },
];

export default function AdminReviewsScreen() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [starFilter, setStarFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError("");
      try {
        const res = await reviewsService.getAllAdminReviews({
          status: statusFilter !== "all" ? statusFilter : undefined,
        });
        setReviews(res.reviews || []);
      } catch (err) {
        setError(toErrorMessage(err, "Unable to load doctor reviews."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (
    review: Review,
    isApproved: boolean,
    isHidden: boolean,
  ) => {
    setActionId(String(review._id));
    try {
      await reviewsService.updateReviewStatus(String(review._id), {
        isApproved,
        isHidden,
      });
      setReviews((prev) =>
        prev.map((r) =>
          r._id === review._id ? { ...r, isApproved, isHidden } : r,
        ),
      );
    } catch (err) {
      setError(toErrorMessage(err, "Unable to update review status."));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await reviewsService.deleteReview(String(deleteTarget._id));
      setReviews((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to delete review."));
    } finally {
      setIsDeleting(false);
    }
  };

  // Analytics computed from real reviews
  const analytics = useMemo(() => {
    const total = reviews.length;
    if (total === 0)
      return { average: 0, total: 0, breakdown: {} as Record<number, number> };
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const average = Number((sum / total).toFixed(1));
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.round(r.rating || 5);
      if (breakdown[star] !== undefined) {
        breakdown[star]++;
      }
    });
    return { average, total, breakdown };
  }, [reviews]);

  // Client-side filtering by star and search query
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (starFilter !== "all") {
        const star = Math.round(r.rating || 5);
        if (String(star) !== starFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const patientName = String(r.name || "").toLowerCase();
        const docName = String(
          r.doctorName ||
            (typeof r.doctorId === "object" && r.doctorId?.name
              ? r.doctorId.name
              : ""),
        ).toLowerCase();
        const comment = String(r.comment || "").toLowerCase();
        const title = String(r.title || "").toLowerCase();
        return (
          patientName.includes(q) ||
          docName.includes(q) ||
          comment.includes(q) ||
          title.includes(q)
        );
      }
      return true;
    });
  }, [reviews, starFilter, searchQuery]);

  return (
    <AdminModuleScreen
      title="Reviews & Ratings"
      subtitle="Patient feedback on your hospital's doctors"
      allowedRoles={["admin"]}
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => String(item._id)}
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
            {/* Rating Overview Card */}
            <Card style={styles.metricsCard}>
              <View style={styles.metricsTop}>
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreNumber}>
                    {analytics.average > 0 ? analytics.average : "—"}
                  </Text>
                  <View style={styles.scoreStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={
                          star <= Math.round(analytics.average)
                            ? "star"
                            : "star-outline"
                        }
                        size={16}
                        color="#F2B705"
                      />
                    ))}
                  </View>
                  <Text style={styles.scoreCount}>
                    {analytics.total +
                      " " +
                      (analytics.total === 1 ? "Review" : "Total Reviews")}
                  </Text>
                </View>

                {/* Rating Breakdown Bars */}
                <View style={styles.breakdownContainer}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = analytics.breakdown[star] || 0;
                    const pct =
                      analytics.total > 0 ? (count / analytics.total) * 100 : 0;
                    return (
                      <View key={star} style={styles.barRow}>
                        <Text style={styles.barLabel}>{star}★</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${Math.round(pct)}%` as `${number}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.barCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* Search Input */}
            <Input
              placeholder="Search by patient, doctor, or keyword..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              leftIcon="search-outline"
              containerStyle={styles.searchInput}
            />

            {/* Status Filter Chips */}
            <FilterChips
              options={STATUS_FILTERS}
              selected={statusFilter}
              onSelect={setStatusFilter}
            />

            {/* Star Filter Chips */}
            <FilterChips
              options={STAR_FILTERS}
              selected={starFilter}
              onSelect={setStarFilter}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No reviews found"
            message={
              searchQuery || statusFilter !== "all" || starFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "Patient feedback for your hospital doctors will appear here."
            }
          />
        }
        renderItem={({ item }) => {
          const docName =
            item.doctorName ||
            (typeof item.doctorId === "object" && item.doctorId?.name
              ? item.doctorId.name
              : "Doctor");
          const speciality =
            typeof item.doctorId === "object" && item.doctorId?.speciality
              ? item.doctorId.speciality
              : "";

          return (
            <Card style={styles.reviewCard}>
              {/* Header: Patient info + Doctor & Status */}
              <View style={styles.cardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {item.name ? item.name.charAt(0).toUpperCase() : "P"}
                  </Text>
                </View>

                <View style={styles.cardTitles}>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {item.name || "Anonymous Patient"}
                  </Text>
                  <View style={styles.doctorInfoRow}>
                    <Ionicons
                      name="medkit-outline"
                      size={13}
                      color={Palette.primary}
                    />
                    <Text style={styles.doctorName} numberOfLines={1}>
                      {docName}
                      {speciality ? " · " + speciality : ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.badgeContainer}>
                  {item.isHidden ? (
                    <Badge label="Hidden" variant="neutral" />
                  ) : item.isApproved ? (
                    <Badge label="Approved" variant="success" />
                  ) : (
                    <Badge label="Pending" variant="warning" />
                  )}
                </View>
              </View>

              {/* Stars and Date */}
              <View style={styles.starsRow}>
                <View style={styles.starsGroup}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={
                        star <= Math.round(item.rating || 0)
                          ? "star"
                          : "star-outline"
                      }
                      size={15}
                      color="#F2B705"
                    />
                  ))}
                  <Text style={styles.ratingNumber}>
                    {(item.rating || "—") + " / 5"}
                  </Text>
                </View>
                <Text style={styles.dateText}>
                  {formatISODate(item.createdAt)}
                </Text>
              </View>

              {/* Review Title & Comment */}
              {item.title ? (
                <Text style={styles.reviewTitle}>{item.title}</Text>
              ) : null}
              <Text style={styles.commentText}>{item.comment}</Text>

              {/* Moderation Actions */}
              <View style={styles.cardActions}>
                <Button
                  title={item.isApproved ? "Move to pending" : "Approve"}
                  variant="secondary"
                  fullWidth={false}
                  style={styles.actionBtn}
                  loading={actionId === String(item._id)}
                  onPress={() =>
                    moderate(item, !Boolean(item.isApproved), false)
                  }
                />
                <Button
                  title={item.isHidden ? "Unhide" : "Hide"}
                  variant="outline"
                  fullWidth={false}
                  style={styles.actionBtn}
                  onPress={() =>
                    moderate(
                      item,
                      Boolean(item.isApproved),
                      !Boolean(item.isHidden),
                    )
                  }
                />
                <Pressable
                  style={styles.deleteIconBtn}
                  onPress={() => setDeleteTarget(item)}
                  accessibilityLabel="Delete review"
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={Palette.error}
                  />
                </Pressable>
              </View>
            </Card>
          );
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Review"
        message={
          'Are you sure you want to permanently delete the review from "' +
          (deleteTarget?.name || "this patient") +
          '"? This action cannot be undone.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep Review"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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
  metricsCard: {
    padding: Spacing.lg,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  metricsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  scoreContainer: {
    alignItems: "center",
    paddingRight: Spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Palette.border,
    minWidth: 100,
  },
  scoreNumber: {
    ...Typography.h1,
    color: Palette.text,
    lineHeight: 38,
  },
  scoreStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginVertical: Spacing.xxs,
  },
  scoreCount: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  breakdownContainer: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  barLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    width: 22,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Palette.border,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#F2B705",
    borderRadius: Radius.pill,
  },
  barCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    width: 20,
    textAlign: "right",
  },
  searchInput: {
    marginVertical: Spacing.xxs,
  },
  reviewCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary + "1F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  cardTitles: {
    flex: 1,
    gap: 2,
  },
  patientName: {
    ...Typography.h4,
    color: Palette.text,
  },
  doctorInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  doctorName: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  badgeContainer: {
    alignSelf: "flex-start",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  starsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingNumber: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginLeft: Spacing.xs,
  },
  dateText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  reviewTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  commentText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  actionBtn: {
    flex: 1,
    minHeight: 38,
  },
  deleteIconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Palette.error + "14",
    alignItems: "center",
    justifyContent: "center",
  },
});
