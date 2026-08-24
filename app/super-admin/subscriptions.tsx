/**
 * HealPoint - Super Admin · Subscriptions.
 * Real subscription data from the subscription API: overview + searchable,
 * filterable, paginated subscription table for every hospital.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { SubscriptionRow } from '@/components/admin/SubscriptionRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as subscriptionService from '@/services/subscriptions';
import type { Subscription, SubscriptionOverview, SubscriptionPlan } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Trial', value: 'trial' },
  { label: 'Past due', value: 'past_due' },
  { label: 'Expired', value: 'expired' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Suspended', value: 'suspended' },
];

const SORTS = [
  { label: 'Renewal', value: 'renewal' },
  { label: 'Amount', value: 'amount' },
  { label: 'Hospital', value: 'hospital' },
];

export default function SuperAdminSubscriptionsScreen() {
  const router = useRouter();
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [items, setItems] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [sort, setSort] = useState<'renewal' | 'amount' | 'hospital' | 'recent'>('renewal');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const [overviewRes, plansRes] = await Promise.all([
        subscriptionService.getSubscriptionOverview(),
        subscriptionService.getPlans(),
      ]);
      setOverview(overviewRes.overview);
      setPlans(plansRes.plans || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load subscription overview.'));
    }
  }, []);

  const loadList = useCallback(
    async (nextPage = 1, append = false) => {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const res = await subscriptionService.getSubscriptions({
          search: query.trim() || undefined,
          status,
          plan,
          sort,
          page: nextPage,
          limit: 15,
        });
        setItems(append ? (prev) => [...prev, ...res.subscriptions] : res.subscriptions);
        setTotal(res.totalCount);
        setPage(nextPage);
      } catch (err) {
        setError(toErrorMessage(err, 'Unable to load subscriptions.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, status, plan, sort],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadList(1);
  }, [loadList]);

  const onEndReached = () => {
    if (!loading && !loadingMore && items.length < total) loadList(page + 1, true);
  };

  const planOptions = [
    { label: 'All Plans', value: 'all' },
    ...plans.map((item) => ({ label: item.name, value: item.key })),
  ];

  return (
    <AdminModuleScreen
      title="Subscriptions"
      subtitle={`${total} hospital subscription(s)`}
      loading={loading}
      error={error}
      onRetry={() => {
        loadOverview();
        loadList(1);
      }}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.grid}>
              <StatCard label="Hospitals" value={overview?.totalHospitals ?? '—'} icon="business-outline" accent="#0E9F8E" />
              <StatCard label="Active" value={overview?.activeSubscriptions ?? '—'} icon="checkmark-done-outline" accent="#2E9E5B" />
              <StatCard label="Trial" value={overview?.trialCount ?? '—'} icon="flask-outline" accent="#2F80ED" />
              <StatCard label="Expired" value={overview?.expiredCount ?? '—'} icon="time-outline" accent="#D9435B" />
              <StatCard label="Cancelled" value={overview?.cancelledCount ?? '—'} icon="close-circle-outline" accent="#5F6F6C" />
              <StatCard label="Revenue" value={formatINR(overview?.revenue)} icon="wallet-outline" accent="#E89A3C" />
              <StatCard label="Paid Revenue" value={formatINR(overview?.paidRevenue)} icon="card-outline" accent="#2E9E5B" />
              <StatCard label="Expiring ≤30d" value={overview?.expiringCount ?? '—'} icon="alert-circle-outline" accent="#D9435B" />
            </View>

            <Card style={styles.renewalCard}>
              <Text style={styles.sectionTitle}>Upcoming renewals</Text>
              {(overview?.upcomingRenewals || []).length === 0 ? (
                <Text style={styles.muted}>No upcoming renewals in the next 60 days.</Text>
              ) : (
                (overview?.upcomingRenewals || []).slice(0, 5).map((item) => (
                  <View key={String(item.hospitalId)} style={styles.renewalRow}>
                    <View style={styles.renewalTexts}>
                      <Text style={styles.renewalName} numberOfLines={1}>{item.hospitalName || 'Hospital'}</Text>
                      <Text style={styles.renewalPlan}>{item.planName || item.planKey} · {formatINR(item.amount)}</Text>
                    </View>
                    <Text style={styles.renewalDate}>{formatISODate(item.expiryDate)}</Text>
                  </View>
                ))
              )}

              <Button
                title="Manage Plans"
                variant="secondary"
                fullWidth={false}
                icon="pricetags-outline"
                style={styles.plansButton}
                onPress={() => router.push('/super-admin/plans')}
              />
            </Card>

            <View style={styles.searchWrap}>
              <SearchBar
                value={query}
                onChangeText={(text) => { setQuery(text); loadList(1); }}
                placeholder="Search hospital or plan..."
              />
            </View>
            <FilterChips options={STATUS_FILTERS} selected={status} onSelect={(value) => { setStatus(value); loadList(1); }} />
            <FilterChips options={planOptions} selected={plan} onSelect={(value) => { setPlan(value); loadList(1); }} />
            <FilterChips options={SORTS} selected={sort} onSelect={(value) => { setSort(value as 'renewal' | 'amount' | 'hospital' | 'recent'); loadList(1); }} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState title="No subscriptions" message="Hospitals will appear here once the platform has subscriptions." />
          ) : null
        }
        renderItem={({ item }) => (
          <SubscriptionRow
            item={item}
            onPress={() => router.push(`/super-admin/subscription/${item._id}` as never)}
          />
        )}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Palette.primary} style={styles.footer} /> : null
        }
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { gap: Spacing.md, marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  renewalCard: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.text },
  renewalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  renewalTexts: { flex: 1, gap: 2 },
  renewalName: { ...Typography.bodyMedium, color: Palette.text, flexShrink: 1 },
  renewalPlan: { ...Typography.caption, color: Palette.textMuted },
  renewalDate: { ...Typography.label, color: Palette.text },
  plansButton: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingBottom: Spacing.xxxl, gap: Spacing.md },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  footer: { paddingVertical: Spacing.lg },
});