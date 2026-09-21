/**
 * HealPoint - Premium Review Submission Modal.
 *
 * Provides a healthcare-focused rating and review interaction:
 *  - 1-5 Star interactive rating with dynamic descriptor badge
 *  - Optional clinical experience tags
 *  - Character-counter-validated comment area
 *  - Real-time submission, server-side duplicate prevention and validation
 *  - Clean loading, error retry, and success confirmation views
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import { createReview } from "@/services/reviews";

interface ReviewModalProps {
  visible: boolean;
  doctorId: string;
  doctorName?: string;
  appointmentId?: string;
  hospitalId?: string;
  hospitalName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_DESCRIPTIONS: Record<number, { label: string; color: string }> = {
  1: { label: "1.0 · Needs Improvement", color: Palette.error },
  2: { label: "2.0 · Fair Consultation", color: "#E67E22" },
  3: { label: "3.0 · Satisfactory Care", color: "#F39C12" },
  4: { label: "4.0 · Very Good Experience", color: Palette.primary },
  5: { label: "5.0 · Excellent Care", color: Palette.primaryDark },
};

const SUGGESTED_TAGS = [
  "Clear Explanation",
  "Friendly & Attentive",
  "Minimal Wait Time",
  "Thorough Examination",
  "Clean & Safe Facility",
];

export function ReviewModal({
  visible,
  doctorId,
  doctorName,
  appointmentId,
  hospitalId,
  hospitalName,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(5);
      setComment("");
      setSelectedTags([]);
      setError("");
      setSubmitted(false);
      setSubmitting(false);
    }
  }, [visible]);

  const reset = useCallback(() => {
    setRating(5);
    setComment("");
    setSelectedTags([]);
    setError("");
    setSubmitted(false);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const submit = async () => {
    setError("");
    if (comment.trim().length < 3) {
      setError(
        "Please write at least 3 characters describing your experience.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await createReview({
        doctorId,
        appointmentId,
        hospitalId,
        hospitalName,
        rating,
        title: `Consultation with ${formatDoctorName(doctorName, "Doctor")}`,
        comment: comment.trim(),
        tags: selectedTags,
      });
      setSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(
        toErrorMessage(
          err,
          "Unable to submit your review right now. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentDesc = RATING_DESCRIPTIONS[rating] || RATING_DESCRIPTIONS[5];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={submitting ? undefined : close}
          accessibilityLabel="Dismiss modal"
        />
        <KeyboardAvoidingView
          style={styles.avoid}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                  <Text style={styles.title}>Rate Your Consultation</Text>
                  {doctorName ? (
                    <Text style={styles.doctorName}>
                      with Dr. {doctorName.replace(/^Dr\.\s*/i, "")}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={close}
                  hitSlop={8}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.textMuted} />
                </Pressable>
              </View>

              {submitted ? (
                /* Success Confirmation View */
                <View style={styles.successView}>
                  <View style={styles.successIconCircle}>
                    <Ionicons
                      name="checkmark-circle"
                      size={54}
                      color={Palette.primary}
                    />
                  </View>
                  <Text style={styles.successTitle}>Review Submitted!</Text>
                  <Text style={styles.successText}>
                    Thank you for reviewing{" "}
                    {formatDoctorName(doctorName, "your doctor")}. Your verified
                    clinical feedback has been recorded and is now live.
                  </Text>
                  <View style={styles.confirmedRatingBox}>
                    <View style={styles.starsConfirmed}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <Ionicons
                          key={val}
                          name={val <= rating ? "star" : "star-outline"}
                          size={18}
                          color={Palette.gold}
                        />
                      ))}
                    </View>
                    <Text style={styles.confirmedRatingText}>
                      {rating}.0 · {currentDesc.label.split("·")[1]?.trim()}
                    </Text>
                  </View>
                  <Button title="Done" onPress={close} style={styles.doneBtn} />
                </View>
              ) : (
                /* Review Form View */
                <View style={styles.formView}>
                  {/* Rating Selector */}
                  <View style={styles.ratingSection}>
                    <Text style={styles.sectionLabel}>Overall Rating</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <Pressable
                          key={val}
                          accessibilityRole="button"
                          accessibilityLabel={`${val} star rating`}
                          onPress={() => setRating(val)}
                          hitSlop={8}
                          style={styles.starTouch}
                        >
                          <Ionicons
                            name={val <= rating ? "star" : "star-outline"}
                            size={36}
                            color={val <= rating ? Palette.gold : "#CBD5E1"}
                          />
                        </Pressable>
                      ))}
                    </View>
                    <View
                      style={[
                        styles.ratingBadge,
                        { backgroundColor: `${currentDesc.color}14` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingBadgeText,
                          { color: currentDesc.color },
                        ]}
                      >
                        {currentDesc.label}
                      </Text>
                    </View>
                  </View>

                  {/* Highlights Tags */}
                  <View style={styles.tagsSection}>
                    <Text style={styles.sectionLabel}>
                      Consultation Highlights{" "}
                      <Text style={styles.optionalText}>(Optional)</Text>
                    </Text>
                    <View style={styles.tagsRow}>
                      {SUGGESTED_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <Pressable
                            key={tag}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            onPress={() => toggleTag(tag)}
                            style={[
                              styles.tagChip,
                              isSelected && styles.tagChipSelected,
                            ]}
                          >
                            <Ionicons
                              name={
                                isSelected
                                  ? "checkmark-circle"
                                  : "add-circle-outline"
                              }
                              size={14}
                              color={
                                isSelected ? Palette.white : Palette.primaryDark
                              }
                            />
                            <Text
                              style={[
                                styles.tagChipText,
                                isSelected && styles.tagChipTextSelected,
                              ]}
                            >
                              {tag}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Written Feedback Input */}
                  <View style={styles.inputSection}>
                    <View style={styles.inputHeader}>
                      <Text style={styles.sectionLabel}>Your Feedback</Text>
                      <Text
                        style={[
                          styles.charCount,
                          comment.length > 450 && styles.charCountWarning,
                        ]}
                      >
                        {comment.length}/500
                      </Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Describe your consultation, doctor's guidance, clinic experience..."
                      placeholderTextColor={Palette.textMuted}
                      value={comment}
                      onChangeText={(t) => setComment(t.slice(0, 500))}
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                      accessibilityLabel="Review feedback text input"
                    />
                    <Text style={styles.inputHint}>
                      Your verified review helps other patients make informed
                      healthcare choices.
                    </Text>
                  </View>

                  {/* Error Notification */}
                  {error ? <FormMessage type="error" message={error} /> : null}

                  {/* Buttons */}
                  <View style={styles.actions}>
                    <Button
                      title="Cancel"
                      variant="outline"
                      onPress={close}
                      disabled={submitting}
                      style={styles.btn}
                    />
                    <Button
                      title={submitting ? "Submitting..." : "Submit Review"}
                      onPress={submit}
                      loading={submitting}
                      icon="checkmark-outline"
                      style={styles.btn}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  avoid: {
    width: "100%",
    maxWidth: 480,
  },
  scrollContent: {
    paddingVertical: Spacing.md,
  },
  card: {
    width: "100%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "800",
    fontSize: 18,
  },
  doctorName: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  formView: {
    gap: Spacing.lg,
  },
  ratingSection: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: Palette.text,
    fontWeight: "700",
    fontSize: 13,
  },
  optionalText: {
    fontWeight: "400",
    color: Palette.textMuted,
    fontSize: 12,
  },
  starsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  starTouch: {
    transform: [{ scale: 1.05 }],
  },
  ratingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignSelf: "center",
  },
  ratingBadgeText: {
    ...Typography.caption,
    fontWeight: "700",
    fontSize: 12,
  },
  tagsSection: {
    gap: Spacing.xs,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    borderRadius: Radius.pill,
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.18)",
  },
  tagChipSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tagChipText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
    fontSize: 12,
  },
  tagChipTextSelected: {
    color: Palette.white,
  },
  inputSection: {
    gap: Spacing.xs,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  charCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  charCountWarning: {
    color: Palette.error,
    fontWeight: "700",
  },
  input: {
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: "#F8FAFB",
    padding: Spacing.md,
    fontSize: 14,
    color: Palette.text,
    lineHeight: 20,
  },
  inputHint: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btn: {
    flex: 1,
  },
  successView: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(14, 159, 142, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    ...Typography.h2,
    color: Palette.text,
    fontWeight: "800",
  },
  successText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },
  confirmedRatingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#F8FAFB",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  starsConfirmed: {
    flexDirection: "row",
    gap: 2,
  },
  confirmedRatingText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    fontSize: 12,
  },
  doneBtn: {
    width: "100%",
    marginTop: Spacing.sm,
  },
});
