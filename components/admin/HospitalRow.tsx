/**
 * HealPoint - Super Admin hospital row.
 * Professional card-style row showing the REAL hospital catalog data plus the
 * matching subscription (plan, status, dates, price) when one exists. Nothing
 * here is invented: missing fields are shown as a dash and there is no
 * subscription section unless a real subscription matched the hospital.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge, subscriptionStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { getHospitalImage } from '@/lib/image';
import { billingCycleLabel, planPriceLabel, subscriptionDurationLabel } from '@/lib/subscription';
import type { Hospital, Subscription } from '@/types';

interface HospitalRowProps {
  hospital: Hospital;
  subscription?: Subscription | null;
  /** Assigned Hospital Admin display name (from the real admin list). */
  adminName?: string;
  onPress?: () => void;
}

function hospitalAddress(hospital: Hospital): string {
  const loc = hospital.location;
  return [loc?.address, loc?.city, loc?.state].filter(Boolean).join(', ') || 'Address not set';
}

function contactLine(hospital: Hospital): string {
  const contact = hospital.contact;
  return [contact?.reception, contact?.emergency, contact?.email].filter(Boolean).join(' · ') || 'No contact';
}

export function HospitalRow({ hospital, subscription, adminName, onPress }: HospitalRowProps) {
  const hasSubscription = Boolean(subscription);
  const logoUrl = getHospitalImage(hospital.logo);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="business" size={20} color={Palette.primaryDark} />
            </View>
          )}
          <View style={styles.titleWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {hospital.name}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              <Ionicons name="location-outline" size={13} color={Palette.textMuted} /> {hospitalAddress(hospital)}
            </Text>
            <Text style={styles.contact} numberOfLines={1}>
              <Ionicons name="call-outline" size={13} color={Palette.textMuted} /> {contactLine(hospital)}
            </Text>
          </View>
          <View style={styles.statusCol}>
            <Badge label={hospital.isActive === false ? 'Inactive' : 'Active'} variant={hospital.isActive === false ? 'neutral' : 'success'} />
            {onPress ? <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} /> : null}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Doctors</Text>
            <Text style={styles.metaValue}>{hospital.doctorCount ?? hospital.doctors?.length ?? 0}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Departments</Text>
            <Text style={styles.metaValue}>{hospital.departments?.length ?? 0}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Rating</Text>
            <Text style={styles.metaValue}>{Number(hospital.rating || 0).toFixed(1)}</Text>
          </View>
        </View>

        {adminName ? (
          <View style={styles.adminRow}>
            <Ionicons name="person-circle-outline" size={15} color={Palette.primaryDark} />
            <Text style={styles.adminText} numberOfLines={1}>
              Admin · {adminName}
            </Text>
          </View>
        ) : null}

        {hospital.contact?.email ? (
          <View style={styles.adminRow}>
            <Ionicons name="mail-outline" size={15} color={Palette.textMuted} />
            <Text style={styles.adminMuted} numberOfLines={1}>
              {hospital.contact.email}
            </Text>
          </View>
        ) : null}

        {hasSubscription && subscription ? (
          <View style={styles.subscription}>
            <Text style={styles.subTitle}>
              <Ionicons name="card-outline" size={13} color={Palette.primaryDark} /> Subscription
            </Text>
            <View style={styles.subRow}>
              <View style={styles.subTexts}>
                <Text style={styles.subPlan}>{subscription.planName || subscription.planKey || 'Plan'}</Text>
                <Text style={styles.subPrice}>
                  {planPriceLabel(subscription)} · {billingCycleLabel(subscription.billingCycle)}
                  {subscriptionDurationLabel(subscription.startDate, subscription.expiryDate) !== '-' ? ` · ${subscriptionDurationLabel(subscription.startDate, subscription.expiryDate)}` : ''}
                </Text>
              </View>
              <StatusBadge value={subscription.status} variant={subscriptionStatusBadge(subscription.status)} />
            </View>
            <View style={styles.subDates}>
              <Text style={styles.subDate}>Start {formatISODate(subscription.startDate)}</Text>
              <Text style={styles.subDate}>Expiry {formatISODate(subscription.expiryDate)}</Text>
            </View>
          </View>
        ) : null}

        {onPress ? (
          <View style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons name="eye-outline" size={16} color={Palette.primaryDark} />
            </View>
            <Text style={styles.actionLabel}>View Details</Text>
            <Ionicons name="chevron-forward" size={18} color={Palette.primaryDark} />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  titleWrap: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  address: { ...Typography.bodySmall, color: Palette.textMuted },
  contact: { ...Typography.caption, color: Palette.textMuted, marginTop: 2 },
  statusCol: { alignItems: 'flex-end', gap: Spacing.sm },
  logo: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Palette.surface },
  logoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primaryLight },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  adminText: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600', flex: 1 },
  adminMuted: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  metaCol: { flex: 1, minWidth: '30%', gap: 2 },
  metaLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { ...Typography.bodySmall, color: Palette.text },
  subscription: {
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  subTitle: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  subTexts: { flex: 1, gap: 2 },
  subPlan: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  subPrice: { ...Typography.caption, color: Palette.textMuted },
  subDates: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  subDate: { ...Typography.caption, color: Palette.textMuted },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...Typography.label, color: Palette.primaryDark, flex: 1 },
});