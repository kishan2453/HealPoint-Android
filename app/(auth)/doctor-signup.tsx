import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { HospitalSelect } from '@/components/doctor/HospitalSelect';
import { HealPointLogo } from '@/components/HealPointLogo';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AUTH_CARD_MAX_WIDTH } from '@/lib/responsive';
import { isValidEmail, isValidIndianPhone, isNonEmpty } from '@/lib/validation';
import { ApiClientError, toErrorMessage } from '@/services/api';
import { doctorSignup } from '@/services/auth';
import type { Hospital } from '@/types';

/**
 * Department categories mirror the web Doctor Panel signup; the backend
 * normalizes these into the doctor `speciality` enum server-side.
 */
const DEPARTMENTS = [
  'Cardiology',
  'Orthopedic',
  'Dentist',
  'Neurology',
  'Dermatology',
  'Pediatrics',
  'Psychiatry',
  'ENT Specialist',
  'Eye Specialist',
  'General Physician',
  'Surgeon',
] as const;

export default function DoctorSignupScreen() {
  const router = useRouter();

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    hospital?: string;
    name?: string;
    email?: string;
    phone?: string;
    department?: string;
    experience?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!hospital?._id) errors.hospital = 'Please select your hospital.';
    if (!isNonEmpty(name)) errors.name = 'Full name is required';
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isValidIndianPhone(phone)) errors.phone = 'Enter a valid 10-digit mobile number';
    if (!department) errors.department = 'Select your department';
    const years = Number(experience);
    if (!experience || !Number.isFinite(years) || years < 1 || years > 60) {
      errors.experience = 'Must be between 1 and 60 years';
    }
    if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (confirm !== password) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (loading) return;
    setGeneralError('');
    setSuccessMessage('');
    if (!validate()) return;
    if (!hospital?._id) return;

    setLoading(true);
    try {
      await doctorSignup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword: confirm,
        phone: phone.replace(/\s+/g, ''),
        hospitalId: hospital._id,
        department,
        speciality: department,
        specialization: specialization.trim() || department,
        experience: Number(experience),
      });
      setSuccessMessage('Doctor signup successful. Your account is pending hospital admin verification.');
      setLoading(false);
      // Let the success message be visible, then move to the doctor login with
      // the email pre-filled.
      setTimeout(() => {
        router.replace({ pathname: '/doctor-login', params: { registered: '1', email: email.trim() } } as never);
      }, 1600);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiClientError) {
        if (error.category === 'NETWORK' || error.category === 'TIMEOUT') {
          setGeneralError('Unable to connect to HealPoint. Please try again.');
        } else {
          // 400/409/422 — the backend's exact message (duplicate email, missing
          // field, invalid hospital) is always the most useful.
          setGeneralError(error.serverMessage || toErrorMessage(error, 'Unable to create doctor account.'));
        }
      } else {
        setGeneralError(toErrorMessage(error, 'Unable to create doctor account.'));
      }
    }
  };

  return (
    <AuthShell brand="doctor" showBack>
      <View style={styles.content}>
        <View style={styles.header}>
          <HealPointLogo size={64} badge />
          <Text style={styles.badgeText}>HealPoint Doctor Portal</Text>
          <Text style={styles.heading}>Create a doctor account</Text>
          <Text style={styles.subheading}>
            Join your hospital&apos;s clinical workspace. Your profile is verified by the hospital admin
            before you can sign in.
          </Text>
        </View>

        <View style={styles.formCard}>
          {generalError ? <FormMessage type="error" message={generalError} /> : null}
          {successMessage ? <FormMessage type="success" message={successMessage} /> : null}

          <HospitalSelect
            label="Hospital"
            placeholder="Select your hospital"
            value={hospital?._id || ''}
            error={fieldErrors.hospital}
            onChange={(next) => {
              setHospital(next);
              setFieldErrors((errors) => ({ ...errors, hospital: undefined }));
            }}
          />

          <Input
            label="Doctor name"
            placeholder="Dr. Full Name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setFieldErrors((errors) => ({ ...errors, name: undefined }));
            }}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={fieldErrors.name}
            variant="filled"
          />

          <Input
            label="Email"
            placeholder="doctor@hospital.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((errors) => ({ ...errors, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            leftIcon="mail-outline"
            error={fieldErrors.email}
            variant="filled"
          />

          <Input
            label="Mobile number"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={(value) => {
              setPhone(value.replace(/[^\d]/g, '').slice(0, 10));
              setFieldErrors((errors) => ({ ...errors, phone: undefined }));
            }}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            leftIcon="call-outline"
            error={fieldErrors.phone}
            variant="filled"
          />

          <View style={styles.departmentRow}>
            <Text style={styles.fieldLabel}>Department / Category</Text>
            <View style={styles.chipWrap}>
              {DEPARTMENTS.map((item) => {
                const active = department === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item}
                    onPress={() => {
                      setDepartment(item);
                      setFieldErrors((errors) => ({ ...errors, department: undefined }));
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            {fieldErrors.department ? <Text style={styles.error}>{fieldErrors.department}</Text> : null}
          </View>

          <Input
            label="Specialization"
            placeholder="e.g. Interventional Cardiology"
            value={specialization}
            onChangeText={setSpecialization}
            autoCapitalize="words"
            leftIcon="school-outline"
            variant="filled"
          />

          <Input
            label="Years of experience"
            placeholder="e.g. 10"
            value={experience}
            onChangeText={(value) => {
              setExperience(value.replace(/[^\d]/g, '').slice(0, 2));
              setFieldErrors((errors) => ({ ...errors, experience: undefined }));
            }}
            keyboardType="number-pad"
            leftIcon="time-outline"
            error={fieldErrors.experience}
            variant="filled"
          />

          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((errors) => ({ ...errors, password: undefined }));
            }}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            leftIcon="lock-closed-outline"
            error={fieldErrors.password}
            variant="filled"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          <Input
            label="Confirm password"
            placeholder="Re-enter password"
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              setFieldErrors((errors) => ({ ...errors, confirm: undefined }));
            }}
            secureTextEntry={!showConfirm}
            textContentType="newPassword"
            leftIcon="lock-closed-outline"
            error={fieldErrors.confirm}
            variant="filled"
            rightSlot={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={8}
                style={styles.visibilityButton}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Palette.textMuted}
                />
              </Pressable>
            }
          />

          <Button
            title="Create Doctor Account"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            icon="person-add-outline"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have a doctor account?</Text>
          <Pressable
            onPress={() => router.push('/doctor-login' as never)}
            hitSlop={8}
            style={styles.footerButton}
          >
            <Text style={styles.footerLink}>Login</Text>
            <Ionicons name="arrow-forward" size={16} color={Palette.primary} />
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  badgeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
  },
  heading: {
    ...Typography.h1,
    color: Palette.text,
    marginTop: Spacing.xs,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subheading: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 340,
  },
  formCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: AUTH_CARD_MAX_WIDTH,
    alignSelf: 'center',
    ...Shadows.card,
  },
  departmentRow: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  chipActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Palette.primaryDark,
  },
  error: {
    ...Typography.caption,
    color: Palette.error,
  },
  visibilityButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLink: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: '700',
  },
});