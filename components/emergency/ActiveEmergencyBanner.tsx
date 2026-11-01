/**
 * HealPoint - Active Emergency SOS Live Tracker Banner.
 * Shows real-time progression stepper, ambulance dispatch info, and cancel option.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
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
import type { EmergencyRequest, EmergencyStatus } from "@/types";

interface ActiveEmergencyBannerProps {
  emergency: EmergencyRequest;
  onCancel: (reason: string) => Promise<void>;
  cancelling?: boolean;
}

const STEPS: { status: EmergencyStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: "pending", label: "SOS Sent", icon: "radio" },
  { status: "accepted", label: "Hospital Alerted", icon: "business" },
  { status: "in_progress", label: "Ambulance / En Route", icon: "car-sport" },
  { status: "resolved", label: "Assistance Arrived", icon: "checkmark-circle" },
];

export function ActiveEmergencyBanner({
  emergency,
  onCancel,
  cancelling = false,
}: ActiveEmergencyBannerProps) {
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const getStepIndex = (status: EmergencyStatus) => {
    switch (status) {
      case "pending":
        return 0;
      case "accepted":
        return 1;
      case "in_progress":
        return 2;
      case "resolved":
        return 3;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(emergency.status);

  const handleCallDriver = (phone?: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert("Unable to call", `Could not place call to ${phone}`);
    });
  };

  const handleConfirmCancel = () => {
    onCancel(cancelReason || "False alarm / patient cancelled").then(() => {
      setShowCancelInput(false);
      setCancelReason("");
    });
  };

  return (
    <View style={styles.card}>
      {/* Top Banner Alert */}
      <View style={styles.alertHeader}>
        <View style={styles.alertHeaderLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.alertTitle}>LIVE EMERGENCY SOS ACTIVE</Text>
        </View>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{emergency.emergencyCode}</Text>
        </View>
      </View>

      <Text style={styles.emergencyType}>
        Nature: {emergency.emergencyType.toUpperCase().replace("_", " ")}
      </Text>

      {/* Stepper Progress */}
      <View style={styles.stepperContainer}>
        {STEPS.map((step, idx) => {
          const isDone = currentStep >= idx;
          const isCurrent = currentStep === idx;
          return (
            <React.Fragment key={step.status}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                  ]}
                >
                  <Ionicons
                    name={step.icon}
                    size={14}
                    color={isDone ? "#FFFFFF" : Palette.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isDone && styles.stepLabelDone,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                  numberOfLines={2}
                >
                  {step.label}
                </Text>
              </View>
              {idx < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.stepConnector,
                    currentStep > idx && styles.stepConnectorDone,
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {/* Ambulance Dispatch Details Card */}
      {emergency.ambulance?.isDispatched ? (
        <View style={styles.ambulanceCard}>
          <View style={styles.ambulanceHeader}>
            <View style={styles.ambulanceTitleWrap}>
              <Ionicons name="car-sport" size={24} color="#2563EB" />
              <View>
                <Text style={styles.ambulanceTitle}>Ambulance Dispatched</Text>
                <Text style={styles.ambulancePlate}>
                  Vehicle: {emergency.ambulance.vehicleNumber}
                </Text>
              </View>
            </View>
            {emergency.ambulance.etaMinutes ? (
              <View style={styles.etaBadge}>
                <Text style={styles.etaNumber}>
                  ~{emergency.ambulance.etaMinutes}
                </Text>
                <Text style={styles.etaUnit}>MINS ETA</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.driverRow}>
            <View style={styles.driverInfo}>
              <Ionicons name="person" size={16} color={Palette.textMuted} />
              <Text style={styles.driverName}>
                Driver: {emergency.ambulance.driverName}
              </Text>
            </View>
            {emergency.ambulance.driverPhone ? (
              <Pressable
                style={styles.callDriverButton}
                onPress={() => handleCallDriver(emergency.ambulance.driverPhone)}
              >
                <Ionicons name="call" size={14} color="#FFFFFF" />
                <Text style={styles.callDriverButtonText}>Call Driver</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Location summary */}
      {emergency.location?.address ? (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#DC2626" />
          <Text style={styles.locationText} numberOfLines={2}>
            Location: {emergency.location.address}
          </Text>
        </View>
      ) : null}

      {/* Cancel Emergency SOS Area */}
      {showCancelInput ? (
        <View style={styles.cancelInputWrap}>
          <Text style={styles.cancelPrompt}>Reason for cancelling:</Text>
          <TextInput
            style={styles.cancelInput}
            placeholder="e.g. False alarm / patient stabilized"
            placeholderTextColor={Palette.textMuted}
            value={cancelReason}
            onChangeText={setCancelReason}
          />
          <View style={styles.cancelActionsRow}>
            <Pressable
              style={styles.cancelSecondary}
              onPress={() => setShowCancelInput(false)}
            >
              <Text style={styles.cancelSecondaryText}>Keep SOS Active</Text>
            </Pressable>
            <Pressable
              style={styles.confirmCancelBtn}
              onPress={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmCancelBtnText}>Confirm Cancel</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.cancelSosButton}
          onPress={() => setShowCancelInput(true)}
        >
          <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.cancelSosButtonText}>
            Cancel Emergency Request (False Alarm)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: "#DC2626",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  alertHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#DC2626",
    letterSpacing: 0.5,
  },
  codeBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
  },
  emergencyType: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: Spacing.md,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepCircleDone: {
    backgroundColor: "#2563EB",
  },
  stepCircleCurrent: {
    backgroundColor: "#DC2626",
  },
  stepLabel: {
    fontSize: 10,
    textAlign: "center",
    color: Palette.textMuted,
    fontWeight: "500",
  },
  stepLabelDone: {
    color: "#2563EB",
    fontWeight: "700",
  },
  stepLabelCurrent: {
    color: "#DC2626",
    fontWeight: "800",
  },
  stepConnector: {
    height: 2,
    flex: 0.5,
    backgroundColor: Palette.border,
    marginTop: -16,
  },
  stepConnectorDone: {
    backgroundColor: "#2563EB",
  },
  ambulanceCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: Spacing.sm,
  },
  ambulanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  ambulanceTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  ambulanceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E40AF",
  },
  ambulancePlate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
  },
  etaBadge: {
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  etaNumber: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E40AF",
  },
  etaUnit: {
    fontSize: 8,
    fontWeight: "700",
    color: "#1E40AF",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
    paddingTop: Spacing.xs,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  driverName: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
  },
  callDriverButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2563EB",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  callDriverButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  locationText: {
    fontSize: 12,
    color: Palette.textMuted,
    flex: 1,
  },
  cancelSosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: "#FEE2E2",
    borderRadius: Radius.md,
  },
  cancelSosButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  cancelInputWrap: {
    backgroundColor: "#FFF5F5",
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelPrompt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
    marginBottom: 4,
  },
  cancelInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    fontSize: 13,
    backgroundColor: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  cancelActionsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  cancelSecondary: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    backgroundColor: "#FFFFFF",
  },
  cancelSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: "#DC2626",
  },
  confirmCancelBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
