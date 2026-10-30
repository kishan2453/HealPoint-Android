/**
 * HealPoint — Smart Appointment Preparation & Pre-Consultation Center.
 *
 * Flagship patient-facing pre-consultation hub built exclusively on real HealPoint data:
 *  - Deterministic Smart Next Action CTA banner based on real appointment state
 *  - Today's Appointment high-priority alert when appointment is today
 *  - Verified 9-point preparation status grid with "Not Required" badges for non-applicable modes
 *  - Patient context with family member isolation and clinical profile details
 *  - Dynamic interactive preparation checklist
 *  - Video device readiness checks (Camera, Microphone, Network, Google Meet status)
 *  - AI Preparation Assistant with contextual pre-consultation prompt chips
 *  - Inline document upload and one-tap doctor sharing / revoking
 *  - Questions for Doctor with discussion tracking & sharing switch
 *  - Private Pre-Consultation Notes stored confidentially for the patient
 *  - Consultation instructions with formal acknowledgment
 *  - Continuity of Care: previous visit history with diagnoses & medications
 *  - Consultation readiness handoff (Waiting room / Google Meet vs Hospital Pass QR)
 *  - Health Locker quick shortcuts (Wallet, Prescriptions, Reports, Timeline)
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import * as healthDocumentsService from "@/services/health-documents";
import * as walletService from "@/services/wallet";
import type {
  AppointmentPreparationResponse,
  PatientQuestionItem,
  PreparationChecklistItem,
  PreparationDocumentItem,
} from "@/types";

const DOC_CATEGORIES = [
  "Lab Report",
  "Prescription",
  "Scan / Imaging",
  "Discharge Summary",
  "Medical Report",
  "Other",
];

export default function AppointmentPreparationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentPreparationResponse | null>(null);

  // Editable Symptoms Notes (shared with doctor)
  const [symptomsNotes, setSymptomsNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Private Patient Notes (strictly confidential)
  const [privateNotes, setPrivateNotes] = useState("");
  const [isSavingPrivateNotes, setIsSavingPrivateNotes] = useState(false);

  // Question Modal & Form
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionShare, setNewQuestionShare] = useState(true);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // Document Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocTitle, setUploadDocTitle] = useState("");
  const [uploadDocCategory, setUploadDocCategory] = useState("Lab Report");
  const [uploadDocAsset, setUploadDocAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Video Device Readiness State
  const [deviceCameraReady, setDeviceCameraReady] = useState<boolean | null>(
    null,
  );
  const [deviceMicReady, setDeviceMicReady] = useState<boolean | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(false);

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
      setPrivateNotes(res.preparation?.privatePatientNotes || "");
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

  // Execute Smart Next Action
  const handleSmartNextActionPress = () => {
    if (!data || !id) return;
    const act = data.smartNextAction;
    if (!act) return;

    switch (act.key) {
      case "PAY_NOW":
        router.push({
          pathname: "/payment/[appointmentId]" as any,
          params: { appointmentId: id },
        });
        break;
      case "JOIN_CONSULTATION":
        if (data.appointment.meetingUrl) {
          openGoogleMeetUrl(data.appointment.meetingUrl);
        } else {
          router.push({
            pathname: "/consultation/[id]" as any,
            params: { id: data.appointment._id },
          });
        }
        break;
      case "CHECK_IN_READY":
      case "IN_QUEUE":
        router.push({
          pathname: "/appointment/pass/[id]" as any,
          params: { id: data.appointment._id },
        });
        break;
      case "PREPARE_DOCS":
        setShowUploadModal(true);
        break;
      case "VIEW_PRESCRIPTION":
        router.push("/(drawer)/health/prescriptions" as any);
        break;
      case "REBOOK":
        if (data.doctor?._id) {
          router.push({
            pathname: "/booking/[doctorId]" as any,
            params: {
              doctorId: String(data.doctor._id),
              type: data.appointment.consultationType || "clinic",
            },
          });
        }
        break;
      default:
        break;
    }
  };

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

  // Save Symptoms Notes (shared with doctor)
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

  // Save Private Patient Notes (strictly confidential)
  const handleSavePrivateNotes = async () => {
    if (!id) return;
    try {
      setIsSavingPrivateNotes(true);
      await appointmentService.updatePreparationChecklist(id, {
        privatePatientNotes: privateNotes.trim(),
      });
      Alert.alert(
        "Private Notes Saved",
        "Your private pre-consultation notes are safely stored on your profile.",
      );
    } catch (err) {
      Alert.alert(
        "Error",
        toErrorMessage(err) || "Failed to save private notes.",
      );
    } finally {
      setIsSavingPrivateNotes(false);
    }
  };

  // Add Question for Doctor
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

  // Toggle question discussion status (mark discussed)
  const handleToggleQuestionDiscussed = async (
    qIndex: number,
    item: PatientQuestionItem,
  ) => {
    if (!data || !id) return;
    try {
      const updatedQuestions = [...data.preparation.patientQuestions];
      updatedQuestions[qIndex] = {
        ...item,
        isDiscussed: !item.isDiscussed,
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
        toErrorMessage(err) || "Failed to update question status.",
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

  // Pick Document Image for Upload
  const handlePickDocumentImage = async (useCamera = false) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          `Please grant ${useCamera ? "camera" : "photo library"} access to upload health documents.`,
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsEditing: true,
          });

      if (result.canceled || !result.assets[0]) return;
      setUploadDocAsset(result.assets[0]);
      if (!uploadDocTitle.trim()) {
        setUploadDocTitle(
          `${uploadDocCategory} for ${data?.doctor?.name || "Consultation"}`,
        );
      }
    } catch {
      Alert.alert("Upload Error", "Could not pick document. Please try again.");
    }
  };

  // Upload and Share Document
  const handleUploadAndShareDocument = async () => {
    if (!uploadDocAsset || !data || !id) return;
    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append("file", {
        uri: uploadDocAsset.uri,
        name: uploadDocAsset.fileName || "medical-document.jpg",
        type: uploadDocAsset.mimeType || "image/jpeg",
      } as any);
      formData.append(
        "title",
        uploadDocTitle.trim() || "Consultation Document",
      );
      formData.append("category", uploadDocCategory);
      if (data.patient?.familyMemberId) {
        formData.append("familyMemberId", data.patient.familyMemberId);
      }
      const uploaded =
        await healthDocumentsService.uploadHealthDocument(formData);

      if (uploaded && uploaded.document) {
        if (data.doctor?._id) {
          await walletService.shareHealthDocumentWithDoctor(
            uploaded.document._id || (uploaded.document as any).id,
            {
              doctorId: data.doctor._id,
              appointmentId: data.appointment._id,
              note: `Attached during preparation for consultation on ${data.appointment.slotDate}`,
            },
          );
        }
        setShowUploadModal(false);
        setUploadDocAsset(null);
        setUploadDocTitle("");
        Alert.alert(
          "Document Shared",
          "Your document has been securely uploaded and shared with your doctor.",
        );
        await loadPreparation();
      }
    } catch (err) {
      Alert.alert(
        "Upload Failed",
        toErrorMessage(err) || "Could not upload document.",
      );
    } finally {
      setUploadingDoc(false);
    }
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

  // Test Device Readiness for Video Consultations
  const handleTestDeviceReadiness = async () => {
    setCheckingDevice(true);
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      setDeviceCameraReady(camPerm.granted);
      setDeviceMicReady(true);
    } catch {
      setDeviceCameraReady(false);
      setDeviceMicReady(false);
    } finally {
      setCheckingDevice(false);
    }
  };

  // Contextual AI Assistant Query
  const handleAskAIPreparation = (promptText: string) => {
    router.push({
      pathname: "/ai-assistant" as any,
      params: {
        initialQuery: promptText,
        appointmentId: id,
        doctorName: data?.doctor?.name,
        speciality: data?.doctor?.speciality,
      },
    });
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

  const isConfirmed =
    data.appointment.status === "confirmed" ||
    data.appointment.status === "completed";
  const isPaid =
    data.appointment.paymentStatus === "paid" ||
    data.appointment.paymentStatus === "verified";
  const hasSharedDocs = documents.some((d) => d.isSharedWithDoctor);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Navigation Header */}
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
        {/* ---- 1. Smart Next Action Banner ---- */}
        {data.smartNextAction ? (
          <Card padded style={styles.nextActionCard}>
            <View style={styles.nextActionRow}>
              <View
                style={[
                  styles.nextActionIconBox,
                  data.smartNextAction.variant === "warning" && {
                    backgroundColor: "#FEF3C7",
                  },
                  data.smartNextAction.variant === "primary" && {
                    backgroundColor: "#EEF2FF",
                  },
                ]}
              >
                <Ionicons
                  name={
                    (data.smartNextAction.icon as any) ||
                    "arrow-forward-circle-outline"
                  }
                  size={24}
                  color={
                    data.smartNextAction.variant === "warning"
                      ? "#D97706"
                      : data.smartNextAction.variant === "primary"
                        ? "#4F46E5"
                        : Palette.primaryDark
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nextActionBadgeRow}>
                  <Text style={styles.nextActionLabel}>
                    Recommended Next Action
                  </Text>
                  <Badge
                    label="Action Needed"
                    variant={
                      data.smartNextAction.variant === "warning"
                        ? "warning"
                        : "primary"
                    }
                  />
                </View>
                <Text style={styles.nextActionTitle}>
                  {data.smartNextAction.label}
                </Text>
                <Text style={styles.nextActionDesc}>
                  {data.smartNextAction.description}
                </Text>
              </View>
            </View>
            <Button
              title={data.smartNextAction.label}
              variant={(data.smartNextAction.variant as any) || "primary"}
              icon={data.smartNextAction.icon as any}
              onPress={handleSmartNextActionPress}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : null}

        {/* ---- 2. Today's Appointment Highlight Banner ---- */}
        {data.isToday ? (
          <Card padded style={styles.todayCard}>
            <View style={styles.todayHeaderRow}>
              <View style={styles.todayBadge}>
                <Ionicons name="time" size={14} color={Palette.white} />
                <Text style={styles.todayBadgeText}>TODAY'S APPOINTMENT</Text>
              </View>
              <Text style={styles.todayTimeText}>
                {data.appointment.slotTime}
              </Text>
            </View>
            <Text style={styles.todayTitle}>
              Consultation with {formatDoctorName(doctor.name)}
            </Text>
            <Text style={styles.todaySubtitle}>
              {isVideo
                ? "Your video consultation room activates 5 minutes prior to appointment time."
                : `Plan arrival at ${data.hospital.name || "the clinic"} 15 minutes early for desk registration.`}
            </Text>
            <View style={styles.todayActionsRow}>
              {isVideo ? (
                <Button
                  title={
                    data.appointment.meetingUrl
                      ? "Join Video Call"
                      : "Open Waiting Room"
                  }
                  variant="primary"
                  icon="videocam"
                  onPress={() => {
                    if (data.appointment.meetingUrl) {
                      openGoogleMeetUrl(data.appointment.meetingUrl);
                    } else {
                      router.push({
                        pathname: "/consultation/[id]" as any,
                        params: { id: data.appointment._id },
                      });
                    }
                  }}
                  style={{ flex: 1 }}
                />
              ) : (
                <Button
                  title={
                    data.appointment.checkedIn
                      ? `Queue Token #${data.appointment.queueToken || "Active"}`
                      : "Self Check-In (Pass QR)"
                  }
                  variant="primary"
                  icon="qr-code-outline"
                  onPress={() =>
                    router.push({
                      pathname: "/appointment/pass/[id]" as any,
                      params: { id: data.appointment._id },
                    })
                  }
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </Card>
        ) : null}

        {/* ---- 3. Readiness Hero Card ---- */}
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

        {/* ---- 4. Real Data Preparation Status Breakdown ---- */}
        <Card padded style={styles.statusGridCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={Palette.primary}
            />
            <Text style={styles.sectionTitle}>
              Preparation Status Breakdown
            </Text>
          </View>
          <Text style={styles.sectionSub}>
            Real-time status based strictly on your verified appointment data.
          </Text>

          <View style={styles.statusItemsList}>
            {/* 1. Appointment Confirmed */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={isConfirmed ? "checkmark-circle" : "time-outline"}
                  size={18}
                  color={isConfirmed ? Palette.success : Palette.warning}
                />
                <Text style={styles.statusItemTitle}>
                  Appointment Confirmed
                </Text>
              </View>
              <Badge
                label={isConfirmed ? "Confirmed" : "Pending Confirmation"}
                variant={isConfirmed ? "success" : "warning"}
              />
            </View>

            {/* 2. Payment Confirmed */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={isPaid ? "checkmark-circle" : "card-outline"}
                  size={18}
                  color={isPaid ? Palette.success : Palette.warning}
                />
                <Text style={styles.statusItemTitle}>Payment Status</Text>
              </View>
              <Badge
                label={isPaid ? "Paid / Verified" : "Payment Pending"}
                variant={isPaid ? "success" : "warning"}
              />
            </View>

            {/* 3. Doctor Accepted */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={
                    data.doctorAccepted || isConfirmed
                      ? "checkmark-circle"
                      : "hourglass-outline"
                  }
                  size={18}
                  color={
                    data.doctorAccepted || isConfirmed
                      ? Palette.success
                      : Palette.textMuted
                  }
                />
                <Text style={styles.statusItemTitle}>Doctor Accepted</Text>
              </View>
              <Badge
                label={
                  data.doctorAccepted || isConfirmed
                    ? "Accepted"
                    : "Under Review"
                }
                variant={
                  data.doctorAccepted || isConfirmed ? "success" : "neutral"
                }
              />
            </View>

            {/* 4. Required Documents Ready */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={
                    hasSharedDocs ? "checkmark-circle" : "document-text-outline"
                  }
                  size={18}
                  color={hasSharedDocs ? Palette.success : Palette.textMuted}
                />
                <Text style={styles.statusItemTitle}>Documents Shared</Text>
              </View>
              <Badge
                label={
                  hasSharedDocs
                    ? `${documents.filter((d) => d.isSharedWithDoctor).length} Shared`
                    : "None Attached"
                }
                variant={hasSharedDocs ? "primary" : "neutral"}
              />
            </View>

            {/* 5. Medical History Ready */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={Palette.success}
                />
                <Text style={styles.statusItemTitle}>Medical History</Text>
              </View>
              <Badge
                label={
                  previousHistory.length > 0
                    ? "History Loaded"
                    : "Profile Active"
                }
                variant="success"
              />
            </View>

            {/* 6. Questions Prepared */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={
                    questions.length > 0
                      ? "checkmark-circle"
                      : "help-circle-outline"
                  }
                  size={18}
                  color={
                    questions.length > 0 ? Palette.success : Palette.textMuted
                  }
                />
                <Text style={styles.statusItemTitle}>Questions for Doctor</Text>
              </View>
              <Badge
                label={
                  questions.length > 0
                    ? `${questions.length} Prepared`
                    : "Optional"
                }
                variant={questions.length > 0 ? "primary" : "neutral"}
              />
            </View>

            {/* 7. Check-In Ready */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={
                    isVideo
                      ? "remove-circle-outline"
                      : data.appointment.checkedIn
                        ? "checkmark-circle"
                        : "qr-code-outline"
                  }
                  size={18}
                  color={
                    isVideo
                      ? Palette.textMuted
                      : data.appointment.checkedIn
                        ? Palette.success
                        : Palette.primary
                  }
                />
                <Text style={styles.statusItemTitle}>Check-In Readiness</Text>
              </View>
              <Badge
                label={
                  isVideo
                    ? "Not Required"
                    : data.appointment.checkedIn
                      ? "Checked In"
                      : data.checkInEligible
                        ? "Ready Today"
                        : "Visit Day"
                }
                variant={
                  isVideo
                    ? "neutral"
                    : data.appointment.checkedIn
                      ? "success"
                      : data.checkInEligible
                        ? "primary"
                        : "neutral"
                }
              />
            </View>

            {/* 8. Digital Pass Available */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={isVideo ? "remove-circle-outline" : "card-outline"}
                  size={18}
                  color={isVideo ? Palette.textMuted : Palette.primary}
                />
                <Text style={styles.statusItemTitle}>
                  Digital Hospital Pass
                </Text>
              </View>
              <Badge
                label={
                  isVideo
                    ? "Not Required"
                    : data.appointment.queueToken ||
                        data.appointment.appointmentId
                      ? "Pass Ready"
                      : "Pending"
                }
                variant={isVideo ? "neutral" : "primary"}
              />
            </View>

            {/* 9. Video Consultation Ready */}
            <View style={styles.statusItemRow}>
              <View style={styles.statusItemLeft}>
                <Ionicons
                  name={
                    !isVideo
                      ? "remove-circle-outline"
                      : data.appointment.meetingUrl
                        ? "checkmark-circle"
                        : "videocam-outline"
                  }
                  size={18}
                  color={
                    !isVideo
                      ? Palette.textMuted
                      : data.appointment.meetingUrl
                        ? Palette.success
                        : Palette.primary
                  }
                />
                <Text style={styles.statusItemTitle}>Video Consultation</Text>
              </View>
              <Badge
                label={
                  !isVideo
                    ? "Not Required"
                    : data.appointment.meetingUrl
                      ? "Meeting Active"
                      : "Google Meet Ready"
                }
                variant={
                  !isVideo
                    ? "neutral"
                    : data.appointment.meetingUrl
                      ? "success"
                      : "primary"
                }
              />
            </View>
          </View>
        </Card>

        {/* ---- 5. Appointment Context & Patient Isolation ---- */}
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

        {/* ---- 6. Video Device Readiness Check (for Video Consultations) ---- */}
        {isVideo ? (
          <Card padded style={styles.deviceCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="hardware-chip-outline"
                size={20}
                color={Palette.primary}
              />
              <Text style={styles.sectionTitle}>Video Device Readiness</Text>
            </View>
            <Text style={styles.sectionSub}>
              Ensure your device permissions and network are prepared for Google
              Meet.
            </Text>

            <View style={styles.deviceChecksList}>
              <View style={styles.deviceCheckRow}>
                <Ionicons
                  name={
                    deviceCameraReady === true
                      ? "checkmark-circle"
                      : "videocam-outline"
                  }
                  size={18}
                  color={
                    deviceCameraReady === true
                      ? Palette.success
                      : Palette.primary
                  }
                />
                <Text style={styles.deviceCheckText}>Camera Access</Text>
                <Badge
                  label={
                    deviceCameraReady === true
                      ? "Ready"
                      : deviceCameraReady === false
                        ? "Permission Denied"
                        : "Untested"
                  }
                  variant={
                    deviceCameraReady === true
                      ? "success"
                      : deviceCameraReady === false
                        ? "error"
                        : "neutral"
                  }
                />
              </View>

              <View style={styles.deviceCheckRow}>
                <Ionicons
                  name={
                    deviceMicReady === true ? "checkmark-circle" : "mic-outline"
                  }
                  size={18}
                  color={
                    deviceMicReady === true ? Palette.success : Palette.primary
                  }
                />
                <Text style={styles.deviceCheckText}>Microphone & Audio</Text>
                <Badge
                  label={deviceMicReady === true ? "Ready" : "Untested"}
                  variant={deviceMicReady === true ? "success" : "neutral"}
                />
              </View>

              <View style={styles.deviceCheckRow}>
                <Ionicons
                  name="wifi-outline"
                  size={18}
                  color={Palette.success}
                />
                <Text style={styles.deviceCheckText}>Network Connectivity</Text>
                <Badge label="Connected" variant="success" />
              </View>

              <View style={styles.deviceCheckRow}>
                <Ionicons
                  name={
                    data.appointment.meetingUrl
                      ? "checkmark-circle"
                      : "link-outline"
                  }
                  size={18}
                  color={
                    data.appointment.meetingUrl
                      ? Palette.success
                      : Palette.primary
                  }
                />
                <Text style={styles.deviceCheckText}>Meeting Room Link</Text>
                <Badge
                  label={
                    data.appointment.meetingUrl
                      ? "Link Ready"
                      : "Generates on Start"
                  }
                  variant={data.appointment.meetingUrl ? "success" : "neutral"}
                />
              </View>
            </View>

            <Button
              title={
                checkingDevice
                  ? "Testing Device..."
                  : "Test Camera & Permissions"
              }
              variant="outline"
              icon="camera-outline"
              loading={checkingDevice}
              onPress={handleTestDeviceReadiness}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        ) : null}

        {/* ---- 7. Dynamic Interactive Checklist ---- */}
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

        {/* ---- 8. AI Preparation Assistant Contextual Prompts ---- */}
        <Card padded style={styles.aiCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sparkles" size={20} color="#7C3AED" />
            <Text style={[styles.sectionTitle, { color: "#6D28D9" }]}>
              AI Preparation Assistant
            </Text>
          </View>
          <Text style={styles.sectionSub}>
            Tap any topic to get smart clinical guidance from your HealPoint AI
            Assistant.
          </Text>

          <View style={styles.aiChipsWrap}>
            <Pressable
              style={styles.aiChip}
              onPress={() =>
                handleAskAIPreparation(
                  `Help me prepare for my consultation with Dr. ${doctor.name} (${doctor.speciality || doctor.department || "Specialist"}). What questions should I ask?`,
                )
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color="#7C3AED"
              />
              <Text style={styles.aiChipText}>
                What questions should I ask?
              </Text>
            </Pressable>

            <Pressable
              style={styles.aiChip}
              onPress={() =>
                handleAskAIPreparation(
                  `What medical reports and previous prescriptions should I have ready for a ${doctor.speciality || doctor.department || "specialist"} consultation?`,
                )
              }
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color="#7C3AED"
              />
              <Text style={styles.aiChipText}>
                What documents should I share?
              </Text>
            </Pressable>

            <Pressable
              style={styles.aiChip}
              onPress={() =>
                handleAskAIPreparation(
                  `Review my preparation for my upcoming appointment with Dr. ${doctor.name} on ${data.appointment.slotDate}.`,
                )
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#7C3AED"
              />
              <Text style={styles.aiChipText}>Check my readiness status</Text>
            </Pressable>
          </View>
        </Card>

        {/* ---- 9. Relevant Health Documents & Doctor Sharing ---- */}
        <Card padded style={styles.documentsCard}>
          <View style={styles.cardHeaderWithAction}>
            <View style={styles.headerTextGroup}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
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
            <View style={styles.headerActionsGroup}>
              <Button
                title="+ Upload"
                variant="primary"
                fullWidth={false}
                icon="cloud-upload-outline"
                onPress={() => setShowUploadModal(true)}
                style={styles.compactBtn}
              />
              <Button
                title="Wallet"
                variant="outline"
                fullWidth={false}
                icon="wallet-outline"
                onPress={() => router.push("/(drawer)/health-wallet" as any)}
                style={styles.compactBtn}
              />
            </View>
          </View>

          {documents.length === 0 ? (
            <View style={styles.emptyDocsBox}>
              <Ionicons
                name="folder-open-outline"
                size={28}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyDocsTitle}>No Personal Documents</Text>
              <Text style={styles.emptyDocsText}>
                Upload lab reports, scans, or previous prescriptions to share
                them with {formatDoctorName(doctor.name)}.
              </Text>
              <Button
                title="Upload Document"
                variant="outline"
                fullWidth={false}
                icon="cloud-upload-outline"
                onPress={() => setShowUploadModal(true)}
                style={styles.emptyActionBtn}
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
                          Shared with {formatDoctorName(doctor.name)}
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
                      fullWidth={false}
                      loading={sharingDocId === doc._id}
                      disabled={sharingDocId === doc._id}
                      onPress={() => handleToggleDocumentShare(doc)}
                      style={styles.compactDocActionBtn}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ---- 10. Questions for Doctor (with Discussion Status) ---- */}
        <Card padded style={styles.questionsCard}>
          <View style={styles.cardHeaderWithAction}>
            <View style={styles.headerTextGroup}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color={Palette.primary}
                />
                <Text style={styles.sectionTitle}>Questions for Doctor</Text>
              </View>
              <Text style={styles.sectionSub}>
                List questions you want answered. Mark them as discussed during
                your call.
              </Text>
            </View>
            <View style={styles.headerActionsGroup}>
              <Button
                title="+ Add"
                variant="outline"
                fullWidth={false}
                icon="add-circle-outline"
                onPress={() => setShowAddQuestionModal(true)}
                style={styles.compactBtn}
              />
            </View>
          </View>

          {questions.length === 0 ? (
            <View style={styles.emptyQuestionsBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={28}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyQuestionsTitle}>
                No Questions Added Yet
              </Text>
              <Text style={styles.emptyQuestionsText}>
                Writing down your questions ensures nothing gets missed during
                your time with {formatDoctorName(doctor.name)}.
              </Text>
              <Button
                title="Add First Question"
                variant="outline"
                fullWidth={false}
                icon="add-circle-outline"
                onPress={() => setShowAddQuestionModal(true)}
                style={styles.emptyActionBtn}
              />
            </View>
          ) : (
            <View style={styles.questionsList}>
              {questions.map((q, qIdx) => (
                <View key={q._id || qIdx} style={styles.questionItemCard}>
                  <View style={styles.questionItemHeader}>
                    <Pressable
                      onPress={() => handleToggleQuestionDiscussed(qIdx, q)}
                      hitSlop={8}
                      style={{ marginTop: 1 }}
                    >
                      <Ionicons
                        name={
                          q.isDiscussed ? "checkmark-circle" : "ellipse-outline"
                        }
                        size={18}
                        color={q.isDiscussed ? Palette.success : Palette.border}
                      />
                    </Pressable>
                    <Text
                      style={[
                        styles.questionText,
                        q.isDiscussed && styles.questionDiscussedText,
                      ]}
                    >
                      {q.question}
                    </Text>
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

        {/* ---- 11. Symptoms & Notes for Doctor ---- */}
        <Card padded style={styles.symptomsCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="create-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Symptoms Notes (For Doctor)</Text>
          </View>
          <Text style={styles.sectionSub}>
            Summarize primary symptoms or timeline so the doctor has immediate
            context.
          </Text>

          <TextInput
            value={symptomsNotes}
            onChangeText={setSymptomsNotes}
            placeholder="e.g. Mild throat irritation and headache since 2 days, worse in morning. No fever recorded."
            placeholderTextColor={Palette.textMuted}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />

          <Button
            title="Save Symptoms Notes"
            variant="outline"
            fullWidth={false}
            icon="save-outline"
            loading={isSavingNotes}
            disabled={isSavingNotes}
            onPress={handleSaveSymptomsNotes}
            style={styles.saveNotesBtn}
          />
        </Card>

        {/* ---- 12. Private Pre-Consultation Notes (Confidential) ---- */}
        <Card padded style={styles.privateNotesCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.sectionTitle}>
              Private Pre-Consultation Notes
            </Text>
          </View>
          <Text style={styles.sectionSub}>
            Confidential personal reminders for yourself. These notes are NEVER
            sent to the doctor.
          </Text>

          <TextInput
            value={privateNotes}
            onChangeText={setPrivateNotes}
            placeholder="e.g. Ask about alternate medicine brands; mention previous mild reaction to penicillin; remind myself to request medical leave certificate."
            placeholderTextColor={Palette.textMuted}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
          />

          <Button
            title="Save Private Notes"
            variant="outline"
            fullWidth={false}
            icon="save-outline"
            loading={isSavingPrivateNotes}
            disabled={isSavingPrivateNotes}
            onPress={handleSavePrivateNotes}
            style={styles.saveNotesBtn}
          />
        </Card>

        {/* ---- 13. Consultation Instructions ---- */}
        <Card padded style={styles.instructionsCard}>
          <View style={styles.instHeaderRow}>
            <Ionicons
              name={isVideo ? "videocam-outline" : "business-outline"}
              size={20}
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
            fullWidth={true}
            icon={
              instructions.isAcknowledged
                ? "checkmark-circle"
                : "shield-checkmark"
            }
            onPress={handleAcknowledgeInstructions}
            style={styles.ackBtn}
          />
        </Card>

        {/* ---- 14. Continuity of Care: Previous Visit History ---- */}
        {previousHistory.length > 0 && (
          <Card padded style={styles.historyCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={20} color={Palette.primary} />
              <Text style={styles.sectionTitle}>
                Previous History with {formatDoctorName(doctor.name)}
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

        {/* ---- 15. Health Locker Quick Shortcuts ---- */}
        <View style={styles.shortcutsWrap}>
          <Text style={styles.shortcutsHeader}>
            Quick Access to Health Locker
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutsScroll}
          >
            <Pressable
              style={styles.shortcutPill}
              onPress={() => router.push("/(drawer)/health-wallet" as any)}
            >
              <Ionicons
                name="wallet-outline"
                size={16}
                color={Palette.primary}
              />
              <Text style={styles.shortcutPillText}>Health Wallet</Text>
            </Pressable>
            <Pressable
              style={styles.shortcutPill}
              onPress={() =>
                router.push("/(drawer)/health/prescriptions" as any)
              }
            >
              <Ionicons name="medkit-outline" size={16} color="#059669" />
              <Text style={styles.shortcutPillText}>Prescriptions</Text>
            </Pressable>
            <Pressable
              style={styles.shortcutPill}
              onPress={() => router.push("/(drawer)/health/reports" as any)}
            >
              <Ionicons name="bar-chart-outline" size={16} color="#2563EB" />
              <Text style={styles.shortcutPillText}>Lab Reports</Text>
            </Pressable>
            <Pressable
              style={styles.shortcutPill}
              onPress={() => router.push("/(drawer)/health/timeline" as any)}
            >
              <Ionicons name="time-outline" size={16} color="#7C3AED" />
              <Text style={styles.shortcutPillText}>Care Timeline</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* ---- 16. Action Handoff Footer ---- */}
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
                fullWidth={false}
                icon="chatbubbles-outline"
                onPress={() =>
                  router.push({
                    pathname: "/consultation/[id]" as any,
                    params: { id: data.appointment._id },
                  })
                }
                style={styles.handoffBtn}
              />
              {data.appointment.meetingUrl ? (
                <Button
                  title="Launch Google Meet"
                  variant="primary"
                  fullWidth={false}
                  icon="videocam"
                  onPress={() => openGoogleMeetUrl(data.appointment.meetingUrl)}
                  style={styles.handoffBtn}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.handoffButtonsRow}>
              <Button
                title="View Hospital Pass"
                variant="primary"
                fullWidth={false}
                icon="card-outline"
                onPress={() =>
                  router.push({
                    pathname: "/appointment/pass/[id]" as any,
                    params: { id: data.appointment._id },
                  })
                }
                style={styles.handoffBtn}
              />
              <Button
                title="Back to Details"
                variant="outline"
                fullWidth={false}
                icon="arrow-back-outline"
                onPress={() => router.back()}
                style={styles.handoffBtn}
              />
            </View>
          )}
        </View>

        <View style={{ height: Spacing.lg }} />
      </ScrollView>

      {/* ---- Add Question Modal ---- */}
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
              concern you wish to discuss with {formatDoctorName(doctor.name)}.
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
                  When enabled, {formatDoctorName(doctor.name)} will see this in
                  their clinical notes view.
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

      {/* ---- Document Upload & Share Modal ---- */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Health Document</Text>
              <Pressable onPress={() => setShowUploadModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={Palette.text} />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Securely attach a lab test, prescription, or scan to share with
              {formatDoctorName(doctor.name)} for this appointment.
            </Text>

            {/* Document Picker Buttons */}
            <View style={styles.uploadPickerRow}>
              <Pressable
                style={styles.pickerBox}
                onPress={() => handlePickDocumentImage(true)}
              >
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={Palette.primary}
                />
                <Text style={styles.pickerBoxText}>Take Photo</Text>
              </Pressable>

              <Pressable
                style={styles.pickerBox}
                onPress={() => handlePickDocumentImage(false)}
              >
                <Ionicons
                  name="images-outline"
                  size={24}
                  color={Palette.primary}
                />
                <Text style={styles.pickerBoxText}>Photo Library</Text>
              </Pressable>
            </View>

            {/* Selected Image Preview */}
            {uploadDocAsset ? (
              <View style={styles.uploadPreviewWrap}>
                <Image
                  source={{ uri: uploadDocAsset.uri }}
                  style={styles.uploadPreviewImg}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadPreviewName} numberOfLines={1}>
                    {uploadDocAsset.fileName || "Selected Document"}
                  </Text>
                  <Text style={styles.uploadPreviewMeta}>
                    Ready to attach & share
                  </Text>
                </View>
                <Pressable onPress={() => setUploadDocAsset(null)} hitSlop={8}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={Palette.error}
                  />
                </Pressable>
              </View>
            ) : null}

            {/* Title Input */}
            <Text style={styles.inputFieldLabel}>Document Title</Text>
            <TextInput
              value={uploadDocTitle}
              onChangeText={setUploadDocTitle}
              placeholder="e.g. Recent CBC Blood Test"
              placeholderTextColor={Palette.textMuted}
              style={styles.uploadTextInput}
            />

            {/* Category Selector */}
            <Text style={styles.inputFieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {DOC_CATEGORIES.map((cat) => {
                const active = uploadDocCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setUploadDocCategory(cat)}
                    style={[
                      styles.categoryChip,
                      active && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowUploadModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={uploadingDoc ? "Uploading..." : "Attach & Share"}
                variant="primary"
                loading={uploadingDoc}
                disabled={uploadingDoc || !uploadDocAsset}
                onPress={handleUploadAndShareDocument}
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

  // Smart Next Action Card
  nextActionCard: {
    backgroundColor: Palette.surface,
    borderColor: "rgba(14, 159, 142, 0.25)",
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  nextActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  nextActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  nextActionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  nextActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextActionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
  },
  nextActionDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },

  // Today's Appointment Banner
  todayCard: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  todayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  todayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  todayBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  todayTimeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  todayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  todaySubtitle: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    lineHeight: 17,
  },
  todayActionsRow: {
    flexDirection: "row",
    marginTop: Spacing.sm,
  },

  // Hero Card
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

  // Status Grid Card
  statusGridCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  statusItemsList: {
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  statusItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  statusItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  statusItemTitle: {
    fontSize: 13,
    color: Palette.text,
    fontWeight: "500",
  },

  // Context Card
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

  // Video Device Readiness Card
  deviceCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  deviceChecksList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  deviceCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  deviceCheckText: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    marginLeft: 8,
  },

  // Checklist
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

  // AI Assistant Card
  aiCard: {
    backgroundColor: "#FAF5FF",
    borderColor: "#E9D5FF",
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  aiChipsWrap: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Palette.white,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  aiChipText: {
    fontSize: 12,
    color: "#5B21B6",
    fontWeight: "600",
    flex: 1,
  },

  // Instructions
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

  // Symptoms & Notes
  symptomsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  privateNotesCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.2)",
  },
  notesInput: {
    minHeight: 64,
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
  saveNotesBtn: {
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginTop: Spacing.xs,
    alignSelf: "flex-start",
  },
  ackBtn: {
    minHeight: 44,
    paddingVertical: 6,
    marginTop: Spacing.sm,
  },
  handoffBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 6,
  },

  // Questions Card
  questionsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  cardHeaderWithAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.xs,
  },
  headerActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  compactBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.sm + 2,
  },
  compactDocActionBtn: {
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  emptyActionBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: Spacing.xs,
  },
  emptyQuestionsBox: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  emptyQuestionsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 4,
  },
  emptyQuestionsText: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 16,
    maxWidth: 280,
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
  questionText: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    lineHeight: 18,
  },
  questionDiscussedText: {
    textDecorationLine: "line-through",
    color: Palette.textMuted,
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

  // Documents Card
  documentsCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
  },
  emptyDocsBox: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  emptyDocsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 4,
  },
  emptyDocsText: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 16,
    maxWidth: 280,
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

  // History Card
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

  // Shortcuts Wrap
  shortcutsWrap: {
    marginTop: Spacing.xs,
  },
  shortcutsHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  shortcutsScroll: {
    gap: Spacing.xs,
  },
  shortcutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  shortcutPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },

  // Handoff Section
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

  // Modal Styles
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
    minHeight: 80,
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
    marginTop: Spacing.xs,
  },

  // Upload Modal Specific
  uploadPickerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pickerBox: {
    flex: 1,
    height: 72,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pickerBoxText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.primary,
  },
  uploadPreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  uploadPreviewImg: {
    width: 48,
    height: 48,
    borderRadius: Radius.xs,
  },
  uploadPreviewName: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  uploadPreviewMeta: {
    fontSize: 11,
    color: Palette.success,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
    marginBottom: 4,
  },
  uploadTextInput: {
    height: 44,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    fontSize: 13,
    color: Palette.text,
    marginBottom: Spacing.sm,
  },
  categoryScroll: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  categoryChipActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  categoryChipText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  categoryChipTextActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
});
