/**
 * HealPoint - Smart Clinical Handover & Care Continuity API Service.
 *
 * Client interface for backend `/api/v1/clinical-handover` routes:
 * - Doctor creation and management of clinical handovers
 * - Inter-physician transfer and acknowledgement
 * - Department handovers
 * - Patient care continuity authorization and transparency
 */
import { api } from "./api";
import type {
  AcceptHandoverPayload,
  ClinicalHandoverRecord,
  CompleteHandoverPayload,
  CreateHandoverPayload,
  DeclineHandoverPayload,
  RespondPatientHandoverPayload,
} from "@/types";

export interface HandoversListResponse {
  success: boolean;
  count: number;
  handovers: ClinicalHandoverRecord[];
  message?: string;
}

export interface HandoverDetailResponse {
  success: boolean;
  handover: ClinicalHandoverRecord;
  userRole?: string;
  message?: string;
}

/**
 * 1. Create a new clinical handover (Doctor only)
 */
export async function createClinicalHandover(
  payload: CreateHandoverPayload,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>("/clinical-handover/create", payload, { auth: true });
}

/**
 * 2. Fetch incoming handovers for logged-in doctor
 */
export async function getDoctorIncomingHandovers(params?: {
  status?: string;
  priority?: string;
}): Promise<HandoversListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);
  if (params?.priority && params.priority !== "all")
    query.set("priority", params.priority);

  const qs = query.toString();
  return api.get<HandoversListResponse>(
    `/clinical-handover/doctor/incoming${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 3. Fetch outgoing handovers initiated by logged-in doctor
 */
export async function getDoctorOutgoingHandovers(params?: {
  status?: string;
  priority?: string;
}): Promise<HandoversListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);
  if (params?.priority && params.priority !== "all")
    query.set("priority", params.priority);

  const qs = query.toString();
  return api.get<HandoversListResponse>(
    `/clinical-handover/doctor/outgoing${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 4. Fetch details of a specific clinical handover
 */
export async function getHandoverDetails(
  id: string,
): Promise<HandoverDetailResponse> {
  return api.get<HandoverDetailResponse>(`/clinical-handover/${id}`, {
    auth: true,
  });
}

/**
 * 5. Accept an incoming clinical handover (Doctor only)
 */
export async function acceptClinicalHandover(
  id: string,
  payload?: AcceptHandoverPayload,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>(`/clinical-handover/${id}/accept`, payload || {}, { auth: true });
}

/**
 * 6. Decline an incoming clinical handover (Doctor only)
 */
export async function declineClinicalHandover(
  id: string,
  payload: DeclineHandoverPayload,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>(`/clinical-handover/${id}/decline`, payload, { auth: true });
}

/**
 * 7. Mark clinical handover completed (Doctor only)
 */
export async function completeClinicalHandover(
  id: string,
  payload: CompleteHandoverPayload,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>(`/clinical-handover/${id}/complete`, payload, { auth: true });
}

/**
 * 8. Cancel an initiated clinical handover (Originating Doctor only)
 */
export async function cancelClinicalHandover(
  id: string,
  reason?: string,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>(`/clinical-handover/${id}/cancel`, { reason }, { auth: true });
}

/**
 * 9. Fetch patient's care continuity handovers (Patient only)
 */
export async function getPatientHandovers(params?: {
  familyMemberId?: string;
  status?: string;
}): Promise<HandoversListResponse> {
  const query = new URLSearchParams();
  if (params?.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const qs = query.toString();
  return api.get<HandoversListResponse>(
    `/clinical-handover/patient/my${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 10. Patient authorization response (approve or decline)
 */
export async function respondPatientHandoverAuthorization(
  id: string,
  payload: RespondPatientHandoverPayload,
): Promise<{
  success: boolean;
  message: string;
  handover: ClinicalHandoverRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    handover: ClinicalHandoverRecord;
  }>(`/clinical-handover/patient/${id}/authorization`, payload, { auth: true });
}
