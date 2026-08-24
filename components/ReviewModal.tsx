/**
 * HealPoint - review submission modal (no browser alert).
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import { createReview } from '@/services/reviews';

interface ReviewModalProps {
  visible: boolean;
  doctorId: string;
  doctorName?: string;
  onClose: () => void;
}

export function ReviewModal({ visible, doctorId, doctorName, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setRating(5);
    setComment('');
    setError('');
    setSubmitted(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError('');
    if (comment.trim().length < 3) {
      setError('Please write a short review before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await createReview({ doctorId, rating, comment: comment.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to submit your review. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : close} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Write a review</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8}>
              <Ionicons name="close" size={24} color={Palette.textMuted} />
            </Pressable>
          </View>

          {doctorName ? <Text style={styles.doctorName}>{doctorName}</Text> : null}

          {submitted ? (
            <>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={40} color={Palette.success} />
                <Text style={styles.successText}>
                  Thank you! Your review has been submitted and will appear after approval.
                </Text>
              </View>
              <Button title="Done" onPress={close} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Your rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${value} stars`}
                    onPress={() => setRating(value)}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={34}
                      color={value <= rating ? Palette.gold : Palette.textMuted}
                    />
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Your review</Text>
              <TextInput
                style={styles.input}
                placeholder="Share your experience with this doctor..."
                placeholderTextColor={Palette.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Review comment"
              />

              {error ? <FormMessage type="error" message={error} /> : null}

              <View style={styles.actions}>
                <Button title="Cancel" variant="outline" onPress={close} disabled={submitting} style={styles.btn} />
                <Button title="Submit review" onPress={submit} loading={submitting} style={styles.btn} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
  },
  doctorName: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  label: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  starsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  input: {
    minHeight: 96,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
    padding: Spacing.md,
    fontSize: 15,
    color: Palette.text,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  successText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
  },
});