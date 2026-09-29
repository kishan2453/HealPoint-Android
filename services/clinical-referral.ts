/**
 * HealPoint - Smart Referral & Specialist Routing API Service.
 *
 * Client interface for backend `/api/v1/clinical-referral` routes:
 * - Doctor creation and routing of specialist referrals
 * - Real hospital active specialist directory lookup
 * - Receiving specialist queue review & acceptance/decline
 * - Patient referral management and authorization
 * - Appointment booking linkage
 */
import { api } from "./api";
import type {
  AcceptReferralPayload,
  AssignDepartmentPayload,
  AssignDoctorPayload,
  ClinicalReferralRecord,
  CreateNetworkReferralPayload,
  CreateReferralPayload,
  DeclineReferralPayload,
  HospitalNetworkStatsResponse,
  LinkReferralAppointmentPayload,
  NetworkReferralHospitalItem,
  RespondPatientReferralPayload,
  SpecialistRoutingDoctorItem,
} from "@/types";

export interface ReferralsListResponse {
  success: boolean;
  count: number;
  referrals: ClinicalReferralRecord[];
  message?: string;
}

export interface SpecialistsRoutingResponse {
  success: boolean;
  count: number;
  specialists: SpecialistRoutingDoctorItem[];
  message?: string;
}

export interface ReferralDetailResponse {
  success: boolean;
  referral: ClinicalReferralRecord;
  userRole?: string;
  message?: string;
}

/**
 * 1. Create a new clinical referral (Doctor only)
 */
export async function createClinicalReferral(
  payload: CreateReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>("/clinical-referral/create", payload, { auth: true });
}

/**
 * 2. Specialist Routing Catalog — Query real active doctors in hospital
 */
export async function getSpecialistRoutingCatalog(params?: {
  department?: string;
  speciality?: string;
  search?: string;
}): Promise<SpecialistsRoutingResponse> {
  const query = new URLSearchParams();
  if (params?.department && params.department !== "all") {
    query.set("department", params.department);
  }
  if (params?.speciality && params.speciality !== "all") {
    query.set("speciality", params.speciality);
  }
  if (params?.search) {
    query.set("search", params.search);
  }

  const qs = query.toString();
  return api.get<SpecialistsRoutingResponse>(
    `/clinical-referral/routing/specialists${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 3. Fetch incoming referrals for logged-in specialist doctor
 */
export async function getDoctorIncomingReferrals(params?: {
  status?: string;
  urgency?: string;
}): Promise<ReferralsListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);
  if (params?.urgency && params.urgency !== "all")
    query.set("urgency", params.urgency);

  const qs = query.toString();
  return api.get<ReferralsListResponse>(
    `/clinical-referral/doctor/incoming${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 4. Fetch outgoing referrals created by logged-in doctor
 */
export async function getDoctorOutgoingReferrals(params?: {
  status?: string;
}): Promise<ReferralsListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);

  const qs = query.toString();
  return api.get<ReferralsListResponse>(
    `/clinical-referral/doctor/outgoing${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 5. Fetch single referral details
 */
export async function getReferralDetails(
  id: string,
): Promise<ReferralDetailResponse> {
  return api.get<ReferralDetailResponse>(`/clinical-referral/${id}`, {
    auth: true,
  });
}

/**
 * 6. Accept clinical referral (Specialist Doctor only)
 */
export async function acceptClinicalReferral(
  id: string,
  payload?: AcceptReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.put<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/${id}/accept`, payload || {}, { auth: true });
}

/**
 * 7. Decline clinical referral (Specialist Doctor only)
 */
export async function declineClinicalReferral(
  id: string,
  payload: DeclineReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.put<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/${id}/decline`, payload, { auth: true });
}

/**
 * 8. Cancel clinical referral (Referring Doctor only)
 */
export async function cancelClinicalReferral(
  id: string,
  reason?: string,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/${id}/cancel`, { reason }, { auth: true });
}

/**
 * 9. Fetch patient's referrals (Patient only)
 */
export async function getPatientReferrals(params?: {
  familyMemberId?: string;
  status?: string;
}): Promise<ReferralsListResponse> {
  const query = new URLSearchParams();
  if (params?.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params?.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const qs = query.toString();
  return api.get<ReferralsListResponse>(
    `/clinical-referral/patient/my${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 10. Patient authorization response (approve or decline)
 */
export async function respondPatientReferralAuthorization(
  id: string,
  payload: RespondPatientReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/patient/${id}/authorization`, payload, {
    auth: true,
  });
}

/**
 * 11. Link booked appointment with referral
 */
export async function linkReferralAppointment(
  id: string,
  payload: LinkReferralAppointmentPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/${id}/link-appointment`, payload, { auth: true });
}

// -------------------------------------------------------------
// Hospital Referral Network & Continuity Exchange API Methods
// -------------------------------------------------------------

export interface NetworkHospitalsResponse {
  success: boolean;
  count: number;
  hospitals: NetworkReferralHospitalItem[];
  message?: string;
}

export interface HospitalNetworkStatsApiResponse {
  success: boolean;
  stats: HospitalNetworkStatsResponse;
  message?: string;
}

/**
 * 12. Fetch participating network hospitals (excluding caller's hospital)
 */
export async function getNetworkHospitals(): Promise<NetworkHospitalsResponse> {
  return api.get<NetworkHospitalsResponse>(
    "/clinical-referral/network/hospitals",
    {
      auth: true,
    },
  );
}

/**
 * 13. Create an inter-hospital network referral (Doctor only)
 */
export async function createNetworkReferral(
  payload: CreateNetworkReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>("/clinical-referral/network/create", payload, { auth: true });
}

/**
 * 14. Hospital Admin: Fetch incoming network referrals for their hospital
 */
export async function getHospitalIncomingNetworkReferrals(params?: {
  status?: string;
  networkStatus?: string;
}): Promise<ReferralsListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);
  if (params?.networkStatus && params.networkStatus !== "all") {
    query.set("networkStatus", params.networkStatus);
  }

  const qs = query.toString();
  return api.get<ReferralsListResponse>(
    `/clinical-referral/network/hospital/incoming${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 15. Hospital Admin: Fetch outgoing network referrals sent from their hospital
 */
export async function getHospitalOutgoingNetworkReferrals(params?: {
  status?: string;
}): Promise<ReferralsListResponse> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all")
    query.set("status", params.status);

  const qs = query.toString();
  return api.get<ReferralsListResponse>(
    `/clinical-referral/network/hospital/outgoing${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * 16. Receiving Hospital Admin: Assign target department to incoming referral
 */
export async function assignReferralDepartment(
  id: string,
  payload: AssignDepartmentPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/network/${id}/assign-department`, payload, {
    auth: true,
  });
}

/**
 * 17. Receiving Hospital Admin: Assign destination doctor to incoming referral
 */
export async function assignReferralDoctor(
  id: string,
  payload: AssignDoctorPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/network/${id}/assign-doctor`, payload, { auth: true });
}

/**
 * 18. Receiving Hospital Admin: Accept network referral
 */
export async function acceptNetworkReferral(
  id: string,
  payload?: AcceptReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.put<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/network/${id}/accept`, payload || {}, { auth: true });
}

/**
 * 19. Receiving Hospital Admin: Decline network referral
 */
export async function declineNetworkReferral(
  id: string,
  payload: DeclineReferralPayload,
): Promise<{
  success: boolean;
  message: string;
  referral: ClinicalReferralRecord;
}> {
  return api.put<{
    success: boolean;
    message: string;
    referral: ClinicalReferralRecord;
  }>(`/clinical-referral/network/${id}/decline`, payload, { auth: true });
}

/**
 * 20. Hospital Admin: Fetch KPI operational metrics for hospital referral network
 */
export async function getHospitalNetworkStats(): Promise<HospitalNetworkStatsApiResponse> {
  return api.get<HospitalNetworkStatsApiResponse>(
    "/clinical-referral/network/hospital/stats",
    { auth: true },
  );
}
