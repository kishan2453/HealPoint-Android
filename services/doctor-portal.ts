/**
 * HealPoint - Doctor Portal & Clinical Workspace API service.
 * Connects directly to routes/doctorRoutes.js and controllers/doctorPanelController.js.
 */
import { api } from "./api";
import type {
  Appointment,
  CompleteDoctorConsultationPayload,
  DoctorAppointmentsListResponse,
  DoctorConsultationContextResponse,
  DoctorPatientQueueResponse,
  SaveDoctorConsultationPayload,
  SaveDoctorPrescriptionPayload,
} from "@/types";

export interface DoctorAppointmentsQuery {
  view?: "all" | "today" | "upcoming" | "pending" | "completed" | "cancelled";
  status?: string;
  search?: string;
  consultationType?: string;
  paymentStatus?: string;
  date?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch appointments list for the doctor with filtering and pagination.
 */
export async function getDoctorAppointmentsList(
  doctorId: string,
  params: DoctorAppointmentsQuery = {},
): Promise<DoctorAppointmentsListResponse> {
  const query = new URLSearchParams();
  if (params.view) query.set("view", params.view);
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.consultationType) query.set("consultationType", params.consultationType);
  if (params.paymentStatus) query.set("paymentStatus", params.paymentStatus);
  if (params.date) query.set("date", params.date);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<DoctorAppointmentsListResponse>(
    `/doctor/panel/${doctorId}/appointments${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Fetch live clinic queue for the doctor.
 */
export async function getDoctorPatientQueue(
  doctorId: string,
): Promise<DoctorPatientQueueResponse> {
  return api.get<DoctorPatientQueueResponse>(
    `/doctor/panel/${doctorId}/queue`,
    { auth: true },
  );
}

/**
 * Execute queue action (call, start, complete, skip, etc.).
 */
export async function executeQueueAction(
  doctorId: string,
  appointmentId: string,
  action: "call" | "start" | "complete" | "skip" | "undo_call" | "requeue",
): Promise<{ success: boolean; message?: string }> {
  return api.patch<{ success: boolean; message?: string }>(
    `/doctor/panel/${doctorId}/queue/${appointmentId}/action`,
    { action },
    { auth: true },
  );
}

/**
 * Fetch full 360-degree consultation context (patient vitals history, past diagnoses, previous prescriptions, last consultation snapshot).
 */
export async function getDoctorConsultationContext(
  doctorId: string,
  appointmentId: string,
): Promise<DoctorConsultationContextResponse> {
  return api.get<DoctorConsultationContextResponse>(
    `/doctor/panel/${doctorId}/consultation/${appointmentId}`,
    { auth: true },
  );
}

/**
 * Start consultation: transitions status to in_progress and records consultationStartedAt.
 */
export async function startDoctorConsultation(
  doctorId: string,
  appointmentId: string,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.patch<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/consultation/${appointmentId}/start`,
    {},
    { auth: true },
  );
}

/**
 * Save draft consultation progress (vitals, clinical notes, diagnosis, draft Rx, patient profile updates).
 */
export async function saveDoctorConsultation(
  doctorId: string,
  appointmentId: string,
  payload: SaveDoctorConsultationPayload,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.put<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/consultation/${appointmentId}/save`,
    payload,
    { auth: true },
  );
}

/**
 * Finalize consultation: locks records, completes status, updates patient profile, emits websocket event.
 */
export async function completeDoctorConsultation(
  doctorId: string,
  appointmentId: string,
  payload: CompleteDoctorConsultationPayload,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.post<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/consultation/${appointmentId}/complete`,
    payload,
    { auth: true },
  );
}

/**
 * Save structured prescription for an appointment.
 */
export async function saveDoctorPrescription(
  doctorId: string,
  appointmentId: string,
  payload: SaveDoctorPrescriptionPayload,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.post<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/appointment/${appointmentId}/prescription`,
    payload,
    { auth: true },
  );
}

/**
 * Upload doctor-issued report / lab document.
 */
export async function uploadDoctorReport(
  doctorId: string,
  appointmentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.post<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/appointment/${appointmentId}/report`,
    formData,
    { auth: true, isFormData: true },
  );
}

/**
 * Delete doctor-issued report.
 */
export async function deleteDoctorReport(
  doctorId: string,
  appointmentId: string,
  reportId: string,
): Promise<{ success: boolean; message: string; appointment: Appointment }> {
  return api.delete<{ success: boolean; message: string; appointment: Appointment }>(
    `/doctor/panel/${doctorId}/appointment/${appointmentId}/report/${reportId}`,
    { auth: true },
  );
}

