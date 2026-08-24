/**
 * HealPoint - Super Admin · Reviews.
 * Real platform review list from GET /review/get-all?platform=1.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import * as reviewService from '@/services/reviews';
import type { Review } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Hidden', value: 'hidden' },
];

function reviewBadge(review: Review) {
  if (review.isHidden) return <Badge label="Hidden" variant="neutral" />;
  if (review.isApproved) return <Badge label="Approved" variant="success" />;
  return <Badge label="Pending" variant="warning" />;
}

export default function SuperAdminReviewsScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reviewService.getAllAdminReviews({
        platform: true,
        search: query.trim() || undefined,
        status: filter,
        limit: 100,
      });
      setReviews(res.reviews || []);
      setTotal(res.totalCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen title="Reviews" subtitle={`${total} review(s)`} loading={loading} error={error} onRetry={load}>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={(text) => { setQuery(text); load(); }} placeholder="Search reviews..." />
      </View>
      <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={(value) => { setFilter(value); load(); }} />
      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No reviews found" message="Reviews will appear here once patients share feedback." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Anonymous'}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {typeof item.doctorId === 'object' && item.doctorId?.name ? item.doctorId.name : item.doctorName || 'Doctor'}
                </Text>
              </View>
              {reviewBadge(item)}
            </View>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= Math.round(item.rating || 0) ? 'star' : 'star-outline'}
                  size={16}
                  color="#F2B705"
                />
              ))}
              <Text style={styles.rating}>{item.rating || '—'} / 5</Text>
            </View>
            {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
            <Text style={styles.comment} numberOfLines={4}>{item.comment}</Text>
            <Text style={styles.meta}>
              {formatISODate(item.createdAt)}
            </Text>
          </Card>
        )}
        />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  title: { ...Typography.label, color: Palette.text },
  stars: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  rating: { ...Typography.caption, color: Palette.textMuted, marginLeft: Spacing.xs },
  comment: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20 },
  meta: { ...Typography.caption, color: Palette.textMuted },
});