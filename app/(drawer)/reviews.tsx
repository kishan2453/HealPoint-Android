/**
 * HealPoint - Patient · Reviews & Ratings Hub.
 *
 * Real, backend-driven review management:
 *  - "My Reviews": Reviews submitted by the logged-in patient, linked to their
 *    completed appointments and doctors, with real deletion and ownership check.
 *  - "Community Feedback": Real published reviews across the platform, with
 *    5-star distribution, average rating calculation, and search filtering.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDoctorName, formatISODate } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import {
  deleteMyReview,
  getMyReviews,
  getPublicReviews,
} from "@/services/reviews";
import type { Review } from "@/types";

type ReviewTab = "my" | "community";

function reviewerName(review: Review): string {
  if (review.name && String(review.name).trim()) return review.name;
  const patient = review.patientId;
  if (
    patient &&
    typeof patient === "object" &&
    typeof patient.name === "string" &&
    patient.name.trim()
  ) {
    return patient.name;
  }
  return "Verified Patient";
}

function reviewerInitial(review: Review): string {
  return reviewerName(review).trim().charAt(0).toUpperCase() || "P";
}

function doctorNameOf(review: Review): string {
  const raw =
    review.doctorName ||
    (review.doctorId &&
    typeof review.doctorId === "object" &&
    typeof review.doctorId.name === "string"
      ? review.doctorId.name
      : null);
  return formatDoctorName(raw, "Doctor");
}

function doctorSpecialtyOf(review: Review): string | null {
  const doctor = review.doctorId;
  if (doctor && typeof doctor === "object" && "speciality" in doctor) {
    return (doctor as { speciality?: string }).speciality || null;
  }
  return null;
}

function hospitalNameOf(review: Review): string | null {
  if (review.hospitalName && String(review.hospitalName).trim()) {
    return review.hospitalName;
  }
  const hospital = review.hospitalId;
  if (
    hospital &&
    typeof hospital === "object" &&
    "name" in hospital &&
    typeof (hospital as { name?: string }).name === "string"
  ) {
    return (hospital as { name?: string }).name || null;
  }
  const doctor = review.doctorId;
  if (
    doctor &&
    typeof doctor === "object" &&
    "hospitalName" in doctor &&
    typeof (doctor as { hospitalName?: string }).hospitalName === "string"
  ) {
    return (doctor as { hospitalName?: string }).hospitalName || null;
  }
  return null;
}

interface ReviewSummary {
  average: number;
  total: number;
  distribution: { stars: number; count: number }[];
}

function buildSummary(reviews: Review[]): ReviewSummary {
  const counts = [0, 0, 0, 0, 0];
  if (reviews.length === 0) return { average: 0, total: 0, distribution: [] };
  reviews.forEach((review) => {
    const star = Math.min(
      5,
      Math.max(1, Math.round(Number(review.rating) || 0)),
    );
    counts[5 - star] += 1;
  });
  const total = reviews.length;
  const sum = reviews.reduce(
    (acc, review) => acc + (Number(review.rating) || 0),
    0,
  );
  const average = Math.round((sum / total) * 10) / 10;
  return {
    average,
    total,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[5 - stars],
    })),
  };
}

export default function ReviewsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewTab>("my");
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [communityReviews, setCommunityReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [myRes, pubRes] = await Promise.allSettled([
        getMyReviews(),
        getPublicReviews(),
      ]);

      if (myRes.status === "fulfilled") {
        setMyReviews(myRes.value.reviews || []);
      }
      if (pubRes.status === "fulfilled") {
        setCommunityReviews(
          (pubRes.value.reviews || []).filter(
            (r) => r && !r.isHidden && r.isApproved !== false,
          ),
        );
      }
      if (myRes.status === "rejected" && pubRes.status === "rejected") {
        setError("Unable to load reviews. Please check your connection.");
      }
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load reviews."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useScreenFocus(() => {
    load();
  });

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteMyReview(deletingId);
      setMyReviews((prev) => prev.filter((r) => r._id !== deletingId));
      setDeletingId(null);
    } catch (err) {
      setError(toErrorMessage(err, "Failed to delete review."));
    } finally {
      setIsDeleting(false);
    }
  };

  const summary = useMemo(
    () => buildSummary(communityReviews),
    [communityReviews],
  );

  const filteredCommunity = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communityReviews;
    return communityReviews.filter((review) => {
      const doctor = doctorNameOf(review).toLowerCase();
      const reviewer = reviewerName(review).toLowerCase();
      const comment = (review.comment || "").toLowerCase();
      return doctor.includes(q) || reviewer.includes(q) || comment.includes(q);
    });
  }, [communityReviews, query]);

  const distributionMax = Math.max(
    1,
    ...summary.distribution.map((d) => d.count),
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.safe}>
        <DrawerHeader
          title="Reviews & Ratings"
          subtitle="Patient Feedback Hub"
        />
        <Loading label="Loading reviews..." />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Reviews & Ratings"
        subtitle={
          activeTab === "my"
            ? `${myReviews.length} submitted review${myReviews.length === 1 ? "" : "s"}`
            : `${summary.total} verified patient feedback`
        }
      />

      {/* Segmented Tab Bar */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "my" }}
            onPress={() => setActiveTab("my")}
            style={[styles.tabBtn, activeTab === "my" && styles.tabBtnActive]}
          >
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={activeTab === "my" ? Palette.white : Palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "my" && styles.tabTextActive,
              ]}
            >
              My Reviews ({myReviews.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "community" }}
            onPress={() => setActiveTab("community")}
            style={[
              styles.tabBtn,
              activeTab === "community" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={
                activeTab === "community" ? Palette.white : Palette.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "community" && styles.tabTextActive,
              ]}
            >
              Community Feedback ({communityReviews.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <ErrorState message={error} onRetry={() => load()} />
        </View>
      ) : null}

      {/* Tab 1: MY REVIEWS */}
      {activeTab === "my" ? (
        <FlatList
          data={myReviews}
          keyExtractor={(item) => String(item._id || item.createdAt)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Palette.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No reviews submitted yet"
              message="When you complete a doctor consultation, you can share your feedback and ratings here."
              action={
                <Button
                  title="View Appointments"
                  icon="calendar-outline"
                  onPress={() => router.push("/(drawer)/appointments")}
                />
              }
            />
          }
          renderItem={({ item }) => {
            const rating = Math.round(Number(item.rating) || 0);
            const specialty = doctorSpecialtyOf(item);
            const hospital = hospitalNameOf(item);
            return (
              <Card style={styles.myReviewCard}>
                <View style={styles.myReviewHeader}>
                  <View style={styles.doctorInfoCol}>
                    <Text style={styles.doctorName}>{doctorNameOf(item)}</Text>
                    {specialty ? (
                      <Text style={styles.doctorSpecialty}>{specialty}</Text>
                    ) : null}
                    {hospital ? (
                      <Text style={styles.hospitalName}>
                        <Ionicons
                          name="business-outline"
                          size={12}
                          color={Palette.textMuted}
                        />{" "}
                        {hospital}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.ratingBox}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= rating ? "star" : "star-outline"}
                          size={15}
                          color={Palette.gold}
                        />
                      ))}
                    </View>
                    <Text style={styles.numericRating}>{rating}.0</Text>
                  </View>
                </View>

                {item.title ? (
                  <Text style={styles.reviewTitle}>{item.title}</Text>
                ) : null}

                <Text style={styles.reviewComment}>{item.comment}</Text>

                {/* Consultation tags */}
                {item.tags && item.tags.length > 0 ? (
                  <View style={styles.tagChipsWrap}>
                    {item.tags.map((t) => (
                      <View key={t} style={styles.tagPill}>
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={Palette.primaryDark}
                        />
                        <Text style={styles.tagPillText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Footer with date and delete option */}
                <View style={styles.myReviewFooter}>
                  <Text style={styles.dateText}>
                    {item.createdAt
                      ? `Reviewed on ${formatISODate(item.createdAt)}`
                      : "Verified Patient Review"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete review"
                    onPress={() => item._id && setDeletingId(item._id)}
                    style={({ pressed }) => [
                      styles.deleteBtn,
                      pressed && styles.deleteBtnPressed,
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={15}
                      color={Palette.error}
                    />
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        /* Tab 2: COMMUNITY REVIEWS */
        <FlatList
          data={filteredCommunity}
          keyExtractor={(item) => String(item._id || item.createdAt)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Palette.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.communityHeader}>
              <Card style={styles.summaryCard}>
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryRating}>
                    {summary.total ? summary.average.toFixed(1) : "—"}
                  </Text>
                  <View style={styles.summaryStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={
                          star <= Math.round(summary.average)
                            ? "star"
                            : "star-outline"
                        }
                        size={20}
                        color={Palette.gold}
                      />
                    ))}
                  </View>
                  <Text style={styles.summaryCount}>
                    {summary.total
                      ? `Based on ${summary.total} verified review${summary.total === 1 ? "" : "s"}`
                      : "No reviews yet"}
                  </Text>
                </View>

                {summary.distribution.length > 0 ? (
                  <View style={styles.distribution}>
                    {summary.distribution.map((row) => (
                      <View key={row.stars} style={styles.distRow}>
                        <Text style={styles.distLabel}>{row.stars}★</Text>
                        <View style={styles.distTrack}>
                          <View
                            style={[
                              styles.distFill,
                              {
                                width: `${Math.round((row.count / distributionMax) * 100)}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.distCount}>{row.count}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>

              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search reviews by doctor or specialty..."
              />

              <View style={styles.hintRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.hint}>
                  All reviews are submitted by verified patients following
                  completed appointments.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title={query ? "No matching reviews" : "No public reviews"}
              message={
                query
                  ? "Try searching with a different doctor or keyword."
                  : "Verified reviews will appear here as patients complete consultations."
              }
            />
          }
          renderItem={({ item }) => {
            const rating = Math.round(Number(item.rating) || 0);
            return (
              <Card style={styles.communityReviewCard}>
                <View style={styles.rowHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {reviewerInitial(item)}
                    </Text>
                  </View>
                  <View style={styles.rowTitles}>
                    <Text style={styles.reviewer} numberOfLines={1}>
                      {reviewerName(item)}
                    </Text>
                    <Text style={styles.doctor} numberOfLines={1}>
                      <Ionicons
                        name="medkit-outline"
                        size={12}
                        color={Palette.primary}
                      />{" "}
                      {doctorNameOf(item)}
                    </Text>
                  </View>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= rating ? "star" : "star-outline"}
                        size={14}
                        color={Palette.gold}
                      />
                    ))}
                  </View>
                </View>

                {item.title ? (
                  <Text style={styles.reviewTitle}>{item.title}</Text>
                ) : null}
                <Text style={styles.comment}>{item.comment}</Text>
                <Text style={styles.date}>{formatISODate(item.createdAt)}</Text>
              </Card>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        visible={Boolean(deletingId)}
        title="Delete Review?"
        message="Are you sure you want to remove your review? This will also update the doctor's average rating."
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        tone="danger"
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
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
    paddingBottom: Spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Palette.primary,
  },
  tabText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  errorBanner: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.md,
  },
  communityHeader: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    gap: Spacing.lg,
  },
  summaryMain: {
    gap: Spacing.sm,
    alignItems: "center",
  },
  summaryRating: {
    ...Typography.h1,
    color: Palette.text,
    fontSize: 34,
    fontWeight: "800",
  },
  summaryStars: {
    flexDirection: "row",
    gap: 3,
  },
  summaryCount: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  distribution: {
    gap: Spacing.xs,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  distLabel: {
    ...Typography.caption,
    color: Palette.text,
    width: 28,
    fontWeight: "600",
  },
  distTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    overflow: "hidden",
  },
  distFill: {
    height: "100%",
    borderRadius: Radius.pill,
    backgroundColor: Palette.gold,
  },
  distCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    width: 24,
    textAlign: "right",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  hint: {
    flex: 1,
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
  },
  myReviewCard: {
    gap: Spacing.sm,
  },
  myReviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  doctorInfoCol: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    ...Typography.h4,
    color: Palette.text,
    fontWeight: "700",
    fontSize: 16,
  },
  doctorSpecialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  hospitalName: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  ratingBox: {
    alignItems: "flex-end",
    gap: 2,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  numericRating: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "700",
  },
  reviewTitle: {
    ...Typography.label,
    color: Palette.text,
    fontWeight: "700",
    marginTop: 2,
  },
  reviewComment: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  tagChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.xs,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.16)",
  },
  tagPillText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontSize: 11,
    fontWeight: "600",
  },
  myReviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dateText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteBtnPressed: {
    opacity: 0.6,
  },
  deleteText: {
    ...Typography.caption,
    color: Palette.error,
    fontWeight: "600",
  },
  communityReviewCard: {
    gap: Spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...Typography.label,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  rowTitles: {
    flex: 1,
    gap: 1,
  },
  reviewer: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "600",
  },
  doctor: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  comment: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 20,
  },
  date: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
});
