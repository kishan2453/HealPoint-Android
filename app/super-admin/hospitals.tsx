/**
 * HealPoint - Super Admin · Hospitals.
 * Professional platform hospital list backed by REAL data:
 *   - hospital catalog from the authenticated `/hospital/get-all` (includes
 *     ACTIVE and INACTIVE hospitals plus real doctor/patient/appointment
 *     counts — server-side sanitized)
 *   - subscription (plan, status, dates, price) from /subscription for each
 *     hospital when a matching subscription exists
 *   - assigned Hospital Admin from `/user/admin/admins`, matched to each
 *     hospital by its real hospitalId
 * Search (name/email/location/admin), filter (hospital status, subscription
 * status) and sort are computed exclusively over the loaded real records.
 * Tapping a row opens the Super Admin Hospital Details screen.
 */
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { HospitalListSkeleton } from '@/components/admin/HospitalListSkeleton';
import { HospitalRow } from '@/components/admin/HospitalRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { PASSWORD_HELP, STRONG_PASSWORD_REGEX, isValidEmail, isValidIndianPhone } from '@/lib/validation';
import { toErrorMessage } from '@/services/api';
import * as hospitalService from '@/services/hospitals';
import * as subscriptionService from '@/services/subscriptions';
import { getAdminList } from '@/services/users';
import { subscriptionHospitalId } from '@/lib/subscription';
import type { Hospital, PlatformUser, Subscription } from '@/types';

const HOSPITAL_STATUS = [
  { label: 'All Status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const SUB_STATUS = [
  { label: 'All Plans', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Trial', value: 'trial' },
  { label: 'Expired', value: 'expired' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Suspended', value: 'suspended' },
];

const SORTS = [
  { label: 'Name A-Z', value: 'name' },
  { label: 'Most Doctors', value: 'doctors' },
];

function hospitalSearchableText(h: Hospital, adminName?: string): string {
  const loc = h.location;
  const address = [loc?.address, loc?.city, loc?.state].filter(Boolean).join(' ');
  return `${h.name} ${address} ${h.contact?.email || ''} ${adminName || ''}`.toLowerCase();
}
export default function SuperAdminHospitalsScreen() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [admins, setAdmins] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [hospitalStatus, setHospitalStatus] = useState('all');
  const [subStatus, setSubStatus] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sort, setSort] = useState<'name' | 'doctors'>('name');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Create-hospital modal state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', address: '', city: '', state: '', pincode: '',
    phone: '', email: '', website: '', adminName: '', adminEmail: '', adminPassword: '',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const setField = (key: keyof typeof createForm) => (value: string) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
    setCreateError('');
    setCreateSuccess('');
  };

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [hospRes, subRes, adminRes] = await Promise.all([
        hospitalService.getAdminHospitals(),
        subscriptionService.getSubscriptions({ limit: 500 }).catch(() => ({ subscriptions: [] as Subscription[], totalCount: 0 })),
        getAdminList().catch(() => ({ admins: [] as PlatformUser[] })),
      ]);
      setHospitals(hospRes.hospitals || []);
      setTotal(hospRes.totalCount || 0);
      setSubscriptions(subRes.subscriptions || []);
      setAdmins(adminRes.admins || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load hospitals.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Map a hospital to its subscription (by id, then by name as fallback).
  const subscriptionFor = useCallback(
    (hospital: Hospital): Subscription | null => {
      const byId = subscriptions.find((s) => subscriptionHospitalId(s) === String(hospital._id));
      if (byId) return byId;
      return subscriptions.find((s) => s.hospitalName === hospital.name) || null;
    },
    [subscriptions],
  );

  // Map a hospital id to its assigned Hospital Admin's display name (real data).
  const adminNameFor = useCallback(
    (hospital: Hospital): string | undefined => {
      const hospitalId = String(hospital._id);
      const matching = admins.find((a) => {
        const adminHospital = a.hospital ?? (typeof a.hospitalId === 'object' ? a.hospitalId : null);
        if (adminHospital && typeof adminHospital === 'object' && adminHospital._id) {
          return String(adminHospital._id) === hospitalId;
        }
        return false;
      });
      return matching?.name;
    },
    [admins],
  );

  const visible = hospitals.filter((h) => {
    const searchable = hospitalSearchableText(h, adminNameFor(h));
    if (query.trim() && !searchable.includes(query.trim().toLowerCase())) return false;
    if (hospitalStatus === 'active' && h.isActive === false) return false;
    if (hospitalStatus === 'inactive' && h.isActive !== false) return false;
    if (subStatus !== 'all') {
      const sub = subscriptionFor(h);
      if (!sub || sub.status !== subStatus) return false;
    }
    if (planFilter !== 'all') {
      const sub = subscriptionFor(h);
      if (!sub) return false;
      const planKey = String(sub.planKey || '').toLowerCase();
      const planName = String(sub.planName || '').toLowerCase();
      if (planKey !== planFilter.toLowerCase() && planName !== planFilter.toLowerCase()) return false;
    }
    return true;
  });

  const sorted = [...visible].sort((a, b) => {
    if (sort === 'doctors') return (b.doctorCount ?? b.doctors?.length ?? 0) - (a.doctorCount ?? a.doctors?.length ?? 0);
    return a.name.localeCompare(b.name);
  });

  const activeCount = hospitals.filter((h) => h.isActive !== false).length;

  // Plan filter options derived exclusively from the real loaded subscriptions.
  const planKeys = subscriptions.map((s) => s.planKey || s.planName).filter(Boolean) as string[];
  const planOptions = [
    { label: 'All Plans', value: 'all' },
    ...Array.from(new Set(planKeys)).map((key) => ({ label: key, value: key })),
  ];

  function validateCreateForm(): string {
    const f = createForm;
    if (!f.name.trim() || !f.address.trim() || !f.city.trim() || !f.state.trim() || !f.pincode.trim()) {
      return 'Hospital name and complete location details are required.';
    }
    if (!isValidEmail(f.email)) return 'Please enter a valid hospital email address.';
    if (!isValidIndianPhone(f.phone)) return 'Please enter a valid 10-digit Indian phone number.';
    if (!f.adminName.trim() || !isValidEmail(f.adminEmail)) {
      return 'Hospital Admin name and a valid admin email are required.';
    }
    if (!STRONG_PASSWORD_REGEX.test(f.adminPassword)) return PASSWORD_HELP;
    return '';
  }

  async function submitCreate() {
    const validation = validateCreateForm();
    if (validation) {
      setCreateError(validation);
      return;
    }
    setCreateSubmitting(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      await hospitalService.createHospitalWithAdmin({
        name: createForm.name.trim(),
        address: createForm.address.trim(),
        city: createForm.city.trim(),
        state: createForm.state.trim(),
        pincode: createForm.pincode.trim(),
        mapsUrl: '',
        phone: createForm.phone.trim(),
        email: createForm.email.trim().toLowerCase(),
        website: createForm.website.trim(),
        adminName: createForm.adminName.trim(),
        adminEmail: createForm.adminEmail.trim().toLowerCase(),
        adminPassword: createForm.adminPassword,
      });
      // Reset + close form, then refresh the list so the new hospital appears.
      setCreateForm({ name: '', address: '', city: '', state: '', pincode: '', phone: '', email: '', website: '', adminName: '', adminEmail: '', adminPassword: '' });
      setCreateSubmitting(false);
      setCreateSuccess('Hospital and Hospital Admin created successfully.');
      load();
      setTimeout(() => {
        setCreateOpen(false);
        setCreateSuccess('');
      }, 1400);
    } catch (err) {
      setCreateError(toErrorMessage(err, 'Unable to create hospital.'));
      setCreateSubmitting(false);
    }
  }

  return (
    <AdminModuleScreen
      title="Hospitals"
      subtitle={`${total} hospital(s) on the platform`}
      loading={loading}
      loadingComponent={<HospitalListSkeleton />}
      error={error}
      onRetry={load}
    >
      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Total {total} · Active {activeCount}</Text>
              <View style={styles.summaryActions}>
                <Button
                  title="Subscriptions"
                  variant="secondary"
                  fullWidth={false}
                  icon="card-outline"
                  style={styles.subButton}
                  onPress={() => router.push('/super-admin/subscriptions')}
                />
                <Button
                  title="New Hospital"
                  variant="primary"
                  fullWidth={false}
                  icon="add-outline"
                  style={styles.subButton}
                  onPress={() => { setCreateOpen(true); setCreateError(''); setCreateSuccess(''); }}
                />
              </View>
            </View>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search hospital name, email, location or admin..."
            />
            <FilterChips options={HOSPITAL_STATUS} selected={hospitalStatus} onSelect={setHospitalStatus} />
            <FilterChips options={SUB_STATUS} selected={subStatus} onSelect={setSubStatus} />
            <FilterChips options={planOptions} selected={planFilter} onSelect={setPlanFilter} />
            <FilterChips options={SORTS} selected={sort} onSelect={(value) => setSort(value as 'name' | 'doctors')} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            hospitals.length === 0 ? (
              <EmptyState title="No hospitals found" message="Hospitals will appear here once they are added to the platform." />
            ) : (
              <EmptyState title="No matching hospitals" message="Try a different search or filter." />
            )
          ) : null
        }
        renderItem={({ item }) => (
          <HospitalRow
            hospital={item}
            subscription={subscriptionFor(item)}
            adminName={adminNameFor(item)}
            onPress={() => router.push(`/super-admin/hospital/${item._id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ---- Create Hospital + Hospital Admin modal ---- */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => !createSubmitting && setCreateOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !createSubmitting && setCreateOpen(false)} accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="business-outline" size={22} color={Palette.primaryDark} />
                </View>
                <View style={styles.modalHeaderTexts}>
                  <Text style={styles.modalTitle}>New Hospital</Text>
                  <Text style={styles.modalSubtitle}>Add a hospital and its first Hospital Admin</Text>
                </View>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldGroupTitle}>Hospital details</Text>
                <Input label="Hospital name *" value={createForm.name} onChangeText={setField('name')} placeholder="e.g. Anand Hospital" />
                <Input label="Address *" value={createForm.address} onChangeText={setField('address')} placeholder="Street, area" />
                <View style={styles.rowInputs}>
                  <Input label="City *" value={createForm.city} onChangeText={setField('city')} containerStyle={styles.rowInputFlex} />
                  <Input label="State *" value={createForm.state} onChangeText={setField('state')} containerStyle={styles.rowInputFlex} />
                </View>
                <View style={styles.rowInputs}>
                  <Input label="Pincode *" value={createForm.pincode} onChangeText={setField('pincode')} containerStyle={styles.rowInputFlex} keyboardType="number-pad" />
                  <Input label="Phone *" value={createForm.phone} onChangeText={setField('phone')} containerStyle={styles.rowInputFlex} keyboardType="phone-pad" />
                </View>
                <Input label="Email *" value={createForm.email} onChangeText={setField('email')} autoCapitalize="none" keyboardType="email-address" />
                <Input label="Website" value={createForm.website} onChangeText={setField('website')} autoCapitalize="none" keyboardType="url" />

                <Text style={[styles.fieldGroupTitle, styles.fieldGroupGap]}>Hospital Admin</Text>
                <Input label="Admin name *" value={createForm.adminName} onChangeText={setField('adminName')} />
                <Input label="Admin email *" value={createForm.adminEmail} onChangeText={setField('adminEmail')} autoCapitalize="none" keyboardType="email-address" />
                <Input
                  label="Admin password *"
                  value={createForm.adminPassword}
                  onChangeText={setField('adminPassword')}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.passwordHint}>{PASSWORD_HELP}</Text>

                {createError ? <FormMessage type="error" message={createError} /> : null}
                {createSuccess ? <FormMessage type="success" message={createSuccess} /> : null}
              </ScrollView>

              <View style={styles.modalActions}>
                <Button title="Cancel" variant="outline" onPress={() => setCreateOpen(false)} disabled={createSubmitting} style={styles.modalButton} />
                <Button
                  title="Create Hospital"
                  variant="primary"
                  icon="checkmark-circle-outline"
                  loading={createSubmitting}
                  onPress={submitCreate}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { gap: Spacing.sm, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, flexWrap: 'wrap' },
  summaryActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  summaryText: { ...Typography.bodySmall, color: Palette.textMuted, flex: 1 },
  subButton: { paddingHorizontal: Spacing.md, minHeight: 40 },
  listContent: { paddingBottom: Spacing.xxxl },
  separator: { height: Spacing.md },
  // Create-hospital modal
  backdrop: { flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalWrap: { width: '100%', maxWidth: 560, maxHeight: '92%' },
  modalCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.xl, paddingBottom: Spacing.md },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTexts: { flex: 1, gap: 2 },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalSubtitle: { ...Typography.caption, color: Palette.textMuted },
  modalScroll: { paddingHorizontal: Spacing.xl, flexGrow: 0 },
  fieldGroupTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.sm },
  fieldGroupGap: { marginTop: Spacing.lg },
  rowInputs: { flexDirection: 'row', gap: Spacing.md },
  rowInputFlex: { flex: 1 },
  passwordHint: { ...Typography.caption, color: Palette.textMuted, lineHeight: 16, marginTop: Spacing.xs },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.xl, paddingTop: Spacing.md },
  modalButton: { flex: 1 },
});
