/**
 * HealPoint - Emergency SOS Confirmation & Type Selection Modal.
 * Includes a 5-second countdown to prevent accidental activations.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import type { EmergencyType } from "@/types";

interface EmergencySosModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (type: EmergencyType, notes: string) => Promise<void>;
  loading?: boolean;
}

const EMERGENCY_TYPES: {
  type: EmergencyType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  desc: string;
}[] = [
  {
    type: "cardiac",
    label: "Heart Attack / Cardiac",
    icon: "heart",
    desc: "Severe chest pain, palpitations, collapse",
  },
  {
    type: "accident",
    label: "Accident / Trauma",
    icon: "car-sport",
    desc: "Road accident, severe bleeding, fracture",
  },
  {
    type: "respiratory",
    label: "Severe Breathlessness",
    icon: "fitness",
    desc: "Suffocation, asthma attack, choking",
  },
  {
    type: "stroke",
    label: "Stroke / Neurological",
    icon: "flash",
    desc: "Face drooping, arm weakness, speech loss",
  },
  {
    type: "pregnancy",
    label: "Pregnancy / Delivery",
    icon: "woman",
    desc: "Labor pain, emergency bleeding",
  },
  {
    type: "severe_pain",
    label: "Severe Acute Pain",
    icon: "medkit",
    desc: "Abdominal pain, sudden intense agony",
  },
  {
    type: "other",
    label: "Other Medical Crisis",
    icon: "alert-circle",
    desc: "Immediate emergency medical response",
  },
];

export function EmergencySosModal({
  visible,
  onClose,
  onConfirm,
  loading = false,
}: EmergencySosModalProps) {
  const [selectedType, setSelectedType] = useState<EmergencyType>("other");
  const [notes, setNotes] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(true);

  useEffect(() => {
    if (visible) {
      setCountdown(5);
      setIsCountingDown(true);
      setNotes("");
      setSelectedType("other");
    }
  }, [visible]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (visible && isCountingDown && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (visible && isCountingDown && countdown === 0) {
      // Countdown ended: automatically trigger or ready for instant dispatch
      setIsCountingDown(false);
      handleTrigger();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, isCountingDown, countdown]);

  const handleTrigger = () => {
    setIsCountingDown(false);
    onConfirm(selectedType, notes);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning" size={32} color="#EF4444" />
            </View>
            <Text style={styles.title}>Emergency Assistance Request</Text>
            <Text style={styles.subtitle}>
              For immediate life-threatening situations, dial 112 or 108 directly.
            </Text>
          </View>

          {/* Countdown indicator */}
          {isCountingDown && countdown > 0 ? (
            <View style={styles.countdownBox}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
              <Text style={styles.countdownLabel}>
                Sending request in {countdown}s... Tap Cancel to abort
              </Text>
            </View>
          ) : null}

          {/* Emergency Type Selection */}
          <Text style={styles.sectionTitle}>Select Emergency Nature:</Text>
          <ScrollView
            style={styles.typesList}
            showsVerticalScrollIndicator={false}
          >
            {EMERGENCY_TYPES.map((item) => {
              const isSelected = selectedType === item.type;
              return (
                <Pressable
                  key={item.type}
                  style={[
                    styles.typeCard,
                    isSelected && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedType(item.type)}
                >
                  <View
                    style={[
                      styles.typeIconBox,
                      isSelected && styles.typeIconBoxSelected,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isSelected ? "#FFFFFF" : "#EF4444"}
                    />
                  </View>
                  <View style={styles.typeTextWrap}>
                    <Text
                      style={[
                        styles.typeLabel,
                        isSelected && styles.typeLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.typeDesc}>{item.desc}</Text>
                  </View>
                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#EF4444"
                    />
                  ) : null}
                </Pressable>
              );
            })}

            {/* Optional note */}
            <View style={styles.notesWrap}>
              <Text style={styles.notesLabel}>Add Quick Note (Optional):</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Near City Mall, ground floor"
                placeholderTextColor={Palette.textMuted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmButton,
                loading && styles.confirmButtonDisabled,
              ]}
              onPress={handleTrigger}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>Start Emergency Practice</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  countdownBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    gap: Spacing.sm,
  },
  countdownNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#DC2626",
  },
  countdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B91C1C",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  typesList: {
    maxHeight: 280,
    marginBottom: Spacing.md,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.xs,
    backgroundColor: "#FFFFFF",
  },
  typeCardSelected: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF5F5",
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  typeIconBoxSelected: {
    backgroundColor: "#EF4444",
  },
  typeTextWrap: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  typeLabelSelected: {
    color: "#DC2626",
  },
  typeDesc: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  notesWrap: {
    marginTop: Spacing.sm,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
    marginBottom: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Palette.text,
    backgroundColor: "#F8FAFC",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
