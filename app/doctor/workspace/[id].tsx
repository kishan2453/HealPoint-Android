/**
 * HealPoint - Doctor Clinical Workspace 2.0
 *
 * Professional appointment-to-consultation clinical workflow:
 * Today's Appointment → Patient Chart → Consultation → Clinical Notes → Vitals & BMI → Prescription → Reports → Follow-up → Finalize Consultation
 *
 * Direct integration with backend endpoints:
 * - GET /doctor/panel/:doctorId/consultation/:appointmentId
 * - PATCH /doctor/panel/:doctorId/consultation/:appointmentId/start
 * - PUT /doctor/panel/:doctorId/consultation/:appointmentId/save
 * - POST /doctor/panel/:doctorId/consultation/:appointmentId/complete
 * - POST /doctor/panel/:doctorId/appointment/:appointmentId/prescription
 * - POST /doctor/panel/:doctorId/appointment/:appointmentId/report
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { RoleGuard } from "@/components/RoleGuard";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { getUserImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as doctorPortalService from "@/services/doctor-portal";
import type {
  ClinicalNotes,
  ClinicalVitals,
  DoctorConsultationContextResponse,
  PrescriptionInstructions,
  StructuredMedicineItem,
} from "@/types";

type WorkspaceTab = "notes" | "vitals" | "prescription" | "reports" | "followup" | "chart";

const QUICK_FREQUENCIES = ["1-0-1", "1-0-0", "0-0-1", "1-1-1", "SOS", "Once daily", "Twice daily"];
const QUICK_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"];
const QUICK_TIMINGS = ["After food", "Before food", "With food", "Bedtime", "Empty stomach"];
const QUICK_TIMEFRAMES = ["3 Days", "1 Week", "2 Weeks", "1 Month", "3 Months"];

const COMMON_MEDICINE_SUGGESTIONS = [
  "Paracetamol 650mg",
  "Amoxicillin 500mg",
  "Azithromycin 500mg",
  "Pantoprazole 40mg",
  "Montelukast 10mg",
  "Cetirizine 10mg",
  "Metformin 500mg",
  "Telmisartan 40mg",
  "Atorvastatin 10mg",
  "Ibuprofen 400mg",
  "ORS Sachet",
  "Multivitamin Syrup",
];

function calculateBMI(weightKg?: number, heightCm?: number): { bmi?: number; category?: string; color: string } {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return { color: Palette.textMuted };
  }
  const heightM = heightCm / 100;
  const bmiVal = Number((weightKg / (heightM * heightM)).toFixed(1));
  if (bmiVal < 18.5) return { bmi: bmiVal, category: "Underweight", color: Palette.warning };
  if (bmiVal <= 24.9) return { bmi: bmiVal, category: "Normal Weight", color: Palette.success };
  if (bmiVal <= 29.9) return { bmi: bmiVal, category: "Overweight", color: Palette.warning };
  return { bmi: bmiVal, category: "Obese", color: Palette.error };
}

export default function DoctorClinicalWorkspaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const doctorId = user?._id || "";
  const appointmentId = Array.isArray(id) ? id[0] : id || "";

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [context, setContext] = useState<DoctorConsultationContextResponse | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("notes");

  // Operational states
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Clinical Notes
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState("");
  const [examination, setExamination] = useState("");
  const [clinicalFindings, setClinicalFindings] = useState("");
  const [assessment, setAssessment] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // Vitals
  const [bloodPressure, setBloodPressure] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [spO2, setSpO2] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  // Prescription
  const [medicines, setMedicines] = useState<StructuredMedicineItem[]>([]);
  const [dietInstructions, setDietInstructions] = useState("");
  const [generalInstructions, setGeneralInstructions] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [labTestsAdvised, setLabTestsAdvised] = useState("");

  // Medicine modal state
  const [showMedModal, setShowMedModal] = useState(false);
  const [medEditingIndex, setMedEditingIndex] = useState<number | null>(null);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("1-0-1");
  const [medDuration, setMedDuration] = useState("5 days");
  const [medRoute, setMedRoute] = useState("Oral");
  const [medTiming, setMedTiming] = useState("After food");
  const [medInstructions, setMedInstructions] = useState("");

  // Follow-Up & Care
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpTimeframe, setFollowUpTimeframe] = useState("1 Week");
  const [followUpAdvice, setFollowUpAdvice] = useState("");

  // Patient Clinical Profile
  const [allergiesInput, setAllergiesInput] = useState("");
  const [chronicConditionsInput, setChronicConditionsInput] = useState("");
  const [bloodGroupInput, setBloodGroupInput] = useState("");

  // Modals
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showAddReportModal, setShowAddReportModal] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportCategory, setReportCategory] = useState("Prescription / Lab Order");
  const [reportNotes, setReportNotes] = useState("");

  // Consultation elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isCompleted = useMemo(() => {
    const status = context?.appointment?.status;
    const cStatus = context?.appointment?.consultationStatus;
    return status === "completed" || cStatus === "completed";
  }, [context?.appointment?.status, context?.appointment?.consultationStatus]);

  const isInProgress = useMemo(() => {
    return context?.appointment?.consultationStatus === "in_progress" && !isCompleted;
  }, [context?.appointment?.consultationStatus, isCompleted]);

  // Load context from backend
  const loadWorkspace = useCallback(async () => {
    if (!doctorId || !appointmentId) {
      setError("Missing doctor credentials or appointment ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await doctorPortalService.getDoctorConsultationContext(doctorId, appointmentId);
      if (res?.success && res.appointment) {
        setContext(res);
        const appt = res.appointment;
        const patient = res.patient;

        // Initialize Clinical Notes
        const cn = appt.clinicalNotes || {};
        setChiefComplaint(cn.chiefComplaint || "");
        setSymptoms(cn.symptoms || "");
        setHistoryOfPresentIllness(cn.historyOfPresentIllness || "");
        setExamination(cn.examination || "");
        setClinicalFindings(cn.clinicalFindings || "");
        setAssessment(cn.assessment || "");
        setTreatmentPlan(cn.treatmentPlan || "");
        setAdditionalNotes(cn.additionalNotes || "");
        setDiagnosis(appt.diagnosis || "");

        // Initialize Vitals
        const v = appt.vitals || {};
        setBloodPressure(v.bloodPressure || "");
        setHeartRate(v.heartRate ? String(v.heartRate) : "");
        setTemperature(v.temperature ? String(v.temperature) : "");
        setRespiratoryRate(v.respiratoryRate ? String(v.respiratoryRate) : "");
        setSpO2(v.spO2 ? String(v.spO2) : "");
        setWeight(v.weight ? String(v.weight) : "");
        setHeight(v.height ? String(v.height) : "");

        // Initialize Prescription
        setMedicines(appt.medicines || []);
        const pi = (appt as unknown as { prescriptionInstructions?: PrescriptionInstructions }).prescriptionInstructions || {};
        setDietInstructions(pi.dietInstructions || "");
        setGeneralInstructions(pi.generalInstructions || "");
        setFollowUpInstructions(pi.followUpInstructions || "");
        setLabTestsAdvised(pi.labTestsAdvised || "");

        // Initialize Follow-up
        if (appt.followUpAdvice) {
          setFollowUpAdvice(appt.followUpAdvice);
          setFollowUpRequired(true);
        }
        if (appt.followUp) {
          setFollowUpRequired(Boolean(appt.followUp.required));
          if (appt.followUp.timeframe) setFollowUpTimeframe(appt.followUp.timeframe);
        }

        // Initialize Patient Profile
        if (patient) {
          setAllergiesInput(Array.isArray(patient.allergies) ? patient.allergies.join(", ") : "");
          setChronicConditionsInput(Array.isArray(patient.chronicConditions) ? patient.chronicConditions.join(", ") : "");
          setBloodGroupInput(patient.bloodGroup || "");
        }

        // Set initial timer if consultation already in progress
        const startedAt = (appt as unknown as { consultationStartedAt?: string }).consultationStartedAt;
        if (startedAt) {
          const startMs = new Date(startedAt).getTime();
          const nowMs = Date.now();
          if (nowMs > startMs) {
            setElapsedSeconds(Math.floor((nowMs - startMs) / 1000));
          }
        }
      } else {
        setError("Unable to load consultation details.");
      }
    } catch (err) {
      setError(toErrorMessage(err, "Failed to load clinical workspace."));
    } finally {
      setLoading(false);
    }
  }, [doctorId, appointmentId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Live timer interval
  useEffect(() => {
    if (!isInProgress) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isInProgress]);

  // Formatted timer text
  const timerText = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [elapsedSeconds]);

  // BMI calculation
  const parsedWeight = parseFloat(weight);
  const parsedHeight = parseFloat(height);
  const bmiInfo = useMemo(() => calculateBMI(parsedWeight, parsedHeight), [parsedWeight, parsedHeight]);

  // Start Consultation action
  const handleStartConsultation = async () => {
    try {
      setIsStarting(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await doctorPortalService.startDoctorConsultation(doctorId, appointmentId);
      if (res?.success) {
        setContext((prev) => (prev ? { ...prev, appointment: res.appointment } : prev));
        setElapsedSeconds(0);
        Alert.alert("Consultation Started", "The clinical session is now active and tracked in live queue.");
      }
    } catch (err) {
      Alert.alert("Action Failed", toErrorMessage(err, "Could not start consultation."));
    } finally {
      setIsStarting(false);
    }
  };

  // Build Payload
  const buildPayload = useCallback(() => {
    const vitalsPayload: ClinicalVitals = {};
    if (bloodPressure.trim()) vitalsPayload.bloodPressure = bloodPressure.trim();
    if (heartRate.trim()) vitalsPayload.heartRate = Number(heartRate);
    if (temperature.trim()) vitalsPayload.temperature = Number(temperature);
    if (respiratoryRate.trim()) vitalsPayload.respiratoryRate = Number(respiratoryRate);
    if (spO2.trim()) vitalsPayload.spO2 = Number(spO2);
    if (weight.trim()) vitalsPayload.weight = Number(weight);
    if (height.trim()) vitalsPayload.height = Number(height);

    const notesPayload: ClinicalNotes = {
      chiefComplaint: chiefComplaint.trim(),
      symptoms: symptoms.trim(),
      historyOfPresentIllness: historyOfPresentIllness.trim(),
      examination: examination.trim(),
      clinicalFindings: clinicalFindings.trim(),
      assessment: assessment.trim() || diagnosis.trim(),
      treatmentPlan: treatmentPlan.trim(),
      additionalNotes: additionalNotes.trim(),
    };

    const instructionsPayload: PrescriptionInstructions = {
      dietInstructions: dietInstructions.trim(),
      generalInstructions: generalInstructions.trim(),
      followUpInstructions: followUpInstructions.trim(),
      labTestsAdvised: labTestsAdvised.trim(),
    };

    const allergiesArray = allergiesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const chronicConditionsArray = chronicConditionsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      vitals: Object.keys(vitalsPayload).length ? vitalsPayload : undefined,
      clinicalNotes: notesPayload,
      diagnosis: diagnosis.trim() || assessment.trim(),
      medicines: medicines.length ? medicines : undefined,
      prescriptionInstructions: instructionsPayload,
      followUpAdvice: followUpAdvice.trim() || (followUpRequired ? `Follow up in ${followUpTimeframe}` : undefined),
      allergies: allergiesArray.length ? allergiesArray : undefined,
      chronicConditions: chronicConditionsArray.length ? chronicConditionsArray : undefined,
      bloodGroup: bloodGroupInput.trim() || undefined,
    };
  }, [
    bloodPressure,
    heartRate,
    temperature,
    respiratoryRate,
    spO2,
    weight,
    height,
    chiefComplaint,
    symptoms,
    historyOfPresentIllness,
    examination,
    clinicalFindings,
    assessment,
    diagnosis,
    treatmentPlan,
    additionalNotes,
    medicines,
    dietInstructions,
    generalInstructions,
    followUpInstructions,
    labTestsAdvised,
    followUpAdvice,
    followUpRequired,
    followUpTimeframe,
    allergiesInput,
    chronicConditionsInput,
    bloodGroupInput,
  ]);

  // Save Draft action
  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const payload = buildPayload();
      const res = await doctorPortalService.saveDoctorConsultation(doctorId, appointmentId, payload);
      if (res?.success) {
        setContext((prev) => (prev ? { ...prev, appointment: res.appointment } : prev));
        setIsDirty(false);
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
        );
      }
    } catch (err) {
      Alert.alert("Save Failed", toErrorMessage(err, "Could not save consultation draft."));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Finalize Consultation action
  const handleConfirmFinalize = async () => {
    if (!diagnosis.trim() && !assessment.trim() && !chiefComplaint.trim()) {
      Alert.alert(
        "Clinical Requirement",
        "Please provide at least a Diagnosis or Chief Complaint / Assessment before finalizing the consultation.",
      );
      return;
    }

    try {
      setIsFinalizing(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const payload = buildPayload();
      const res = await doctorPortalService.completeDoctorConsultation(doctorId, appointmentId, payload);
      if (res?.success) {
        setShowFinalizeModal(false);
        setContext((prev) => (prev ? { ...prev, appointment: res.appointment } : prev));
        Alert.alert(
          "Consultation Finalized",
          "Clinical notes, prescription, and patient care timeline have been locked and synced to the patient portal.",
          [
            {
              text: "Review Record",
              onPress: () => loadWorkspace(),
            },
            {
              text: "Back to Clinic Queue",
              onPress: () => router.replace("/(doctor)"),
            },
          ],
        );
      }
    } catch (err) {
      Alert.alert("Finalization Error", toErrorMessage(err, "Could not finalize consultation."));
    } finally {
      setIsFinalizing(false);
    }
  };

  // Add / Edit Medicine
  const handleSaveMedicine = () => {
    if (!medName.trim()) {
      Alert.alert("Validation", "Please enter a medicine name.");
      return;
    }

    const item: StructuredMedicineItem = {
      name: medName.trim(),
      dosage: medDosage.trim(),
      frequency: medFrequency.trim(),
      duration: medDuration.trim(),
      route: medRoute.trim(),
      timing: medTiming.trim(),
      instructions: medInstructions.trim(),
    };

    if (medEditingIndex !== null && medEditingIndex >= 0) {
      setMedicines((prev) => {
        const copy = [...prev];
        copy[medEditingIndex] = item;
        return copy;
      });
    } else {
      setMedicines((prev) => [...prev, item]);
    }

    setIsDirty(true);
    setShowMedModal(false);
    setMedEditingIndex(null);
    setMedName("");
    setMedDosage("");
    setMedInstructions("");
  };

  const handleOpenAddMedicine = () => {
    setMedEditingIndex(null);
    setMedName("");
    setMedDosage("");
    setMedFrequency("1-0-1");
    setMedDuration("5 days");
    setMedRoute("Oral");
    setMedTiming("After food");
    setMedInstructions("");
    setShowMedModal(true);
  };

  const handleOpenEditMedicine = (index: number) => {
    const med = medicines[index];
    if (!med) return;
    setMedEditingIndex(index);
    setMedName(med.name || "");
    setMedDosage(med.dosage || "");
    setMedFrequency(med.frequency || "1-0-1");
    setMedDuration(med.duration || "5 days");
    setMedRoute(med.route || "Oral");
    setMedTiming(med.timing || "After food");
    setMedInstructions(med.instructions || "");
    setShowMedModal(true);
  };

  const handleDeleteMedicine = (index: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Upload Lab Report / Diagnostic Order
  const handleUploadReport = async () => {
    if (!reportTitle.trim()) {
      Alert.alert("Validation", "Please enter a report name or test title.");
      return;
    }

    try {
      setUploadingReport(true);
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets || !pickerResult.assets[0]) {
        setUploadingReport(false);
        return;
      }

      const asset = pickerResult.assets[0];
      const formData = new FormData();
      formData.append("name", reportTitle.trim());
      formData.append("category", reportCategory);
      formData.append("notes", reportNotes.trim());
      const fileData: unknown = {
        uri: asset.uri,
        name: asset.fileName || "clinical-report.jpg",
        type: asset.mimeType || "image/jpeg",
      };
      formData.append("file", fileData as Blob);

      const res = await doctorPortalService.uploadDoctorReport(doctorId, appointmentId, formData);
      if (res?.success) {
        setContext((prev) => (prev ? { ...prev, appointment: res.appointment } : prev));
        setShowAddReportModal(false);
        setReportTitle("");
        setReportNotes("");
        Alert.alert("Success", "Diagnostic report uploaded to patient medical chart.");
      }
    } catch (err) {
      Alert.alert("Upload Failed", toErrorMessage(err, "Could not upload document."));
    } finally {
      setUploadingReport(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
        <Loading label="Opening Clinical Workspace..." />
      </SafeAreaView>
    );
  }

  if (error || !context) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerBarTitle}>Clinical Workspace</Text>
        </View>
        <ErrorState message={error || "Appointment not found."} onRetry={loadWorkspace} />
      </SafeAreaView>
    );
  }

  const { appointment, patient, previousVitals, previousDiagnoses, previousConsultationSummary } = context;

  const patientName = appointment.patientName || patient?.name || "Patient";
  const patientImage = getUserImage(patient?.image);
  const slotDate = appointment.slotDate || appointment.date || "Today";
  const slotTime = appointment.slotTime || appointment.time || "OPD Slot";
  const consultationType = appointment.consultationType || "clinic";

  const getBmiBadgeVariant = (cat?: string): BadgeVariant => {
    if (cat === "Normal Weight") return "success";
    if (cat === "Underweight" || cat === "Overweight") return "warning";
    if (cat === "Obese") return "error";
    return "neutral";
  };

  return (
    <RoleGuard allowedRoles={["doctor"]}>
      <SafeAreaView style={styles.safeContainer} edges={["top", "bottom"]}>
        {/* Top Operational Header */}
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerBarTitle} numberOfLines={1}>
                {patientName}
              </Text>
              {appointment.isFamilyBooking && (
                <Badge label={appointment.familyRelationship || "Family"} variant="primary" />
              )}
            </View>
            <Text style={styles.headerBarSub}>
              {slotDate} · {slotTime} · {consultationType === "video" ? "📹 Google Meet" : "🏥 In-Clinic OPD"}
            </Text>
          </View>

          {/* Status Badge */}
          {isCompleted ? (
            <Badge label="FINALIZED" variant="success" />
          ) : isInProgress ? (
            <View style={styles.liveTimerBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveTimerText}>{timerText}</Text>
            </View>
          ) : (
            <Badge label="READY" variant="primary" />
          )}
        </View>

        {/* Doctor Operational Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.autoSaveStatus}>
            {isDirty ? (
              <View style={styles.dirtyDotRow}>
                <View style={styles.dirtyDot} />
                <Text style={styles.dirtyText}>Unsaved changes</Text>
              </View>
            ) : lastSavedTime ? (
              <Text style={styles.lastSavedText}>Draft saved at {lastSavedTime}</Text>
            ) : (
              <Text style={styles.lastSavedText}>Cloud Synced</Text>
            )}
          </View>

          <View style={styles.actionButtonsRow}>
            {!isCompleted && !isInProgress && (
              <Pressable
                onPress={handleStartConsultation}
                disabled={isStarting}
                style={[styles.smallActionBtn, styles.startBtn]}
              >
                {isStarting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={styles.smallActionBtnTextWhite}>Start</Text>
                  </>
                )}
              </Pressable>
            )}

            {!isCompleted && (
              <Pressable
                onPress={handleSaveDraft}
                disabled={isSavingDraft}
                style={[styles.smallActionBtn, styles.draftBtn]}
              >
                {isSavingDraft ? (
                  <ActivityIndicator size="small" color={Palette.accent} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={14} color={Palette.accent} />
                    <Text style={styles.smallActionBtnTextAccent}>Save Draft</Text>
                  </>
                )}
              </Pressable>
            )}

            {!isCompleted ? (
              <Pressable
                onPress={() => setShowFinalizeModal(true)}
                style={[styles.smallActionBtn, styles.finalizeBtn]}
              >
                <Ionicons name="checkmark-done" size={15} color="#fff" />
                <Text style={styles.smallActionBtnTextWhite}>Finalize</Text>
              </Pressable>
            ) : (
              <View style={styles.auditStampBadge}>
                <Ionicons name="lock-closed" size={12} color={Palette.textMuted} />
                <Text style={styles.auditStampText}>Record Locked (Audit View)</Text>
              </View>
            )}
          </View>
        </View>

        {/* Clinical Workspace Tab Bar */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            <Pressable
              onPress={() => setActiveTab("notes")}
              style={[styles.tabButton, activeTab === "notes" && styles.tabButtonActive]}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={activeTab === "notes" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "notes" && styles.tabTextActive]}>Notes</Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("vitals")}
              style={[styles.tabButton, activeTab === "vitals" && styles.tabButtonActive]}
            >
              <Ionicons
                name="heart-outline"
                size={16}
                color={activeTab === "vitals" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "vitals" && styles.tabTextActive]}>Vitals</Text>
              {bmiInfo.bmi ? <View style={[styles.tabIndicatorDot, { backgroundColor: bmiInfo.color }]} /> : null}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("prescription")}
              style={[styles.tabButton, activeTab === "prescription" && styles.tabButtonActive]}
            >
              <Ionicons
                name="medkit-outline"
                size={16}
                color={activeTab === "prescription" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "prescription" && styles.tabTextActive]}>Rx</Text>
              {medicines.length > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>{medicines.length}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("reports")}
              style={[styles.tabButton, activeTab === "reports" && styles.tabButtonActive]}
            >
              <Ionicons
                name="folder-open-outline"
                size={16}
                color={activeTab === "reports" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "reports" && styles.tabTextActive]}>Reports</Text>
              {(appointment.medicalReports?.length || 0) > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>{appointment.medicalReports?.length}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("followup")}
              style={[styles.tabButton, activeTab === "followup" && styles.tabButtonActive]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={activeTab === "followup" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "followup" && styles.tabTextActive]}>Follow-Up</Text>
              {followUpRequired && <View style={[styles.tabIndicatorDot, { backgroundColor: Palette.primary }]} />}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("chart")}
              style={[styles.tabButton, activeTab === "chart" && styles.tabButtonActive]}
            >
              <Ionicons
                name="person-circle-outline"
                size={16}
                color={activeTab === "chart" ? Palette.accent : Palette.textMuted}
              />
              <Text style={[styles.tabText, activeTab === "chart" && styles.tabTextActive]}>EMR Chart</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Active Tab Content */}
        <ScrollView
          style={styles.workspaceBody}
          contentContainerStyle={styles.workspaceBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: CLINICAL NOTES */}
          {activeTab === "notes" && (
            <View style={styles.sectionContainer}>
              {/* Working Diagnosis Card */}
              <Card style={styles.clinicalCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="medical" size={18} color={Palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Working Diagnosis / Assessment</Text>
                    <Text style={styles.cardSub}>Required to finalize consultation</Text>
                  </View>
                </View>
                <TextInput
                  value={diagnosis}
                  onChangeText={(val) => {
                    setDiagnosis(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. Acute Upper Respiratory Tract Infection, Migraine..."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />
              </Card>

              {/* Chief Complaint */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Chief Complaint</Text>
                <TextInput
                  value={chiefComplaint}
                  onChangeText={(val) => {
                    setChiefComplaint(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="Patient's primary presenting concern and duration..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              {/* Symptoms & HPI */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>History of Present Illness (HPI) & Symptoms</Text>
                <TextInput
                  value={symptoms}
                  onChangeText={(val) => {
                    setSymptoms(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="Onset, progression, severity, aggravating/relieving factors..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              {/* Physical Examination */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Physical Examination & Systemic Findings</Text>
                <TextInput
                  value={examination}
                  onChangeText={(val) => {
                    setExamination(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="General physical exam, chest, CVS, abdomen, CNS..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              {/* Treatment Plan */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Treatment Plan & Clinical Actions</Text>
                <TextInput
                  value={treatmentPlan}
                  onChangeText={(val) => {
                    setTreatmentPlan(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="Therapeutic goals, lifestyle advice, scheduled procedures..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              {/* Additional Doctor Notes */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Private Clinical Notes (Internal Records)</Text>
                <TextInput
                  value={additionalNotes}
                  onChangeText={(val) => {
                    setAdditionalNotes(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="Internal doctor notes, differential diagnosis remarks..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>
            </View>
          )}

          {/* TAB 2: VITALS & MEASUREMENTS */}
          {activeTab === "vitals" && (
            <View style={styles.sectionContainer}>
              {/* BMI Live Banner */}
              <Card style={styles.bmiBannerCard}>
                <View style={styles.bmiRow}>
                  <View style={styles.bmiStat}>
                    <Text style={styles.bmiNumber}>{bmiInfo.bmi ? bmiInfo.bmi : "--"}</Text>
                    <Text style={styles.bmiLabel}>Calculated BMI</Text>
                  </View>
                  <View style={styles.bmiCategoryContainer}>
                    <Badge
                      label={bmiInfo.category || "Enter Weight & Height"}
                      variant={getBmiBadgeVariant(bmiInfo.category)}
                    />
                    <Text style={styles.bmiHelp}>
                      {parsedWeight && parsedHeight
                        ? `${parsedWeight} kg / ${parsedHeight} cm`
                        : "Weight (kg) and Height (cm) automatically calculate patient BMI"}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Grid of Vitals Inputs */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.cardTitle}>Vitals & Physiological Metrics</Text>
                <Text style={styles.cardSub}>Recorded during clinical examination</Text>

                <View style={styles.vitalsGrid}>
                  {/* BP */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Blood Pressure</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={bloodPressure}
                        onChangeText={(val) => {
                          setBloodPressure(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="120/80"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>mmHg</Text>
                    </View>
                  </View>

                  {/* Heart Rate */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Heart Rate</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={heartRate}
                        onChangeText={(val) => {
                          setHeartRate(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="72"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>bpm</Text>
                    </View>
                  </View>

                  {/* Temp */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Temperature</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={temperature}
                        onChangeText={(val) => {
                          setTemperature(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="98.6"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>°F</Text>
                    </View>
                  </View>

                  {/* SpO2 */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Oxygen (SpO2)</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={spO2}
                        onChangeText={(val) => {
                          setSpO2(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="98"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>%</Text>
                    </View>
                  </View>

                  {/* Respiratory Rate */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Resp. Rate</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={respiratoryRate}
                        onChangeText={(val) => {
                          setRespiratoryRate(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="16"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>/min</Text>
                    </View>
                  </View>

                  {/* Weight */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Weight</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={weight}
                        onChangeText={(val) => {
                          setWeight(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="70"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>kg</Text>
                    </View>
                  </View>

                  {/* Height */}
                  <View style={styles.vitalField}>
                    <Text style={styles.vitalFieldLabel}>Height</Text>
                    <View style={styles.vitalInputRow}>
                      <TextInput
                        value={height}
                        onChangeText={(val) => {
                          setHeight(val);
                          setIsDirty(true);
                        }}
                        editable={!isCompleted}
                        placeholder="175"
                        keyboardType="numeric"
                        placeholderTextColor={Palette.textMuted}
                        style={styles.vitalInput}
                      />
                      <Text style={styles.vitalUnit}>cm</Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/* Historical Vitals Trend */}
              {previousVitals && previousVitals.length > 0 && (
                <Card style={styles.clinicalCard}>
                  <Text style={styles.cardTitle}>Historical Vitals Record</Text>
                  <Text style={styles.cardSub}>Recorded from previous consultations with you</Text>

                  {previousVitals.map((entry, idx) => (
                    <View key={entry.appointmentId || idx} style={styles.historyVitalRow}>
                      <View style={styles.historyVitalDate}>
                        <Text style={styles.historyVitalDateText}>{entry.date || "Past Visit"}</Text>
                        <Text style={styles.historyVitalTimeText}>{entry.time || ""}</Text>
                      </View>
                      <View style={styles.historyVitalBadges}>
                        {entry.vitals.bloodPressure && (
                          <Badge label={`BP: ${entry.vitals.bloodPressure}`} variant="neutral" />
                        )}
                        {entry.vitals.heartRate && (
                          <Badge label={`HR: ${entry.vitals.heartRate}`} variant="neutral" />
                        )}
                        {entry.vitals.spO2 && (
                          <Badge label={`SpO2: ${entry.vitals.spO2}%`} variant="neutral" />
                        )}
                        {entry.vitals.bmi && (
                          <Badge label={`BMI: ${entry.vitals.bmi}`} variant="primary" />
                        )}
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </View>
          )}

          {/* TAB 3: PRESCRIPTION BUILDER */}
          {activeTab === "prescription" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeading}>Digital Prescription</Text>
                  <Text style={styles.sectionSub}>Structured medicines & patient instructions</Text>
                </View>
                {!isCompleted && (
                  <Button
                    title="+ Add Medicine"
                    variant="primary"
                    onPress={handleOpenAddMedicine}
                  />
                )}
              </View>

              {/* Medicines List */}
              {medicines.length === 0 ? (
                <Card style={styles.emptyPrescriptionCard}>
                  <Ionicons name="medkit-outline" size={32} color={Palette.accent} />
                  <Text style={styles.emptyPrescriptionTitle}>No Medicines Prescribed Yet</Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    Tap "+ Add Medicine" to prescribe structured medications with dosage, frequency, and instructions.
                  </Text>
                  {!isCompleted && (
                    <Button
                      title="Add First Medicine"
                      onPress={handleOpenAddMedicine}
                      style={{ marginTop: Spacing.md }}
                    />
                  )}
                </Card>
              ) : (
                medicines.map((med, index) => (
                  <Card key={index} style={styles.medicineItemCard}>
                    <View style={styles.medHeaderRow}>
                      <View style={styles.medNumberBadge}>
                        <Text style={styles.medNumberText}>{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medNameText}>{med.name}</Text>
                        <Text style={styles.medDosageText}>
                          {med.dosage || "Standard Dose"} · {med.route || "Oral"}
                        </Text>
                      </View>
                      {!isCompleted && (
                        <View style={styles.medActionsRow}>
                          <Pressable
                            onPress={() => handleOpenEditMedicine(index)}
                            style={styles.medIconBtn}
                          >
                            <Ionicons name="pencil" size={16} color={Palette.accent} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteMedicine(index)}
                            style={styles.medIconBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color={Palette.error} />
                          </Pressable>
                        </View>
                      )}
                    </View>

                    <View style={styles.medPillsRow}>
                      <Badge label={med.frequency || "1-0-1"} variant="primary" />
                      <Badge label={med.duration || "5 days"} variant="neutral" />
                      <Badge label={med.timing || "After food"} variant="neutral" />
                    </View>

                    {med.instructions ? (
                      <Text style={styles.medInstructionsText}>💡 {med.instructions}</Text>
                    ) : null}
                  </Card>
                ))
              )}

              {/* Instructions Cards */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Diet & Nutritional Instructions</Text>
                <TextInput
                  value={dietInstructions}
                  onChangeText={(val) => {
                    setDietInstructions(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. Low sodium, high fiber, plenty of fluids, avoid spicy food..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>Lab / Diagnostic Tests Advised</Text>
                <TextInput
                  value={labTestsAdvised}
                  onChangeText={(val) => {
                    setLabTestsAdvised(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. Complete Blood Count (CBC), Serum Creatinine, Fasting Blood Sugar..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>

              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>General Patient Advice</Text>
                <TextInput
                  value={generalInstructions}
                  onChangeText={(val) => {
                    setGeneralInstructions(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="Rest instructions, precautions, when to seek immediate emergency care..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={styles.multiLineInput}
                />
              </Card>
            </View>
          )}

          {/* TAB 4: REPORTS & LAB DOCUMENTS */}
          {activeTab === "reports" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeading}>Patient Reports & Orders</Text>
                  <Text style={styles.sectionSub}>Diagnostic investigations & attached records</Text>
                </View>
                {!isCompleted && (
                  <Button
                    title="+ Attach Report"
                    variant="primary"
                    onPress={() => setShowAddReportModal(true)}
                  />
                )}
              </View>

              {!appointment.medicalReports || appointment.medicalReports.length === 0 ? (
                <Card style={styles.emptyPrescriptionCard}>
                  <Ionicons name="folder-open-outline" size={32} color={Palette.textMuted} />
                  <Text style={styles.emptyPrescriptionTitle}>No Reports Attached for this Visit</Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    You can upload lab test orders or investigation reports directly to the patient's medical file.
                  </Text>
                  {!isCompleted && (
                    <Button
                      title="Upload Lab / Medical Report"
                      onPress={() => setShowAddReportModal(true)}
                      style={{ marginTop: Spacing.md }}
                    />
                  )}
                </Card>
              ) : (
                appointment.medicalReports.map((report, idx) => (
                  <Card key={report._id || idx} style={styles.reportCard}>
                    <View style={styles.reportRow}>
                      <View style={styles.reportIconBox}>
                        <Ionicons name="document-attach" size={20} color={Palette.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportName}>{report.name}</Text>
                        <Text style={styles.reportMeta}>
                          {report.category || report.type || "Medical Report"} ·{" "}
                          {report.uploadedAt ? new Date(report.uploadedAt).toLocaleDateString() : "Uploaded"}
                        </Text>
                        {report.notes ? <Text style={styles.reportNotesText}>Note: {report.notes}</Text> : null}
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* TAB 5: FOLLOW-UP & CARE PLAN */}
          {activeTab === "followup" && (
            <View style={styles.sectionContainer}>
              <Card style={styles.clinicalCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="calendar" size={18} color={Palette.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Follow-Up Visit Recommendation</Text>
                    <Text style={styles.cardSub}>Guides patient on return consultation timeframe</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (isCompleted) return;
                      setFollowUpRequired(!followUpRequired);
                      setIsDirty(true);
                    }}
                    style={[styles.toggleBtn, followUpRequired && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleText, followUpRequired && styles.toggleTextActive]}>
                      {followUpRequired ? "Required" : "Optional"}
                    </Text>
                  </Pressable>
                </View>

                {followUpRequired && (
                  <View style={styles.followUpConfig}>
                    <Text style={styles.inputLabel}>Recommended Return Interval</Text>
                    <View style={styles.timeframePillsRow}>
                      {QUICK_TIMEFRAMES.map((tf) => (
                        <Pressable
                          key={tf}
                          onPress={() => {
                            if (isCompleted) return;
                            setFollowUpTimeframe(tf);
                            setIsDirty(true);
                          }}
                          style={[
                            styles.timeframePill,
                            followUpTimeframe === tf && styles.timeframePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timeframePillText,
                              followUpTimeframe === tf && styles.timeframePillTextActive,
                            ]}
                          >
                            {tf}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                      Follow-Up & Care Advice
                    </Text>
                    <TextInput
                      value={followUpAdvice}
                      onChangeText={(val) => {
                        setFollowUpAdvice(val);
                        setIsDirty(true);
                      }}
                      editable={!isCompleted}
                      placeholder="e.g. Return with complete CBC reports in 1 week. Check blood pressure daily."
                      placeholderTextColor={Palette.textMuted}
                      multiline
                      style={styles.multiLineInput}
                    />
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* TAB 6: PATIENT CHART & EMR (360° VIEW) */}
          {activeTab === "chart" && (
            <View style={styles.sectionContainer}>
              {/* Patient Demographics Card */}
              <Card style={styles.clinicalCard}>
                <View style={styles.patientProfileRow}>
                  <Image source={{ uri: patientImage }} style={styles.patientAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientFullName}>{patientName}</Text>
                    <Text style={styles.patientMeta}>
                      {patient?.gender ? `${patient.gender} · ` : ""}
                      {patient?.dob ? `DOB: ${patient.dob}` : ""}
                    </Text>
                    <Text style={styles.patientPhoneText}>{patient?.phone || "No phone on file"}</Text>
                  </View>
                </View>

                {/* Editable Clinical Profile (Allergies, Chronic Conditions, Blood Group) */}
                <View style={styles.profileDivider} />

                <Text style={styles.inputLabel}>Blood Group</Text>
                <TextInput
                  value={bloodGroupInput}
                  onChangeText={(val) => {
                    setBloodGroupInput(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. O+, A+, B+, AB-"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Allergies (comma separated)
                </Text>
                <TextInput
                  value={allergiesInput}
                  onChangeText={(val) => {
                    setAllergiesInput(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Chronic Conditions (comma separated)
                </Text>
                <TextInput
                  value={chronicConditionsInput}
                  onChangeText={(val) => {
                    setChronicConditionsInput(val);
                    setIsDirty(true);
                  }}
                  editable={!isCompleted}
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />
              </Card>

              {/* Past Diagnoses Card */}
              {previousDiagnoses && previousDiagnoses.length > 0 && (
                <Card style={styles.clinicalCard}>
                  <Text style={styles.cardTitle}>Past Diagnoses Recorded</Text>
                  <Text style={styles.cardSub}>From prior consultations with you</Text>
                  <View style={styles.tagWrapRow}>
                    {previousDiagnoses.map((diag, i) => (
                      <Badge key={i} label={diag} variant="primary" />
                    ))}
                  </View>
                </Card>
              )}

              {/* Last Completed Consultation Snapshot */}
              {previousConsultationSummary && (
                <Card style={styles.clinicalCard}>
                  <Text style={styles.cardTitle}>Previous Visit Summary</Text>
                  <Text style={styles.cardSub}>Date: {previousConsultationSummary.date || "Recent"}</Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Diagnosis:</Text>
                    <Text style={styles.summaryItemVal}>
                      {previousConsultationSummary.diagnosis || "General Consultation"}
                    </Text>
                  </View>
                  {previousConsultationSummary.notes ? (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemLabel}>Clinical Notes:</Text>
                      <Text style={styles.summaryItemVal}>{previousConsultationSummary.notes}</Text>
                    </View>
                  ) : null}
                  {previousConsultationSummary.prescription ? (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemLabel}>Prescription:</Text>
                      <Text style={styles.summaryItemVal}>
                        {previousConsultationSummary.prescription}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              )}
            </View>
          )}
        </ScrollView>

        {/* MODAL: ADD / EDIT MEDICINE */}
        <Modal
          visible={showMedModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMedModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {medEditingIndex !== null ? "Edit Medication" : "Add Medication"}
                </Text>
                <Pressable onPress={() => setShowMedModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <Text style={styles.inputLabel}>Medicine Name *</Text>
                <TextInput
                  value={medName}
                  onChangeText={setMedName}
                  placeholder="e.g. Paracetamol 650mg"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                {/* Quick medicine suggestion chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickChipScroll}>
                  {COMMON_MEDICINE_SUGGESTIONS.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setMedName(item)}
                      style={styles.quickChip}
                    >
                      <Text style={styles.quickChipText}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.modalTwoCol}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={styles.inputLabel}>Dosage</Text>
                    <TextInput
                      value={medDosage}
                      onChangeText={setMedDosage}
                      placeholder="e.g. 1 Tablet"
                      placeholderTextColor={Palette.textMuted}
                      style={styles.singleLineInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Route</Text>
                    <TextInput
                      value={medRoute}
                      onChangeText={setMedRoute}
                      placeholder="e.g. Oral"
                      placeholderTextColor={Palette.textMuted}
                      style={styles.singleLineInput}
                    />
                  </View>
                </View>

                {/* Frequency Quick Buttons */}
                <Text style={styles.inputLabel}>Frequency</Text>
                <View style={styles.quickSelectRow}>
                  {QUICK_FREQUENCIES.map((freq) => (
                    <Pressable
                      key={freq}
                      onPress={() => setMedFrequency(freq)}
                      style={[styles.quickSelectPill, medFrequency === freq && styles.quickSelectPillActive]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          medFrequency === freq && styles.quickSelectPillTextActive,
                        ]}
                      >
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Duration Quick Buttons */}
                <Text style={styles.inputLabel}>Duration</Text>
                <View style={styles.quickSelectRow}>
                  {QUICK_DURATIONS.map((dur) => (
                    <Pressable
                      key={dur}
                      onPress={() => setMedDuration(dur)}
                      style={[styles.quickSelectPill, medDuration === dur && styles.quickSelectPillActive]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          medDuration === dur && styles.quickSelectPillTextActive,
                        ]}
                      >
                        {dur}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Timing Quick Buttons */}
                <Text style={styles.inputLabel}>Timing</Text>
                <View style={styles.quickSelectRow}>
                  {QUICK_TIMINGS.map((tm) => (
                    <Pressable
                      key={tm}
                      onPress={() => setMedTiming(tm)}
                      style={[styles.quickSelectPill, medTiming === tm && styles.quickSelectPillActive]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          medTiming === tm && styles.quickSelectPillTextActive,
                        ]}
                      >
                        {tm}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Special Instructions</Text>
                <TextInput
                  value={medInstructions}
                  onChangeText={setMedInstructions}
                  placeholder="e.g. Take with lukewarm water, avoid driving..."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowMedModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={medEditingIndex !== null ? "Save Changes" : "Add to Rx"}
                  variant="primary"
                  onPress={handleSaveMedicine}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: UPLOAD REPORT */}
        <Modal
          visible={showAddReportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddReportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Attach Diagnostic Report</Text>
                <Pressable onPress={() => setShowAddReportModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <View style={{ paddingVertical: Spacing.sm }}>
                <Text style={styles.inputLabel}>Report Name / Investigation *</Text>
                <TextInput
                  value={reportTitle}
                  onChangeText={setReportTitle}
                  placeholder="e.g. Ultrasound Abdomen / Blood Report"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>Category</Text>
                <TextInput
                  value={reportCategory}
                  onChangeText={setReportCategory}
                  placeholder="Prescription / Lab Order / Radiology"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>Notes / Remarks</Text>
                <TextInput
                  value={reportNotes}
                  onChangeText={setReportNotes}
                  placeholder="Optional observation notes..."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />
              </View>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowAddReportModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={uploadingReport ? "Uploading..." : "Select File & Upload"}
                  variant="primary"
                  loading={uploadingReport}
                  onPress={handleUploadReport}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: FINALIZE CONSULTATION */}
        <Modal
          visible={showFinalizeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFinalizeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.finalizeIconBox}>
                  <Ionicons name="checkmark-done-circle" size={28} color={Palette.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Finalize Consultation</Text>
                  <Text style={styles.modalSubtitle}>Review clinical summary before committing</Text>
                </View>
                <Pressable onPress={() => setShowFinalizeModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.finalizeSummaryScroll}>
                <View style={styles.finalizeSummaryCard}>
                  <Text style={styles.finalizeItemLabel}>Primary Diagnosis:</Text>
                  <Text style={styles.finalizeItemVal}>{diagnosis || assessment || "Not specified"}</Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>Prescribed Medicines:</Text>
                  <Text style={styles.finalizeItemVal}>
                    {medicines.length > 0 ? `${medicines.length} medicine(s) prescribed` : "None"}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>Follow-Up:</Text>
                  <Text style={styles.finalizeItemVal}>
                    {followUpRequired ? `Recommended in ${followUpTimeframe}` : "No follow-up required"}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>Vitals Recorded:</Text>
                  <Text style={styles.finalizeItemVal}>
                    {bloodPressure ? `BP: ${bloodPressure}` : ""}
                    {heartRate ? ` · HR: ${heartRate} bpm` : ""}
                    {bmiInfo.bmi ? ` · BMI: ${bmiInfo.bmi}` : ""}
                    {!bloodPressure && !heartRate && !bmiInfo.bmi ? "No vitals entered" : ""}
                  </Text>
                </View>

                <View style={styles.finalizeNoticeBox}>
                  <Ionicons name="information-circle-outline" size={18} color={Palette.warning} />
                  <Text style={styles.finalizeNoticeText}>
                    Finalizing locks this clinical consultation. The prescription, clinical notes, and follow-up advice
                    will immediately synchronize with the patient's Digital Health Wallet and Care Timeline.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Edit More"
                  variant="outline"
                  onPress={() => setShowFinalizeModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={isFinalizing ? "Finalizing..." : "Confirm & Lock"}
                  variant="primary"
                  loading={isFinalizing}
                  onPress={handleConfirmFinalize}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  headerBarSub: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  liveTimerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.error,
  },
  liveTimerText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.error,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  autoSaveStatus: {
    flex: 1,
  },
  dirtyDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.warning,
  },
  dirtyText: {
    fontSize: 11,
    color: Palette.warning,
    fontWeight: "500",
  },
  lastSavedText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  smallActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    gap: 4,
  },
  startBtn: {
    backgroundColor: Palette.primary,
  },
  draftBtn: {
    backgroundColor: Palette.primaryLight,
    borderWidth: 1,
    borderColor: Palette.accent,
  },
  finalizeBtn: {
    backgroundColor: Palette.accent,
  },
  smallActionBtnTextWhite: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  smallActionBtnTextAccent: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.accent,
  },
  auditStampBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    gap: 4,
  },
  auditStampText: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  tabsContainer: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  tabsScroll: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Palette.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.accent,
    fontWeight: "700",
  },
  tabIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabCountBadge: {
    backgroundColor: Palette.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  workspaceBody: {
    flex: 1,
  },
  workspaceBodyContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  sectionContainer: {
    gap: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  sectionSub: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  clinicalCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  cardSub: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
    marginBottom: 4,
  },
  singleLineInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 14,
    color: Palette.text,
    backgroundColor: Palette.background,
  },
  multiLineInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 14,
    color: Palette.text,
    backgroundColor: Palette.background,
    minHeight: 72,
    textAlignVertical: "top",
  },
  bmiBannerCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
  },
  bmiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  bmiStat: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Palette.border,
  },
  bmiNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: Palette.text,
  },
  bmiLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  bmiCategoryContainer: {
    flex: 1,
    gap: 4,
  },
  bmiHelp: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  vitalField: {
    width: "48%",
  },
  vitalFieldLabel: {
    fontSize: 11,
    color: Palette.textMuted,
    marginBottom: 2,
  },
  vitalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    backgroundColor: Palette.background,
    paddingHorizontal: Spacing.xs,
  },
  vitalInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  vitalUnit: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  historyVitalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  historyVitalDate: {
    width: 90,
  },
  historyVitalDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.text,
  },
  historyVitalTimeText: {
    fontSize: 10,
    color: Palette.textMuted,
  },
  historyVitalBadges: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 4,
  },
  emptyPrescriptionCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  emptyPrescriptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.text,
    marginTop: Spacing.sm,
  },
  emptyPrescriptionSub: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  medicineItemCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  medHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  medNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  medNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.accent,
  },
  medNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  medDosageText: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  medActionsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  medIconBtn: {
    padding: 6,
  },
  medPillsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 4,
  },
  medInstructionsText: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },
  reportCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reportIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reportName: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.text,
  },
  reportMeta: {
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  reportNotesText: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 4,
  },
  toggleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  toggleBtnActive: {
    backgroundColor: Palette.primaryLight,
    borderColor: Palette.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  toggleTextActive: {
    color: Palette.primary,
  },
  followUpConfig: {
    marginTop: Spacing.sm,
  },
  timeframePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  timeframePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  timeframePillActive: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  timeframePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  timeframePillTextActive: {
    color: "#fff",
  },
  patientProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  patientAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  patientFullName: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  patientMeta: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  patientPhoneText: {
    fontSize: 12,
    color: Palette.accent,
    fontWeight: "600",
    marginTop: 2,
  },
  profileDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.md,
  },
  tagWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  summaryItem: {
    marginTop: Spacing.xs,
  },
  summaryItemLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  summaryItemVal: {
    fontSize: 12,
    color: Palette.text,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  modalScroll: {
    paddingVertical: Spacing.sm,
  },
  quickChipScroll: {
    flexDirection: "row",
    marginVertical: Spacing.xs,
  },
  quickChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    marginRight: Spacing.xs,
  },
  quickChipText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  modalTwoCol: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  quickSelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  quickSelectPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
  },
  quickSelectPillActive: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
  quickSelectPillText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  quickSelectPillTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  finalizeIconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  finalizeSummaryScroll: {
    paddingVertical: Spacing.md,
  },
  finalizeSummaryCard: {
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  finalizeItemLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  finalizeItemVal: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
    marginTop: 2,
  },
  finalizeDivider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.xs,
  },
  finalizeNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  finalizeNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
});
