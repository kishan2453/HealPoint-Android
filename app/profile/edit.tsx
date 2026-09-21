/**
 * HealPoint - Edit Patient Profile.
 *
 * Allows updating real personal and clinical fields supported by the backend:
 * - Full name, phone, date of birth, gender, residential address
 * - Real medical profile: blood group, known allergies, chronic health conditions
 * - Profile photo upload with 1:1 crop, preview, and safe state handling
 *
 * 100% Real Backend Data: Persists directly to MongoDB via PATCH /api/v1/user/update/:id.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { getUserImage } from "@/lib/image";
import { isValidIndianPhone } from "@/lib/validation";
import { toErrorMessage } from "@/services/api";

const GENDERS = ["Male", "Female", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateStoredProfile } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState("");

  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  const [image, setImage] = useState<{
    uri: string;
    name?: string;
    type?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setDob(user?.dob || "");
    setGender(user?.gender || "");
    setAddress(user?.address || "");
    setBloodGroup(user?.bloodGroup || "");
    setAllergies(Array.isArray(user?.allergies) ? user.allergies : []);
    setChronicConditions(
      Array.isArray(user?.chronicConditions) ? user.chronicConditions : [],
    );
    setEmergencyName(user?.emergencyContact?.name || "");
    setEmergencyPhone(user?.emergencyContact?.phone || "");
    setEmergencyRelation(user?.emergencyContact?.relation || "");
  }, [user]);

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Photo library permission is required to update your profile photo.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        name: asset.fileName || "profile.jpg",
        type: asset.mimeType || "image/jpeg",
      });
      setError("");
    } catch {
      setError("Unable to select photo. Please try again.");
    }
  };

  const handleAddAllergy = () => {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (!allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed]);
    }
    setNewAllergy("");
  };

  const handleRemoveAllergy = (index: number) => {
    setAllergies((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCondition = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (!chronicConditions.includes(trimmed)) {
      setChronicConditions((prev) => [...prev, trimmed]);
    }
    setNewCondition("");
  };

  const handleRemoveCondition = (index: number) => {
    setChronicConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      setError("Enter a valid 10-digit Indian phone number.");
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
        bloodGroup: bloodGroup || undefined,
        allergies: allergies.length > 0 ? allergies : undefined,
        chronicConditions:
          chronicConditions.length > 0 ? chronicConditions : undefined,
        emergencyContact:
          emergencyName.trim() || emergencyPhone.trim()
            ? {
                name: emergencyName.trim(),
                phone: emergencyPhone.trim(),
                relation: emergencyRelation.trim(),
              }
            : undefined,
        image,
      });
      setSuccess(true);
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(drawer)/profile");
        }
      }, 600);
    } catch (err) {
      setError(
        toErrorMessage(err, "Unable to save your profile. Please try again."),
      );
      setSaving(false);
    }
  };

  const currentAvatar = image?.uri || getUserImage(user?.image);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Bar */}
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/(drawer)/profile")
              }
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={Palette.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Edit Health Profile</Text>
              <Text style={styles.headerSubtitle}>
                Personal details & clinical profile
              </Text>
            </View>
          </View>

          {error ? <FormMessage type="error" message={error} /> : null}
          {success ? (
            <FormMessage
              type="success"
              message="Profile updated successfully! Saving changes..."
            />
          ) : null}

          {/* Profile Photo Picker */}
          <View style={styles.photoWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={pickImage}
              style={({ pressed }) => [
                styles.avatarPressable,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatarRing}>
                {currentAvatar ? (
                  <Image
                    source={{ uri: currentAvatar }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>
                      {name ? name.slice(0, 2).toUpperCase() : "HP"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color={Palette.white} />
              </View>
            </Pressable>
            <Text style={styles.photoHint}>Tap avatar to upload photo</Text>
          </View>

          {/* ---------------- Section 1: Personal Information ---------------- */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="person-outline"
                size={18}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Personal Details</Text>
            </View>

            <Input
              label="Full Name *"
              value={name}
              onChangeText={setName}
              placeholder="Your official full name"
              autoCapitalize="words"
            />

            <Input
              label="Mobile Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Input
              label="Date of Birth (DD-MM-YYYY)"
              value={dob}
              onChangeText={setDob}
              placeholder="e.g. 15-08-1992"
              autoCapitalize="none"
            />

            {/* Gender Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.chipsRow}>
                {GENDERS.map((option) => {
                  const active = gender.toLowerCase() === option.toLowerCase();
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setGender(option)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Address */}
            <Input
              label="Residential Address"
              value={address}
              onChangeText={setAddress}
              placeholder="House/flat, street, city, state, pincode"
              multiline
              style={styles.addressInput}
            />
          </Card>

          {/* ---------------- Section 2: Clinical & Medical Profile ---------------- */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="heart-circle-outline"
                size={20}
                color={Palette.error}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>
                  Clinical & Medical Profile
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Helps doctors prescribe safely during consultations
                </Text>
              </View>
            </View>

            {/* Blood Group */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelWithIcon}>
                <Ionicons name="water" size={14} color={Palette.error} />
                <Text style={styles.fieldLabel}>Blood Group</Text>
              </View>
              <View style={styles.bloodChipsGrid}>
                {BLOOD_GROUPS.map((bg) => {
                  const active = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setBloodGroup(active ? "" : bg)}
                      style={[
                        styles.bloodChip,
                        active && styles.bloodChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bloodChipText,
                          active && styles.bloodChipTextActive,
                        ]}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Known Allergies */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelWithIcon}>
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color="#E89A3C"
                />
                <Text style={styles.fieldLabel}>Known Allergies</Text>
              </View>

              {allergies.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {allergies.map((allergy, index) => (
                    <View key={`${allergy}-${index}`} style={styles.tagBadge}>
                      <Text style={styles.tagText}>{allergy}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${allergy}`}
                        onPress={() => handleRemoveAllergy(index)}
                        hitSlop={6}
                        style={styles.tagRemoveBtn}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>
                  No allergies specified. Add if any (e.g. Penicillin, Peanuts,
                  Latex).
                </Text>
              )}

              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  value={newAllergy}
                  onChangeText={setNewAllergy}
                  placeholder="e.g. Penicillin, Sulfa, Dust"
                  placeholderTextColor={Palette.textMuted}
                  onSubmitEditing={handleAddAllergy}
                  returnKeyType="done"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add Allergy"
                  onPress={handleAddAllergy}
                  disabled={!newAllergy.trim()}
                  style={({ pressed }) => [
                    styles.tagAddBtn,
                    !newAllergy.trim() && styles.tagAddBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagAddBtnText,
                      !newAllergy.trim() && styles.tagAddBtnTextDisabled,
                    ]}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Chronic Health Conditions */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelWithIcon}>
                <Ionicons
                  name="pulse-outline"
                  size={14}
                  color={Palette.primaryDark}
                />
                <Text style={styles.fieldLabel}>Chronic Health Conditions</Text>
              </View>

              {chronicConditions.length > 0 ? (
                <View style={styles.tagsContainer}>
                  {chronicConditions.map((condition, index) => (
                    <View
                      key={`${condition}-${index}`}
                      style={[styles.tagBadge, styles.conditionBadge]}
                    >
                      <Text style={[styles.tagText, styles.conditionText]}>
                        {condition}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${condition}`}
                        onPress={() => handleRemoveCondition(index)}
                        hitSlop={6}
                        style={styles.tagRemoveBtn}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={Palette.primary}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>
                  No chronic conditions specified (e.g. Hypertension, Diabetes,
                  Asthma).
                </Text>
              )}

              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  value={newCondition}
                  onChangeText={setNewCondition}
                  placeholder="e.g. Hypertension, Diabetes"
                  placeholderTextColor={Palette.textMuted}
                  onSubmitEditing={handleAddCondition}
                  returnKeyType="done"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add Chronic Condition"
                  onPress={handleAddCondition}
                  disabled={!newCondition.trim()}
                  style={({ pressed }) => [
                    styles.tagAddBtn,
                    !newCondition.trim() && styles.tagAddBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagAddBtnText,
                      !newCondition.trim() && styles.tagAddBtnTextDisabled,
                    ]}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>
            </View>
          </Card>

          {/* Emergency Contact */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call-outline" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Emergency Contact</Text>
                <Text style={styles.sectionSubtitle}>
                  Primary contact person to notify in case of medical emergency
                </Text>
              </View>
            </View>

            <Input
              label="Contact Person Name"
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="e.g. Ramesh Patel, Dr. Anita"
              autoCapitalize="words"
            />

            <Input
              label="Contact Phone Number"
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              maxLength={15}
            />

            <Input
              label="Relationship"
              value={emergencyRelation}
              onChangeText={setEmergencyRelation}
              placeholder="e.g. Spouse, Parent, Sibling, Guardian, Friend"
              autoCapitalize="words"
            />
          </Card>

          {/* Save Action */}
          <Button
            title={saving ? "Saving Changes..." : "Save Profile Changes"}
            onPress={save}
            loading={saving}
            icon="checkmark-outline"
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  keyboard: {
    flex: 1,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  photoWrap: {
    alignItems: "center",
    marginVertical: Spacing.xs,
  },
  avatarPressable: {
    position: "relative",
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(14, 159, 142, 0.35)",
    overflow: "hidden",
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 96,
    height: 96,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primaryLight,
  },
  avatarInitials: {
    ...Typography.h3,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  photoHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: Spacing.xs,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    fontSize: 15,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 1,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  labelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  chipsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  chip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "600",
  },
  addressInput: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  bloodChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  bloodChip: {
    minWidth: 54,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bloodChipActive: {
    backgroundColor: "rgba(225, 29, 72, 0.12)",
    borderColor: Palette.error,
  },
  bloodChipText: {
    ...Typography.label,
    color: Palette.textMuted,
  },
  bloodChipTextActive: {
    color: Palette.error,
    fontWeight: "700",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginVertical: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(232, 154, 60, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(232, 154, 60, 0.3)",
  },
  conditionBadge: {
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    borderColor: "rgba(14, 159, 142, 0.3)",
  },
  tagText: {
    ...Typography.caption,
    color: "#B45309",
    fontWeight: "600",
  },
  conditionText: {
    color: Palette.primaryDark,
  },
  tagRemoveBtn: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyNote: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
    marginVertical: 2,
  },
  tagInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
    marginTop: 4,
  },
  tagInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Palette.surface,
    ...Typography.bodySmall,
    color: Palette.text,
  },
  tagAddBtn: {
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tagAddBtnDisabled: {
    backgroundColor: Palette.border,
  },
  tagAddBtnText: {
    ...Typography.label,
    color: Palette.white,
    fontWeight: "600",
  },
  tagAddBtnTextDisabled: {
    color: Palette.textMuted,
  },
  saveBtn: {
    marginTop: Spacing.sm,
  },
});
