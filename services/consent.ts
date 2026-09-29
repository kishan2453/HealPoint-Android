/**
 * HealPoint - Secure Consent & Patient Data Access API Service.
 *
 * Client interface for backend `/api/v1/consent` routes:
 * - Patient consent management (fetch, grant, revoke, extend, approve/reject)
 * - Patient transparent access audit trail
 * - Doctor clinical consent check, request access, and break-glass override
 */
import { api } from "./api";
import type {
  ClinicalAuthorizationRecord,
  ClinicalAuthorizationsListResponse,
  DoctorConsentStatusResponse,
  GrantConsentPayload,
  PatientAccessAuditLogResponse,
  PatientConsentRecord,
  PatientConsentsResponse,
  RequestClinicalAuthorizationPayload,
  RespondClinicalAuthorizationPayload,
} from "@/types";

/**
 * Fetch patient's active, pending, and historical consent records.
 */
export async function getPatientConsents(params?: {
  familyMemberId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PatientConsentsResponse> {
  const query = new URLSearchParams();
  if (params?.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<PatientConsentsResponse>(`/consent/my${qs ? `?${qs}` : ""}`, {
    auth: true,
  });
}

/**
 * Grant new clinical data consent to a doctor or hospital facility.
 */
export async function grantPatientConsent(
  payload: GrantConsentPayload,
): Promise<{
  success: boolean;
  message: string;
  consent: PatientConsentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    consent: PatientConsentRecord;
  }>("/consent/grant", payload, { auth: true });
}

/**
 * Instantly revoke consent granted to a doctor or hospital.
 */
export async function revokePatientConsent(
  consentId: string,
  reason?: string,
): Promise<{
  success: boolean;
  message: string;
  consent: PatientConsentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    consent: PatientConsentRecord;
  }>(`/consent/revoke/${consentId}`, { reason }, { auth: true });
}

/**
 * Extend or update consent validity duration.
 */
export async function extendConsentExpiry(
  consentId: string,
  duration: "24_hours" | "7_days" | "30_days" | "90_days" | "1_year",
): Promise<{
  success: boolean;
  message: string;
  consent: PatientConsentRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    consent: PatientConsentRecord;
  }>(`/consent/extend/${consentId}`, { duration }, { auth: true });
}

/**
 * Respond to a doctor's pending access request (Approve or Reject).
 */
export async function respondToConsentRequest(
  consentId: string,
  action: "approve" | "reject",
  duration?: string,
  rejectionReason?: string,
): Promise<{
  success: boolean;
  message: string;
  consent: PatientConsentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    consent: PatientConsentRecord;
  }>(
    `/consent/respond/${consentId}`,
    { action, duration, rejectionReason },
    { auth: true },
  );
}

/**
 * Get transparent audit log of who accessed patient health records.
 */
export async function getPatientDataAccessAuditLog(params?: {
  dataCategory?: string;
  accessType?: string;
  page?: number;
  limit?: number;
}): Promise<PatientAccessAuditLogResponse> {
  const query = new URLSearchParams();
  if (params?.dataCategory && params.dataCategory !== "all") {
    query.set("dataCategory", params.dataCategory);
  }
  if (params?.accessType && params.accessType !== "all") {
    query.set("accessType", params.accessType);
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<PatientAccessAuditLogResponse>(
    `/consent/audit-log${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * DOCTOR: Check consent status for a specific patient.
 */
export async function checkDoctorPatientConsent(
  patientId: string,
  appointmentId?: string,
): Promise<DoctorConsentStatusResponse> {
  const qs = appointmentId ? `?appointmentId=${appointmentId}` : "";
  return api.get<DoctorConsentStatusResponse>(
    `/consent/doctor/status/${patientId}${qs}`,
    { auth: true },
  );
}

/**
 * DOCTOR: Request patient consent for specific data categories.
 */
export async function requestDoctorPatientConsent(payload: {
  patientId: string;
  dataCategories: string[];
  purpose: string;
  requestMessage?: string;
}): Promise<{
  success: boolean;
  message: string;
  consent: PatientConsentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    consent: PatientConsentRecord;
  }>("/consent/doctor/request", payload, { auth: true });
}

/**
 * DOCTOR: Emergency Break-Glass Override.
 */
export async function breakGlassEmergencyAccess(payload: {
  patientId: string;
  justification: string;
  appointmentId?: string;
}): Promise<{
  success: boolean;
  message: string;
  expiresAt: string;
  consent: PatientConsentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    expiresAt: string;
    consent: PatientConsentRecord;
  }>("/consent/doctor/break-glass", payload, { auth: true });
}

// ===========================================================================
// Smart Clinical Consent & Treatment Authorization APIs
// ===========================================================================

/**
 * Get all clinical authorizations for an appointment.
 */
export async function getAppointmentClinicalAuthorizations(
  appointmentId: string,
): Promise<{
  success: boolean;
  authorizations: ClinicalAuthorizationRecord[];
}> {
  return api.get<{
    success: boolean;
    authorizations: ClinicalAuthorizationRecord[];
  }>(`/consent/clinical/appointment/${appointmentId}`, { auth: true });
}

/**
 * Doctor requests clinical authorization for an appointment.
 */
export async function requestClinicalAuthorization(
  payload: RequestClinicalAuthorizationPayload,
): Promise<{
  success: boolean;
  message: string;
  authorization: ClinicalAuthorizationRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    authorization: ClinicalAuthorizationRecord;
  }>("/consent/clinical/request", payload, { auth: true });
}

/**
 * Patient approves or declines a clinical authorization.
 */
export async function respondClinicalAuthorization(
  authorizationId: string,
  payload: RespondClinicalAuthorizationPayload,
): Promise<{
  success: boolean;
  message: string;
  authorization: ClinicalAuthorizationRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    authorization: ClinicalAuthorizationRecord;
  }>(`/consent/clinical/${authorizationId}/respond`, payload, { auth: true });
}

/**
 * Patient revokes an approved clinical authorization.
 */
export async function revokeClinicalAuthorization(
  authorizationId: string,
  revocationReason?: string,
): Promise<{
  success: boolean;
  message: string;
  authorization: ClinicalAuthorizationRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    authorization: ClinicalAuthorizationRecord;
  }>(
    `/consent/clinical/${authorizationId}/revoke`,
    { revocationReason },
    { auth: true },
  );
}

/**
 * Patient lists their clinical authorizations with optional family member filter.
 */
export async function getPatientClinicalAuthorizations(params?: {
  familyMemberId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<ClinicalAuthorizationsListResponse> {
  const query = new URLSearchParams();
  if (params?.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<ClinicalAuthorizationsListResponse>(
    `/consent/clinical/patient${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Doctor lists clinical authorizations for their appointments.
 */
export async function getDoctorClinicalAuthorizations(params?: {
  appointmentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<ClinicalAuthorizationsListResponse> {
  const query = new URLSearchParams();
  if (params?.appointmentId) query.set("appointmentId", params.appointmentId);
  if (params?.status && params.status !== "all")
    query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<ClinicalAuthorizationsListResponse>(
    `/consent/clinical/doctor${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}
