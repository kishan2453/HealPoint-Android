/**
 * HealPoint - searchable hospital selector (production).
 *
 * Loads ONLY active hospitals from the real public catalog endpoint
 * (`/hospital/public/get-all`) — no hardcoded or demo data. Used by the Doctor
 * Portal Login + Sign Up so the doctor picks the hospital they are registered
 * against. The backend independently re-verifies the doctor ↔ hospital
 * relationship server-side during login, so this picker is a UX convenience,
 * never a security boundary.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import { getPublicHospitals } from '@/services/hospitals';
import type { Hospital } from '@/types';

interface HospitalSelectProps {
  label?: string;
  /** Currently selected hospital id ('' when none). */
  value?: string;
  error?: string;
  onChange: (hospital: Hospital | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

function hospitalCity(hospital: Hospital): string {
  const city = hospital.location?.city;
  const address = hospital.location?.address;
  if (city) return city;
  if (address) return address;
  return '';
}

export function HospitalSelect({
  label,
  value,
  error,
  onChange,
  disabled = false,
  placeholder = 'Select hospital',
}: HospitalSelectProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await getPublicHospitals();
      // Public endpoint already returns only active hospitals; filter defensively.
      setHospitals((res.hospitals || []).filter((h) => h && h._id && h.isActive !== false));
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Unable to load hospitals. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = () => {
    if (disabled) return;
    setQuery('');
    setVisible(true);
  };

  const close = () => setVisible(false);

  const selected = useMemo(
    () => hospitals.find((hospital) => hospital._id === value) ?? null,
    [hospitals, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return hospitals;
    return hospitals.filter((hospital) => {
      const name = (hospital.name || '').toLowerCase();
      const city = hospitalCity(hospital).toLowerCase();
      return name.includes(needle) || city.includes(needle);
    });
  }, [hospitals, query]);

  const choose = (hospital: Hospital) => {
    onChange(hospital);
    close();
  };

  const isError = Boolean(error);

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, isError && styles.labelError]}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          isError ? styles.fieldError : null,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="business-outline" size={20} color={isError ? Palette.error : Palette.textMuted} />
        {selected ? (
          <View style={styles.selectedTexts}>
            <Text style={styles.selectedName} numberOfLines={1}>
              {selected.name}
            </Text>
            {hospitalCity(selected) ? (
              <Text style={styles.selectedCity} numberOfLines={1}>
                {hospitalCity(selected)}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.placeholder} numberOfLines={1}>
            {placeholder}
          </Text>
        )}
        <Ionicons name="chevron-down" size={18} color={Palette.textMuted} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* ------------------------- Picker modal -------------------------- */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <SafeAreaView edges={['bottom']} style={styles.modalSafe}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="business" size={20} color={Palette.primary} />
                  <Text style={styles.modalTitle}>Select hospital</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close hospital picker"
                  onPress={close}
                  hitSlop={10}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={Palette.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search hospital or city"
                  placeholderTextColor={Palette.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search hospitals"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.listWrap}>
                {loading ? (
                  <View style={styles.centerState}>
                    <ActivityIndicator color={Palette.primary} />
                    <Text style={styles.stateText}>Loading hospitals…</Text>
                  </View>
                ) : loadError ? (
                  <View style={styles.centerState}>
                    <Ionicons name="cloud-offline-outline" size={36} color={Palette.textMuted} />
                    <Text style={styles.stateText}>{loadError}</Text>
                    <Button title="Try again" variant="outline" onPress={load} style={styles.retryButton} />
                  </View>
                ) : (
                  <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <View style={styles.centerState}>
                        <Ionicons name="business-outline" size={36} color={Palette.textMuted} />
                        <Text style={styles.stateText}>No hospitals found.</Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const active = item._id === value;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name}, ${hospitalCity(item)}`}
                          onPress={() => choose(item)}
                          style={({ pressed }) => [
                            styles.row,
                            active && styles.rowActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.rowIcon, active && styles.rowIconActive]}>
                            <Ionicons
                              name="business-outline"
                              size={20}
                              color={active ? Palette.primaryDark : Palette.textMuted}
                            />
                          </View>
                          <View style={styles.rowTexts}>
                            <Text style={styles.rowName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {hospitalCity(item) ? (
                              <Text style={styles.rowCity} numberOfLines={1}>
                                {hospitalCity(item)}
                              </Text>
                            ) : null}
                          </View>
                          {active ? <Ionicons name="checkmark-circle" size={20} color={Palette.primary} /> : null}
                        </Pressable>
                      );
                    }}
                  />
                )}
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Palette.text,
  },
  labelError: {
    color: Palette.error,
  },
  field: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.card,
  },
  fieldError: {
    borderColor: Palette.error,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
  selectedTexts: {
    flex: 1,
  },
  selectedName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  selectedCity: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  placeholder: {
    flex: 1,
    fontSize: 16,
    color: Palette.textMuted,
  },
  error: {
    ...Typography.caption,
    color: Palette.error,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '72%',
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  modalSafe: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Palette.text,
    paddingVertical: Spacing.sm,
  },
  listWrap: {
    flex: 1,
    marginTop: Spacing.md,
  },
  centerState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  stateText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.sm,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  rowActive: {
    backgroundColor: Palette.primaryLight,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconActive: {
    backgroundColor: Palette.surface,
  },
  rowTexts: {
    flex: 1,
  },
  rowName: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  rowCity: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
});