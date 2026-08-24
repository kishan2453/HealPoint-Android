/**
 * HealPoint - Super Admin · Users.
 * Real platform users from GET /user/admin/users (sanitized server-side).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import * as userService from '@/services/users';
import type { PlatformUser } from '@/types';

const ROLE_FILTERS = [
  { label: 'All Users', value: 'all' },
  { label: 'Patients', value: 'patient' },
  { label: 'Hospital Admins', value: 'hospital-admin' },
  { label: 'Super Admins', value: 'super-admin' },
];

function roleLabel(user: PlatformUser): string {
  if (user.isAdmin) return user.role === 'Super Admin' ? 'Super Admin' : 'Hospital Admin';
  return 'Patient';
}

export default function SuperAdminUsersScreen() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const res = await userService.getPlatformUsers({
          search: query.trim() || undefined,
          role: role === 'all' ? undefined : role,
          page: nextPage,
          limit: 30,
        });
        setUsers(append ? (prev) => [...prev, ...res.users] : res.users);
        setTotal(res.totalCount);
        setPage(nextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load users.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, role],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const onEndReached = () => {
    if (!loading && !loadingMore && users.length < total) load(page + 1, true);
  };

  return (
    <AdminModuleScreen
      title="Users"
      subtitle={`${total} account(s)`}
      loading={loading}
      error={error}
      onRetry={() => load(1)}
    >
      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            load(1);
          }}
          placeholder="Search name, email or phone..."
        />
      </View>
      <FilterChips options={ROLE_FILTERS} selected={role} onSelect={(value) => { setRole(value); load(1); }} />
      <FlatList
        data={users}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          !loading ? (
            <EmptyState title="No users found" message="Try a different search or filter." />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
              <StatusBadge value={item.isActive === false ? 'inactive' : roleLabel(item)} />
            </View>
            <Text style={styles.muted}>{item.email || 'No email'}</Text>
            {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
            <Text style={styles.meta}>
              {roleLabel(item)} · Joined {formatISODate(item.createdAt)}
            </Text>
          </Card>
        )}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Palette.primary} style={styles.footer} /> : null
        }
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { ...Typography.h4, color: Palette.text, flexShrink: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  meta: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.xs },
  footer: { paddingVertical: Spacing.lg },
});