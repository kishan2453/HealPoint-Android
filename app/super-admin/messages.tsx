/**
 * HealPoint - Super Admin · Messages.
 * Real contact messages from GET /webmessage/get-all.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as messageService from '@/services/messages';
import type { WebMessage } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

export default function SuperAdminMessagesScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await messageService.getAllWebMessages({
        search: query.trim() || undefined,
        status: filter,
      });
      setMessages(res.webMessages || []);
      setTotal(res.totalCount || 0);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load messages.'));
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRead = async (message: WebMessage) => {
    try {
      await messageService.setMessageRead(message._id, !message.isRead);
      load();
    } catch {
      // Best-effort; refresh will surface failure.
    }
  };

  return (
    <AdminModuleScreen title="Messages" subtitle={`${total} message(s)`} loading={loading} error={error} onRetry={load}>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={(text) => { setQuery(text); load(); }} placeholder="Search messages..." />
      </View>
      <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={(value) => { setFilter(value); load(); }} />
      <FlatList
        data={messages}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No messages" message="Contact form submissions will appear here." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggleRead(item)}>
            <Card style={[styles.row, !item.isRead && styles.rowUnread]}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitles}>
                  <Text style={styles.name} numberOfLines={1}>{item.subject || 'General inquiry'}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{item.name} · {item.email || item.phone || item.contact}</Text>
                </View>
                {item.isRead ? <Badge label="Read" variant="neutral" /> : <Badge label="Unread" variant="primary" />}
              </View>
              <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
              <Text style={styles.meta}>{formatISODate(item.createdAt)} · Tap to mark {item.isRead ? 'unread' : 'read'}</Text>
            </Card>
          </Pressable>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: Palette.primary },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  message: { ...Typography.bodySmall, color: Palette.text, lineHeight: 20 },
  meta: { ...Typography.caption, color: Palette.textMuted },
});