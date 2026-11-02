/**
 * HealPoint - Emergency Contacts Management Modal (Task 3).
 * Supports adding, editing, and deleting emergency contacts with 10-digit phone validation.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { EmergencyContactItem } from "@/types";

interface EmergencyContactsModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: EmergencyContactItem[];
  onSaveContact: (contact: {
    name: string;
    phone: string;
    relation?: string;
    isPrimary?: boolean;
    contactId?: string;
  }) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
}

export function EmergencyContactsModal({
  visible,
  onClose,
  contacts,
  onSaveContact,
  onDeleteContact,
}: EmergencyContactsModalProps) {
  const [editingContact, setEditingContact] = useState<EmergencyContactItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("Family");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setEditingContact(null);
    setName("");
    setPhone("");
    setRelation("Family");
    setIsPrimary(false);
    setFormError("");
  };

  const startEdit = (c: EmergencyContactItem) => {
    setEditingContact(c);
    setName(c.name);
    setPhone(c.phone);
    setRelation(c.relation || "Family");
    setIsPrimary(Boolean(c.isPrimary));
    setFormError("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Contact name is required");
      return;
    }
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setFormError("Please enter a valid 10-digit phone number");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await onSaveContact({
        name: name.trim(),
        phone: phone.trim(),
        relation: relation.trim(),
        isPrimary,
        contactId: editingContact?._id,
      });
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save emergency contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contactId?: string) => {
    if (!contactId) return;
    Alert.alert(
      "Delete Contact",
      "Are you sure you want to remove this emergency contact?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeleteContact(contactId);
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="people" size={24} color="#2563EB" />
              <Text style={styles.title}>Emergency Contacts</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={Palette.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Existing Contacts List */}

            <Text style={styles.sectionSubtitle}>
              Contacts notified upon emergency request:
            </Text>

            {contacts.length === 0 ? (
              <View style={styles.emptyContacts}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={36}
                  color={Palette.textMuted}
                />
                <Text style={styles.emptyText}>
                  No emergency contacts added yet.
                </Text>
                <Text style={styles.emptySubtext}>
                  Add family members or trusted friends below.
                </Text>
              </View>
            ) : (
              contacts.map((c) => (
                <View key={c._id || c.phone} style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <View style={styles.contactNameRow}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      {c.isPrimary ? (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.contactPhone}>{c.phone}</Text>
                    <Text style={styles.contactRelation}>
                      Relation: {c.relation || "Contact"}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.actionIcon}
                      onPress={() => startEdit(c)}
                    >
                      <Ionicons
                        name="pencil"
                        size={18}
                        color={Palette.primary}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.actionIcon}
                      onPress={() => handleDelete(c._id)}
                    >
                      <Ionicons name="trash" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* Add / Edit Form */}
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>
                {editingContact ? "Edit Contact" : "Add Emergency Contact"}
              </Text>

              {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
              ) : null}

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor={Palette.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Phone Number (10 Digits) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor={Palette.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spouse / Brother / Parent"
                placeholderTextColor={Palette.textMuted}
                value={relation}
                onChangeText={setRelation}
              />

              <Pressable
                style={styles.primaryToggle}
                onPress={() => setIsPrimary(!isPrimary)}
              >
                <Ionicons
                  name={isPrimary ? "checkbox" : "square-outline"}
                  size={20}
                  color={isPrimary ? "#2563EB" : Palette.textMuted}
                />
                <Text style={styles.primaryToggleText}>
                  Set as primary emergency contact
                </Text>
              </Pressable>

              <View style={styles.formButtonsRow}>
                {editingContact ? (
                  <Pressable style={styles.cancelEditBtn} onPress={resetForm}>
                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[
                    styles.saveBtn,
                    saving && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingContact ? "Update Contact" : "Save Contact"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "85%",
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Palette.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  emptyContacts: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.md,
    gap: 4,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  emptySubtext: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.xs,
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  primaryBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1E40AF",
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
    marginTop: 2,
  },
  contactRelation: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionIcon: {
    padding: Spacing.xs,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: 13,
    color: Palette.text,
    backgroundColor: "#F8FAFC",
    marginBottom: Spacing.sm,
  },
  primaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  primaryToggleText: {
    fontSize: 13,
    color: Palette.text,
  },
  formButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelEditBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cancelEditBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: "#2563EB",
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    ...Shadows.sm,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
