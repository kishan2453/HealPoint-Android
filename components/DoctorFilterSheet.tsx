/**
 * HealPoint - doctor search filters bottom sheet.
 *
 * Every option maps 1:1 to a query param the real backend `/doctor/get-all`
 * endpoint supports (see `lib/doctor-search.ts`). Sections whose option list is
 * empty (e.g. no location/gender data from the backend) are simply hidden — we
 * never offer a filter the API cannot honour.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import {
  CONSULTATION_TYPE_OPTIONS,
  EXPERIENCE_OPTIONS,
  FEE_OPTIONS,
  RATING_OPTIONS,
  type DoctorFilterOptions,
  type DoctorSearchFilters,
} from '@/lib/doctor-search';

interface DoctorFilterSheetProps {
  visible: boolean;
  filters: DoctorSearchFilters;
  options: DoctorFilterOptions;
  onApply: (filters: DoctorSearchFilters) => void;
  onClose: () => void;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

export function DoctorFilterSheet({ visible, filters, options, onApply, onClose }: DoctorFilterSheetProps) {
  const [draft, setDraft] = useState<DoctorSearchFilters>(filters);

  // Reset the local draft every time the sheet opens so Apply is predictable.
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const toggle = (key: keyof DoctorSearchFilters, value: string | number | boolean | undefined) => {
    setDraft((prev) => ({ ...prev, [key]: value } as DoctorSearchFilters));
  };

  const selectFee = (minFee?: number, maxFee?: number) => {
    setDraft((prev) => ({ ...prev, minFee, maxFee }));
  };

  const toggleConsultationType = (value?: 'clinic' | 'video') => {
    setDraft((prev) => ({ ...prev, consultationType: value }));
  };

  const resetDraft = () => setDraft({});

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          style={styles.backdrop}
          onPress={onClose}
        />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Text style={styles.sheetSubtitle}>Refine your doctor search</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={Palette.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {options.specialities.length > 0 ? (
              <Section title="Specialty">
                {options.specialities.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={draft.speciality === item}
                    onPress={() => toggle('speciality', draft.speciality === item ? undefined : item)}
                  />
                ))}
              </Section>
            ) : null}

            {options.locations.length > 0 ? (
              <Section title="Location">
                {options.locations.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={draft.location === item}
                    onPress={() => toggle('location', draft.location === item ? undefined : item)}
                  />
                ))}
              </Section>
            ) : null}

            {options.genders.length > 0 ? (
              <Section title="Gender">
                {options.genders.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={draft.gender === item}
                    onPress={() => toggle('gender', draft.gender === item ? undefined : item)}
                  />
                ))}
              </Section>
            ) : null}

            <Section title="Experience">
              {EXPERIENCE_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={draft.minExperience === option.value}
                  onPress={() => toggle('minExperience', option.value)}
                />
              ))}
            </Section>

            <Section title="Rating">
              {RATING_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={draft.minRating === option.value}
                  onPress={() => toggle('minRating', option.value)}
                />
              ))}
            </Section>

            <Section title="Consultation fee">
              {FEE_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={draft.minFee === option.minFee && draft.maxFee === option.maxFee}
                  onPress={() => selectFee(option.minFee, option.maxFee)}
                />
              ))}
            </Section>

            <Section title="Consultation type">
              {CONSULTATION_TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={draft.consultationType === option.value}
                  onPress={() => toggleConsultationType(option.value)}
                />
              ))}
            </Section>

            <Section title="Availability">
              <Chip
                label="Available now"
                active={draft.availabilityOnly === true}
                onPress={() => toggle('availabilityOnly', draft.availabilityOnly ? undefined : true)}
              />
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Reset" variant="outline" onPress={resetDraft} style={styles.footerButton} />
            <Button title="Apply filters" onPress={() => onApply(draft)} style={styles.footerButton} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 20, 18, 0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
    marginTop: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  sheetSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: 200,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  chipTextActive: {
    color: Palette.white,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  footerButton: {
    flex: 1,
  },
});
