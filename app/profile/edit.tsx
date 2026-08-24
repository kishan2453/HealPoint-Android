import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { getUserImage } from '@/lib/image';
import { isValidIndianPhone } from '@/lib/validation';
import { toErrorMessage } from '@/services/api';

const GENDERS = ['Male', 'Female', 'Other'];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateStoredProfile } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [image, setImage] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setDob(user?.dob || '');
    setGender(user?.gender || '');
    setAddress(user?.address || '');
  }, [user]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setImage({ uri: asset.uri, name: asset.fileName || 'profile.jpg', type: asset.mimeType || 'image/jpeg' });
    setError('');
  };

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      setError('Enter a valid 10-digit Indian phone number.');
      return;
    }
    setSaving(true);
    try {
      await updateStoredProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        dob: dob.trim() || undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        image,
      });
      router.back();
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to save your profile. Please try again.'));
      setSaving(false);
    }
  };

  const currentAvatar = image?.uri || getUserImage(user?.image);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Edit profile</Text>
          </View>
        </View>

        {error ? <FormMessage type="error" message={error} /> : null}

        {/* Photo picker */}
        <View style={styles.photoWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={pickImage}>
            <Image source={{ uri: currentAvatar }} style={styles.avatar} contentFit="cover" transition={200} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={18} color={Palette.white} />
            </View>
          </Pressable>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" containerStyle={{ marginTop: Spacing.lg }} />
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
        />
        <Input
          label="Date of birth"
          value={dob}
          onChangeText={setDob}
          placeholder="DD-MM-YYYY"
          autoCapitalize="none"
        />

        <Text style={styles.genderLabel}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((option) => {
            const active = gender === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setGender(option)}
                style={[styles.genderChip, active && styles.genderChipActive]}
              >
                <Text style={[styles.genderText, active && styles.genderTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, city, state"
          multiline
          style={styles.addressInput}
        />

        <Button title="Save changes" onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
  },
  photoWrap: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Palette.primaryLight,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  photoHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: Spacing.sm,
  },
  genderLabel: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  genderChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  genderChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  genderText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  genderTextActive: {
    color: Palette.white,
    fontWeight: '600',
  },
  addressInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});