/**
 * HealPoint - Super Admin · Hospital Details.
 *
 * Professional view of one REAL hospital. Every value comes from an existing
 * backend endpoint:
 *   - profile/contact/departments from the authenticated `/hospital/get-details`
 *     (works for active AND inactive hospitals)
 *   - doctors scoped to THIS hospital from `/doctor/get-all?hospitalId=...`
 *   - subscription from `/subscription` (matched by hospital id/name)
 *   - appointments scoped to this hospital from `/appointment/get-all?platform=1`
 *   - assigned Hospital Admin(s) from `/user/admin/admins` (hospital-scoped)
 *
 * Data from Hospital A is never shown under Hospital B: doctors are requested
 * with the `hospitalId` filter, appointments are matched by the hospital id
 * (or name as a strict fallback) and admins are matched by their real
 * `hospitalId` of THIS record only.
 *
 * Super Admin lifecycle actions (Activate/Suspend via `/hospital/:id/status`,
 * Edit via `/hospital/:id`) are real backend calls with confirmation dialogs.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
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
import {
  appointmentStatusBadge,
  paymentStatusBadge,
  StatusBadge,
  subscriptionStatusBadge,
  verificationStatusBadge,
} from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatISODate } from '@/lib/format';
import { getHospitalImage } from '@/lib/image';
import { isValidEmail, isValidIndianPhone } from '@/lib/validation';
import { billingCycleLabel, planPriceLabel, remainingDaysLabel, subscriptionDurationLabel } from '@/lib/subscription';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import { getAllDoctors } from '@/services/doctors';
import { getAdminHospitalDetails, setHospitalActive, updateHospital } from '@/services/hospitals';
import * as subscriptionService from '@/services/subscriptions';
import { getAdminList } from '@/services/users';
import type { Appointment, Doctor, Hospital, PlatformUser, Subscription } from '@/types';

/** Find the subscription record that belongs to this hospital (real data match). */
function matchSubscription(subs: Subscription[], hospital: Hospital): Subscription | null {
  const hid = String(hospital._id);
  const name = hospital.name;
  return (
    subs.find((s) => {
      if (typeof s.hospitalId === 'object' && s.hospitalId?._id) return String(s.hospitalId._id) === hid;
      if (typeof s.hospitalId === 'string') return s.hospitalId === hid;
      return false;
    }) ||
    subs.find((s) => s.hospital?.name === name || s.hospitalName === name) ||
    null
  );
}

/** Keep only appointments that belong to this hospital. */
function appointmentsForHospital(appts: Appointment[], hospital: Hospital): Appointment[] {
  const hid = String(hospital._id);
  const name = hospital.name;
  return appts.filter((a) => {
    if (typeof a.hospitalId === 'object' && a.hospitalId?._id) return String(a.hospitalId._id) === hid;
    if (typeof a.hospitalId === 'string') return a.hospitalId === hid;
    return a.hospitalName === name;
  });
}

function appointmentDoctorName(item: Appointment): string {
  if (typeof item.doctorId === 'object' && item.doctorId?.name) return item.doctorId.name;
  return 'Doctor';
}
export default function SuperAdminHospitalDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [admins, setAdmins] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Edit-hospital modal state.
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', address: '', city: '', state: '', pincode: '',
    phone: '', email: '', website: '', about: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Status toggle confirmation state.
  const [statusConfirm, setStatusConfirm] = useState<{ activate: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    if (!id) return;
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [res, adminRes] = await Promise.all([
        getAdminHospitalDetails(id),
        getAdminList().catch(() => ({ admins: [] as PlatformUser[] })),
      ]);
      const hospitalData = res.hospital || null;
      setHospital(hospitalData);
      const allAdmins = adminRes.admins || [];
      setAdmins(allAdmins.filter((a) => {
        const adminHospital = a.hospital ?? (typeof a.hospitalId === 'object' ? a.hospitalId : null);
        return adminHospital && typeof adminHospital === 'object' && String(adminHospital._id) === String(id);
      }));

      // Real platform doctors scoped to THIS hospital (server-side filter).
      try {
        const docRes = await getAllDoctors({ hospitalId: id, platform: true, limit: 100 });
        const scoped = docRes.doctors || [];
        const merged = [...(hospitalData?.doctors || [])];
        scoped.forEach((d) => {
          if (!merged.some((m) => String(m._id) === String(d._id))) merged.push(d);
        });
        setDoctors(merged);
      } catch {
        setDoctors(hospitalData?.doctors || []);
      }

      // Real appointments for this hospital only.
      try {
        const apptRes = await appointmentService.getAllAdminAppointments({ platform: true, limit: 200 });
        setAppointments(appointmentsForHospital(apptRes.appointments || [], hospitalData || ({} as Hospital)));
      } catch {
        setAppointments([]);
      }

      // Real subscription matched to this hospital.
      try {
        const subsRes = await subscriptionService.getSubscriptions({ limit: 500 });
        setSubscription(matchSubscription(subsRes.subscriptions || [], hospitalData || ({} as Hospital)));
      } catch {
        setSubscription(null);
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load hospital details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit() {
    if (!hospital) return;
    const loc = hospital.location;
    const con = hospital.contact;
    setEditForm({
      name: hospital.name || '',
      address: loc?.address || '',
      city: loc?.city || '',
      state: loc?.state || '',
      pincode: loc?.pincode || '',
      phone: con?.reception || con?.emergency || '',
      email: con?.email || '',
      website: con?.website || '',
      about: hospital.about || '',
    });
    setEditError('');
    setEditSuccess('');
    setEditOpen(true);
  }

  const setEditField = (key: keyof typeof editForm) => (value: string) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setEditError('');
    setEditSuccess('');
  };

  async function submitEdit() {
    if (!hospital) return;
    const f = editForm;
    if (!f.name.trim() || !f.address.trim() || !f.city.trim() || !f.state.trim() || !f.pincode.trim()) {
      setEditError('Hospital name and complete location details are required.');
      return;
    }
    if (!isValidEmail(f.email)) { setEditError('Please enter a valid hospital email address.'); return; }
    if (!isValidIndianPhone(f.phone)) { setEditError('Please enter a valid 10-digit Indian phone number.'); return; }
    setEditSubmitting(true);
    setEditError('');
    setEditSuccess('');
    try {
      await updateHospital(String(hospital._id), {
        name: f.name.trim(),
        address: f.address.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        pincode: f.pincode.trim(),
        mapsUrl: hospital.location?.mapsUrl || '',
        phone: f.phone.trim(),
        email: f.email.trim().toLowerCase(),
        website: f.website.trim(),
        about: f.about.trim(),
      });
      setEditSuccess('Hospital updated successfully.');
      setEditSubmitting(false);
      load();
      setTimeout(() => {
        setEditOpen(false);
        setEditSuccess('');
      }, 1400);
    } catch (err) {
      setEditError(toErrorMessage(err, 'Unable to update hospital.'));
      setEditSubmitting(false);
    }
  }

  async function runStatus() {
    if (!statusConfirm || !hospital) return;
    const activate = statusConfirm.activate;
    setStatusLoading(true);
    try {
      await setHospitalActive(String(hospital._id), activate);
      setStatusConfirm(null);
      load();
    } catch (err) {
      setError(toErrorMessage(err, activate ? 'Unable to activate hospital.' : 'Unable to suspend hospital.'));
      setStatusConfirm(null);
    } finally {
      setStatusLoading(false);
    }
  }

  const location = hospital?.location;
  const contact = hospital?.contact;
  const address = [location?.address, location?.city, location?.state, location?.pincode].filter(Boolean).join(', ');
  const departments = hospital?.departments || [];
  const phone = contact?.reception || contact?.emergency || '';
  const hospitalAppointments = appointmentsForHospital(appointments, hospital || ({} as Hospital));
  const paidAppointments = hospitalAppointments.filter((a) => a.paymentStatus === 'paid');
  const subscriptionPayments = subscription?.payments || [];
  const totalPaid = subscriptionPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const isActive = hospital?.isActive !== false;
  const logoUrl = getHospitalImage(hospital?.logo);
return (
    <AdminModuleScreen
      title="Hospital Details"
      subtitle={hospital?.name || 'Hospital'}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        {/* ---- Profile ---- */}
        <Card padded>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.hospitalLogo} contentFit="cover" transition={200} />
          ) : null}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{hospital?.name || 'Hospital'}</Text>
            <Badge label={isActive ? 'Active' : 'Inactive'} variant={isActive ? 'success' : 'neutral'} />
          </View>
          {address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color={Palette.textMuted} />
              <Text style={styles.muted}>{address}</Text>
            </View>
          ) : null}
          {phone || contact?.email ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color={Palette.textMuted} />
              <Text style={styles.muted}>
                {phone ? ` ${phone}` : ''}
                {contact?.email ? `  ${contact.email}` : ''}
              </Text>
            </View>
          ) : null}
          {hospital?.about ? <Text style={styles.body}>{hospital.about}</Text> : null}
          <View style={styles.actionButtons}>
            <Button
              title="Edit Hospital"
              variant="secondary"
              fullWidth={false}
              icon="create-outline"
              style={styles.actionButton}
              onPress={openEdit}
            />
            <Button
              title={isActive ? 'Suspend' : 'Activate'}
              variant={isActive ? 'danger' : 'secondary'}
              fullWidth={false}
              icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
              style={styles.actionButton}
              onPress={() => setStatusConfirm({ activate: !isActive })}
            />
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{doctors.length}</Text>
              <Text style={styles.statLabel}>Doctors</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{departments.length}</Text>
              <Text style={styles.statLabel}>Departments</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{Number(hospital?.rating || 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </Card>
{/* ---- Subscription ---- */}
        <Card padded>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.sectionTitle}>Subscription</Text>
          </View>
          {!subscription ? (
            <Text style={styles.muted}>No subscription record for this hospital yet.</Text>
          ) : (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current plan</Text>
                <Text style={styles.detailValue}>{subscription.planName || subscription.planKey || 'Plan'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>{planPriceLabel(subscription)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Billing period</Text>
                <Text style={styles.detailValue}>{billingCycleLabel(subscription.billingCycle)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{subscriptionDurationLabel(subscription.startDate, subscription.expiryDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start date</Text>
                <Text style={styles.detailValue}>{formatISODate(subscription.startDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expiry / renewal</Text>
                <Text style={styles.detailValue}>{formatISODate(subscription.expiryDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <StatusBadge value={subscription.status} variant={subscriptionStatusBadge(subscription.status)} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment</Text>
                <Badge label={String(subscription.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(subscription.paymentStatus)} />
              </View>
              <Text style={styles.remaining}>{remainingDaysLabel(subscription.expiryDate)}</Text>

              {subscriptionPayments.length > 0 ? (
                <View style={styles.subBlock}>
                  <Text style={styles.subBlockTitle}>Payment history</Text>
                  {subscriptionPayments.slice(0, 5).map((payment, index) => (
                    <View key={String(payment._id || index)} style={styles.paymentRow}>
                      <View style={styles.paymentTexts}>
                        <Text style={styles.paymentAmount}>{formatINR(payment.amount)}</Text>
                        <Text style={styles.paymentDate}>
                          {payment.paidAt ? formatISODate(payment.paidAt) : formatISODate(payment.createdAt)}
                        </Text>
                      </View>
                      <Badge label={String(payment.paymentStatus || 'n/a').toUpperCase()} variant={paymentStatusBadge(payment.paymentStatus)} />
                    </View>
                  ))}
                  {totalPaid > 0 ? (
                    <Text style={styles.paymentTotal}>Total paid {formatINR(totalPaid)}</Text>
                  ) : null}
                </View>
              ) : null}

              <Button
                title="Manage subscription"
                variant="secondary"
                icon="card-outline"
                style={styles.manageButton}
                onPress={() => router.push(`/super-admin/subscription/${subscription._id}` as never)}
              />
            </>
          )}
        </Card>
{/* ---- Departments ---- */}
        <Card padded>
          <View style={styles.sectionHeader}>
            <Ionicons name="layers-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.sectionTitle}>Departments</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{departments.length}</Text>
            </View>
          </View>
          {departments.length === 0 ? (
            <Text style={styles.muted}>No departments listed for this hospital.</Text>
          ) : (
            <View style={styles.chipRow}>
              {departments.map((name) => (
                <View key={String(name)} style={styles.chip}>
                  <Ionicons name="pulse-outline" size={13} color={Palette.primaryDark} />
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ---- Hospital Admins (assigned to THIS hospital) ---- */}
        <Card padded>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.sectionTitle}>Hospital Admins</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{admins.length}</Text>
            </View>
          </View>
          {admins.length === 0 ? (
            <Text style={styles.muted}>No Hospital Admin assigned to this hospital.</Text>
          ) : (
            admins.map((admin) => (
              <View key={String(admin._id)} style={styles.doctorRow}>
                <View style={styles.doctorAvatar}>
                  <Ionicons name="person-outline" size={20} color={Palette.primaryDark} />
                </View>
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName} numberOfLines={1}>{admin.name || 'Hospital Admin'}</Text>
                  <Text style={styles.doctorSpecialty} numberOfLines={1}>{admin.email || 'No email'}</Text>
                  <View style={styles.doctorMetaRow}>
                    <Badge label={admin.isActive === false ? 'Inactive' : 'Active'} variant={admin.isActive === false ? 'neutral' : 'success'} />
                  </View>
                </View>
              </View>
            ))
          )}
          <Button
            title="Manage Hospital Admins"
            variant="secondary"
            fullWidth={false}
            icon="people-outline"
            style={styles.manageButton}
            onPress={() => router.push('/super-admin/admins')}
          />
        </Card>

        {/* ---- Doctors (this hospital only) ---- */}
        <Card padded>
          <View style={styles.sectionHeader}>
            <Ionicons name="medkit-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.sectionTitle}>Doctors</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{doctors.length}</Text>
            </View>
          </View>
          {doctors.length === 0 ? (
            <Text style={styles.muted}>No doctors listed for this hospital.</Text>
          ) : (
            doctors.map((doctor) => (
              <View key={String(doctor._id)} style={styles.doctorRow}>
                <View style={styles.doctorAvatar}>
                  <Ionicons name="person-outline" size={20} color={Palette.primaryDark} />
                </View>
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName} numberOfLines={1}>{doctor.name}</Text>
                  <Text style={styles.doctorSpecialty} numberOfLines={1}>
                    {doctor.speciality || doctor.department || doctor.specialization || 'General'}
                  </Text>
                  <View style={styles.doctorMetaRow}>
                    {doctor.fees != null ? <Text style={styles.doctorFee}>{formatINR(doctor.fees)}</Text> : null}
                    {doctor.verificationStatus ? (
                      <StatusBadge value={doctor.verificationStatus} variant={verificationStatusBadge(doctor.verificationStatus)} />
                    ) : (
                      <Badge label={doctor.isActive === false ? 'Inactive' : 'Active'} variant={doctor.isActive === false ? 'neutral' : 'success'} />
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </Card>
{/* ---- Appointments (this hospital only) ---- */}
        <Card padded>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={Palette.primaryDark} />
            <Text style={styles.sectionTitle}>Appointments</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{hospitalAppointments.length}</Text>
            </View>
          </View>
          {hospitalAppointments.length === 0 ? (
            <Text style={styles.muted}>No appointments booked at this hospital yet.</Text>
          ) : (
            <>
              <View style={styles.paymentSummary}>
                <View style={styles.paymentSummaryCol}>
                  <Text style={styles.paymentSummaryValue}>{hospitalAppointments.filter((a) => a.status === 'pending').length}</Text>
                  <Text style={styles.paymentSummaryLabel}>Pending</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.paymentSummaryCol}>
                  <Text style={styles.paymentSummaryValue}>{hospitalAppointments.filter((a) => a.status === 'completed').length}</Text>
                  <Text style={styles.paymentSummaryLabel}>Completed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.paymentSummaryCol}>
                  <Text style={styles.paymentSummaryValue}>{paidAppointments.length}</Text>
                  <Text style={styles.paymentSummaryLabel}>Paid</Text>
                </View>
              </View>
              {hospitalAppointments.slice(0, 5).map((item) => (
                <View key={String(item._id)} style={styles.appointmentRow}>
                  <View style={styles.appointmentTexts}>
                    <Text style={styles.appointmentDoctor} numberOfLines={1}>{appointmentDoctorName(item)}</Text>
                    <Text style={styles.appointmentMeta} numberOfLines={1}>
                      {item.slotDate || 'date unknown'} · {item.slotTime || ''} · {formatINR(item.amount)}
                    </Text>
                  </View>
                  <StatusBadge value={item.status} variant={appointmentStatusBadge(item.status)} />
                </View>
              ))}
              {hospitalAppointments.length > 5 ? (
                <Text style={styles.moreAppointments}>
                  + {hospitalAppointments.length - 5} more appointment(s)
                </Text>
              ) : null}
            </>
          )}
        </Card>
      </ScrollView>

      {/* ---- Edit Hospital modal ---- */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => !editSubmitting && setEditOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !editSubmitting && setEditOpen(false)} accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIcon}>
                  <Ionicons name="create-outline" size={22} color={Palette.primaryDark} />
                </View>
                <View style={styles.modalHeaderTexts}>
                  <Text style={styles.modalTitle}>Edit Hospital</Text>
                  <Text style={styles.modalSubtitle}>Update the details for {hospital?.name || 'this hospital'}</Text>
                </View>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldGroupTitle}>Hospital details</Text>
                <Input label="Hospital name *" value={editForm.name} onChangeText={setEditField('name')} placeholder="e.g. Anand Hospital" />
                <Input label="Address *" value={editForm.address} onChangeText={setEditField('address')} placeholder="Street, area" />
                <View style={styles.rowInputs}>
                  <Input label="City *" value={editForm.city} onChangeText={setEditField('city')} containerStyle={styles.rowInputFlex} />
                  <Input label="State *" value={editForm.state} onChangeText={setEditField('state')} containerStyle={styles.rowInputFlex} />
                </View>
                <View style={styles.rowInputs}>
                  <Input label="Pincode *" value={editForm.pincode} onChangeText={setEditField('pincode')} containerStyle={styles.rowInputFlex} keyboardType="number-pad" />
                  <Input label="Phone *" value={editForm.phone} onChangeText={setEditField('phone')} containerStyle={styles.rowInputFlex} keyboardType="phone-pad" />
                </View>
                <Input label="Email *" value={editForm.email} onChangeText={setEditField('email')} autoCapitalize="none" keyboardType="email-address" />
                <Input label="Website" value={editForm.website} onChangeText={setEditField('website')} autoCapitalize="none" keyboardType="url" />
                <Input label="About" value={editForm.about} onChangeText={setEditField('about')} multiline numberOfLines={3} />

                {editError ? <FormMessage type="error" message={editError} /> : null}
                {editSuccess ? <FormMessage type="success" message={editSuccess} /> : null}
              </ScrollView>

              <View style={styles.modalActions}>
                <Button title="Cancel" variant="outline" onPress={() => setEditOpen(false)} disabled={editSubmitting} style={styles.modalButton} />
                <Button
                  title="Save Changes"
                  variant="primary"
                  icon="checkmark-circle-outline"
                  loading={editSubmitting}
                  onPress={submitEdit}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---- Suspend / Activate confirmation ---- */}
      <ConfirmDialog
        visible={Boolean(statusConfirm)}
        title={statusConfirm?.activate ? 'Activate hospital?' : 'Suspend hospital?'}
        message={
          statusConfirm?.activate
            ? `${hospital?.name || 'This hospital'} will become active and patients will be able to find and book it again.`
            : `${hospital?.name || 'This hospital'} will no longer be discoverable or bookable by patients until reactivated. Doctors and data are preserved.`
        }
        confirmLabel={statusConfirm?.activate ? 'Activate' : 'Suspend'}
        tone={statusConfirm?.activate ? 'primary' : 'danger'}
        loading={statusLoading}
        onConfirm={runStatus}
        onCancel={() => setStatusConfirm(null)}
      />
    </AdminModuleScreen>
  );
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  hospitalLogo: { width: 64, height: 64, borderRadius: Radius.md, marginBottom: Spacing.md, backgroundColor: Palette.primaryLight },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.h4, color: Palette.text, flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: Spacing.xs },
  muted: { ...Typography.bodySmall, color: Palette.textMuted, flex: 1 },
  body: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20, marginTop: Spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  statCol: { flex: 1, gap: 2 },
  statValue: { ...Typography.h3, color: Palette.text },
  statLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 36, backgroundColor: Palette.border, marginHorizontal: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.text, flex: 1 },
  sectionCount: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: Palette.primaryLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  sectionCountText: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Palette.divider, gap: Spacing.md },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text, flexShrink: 1, textAlign: 'right' },
  remaining: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.sm },
  manageButton: { marginTop: Spacing.md },
  subBlock: { marginTop: Spacing.md, gap: Spacing.sm },
  subBlockTitle: { ...Typography.caption, color: Palette.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Palette.divider, gap: Spacing.md },
  paymentTexts: { flex: 1, gap: 2 },
  paymentAmount: { ...Typography.bodyMedium, color: Palette.text },
  paymentDate: { ...Typography.caption, color: Palette.textMuted },
  paymentTotal: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chipText: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  doctorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.primaryLight, alignItems: 'center', justifyContent: 'center' },
  doctorInfo: { flex: 1, gap: 2 },
  doctorName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  doctorSpecialty: { ...Typography.caption, color: Palette.textMuted },
  doctorMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  doctorFee: { ...Typography.caption, color: Palette.text, fontWeight: '700' },
  actionButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  actionButton: { flex: 1, minHeight: 44 },
  // Edit modal
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
  rowInputs: { flexDirection: 'row', gap: Spacing.md },
  rowInputFlex: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.xl, paddingTop: Spacing.md },
  modalButton: { flex: 1 },
  paymentSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  paymentSummaryCol: { flex: 1, gap: 2, alignItems: 'center' },
  paymentSummaryValue: { ...Typography.h3, color: Palette.text },
  paymentSummaryLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  appointmentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Palette.divider },
  appointmentTexts: { flex: 1, gap: 2 },
  appointmentDoctor: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  appointmentMeta: { ...Typography.caption, color: Palette.textMuted },
  moreAppointments: { ...Typography.caption, color: Palette.primary, fontWeight: '600', marginTop: Spacing.sm, textAlign: 'center' },
});