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
  Linking,
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
import { Palette, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { getUserImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as doctorPortalService from "@/services/doctor-portal";
import * as consentService from "@/services/consent";
import * as clinicalHandoverService from "@/services/clinical-handover";
import * as clinicalReferralService from "@/services/clinical-referral";
import * as healthDocumentsService from "@/services/health-documents";
import type {
  ClinicalAuthorizationRecord,
  ClinicalAuthorizationType,
  ClinicalHandoverRecord,
  ClinicalNotes,
  ClinicalReferralRecord,
  ClinicalVitals,
  DoctorConsultationContextResponse,
  HandoverPriority,
  HandoverType,
  NetworkReferralHospitalItem,
  PrescriptionInstructions,
  ReferralUrgency,
  SpecialistRoutingDoctorItem,
  StructuredMedicineItem,
} from "@/types";

type WorkspaceTab =
  | "notes"
  | "vitals"
  | "prescription"
  | "reports"
  | "followup"
  | "chart"
  | "handover"
  | "referral";

const QUICK_FREQUENCIES = [
  "1-0-1",
  "1-0-0",
  "0-0-1",
  "1-1-1",
  "SOS",
  "Once daily",
  "Twice daily",
];
const QUICK_DURATIONS = [
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "1 month",
];
const QUICK_TIMINGS = [
  "After food",
  "Before food",
  "With food",
  "Bedtime",
  "Empty stomach",
];
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

function calculateBMI(
  weightKg?: number,
  heightCm?: number,
): { bmi?: number; category?: string; color: string } {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return { color: Palette.textMuted };
  }
  const heightM = heightCm / 100;
  const bmiVal = Number((weightKg / (heightM * heightM)).toFixed(1));
  if (bmiVal < 18.5)
    return { bmi: bmiVal, category: "Underweight", color: Palette.warning };
  if (bmiVal <= 24.9)
    return { bmi: bmiVal, category: "Normal Weight", color: Palette.success };
  if (bmiVal <= 29.9)
    return { bmi: bmiVal, category: "Overweight", color: Palette.warning };
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
  const [context, setContext] =
    useState<DoctorConsultationContextResponse | null>(null);

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
  const [reportCategory, setReportCategory] = useState(
    "Prescription / Lab Order",
  );
  const [reportNotes, setReportNotes] = useState("");

  // Consent & Break-Glass Modals
  const [showConsentReqModal, setShowConsentReqModal] = useState(false);
  const [consentReqPurpose, setConsentReqPurpose] = useState(
    "Comprehensive Medical Review",
  );
  const [sendingConsentReq, setSendingConsentReq] = useState(false);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [submittingBreakGlass, setSubmittingBreakGlass] = useState(false);

  // Smart Clinical Authorization State
  const [clinicalAuthorizations, setClinicalAuthorizations] = useState<
    ClinicalAuthorizationRecord[]
  >([]);
  const [showClinicalAuthModal, setShowClinicalAuthModal] = useState(false);
  const [clinicalAuthType, setClinicalAuthType] =
    useState<ClinicalAuthorizationType>("treatment_care_plan_acknowledgement");
  const [clinicalAuthTitle, setClinicalAuthTitle] = useState("");
  const [clinicalAuthSummary, setClinicalAuthSummary] = useState("");
  const [clinicalAuthNotes, setClinicalAuthNotes] = useState("");
  const [submittingClinicalAuth, setSubmittingClinicalAuth] = useState(false);

  // Smart Clinical Handover State
  const [clinicalHandovers, setClinicalHandovers] = useState<
    ClinicalHandoverRecord[]
  >([]);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverType, setHandoverType] = useState<HandoverType>(
    "doctor_to_doctor_handover",
  );
  const [handoverPriority, setHandoverPriority] =
    useState<HandoverPriority>("routine");
  const [handoverReason, setHandoverReason] = useState("");
  const [handoverSummary, setHandoverSummary] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [targetDoctorId, setTargetDoctorId] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeRx, setIncludeRx] = useState(true);
  const [includeReports, setIncludeReports] = useState(true);
  const [includeVitals, setIncludeVitals] = useState(true);
  const [includeFollowUp, setIncludeFollowUp] = useState(true);
  const [requiresPatientAuth, setRequiresPatientAuth] = useState(false);
  const [pendingActionInput, setPendingActionInput] = useState("");
  const [pendingActionsList, setPendingActionsList] = useState<
    Array<{ description: string }>
  >([]);
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // Handover action modal state
  const [selectedHandoverForAction, setSelectedHandoverForAction] =
    useState<ClinicalHandoverRecord | null>(null);
  const [actionModalType, setActionModalType] = useState<
    "accept" | "decline" | "complete" | "cancel" | null
  >(null);
  const [actionNoteInput, setActionNoteInput] = useState("");
  const [processingHandoverAction, setProcessingHandoverAction] =
    useState(false);

  // Smart Specialist Referral State
  const [clinicalReferrals, setClinicalReferrals] = useState<
    ClinicalReferralRecord[]
  >([]);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralUrgency, setReferralUrgency] =
    useState<ReferralUrgency>("routine");
  const [referralDepartment, setReferralDepartment] =
    useState("General Medicine");
  const [referralTargetDoctorId, setReferralTargetDoctorId] = useState("");
  const [referralTargetDoctorName, setReferralTargetDoctorName] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [referralSummary, setReferralSummary] = useState("");
  const [referralIncludeNotes, setReferralIncludeNotes] = useState(true);
  const [referralIncludeRx, setReferralIncludeRx] = useState(true);
  const [referralIncludeReports, setReferralIncludeReports] = useState(true);
  const [referralIncludeVitals, setReferralIncludeVitals] = useState(true);
  const [referralIncludeFollowUp, setReferralIncludeFollowUp] = useState(true);
  const [referralSpecialists, setReferralSpecialists] = useState<
    SpecialistRoutingDoctorItem[]
  >([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
  const [submittingReferral, setSubmittingReferral] = useState(false);

  // Network Referral State (inter-hospital routing toggle)
  const [referralDestination, setReferralDestination] = useState<
    "within_hospital" | "hospital_network"
  >("within_hospital");
  const [networkHospitals, setNetworkHospitals] = useState<
    NetworkReferralHospitalItem[]
  >([]);
  const [loadingNetworkHospitals, setLoadingNetworkHospitals] = useState(false);
  const [selectedNetworkHospitalId, setSelectedNetworkHospitalId] =
    useState("");

  // Consultation elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Document Intelligence & OCR Inspection State
  const [selectedReportForOcr, setSelectedReportForOcr] = useState<any | null>(
    null,
  );
  const [loadingDocSummary, setLoadingDocSummary] = useState(false);
  const [docDoctorSummary, setDocDoctorSummary] = useState<string | null>(null);
  const [docOcrTab, setDocOcrTab] = useState<"summary" | "entities" | "text">(
    "summary",
  );

  const handleInspectDocOcr = async (report: any) => {
    setSelectedReportForOcr(report);
    setDocDoctorSummary(null);
    setDocOcrTab("summary");
    const docId = report._id || report.id;
    if (docId) {
      setLoadingDocSummary(true);
      try {
        const res =
          await healthDocumentsService.getDocumentDoctorSummary(docId);
        if (res.success && (res.doctorSummary || res.summary)) {
          setDocDoctorSummary(res.doctorSummary || res.summary || null);
        }
      } catch {
        // Fallback gracefully if summary endpoint returns 404/not ready
      } finally {
        setLoadingDocSummary(false);
      }
    }
  };

  const isCompleted = useMemo(() => {
    const status = context?.appointment?.status;
    const cStatus = context?.appointment?.consultationStatus;
    return status === "completed" || cStatus === "completed";
  }, [context?.appointment?.status, context?.appointment?.consultationStatus]);

  const isInProgress = useMemo(() => {
    return (
      context?.appointment?.consultationStatus === "in_progress" && !isCompleted
    );
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
      const res = await doctorPortalService.getDoctorConsultationContext(
        doctorId,
        appointmentId,
      );
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
        const pi =
          (
            appt as unknown as {
              prescriptionInstructions?: PrescriptionInstructions;
            }
          ).prescriptionInstructions || {};
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
          if (appt.followUp.timeframe)
            setFollowUpTimeframe(appt.followUp.timeframe);
        }

        // Initialize Patient Profile
        if (patient) {
          setAllergiesInput(
            Array.isArray(patient.allergies)
              ? patient.allergies.join(", ")
              : "",
          );
          setChronicConditionsInput(
            Array.isArray(patient.chronicConditions)
              ? patient.chronicConditions.join(", ")
              : "",
          );
          setBloodGroupInput(patient.bloodGroup || "");
        }

        // Initialize Clinical Authorizations
        if (Array.isArray(res.clinicalAuthorizations)) {
          setClinicalAuthorizations(res.clinicalAuthorizations);
        }

        // Initialize Clinical Handovers
        if (Array.isArray(res.clinicalHandovers)) {
          setClinicalHandovers(res.clinicalHandovers);
        }

        // Initialize Outgoing Clinical Referrals
        try {
          const refRes =
            await clinicalReferralService.getDoctorOutgoingReferrals();
          if (refRes?.success && Array.isArray(refRes.referrals)) {
            const currentApptId = String(appointmentId);
            const currentPatientId = String(
              (appt as unknown as { patientId?: string })?.patientId ||
                patient?._id ||
                "",
            );
            const matching = refRes.referrals.filter((r) => {
              const rAppt = String(
                (r.originatingAppointmentId as unknown as { _id?: string })
                  ?._id ||
                  r.originatingAppointmentId ||
                  "",
              );
              const rPat = String(
                (r.patientId as unknown as { _id?: string })?._id ||
                  r.patientId ||
                  "",
              );
              return (
                (rAppt && rAppt === currentApptId) ||
                (rPat && rPat === currentPatientId)
              );
            });
            setClinicalReferrals(
              matching.length > 0 ? matching : refRes.referrals,
            );
          }
        } catch {
          // Outgoing referrals non-blocking
        }

        // Set initial timer if consultation already in progress
        const startedAt = (
          appt as unknown as { consultationStartedAt?: string }
        ).consultationStartedAt;
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
  const bmiInfo = useMemo(
    () => calculateBMI(parsedWeight, parsedHeight),
    [parsedWeight, parsedHeight],
  );

  // Start Consultation action
  const handleStartConsultation = async () => {
    try {
      setIsStarting(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await doctorPortalService.startDoctorConsultation(
        doctorId,
        appointmentId,
      );
      if (res?.success) {
        setContext((prev) =>
          prev ? { ...prev, appointment: res.appointment } : prev,
        );
        setElapsedSeconds(0);
        Alert.alert(
          "Consultation Started",
          "The clinical session is now active and tracked in live queue.",
        );
      }
    } catch (err) {
      Alert.alert(
        "Action Failed",
        toErrorMessage(err, "Could not start consultation."),
      );
    } finally {
      setIsStarting(false);
    }
  };

  // Build Payload
  const buildPayload = useCallback(() => {
    const vitalsPayload: ClinicalVitals = {};
    if (bloodPressure.trim())
      vitalsPayload.bloodPressure = bloodPressure.trim();
    if (heartRate.trim()) vitalsPayload.heartRate = Number(heartRate);
    if (temperature.trim()) vitalsPayload.temperature = Number(temperature);
    if (respiratoryRate.trim())
      vitalsPayload.respiratoryRate = Number(respiratoryRate);
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
      followUpAdvice:
        followUpAdvice.trim() ||
        (followUpRequired ? `Follow up in ${followUpTimeframe}` : undefined),
      allergies: allergiesArray.length ? allergiesArray : undefined,
      chronicConditions: chronicConditionsArray.length
        ? chronicConditionsArray
        : undefined,
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
      const res = await doctorPortalService.saveDoctorConsultation(
        doctorId,
        appointmentId,
        payload,
      );
      if (res?.success) {
        setContext((prev) =>
          prev ? { ...prev, appointment: res.appointment } : prev,
        );
        setIsDirty(false);
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
        );
      }
    } catch (err) {
      Alert.alert(
        "Save Failed",
        toErrorMessage(err, "Could not save consultation draft."),
      );
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Request Clinical Authorization action
  const handleRequestClinicalAuth = async () => {
    if (!clinicalAuthTitle.trim()) {
      Alert.alert(
        "Missing Title",
        "Please provide a title or purpose for this clinical authorization request.",
      );
      return;
    }

    try {
      setSubmittingClinicalAuth(true);
      const res = await consentService.requestClinicalAuthorization({
        appointmentId,
        authorizationType: clinicalAuthType,
        clinicalContext: {
          title: clinicalAuthTitle.trim(),
          summary: clinicalAuthSummary.trim() || undefined,
          notes: clinicalAuthNotes.trim() || undefined,
        },
      });
      if (res?.success) {
        Alert.alert(
          "Authorization Requested",
          "Clinical authorization request has been dispatched to the patient. It will appear on their appointment card and consent dashboard.",
        );
        setShowClinicalAuthModal(false);
        setClinicalAuthTitle("");
        setClinicalAuthSummary("");
        setClinicalAuthNotes("");
        await loadWorkspace();
      }
    } catch (err) {
      Alert.alert(
        "Request Failed",
        toErrorMessage(err, "Failed to submit clinical authorization request."),
      );
    } finally {
      setSubmittingClinicalAuth(false);
    }
  };

  // Submit new Clinical Handover
  const handleSubmitHandover = async () => {
    if (!handoverReason.trim()) {
      Alert.alert(
        "Clinical Requirement",
        "Please provide a clinical reason for this handover.",
      );
      return;
    }
    if (!handoverSummary.trim()) {
      Alert.alert(
        "Clinical Requirement",
        "Please enter a clinical summary for the handover.",
      );
      return;
    }
    if (handoverType === "department_handover" && !targetDepartment.trim()) {
      Alert.alert(
        "Department Required",
        "Please specify the destination department for the handover.",
      );
      return;
    }
    if (
      handoverType === "doctor_to_doctor_handover" &&
      !targetDoctorId.trim()
    ) {
      Alert.alert("Doctor Required", "Please enter the recipient Doctor's ID.");
      return;
    }

    try {
      setSubmittingHandover(true);
      const patientId =
        (context?.patient as unknown as { _id?: string })?._id ||
        (
          context?.appointment as unknown as {
            userId?: { _id?: string } | string;
          }
        )?.userId;
      const actualPatientId =
        typeof patientId === "object" ? patientId?._id : patientId;

      if (!actualPatientId) {
        Alert.alert("Error", "Patient identification could not be resolved.");
        return;
      }

      const res = await clinicalHandoverService.createClinicalHandover({
        patientId: String(actualPatientId),
        familyMemberId:
          (context?.appointment as unknown as { familyMemberId?: string })
            ?.familyMemberId || null,
        originatingAppointmentId: appointmentId,
        receivingDoctorId:
          handoverType === "doctor_to_doctor_handover"
            ? targetDoctorId.trim()
            : null,
        toDepartment: targetDepartment.trim() || undefined,
        handoverType,
        priority: handoverPriority,
        reasonForHandover: handoverReason.trim(),
        clinicalSummary: handoverSummary.trim(),
        sharedContext: {
          includeConsultationNotes: includeNotes,
          includePrescriptions: includeRx,
          includeReports,
          includeVitals,
          includeFollowUpPlan: includeFollowUp,
          consultationNotes: includeNotes
            ? `${diagnosis ? `Diagnosis: ${diagnosis}\n` : ""}${assessment ? `Assessment: ${assessment}\n` : ""}${treatmentPlan ? `Plan: ${treatmentPlan}` : ""}`
            : "",
          latestVitals: includeVitals
            ? {
                bp: bloodPressure,
                pulse: heartRate,
                temp: temperature,
                weight,
                spo2: spO2,
              }
            : undefined,
        },
        pendingActions: pendingActionsList.map((a) => ({
          description: a.description,
        })),
        followUpPlan: includeFollowUp
          ? {
              recommendedTimeframe: followUpTimeframe,
              instructions: followUpInstructions || followUpAdvice,
            }
          : undefined,
        requiresPatientAuthorization: requiresPatientAuth,
      });

      if (res?.success) {
        Alert.alert(
          "Clinical Handover Initiated",
          "Continuity of care handover has been registered and synced across clinical records.",
        );
        setShowHandoverModal(false);
        setHandoverReason("");
        setHandoverSummary("");
        setTargetDepartment("");
        setTargetDoctorId("");
        setPendingActionsList([]);
        await loadWorkspace();
      }
    } catch (err) {
      Alert.alert(
        "Handover Error",
        toErrorMessage(err, "Failed to initiate clinical handover."),
      );
    } finally {
      setSubmittingHandover(false);
    }
  };

  // Process Handover Actions (Accept / Decline / Complete / Cancel)
  const handleExecuteHandoverAction = async () => {
    if (!selectedHandoverForAction || !actionModalType) return;
    try {
      setProcessingHandoverAction(true);
      if (actionModalType === "accept") {
        await clinicalHandoverService.acceptClinicalHandover(
          selectedHandoverForAction._id,
          {
            notes: actionNoteInput.trim() || undefined,
          },
        );
        Alert.alert(
          "Care Accepted",
          "You have accepted responsibility for this clinical handover.",
        );
      } else if (actionModalType === "decline") {
        if (!actionNoteInput.trim()) {
          Alert.alert(
            "Reason Required",
            "Please provide a clinical reason for declining this handover.",
          );
          setProcessingHandoverAction(false);
          return;
        }
        await clinicalHandoverService.declineClinicalHandover(
          selectedHandoverForAction._id,
          {
            declineReason: actionNoteInput.trim(),
          },
        );
        Alert.alert("Declined", "The clinical handover has been declined.");
      } else if (actionModalType === "complete") {
        await clinicalHandoverService.completeClinicalHandover(
          selectedHandoverForAction._id,
          {
            outcomeSummary:
              actionNoteInput.trim() ||
              "Care continuity actions completed successfully.",
            targetAppointmentId: appointmentId,
          },
        );
        Alert.alert(
          "Completed",
          "Care continuity handover marked as completed.",
        );
      } else if (actionModalType === "cancel") {
        await clinicalHandoverService.cancelClinicalHandover(
          selectedHandoverForAction._id,
          actionNoteInput.trim(),
        );
        Alert.alert("Cancelled", "Handover transfer cancelled.");
      }

      setActionModalType(null);
      setSelectedHandoverForAction(null);
      setActionNoteInput("");
      await loadWorkspace();
    } catch (err) {
      Alert.alert(
        "Action Failed",
        toErrorMessage(err, "Failed to process handover action."),
      );
    } finally {
      setProcessingHandoverAction(false);
    }
  };

  // Fetch Specialist Doctors catalog within hospital
  const fetchSpecialistCatalog = useCallback(
    async (dept?: string) => {
      try {
        setLoadingSpecialists(true);
        const res = await clinicalReferralService.getSpecialistRoutingCatalog({
          department: dept || referralDepartment,
        });
        if (res?.success && Array.isArray(res.specialists)) {
          setReferralSpecialists(res.specialists);
          if (res.specialists.length > 0) {
            setReferralTargetDoctorId(res.specialists[0]._id);
            setReferralTargetDoctorName(res.specialists[0].name);
          } else {
            setReferralTargetDoctorId("");
            setReferralTargetDoctorName("");
          }
        }
      } catch (err) {
        console.error("Failed to load specialists:", err);
      } finally {
        setLoadingSpecialists(false);
      }
    },
    [referralDepartment],
  );

  // Handle open create referral modal
  const handleOpenCreateReferral = () => {
    // Prefill clinical summary from diagnosis or notes if blank
    if (!referralSummary) {
      const summaryParts = [
        diagnosis ? `Working Diagnosis: ${diagnosis}` : "",
        assessment ? `Clinical Assessment: ${assessment}` : "",
        treatmentPlan ? `Initial Care Plan: ${treatmentPlan}` : "",
      ].filter(Boolean);
      setReferralSummary(summaryParts.join("\n"));
    }
    // Reset to within-hospital mode on open
    setReferralDestination("within_hospital");
    setSelectedNetworkHospitalId("");
    setShowReferralModal(true);
    void fetchSpecialistCatalog(referralDepartment);
  };

  const fetchNetworkHospitals = async () => {
    setLoadingNetworkHospitals(true);
    try {
      const res = await clinicalReferralService.getNetworkHospitals();
      setNetworkHospitals(res.hospitals || []);
    } catch {
      setNetworkHospitals([]);
    } finally {
      setLoadingNetworkHospitals(false);
    }
  };

  // Create Clinical Referral Action (Intra-hospital or Inter-hospital network)
  const handleCreateReferral = async () => {
    if (!referralReason.trim()) {
      Alert.alert(
        "Clinical Reason Required",
        "Please provide a clinical indication or reason for specialist referral.",
      );
      return;
    }

    if (
      referralDestination === "hospital_network" &&
      !selectedNetworkHospitalId
    ) {
      Alert.alert(
        "Receiving Hospital Required",
        "Please select a partner hospital from the network to route this inter-hospital referral.",
      );
      return;
    }

    const targetDoc = referralSpecialists.find(
      (s) => s._id === referralTargetDoctorId,
    );
    const dept =
      referralDepartment || targetDoc?.department || "General Medicine";

    const sharedContextPayload = {
      includeConsultationNotes: referralIncludeNotes,
      includePrescriptions: referralIncludeRx,
      includeReports: referralIncludeReports,
      includeVitals: referralIncludeVitals,
      includeFollowUpPlan: referralIncludeFollowUp,
      consultationNotesExcerpt: referralIncludeNotes
        ? `${diagnosis ? `Diagnosis: ${diagnosis}\n` : ""}${assessment ? `Assessment: ${assessment}\n` : ""}${treatmentPlan ? `Plan: ${treatmentPlan}` : ""}`
        : undefined,
    };

    const followUpContextPayload = referralIncludeFollowUp
      ? {
          recommendedTimeframe: followUpTimeframe,
          instructions: followUpInstructions || followUpAdvice,
        }
      : undefined;

    const patientId =
      (context?.appointment as unknown as { patientId?: string })?.patientId ||
      context?.patient?._id ||
      "";
    const familyMemberId =
      (context?.appointment as unknown as { familyMemberId?: string })
        ?.familyMemberId || null;

    setSubmittingReferral(true);
    try {
      let res: { success: boolean; referral?: { referralDisplayId?: string } };

      if (referralDestination === "hospital_network") {
        // Inter-hospital network referral - requires patient consent gate
        res = await clinicalReferralService.createNetworkReferral({
          patientId,
          familyMemberId,
          originatingAppointmentId: appointmentId,
          receivingHospitalId: selectedNetworkHospitalId,
          receivingDoctorId: referralTargetDoctorId || null,
          department: dept,
          targetSpeciality: targetDoc?.speciality || undefined,
          urgency: referralUrgency,
          reasonForReferral: referralReason.trim(),
          clinicalSummary:
            referralSummary.trim() ||
            `Inter-hospital referral to specialist facility for ${dept}: ${referralReason.trim()}`,
          sharedContext: sharedContextPayload,
          followUpContext: followUpContextPayload,
        });
      } else {
        // Intra-hospital within-facility specialist routing
        res = await clinicalReferralService.createClinicalReferral({
          patientId,
          familyMemberId,
          originatingAppointmentId: appointmentId,
          receivingDoctorId: referralTargetDoctorId || undefined,
          department: dept,
          targetSpeciality: targetDoc?.speciality || undefined,
          urgency: referralUrgency,
          reasonForReferral: referralReason.trim(),
          clinicalSummary:
            referralSummary.trim() ||
            `Specialist referral for ${dept}: ${referralReason.trim()}`,
          sharedContext: sharedContextPayload,
          followUpContext: followUpContextPayload,
        });
      }

      if (res?.success) {
        Alert.alert(
          referralDestination === "hospital_network"
            ? "Inter-Hospital Referral Created"
            : "Specialist Referral Created",
          referralDestination === "hospital_network"
            ? `Referral ID: ${res.referral?.referralDisplayId || "Generated"}.\nThe patient will be notified to authorize data exchange before the receiving hospital can review clinical context.`
            : `Referral ID: ${res.referral?.referralDisplayId || "Generated"}.\nThe referral has been dispatched to the specialist routing queue with continuous clinical context linkage.`,
        );
        setShowReferralModal(false);
        setReferralReason("");
        setReferralSummary("");
        setReferralTargetDoctorId("");
        setReferralTargetDoctorName("");
        setReferralDestination("within_hospital");
        setSelectedNetworkHospitalId("");
        await loadWorkspace();
      }
    } catch (err) {
      Alert.alert(
        "Referral Error",
        toErrorMessage(err, "Failed to create specialist referral."),
      );
    } finally {
      setSubmittingReferral(false);
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
      const res = await doctorPortalService.completeDoctorConsultation(
        doctorId,
        appointmentId,
        payload,
      );
      if (res?.success) {
        setShowFinalizeModal(false);
        setContext((prev) =>
          prev ? { ...prev, appointment: res.appointment } : prev,
        );
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
      Alert.alert(
        "Finalization Error",
        toErrorMessage(err, "Could not finalize consultation."),
      );
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

      if (
        pickerResult.canceled ||
        !pickerResult.assets ||
        !pickerResult.assets[0]
      ) {
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

      const res = await doctorPortalService.uploadDoctorReport(
        doctorId,
        appointmentId,
        formData,
      );
      if (res?.success) {
        setContext((prev) =>
          prev ? { ...prev, appointment: res.appointment } : prev,
        );
        setShowAddReportModal(false);
        setReportTitle("");
        setReportNotes("");
        Alert.alert(
          "Success",
          "Diagnostic report uploaded to patient medical chart.",
        );
      }
    } catch (err) {
      Alert.alert(
        "Upload Failed",
        toErrorMessage(err, "Could not upload document."),
      );
    } finally {
      setUploadingReport(false);
    }
  };

  // Request Patient Consent Handler
  const handleSendConsentRequest = async () => {
    if (!context?.patient?._id) return;
    setSendingConsentReq(true);
    try {
      const res = await consentService.requestDoctorPatientConsent({
        patientId: context.patient._id,
        dataCategories: [
          "medical_records",
          "prescriptions",
          "reports",
          "documents",
          "vitals",
        ],
        purpose: consentReqPurpose,
        requestMessage: `Dr. requested access for ${consentReqPurpose}`,
      });
      if (res.success) {
        Alert.alert(
          "Request Sent",
          "Consent request sent to patient's mobile app in real-time.",
        );
        setShowConsentReqModal(false);
      }
    } catch (err) {
      Alert.alert(
        "Request Failed",
        toErrorMessage(err, "Could not send consent request."),
      );
    } finally {
      setSendingConsentReq(false);
    }
  };

  // Emergency Break-Glass Override Handler
  const handleConfirmBreakGlass = async () => {
    if (!context?.patient?._id) return;
    if (!breakGlassReason.trim() || breakGlassReason.trim().length < 8) {
      Alert.alert(
        "Validation",
        "A detailed clinical justification (minimum 8 characters) is required.",
      );
      return;
    }

    setSubmittingBreakGlass(true);
    try {
      const res = await consentService.breakGlassEmergencyAccess({
        patientId: context.patient._id,
        justification: breakGlassReason.trim(),
        appointmentId,
      });
      if (res.success) {
        Alert.alert(
          "Break-Glass Override Activated",
          "Temporary 4-hour emergency clinical access granted. An audit event has been registered.",
        );
        setShowBreakGlassModal(false);
        setBreakGlassReason("");
        await loadWorkspace();
      }
    } catch (err) {
      Alert.alert(
        "Override Failed",
        toErrorMessage(err, "Could not activate break-glass."),
      );
    } finally {
      setSubmittingBreakGlass(false);
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
        <ErrorState
          message={error || "Appointment not found."}
          onRetry={loadWorkspace}
        />
      </SafeAreaView>
    );
  }

  const {
    appointment,
    patient,
    previousVitals,
    previousDiagnoses,
    previousConsultationSummary,
  } = context;

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
                <Badge
                  label={appointment.familyRelationship || "Family"}
                  variant="primary"
                />
              )}
            </View>
            <Text style={styles.headerBarSub}>
              {slotDate} · {slotTime} ·{" "}
              {consultationType === "video"
                ? "📹 Google Meet"
                : "🏥 In-Clinic OPD"}
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
              <Text style={styles.lastSavedText}>
                Draft saved at {lastSavedTime}
              </Text>
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
                    <Ionicons
                      name="cloud-upload-outline"
                      size={14}
                      color={Palette.accent}
                    />
                    <Text style={styles.smallActionBtnTextAccent}>
                      Save Draft
                    </Text>
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
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={Palette.textMuted}
                />
                <Text style={styles.auditStampText}>
                  Record Locked (Audit View)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Clinical Workspace Tab Bar */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            <Pressable
              onPress={() => setActiveTab("notes")}
              style={[
                styles.tabButton,
                activeTab === "notes" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={
                  activeTab === "notes" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "notes" && styles.tabTextActive,
                ]}
              >
                Notes
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("vitals")}
              style={[
                styles.tabButton,
                activeTab === "vitals" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="heart-outline"
                size={16}
                color={
                  activeTab === "vitals" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "vitals" && styles.tabTextActive,
                ]}
              >
                Vitals
              </Text>
              {bmiInfo.bmi ? (
                <View
                  style={[
                    styles.tabIndicatorDot,
                    { backgroundColor: bmiInfo.color },
                  ]}
                />
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("prescription")}
              style={[
                styles.tabButton,
                activeTab === "prescription" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="medkit-outline"
                size={16}
                color={
                  activeTab === "prescription"
                    ? Palette.accent
                    : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "prescription" && styles.tabTextActive,
                ]}
              >
                Rx
              </Text>
              {medicines.length > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>{medicines.length}</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("reports")}
              style={[
                styles.tabButton,
                activeTab === "reports" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={16}
                color={
                  activeTab === "reports" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "reports" && styles.tabTextActive,
                ]}
              >
                Reports
              </Text>
              {(appointment.medicalReports?.length || 0) > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>
                    {appointment.medicalReports?.length}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("followup")}
              style={[
                styles.tabButton,
                activeTab === "followup" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={
                  activeTab === "followup" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "followup" && styles.tabTextActive,
                ]}
              >
                Follow-Up
              </Text>
              {followUpRequired && (
                <View
                  style={[
                    styles.tabIndicatorDot,
                    { backgroundColor: Palette.primary },
                  ]}
                />
              )}
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("chart")}
              style={[
                styles.tabButton,
                activeTab === "chart" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="person-circle-outline"
                size={16}
                color={
                  activeTab === "chart" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "chart" && styles.tabTextActive,
                ]}
              >
                EMR Chart
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("handover")}
              style={[
                styles.tabButton,
                activeTab === "handover" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={
                  activeTab === "handover" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "handover" && styles.tabTextActive,
                ]}
              >
                Handover
              </Text>
              {clinicalHandovers.length > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>
                    {clinicalHandovers.length}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Referral Tab */}
            <Pressable
              onPress={() => setActiveTab("referral")}
              style={[
                styles.tabButton,
                activeTab === "referral" && styles.tabButtonActive,
              ]}
            >
              <Ionicons
                name="git-network-outline"
                size={16}
                color={
                  activeTab === "referral" ? Palette.accent : Palette.textMuted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "referral" && styles.tabTextActive,
                ]}
              >
                Referral
              </Text>
              {clinicalReferrals.length > 0 && (
                <View style={styles.tabCountBadge}>
                  <Text style={styles.tabCountText}>
                    {clinicalReferrals.length}
                  </Text>
                </View>
              )}
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
                    <Text style={styles.cardTitle}>
                      Working Diagnosis / Assessment
                    </Text>
                    <Text style={styles.cardSub}>
                      Required to finalize consultation
                    </Text>
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
                <Text style={styles.inputLabel}>
                  History of Present Illness (HPI) & Symptoms
                </Text>
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
                <Text style={styles.inputLabel}>
                  Physical Examination & Systemic Findings
                </Text>
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
                <Text style={styles.inputLabel}>
                  Treatment Plan & Clinical Actions
                </Text>
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
                <Text style={styles.inputLabel}>
                  Private Clinical Notes (Internal Records)
                </Text>
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
                    <Text style={styles.bmiNumber}>
                      {bmiInfo.bmi ? bmiInfo.bmi : "--"}
                    </Text>
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
                <Text style={styles.cardTitle}>
                  Vitals & Physiological Metrics
                </Text>
                <Text style={styles.cardSub}>
                  Recorded during clinical examination
                </Text>

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
                  <Text style={styles.cardSub}>
                    Recorded from previous consultations with you
                  </Text>

                  {previousVitals.map((entry, idx) => (
                    <View
                      key={entry.appointmentId || idx}
                      style={styles.historyVitalRow}
                    >
                      <View style={styles.historyVitalDate}>
                        <Text style={styles.historyVitalDateText}>
                          {entry.date || "Past Visit"}
                        </Text>
                        <Text style={styles.historyVitalTimeText}>
                          {entry.time || ""}
                        </Text>
                      </View>
                      <View style={styles.historyVitalBadges}>
                        {entry.vitals.bloodPressure && (
                          <Badge
                            label={`BP: ${entry.vitals.bloodPressure}`}
                            variant="neutral"
                          />
                        )}
                        {entry.vitals.heartRate && (
                          <Badge
                            label={`HR: ${entry.vitals.heartRate}`}
                            variant="neutral"
                          />
                        )}
                        {entry.vitals.spO2 && (
                          <Badge
                            label={`SpO2: ${entry.vitals.spO2}%`}
                            variant="neutral"
                          />
                        )}
                        {entry.vitals.bmi && (
                          <Badge
                            label={`BMI: ${entry.vitals.bmi}`}
                            variant="primary"
                          />
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
                  <Text style={styles.sectionHeading}>
                    Digital Prescription
                  </Text>
                  <Text style={styles.sectionSub}>
                    Structured medicines & patient instructions
                  </Text>
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
                  <Ionicons
                    name="medkit-outline"
                    size={32}
                    color={Palette.accent}
                  />
                  <Text style={styles.emptyPrescriptionTitle}>
                    No Medicines Prescribed Yet
                  </Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    Tap "+ Add Medicine" to prescribe structured medications
                    with dosage, frequency, and instructions.
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
                          {med.dosage || "Standard Dose"} ·{" "}
                          {med.route || "Oral"}
                        </Text>
                      </View>
                      {!isCompleted && (
                        <View style={styles.medActionsRow}>
                          <Pressable
                            onPress={() => handleOpenEditMedicine(index)}
                            style={styles.medIconBtn}
                          >
                            <Ionicons
                              name="pencil"
                              size={16}
                              color={Palette.accent}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteMedicine(index)}
                            style={styles.medIconBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={Palette.error}
                            />
                          </Pressable>
                        </View>
                      )}
                    </View>

                    <View style={styles.medPillsRow}>
                      <Badge
                        label={med.frequency || "1-0-1"}
                        variant="primary"
                      />
                      <Badge
                        label={med.duration || "5 days"}
                        variant="neutral"
                      />
                      <Badge
                        label={med.timing || "After food"}
                        variant="neutral"
                      />
                    </View>

                    {med.instructions ? (
                      <Text style={styles.medInstructionsText}>
                        💡 {med.instructions}
                      </Text>
                    ) : null}
                  </Card>
                ))
              )}

              {/* Instructions Cards */}
              <Card style={styles.clinicalCard}>
                <Text style={styles.inputLabel}>
                  Diet & Nutritional Instructions
                </Text>
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
                <Text style={styles.inputLabel}>
                  Lab / Diagnostic Tests Advised
                </Text>
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
                  <Text style={styles.sectionHeading}>
                    Patient Reports & Orders
                  </Text>
                  <Text style={styles.sectionSub}>
                    Diagnostic investigations & attached records
                  </Text>
                </View>
                {!isCompleted && (
                  <Button
                    title="+ Attach Report"
                    variant="primary"
                    onPress={() => setShowAddReportModal(true)}
                  />
                )}
              </View>

              {!appointment.medicalReports ||
              appointment.medicalReports.length === 0 ? (
                <Card style={styles.emptyPrescriptionCard}>
                  <Ionicons
                    name="folder-open-outline"
                    size={32}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.emptyPrescriptionTitle}>
                    No Reports Attached for this Visit
                  </Text>
                  <Text style={styles.emptyPrescriptionSub}>
                    You can upload lab test orders or investigation reports
                    directly to the patient's medical file.
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
                        <Ionicons
                          name="document-attach"
                          size={20}
                          color={Palette.accent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          <Text style={styles.reportName}>{report.name}</Text>
                          <Badge
                            label={report.category || "Report"}
                            variant="primary"
                          />
                        </View>
                        <Text style={styles.reportMeta}>
                          {report.category || report.type || "Medical Report"} ·{" "}
                          {report.uploadedAt
                            ? new Date(report.uploadedAt).toLocaleDateString()
                            : "Uploaded"}
                        </Text>
                        {report.notes ? (
                          <Text style={styles.reportNotesText}>
                            Note: {report.notes}
                          </Text>
                        ) : null}

                        {/* Document Intelligence & Quick Actions */}
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          <Button
                            title="Inspect Intelligence"
                            variant="primary"
                            icon="sparkles-outline"
                            onPress={() => handleInspectDocOcr(report)}
                            style={{ flex: 1, paddingVertical: 6 }}
                          />
                          {report.url ? (
                            <Button
                              title="Open Original"
                              variant="outline"
                              icon="open-outline"
                              onPress={() => {
                                if (report.url)
                                  void Linking.openURL(report.url);
                              }}
                              style={{ flex: 1, paddingVertical: 6 }}
                            />
                          ) : null}
                        </View>
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
                    <Ionicons
                      name="calendar"
                      size={18}
                      color={Palette.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      Follow-Up Visit Recommendation
                    </Text>
                    <Text style={styles.cardSub}>
                      Guides patient on return consultation timeframe
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (isCompleted) return;
                      setFollowUpRequired(!followUpRequired);
                      setIsDirty(true);
                    }}
                    style={[
                      styles.toggleBtn,
                      followUpRequired && styles.toggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        followUpRequired && styles.toggleTextActive,
                      ]}
                    >
                      {followUpRequired ? "Required" : "Optional"}
                    </Text>
                  </Pressable>
                </View>

                {followUpRequired && (
                  <View style={styles.followUpConfig}>
                    <Text style={styles.inputLabel}>
                      Recommended Return Interval
                    </Text>
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
                            followUpTimeframe === tf &&
                              styles.timeframePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.timeframePillText,
                              followUpTimeframe === tf &&
                                styles.timeframePillTextActive,
                            ]}
                          >
                            {tf}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text
                      style={[styles.inputLabel, { marginTop: Spacing.md }]}
                    >
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
              {/* PATIENT DATA ACCESS & CONSENT GOVERNANCE BANNER */}
              <Card
                style={[
                  styles.clinicalCard,
                  context.consentStatus?.isRestricted
                    ? styles.consentBannerRestricted
                    : styles.consentBannerAuthorized,
                ]}
              >
                <View style={styles.consentBannerHeaderRow}>
                  <View style={styles.consentBannerTitleWrap}>
                    <Ionicons
                      name={
                        context.consentStatus?.isRestricted
                          ? "shield-outline"
                          : "shield-checkmark"
                      }
                      size={20}
                      color={
                        context.consentStatus?.isRestricted
                          ? Palette.warning
                          : Palette.success
                      }
                    />
                    <Text style={styles.consentBannerTitle}>
                      {context.consentStatus?.isRestricted
                        ? "Patient Consent: Historical Data Restricted"
                        : "Clinical Consent: Authorized Access"}
                    </Text>
                  </View>
                  <Badge
                    label={
                      context.consentStatus?.isRestricted
                        ? "Consent Needed"
                        : context.consentStatus?.accessType ===
                            "emergency_break_glass"
                          ? "Break-Glass"
                          : "Authorized"
                    }
                    variant={
                      context.consentStatus?.isRestricted
                        ? "warning"
                        : context.consentStatus?.accessType ===
                            "emergency_break_glass"
                          ? "error"
                          : "success"
                    }
                  />
                </View>

                <Text style={styles.consentBannerDescription}>
                  {context.consentStatus?.isRestricted
                    ? "Patient has restricted broad access to past medical records. You have encounter authorization for today's appointment. To inspect full historical charts, request explicit patient consent or initiate Emergency Break-Glass."
                    : `Active clinical access verified (${context.consentStatus?.accessType || "encounter-based"}). Medical charts and consultation summaries unlocked.`}
                </Text>

                {context.consentStatus?.isRestricted && (
                  <View style={styles.consentBannerActionsRow}>
                    <Button
                      title="Request Patient Consent"
                      variant="primary"
                      onPress={() => setShowConsentReqModal(true)}
                    />
                    <Button
                      title="Break-Glass Override"
                      variant="danger"
                      onPress={() => setShowBreakGlassModal(true)}
                    />
                  </View>
                )}
              </Card>

              {/* SMART CLINICAL AUTHORIZATION & CARE ACKNOWLEDGEMENT */}
              <Card style={styles.clinicalCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardIconBox}>
                    <Ionicons
                      name="clipboard-outline"
                      size={18}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      Clinical Treatment Authorizations
                    </Text>
                    <Text style={styles.cardSub}>
                      Structured patient acknowledgements & consent records
                    </Text>
                  </View>
                  {!isCompleted && (
                    <Button
                      title="+ Request"
                      variant="primary"
                      onPress={() => setShowClinicalAuthModal(true)}
                    />
                  )}
                </View>

                {clinicalAuthorizations.length === 0 ? (
                  <View style={styles.emptyAuthBox}>
                    <Text style={styles.emptyAuthText}>
                      No treatment authorizations requested for this appointment
                      yet. You can request care plan acknowledgements,
                      telehealth consent, or past document review authorization.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                    {clinicalAuthorizations.map((auth) => {
                      const isApproved = auth.status === "approved";
                      const isPending = auth.status === "pending";
                      const isDeclined = auth.status === "declined";
                      return (
                        <View key={auth._id} style={styles.docAuthItemCard}>
                          <View style={styles.docAuthHeaderRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docAuthTitle}>
                                {auth.clinicalContext?.title || auth.purpose}
                              </Text>
                              <Text style={styles.docAuthType}>
                                {auth.authorizationType
                                  ?.replace(/_/g, " ")
                                  .toUpperCase()}
                              </Text>
                            </View>
                            <Badge
                              label={
                                isApproved
                                  ? "Authorized"
                                  : isPending
                                    ? "Pending Patient"
                                    : isDeclined
                                      ? "Declined"
                                      : auth.status
                              }
                              variant={
                                isApproved
                                  ? "success"
                                  : isPending
                                    ? "warning"
                                    : isDeclined
                                      ? "error"
                                      : "neutral"
                              }
                            />
                          </View>
                          {auth.clinicalContext?.summary ? (
                            <Text style={styles.docAuthSummary}>
                              {auth.clinicalContext.summary}
                            </Text>
                          ) : null}
                          {isApproved && (
                            <Text style={styles.docAuthMetaSuccess}>
                              ✓ Patient approved on{" "}
                              {auth.respondedAt
                                ? new Date(
                                    auth.respondedAt,
                                  ).toLocaleDateString()
                                : "record"}
                              .
                            </Text>
                          )}
                          {isDeclined && (
                            <Text style={styles.docAuthMetaDeclined}>
                              ✕ Declined by patient
                              {auth.declinedReason
                                ? `: "${auth.declinedReason}"`
                                : "."}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>

              {/* Patient Demographics Card */}
              <Card style={styles.clinicalCard}>
                <View style={styles.patientProfileRow}>
                  <Image
                    source={{ uri: patientImage }}
                    style={styles.patientAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientFullName}>{patientName}</Text>
                    <Text style={styles.patientMeta}>
                      {patient?.gender ? `${patient.gender} · ` : ""}
                      {patient?.dob ? `DOB: ${patient.dob}` : ""}
                    </Text>
                    <Text style={styles.patientPhoneText}>
                      {patient?.phone || "No phone on file"}
                    </Text>
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
                  <Text style={styles.cardSub}>
                    From prior consultations with you
                  </Text>
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
                  <Text style={styles.cardSub}>
                    Date: {previousConsultationSummary.date || "Recent"}
                  </Text>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryItemLabel}>Diagnosis:</Text>
                    <Text style={styles.summaryItemVal}>
                      {previousConsultationSummary.diagnosis ||
                        "General Consultation"}
                    </Text>
                  </View>
                  {previousConsultationSummary.notes ? (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryItemLabel}>
                        Clinical Notes:
                      </Text>
                      <Text style={styles.summaryItemVal}>
                        {previousConsultationSummary.notes}
                      </Text>
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

          {/* TAB 7: CLINICAL HANDOVER & CARE CONTINUITY */}
          {activeTab === "handover" && (
            <View style={styles.sectionContainer}>
              {/* Overview & Action Banner */}
              <Card style={styles.clinicalCard}>
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.cardIconBox,
                      { backgroundColor: Palette.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={20}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      Clinical Handover & Care Continuity
                    </Text>
                    <Text style={styles.cardSub}>
                      Structured physician transfer with selective clinical
                      context
                    </Text>
                  </View>
                </View>

                <View style={styles.handoverActionRow}>
                  <Button
                    title="Initiate Handover"
                    variant="primary"
                    icon="add-circle-outline"
                    onPress={() => setShowHandoverModal(true)}
                  />
                  <Button
                    title="Refresh"
                    variant="ghost"
                    icon="refresh"
                    onPress={loadWorkspace}
                  />
                </View>
              </Card>

              {/* Handover List */}
              {clinicalHandovers.length === 0 ? (
                <Card
                  style={[
                    styles.clinicalCard,
                    { alignItems: "center", paddingVertical: Spacing.xl },
                  ]}
                >
                  <Ionicons
                    name="git-branch-outline"
                    size={44}
                    color={Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.emptyPrescriptionTitle,
                      { marginTop: Spacing.sm },
                    ]}
                  >
                    No Clinical Handovers Registered
                  </Text>
                  <Text
                    style={[
                      styles.cardSub,
                      {
                        textAlign: "center",
                        marginHorizontal: Spacing.md,
                        marginTop: 4,
                      },
                    ]}
                  >
                    Transfer clinical responsibility for this patient to another
                    doctor or department with verified authorization and audit
                    logs.
                  </Text>
                  <Button
                    title="Transfer Care Now"
                    variant="outline"
                    onPress={() => setShowHandoverModal(true)}
                    style={{ marginTop: Spacing.md }}
                  />
                </Card>
              ) : (
                clinicalHandovers.map((handover) => {
                  const isOriginator =
                    String(
                      (
                        handover.originatingDoctorId as unknown as {
                          _id?: string;
                        }
                      )?._id || handover.originatingDoctorId,
                    ) === String(doctorId);
                  const isReceiver =
                    String(
                      (
                        handover.receivingDoctorId as unknown as {
                          _id?: string;
                        }
                      )?._id || handover.receivingDoctorId,
                    ) === String(doctorId);
                  const receiverName =
                    (
                      handover.receivingDoctorId as unknown as {
                        name?: string;
                      }
                    )?.name ||
                    handover.recipientDoctorName ||
                    (handover.toDepartment
                      ? `Dept: ${handover.toDepartment}`
                      : "Pending Assignment");
                  const originatorName =
                    (
                      handover.originatingDoctorId as unknown as {
                        name?: string;
                      }
                    )?.name ||
                    handover.senderDoctorName ||
                    "Clinician";

                  const getStatusBadgeVariant = (st: string): BadgeVariant => {
                    switch (st) {
                      case "accepted":
                        return "success";
                      case "sent":
                      case "in_review":
                        return "warning";
                      case "completed":
                        return "primary";
                      case "pending_patient_authorization":
                        return "primary";
                      case "declined":
                      case "cancelled":
                        return "error";
                      default:
                        return "neutral";
                    }
                  };

                  const getPriorityBadgeVariant = (
                    pr: string,
                  ): BadgeVariant => {
                    switch (pr) {
                      case "critical":
                        return "error";
                      case "urgent":
                        return "warning";
                      default:
                        return "neutral";
                    }
                  };

                  return (
                    <Card key={handover._id} style={styles.clinicalCard}>
                      {/* Header */}
                      <View style={styles.handoverHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.handoverDisplayId}>
                            {handover.handoverDisplayId ||
                              `HND-${handover._id.slice(-6).toUpperCase()}`}
                          </Text>
                          <Text style={styles.handoverTypeText}>
                            {handover.handoverType
                              .replace(/_/g, " ")
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 4,
                            alignItems: "center",
                          }}
                        >
                          <Badge
                            label={handover.priority.toUpperCase()}
                            variant={getPriorityBadgeVariant(handover.priority)}
                          />
                          <Badge
                            label={handover.status
                              .replace(/_/g, " ")
                              .toUpperCase()}
                            variant={getStatusBadgeVariant(handover.status)}
                          />
                        </View>
                      </View>

                      {/* Clinician Routing */}
                      <View style={styles.handoverRoutingCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.handoverRoleLabel}>
                            Originating Doctor
                          </Text>
                          <Text style={styles.handoverRoleValue}>
                            Dr. {originatorName}
                          </Text>
                        </View>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color={Palette.accent}
                          style={{ marginHorizontal: Spacing.xs }}
                        />
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={styles.handoverRoleLabel}>
                            Destination
                          </Text>
                          <Text style={styles.handoverRoleValue}>
                            {receiverName.startsWith("Dept:")
                              ? receiverName
                              : `Dr. ${receiverName}`}
                          </Text>
                        </View>
                      </View>

                      {/* Reason & Clinical Summary */}
                      <View style={styles.handoverSectionBlock}>
                        <Text style={styles.handoverBlockLabel}>
                          Clinical Reason
                        </Text>
                        <Text style={styles.handoverBlockValue}>
                          {handover.reasonForHandover || handover.reason}
                        </Text>
                      </View>

                      {handover.clinicalSummary ? (
                        <View style={styles.handoverSectionBlock}>
                          <Text style={styles.handoverBlockLabel}>
                            Clinical Summary
                          </Text>
                          <Text style={styles.handoverBlockValue}>
                            {handover.clinicalSummary}
                          </Text>
                        </View>
                      ) : null}

                      {/* Shared Context Pills */}
                      <View style={styles.handoverSectionBlock}>
                        <Text style={styles.handoverBlockLabel}>
                          Transferred Clinical Context
                        </Text>
                        <View style={styles.sharedContextChipsRow}>
                          {handover.sharedContext?.includeConsultationNotes && (
                            <View style={styles.sharedContextChip}>
                              <Ionicons
                                name="document-text-outline"
                                size={12}
                                color={Palette.primary}
                              />
                              <Text style={styles.sharedContextChipText}>
                                Notes
                              </Text>
                            </View>
                          )}
                          {handover.sharedContext?.includePrescriptions && (
                            <View style={styles.sharedContextChip}>
                              <Ionicons
                                name="medkit-outline"
                                size={12}
                                color={Palette.success}
                              />
                              <Text style={styles.sharedContextChipText}>
                                Prescriptions
                              </Text>
                            </View>
                          )}
                          {handover.sharedContext?.includeReports && (
                            <View style={styles.sharedContextChip}>
                              <Ionicons
                                name="folder-outline"
                                size={12}
                                color={Palette.accent}
                              />
                              <Text style={styles.sharedContextChipText}>
                                Reports
                              </Text>
                            </View>
                          )}
                          {handover.sharedContext?.includeVitals && (
                            <View style={styles.sharedContextChip}>
                              <Ionicons
                                name="heart-outline"
                                size={12}
                                color={Palette.error}
                              />
                              <Text style={styles.sharedContextChipText}>
                                Vitals
                              </Text>
                            </View>
                          )}
                          {handover.sharedContext?.includeFollowUpPlan && (
                            <View style={styles.sharedContextChip}>
                              <Ionicons
                                name="calendar-outline"
                                size={12}
                                color={Palette.warning}
                              />
                              <Text style={styles.sharedContextChipText}>
                                Follow-Up
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Pending Actions */}
                      {handover.pendingActions &&
                        handover.pendingActions.length > 0 && (
                          <View style={styles.handoverSectionBlock}>
                            <Text style={styles.handoverBlockLabel}>
                              Pending Care Actions
                            </Text>
                            {handover.pendingActions.map((action, idx) => (
                              <View key={idx} style={styles.handoverActionItem}>
                                <Ionicons
                                  name={
                                    action.isCompleted ||
                                    action.status === "completed"
                                      ? "checkmark-circle"
                                      : "ellipse-outline"
                                  }
                                  size={14}
                                  color={
                                    action.isCompleted ||
                                    action.status === "completed"
                                      ? Palette.success
                                      : Palette.warning
                                  }
                                />
                                <Text style={styles.handoverActionText}>
                                  {action.description}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                      {/* Follow-up plan */}
                      {handover.followUpPlan?.recommendedTimeframe ? (
                        <View style={styles.handoverSectionBlock}>
                          <Text style={styles.handoverBlockLabel}>
                            Care Continuity Schedule
                          </Text>
                          <Text style={styles.handoverBlockValue}>
                            Interval:{" "}
                            {handover.followUpPlan.recommendedTimeframe}
                            {handover.followUpPlan.instructions
                              ? ` - ${handover.followUpPlan.instructions}`
                              : ""}
                          </Text>
                        </View>
                      ) : null}

                      {/* Patient Authorization Status */}
                      {handover.patientAuthorization?.required && (
                        <View style={styles.handoverAuthBanner}>
                          <Ionicons
                            name={
                              handover.patientAuthorization.status ===
                              "approved"
                                ? "shield-checkmark"
                                : handover.patientAuthorization.status ===
                                    "declined"
                                  ? "alert-circle"
                                  : "time-outline"
                            }
                            size={16}
                            color={
                              handover.patientAuthorization.status ===
                              "approved"
                                ? Palette.success
                                : handover.patientAuthorization.status ===
                                    "declined"
                                  ? Palette.error
                                  : Palette.warning
                            }
                          />
                          <Text style={styles.handoverAuthText}>
                            Patient Authorization:{" "}
                            {handover.patientAuthorization.status.toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {/* Handover Action Buttons */}
                      <View style={styles.handoverBtnRow}>
                        {/* Receiving doctor: Accept or Decline when status is sent or in_review */}
                        {["sent", "in_review"].includes(handover.status) &&
                          (isReceiver || !handover.receivingDoctorId) && (
                            <>
                              <Button
                                title="Accept Care"
                                variant="primary"
                                icon="checkmark-circle-outline"
                                onPress={() => {
                                  setSelectedHandoverForAction(handover);
                                  setActionModalType("accept");
                                  setActionNoteInput("");
                                }}
                                style={{ flex: 1, marginRight: Spacing.xs }}
                              />
                              <Button
                                title="Decline"
                                variant="outline"
                                icon="close-circle-outline"
                                onPress={() => {
                                  setSelectedHandoverForAction(handover);
                                  setActionModalType("decline");
                                  setActionNoteInput("");
                                }}
                                style={{ flex: 1 }}
                              />
                            </>
                          )}

                        {/* Complete care when accepted */}
                        {handover.status === "accepted" && (
                          <Button
                            title="Complete Handover"
                            variant="primary"
                            icon="checkmark-done"
                            onPress={() => {
                              setSelectedHandoverForAction(handover);
                              setActionModalType("complete");
                              setActionNoteInput("");
                            }}
                            style={{ flex: 1 }}
                          />
                        )}

                        {/* Originator cancel when not completed */}
                        {isOriginator &&
                          !["completed", "cancelled", "declined"].includes(
                            handover.status,
                          ) && (
                            <Button
                              title="Cancel Handover"
                              variant="ghost"
                              onPress={() => {
                                setSelectedHandoverForAction(handover);
                                setActionModalType("cancel");
                                setActionNoteInput("");
                              }}
                              style={{ marginLeft: Spacing.xs }}
                            />
                          )}
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 8: SMART SPECIALIST REFERRAL & ROUTING */}
          {activeTab === "referral" && (
            <View style={styles.sectionContainer}>
              {/* Header Action Banner */}
              <Card style={styles.clinicalCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={styles.sectionHeading}>
                      Specialist Referral & Routing
                    </Text>
                    <Text style={styles.sectionSub}>
                      Route patient to departmental specialists with linked
                      clinical context and hospital-level access control.
                    </Text>
                  </View>
                  <Button
                    title="+ New Referral"
                    variant="primary"
                    icon="add-circle"
                    onPress={handleOpenCreateReferral}
                  />
                </View>
              </Card>

              {/* Referral List */}
              {clinicalReferrals.length === 0 ? (
                <Card
                  style={[
                    styles.clinicalCard,
                    { alignItems: "center", paddingVertical: Spacing.xl },
                  ]}
                >
                  <Ionicons
                    name="git-network-outline"
                    size={44}
                    color={Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.emptyPrescriptionTitle,
                      { marginTop: Spacing.sm },
                    ]}
                  >
                    No Specialist Referrals Recorded
                  </Text>
                  <Text
                    style={[
                      styles.cardSub,
                      {
                        textAlign: "center",
                        marginHorizontal: Spacing.md,
                        marginTop: 4,
                      },
                    ]}
                  >
                    Create a structured referral to guide the patient to a
                    specialist doctor or department within this hospital.
                  </Text>
                  <Button
                    title="Create Specialist Referral"
                    variant="outline"
                    onPress={handleOpenCreateReferral}
                    style={{ marginTop: Spacing.md }}
                  />
                </Card>
              ) : (
                clinicalReferrals.map((referral) => {
                  const targetDocName =
                    (typeof referral.receivingDoctorId === "object" &&
                    referral.receivingDoctorId &&
                    "name" in referral.receivingDoctorId
                      ? String(
                          (referral.receivingDoctorId as { name?: string })
                            .name || "",
                        )
                      : "") || "Department Specialist";

                  const urgencyBadgeVariant: BadgeVariant =
                    referral.urgency === "stat_emergency"
                      ? "error"
                      : referral.urgency === "urgent"
                        ? "warning"
                        : "neutral";

                  const statusBadgeVariant: BadgeVariant =
                    referral.status === "appointment_booked" ||
                    referral.status === "completed" ||
                    referral.status === "accepted"
                      ? "success"
                      : referral.status === "declined" ||
                          referral.status === "cancelled"
                        ? "error"
                        : "primary";

                  return (
                    <Card
                      key={referral._id}
                      style={[
                        styles.clinicalCard,
                        { marginBottom: Spacing.sm },
                      ]}
                    >
                      {/* Header */}
                      <View style={styles.handoverHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.handoverDisplayId}>
                            {referral.referralDisplayId || "REF-SPECIALIST"}
                          </Text>
                          <Text style={styles.handoverTypeText}>
                            Target Dept:{" "}
                            {referral.department || "Specialist Care"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Badge
                            label={String(
                              referral.urgency || "routine",
                            ).toUpperCase()}
                            variant={urgencyBadgeVariant}
                          />
                          <Badge
                            label={String(referral.status || "active")
                              .replace(/_/g, " ")
                              .toUpperCase()}
                            variant={statusBadgeVariant}
                          />
                        </View>
                      </View>

                      {/* Specialist Routing Destination Card */}
                      <View style={styles.handoverRoutingCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.handoverRoleLabel}>
                            TARGET SPECIALIST
                          </Text>
                          <Text style={styles.handoverRoleValue}>
                            Dr. {targetDocName}
                          </Text>
                          {referral.targetSpeciality && (
                            <Text style={[styles.cardSub, { fontSize: 11 }]}>
                              Speciality: {referral.targetSpeciality}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Clinical Indication */}
                      <View style={styles.handoverSectionBlock}>
                        <Text style={styles.handoverBlockLabel}>
                          Clinical Indication / Reason:
                        </Text>
                        <Text style={styles.handoverBlockValue}>
                          {referral.reasonForReferral}
                        </Text>
                      </View>

                      {/* Clinical Summary */}
                      {referral.clinicalSummary ? (
                        <View style={styles.handoverSectionBlock}>
                          <Text style={styles.handoverBlockLabel}>
                            Clinical Summary:
                          </Text>
                          <Text style={styles.handoverBlockValue}>
                            {referral.clinicalSummary}
                          </Text>
                        </View>
                      ) : null}

                      {/* Shared Context Chips */}
                      {referral.sharedContext && (
                        <View style={styles.handoverSectionBlock}>
                          <Text style={styles.handoverBlockLabel}>
                            Shared Clinical Records:
                          </Text>
                          <View style={styles.sharedContextChipsRow}>
                            {referral.sharedContext
                              .includeConsultationNotes && (
                              <View style={styles.sharedContextChip}>
                                <Ionicons
                                  name="document-text-outline"
                                  size={12}
                                  color={Palette.primary}
                                />
                                <Text style={styles.sharedContextChipText}>
                                  Notes
                                </Text>
                              </View>
                            )}
                            {referral.sharedContext.includePrescriptions && (
                              <View style={styles.sharedContextChip}>
                                <Ionicons
                                  name="medkit-outline"
                                  size={12}
                                  color={Palette.primary}
                                />
                                <Text style={styles.sharedContextChipText}>
                                  Prescriptions
                                </Text>
                              </View>
                            )}
                            {referral.sharedContext.includeReports && (
                              <View style={styles.sharedContextChip}>
                                <Ionicons
                                  name="flask-outline"
                                  size={12}
                                  color={Palette.primary}
                                />
                                <Text style={styles.sharedContextChipText}>
                                  Lab Reports
                                </Text>
                              </View>
                            )}
                            {referral.sharedContext.includeVitals && (
                              <View style={styles.sharedContextChip}>
                                <Ionicons
                                  name="pulse-outline"
                                  size={12}
                                  color={Palette.primary}
                                />
                                <Text style={styles.sharedContextChipText}>
                                  Vitals
                                </Text>
                              </View>
                            )}
                            {referral.sharedContext.includeFollowUpPlan && (
                              <View style={styles.sharedContextChip}>
                                <Ionicons
                                  name="calendar-outline"
                                  size={12}
                                  color={Palette.primary}
                                />
                                <Text style={styles.sharedContextChipText}>
                                  Follow-Up Plan
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Appointment Linkage Notice */}
                      {referral.linkedAppointmentId ? (
                        <View style={styles.handoverAuthBanner}>
                          <Ionicons
                            name="link"
                            size={16}
                            color={Palette.success}
                          />
                          <Text style={styles.handoverAuthText}>
                            Specialist Appointment Linked & Booked
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.handoverAuthBanner}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={Palette.warning}
                          />
                          <Text style={styles.handoverAuthText}>
                            Awaiting Patient Specialist Booking
                          </Text>
                        </View>
                      )}
                    </Card>
                  );
                })
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
                  {medEditingIndex !== null
                    ? "Edit Medication"
                    : "Add Medication"}
                </Text>
                <Pressable
                  onPress={() => setShowMedModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
              >
                <Text style={styles.inputLabel}>Medicine Name *</Text>
                <TextInput
                  value={medName}
                  onChangeText={setMedName}
                  placeholder="e.g. Paracetamol 650mg"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                {/* Quick medicine suggestion chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.quickChipScroll}
                >
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
                      style={[
                        styles.quickSelectPill,
                        medFrequency === freq && styles.quickSelectPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          medFrequency === freq &&
                            styles.quickSelectPillTextActive,
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
                      style={[
                        styles.quickSelectPill,
                        medDuration === dur && styles.quickSelectPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          medDuration === dur &&
                            styles.quickSelectPillTextActive,
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
                      style={[
                        styles.quickSelectPill,
                        medTiming === tm && styles.quickSelectPillActive,
                      ]}
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
                  title={
                    medEditingIndex !== null ? "Save Changes" : "Add to Rx"
                  }
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
                <Pressable
                  onPress={() => setShowAddReportModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <View style={{ paddingVertical: Spacing.sm }}>
                <Text style={styles.inputLabel}>
                  Report Name / Investigation *
                </Text>
                <TextInput
                  value={reportTitle}
                  onChangeText={setReportTitle}
                  placeholder="e.g. Ultrasound Abdomen / Blood Report"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Category
                </Text>
                <TextInput
                  value={reportCategory}
                  onChangeText={setReportCategory}
                  placeholder="Prescription / Lab Order / Radiology"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Notes / Remarks
                </Text>
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
                  title={
                    uploadingReport ? "Uploading..." : "Select File & Upload"
                  }
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
                  <Ionicons
                    name="checkmark-done-circle"
                    size={28}
                    color={Palette.success}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Finalize Consultation</Text>
                  <Text style={styles.modalSubtitle}>
                    Review clinical summary before committing
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowFinalizeModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.finalizeSummaryScroll}
              >
                <View style={styles.finalizeSummaryCard}>
                  <Text style={styles.finalizeItemLabel}>
                    Primary Diagnosis:
                  </Text>
                  <Text style={styles.finalizeItemVal}>
                    {diagnosis || assessment || "Not specified"}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>
                    Prescribed Medicines:
                  </Text>
                  <Text style={styles.finalizeItemVal}>
                    {medicines.length > 0
                      ? `${medicines.length} medicine(s) prescribed`
                      : "None"}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>Follow-Up:</Text>
                  <Text style={styles.finalizeItemVal}>
                    {followUpRequired
                      ? `Recommended in ${followUpTimeframe}`
                      : "No follow-up required"}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>Vitals Recorded:</Text>
                  <Text style={styles.finalizeItemVal}>
                    {bloodPressure ? `BP: ${bloodPressure}` : ""}
                    {heartRate ? ` · HR: ${heartRate} bpm` : ""}
                    {bmiInfo.bmi ? ` · BMI: ${bmiInfo.bmi}` : ""}
                    {!bloodPressure && !heartRate && !bmiInfo.bmi
                      ? "No vitals entered"
                      : ""}
                  </Text>

                  <View style={styles.finalizeDivider} />

                  <Text style={styles.finalizeItemLabel}>
                    Clinical Authorizations:
                  </Text>
                  <Text style={styles.finalizeItemVal}>
                    {clinicalAuthorizations.length === 0
                      ? "Standard Visit Consent"
                      : `${clinicalAuthorizations.filter((a) => a.status === "approved").length}/${clinicalAuthorizations.length} Authorized by Patient`}
                  </Text>
                </View>

                <View style={styles.finalizeNoticeBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={Palette.warning}
                  />
                  <Text style={styles.finalizeNoticeText}>
                    Finalizing locks this clinical consultation. The
                    prescription, clinical notes, and follow-up advice will
                    immediately synchronize with the patient's Digital Health
                    Wallet and Care Timeline.
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

        {/* REQUEST PATIENT CONSENT MODAL */}
        <Modal
          visible={showConsentReqModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConsentReqModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons
                  name="shield-checkmark"
                  size={22}
                  color={Palette.primary}
                />
                <Text style={styles.modalTitle}>Request Patient Consent</Text>
                <Pressable
                  onPress={() => setShowConsentReqModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Send a real-time consent request to {patientName}'s mobile app
                to view full historical records, past lab tests, and health
                wallet documents.
              </Text>

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                Clinical Justification / Reason
              </Text>
              <TextInput
                value={consentReqPurpose}
                onChangeText={setConsentReqPurpose}
                placeholder="e.g. Detailed history review for chronic condition"
                placeholderTextColor={Palette.textMuted}
                style={styles.singleLineInput}
              />

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowConsentReqModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Send Request"
                  variant="primary"
                  loading={sendingConsentReq}
                  onPress={handleSendConsentRequest}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* EMERGENCY BREAK-GLASS OVERRIDE MODAL */}
        <Modal
          visible={showBreakGlassModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBreakGlassModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { borderTopWidth: 4, borderTopColor: Palette.error },
              ]}
            >
              <View style={styles.modalHeader}>
                <Ionicons name="alert-circle" size={24} color={Palette.error} />
                <Text style={[styles.modalTitle, { color: Palette.error }]}>
                  Emergency Break-Glass
                </Text>
                <Pressable
                  onPress={() => setShowBreakGlassModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <View style={styles.emergencyWarningBox}>
                <Text style={styles.emergencyWarningText}>
                  EMERGENCY CLINICAL OVERRIDE: This action bypasses patient
                  consent for urgent clinical stabilization. Every document
                  viewed will be cryptographically audited and reported to the
                  patient and hospital governance.
                </Text>
              </View>

              <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                Mandatory Clinical Justification (min 8 chars)*
              </Text>
              <TextInput
                value={breakGlassReason}
                onChangeText={setBreakGlassReason}
                placeholder="e.g. Acute trauma stabilization, patient unresponsive, urgent vitals review"
                placeholderTextColor={Palette.textMuted}
                multiline
                style={[styles.multiLineInput, { height: 80 }]}
              />

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowBreakGlassModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Confirm Override"
                  variant="danger"
                  loading={submittingBreakGlass}
                  onPress={handleConfirmBreakGlass}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* REQUEST CLINICAL TREATMENT AUTHORIZATION MODAL */}
        <Modal
          visible={showClinicalAuthModal}
          transparent
          animationType="fade"
          onRequestClose={() =>
            !submittingClinicalAuth && setShowClinicalAuthModal(false)
          }
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <Ionicons
                  name="clipboard-outline"
                  size={24}
                  color={Palette.primary}
                />
                <Text style={styles.modalTitle}>
                  Request Clinical Authorization
                </Text>
                <Pressable
                  onPress={() => setShowClinicalAuthModal(false)}
                  style={styles.modalCloseBtn}
                  disabled={submittingClinicalAuth}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalSubtitle}>
                  Request structured clinical acknowledgement or treatment
                  authorization from the patient for this visit.
                </Text>

                {/* Authorization Type Selection */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Authorization Type *
                </Text>
                <View style={styles.authTypeOptionList}>
                  {(
                    [
                      {
                        key: "treatment_care_plan_acknowledgement",
                        label: "Treatment & Care Plan Acknowledgement",
                        desc: "Explicit consent for therapy regimen and care plan",
                      },
                      {
                        key: "online_consultation_acknowledgement",
                        label: "Telehealth & Virtual Care Consent",
                        desc: "Teleconsultation modality acknowledgement",
                      },
                      {
                        key: "consultation_acknowledgement",
                        label: "In-Clinic Care Discussion Acknowledgement",
                        desc: "Clinical options discussion acknowledgement",
                      },
                      {
                        key: "document_review_authorization",
                        label: "Health Document Review Authorization",
                        desc: "Consent to evaluate past external health records",
                      },
                      {
                        key: "follow_up_care_acknowledgement",
                        label: "Follow-Up & Warning Signs Acknowledgement",
                        desc: "Red-flag signs & return visit schedule",
                      },
                    ] as const
                  ).map((item) => {
                    const isSelected = clinicalAuthType === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setClinicalAuthType(item.key)}
                        style={[
                          styles.authTypeOptionCard,
                          isSelected && styles.authTypeOptionCardActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            isSelected ? "radio-button-on" : "radio-button-off"
                          }
                          size={18}
                          color={
                            isSelected ? Palette.primary : Palette.textMuted
                          }
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.authTypeOptionTitle,
                              isSelected && styles.authTypeOptionTitleActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text style={styles.authTypeOptionDesc}>
                            {item.desc}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Title */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Title / Subject *
                </Text>
                <TextInput
                  value={clinicalAuthTitle}
                  onChangeText={setClinicalAuthTitle}
                  placeholder="e.g. Care Plan Acknowledgement for Hypertension Regimen"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                {/* Summary */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Clinical Summary & Regimen Details
                </Text>
                <TextInput
                  value={clinicalAuthSummary}
                  onChangeText={setClinicalAuthSummary}
                  placeholder="e.g. Discussed medication adjustments, lifestyle guidance, and monitoring schedule."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={[styles.multiLineInput, { height: 70 }]}
                />

                {/* Notes / Action Required */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Instructions or Action Required
                </Text>
                <TextInput
                  value={clinicalAuthNotes}
                  onChangeText={setClinicalAuthNotes}
                  placeholder="e.g. Review instructions, sign acknowledgement, report adverse effects immediately."
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowClinicalAuthModal(false)}
                  disabled={submittingClinicalAuth}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title="Send Request"
                  variant="primary"
                  loading={submittingClinicalAuth}
                  onPress={handleRequestClinicalAuth}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: INITIATE CLINICAL HANDOVER */}
        <Modal
          visible={showHandoverModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHandoverModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.finalizeIconBox,
                    { backgroundColor: Palette.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={24}
                    color={Palette.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    Initiate Clinical Handover
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Structured care continuity & transfer of responsibility
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowHandoverModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
              >
                {/* Handover Type Selection */}
                <Text style={styles.inputLabel}>Handover Type *</Text>
                <View style={styles.handoverTypeRow}>
                  <Pressable
                    onPress={() => setHandoverType("doctor_to_doctor_handover")}
                    style={[
                      styles.handoverTypePill,
                      handoverType === "doctor_to_doctor_handover" &&
                        styles.handoverTypePillActive,
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={14}
                      color={
                        handoverType === "doctor_to_doctor_handover"
                          ? "#FFF"
                          : Palette.text
                      }
                    />
                    <Text
                      style={[
                        styles.handoverTypePillText,
                        handoverType === "doctor_to_doctor_handover" &&
                          styles.handoverTypePillTextActive,
                      ]}
                    >
                      Doctor to Doctor
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setHandoverType("department_handover")}
                    style={[
                      styles.handoverTypePill,
                      handoverType === "department_handover" &&
                        styles.handoverTypePillActive,
                    ]}
                  >
                    <Ionicons
                      name="business"
                      size={14}
                      color={
                        handoverType === "department_handover"
                          ? "#FFF"
                          : Palette.text
                      }
                    />
                    <Text
                      style={[
                        styles.handoverTypePillText,
                        handoverType === "department_handover" &&
                          styles.handoverTypePillTextActive,
                      ]}
                    >
                      Department
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setHandoverType("follow_up_handover")}
                    style={[
                      styles.handoverTypePill,
                      handoverType === "follow_up_handover" &&
                        styles.handoverTypePillActive,
                    ]}
                  >
                    <Ionicons
                      name="repeat"
                      size={14}
                      color={
                        handoverType === "follow_up_handover"
                          ? "#FFF"
                          : Palette.text
                      }
                    />
                    <Text
                      style={[
                        styles.handoverTypePillText,
                        handoverType === "follow_up_handover" &&
                          styles.handoverTypePillTextActive,
                      ]}
                    >
                      Follow-Up
                    </Text>
                  </Pressable>
                </View>

                {/* Priority Selection */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Priority *
                </Text>
                <View style={styles.quickSelectRow}>
                  {(
                    ["routine", "urgent", "critical"] as HandoverPriority[]
                  ).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setHandoverPriority(p)}
                      style={[
                        styles.quickSelectPill,
                        handoverPriority === p && styles.quickSelectPillActive,
                        handoverPriority === p &&
                          p === "critical" && {
                            backgroundColor: Palette.error,
                          },
                        handoverPriority === p &&
                          p === "urgent" && {
                            backgroundColor: Palette.warning,
                          },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickSelectPillText,
                          handoverPriority === p &&
                            styles.quickSelectPillTextActive,
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Destination Inputs */}
                {handoverType === "doctor_to_doctor_handover" ? (
                  <>
                    <Text
                      style={[styles.inputLabel, { marginTop: Spacing.sm }]}
                    >
                      Recipient Doctor ID *
                    </Text>
                    <TextInput
                      value={targetDoctorId}
                      onChangeText={setTargetDoctorId}
                      placeholder="Enter Doctor's MongoDB ID"
                      placeholderTextColor={Palette.textMuted}
                      style={styles.singleLineInput}
                    />
                  </>
                ) : (
                  <>
                    <Text
                      style={[styles.inputLabel, { marginTop: Spacing.sm }]}
                    >
                      Target Department *
                    </Text>
                    <TextInput
                      value={targetDepartment}
                      onChangeText={setTargetDepartment}
                      placeholder="e.g. Cardiology, Neurology, Orthopedics"
                      placeholderTextColor={Palette.textMuted}
                      style={styles.singleLineInput}
                    />
                  </>
                )}

                {/* Clinical Reason */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Clinical Reason for Handover *
                </Text>
                <TextInput
                  value={handoverReason}
                  onChangeText={setHandoverReason}
                  placeholder="e.g. Specialized cardiac evaluation required for unstable symptoms"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                {/* Clinical Summary */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>
                  Clinical Summary *
                </Text>
                <TextInput
                  value={handoverSummary}
                  onChangeText={setHandoverSummary}
                  placeholder="Summarize key findings, current symptoms, and primary concern..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  numberOfLines={3}
                  style={styles.multiLineInput}
                />

                {/* Selective Context Sharing Checkboxes */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Select Clinical Data to Transfer
                </Text>
                <View style={styles.contextCheckboxGrid}>
                  <Pressable
                    onPress={() => setIncludeNotes(!includeNotes)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={includeNotes ? "checkbox" : "square-outline"}
                      size={20}
                      color={includeNotes ? Palette.primary : Palette.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>
                      Consultation Notes & Diagnosis
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIncludeRx(!includeRx)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={includeRx ? "checkbox" : "square-outline"}
                      size={20}
                      color={includeRx ? Palette.primary : Palette.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>
                      Prescribed Medications ({medicines.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIncludeReports(!includeReports)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={includeReports ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        includeReports ? Palette.primary : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Medical Reports & Lab Data
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIncludeVitals(!includeVitals)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={includeVitals ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        includeVitals ? Palette.primary : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Recorded Vitals & BMI
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIncludeFollowUp(!includeFollowUp)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={includeFollowUp ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        includeFollowUp ? Palette.primary : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Follow-Up Schedule & Instructions
                    </Text>
                  </Pressable>
                </View>

                {/* Pending Actions Builder */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Action Items for Receiving Clinician
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: Spacing.xs,
                    alignItems: "center",
                  }}
                >
                  <TextInput
                    value={pendingActionInput}
                    onChangeText={setPendingActionInput}
                    placeholder="e.g. Schedule Echo test within 48 hours"
                    placeholderTextColor={Palette.textMuted}
                    style={[styles.singleLineInput, { flex: 1 }]}
                  />
                  <Button
                    title="Add"
                    variant="outline"
                    onPress={() => {
                      if (!pendingActionInput.trim()) return;
                      setPendingActionsList((prev) => [
                        ...prev,
                        { description: pendingActionInput.trim() },
                      ]);
                      setPendingActionInput("");
                    }}
                  />
                </View>

                {pendingActionsList.length > 0 && (
                  <View style={{ marginTop: Spacing.xs, gap: 4 }}>
                    {pendingActionsList.map((item, idx) => (
                      <View key={idx} style={styles.pendingActionChipRow}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={16}
                          color={Palette.primary}
                        />
                        <Text style={[styles.handoverActionText, { flex: 1 }]}>
                          {item.description}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setPendingActionsList((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={Palette.error}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Require Patient Authorization Toggle */}
                <Pressable
                  onPress={() => setRequiresPatientAuth(!requiresPatientAuth)}
                  style={[
                    styles.checkboxRow,
                    { marginTop: Spacing.md, paddingVertical: Spacing.xs },
                  ]}
                >
                  <Ionicons
                    name={requiresPatientAuth ? "checkbox" : "square-outline"}
                    size={20}
                    color={
                      requiresPatientAuth ? Palette.accent : Palette.textMuted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkboxLabel}>
                      Require Patient Authorization
                    </Text>
                    <Text style={[styles.cardSub, { fontSize: 11 }]}>
                      Patient will be notified to explicitly authorize transfer
                      before clinical data access is unlocked.
                    </Text>
                  </View>
                </Pressable>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowHandoverModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={
                    submittingHandover ? "Initiating..." : "Initiate Handover"
                  }
                  variant="primary"
                  loading={submittingHandover}
                  onPress={handleSubmitHandover}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: HANDOVER ACTION (ACCEPT / DECLINE / COMPLETE / CANCEL) */}
        <Modal
          visible={Boolean(actionModalType)}
          transparent
          animationType="fade"
          onRequestClose={() => setActionModalType(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {actionModalType === "accept"
                    ? "Accept Clinical Care Handover"
                    : actionModalType === "decline"
                      ? "Decline Clinical Handover"
                      : actionModalType === "complete"
                        ? "Complete Handover Follow-Up"
                        : "Cancel Handover Transfer"}
                </Text>
                <Pressable
                  onPress={() => setActionModalType(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                {actionModalType === "accept"
                  ? "Enter optional acceptance notes for the originating clinician."
                  : actionModalType === "decline"
                    ? "Provide clinical justification for declining this care transfer (Required)."
                    : actionModalType === "complete"
                      ? "Summarize care continuity outcome and finalized observations."
                      : "State reason for cancelling this care transfer."}
              </Text>

              <TextInput
                value={actionNoteInput}
                onChangeText={setActionNoteInput}
                placeholder={
                  actionModalType === "decline"
                    ? "Clinical reason for declining..."
                    : "Notes / observations..."
                }
                placeholderTextColor={Palette.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.multiLineInput, { marginTop: Spacing.md }]}
              />

              <View style={[styles.modalFooter, { marginTop: Spacing.lg }]}>
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setActionModalType(null)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={processingHandoverAction ? "Processing..." : "Confirm"}
                  variant={
                    actionModalType === "decline" ||
                    actionModalType === "cancel"
                      ? "outline"
                      : "primary"
                  }
                  loading={processingHandoverAction}
                  onPress={handleExecuteHandoverAction}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: CREATE SPECIALIST REFERRAL */}
        <Modal
          visible={showReferralModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowReferralModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    Create Specialist Referral
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Route patient to hospital specialist with continuous
                    clinical records
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowReferralModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* 0. Referral Destination Toggle */}
                <Text style={styles.inputLabel}>Referral Destination</Text>
                <View style={styles.handoverTypeRow}>
                  <Pressable
                    onPress={() => {
                      setReferralDestination("within_hospital");
                      setSelectedNetworkHospitalId("");
                    }}
                    style={[
                      styles.handoverTypePill,
                      referralDestination === "within_hospital" &&
                        styles.handoverTypePillActive,
                    ]}
                  >
                    <Ionicons
                      name="business"
                      size={14}
                      color={
                        referralDestination === "within_hospital"
                          ? "#FFF"
                          : Palette.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.handoverTypePillText,
                        referralDestination === "within_hospital" &&
                          styles.handoverTypePillTextActive,
                      ]}
                    >
                      Within Hospital
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setReferralDestination("hospital_network");
                      if (networkHospitals.length === 0) {
                        void fetchNetworkHospitals();
                      }
                    }}
                    style={[
                      styles.handoverTypePill,
                      referralDestination === "hospital_network" &&
                        styles.handoverTypePillActive,
                    ]}
                  >
                    <Ionicons
                      name="git-network"
                      size={14}
                      color={
                        referralDestination === "hospital_network"
                          ? "#FFF"
                          : Palette.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.handoverTypePillText,
                        referralDestination === "hospital_network" &&
                          styles.handoverTypePillTextActive,
                      ]}
                    >
                      Hospital Network Exchange
                    </Text>
                  </Pressable>
                </View>

                {/* Network Hospital Picker (visible when hospital_network selected) */}
                {referralDestination === "hospital_network" ? (
                  <View style={{ marginBottom: Spacing.sm }}>
                    <Text
                      style={[styles.inputLabel, { marginTop: Spacing.sm }]}
                    >
                      Select Receiving Hospital *
                    </Text>
                    {loadingNetworkHospitals ? (
                      <View
                        style={{
                          paddingVertical: Spacing.md,
                          alignItems: "center",
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={Palette.primary}
                        />
                        <Text style={[styles.cardSub, { marginTop: 4 }]}>
                          Loading partner hospitals...
                        </Text>
                      </View>
                    ) : networkHospitals.length === 0 ? (
                      <View
                        style={{
                          padding: Spacing.sm,
                          borderRadius: Spacing.xs,
                          backgroundColor: Palette.surfaceAlt,
                        }}
                      >
                        <Text
                          style={[styles.cardSub, { color: Palette.textMuted }]}
                        >
                          No verified partner hospitals found in the network.
                          Contact your Hospital Administrator.
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{ gap: Spacing.xs, marginVertical: Spacing.xs }}
                      >
                        {networkHospitals.map((hosp) => {
                          const isSel = selectedNetworkHospitalId === hosp._id;
                          return (
                            <Pressable
                              key={hosp._id}
                              onPress={() =>
                                setSelectedNetworkHospitalId(hosp._id)
                              }
                              style={[
                                styles.authTypeOptionCard,
                                isSel && styles.authTypeOptionCardActive,
                              ]}
                            >
                              <Ionicons
                                name={
                                  isSel ? "radio-button-on" : "radio-button-off"
                                }
                                size={18}
                                color={
                                  isSel ? Palette.primary : Palette.textMuted
                                }
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.authTypeOptionTitle,
                                    isSel && styles.authTypeOptionTitleActive,
                                  ]}
                                >
                                  {hosp.name}
                                </Text>
                                <Text style={styles.authTypeOptionDesc}>
                                  {hosp.address ||
                                    "Verified Healthcare Facility"}
                                  {hosp.totalDoctors
                                    ? ` · ${hosp.totalDoctors} doctors`
                                    : ""}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={13}
                        color={Palette.warning}
                      />
                      <Text
                        style={[
                          styles.cardSub,
                          { color: Palette.warning, fontSize: 11 },
                        ]}
                      >
                        Patient will receive a consent request to authorize
                        inter-hospital clinical data exchange.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* 1. Urgency Selector */}
                <Text style={styles.inputLabel}>
                  Referral Priority / Urgency
                </Text>
                <View style={styles.handoverTypeRow}>
                  {(
                    [
                      {
                        key: "routine",
                        label: "Routine",
                        icon: "checkmark-circle",
                      },
                      { key: "urgent", label: "Urgent", icon: "alert-circle" },
                      {
                        key: "stat_emergency",
                        label: "Stat / Emergency",
                        icon: "warning",
                      },
                    ] as const
                  ).map((item) => {
                    const isSelected = referralUrgency === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setReferralUrgency(item.key)}
                        style={[
                          styles.handoverTypePill,
                          isSelected && styles.handoverTypePillActive,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={14}
                          color={isSelected ? "#FFF" : Palette.textMuted}
                        />
                        <Text
                          style={[
                            styles.handoverTypePillText,
                            isSelected && styles.handoverTypePillTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* 2. Destination Department */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Destination Department
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.quickChipScroll}
                >
                  {[
                    "General Medicine",
                    "Cardiology",
                    "Neurology",
                    "Orthopedics",
                    "Pediatrics",
                    "Dermatology",
                    "ENT",
                    "Gynecology",
                    "Oncology",
                    "Psychiatry",
                  ].map((dept) => {
                    const isSelected = referralDepartment === dept;
                    return (
                      <Pressable
                        key={dept}
                        onPress={() => {
                          setReferralDepartment(dept);
                          void fetchSpecialistCatalog(dept);
                        }}
                        style={[
                          styles.quickChip,
                          isSelected && {
                            backgroundColor: Palette.accent,
                            borderColor: Palette.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            isSelected && { color: "#FFF", fontWeight: "700" },
                          ]}
                        >
                          {dept}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* 3. Specialist Routing - Select Specialist Doctor in Hospital */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Select Specialist (Routing Queue)
                </Text>
                {loadingSpecialists ? (
                  <View
                    style={{
                      paddingVertical: Spacing.md,
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator size="small" color={Palette.primary} />
                    <Text style={[styles.cardSub, { marginTop: 4 }]}>
                      Loading active hospital specialists...
                    </Text>
                  </View>
                ) : referralSpecialists.length === 0 ? (
                  <View
                    style={{
                      padding: Spacing.sm,
                      borderRadius: Radius.sm,
                      backgroundColor: Palette.surfaceAlt,
                      marginVertical: Spacing.xs,
                    }}
                  >
                    <Text
                      style={[styles.cardSub, { color: Palette.textMuted }]}
                    >
                      No active specialists listed under {referralDepartment}.
                      Referral will route to the Department Pool.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.xs, marginVertical: Spacing.xs }}>
                    {referralSpecialists.map((doc) => {
                      const isSelected = referralTargetDoctorId === doc._id;
                      return (
                        <Pressable
                          key={doc._id}
                          onPress={() => {
                            setReferralTargetDoctorId(doc._id);
                            setReferralTargetDoctorName(doc.name);
                          }}
                          style={[
                            styles.authTypeOptionCard,
                            isSelected && styles.authTypeOptionCardActive,
                          ]}
                        >
                          <Ionicons
                            name={
                              isSelected
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={18}
                            color={
                              isSelected ? Palette.primary : Palette.textMuted
                            }
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.authTypeOptionTitle,
                                isSelected && styles.authTypeOptionTitleActive,
                              ]}
                            >
                              Dr. {doc.name}
                            </Text>
                            <Text style={styles.authTypeOptionDesc}>
                              {doc.speciality || doc.department || "Specialist"}{" "}
                              {doc.fees ? `· ₹${doc.fees}` : ""}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* 4. Reason / Clinical Indication */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Clinical Indication / Reason for Referral *
                </Text>
                <TextInput
                  value={referralReason}
                  onChangeText={setReferralReason}
                  placeholder="e.g. Persistent arrhythmia with abnormal ECG, requires Echo evaluation"
                  placeholderTextColor={Palette.textMuted}
                  style={styles.singleLineInput}
                />

                {/* 5. Clinical Summary */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Clinical Summary & Context
                </Text>
                <TextInput
                  value={referralSummary}
                  onChangeText={setReferralSummary}
                  placeholder="Summarize key findings, current regimen, and consultation observations..."
                  placeholderTextColor={Palette.textMuted}
                  multiline
                  style={[styles.multiLineInput, { height: 75 }]}
                />

                {/* 6. Granular Shared Records */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.md }]}>
                  Shared Clinical Data with Specialist
                </Text>
                <View style={styles.contextCheckboxGrid}>
                  <Pressable
                    onPress={() =>
                      setReferralIncludeNotes(!referralIncludeNotes)
                    }
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={
                        referralIncludeNotes ? "checkbox" : "square-outline"
                      }
                      size={20}
                      color={
                        referralIncludeNotes
                          ? Palette.primary
                          : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Consultation Notes & Working Diagnosis
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setReferralIncludeRx(!referralIncludeRx)}
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={referralIncludeRx ? "checkbox" : "square-outline"}
                      size={20}
                      color={
                        referralIncludeRx ? Palette.primary : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Current Medications & Prescriptions ({medicines.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setReferralIncludeReports(!referralIncludeReports)
                    }
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={
                        referralIncludeReports ? "checkbox" : "square-outline"
                      }
                      size={20}
                      color={
                        referralIncludeReports
                          ? Palette.primary
                          : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Diagnostic Reports & Lab Results
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setReferralIncludeVitals(!referralIncludeVitals)
                    }
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={
                        referralIncludeVitals ? "checkbox" : "square-outline"
                      }
                      size={20}
                      color={
                        referralIncludeVitals
                          ? Palette.primary
                          : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Recorded Vitals & BMI
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setReferralIncludeFollowUp(!referralIncludeFollowUp)
                    }
                    style={styles.checkboxRow}
                  >
                    <Ionicons
                      name={
                        referralIncludeFollowUp ? "checkbox" : "square-outline"
                      }
                      size={20}
                      color={
                        referralIncludeFollowUp
                          ? Palette.primary
                          : Palette.textMuted
                      }
                    />
                    <Text style={styles.checkboxLabel}>
                      Follow-up Schedule & Plan
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowReferralModal(false)}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
                <Button
                  title={submittingReferral ? "Routing..." : "Submit Referral"}
                  variant="primary"
                  loading={submittingReferral}
                  onPress={handleCreateReferral}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: DOCTOR DOCUMENT INTELLIGENCE & OCR INSPECTION */}
        <Modal
          visible={!!selectedReportForOcr}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedReportForOcr(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { maxHeight: "90%", width: "94%" }]}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedReportForOcr?.name || "Clinical Document"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedReportForOcr?.category || "Medical Investigation"}{" "}
                    • Automated Entity Extraction
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedReportForOcr(null)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={22} color={Palette.text} />
                </Pressable>
              </View>

              {/* Strict Non-Diagnostic Clinical Safety Callout */}
              <View style={styles.doctorOcrNoticeBanner}>
                <Ionicons name="shield-checkmark" size={16} color="#0F766E" />
                <Text style={styles.doctorOcrNoticeText}>
                  Factual entity extraction for clinical reference only. No
                  automatic diagnosis or treatment generated. Consult original
                  report for clinical validation.
                </Text>
              </View>

              {/* Tab Switcher */}
              <View style={styles.doctorOcrTabsRow}>
                <Pressable
                  onPress={() => setDocOcrTab("summary")}
                  style={[
                    styles.doctorOcrTabBtn,
                    docOcrTab === "summary" && styles.doctorOcrTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.doctorOcrTabBtnText,
                      docOcrTab === "summary" &&
                        styles.doctorOcrTabBtnTextActive,
                    ]}
                  >
                    Doctor Summary
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDocOcrTab("entities")}
                  style={[
                    styles.doctorOcrTabBtn,
                    docOcrTab === "entities" && styles.doctorOcrTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.doctorOcrTabBtnText,
                      docOcrTab === "entities" &&
                        styles.doctorOcrTabBtnTextActive,
                    ]}
                  >
                    Entities & Lab Data
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDocOcrTab("text")}
                  style={[
                    styles.doctorOcrTabBtn,
                    docOcrTab === "text" && styles.doctorOcrTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.doctorOcrTabBtnText,
                      docOcrTab === "text" && styles.doctorOcrTabBtnTextActive,
                    ]}
                  >
                    Raw Text
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 340, marginVertical: Spacing.sm }}
              >
                {docOcrTab === "summary" && (
                  <View style={styles.doctorOcrContentBox}>
                    {loadingDocSummary ? (
                      <View
                        style={{ padding: Spacing.md, alignItems: "center" }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={Palette.primary}
                        />
                        <Text style={[styles.cardSub, { marginTop: 6 }]}>
                          Generating factual summary...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.doctorSummaryBody} selectable>
                        {docDoctorSummary ||
                          selectedReportForOcr?.doctorSummary ||
                          `DOCUMENT: ${selectedReportForOcr?.name || "Medical Report"}\nCATEGORY: ${selectedReportForOcr?.category || "Diagnostic"}\nATTACHED: ${selectedReportForOcr?.uploadedAt ? new Date(selectedReportForOcr.uploadedAt).toLocaleDateString() : "Recent"}\nNOTES: ${selectedReportForOcr?.notes || "No physician observations annotated."}\n\n[Original file available in full resolution below.]`}
                      </Text>
                    )}
                  </View>
                )}

                {docOcrTab === "entities" && (
                  <View style={styles.doctorOcrContentBox}>
                    <View style={styles.ocrFieldRow}>
                      <Text style={styles.ocrFieldKey}>Facility / Lab</Text>
                      <Text style={styles.ocrFieldVal}>
                        {selectedReportForOcr?.extractedMetadata
                          ?.hospitalName || "Not explicitly detected"}
                      </Text>
                    </View>
                    <View style={styles.ocrFieldRow}>
                      <Text style={styles.ocrFieldKey}>Signing Doctor</Text>
                      <Text style={styles.ocrFieldVal}>
                        {selectedReportForOcr?.extractedMetadata?.doctorName ||
                          "Not explicitly detected"}
                      </Text>
                    </View>
                    <View style={styles.ocrFieldRow}>
                      <Text style={styles.ocrFieldKey}>Document Date</Text>
                      <Text style={styles.ocrFieldVal}>
                        {selectedReportForOcr?.extractedMetadata
                          ?.documentDate ||
                          (selectedReportForOcr?.uploadedAt
                            ? new Date(
                                selectedReportForOcr.uploadedAt,
                              ).toLocaleDateString()
                            : "N/A")}
                      </Text>
                    </View>
                    <View style={styles.ocrFieldRow}>
                      <Text style={styles.ocrFieldKey}>Reference / Lab ID</Text>
                      <Text
                        style={[
                          styles.ocrFieldVal,
                          { fontFamily: "monospace" },
                        ]}
                      >
                        {selectedReportForOcr?.extractedMetadata
                          ?.referenceNumber || "N/A"}
                      </Text>
                    </View>

                    {/* Test Results */}
                    {selectedReportForOcr?.extractedMetadata?.testResults
                      ?.length ? (
                      <View style={{ marginTop: Spacing.sm }}>
                        <Text style={[styles.inputLabel, { marginBottom: 6 }]}>
                          Detected Lab Values
                        </Text>
                        {selectedReportForOcr.extractedMetadata.testResults.map(
                          (t: any, i: number) => (
                            <View key={i} style={styles.doctorLabItemRow}>
                              <Text style={styles.doctorLabItemName}>
                                {t.testName}
                              </Text>
                              <Text style={styles.doctorLabItemValue}>
                                {t.value} {t.unit || ""}{" "}
                                {t.referenceRange
                                  ? `(Ref: ${t.referenceRange})`
                                  : ""}
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    ) : null}
                  </View>
                )}

                {docOcrTab === "text" && (
                  <View style={styles.doctorOcrContentBox}>
                    <Text style={styles.doctorOcrRawText} selectable>
                      {selectedReportForOcr?.extractedText ||
                        "Raw OCR stream text is available once document intelligence finishes indexing."}
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                {selectedReportForOcr?.url ? (
                  <Button
                    title="Open Original Document"
                    variant="primary"
                    icon="open-outline"
                    onPress={() => {
                      if (selectedReportForOcr?.url)
                        void Linking.openURL(selectedReportForOcr.url);
                    }}
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                ) : null}
                <Button
                  title="Close"
                  variant="outline"
                  onPress={() => setSelectedReportForOcr(null)}
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
  consentBannerRestricted: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.warning,
    backgroundColor: "rgba(234, 179, 8, 0.05)",
  },
  consentBannerAuthorized: {
    borderLeftWidth: 4,
    borderLeftColor: Palette.success,
    backgroundColor: "rgba(16, 185, 129, 0.04)",
  },
  consentBannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  consentBannerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  consentBannerTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  consentBannerDescription: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  consentBannerActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emergencyWarningBox: {
    backgroundColor: "#FEE2E2",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.xs,
  },
  emergencyWarningText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
    fontWeight: "600",
    lineHeight: 16,
  },
  emptyAuthBox: {
    backgroundColor: Palette.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  emptyAuthText: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  docAuthItemCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 4,
  },
  docAuthHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  docAuthTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.text,
  },
  docAuthType: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  docAuthSummary: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  docAuthMetaSuccess: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.success,
    fontWeight: "500",
  },
  docAuthMetaDeclined: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
    fontWeight: "500",
  },
  authTypeOptionList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  authTypeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  authTypeOptionCardActive: {
    borderColor: Palette.primary,
    backgroundColor: Palette.primaryLight,
  },
  authTypeOptionTitle: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
  },
  authTypeOptionTitleActive: {
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  authTypeOptionDesc: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  handoverActionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  handoverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  handoverDisplayId: {
    ...Typography.label,
    fontSize: 13,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  handoverTypeText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    marginTop: 2,
  },
  handoverRoutingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  handoverRoleLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  handoverRoleValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  handoverSectionBlock: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  handoverBlockLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: 2,
  },
  handoverBlockValue: {
    ...Typography.bodySmall,
    color: Palette.text,
    lineHeight: 18,
  },
  sharedContextChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  sharedContextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  sharedContextChipText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.text,
    fontWeight: "500",
  },
  handoverActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  handoverActionText: {
    ...Typography.bodySmall,
    fontSize: 12,
    color: Palette.text,
  },
  handoverAuthBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    marginTop: Spacing.xs,
  },
  handoverAuthText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.text,
  },
  handoverBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  handoverTypeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: Spacing.xs,
  },
  handoverTypePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  handoverTypePillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  handoverTypePillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: Palette.text,
  },
  handoverTypePillTextActive: {
    color: "#FFFFFF",
  },
  contextCheckboxGrid: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  checkboxLabel: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: Palette.text,
  },
  pendingActionChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.surfaceAlt,
    padding: 8,
    borderRadius: Radius.sm,
  },
  // Doctor Document Intelligence & OCR Styles
  doctorOcrNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDFA",
    borderLeftWidth: 3,
    borderLeftColor: "#0D9488",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  doctorOcrNoticeText: {
    ...Typography.caption,
    fontSize: 11,
    color: "#115E59",
    flex: 1,
  },
  doctorOcrTabsRow: {
    flexDirection: "row",
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  doctorOcrTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  doctorOcrTabBtnActive: {
    backgroundColor: Palette.surface,
  },
  doctorOcrTabBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  doctorOcrTabBtnTextActive: {
    color: Palette.primary,
  },
  doctorOcrContentBox: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  doctorSummaryBody: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: Palette.text,
    fontFamily: "monospace",
  },
  ocrFieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  ocrFieldKey: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  ocrFieldVal: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
    textAlign: "right",
    flexShrink: 1,
  },
  doctorLabItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    backgroundColor: Palette.surface,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginBottom: 4,
  },
  doctorLabItemName: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.text,
  },
  doctorLabItemValue: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  doctorOcrRawText: {
    fontFamily: "monospace",
    fontSize: 11,
    color: Palette.text,
    lineHeight: 16,
  },
});
