/**
 * Hospital Admin API — mirrors routes/hospital-admin/* and the hospital-scoped
 * doctor routes on the backend. Every endpoint is scoped to the logged-in
 * Hospital Admin's OWN hospitalId server-side; a Hospital Admin can never read
 * or write doctors, appointments or patients belonging to another hospital.
 */
import { api } from "./api";
import type {
  Appointment,
  Doctor,
  Hospital,
  HospitalAdminDashboardResponse,
} from "@/types";

export async function getHospitalAdminDashboard(): Promise<HospitalAdminDashboardResponse> {
  return api.get<HospitalAdminDashboardResponse>("/hospital-admin/dashboard", {
    auth: true,
  });
}

export interface HospitalProfileStats {
  doctorCount: number;
  departmentCount: number;
  servicesCount: number;
  appointmentCount: number;
  completeness: number;
}

export interface HospitalProfileResponse {
  success: boolean;
  hospital: Hospital;
  stats: HospitalProfileStats;
}

export async function getHospitalProfile(): Promise<HospitalProfileResponse> {
  return api.get<HospitalProfileResponse>("/hospital-admin/profile", {
    auth: true,
  });
}

export async function updateHospitalProfile(
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.put<{ success: boolean; message: string; hospital: Hospital }>(
    "/hospital-admin/profile",
    payload,
    { auth: true },
  );
}

export interface HospitalDoctorsParams {
  search?: string;
  department?: string;
  status?: string;
  availability?: string;
  verificationStatus?: string;
}

export interface HospitalDoctorStats {
  total: number;
  active: number;
  inactive: number;
  available: number;
}

export interface HospitalDoctorsResponse {
  success: boolean;
  count: number;
  total: number;
  stats: HospitalDoctorStats;
  data: Doctor[];
  doctors: Doctor[];
}

export async function getHospitalDoctors(
  params: HospitalDoctorsParams = {},
): Promise<HospitalDoctorsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.department) query.set("department", params.department);
  if (params.status) query.set("status", params.status);
  if (params.availability) query.set("availability", params.availability);
  if (params.verificationStatus)
    query.set("verificationStatus", params.verificationStatus);
  const qs = query.toString();
  return api.get<HospitalDoctorsResponse>(
    `/hospital-admin/doctors${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export interface HospitalDoctorDetailResponse {
  success: boolean;
  doctor: Doctor;
  stats?: {
    totalAppointments?: number;
    completedAppointments?: number;
    upcomingAppointments?: number;
    cancelledAppointments?: number;
    totalReviews?: number;
    reviewCount?: number;
    avgRating?: number;
    rating?: number;
    slotCount?: number;
    availableSlotsCount?: number;
    appointmentCount?: number;
  };
  appointments?: Appointment[];
  timeSlots?: Doctor["timeSlots"];
  weeklySchedule?: Doctor["weeklySchedule"];
}

export async function getHospitalDoctorDetails(
  doctorId: string,
): Promise<HospitalDoctorDetailResponse> {
  return api.get<HospitalDoctorDetailResponse>(
    `/hospital-admin/doctors/${doctorId}`,
    { auth: true },
  );
}

export async function createHospitalDoctor(
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string; doctor: Doctor }> {
  return api.post<{ success: boolean; message: string; doctor: Doctor }>(
    "/hospital-admin/doctors",
    payload,
    { auth: true },
  );
}

export async function updateHospitalDoctor(
  doctorId: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string; doctor?: Doctor }> {
  return api.put<{ success: boolean; message: string; doctor?: Doctor }>(
    `/hospital-admin/doctors/${doctorId}`,
    payload,
    { auth: true },
  );
}

export async function toggleHospitalDoctorActive(
  doctorId: string,
  isActive: boolean,
): Promise<{ success: boolean; message: string }> {
  return api.put<{ success: boolean; message: string }>(
    `/hospital-admin/doctors/${doctorId}/status`,
    { isActive },
    { auth: true },
  );
}

export async function updateHospitalDoctorAvailability(
  doctorId: string,
  payload: {
    available?: boolean;
    availabilitySchedule?: string;
    workingHours?: Record<string, unknown>;
  },
): Promise<{ success: boolean; message: string }> {
  return api.put<{ success: boolean; message: string }>(
    `/hospital-admin/doctors/${doctorId}/availability`,
    payload,
    { auth: true },
  );
}

export async function deleteHospitalDoctor(
  doctorId: string,
): Promise<{ success: boolean; message: string }> {
  return api.delete<{ success: boolean; message: string }>(
    `/hospital-admin/doctors/${doctorId}`,
    { auth: true },
  );
}

/**
 * Approve/reject a doctor's verification. The backend scopes this to the
 * admin's own hospital (`doctorController.updateDoctorVerificationStatus` skips
 * the hospital gate only for Super Admin).
 */
export async function updateDoctorVerificationStatus(
  doctorId: string,
  payload: { status: string; note?: string; requestedDocuments?: string[] },
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(
    `/doctor/update-verification-status/${doctorId}`,
    payload,
    { auth: true },
  );
}

export async function toggleDoctorAvailability(
  doctorId: string,
  availableStatus: boolean,
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(
    `/doctor/update-status/${doctorId}`,
    { availableStatus },
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Hospital departments (real CRUD & doctor mapping)
// ---------------------------------------------------------------------------
import type { HospitalDepartment, HospitalDepartmentStats } from "@/types";

export interface HospitalAdminDepartmentOption {
  _id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface HospitalDepartmentsResponse {
  success: boolean;
  departments: HospitalDepartment[];
  stats: HospitalDepartmentStats;
  hospitalName?: string;
}

export async function getHospitalDepartments(
  params: { search?: string; status?: string } = {},
): Promise<HospitalDepartmentsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return api.get<HospitalDepartmentsResponse>(
    `/hospital-admin/departments${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export interface HospitalDepartmentDetailResponse {
  success: boolean;
  department: HospitalDepartment;
  assignedDoctors: Doctor[];
  allHospitalDoctors: Doctor[];
}

export async function getHospitalDepartmentDetails(
  departmentId: string,
): Promise<HospitalDepartmentDetailResponse> {
  return api.get<HospitalDepartmentDetailResponse>(
    `/hospital-admin/departments/${departmentId}`,
    { auth: true },
  );
}

export async function createHospitalDepartment(payload: {
  name: string;
  description?: string;
  headOfDepartment?: string;
  icon?: string;
  isActive?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  department: HospitalDepartment;
}> {
  return api.post<{
    success: boolean;
    message: string;
    department: HospitalDepartment;
  }>("/hospital-admin/departments", payload, { auth: true });
}

export async function updateHospitalDepartment(
  departmentId: string,
  payload: Partial<HospitalDepartment>,
): Promise<{
  success: boolean;
  message: string;
  department: HospitalDepartment;
}> {
  return api.put<{
    success: boolean;
    message: string;
    department: HospitalDepartment;
  }>(`/hospital-admin/departments/${departmentId}`, payload, { auth: true });
}

export async function toggleHospitalDepartmentStatus(
  departmentId: string,
): Promise<{
  success: boolean;
  message: string;
  isActive: boolean;
  department: HospitalDepartment;
}> {
  return api.put<{
    success: boolean;
    message: string;
    isActive: boolean;
    department: HospitalDepartment;
  }>(`/hospital-admin/departments/${departmentId}/status`, {}, { auth: true });
}

export async function mapHospitalDepartmentDoctors(
  departmentId: string,
  doctorIds: string[],
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/hospital-admin/departments/${departmentId}/doctors`,
    { doctorIds },
    { auth: true },
  );
}

export async function deleteHospitalDepartment(
  departmentId: string,
): Promise<{ success: boolean; message: string }> {
  return api.delete<{ success: boolean; message: string }>(
    `/hospital-admin/departments/${departmentId}`,
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Hospital-Admin Appointment Management (own hospital only — server enforced)
// Mirrors GET/PATCH/POST routes under /hospital-admin/appointments*.
// ---------------------------------------------------------------------------
export interface HospitalAdminAppointmentsStats {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  paid: number;
  unpaid: number;
  totalRevenue: number;
}

export interface HospitalAdminAppointmentsParams {
  /** Server-side search across patient/doctor/reference/department text. */
  search?: string;
  status?: string;
  paymentStatus?: string;
  doctorId?: string;
  department?: string;
  dateFilter?: "today" | "tomorrow" | "upcoming" | "past" | "custom" | "all";
  startDate?: string; // DD-MM-YYYY (used with dateFilter=custom)
  endDate?: string; // DD-MM-YYYY
  sortBy?: "newest" | "oldest" | "date_asc" | "date_desc" | "amount_desc";
  page?: number;
  limit?: number;
}

export interface HospitalAdminAppointmentsResponse {
  success: boolean;
  message?: string;
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: HospitalAdminAppointmentsStats;
  hospitalName?: string;
}

export async function getHospitalAdminAppointments(
  params: HospitalAdminAppointmentsParams = {},
): Promise<HospitalAdminAppointmentsResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim())
    query.set("search", params.search.trim());
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.paymentStatus && params.paymentStatus !== "all")
    query.set("paymentStatus", params.paymentStatus);
  if (params.doctorId) query.set("doctorId", params.doctorId);
  if (params.department && params.department !== "all")
    query.set("department", params.department);
  if (params.dateFilter && params.dateFilter !== "all")
    query.set("dateFilter", params.dateFilter);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<HospitalAdminAppointmentsResponse>(
    `/hospital-admin/appointments${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export interface HospitalAdminAppointmentDetailResponse {
  success: boolean;
  message?: string;
  appointment: Appointment;
}

export async function getHospitalAdminAppointmentDetails(
  appointmentId: string,
): Promise<HospitalAdminAppointmentDetailResponse> {
  return api.get<HospitalAdminAppointmentDetailResponse>(
    `/hospital-admin/appointments/${appointmentId}`,
    { auth: true },
  );
}

export interface HospitalAdminAppointmentMutationResponse {
  success: boolean;
  message?: string;
  appointment: Appointment;
}

/**
 * Confirm / complete / mark no-show (missed) — the backend enforces the valid
 * status transition table and returns 400 on invalid transitions, 404 when the
 * appointment does not belong to the admin's hospital.
 */
export async function updateHospitalAdminAppointmentStatus(
  appointmentId: string,
  payload: { status: string; reason?: string },
): Promise<HospitalAdminAppointmentMutationResponse> {
  return api.patch<HospitalAdminAppointmentMutationResponse>(
    `/hospital-admin/appointments/${appointmentId}/status`,
    payload,
    { auth: true },
  );
}

/**
 * Hospital-admin cancel. The backend preserves paid/refunded payment state and
 * records a real notification + audit trail for the patient's hospital.
 */
export async function cancelHospitalAdminAppointment(
  appointmentId: string,
  reason: string,
): Promise<HospitalAdminAppointmentMutationResponse> {
  return api.post<HospitalAdminAppointmentMutationResponse>(
    `/hospital-admin/appointments/${appointmentId}/cancel`,
    { reason },
    { auth: true },
  );
}

/**
 * Hospital-admin reschedule against the REAL scheduling system. The backend
 * re-validates the slot (doctor conflict + unique partial index) atomically and
 * preserves the original appointment on failure. The chosen slot must have been
 * advertised as available by the same slot engine (see RescheduleModal).
 */
export async function rescheduleHospitalAdminAppointment(
  appointmentId: string,
  payload: { slotDate: string; slotTime: string; reason?: string },
): Promise<HospitalAdminAppointmentMutationResponse> {
  return api.post<HospitalAdminAppointmentMutationResponse>(
    `/hospital-admin/appointments/${appointmentId}/reschedule`,
    payload,
    { auth: true },
  );
}
// ---------------------------------------------------------------------------
// Hospital-Admin Patient Management (own hospital only — server enforced)
// GET /hospital-admin/patients + GET /hospital-admin/patients/:id
// ---------------------------------------------------------------------------
export interface HospitalAdminPatientAppointmentRef {
  _id: string;
  appointmentId?: string;
  slotDate?: string;
  slotTime?: string;
  status?: string;
}

export interface HospitalAdminPatient {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  image?: string;
  gender?: string;
  dob?: string;
  isActive?: boolean;
  createdAt?: string;
  appointmentCount: number;
  completedCount: number;
  cancelledCount: number;
  missedCount: number;
  upcomingAppointment?: HospitalAdminPatientAppointmentRef | null;
  lastAppointment?: HospitalAdminPatientAppointmentRef | null;
  /** Present only on the detail endpoint (GET /hospital-admin/patients/:id). */
  address?: string;
  relationCount?: number;
  paidAppointments?: number;
  totalSpent?: number;
}

export interface HospitalAdminPatientsResponse {
  success: boolean;
  message?: string;
  patients: HospitalAdminPatient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hospitalName?: string;
}

export interface HospitalAdminPatientDetailResponse {
  success: boolean;
  message?: string;
  patient: HospitalAdminPatient;
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hospitalName?: string;
}

/**
 * Hospital-scoped patient list. Backend derives the patient set from the
 * admin's own hospital appointments only and supports server-side search
 * (name/email/phone/appointment reference) + pagination.
 */
export async function getHospitalPatients(
  params: { search?: string; page?: number; limit?: number } = {},
): Promise<HospitalAdminPatientsResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim())
    query.set("search", params.search.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<HospitalAdminPatientsResponse>(
    `/hospital-admin/patients${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/** Patient details + real appointment history (own hospital only). */
export async function getHospitalPatientDetails(
  patientId: string,
  page = 1,
  limit = 15,
): Promise<HospitalAdminPatientDetailResponse> {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  query.set("limit", String(limit));
  return api.get<HospitalAdminPatientDetailResponse>(
    `/hospital-admin/patients/${patientId}?${query.toString()}`,
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Hospital Gallery (Strictly scoped to authenticated hospital)
// ---------------------------------------------------------------------------
export interface HospitalGalleryImage {
  _id: string;
  name?: string;
  title?: string;
  category: string;
  url: string;
  src: string;
  width?: number;
  height?: number;
  size?: number;
  mimeType?: string;
  createdAt?: string;
  isCustomUpload?: boolean;
}

export interface HospitalGalleryResponse {
  success: boolean;
  hospitalName?: string;
  images: HospitalGalleryImage[];
  totalCount: number;
}

export async function getHospitalGallery(
  category?: string,
): Promise<HospitalGalleryResponse> {
  const qs =
    category && category !== "all"
      ? `?category=${encodeURIComponent(category)}`
      : "";
  return api.get<HospitalGalleryResponse>(`/hospital-admin/gallery${qs}`, {
    auth: true,
  });
}

export async function uploadHospitalGallery(payload: {
  image?: string;
  title?: string;
  category?: string;
  images?: Array<{
    base64?: string;
    url?: string;
    title?: string;
    category?: string;
  }>;
}): Promise<{
  success: boolean;
  message: string;
  images: HospitalGalleryImage[];
}> {
  return api.post<{
    success: boolean;
    message: string;
    images: HospitalGalleryImage[];
  }>("/hospital-admin/gallery", payload, { auth: true });
}

export async function deleteHospitalGalleryImage(
  id: string,
): Promise<{ success: boolean; message: string; deletedId?: string }> {
  return api.delete<{ success: boolean; message: string; deletedId?: string }>(
    `/hospital-admin/gallery/${encodeURIComponent(id)}`,
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Video Guides (Hospital Admin & Platform guides)
// ---------------------------------------------------------------------------
export interface HospitalVideoGuide {
  id: string;
  title: string;
  description: string;
  category: string;
  duration?: string;
  videoUrl?: string;
  thumbnail?: string;
  tags?: string[];
}

export interface HospitalVideoGuidesResponse {
  success: boolean;
  message?: string;
  guides: HospitalVideoGuide[];
  totalCount: number;
}

export async function getHospitalVideoGuides(): Promise<HospitalVideoGuidesResponse> {
  return api.get<HospitalVideoGuidesResponse>("/hospital-admin/video-guides", {
    auth: true,
  });
}
