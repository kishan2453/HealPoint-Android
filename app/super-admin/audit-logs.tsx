/**
 * HealPoint - Super Admin · Audit Logs.
 *
 * Real security/audit trail aggregated across every admin account from
 * GET /user/admin/audit-logs (logins, logouts, password changes, profile
 * updates). The backend only exposes sanitised activity records — never
 * passwords, tokens or raw documents.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import { getAuditLogs, type AuditLogEntry } from '@/services/users';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  login_success: 'log-in-outline',
  login_failed: 'warning-outline',
  logout: 'log-out-outline',
  profile_update: 'person-outline',
  password_change: 'key-outline',
};

const TYPE_ACCENT: Record<string, string> = {
  login_success: '#2E9E5B',
  login_failed: '#D9435B',
  logout: '#5F6F6C',
  profile_update: '#2F80ED',
  password_change: '#E89A3C',
};

export default function AuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getAuditLogs({ limit: 100 });
      setLogs(res.logs || []);
      setTotal(res.totalCount || 0);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load audit logs.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen
      title="Audit Logs"
      subtitle={`${total} recorded event(s)`}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${item.id}-${item.createdAt}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState title="No audit events yet" message="Admin activity will appear here once recorded." />
          ) : null
        }
        renderItem={({ item }) => {
          const icon = TYPE_ICON[item.type || ''] || 'ellipse-outline';
          const accent = TYPE_ACCENT[item.type || ''] || Palette.textMuted;
          return (
            <Card style={styles.row}>
              <View style={[styles.iconCircle, { backgroundColor: `${accent}1F` }]}>
                <Ionicons name={icon} size={18} color={accent} />
              </View>
              <View style={styles.rowTexts}>
                <View style={styles.rowHeader}>
                  <Text style={styles.title} numberOfLines={1}>{item.title || 'Activity'}</Text>
                  <Text style={styles.meta}>{formatISODate(item.createdAt)}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>{item.message || ''}</Text>
                <Text style={styles.admin} numberOfLines={1}>
                  {item.adminName || 'Admin'} · {item.adminEmail || ''} · {item.adminRole || ''}
                  {item.browser ? ` · ${item.browser}` : ''}
                  {item.device ? ` · ${item.device}` : ''}
                </Text>
              </View>
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </AdminModuleScreen>
  );
}
const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  separator: { height: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowTexts: { flex: 1, gap: 3 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600', flex: 1 },
  message: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20 },
  admin: { ...Typography.caption, color: Palette.textMuted },
  meta: { ...Typography.caption, color: Palette.textMuted },
});
