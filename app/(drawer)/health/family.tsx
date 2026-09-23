/**
 * HealPoint — Family Healthcare & Family Member Management.
 *
 * Enables patients to manage profiles for family members, book consultations
 * on their behalf, view separate medical histories, and share subscription
 * video consultation quotas safely without conflating health records.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palette, Radius, Shadows, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { toErrorMessage } from "@/services/api";
import * as familyService from "@/services/family";
import type { FamilyMember, FamilyRelationship } from "@/types";

const RELATIONSHIPS: FamilyRelationship[] = [
  "Father",
  "Mother",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function FamilyMembersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?._id || "";

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] =
    useState<FamilyRelationship>("Mother");
  const [gender, setGender] = useState<"male" | "female" | "other">("female");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadMembers = useCallback(
    async (isRefresh = false) => {
      if (!userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const list = await familyService.getFamilyMembers(userId);
        setMembers(list);
      } catch (err) {
        setError(toErrorMessage(err, "Failed to load family members."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useScreenFocus(loadMembers);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openAddModal = () => {
    setEditingMember(null);
    setName("");
    setRelationship("Mother");
    setGender("female");
    setDob("");
    setPhone("");
    setBloodGroup("");
    setAllergies("");
    setChronicConditions("");
    setFormError("");
    setModalVisible(true);
  };

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member);
    setName(member.name);
    setRelationship(member.relationship);
    setGender((member.gender as "male" | "female" | "other") || "female");
    setDob(member.dob || "");
    setPhone(member.phone || "");
    setBloodGroup(member.bloodGroup || "");
    setAllergies((member.allergies || []).join(", "));
    setChronicConditions((member.chronicConditions || []).join(", "));
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Please provide a name for your family member.");
      return;
    }
    if (!userId) {
      setFormError("User authentication session missing.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const allergiesArray = allergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const conditionsArray = chronicConditions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingMember) {
        await familyService.updateFamilyMember(userId, editingMember._id, {
          name: name.trim(),
          relationship,
          gender,
          dob: dob.trim(),
          phone: phone.trim(),
          bloodGroup: bloodGroup.trim(),
          allergies: allergiesArray,
          chronicConditions: conditionsArray,
        });
      } else {
        await familyService.addFamilyMember(userId, {
          name: name.trim(),
          relationship,
          gender,
          dob: dob.trim(),
          phone: phone.trim(),
          bloodGroup: bloodGroup.trim(),
          allergies: allergiesArray,
          chronicConditions: conditionsArray,
        });
      }
      setModalVisible(false);
      loadMembers(true);
    } catch (err) {
      setFormError(toErrorMessage(err, "Failed to save family member."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (member: FamilyMember) => {
    Alert.alert(
      "Remove Family Member",
      `Are you sure you want to remove ${member.name} (${member.relationship})? If past health records exist, their profile will be safely archived to protect medical history.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await familyService.removeFamilyMember(
                userId,
                member._id,
              );
              Alert.alert(
                res.archived ? "Safely Archived" : "Removed",
                res.message,
              );
              loadMembers(true);
            } catch (err) {
              Alert.alert(
                "Error",
                toErrorMessage(err, "Failed to remove member."),
              );
            }
          },
        },
      ],
    );
  };

  const getRelationshipColor = (rel: FamilyRelationship) => {
    switch (rel) {
      case "Father":
      case "Mother":
        return "#6366F1";
      case "Spouse":
        return "#EC4899";
      case "Son":
      case "Daughter":
        return "#06B6D4";
      case "Brother":
      case "Sister":
        return "#8B5CF6";
      default:
        return Palette.primary;
    }
  };

  const renderMember = ({ item }: { item: FamilyMember }) => {
    const relColor = getRelationshipColor(item.relationship);
    return (
      <Card style={styles.memberCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: `${relColor}15` }]}>
            <Text style={[styles.avatarText, { color: relColor }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.name}
              </Text>
              <Badge
                label={item.relationship}
                variant="primary"
                style={{ backgroundColor: `${relColor}18` }}
              />
            </View>

            <View style={styles.metaRow}>
              {item.gender ? (
                <Text style={styles.metaText}>
                  {item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}
                </Text>
              ) : null}
              {item.gender && item.dob ? (
                <Text style={styles.metaDot}>•</Text>
              ) : null}
              {item.dob ? (
                <Text style={styles.metaText}>DOB: {item.dob}</Text>
              ) : null}
              {item.bloodGroup ? (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={[styles.metaText, { color: Palette.error }]}>
                    {item.bloodGroup}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* Contact info & Tags */}
        <View style={styles.detailsBody}>
          {item.phone ? (
            <View style={styles.detailItem}>
              <Ionicons
                name="call-outline"
                size={14}
                color={Palette.textMuted}
              />
              <Text style={styles.detailText}>{item.phone}</Text>
            </View>
          ) : null}

          {item.chronicConditions && item.chronicConditions.length > 0 ? (
            <View style={styles.tagsContainer}>
              <Text style={styles.tagSectionLabel}>Conditions:</Text>
              {item.chronicConditions.map((cond, i) => (
                <View key={i} style={styles.tagPill}>
                  <Text style={styles.tagText}>{cond}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {item.allergies && item.allergies.length > 0 ? (
            <View style={styles.tagsContainer}>
              <Text style={styles.tagSectionLabel}>Allergies:</Text>
              {item.allergies.map((al, i) => (
                <View key={i} style={[styles.tagPill, styles.allergyPill]}>
                  <Text style={[styles.tagText, styles.allergyText]}>{al}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Actions Row */}
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.actionBtn, styles.bookBtn]}
            onPress={() => router.push("/(drawer)/search" as never)}
          >
            <Ionicons name="calendar" size={15} color="#FFFFFF" />
            <Text style={styles.bookBtnText}>Book Visit</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.recordsBtn]}
            onPress={() =>
              router.push({
                pathname: "/(drawer)/health/records" as never,
                params: { memberId: item._id },
              })
            }
          >
            <Ionicons
              name="folder-open-outline"
              size={15}
              color={Palette.primary}
            />
            <Text style={styles.recordsBtnText}>Records</Text>
          </Pressable>

          <Pressable
            style={[styles.iconBtn]}
            onPress={() => openEditModal(item)}
            accessibilityLabel="Edit member"
          >
            <Ionicons name="pencil-outline" size={18} color={Palette.text} />
          </Pressable>

          <Pressable
            style={[styles.iconBtn]}
            onPress={() => handleRemove(item)}
            accessibilityLabel="Remove or archive member"
          >
            <Ionicons name="trash-outline" size={18} color={Palette.error} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DrawerToggleButton />
          <View style={styles.headerTitles}>
            <Text style={styles.screenTitle}>Family Healthcare</Text>
            <Text style={styles.screenSubtitle}>
              Manage dependent profiles & records
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.addMemberBtn}
          onPress={openAddModal}
          accessibilityLabel="Add family member"
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.addMemberBtnText}>Add</Text>
        </Pressable>
      </View>

      {/* Info Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroTitle}>
            {members.length}{" "}
            {members.length === 1 ? "Family Member" : "Family Members"}
          </Text>
          <Text style={styles.heroSubtitle}>
            Each member maintains separated medical history, prescriptions, and
            timelines while sharing your video consultation quota.
          </Text>
        </View>
        <Ionicons name="shield-checkmark" size={36} color={Palette.primary} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Palette.primary} />
          <Text style={styles.loadingText}>Loading family members...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color={Palette.error}
          />
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            variant="outline"
            onPress={() => loadMembers(true)}
            style={{ marginTop: Spacing.sm }}
          />
        </View>
      ) : members.length === 0 ? (
        <EmptyState
          title="No Family Members Yet"
          message="Add parents, children, or your spouse to book doctor visits for them and keep their medical records organized."
          action={
            <Button
              title="+ Add First Member"
              onPress={openAddModal}
              style={{ marginTop: Spacing.sm }}
            />
          }
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item._id}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadMembers(true)}
              tintColor={Palette.primary}
            />
          }
        />
      )}

      {/* Add / Edit Family Member Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMember ? "Edit Family Member" : "Add Family Member"}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={12}
                disabled={submitting}
              >
                <Ionicons name="close" size={22} color={Palette.text} />
              </Pressable>
            </View>

            {formError ? (
              <View style={styles.formErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Palette.error} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Savitri Devi"
                placeholderTextColor={Palette.textMuted}
                value={name}
                onChangeText={setName}
                editable={!submitting}
              />

              {/* Relationship Picker */}
              <Text style={styles.inputLabel}>Relationship *</Text>
              <View style={styles.chipsRow}>
                {RELATIONSHIPS.map((rel) => {
                  const selected = relationship === rel;
                  return (
                    <Pressable
                      key={rel}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setRelationship(rel)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {rel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Gender */}
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.chipsRow}>
                {(["female", "male", "other"] as const).map((g) => {
                  const selected = gender === g;
                  return (
                    <Pressable
                      key={g}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setGender(g)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* DOB & Phone */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor={Palette.textMuted}
                    value={dob}
                    onChangeText={setDob}
                    editable={!submitting}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Phone (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-digit mobile"
                    placeholderTextColor={Palette.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Blood Group */}
              <Text style={styles.inputLabel}>Blood Group</Text>
              <View style={styles.chipsRow}>
                {BLOOD_GROUPS.map((bg) => {
                  const selected = bloodGroup === bg;
                  return (
                    <Pressable
                      key={bg}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setBloodGroup(selected ? "" : bg)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {bg}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Chronic Conditions */}
              <Text style={styles.inputLabel}>
                Chronic Conditions (Comma separated)
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Diabetes, Hypertension"
                placeholderTextColor={Palette.textMuted}
                value={chronicConditions}
                onChangeText={setChronicConditions}
                editable={!submitting}
              />

              {/* Allergies */}
              <Text style={styles.inputLabel}>Allergies (Comma separated)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Penicillin, Peanuts"
                placeholderTextColor={Palette.textMuted}
                value={allergies}
                onChangeText={setAllergies}
                editable={!submitting}
              />

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  disabled={submitting}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={
                    submitting
                      ? "Saving..."
                      : editingMember
                        ? "Update Profile"
                        : "Save Member"
                  }
                  onPress={handleSave}
                  loading={submitting}
                  disabled={submitting}
                  style={{ flex: 1 }}
                />
              </View>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitles: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  screenSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    gap: 4,
  },
  addMemberBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  heroBanner: {
    margin: Spacing.md,
    backgroundColor: `${Palette.primary}12`,
    borderColor: `${Palette.primary}30`,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeft: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  memberCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: Palette.textMuted,
    marginHorizontal: 4,
  },
  detailsBody: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 12,
    color: Palette.text,
  },
  tagsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tagPill: {
    backgroundColor: `${Palette.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  tagText: {
    fontSize: 11,
    color: Palette.primary,
    fontWeight: "500",
  },
  allergyPill: {
    backgroundColor: `${Palette.error}15`,
  },
  allergyText: {
    color: Palette.error,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: Radius.md,
    gap: 4,
  },
  bookBtn: {
    backgroundColor: Palette.primary,
    flex: 1,
  },
  bookBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  recordsBtn: {
    backgroundColor: `${Palette.primary}12`,
    flex: 1,
    borderWidth: 1,
    borderColor: `${Palette.primary}30`,
  },
  recordsBtnText: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Palette.textMuted,
  },
  errorBox: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    alignItems: "center",
  },
  errorText: {
    color: Palette.error,
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "90%",
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  formErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${Palette.error}15`,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  formErrorText: {
    color: Palette.error,
    fontSize: 12,
    flex: 1,
  },
  modalBody: {
    marginTop: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Palette.surfaceAlt,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    fontSize: 14,
    color: Palette.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceAlt,
  },
  chipSelected: {
    backgroundColor: `${Palette.primary}20`,
    borderColor: Palette.primary,
  },
  chipText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  chipTextSelected: {
    color: Palette.primary,
    fontWeight: "700",
  },
  rowInputs: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
});
