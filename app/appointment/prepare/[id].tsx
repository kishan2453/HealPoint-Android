/**
 * HealPoint — Smart Appointment Preparation & Pre-Consultation Center.
 *
 * Provides a unified patient pre-consultation workflow:
 *  - Consultation instructions (clinic arrival vs video setup)
 *  - Dynamic interactive preparation checklist & readiness progress
 *  - Pre-consultation symptoms notes & questions with doctor-sharing toggle
 *  - Relevant health documents with one-tap doctor share/revoke
 *  - Continuity of care: previous visit history with prescriptions/diagnosis
 *  - Quick consultation-readiness handoff (Hospital Pass QR vs Video Meet)
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { openGoogleMeetUrl } from "@/lib/meet";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as walletService from "@/services/wallet";
import type {
  AppointmentPreparationResponse,
  PatientQuestionItem,
  PreparationChecklistItem,
  PreparationDocumentItem,
} from "@/types";

export default function AppointmentPreparationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentPreparationResponse | null>(null);

  // Editable Symptoms Notes
  const [symptomsNotes, setSymptomsNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Question Modal & Form
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionShare, setNewQuestionShare] = useState(true);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // Sharing action loading states
  const [sharingDocId, setSharingDocId] = useState<string | null>(null);
  const [togglingChecklistKey, setTogglingChecklistKey] = useState<
    string | null
  >(null);

  const loadPreparation = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await appointmentService.getAppointmentPreparation(id);
      setData(res);
      setSymptomsNotes(res.preparation?.symptomsNotes || "");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadPreparation();
  }, [loadPreparation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPreparation();
  }, [loadPreparation]);

  // Toggle checklist completed item
  const handleToggleChecklist = async (item: PreparationChecklistItem) => {
    if (!data || !id) return;
    try {
      setTogglingChecklistKey(item.key);
      const currentList = new Set(data.preparation.checklistCompleted || []);
      if (currentList.has(item.key)) {
        currentList.delete(item.key);
      } else {
        currentList.add(item.key);
      }

      const updatedKeys = Array.from(currentList);
      await appointmentService.updatePreparationChecklist(id, {
        checklistCompleted: updatedKeys,
      });

      // Update local state smoothly
      setData((prev) => {
        if (!prev) return prev;
        const newChecklist = prev.checklist.map((chk) =>
          chk.key === item.key
            ? { ...chk, isCompleted: currentList.has(chk.key) }
            : chk,
        );
        const compCount = newChecklist.filter((c) => c.isCompleted).length;
        const total = newChecklist.length;
        const pct = Math.round((compCount / total) * 100);

        return {
          ...prev,
          preparation: {
            ...prev.preparation,
            checklistCompleted: updatedKeys,
          },
          checklist: newChecklist,
          readiness: {
            ...prev.readiness,
            completedSteps: compCount,
            progressPercentage: pct,
            overallReady: pct >= 80,
            badge:
              pct === 100
                ? "Fully Prepared"
                : pct >= 60
                  ? "Almost Ready"
                  : "Preparation Needed",
          },
        };
      });
    } catch (err) {
      Alert.alert(
        "Update Failed",
        toErrorMessage(err) || "Could not update checklist item.",
      );
    } finally {
      setTogglingChecklistKey(null);
    }
  };

  // Acknowledge instructions
  const handleAcknowledgeInstructions = async () => {
    if (!data || !id) return;
    try {
      const nextVal = !data.instructions.isAcknowledged;
      const currentList = new Set(data.preparation.checklistCompleted || []);
      if (nextVal) {
        currentList.add("read_instructions");
      }

      await appointmentService.updatePreparationChecklist(id, {
        instructionsAcknowledged: nextVal,
        checklistCompleted: Array.from(currentList),
      });

      setData((prev) => {
        if (!prev) return prev;
        const newChecklist = prev.checklist.map((chk) =>
          chk.key === "read_instructions"
            ? { ...chk, isCompleted: nextVal }
            : chk,
        );
        const compCount = newChecklist.filter((c) => c.isCompleted).length;
        const pct = Math.round((compCount / newChecklist.length) * 100);

        return {
          ...prev,
          instructions: { ...prev.instructions, isAcknowledged: nextVal },
          preparation: {
            ...prev.preparation,
            instructionsAcknowledged: nextVal,
            checklistCompleted: Array.from(currentList),
          },
          checklist: newChecklist,
          readiness: {
            ...prev.readiness,
            completedSteps: compCount,
            progressPercentage: pct,
            overallReady: pct >= 80,
            badge:
              pct === 100
                ? "Fully Prepared"
                : pct >= 60
                  ? "Almost Ready"
                  : "Preparation Needed",
          },
        };
      });
    } catch (err) {
      Alert.alert(
        "Action Failed",
        toErrorMessage(err) || "Failed to acknowledge guidelines.",
      );
    }
  };

  // Save Symptoms Notes
  const handleSaveSymptomsNotes = async () => {
    if (!id) return;
    try {
      setIsSavingNotes(true);
      await appointmentService.updatePreparationChecklist(id, {
        symptomsNotes: symptomsNotes.trim(),
      });
      Alert.alert(
        "Notes Saved",
        "Your pre-consultation symptoms notes have been updated.",
      );
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err) || "Failed to save symptoms notes.",
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Add Question
  const handleAddQuestion = async () => {
    if (!id || !newQuestionText.trim()) return;
    try {
      setIsSavingQuestion(true);
      const res = await appointmentService.saveAppointmentQuestions(id, {
        question: newQuestionText.trim(),
        sharedWithDoctor: newQuestionShare,
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          preparation: {
            ...prev.preparation,
            patientQuestions: res.patientQuestions,
          },
        };
      });

      setNewQuestionText("");
      setNewQuestionShare(true);
      setShowAddQuestionModal(false);
    } catch (err) {
      Alert.alert("Error", toErrorMessage(err) || "Failed to add question.");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Toggle question sharing with doctor
  const handleToggleQuestionSharing = async (
    qIndex: number,
    item: PatientQuestionItem,
  ) => {
    if (!data || !id) return;
    try {
      const updatedQuestions = [...data.preparation.patientQuestions];
      updatedQuestions[qIndex] = {
        ...item,
        sharedWithDoctor: !item.sharedWithDoctor,
      };

      const res = await appointmentService.saveAppointmentQuestions(id, {
        questions: updatedQuestions,
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          preparation: {
            ...prev.preparation,
            patientQuestions: res.patientQuestions,
          },
        };
      });
    } catch (err) {
      Alert.alert(
        "Update Failed",
        toErrorMessage(err) || "Failed to change question sharing.",
      );
    }
  };

  // Delete question
  const handleDeleteQuestion = async (qIndex: number) => {
    if (!data || !id) return;
    Alert.alert(
      "Remove Question",
      "Are you sure you want to remove this question?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = data.preparation.patientQuestions.filter(
                (_, idx) => idx !== qIndex,
              );
              const res = await appointmentService.saveAppointmentQuestions(
                id,
                {
                  questions: updated,
                },
              );

              setData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  preparation: {
                    ...prev.preparation,
                    patientQuestions: res.patientQuestions,
                  },
                };
              });
            } catch (err) {
              Alert.alert(
                "Delete Failed",
                toErrorMessage(err) || "Could not delete question.",
              );
            }
          },
        },
      ],
    );
  };

  // Toggle Health Document Sharing with doctor
  const handleToggleDocumentShare = async (doc: PreparationDocumentItem) => {
    if (!data || !id) return;
    const doctorId = data.doctor._id;
    if (!doctorId) return;

    try {
      setSharingDocId(doc._id);
      if (doc.isSharedWithDoctor) {
        await walletService.revokeHealthDocumentShare(doc._id, doctorId);
      } else {
        await walletService.shareHealthDocumentWithDoctor(doc._id, {
          doctorId,
          appointmentId: data.appointment._id,
          note: `Shared for ${data.appointment.consultationType} consultation on ${data.appointment.slotDate}`,
        });
      }

      setData((prev) => {
        if (!prev) return prev;
        const newDocs = prev.documents.map((d) =>
          d._id === doc._id
            ? { ...d, isSharedWithDoctor: !doc.isSharedWithDoctor }
            : d,
        );
        return {
          ...prev,
          documents: newDocs,
        };
      });
    } catch (err) {
      Alert.alert(
        "Sharing Error",
        toErrorMessage(err) || "Could not update document sharing.",
      );
    } finally {
      setSharingDocId(null);
    }
  };

  if (loading) {
    return <Loading label="Preparing consultation center..." />;
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Pre-Consultation Center</Text>
        </View>
        <ErrorState
          title="Could Not Load Preparation"
          message={error || "Appointment preparation is not available."}
          onRetry={loadPreparation}
        />
      </SafeAreaView>
    );
  }

  const isVideo = data.appointment.consultationType === "video";
  const readiness = data.readiness;
  const patient = data.patient;
  const doctor = data.doctor;
  const instructions = data.instructions;
  const checklist = data.checklist;
  const questions = data.preparation.patientQuestions || [];
  const documents = data.documents || [];
  const previousHistory = data.previousHistory || [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pre-Consultation Center</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {doctor.name} • {data.appointment.slotDate}
          </Text>
        </View>
        <Badge
          label={isVideo ? "Video Meet" : "In-Person"}
          variant={isVideo ? "primary" : "neutral"}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Palette.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Readiness Hero Card */}
        <Card padded style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroIconBox}>
              <Ionicons
                name={
                  readiness.overallReady
                    ? "shield-checkmark"
                    : "clipboard-outline"
                }
                size={26}
                color={
                  readiness.overallReady ? Palette.success : Palette.primary
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={styles.heroTitle}>Preparation Status</Text>
                <Badge
                  label={readiness.badge}
                  variant={
                    readiness.progressPercentage === 100
                      ? "success"
                      : readiness.progressPercentage >= 60
                        ? "primary"
                        : "warning"
                  }
                />
              </View>
              <Text style={styles.heroSubtitle}>
                {readiness.completedSteps} of {readiness.totalSteps} readiness
                items completed ({readiness.progressPercentage}%)
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${readiness.progressPercentage}%`,
                  backgroundColor:
                    readiness.progressPercentage === 100
                      ? Palette.success
                      : Palette.primary,
                },
              ]}
            />
          </View>

          {/* Dynamic Tip */}
          <View style={styles.heroTipBox}>
            <Ionicons
              name="information-circle"
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.heroTipText}>
              {readiness.progressPercentage === 100
                ? "You're 100% prepared! The doctor will have full context for your consultation."
                : isVideo
                  ? "Share your latest reports and test your camera & audio before the call begins."
                  : "Review hospital check-in guidelines and carry valid photo ID to the clinic."}
            </Text>
          </View>
        </Card>

        {/* Appointment Context & Patient Isolation */}
        <Card padded style={styles.contextCard}>
          <View style={styles.doctorRow}>
            <View style={styles.doctorAvatarBox}>
              <Ionicons name="medical" size={24} color={Palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>
                {formatDoctorName(doctor.name)}
              </Text>
              <Text style={styles.doctorSpec}>
                {doctor.speciality || doctor.department || "Consultant"}
              </Text>
              <Text style={styles.hospitalName} numberOfLines={1}>
                {doctor.hospitalName || data.hospital.name}
              </Text>
            </View>
          </View>

          <View style={styles.contextDivider} />

          <View style={styles.contextDetailsGrid}>
            <View style={styles.contextItem}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={Palette.textMuted}
              />
              <Text style={styles.contextLabel}>Date & Time</Text>
              <Text style={styles.contextValue}>
                {data.appointment.slotDate} • {data.appointment.slotTime}
              </Text>
            </View>

            <View style={styles.contextItem}>
              <Ionicons
                name="person-circle-outline"
                size={16}
                color={Palette.textMuted}
              />
              <Text style={styles.contextLabel}>Consulting For</Text>
              <Text style={styles.contextValue}>
                {patient.name}{" "}
                <Text style={styles.patientRel}>({patient.relationship})</Text>
              </Text>
            </View>
          </View>
        </Card>

        {/* Dynamic Interactive Checklist */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="checkbox-outline"
              size={20}
              color={Palette.primary}
            />
            <Text style={styles.sectionTitle}>Preparation Checklist</Text>
          </View>
          <Text style={styles.sectionSub}>
            Tap items to update your readiness or follow the shortcuts below.
          </Text>

          <View style={styles.checklistCard}>
            {checklist.map((item, idx) => (
              <Pressable
                key={item.key}
                onPress={() => handleToggleChecklist(item)}
                style={[
                  styles.checklistItem,
                  idx < checklist.length - 1 && styles.checklistItemBorder,
                ]}
              >
                <View style={styles.checkboxCircle}>
                  {togglingChecklistKey === item.key ? (
                    <ActivityIndicator size="small" color={Palette.primary} />
                  ) : item.isCompleted ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={Palette.success}
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={24}
                      color={Palette.border}
                    />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.checklistTitle,
                      item.isCompleted && styles.checklistTitleDone,
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.checklistDesc}>{item.description}</Text>
                </View>

                {item.isAutoVerified && (
                  <View style={styles.autoVerifiedBadge}>
                    <Text style={styles.autoVerifiedText}>Verified</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Consultation Instructions */}
        <Card padded style={styles.instructionsCard}>
          <View style={styles.instHeaderRow}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "business-outline"}
              size={22}
              color={Palette.primary}
            />
            <Text style={styles.instTitle}>{instructions.title}</Text>
          </View>

          <View style={styles.instList}>
            {instructions.guidelines.map((guide, idx) => (
              <View key={idx} style={styles.instItemRow}>
                <View style={styles.instBullet} />
                <Text style={styles.instText}>{guide}</Text>
              </View>
            ))}
          </View>

          <Button
            title={
              instructions.isAcknowledged
                ? "Guidelines Reviewed & Acknowledged"
                : "Acknowledge & Mark Understood"
            }
            variant={instructions.isAcknowledged ? "outline" : "primary"}
            icon={
              instructions.isAcknowledged
                ? "checkmark-circle"
                : "shield-checkmark"
            }
            onPress={handleAcknowledgeInstructions}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Symptoms & Notes for Doctor */}
        <Card padded style={styles.symptomsCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="create-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Pre-Consultation Notes</Text>
          </View>
          <Text style={styles.sectionSub}>
            Summarize primary symptoms, timeline, or concerns so the doctor has
            immediate context.
          </Text>

          <TextInput
            value={symptomsNotes}
            onChangeText={setSymptomsNotes}
            placeholder="e.g. Mild throat irritation and headache since 2 days, worse in morning. No fever recorded."
            placeholderTextColor={Palette.textMuted}
            multiline
            numberOfLines={4}
            style={styles.notesInput}
          />

          <Button
            title="Save Symptoms Notes"
            variant="outline"
            icon="save-outline"
            loading={isSavingNotes}
            disabled={isSavingNotes}
            onPress={handleSaveSymptomsNotes}
            style={{ marginTop: Spacing.sm }}
          />
        </Card>

        {/* Questions for Doctor with Sharing Toggle */}
        <Card padded style={styles.questionsCard}>
          <View style={styles.cardHeaderWithAction}>
            <View style={{ flex: 1, marginRight: Spacing.xs }}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>Questions for Doctor</Text>
              </View>
              <Text style={styles.sectionSub}>
                List questions you want answered during your consultation.
              </Text>
            </View>
            <Button
              title="+ Add"
              variant="outline"
              onPress={() => setShowAddQuestionModal(true)}
              style={styles.compactBtn}
            />
          </View>

          {questions.length === 0 ? (
            <View style={styles.emptyQuestionsBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={32}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyQuestionsTitle}>
                No Questions Added Yet
              </Text>
              <Text style={styles.emptyQuestionsText}>
                Writing down your questions ensures nothing gets missed during
                your time with Dr. {doctor.name}.
              </Text>
              <Button
                title="Add First Question"
                variant="outline"
                icon="add-circle-outline"
                onPress={() => setShowAddQuestionModal(true)}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          ) : (
            <View style={styles.questionsList}>
              {questions.map((q, qIdx) => (
                <View key={q._id || qIdx} style={styles.questionItemCard}>
                  <View style={styles.questionItemHeader}>
                    <Text style={styles.questionNum}>Q{qIdx + 1}.</Text>
                    <Text style={styles.questionText}>{q.question}</Text>
                    <Pressable
                      onPress={() => handleDeleteQuestion(qIdx)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={Palette.error}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.questionFooterRow}>
                    <Pressable
                      style={styles.shareToggleRow}
                      onPress={() => handleToggleQuestionSharing(qIdx, q)}
                    >
                      <Ionicons
                        name={
                          q.sharedWithDoctor
                            ? "checkmark-circle"
                            : "lock-closed-outline"
                        }
                        size={16}
                        color={
                          q.sharedWithDoctor
                            ? Palette.success
                            : Palette.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.shareStatusText,
                          q.sharedWithDoctor && styles.shareStatusActive,
                        ]}
                      >
                        {q.sharedWithDoctor
                          ? "Shared with Doctor"
                          : "Private Note (Tap to Share)"}
                      </Text>
                    </Pressable>

                    <Switch
                      value={q.sharedWithDoctor}
                      onValueChange={() => handleToggleQuestionSharing(qIdx, q)}
                      thumbColor={
                        q.sharedWithDoctor
                          ? Palette.primary
                          : Palette.background
                      }
                      trackColor={{
                        false: Palette.border,
                        true: Palette.primaryLight,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Relevant Health Documents & Doctor Sharing */}
        <Card padded style={styles.documentsCard}>
          <View style={styles.cardHeaderWithAction}>
            <View style={{ flex: 1, marginRight: Spacing.xs }}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>
                  Relevant Health Documents
                </Text>
              </View>
              <Text style={styles.sectionSub}>
                Documents for {patient.name}. Doctors only see explicitly shared
                records.
              </Text>
            </View>
            <Button
              title="Health Wallet"
              variant="outline"
              icon="wallet-outline"
              onPress={() => router.push("/(drawer)/health-wallet" as any)}
              style={styles.compactBtn}
            />
          </View>

          {documents.length === 0 ? (
            <View style={styles.emptyDocsBox}>
              <Ionicons
                name="folder-open-outline"
                size={32}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyDocsTitle}>No Personal Documents</Text>
              <Text style={styles.emptyDocsText}>
                Upload lab reports, scans, or previous prescriptions in your
                Digital Health Wallet to share them with Dr. {doctor.name}.
              </Text>
              <Button
                title="Upload in Wallet"
                variant="outline"
                icon="cloud-upload-outline"
                onPress={() => router.push("/(drawer)/health-wallet" as any)}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          ) : (
            <View style={styles.docsList}>
              {documents.map((doc) => (
                <View key={doc._id} style={styles.docItemCard}>
                  <View style={styles.docInfoRow}>
                    <View style={styles.docCategoryIcon}>
                      <Ionicons
                        name={
                          doc.category === "Prescription"
                            ? "medkit-outline"
                            : doc.category === "Lab Report"
                              ? "flask-outline"
                              : "document-text-outline"
                        }
                        size={20}
                        color={Palette.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      <Text style={styles.docMeta}>
                        {doc.category} • {formatDDMMYYYY(doc.documentDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.docActionsRow}>
                    {doc.isSharedWithDoctor ? (
                      <View style={styles.sharedBadgeBox}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={Palette.success}
                        />
                        <Text style={styles.sharedBadgeText}>
                          Shared with Dr. {doctor.name}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.unsharedBadgeText}>
                        Not visible to doctor
                      </Text>
                    )}

                    <Button
                      title={
                        sharingDocId === doc._id
                          ? "Updating..."
                          : doc.isSharedWithDoctor
                            ? "Revoke"
                            : "Share"
                      }
                      variant={doc.isSharedWithDoctor ? "outline" : "primary"}
                      loading={sharingDocId === doc._id}
                      disabled={sharingDocId === doc._id}
                      onPress={() => handleToggleDocumentShare(doc)}
                      style={styles.compactBtn}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Continuity of Care: Previous Visit History */}
        {previousHistory.length > 0 && (
          <Card padded style={styles.historyCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={20} color={Palette.primary} />
              <Text style={styles.sectionTitle}>
                Previous History with Dr. {doctor.name}
              </Text>
            </View>
            <Text style={styles.sectionSub}>
              Past diagnoses and prescriptions on file for {patient.name}.
            </Text>

            <View style={styles.historyList}>
              {previousHistory.map((hist, hIdx) => (
                <View key={hist._id || hIdx} style={styles.histItemBox}>
                  <View style={styles.histHeaderRow}>
                    <Text style={styles.histDate}>
                      Visit on {hist.slotDate} (
                      {hist.consultationType || "clinic"})
                    </Text>
                  </View>

                  {hist.diagnosis && (
                    <Text style={styles.histDiagnosis}>
                      Diagnosis: {hist.diagnosis}
                    </Text>
                  )}

                  {Array.isArray(hist.medicines) &&
                    hist.medicines.length > 0 && (
                      <Text style={styles.histMeds}>
                        Medicines:{" "}
                        {hist.medicines
                          .map((m) => `${m.name} (${m.dosage || ""})`)
                          .join(", ")}
                      </Text>
                    )}
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Action Handoff Footer */}
        <View style={styles.handoffSection}>
          <Text style={styles.handoffTitle}>Consultation Readiness</Text>
          <Text style={styles.handoffSubtitle}>
            {isVideo
              ? "Access your video consultation room or monitor waiting room queue status."
              : "Access your Digital Hospital Pass for rapid kiosk check-in."}
          </Text>

          {isVideo ? (
            <View style={styles.handoffButtonsRow}>
              <Button
                title="Enter Waiting Room"
                variant="outline"
                icon="chatbubbles-outline"
                onPress={() =>
                  router.push({
                    pathname: "/consultation/[id]" as any,
                    params: { id: data.appointment._id },
                  })
                }
                style={{ flex: 1 }}
              />
              {data.appointment.meetingUrl ? (
                <Button
                  title="Launch Google Meet"
                  variant="primary"
                  icon="videocam"
                  onPress={() => openGoogleMeetUrl(data.appointment.meetingUrl)}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.handoffButtonsRow}>
              <Button
                title="View Hospital Pass"
                variant="primary"
                icon="card-outline"
                onPress={() =>
                  router.push({
                    pathname: "/appointment/pass/[id]" as any,
                    params: { id: data.appointment._id },
                  })
                }
                style={{ flex: 1 }}
              />
              <Button
                title="Back to Details"
                variant="outline"
                icon="arrow-back-outline"
                onPress={() => router.back()}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>

        <View style={{ height: Spacing.xl * 2 }} />
      </ScrollView>

      {/* Add Question Modal */}
      <Modal
        visible={showAddQuestionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddQuestionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Question for Doctor</Text>
              <Pressable
                onPress={() => setShowAddQuestionModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Write down any medical doubt, symptom change, or medication
              concern you wish to discuss with Dr. {doctor.name}.
            </Text>

            <TextInput
              value={newQuestionText}
              onChangeText={setNewQuestionText}
              placeholder="e.g. Should I continue the prescribed allergy tablet if drowsiness occurs?"
              placeholderTextColor={Palette.textMuted}
              multiline
              numberOfLines={4}
              style={styles.modalTextInput}
              autoFocus
            />

            <View style={styles.modalShareRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalShareTitle}>Share with Doctor</Text>
                <Text style={styles.modalShareSub}>
                  When enabled, Dr. {doctor.name} will see this in their
                  clinical notes view.
                </Text>
              </View>
              <Switch
                value={newQuestionShare}
                onValueChange={setNewQuestionShare}
                thumbColor={
                  newQuestionShare ? Palette.primary : Palette.background
                }
                trackColor={{
                  false: Palette.border,
                  true: Palette.primaryLight,
                }}
              />
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowAddQuestionModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Question"
                variant="primary"
                loading={isSavingQuestion}
                disabled={isSavingQuestion || !newQuestionText.trim()}
                onPress={handleAddQuestion}
                style={{ flex: 1 }}
              />
            </View>
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
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  headerCenter: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  heroCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 3,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
    overflow: "hidden",
    marginVertical: Spacing.xs,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  heroTipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  heroTipText: {
    flex: 1,
    fontSize: 12,
    color: Palette.primaryDark,
    lineHeight: 18,
  },
  contextCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  doctorAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorSpec: {
    fontSize: 13,
    color: Palette.primary,
    fontWeight: "600",
  },
  hospitalName: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  contextDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.sm,
  },
  contextDetailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  contextItem: {
    flex: 1,
  },
  contextLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  contextValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 1,
  },
  patientRel: {
    color: Palette.textMuted,
    fontWeight: "400",
  },
  sectionWrap: {
    gap: Spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  sectionSub: {
    fontSize: 12,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
  },
  checklistCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: "hidden",
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  checklistItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  checkboxCircle: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  checklistTitleDone: {
    color: Palette.textMuted,
  },
  checklistDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  autoVerifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: "#ecfdf5",
  },
  autoVerifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065f46",
  },
  instructionsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  instHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  instTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  instList: {
    gap: Spacing.xs,
  },
  instItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  instBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.primary,
    marginTop: 6,
  },
  instText: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    lineHeight: 18,
  },
  symptomsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  notesInput: {
    minHeight: 80,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 13,
    color: Palette.text,
    textAlignVertical: "top",
    marginTop: Spacing.xs,
  },
  questionsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  cardHeaderWithAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  compactBtn: {
    paddingHorizontal: Spacing.sm,
  },
  emptyQuestionsBox: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  emptyQuestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  emptyQuestionsText: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  questionsList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  questionItemCard: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  questionItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  questionNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primary,
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    lineHeight: 18,
  },
  questionFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  shareToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shareStatusText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  shareStatusActive: {
    color: Palette.success,
    fontWeight: "600",
  },
  documentsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  emptyDocsBox: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  emptyDocsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  emptyDocsText: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  docsList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  docItemCard: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  docInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  docCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  docTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
  },
  docMeta: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },
  docActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  sharedBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sharedBadgeText: {
    fontSize: 11,
    color: Palette.success,
    fontWeight: "600",
  },
  unsharedBadgeText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  historyCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  historyList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  histItemBox: {
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  histHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  histDate: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
  },
  histDiagnosis: {
    fontSize: 12,
    color: Palette.primary,
    marginTop: 2,
  },
  histMeds: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  handoffSection: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  handoffTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  handoffSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  handoffButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  modalContent: {
    width: "100%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  modalDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  modalTextInput: {
    minHeight: 90,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 13,
    color: Palette.text,
    textAlignVertical: "top",
    marginBottom: Spacing.md,
  },
  modalShareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  modalShareTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.text,
  },
  modalShareSub: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 1,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
