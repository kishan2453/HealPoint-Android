/**
 * HealPoint - Hospital Admin · Hospital Gallery.
 * Shows the images stored on the hospital's public profile. Uploads are
 * handled by the hospital admin web portal (image URLs are stored on the
 * hospital document).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';

export default function AdminGalleryScreen() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalAdminDashboard();
      const hospital = res.hospital || {};
      const combined = [
        ...(hospital.hospitalImages || []).map((item: string | Record<string, unknown>) => (typeof item === 'string' ? item : String(item.src || ''))),
        ...(hospital.gallery || []).map((item: string | Record<string, unknown>) => (typeof item === 'string' ? item : String(item.src || ''))),
      ].filter(Boolean);
      setImages(combined);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load gallery.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen
      title="Hospital Gallery"
      subtitle="Images shown on your public profile"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FlatList
        data={images}
        keyExtractor={(item, index) => `${item}-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No images yet" message="Upload gallery images from the hospital admin portal." />}
        ListHeaderComponent={
          <Text style={styles.hint}>
            Image uploads flow through the hospital admin web portal. This view mirrors the current public gallery.
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.imageCard}>
            <Image source={{ uri: item }} style={styles.image} contentFit="cover" transition={150} />
          </Card>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  columns: { gap: Spacing.md, marginBottom: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  hint: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.sm, marginBottom: Spacing.md },
  imageCard: { flex: 1, padding: 0, overflow: 'hidden' },
  image: { width: '100%', height: 120, borderRadius: Radius.md },
});