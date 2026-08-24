/**
 * HealPoint - Hospital Admin · Reviews.
 * Real reviews of this hospital's doctors (server-scoped). Approve / hide via
 * the review moderation endpoint.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as reviewService from '@/services/reviews';
import type { Review } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Hidden', value: 'hidden' },
];

export default function AdminReviewsScreen() {
  const [filter, setFilter] = useState('all');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reviewService.getAllAdminReviews({ search: undefined, status: filter, limit: 100 });
      setReviews(res.reviews || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load reviews.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (review: Review, isApproved?: boolean, isHidden?: boolean) => {
    setActionId(String(review._id));
    try {
      await reviewService.updateReviewStatus(String(review._id), { isApproved, isHidden });
      load();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to update review.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <AdminModuleScreen
      title="Reviews"
      subtitle="Feedback on your hospital's doctors"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={(value) => { setFilter(value); load(); }} />
      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No reviews found" message="Patient feedback for your doctors will appear here." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Anonymous'}</Text>
                <Text style={styles.muted} numberOfLines={1}>{item.doctorName || (typeof item.doctorId === 'object' && item.doctorId?.name ? item.doctorId.name : 'Doctor')}</Text>
              </View>
              {item.isHidden ? <Badge label="Hidden" variant="neutral" /> : item.isApproved ? <Badge label="Approved" variant="success" /> : <Badge label="Pending" variant="warning" />}
            </View>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name={star <= Math.round(item.rating || 0) ? 'star' : 'star-outline'} size={16} color="#F2B705" />
              ))}
              <Text style={styles.rating}>{item.rating || '—'} / 5</Text>
            </View>
            <Text style={styles.comment} numberOfLines={4}>{item.comment}</Text>
            <Text style={styles.meta}>{formatISODate(item.createdAt)}</Text>
            <View style={styles.actions}>
              <Button title={item.isApproved ? 'Move to pending' : 'Approve'} variant="secondary" fullWidth={false} style={styles.actionButton} loading={actionId === String(item._id)} onPress={() => moderate(item, !item.isApproved, false)} />
              <Button title={item.isHidden ? 'Unhide' : 'Hide'} variant="outline" fullWidth={false} style={styles.actionButton} onPress={() => moderate(item, item.isApproved, !item.isHidden)} />
            </View>
          </Card>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  stars: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  rating: { ...Typography.caption, color: Palette.textMuted, marginLeft: Spacing.xs },
  comment: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20 },
  meta: { ...Typography.caption, color: Palette.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1, minHeight: 44 },
});