/**
 * HealPoint — Digital Health Wallet Service.
 *
 * Production-ready health vault unifying:
 *  - EMR Medical Records
 *  - Digital Prescriptions
 *  - Diagnostic Medical Reports
 *  - Consultation History (In-Clinic & Video Meet)
 *  - Bills & Verified Payment Receipts (Razorpay & Cash)
 *  - Digital Hospital Passes & QR Tokens
 *
 * References existing appointments and clinical documents without duplicating records.
 */
import { api } from "./api";
import type {
  AppointmentBilling,
  AppointmentMedicineItem,
  DocumentExtractedMetadata,
  DocumentProcessingStatus,
  DocumentUserCorrections,
} from "@/types";

export interface HealthWalletCounts {
  prescriptions: number;
  reports: number;
  bills: number;
  consultations: number;
  records: number;
  passes: number;
  appointments: number;
  total: number;
}

export type WalletItemType =
  | "prescription"
  | "report"
  | "bill"
  | "consultation"
  | "record"
  | "pass";

export type WalletCategory =
  | "all"
  | "prescriptions"
  | "reports"
  | "bills"
  | "consultations"
  | "records"
  | "passes";

export interface WalletDoctorInfo {
  _id?: string;
  name: string;
  speciality?: string;
  department?: string;
  qualification?: string;
  image?: string;
  signatureImage?: string;
}

export interface WalletHospitalInfo {
  _id?: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface WalletItem {
  id: string;
  _id?: string;
  type: WalletItemType;
  category: WalletCategory;
  title: string;
  appointmentId: string;
  displayAppointmentId?: string;
  date: string;
  time?: string;
  timestamp: number;
  status: string;
  statusLabel?: string;
  doctor: WalletDoctorInfo;
  hospital: WalletHospitalInfo;
  patientName: string;
  patientRelationship?: string;
  familyMemberId?: string | null;

  // Prescription fields
  diagnosis?: string;
  prescription?: string;
  medicines?: AppointmentMedicineItem[];
  prescriptionInstructions?: {
    dietInstructions?: string;
    generalInstructions?: string;
    followUpInstructions?: string;
    additionalNotes?: string;
  } | null;
  followUpAdvice?: string;
  isDigitallySigned?: boolean;

  // Medical Report fields
  name?: string;
  url?: string;
  reportType?: string;
  notes?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;

  // Document Intelligence & OCR fields
  processingStatus?: DocumentProcessingStatus;
  ocrProvider?: string;
  confidence?: number;
  extractedMetadata?: DocumentExtractedMetadata;
  extractedText?: string;
  userCorrections?: DocumentUserCorrections;
  doctorSummary?: string;
  contentHash?: string;

  // Billing & Receipt fields
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
  refundedAt?: string | null;
  billing?: AppointmentBilling;

  // Consultation fields
  consultationType?: "clinic" | "video";
  consultationMode?: "scheduled" | "instant";
  meetingUrl?: string;
  meetingStatus?: string;
  consultationStatus?: string;
  hasPrescription?: boolean;
  reportsCount?: number;

  // EMR Encounter fields
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    spO2?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  } | null;
  clinicalNotes?: {
    chiefComplaint?: string;
    symptoms?: string;
    historyOfPresentIllness?: string;
    examination?: string;
    clinicalFindings?: string;
    assessment?: string;
    treatmentPlan?: string;
    additionalNotes?: string;
  } | null;
  medicalNotes?: string;

  // Digital Hospital Pass fields
  queueToken?: string | null;
  queueStatus?: string;
  checkedIn?: boolean;
  checkInAt?: string | null;
}

export interface HealthWalletResponse {
  success: boolean;
  message?: string;
  counts: HealthWalletCounts;
  patient: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    selectedFamilyMember?: {
      _id: string;
      name: string;
      relationship: string;
    } | null;
  };
  wallet: {
    prescriptions: WalletItem[];
    reports: WalletItem[];
    bills: WalletItem[];
    consultations: WalletItem[];
    records: WalletItem[];
    passes: WalletItem[];
  };
  items: WalletItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface HealthWalletParams {
  familyMemberId?: string;
  category?: WalletCategory;
  search?: string;
  doctorId?: string;
  hospitalId?: string;
  sort?: "newest" | "oldest";
  page?: number;
  limit?: number;
}

/**
 * Fetch unified patient digital health wallet from backend.
 * Protected by authenticated patient session. Supports family member filtering.
 */
export async function getDigitalHealthWallet(
  params: HealthWalletParams = {},
): Promise<HealthWalletResponse> {
  const query = new URLSearchParams();
  if (params.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params.category && params.category !== "all") {
    query.set("category", params.category);
  }
  if (params.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.doctorId) query.set("doctorId", params.doctorId);
  if (params.hospitalId) query.set("hospitalId", params.hospitalId);
  if (params.sort) query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<HealthWalletResponse>(
    `/appointment/health-wallet${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Explicitly share a patient health document with a treating doctor.
 */
export async function shareHealthDocumentWithDoctor(
  documentId: string,
  payload: { doctorId: string; appointmentId?: string; note?: string },
): Promise<{ success: boolean; message?: string }> {
  return api.post<{ success: boolean; message?: string }>(
    `/document/${documentId}/share`,
    payload,
    { auth: true },
  );
}

/**
 * Revoke doctor access to a previously shared health document.
 */
export async function revokeHealthDocumentShare(
  documentId: string,
  doctorId: string,
): Promise<{ success: boolean; message?: string }> {
  return api.delete<{ success: boolean; message?: string }>(
    `/document/${documentId}/share/${doctorId}`,
    { auth: true },
  );
}

/**
 * Fetch patient health wallet counts summary.
 */
export async function getHealthWalletCounts(
  userId?: string,
): Promise<HealthWalletCounts | null> {
  try {
    const res = await getDigitalHealthWallet();
    return res?.counts || null;
  } catch {
    return null;
  }
}
