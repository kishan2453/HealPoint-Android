/**
 * HealPoint - Super Admin · Hospital Admins.
 *
 * Professional Hospital Admin management page. Every value comes from a REAL
 * existing backend endpoint — nothing is invented:
 *   - admin list + status from GET /user/admin/admins (full list; search,
 *     status and hospital filters then run over the loaded REAL records so
 *     the summary + list always reflect the actual data)
 *   - platform hospital total from GET /user/get-stats (drives the
 *     "Hospitals with/without Admin" cards; shown as '—' when unavailable)
 *   - details (hospital name, address, doctors, departments, status) from the
 *     authenticated GET /hospital/get-details/:id resolved through the
 *     admin's OWN hospitalId — Hospital Admin A can never appear under
 *     Hospital B because the mapping is always read from the record itself
 *   - activate/suspend via PATCH /user/admin/admins/:id/status
 *   - reset password via PATCH /user/admin/admins/:id/reset-password (the
 *     backend hashes the new password with bcrypt; the old password stops
 *     working immediately and no hash ever leaves the server)
 *
 * Layout is responsive: a professional table on desktop/laptop, card rows on
 * tablet and phone. Reset Password, status confirmation and the admin details
 * view each have their own loading / error / empty states.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { useResponsiveVariant } from '@/lib/responsive';
import { PASSWORD_HELP, STRONG_PASSWORD_REGEX } from '@/lib/validation';
import { toErrorMessage } from '@/services/api';
import { getAdminHospitalDetails } from '@/services/hospitals';
import {
  getAdminList,
  getPlatformStats,
  resetHospitalAdminPassword,
  updateHospitalAdminStatus,
} from '@/services/users';
import type { Hospital, PlatformUser } from '@/types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

function adminInitials(name?: string): string {
  return (name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

/**
 * The admin's real hospital id — object `hospital`, object/string `hospitalId`.
 * This is always read from the admin's own backend record, so the admin can
 * never be shown under the wrong hospital.
 */
function adminHospitalId(admin: PlatformUser): string | null {
  const hospital = admin.hospital ?? (typeof admin.hospitalId === 'object' ? admin.hospitalId : null);
  if (hospital && typeof hospital === 'object' && hospital._id) return String(hospital._id);
  if (typeof admin.hospitalId === 'string' && admin.hospitalId) return admin.hospitalId;
  return null;
}

function hospitalNameOf(admin: PlatformUser): string {
  const hospital = admin.hospital ?? (typeof admin.hospitalId === 'object' ? admin.hospitalId : null);
  if (hospital && typeof hospital === 'object' && hospital.name) return hospital.name;
  return 'Unassigned';
}

/** Client-side password strength estimate (rules mirror the backend regex). */
function passwordStrength(password: string): { label: string; color: string; ratio: number } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [Palette.error, Palette.error, Palette.warning, Palette.info, Palette.success];
  return { label: labels[score], color: colors[score], ratio: score / 4 };
}

export default function SuperAdminAdminsScreen() {
  const variant = useResponsiveVariant();
  const isDesktop = variant === 'desktop';

  const [admins, setAdmins] = useState<PlatformUser[]>([]);
  const [totalHospitals, setTotalHospitals] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [hospital, setHospital] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Reset-password modal state.
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Status-toggle confirmation state.
  const [statusAction, setStatusAction] = useState<{ admin: PlatformUser; activate: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Admin details modal state (also loads the assigned hospital's REAL details).
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [detailsHospital, setDetailsHospital] = useState<Hospital | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    setActionError('');
    try {
      const [adminRes, statsRes] = await Promise.all([
        getAdminList(),
        getPlatformStats().catch(() => null),
      ]);
      setAdmins(adminRes.admins || []);
      setTotalHospitals(statsRes?.stats?.totalHospitals ?? null);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load hospital admins.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = useMemo(() => admins.filter((a) => a.isActive !== false).length, [admins]);
  const inactiveCount = admins.length - activeCount;
  const hospitalsWithAdmin = useMemo(
    () => new Set(admins.map(adminHospitalId).filter((id) => Boolean(id))).size,
    [admins],
  );
  // Computed from the REAL hospital total (get-stats) and the admins' own
  // hospitalId mapping. Shown as '—' when the stats endpoint is unavailable.
  const hospitalsWithoutAdmin =
    totalHospitals === null ? null : Math.max(0, totalHospitals - hospitalsWithAdmin);

  // Hospital filter options derived exclusively from hospitals that actually
  // have an assigned admin in the loaded real data.
  const hospitalOptions = useMemo(() => {
    const map = new Map<string, string>();
    admins.forEach((a) => {
      const id = adminHospitalId(a);
      const name = hospitalNameOf(a);
      if (!id || name === 'Unassigned') return;
      if (!map.has(id)) map.set(id, name);
    });
    const options = [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ label, value }));
    return [{ label: 'All Hospitals', value: 'all' }, ...options];
  }, [admins]);

  // Search + status + hospital filters over the loaded real records.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return admins.filter((a) => {
      if (q) {
        const haystack = [a.name, a.email, a.phone, hospitalNameOf(a)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (status === 'true' && a.isActive === false) return false;
      if (status === 'false' && a.isActive !== false) return false;
      if (hospital !== 'all' && adminHospitalId(a) !== hospital) return false;
      return true;
    });
  }, [admins, query, status, hospital]);
  function openResetModal(admin: PlatformUser) {
    setResetTarget(admin);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setResetError('');
    setResetSuccess('');
    setResetSubmitting(false);
  }

  function openDetails(admin: PlatformUser) {
    setSelected(admin);
    setDetailsHospital(null);
    setDetailsError('');
    const hid = adminHospitalId(admin);
    setDetailsLoading(Boolean(hid));
    if (!hid) return;
    getAdminHospitalDetails(hid)
      .then((res) => setDetailsHospital(res.hospital || null))
      .catch((err) => setDetailsError(toErrorMessage(err, 'Hospital details unavailable.')))
      .finally(() => setDetailsLoading(false));
  }

  function validateReset(): string {
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) return PASSWORD_HELP;
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  }

  async function submitReset() {
    if (!resetTarget) return;
    const validation = validateReset();
    if (validation) {
      setResetError(validation);
      return;
    }
    setResetError('');
    setResetSubmitting(true);
    try {
      const res = await resetHospitalAdminPassword(String(resetTarget._id), newPassword);
      setResetSuccess(res.message || 'Password reset successfully.');
      setResetSubmitting(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirm(false);
      setActionError('');
      load();
      setTimeout(() => setResetTarget(null), 1400);
    } catch (err) {
      setResetError(toErrorMessage(err, 'Unable to reset password.'));
      setResetSubmitting(false);
    }
  }

  async function runStatusAction() {
    if (!statusAction) return;
    const { admin, activate } = statusAction;
    setStatusLoading(true);
    setActionError('');
    try {
      await updateHospitalAdminStatus(String(admin._id), activate);
      setStatusAction(null);
      setSelected(null);
      load();
    } catch (err) {
      setStatusAction(null);
      setActionError(
        toErrorMessage(err, activate ? 'Unable to activate admin.' : 'Unable to suspend admin.'),
      );
    } finally {
      setStatusLoading(false);
    }
  }

  function clearFilters() {
    setQuery('');
    setStatus('all');
    setHospital('all');
  }

  const strength = passwordStrength(newPassword);

  const headerSection = (
    <View style={styles.headerWrap}>
      <View style={styles.grid}>
        <StatCard label="Hospital Admins" value={admins.length} icon="person-circle-outline" accent="#E89A3C" hint="Total accounts" />
        <StatCard label="Active" value={activeCount} icon="checkmark-done-outline" accent="#2E9E5B" hint="Can sign in" />
        <StatCard label="Inactive" value={inactiveCount} icon="pause-circle-outline" accent="#D9435B" hint="Suspended" />
        <StatCard label="Hospitals with Admin" value={hospitalsWithAdmin} icon="business-outline" accent="#0E9F8E" hint="Have an assigned admin" />
        <StatCard
          label="Hospitals without Admin"
          value={hospitalsWithoutAdmin === null ? '—' : hospitalsWithoutAdmin}
          icon="business-outline"
          accent="#2F80ED"
          hint={totalHospitals === null ? 'Hospitals total unavailable' : 'Without an assigned admin'}
        />
      </View>

      {actionError ? <FormMessage type="error" message={actionError} /> : null}

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, email, phone or hospital..."
      />
      <FilterChips options={STATUS_FILTERS} selected={status} onSelect={setStatus} />
      {hospitalOptions.length > 1 ? (
        <FilterChips options={hospitalOptions} selected={hospital} onSelect={setHospital} />
      ) : null}

      <View style={styles.resultRow}>
        <Text style={styles.resultText}>
          Showing {visible.length} of {admins.length} hospital admin(s)
        </Text>
        {query.trim() || status !== 'all' || hospital !== 'all' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search and filters"
            onPress={clearFilters}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <AdminModuleScreen
      title="Hospital Admins"
      subtitle={`${admins.length} hospital admin account(s) · ${activeCount} active`}
      loading={loading}
      loadingComponent={<AdminsSkeleton />}
      error={error}
      onRetry={() => load(true)}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh hospital admins"
          onPress={() => load(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={20} color={Palette.primaryDark} />
        </Pressable>
      }
    >
      {isDesktop ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.desktopContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <View style={styles.desktopPage}>
            {headerSection}
            <Card padded={false} style={styles.tableCard}>
              {visible.length > 0 ? <TableHeader /> : null}
              {visible.map((admin) => (
                <AdminTableRow
                  key={String(admin._id)}
                  admin={admin}
                  onView={() => openDetails(admin)}
                  onReset={() => openResetModal(admin)}
                  onToggleStatus={() => setStatusAction({ admin, activate: admin.isActive === false })}
                />
              ))}
              {visible.length === 0 ? (
                <View style={styles.tableEmpty}>
                  <EmptyState
                    title={admins.length === 0 ? 'No hospital admins found' : 'No matching admins'}
                    message={
                      admins.length === 0
                        ? 'Hospital admins will appear here once they are added.'
                        : 'Try a different search or filter.'
                    }
                  />
                </View>
              ) : null}
            </Card>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          data={visible}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={headerSection}
          ListEmptyComponent={
            !loading ? (
              admins.length === 0 ? (
                <EmptyState
                  title="No hospital admins found"
                  message="Hospital admins will appear here once they are added."
                />
              ) : (
                <EmptyState title="No matching admins" message="Try a different search or filter." />
              )
            ) : null
          }
          renderItem={({ item }) => (
            <AdminCardRow
              admin={item}
              onPress={() => openDetails(item)}
              onReset={() => openResetModal(item)}
              onToggleStatus={() => setStatusAction({ admin: item, activate: item.isActive === false })}
            />
          )}
        />
      )}
      {/* ---- Admin details modal (real data + assigned hospital details) ---- */}
      {selected ? (
        <AdminDetailsModal
          admin={selected}
          hospital={detailsHospital}
          hospitalLoading={detailsLoading}
          hospitalError={detailsError}
          onReset={() => {
            const target = selected;
            setSelected(null);
            setDetailsHospital(null);
            openResetModal(target);
          }}
          onToggleStatus={() => {
            setSelected(null);
            setDetailsHospital(null);
            setStatusAction({ admin: selected, activate: selected.isActive === false });
          }}
          onClose={() => {
            setSelected(null);
            setDetailsHospital(null);
            setDetailsError('');
          }}
        />
      ) : null}
      {/* ---- Reset Password modal ---- */}
      <Modal
        visible={Boolean(resetTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => !resetSubmitting && setResetTarget(null)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !resetSubmitting && setResetTarget(null)}
            accessibilityLabel="Dismiss"
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={22} color={Palette.primaryDark} />
              </View>
              <View style={styles.modalHeaderTexts}>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.modalSubtitle}>Set a new password for this hospital admin</Text>
              </View>
            </View>

            {resetTarget ? (
              <View style={styles.modalAdminCard}>
                <AdminAvatar name={resetTarget.name} image={resetTarget.image} size={44} />
                <View style={styles.modalAdminTexts}>
                  <Text style={styles.modalAdminName} numberOfLines={1}>
                    {resetTarget.name || 'Hospital Admin'}
                  </Text>
                  <Text style={styles.modalAdminEmail} numberOfLines={1}>
                    {resetTarget.email || 'No email'}
                  </Text>
                  <Text style={styles.modalAdminHospital} numberOfLines={1}>
                    {hospitalNameOf(resetTarget)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.modalBody}>
              {resetSuccess ? (
                <FormMessage type="success" message={resetSuccess} />
              ) : (
                <>
                  <Input
                    label="New Password"
                    placeholder="Enter a strong password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!resetSubmitting}
                    leftIcon="lock-closed-outline"
                    rightSlot={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={8}
                        style={styles.eye}
                      >
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Palette.textMuted} />
                      </Pressable>
                    }
                  />
                  {newPassword.length > 0 ? (
                    <View style={styles.strengthRow}>
                      {[1, 2, 3, 4].map((bar) => (
                        <View
                          key={bar}
                          style={[
                            styles.strengthBar,
                            { backgroundColor: strength.ratio >= bar / 4 ? strength.color : Palette.divider },
                          ]}
                        />
                      ))}
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  ) : null}
                  <Input
                    label="Confirm Password"
                    placeholder="Re-enter the new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!resetSubmitting}
                    leftIcon="shield-checkmark-outline"
                    rightSlot={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                        onPress={() => setShowConfirm((v) => !v)}
                        hitSlop={8}
                        style={styles.eye}
                      >
                        <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={Palette.textMuted} />
                      </Pressable>
                    }
                  />
                  {resetError ? <FormMessage type="error" message={resetError} /> : null}
                  <Text style={styles.passwordHint}>{PASSWORD_HELP}</Text>
                </>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setResetTarget(null)} disabled={resetSubmitting} style={styles.modalButton} />
              {resetSuccess ? (
                <Button title="Done" variant="primary" onPress={() => setResetTarget(null)} style={styles.modalButton} />
              ) : (
                <Button
                  title="Reset Password"
                  variant="primary"
                  icon="key-outline"
                  loading={resetSubmitting}
                  onPress={submitReset}
                  style={styles.modalButton}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
      {/* ---- Suspend / Activate confirmation ---- */}
      <ConfirmDialog
        visible={Boolean(statusAction)}
        title={statusAction?.activate ? 'Activate hospital admin?' : 'Suspend hospital admin?'}
        message={
          statusAction?.activate
            ? `${statusAction?.admin?.name || 'This admin'} will be able to sign in to the Hospital Admin portal again.`
            : `${statusAction?.admin?.name || 'This admin'} will no longer be able to sign in until reactivated. Existing data is preserved.`
        }
        confirmLabel={statusAction?.activate ? 'Activate' : 'Suspend'}
        tone={statusAction?.activate ? 'primary' : 'danger'}
        loading={statusLoading}
        onConfirm={runStatusAction}
        onCancel={() => setStatusAction(null)}
      />
    </AdminModuleScreen>
  );
}
/** Column header for the desktop table (labels align with the row cells). */
function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      <View style={styles.colAdmin}>
        <Text style={styles.tableHeaderCell}>Admin</Text>
      </View>
      <View style={styles.colHospital}>
        <Text style={styles.tableHeaderCell}>Hospital</Text>
      </View>
      <View style={styles.colPhone}>
        <Text style={styles.tableHeaderCell}>Phone</Text>
      </View>
      <View style={styles.colStatus}>
        <Text style={styles.tableHeaderCell}>Status</Text>
      </View>
      <View style={styles.colCreated}>
        <Text style={styles.tableHeaderCell}>Created</Text>
      </View>
      <View style={[styles.colActions, styles.tableHeaderActions]}>
        <Text style={styles.tableHeaderCell}>Actions</Text>
      </View>
    </View>
  );
}

function IconActionButton({
  icon,
  label,
  onPress,
  tone = 'primary',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'danger' | 'success';
}) {
  const color =
    tone === 'danger' ? Palette.error : tone === 'success' ? Palette.success : Palette.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.tableIconBtn, pressed && styles.iconPressed]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Desktop/laptop table row — real admin + hospital data, no invented values. */
function AdminTableRow({
  admin,
  onView,
  onReset,
  onToggleStatus,
}: {
  admin: PlatformUser;
  onView: () => void;
  onReset: () => void;
  onToggleStatus: () => void;
}) {
  const isActive = admin.isActive !== false;
  return (
    <View style={styles.tableRow}>
      <View style={styles.colAdmin}>
        <AdminAvatar name={admin.name} image={admin.image} size={36} />
        <View style={styles.tableAdminTexts}>
          <Text style={styles.tableName} numberOfLines={1}>{admin.name || 'Hospital Admin'}</Text>
          <Text style={styles.muted} numberOfLines={1}>{admin.email || 'No email'}</Text>
        </View>
      </View>
      <View style={styles.colHospital}>
        <Text style={styles.tableCell} numberOfLines={1}>{hospitalNameOf(admin)}</Text>
      </View>
      <View style={styles.colPhone}>
        <Text style={styles.tableCell} numberOfLines={1}>{admin.phone || '—'}</Text>
      </View>
      <View style={styles.colStatus}>
        <StatusBadge value={isActive ? 'active' : 'inactive'} />
      </View>
      <View style={styles.colCreated}>
        <Text style={styles.tableCell} numberOfLines={1}>{formatISODate(admin.createdAt)}</Text>
      </View>
      <View style={styles.colActions}>
        <IconActionButton icon="eye-outline" label="View details" tone="primary" onPress={onView} />
        <IconActionButton icon="key-outline" label="Reset password" tone="primary" onPress={onReset} />
        <IconActionButton
          icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          label={isActive ? 'Suspend admin' : 'Activate admin'}
          tone={isActive ? 'danger' : 'success'}
          onPress={onToggleStatus}
        />
      </View>
    </View>
  );
}
/** Mobile / tablet admin card — press the card for details, buttons for actions. */
function AdminCardRow({
  admin,
  onPress,
  onReset,
  onToggleStatus,
}: {
  admin: PlatformUser;
  onPress: () => void;
  onReset: () => void;
  onToggleStatus: () => void;
}) {
  const isActive = admin.isActive !== false;
  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View details for ${admin.name || 'this hospital admin'}`}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <View style={styles.rowHeader}>
          <AdminAvatar name={admin.name} image={admin.image} size={48} />
          <View style={styles.rowTitles}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{admin.name || 'Hospital Admin'}</Text>
              <StatusBadge value={isActive ? 'active' : 'inactive'} />
            </View>
            <Text style={styles.muted} numberOfLines={1}>{admin.email || 'No email'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
        </View>
        <View style={styles.chipRow}>
          <Badge label={hospitalNameOf(admin)} variant={admin.hospitalId ? 'primary' : 'neutral'} />
          <Badge label="Hospital Admin" variant="neutral" />
        </View>
        <View style={styles.metaRow}>
          {admin.phone ? (
            <Text style={styles.meta} numberOfLines={1}>
              <Ionicons name="call-outline" size={13} color={Palette.textMuted} /> {admin.phone}
            </Text>
          ) : null}
          {admin.createdAt ? (
            <Text style={styles.meta} numberOfLines={1}>
              <Ionicons name="calendar-outline" size={13} color={Palette.textMuted} /> Joined {formatISODate(admin.createdAt)}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Button
          title="Reset Password"
          variant="secondary"
          fullWidth={false}
          icon="key-outline"
          style={styles.actionButton}
          onPress={onReset}
        />
        <Button
          title={isActive ? 'Suspend' : 'Activate'}
          variant={isActive ? 'danger' : 'secondary'}
          fullWidth={false}
          icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
          style={styles.actionButton}
          onPress={onToggleStatus}
        />
      </View>
    </Card>
  );
}

/** Rounded avatar with photo fallback to initials. */
function AdminAvatar({ name, image, size = 48 }: { name?: string; image?: string; size?: number }) {
  const initials = adminInitials(name);
  if (image) {
    return (
      <Image
        source={{ uri: image }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}
interface AdminDetailsModalProps {
  admin: PlatformUser;
  hospital: Hospital | null;
  hospitalLoading: boolean;
  hospitalError: string;
  onReset: () => void;
  onToggleStatus: () => void;
  onClose: () => void;
}

/** Professional Super Admin admin details modal — real record + real hospital. */
function AdminDetailsModal({
  admin,
  hospital,
  hospitalLoading,
  hospitalError,
  onReset,
  onToggleStatus,
  onClose,
}: AdminDetailsModalProps) {
  const isActive = admin.isActive !== false;
  const hospitalKnown = Boolean(adminHospitalId(admin));
  const hospitalName = hospital?.name || hospitalNameOf(admin);
  const hospitalActive = hospital?.isActive !== false;
  const doctorCount = hospital?.doctorCount ?? hospital?.doctors?.length;
  const departments = hospital?.departments || [];
  const address = hospital
    ? [hospital.location?.address, hospital.location?.city, hospital.location?.state].filter(Boolean).join(', ')
    : '';
  const hospitalContact = hospital
    ? [hospital.contact?.reception, hospital.contact?.emergency, hospital.contact?.email].filter(Boolean).join(' · ')
    : '';

  const accountInfo = [
    { label: 'Email', value: admin.email || '—' },
    { label: 'Phone', value: admin.phone || '—' },
    { label: 'Joined', value: formatISODate(admin.createdAt) },
    { label: 'Auth provider', value: admin.authProvider || 'password' },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <Card style={styles.detailsCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AdminAvatar name={admin.name} image={admin.image} size={72} />
              <View style={styles.modalHeaderTexts}>
                <Text style={styles.detailsName} numberOfLines={2}>{admin.name || 'Hospital Admin'}</Text>
                <Text style={styles.modalEmail} numberOfLines={1}>{admin.email || 'No email'}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close details" hitSlop={8}>
                <Ionicons name="close" size={22} color={Palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.badgeRow}>
              <StatusBadge value={isActive ? 'active' : 'inactive'} />
              <Badge label="Hospital Admin" variant="primary" />
            </View>

            <View style={styles.detailGrid}>
              {accountInfo.map((item) => (
                <View key={item.label} style={styles.detailCol}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Assigned hospital</Text>
              {hospitalLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Palette.primary} size="small" />
                  <Text style={styles.sectionValue}>Loading hospital details…</Text>
                </View>
              ) : (
                <>
                  <View style={styles.hospitalRow}>
                    <Text style={styles.sectionValue} numberOfLines={2}>{hospitalName}</Text>
                    {hospitalKnown ? (
                      <Badge label={hospitalActive ? 'Active' : 'Inactive'} variant={hospitalActive ? 'success' : 'neutral'} />
                    ) : null}
                  </View>
                  {!hospitalKnown ? (
                    <Text style={styles.muted}>No hospital is assigned to this admin yet.</Text>
                  ) : null}
                  {hospital ? (
                    <>
                      {address ? (
                        <Text style={styles.muted}>
                          <Ionicons name="location-outline" size={13} color={Palette.textMuted} /> {address}
                        </Text>
                      ) : null}
                      {hospitalContact ? (
                        <Text style={styles.muted}>
                          <Ionicons name="call-outline" size={13} color={Palette.textMuted} /> {hospitalContact}
                        </Text>
                      ) : null}
                      <View style={styles.detailGrid}>
                        <View style={styles.detailCol}>
                          <Text style={styles.detailLabel}>Doctors</Text>
                          <Text style={styles.detailValue}>{doctorCount ?? '—'}</Text>
                        </View>
                        <View style={styles.detailCol}>
                          <Text style={styles.detailLabel}>Departments</Text>
                          <Text style={styles.detailValue} numberOfLines={2}>
                            {departments.length ? departments.slice(0, 4).join(', ') : '—'}
                            {departments.length > 4 ? ` +${departments.length - 4} more` : ''}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : null}
                </>
              )}
              {hospitalError ? <FormMessage type="error" message={hospitalError} /> : null}
            </View>

            <View style={styles.actionBlock}>
              <Text style={styles.blockLabel}>Admin actions</Text>
              <View style={styles.actionGrid}>
                <Button
                  title="Reset Password"
                  variant="secondary"
                  icon="key-outline"
                  style={styles.actionBtn}
                  onPress={onReset}
                />
                <Button
                  title={isActive ? 'Suspend' : 'Activate'}
                  variant={isActive ? 'danger' : 'secondary'}
                  icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  style={styles.actionBtn}
                  onPress={onToggleStatus}
                />
              </View>
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}
/** Skeleton shown while the admin list loads. */
function AdminsSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((key) => (
        <Card key={key} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, { width: 48, height: 48, borderRadius: 24 }]} />
            <View style={styles.skeletonTexts}>
              <View style={[styles.skeletonBlock, { width: '55%', height: 14 }]} />
              <View style={[styles.skeletonBlock, { width: '80%', height: 12 }]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, { width: '40%', height: 12, marginTop: Spacing.md }]} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  cardPressed: { opacity: 0.75 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header / summary
  headerWrap: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  resultText: { ...Typography.caption, color: Palette.textMuted },
  clearText: { ...Typography.bodySmall, color: Palette.primary, fontWeight: '600' },
  // Desktop table
  desktopContent: { paddingBottom: Spacing.xxxl },
  desktopPage: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tableCard: { borderColor: Palette.border },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.primaryLight,
  },
  tableHeaderCell: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableHeaderActions: { justifyContent: 'flex-end' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  tableName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  tableCell: { ...Typography.bodySmall, color: Palette.text },
  tableAdminTexts: { flex: 1, gap: 2 },
  tableEmpty: { paddingVertical: Spacing.lg },
  colAdmin: { flex: 2.6, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingRight: Spacing.sm },
  colHospital: { flex: 1.9, paddingRight: Spacing.sm },
  colPhone: { flex: 1.3, paddingRight: Spacing.sm },
  colStatus: { flex: 1.1, paddingRight: Spacing.sm },
  colCreated: { flex: 1.2, paddingRight: Spacing.sm },
  colActions: { flex: 1.3, flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.xs },
  tableIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primaryLight,
  },
  iconPressed: { opacity: 0.6, transform: [{ scale: 0.95 }] },
  // Mobile / tablet cards
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  name: { ...Typography.h4, color: Palette.text, flexShrink: 1 },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  meta: { ...Typography.caption, color: Palette.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1, minHeight: 44 },
  avatar: { backgroundColor: Palette.primaryLight },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.label, color: Palette.primaryDark, fontWeight: '700' },
  // Modal shared
  backdrop: { flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
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
  modalAdminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  modalAdminTexts: { flex: 1, gap: 1 },
  modalAdminName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  modalAdminEmail: { ...Typography.caption, color: Palette.textMuted },
  modalAdminHospital: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },
  modalBody: { gap: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  modalButton: { flex: 1 },
  eye: { padding: Spacing.sm },
  passwordHint: { ...Typography.caption, color: Palette.textMuted, lineHeight: 16 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  strengthBar: { flex: 1, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.divider },
  strengthLabel: { ...Typography.caption, color: Palette.textMuted, minWidth: 56, textAlign: 'right' },
  // Details modal
  detailsCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalContent: { padding: Spacing.xl, gap: Spacing.md },
  detailsName: { ...Typography.h4, color: Palette.text },
  modalEmail: { ...Typography.caption, color: Palette.textMuted },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  detailCol: { flex: 1, minWidth: '40%', gap: 2 },
  detailLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { ...Typography.bodySmall, color: Palette.text },
  sectionCard: {
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Palette.surface,
  },
  sectionTitle: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  sectionValue: { ...Typography.bodySmall, color: Palette.text },
  hospitalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  actionBlock: { gap: Spacing.sm },
  blockLabel: { ...Typography.label, color: Palette.text },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexGrow: 1, minWidth: 160, minHeight: 44 },
  // Skeleton
  skeletonList: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  skeletonCard: { gap: Spacing.xs },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  skeletonTexts: { flex: 1, gap: Spacing.sm },
  skeletonBlock: { backgroundColor: Palette.divider, borderRadius: Radius.sm },
});
