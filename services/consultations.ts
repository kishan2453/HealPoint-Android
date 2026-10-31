/**
 * HealPoint - Online Consultation API (real Google Meet integration).
 * Mirrors routes/consultationRoutes.js on the backend.
 *
 * The meeting URL is private: it is only ever returned by the single
 * consultation detail / meeting-link endpoints, and only to the owning patient
 * or the assigned doctor. List endpoints never include it.
 */
import { api } from './api';
import type {
  ConsultationActionResponse,
  DoctorConsultationsResponse,
  HospitalConsultationStats,
  OnlineDoctorsResponse,
  PatientConsultationDetailResponse,
  PatientConsultationsResponse,
  PatientMeetingLinkResponse,
  SuperAdminConsultationStats,
} from '@/types';

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export async function getOnlineDoctors(params: {
  search?: string;
  speciality?: string;
} = {}): Promise<OnlineDoctorsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.speciality) query.set('speciality', params.speciality);
  const qs = query.toString();
  return api.get<OnlineDoctorsResponse>(`/consultation/online-doctors${qs ? `?${qs}` : ''}`);
}

export async function getUserConsultations(userId: string): Promise<PatientConsultationsResponse> {
  return api.get<PatientConsultationsResponse>(`/consultation/patient/${userId}`, { auth: true });
}

export async function getUserConsultation(id: string): Promise<PatientConsultationDetailResponse> {
  return api.get<PatientConsultationDetailResponse>(`/consultation/patient/detail/${id}`, { auth: true });
}

export async function getPatientMeetingLink(id: string): Promise<PatientMeetingLinkResponse> {
  return api.post<PatientMeetingLinkResponse>(`/consultation/patient/meeting-link/${id}`, undefined, { auth: true });
}

export interface ConsultationSessionData {
  success: boolean;
  appointmentId: string;
  sessionToken: string;
  role: 'patient' | 'doctor';
  roomName: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  doctor?: {
    id: string;
    name: string;
    speciality?: string;
    avatar?: string;
  };
  patient?: {
    id: string;
    name: string;
  };
  consultationStatus: string;
  meetingUrl?: string;
  message?: string;
}

export interface ConsultationSessionStatusData {
  success: boolean;
  appointmentId: string;
  consultationStatus: string;
  meetingStatus: string;
  meetingUrl?: string;
  doctorReady: boolean;
  notes?: string;
  durationSeconds?: number;
}

export async function createConsultationSession(appointmentId: string): Promise<ConsultationSessionData> {
  return api.post<ConsultationSessionData>(`/consultation/session/${appointmentId}/create`, undefined, { auth: true });
}

export async function getConsultationSessionStatus(appointmentId: string): Promise<ConsultationSessionStatusData> {
  return api.get<ConsultationSessionStatusData>(`/consultation/session/${appointmentId}/status`, { auth: true });
}

export async function updateConsultationStatus(
  appointmentId: string,
  consultationStatus: 'waiting' | 'doctor_ready' | 'in_progress' | 'completed',
  durationSeconds?: number,
): Promise<{ success: boolean; message: string; consultationStatus: string }> {
  return api.patch<{ success: boolean; message: string; consultationStatus: string }>(
    `/consultation/session/${appointmentId}/status`,
    { consultationStatus, durationSeconds },
    { auth: true },
  );
}

export async function saveConsultationNotes(
  appointmentId: string,
  notes: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/consultation/session/${appointmentId}/notes`,
    { notes },
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export async function getDoctorConsultations(doctorId: string): Promise<DoctorConsultationsResponse> {
  return api.get<DoctorConsultationsResponse>(`/consultation/doctor/${doctorId}`, { auth: true });
}

export async function addDoctorMeetingLink(
  doctorId: string,
  id: string,
  meetingUrl: string,
): Promise<ConsultationActionResponse> {
  return api.post<ConsultationActionResponse>(
    `/consultation/doctor/${doctorId}/meeting-link/${id}`,
    { meetingUrl },
    { auth: true },
  );
}

export async function removeDoctorMeetingLink(
  doctorId: string,
  id: string,
): Promise<ConsultationActionResponse> {
  return api.delete<ConsultationActionResponse>(
    `/consultation/doctor/${doctorId}/meeting-link/${id}`,
    { auth: true },
  );
}

export async function updateDoctorConsultationStatus(
  doctorId: string,
  id: string,
  consultationStatus: 'doctor_ready' | 'ready_to_join' | 'in_progress' | 'completed',
): Promise<ConsultationActionResponse> {
  return api.patch<ConsultationActionResponse>(
    `/consultation/doctor/${doctorId}/status/${id}`,
    { consultationStatus },
    { auth: true },
  );
}

export async function toggleDoctorOnline(
  doctorId: string,
  online: boolean,
): Promise<{ success: boolean; message?: string; onlineConsultationEnabled?: boolean; onlineStatus?: string }> {
  return api.patch<{ success: boolean; message?: string; onlineConsultationEnabled?: boolean; onlineStatus?: string }>(
    `/consultation/doctor/${doctorId}/toggle`,
    { online },
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Hospital Admin / Super Admin
// ---------------------------------------------------------------------------

export async function getHospitalConsultationStats(): Promise<HospitalConsultationStats> {
  return api.get<HospitalConsultationStats>('/consultation/hospital/stats', { auth: true });
}

export async function getSuperAdminConsultationStats(): Promise<SuperAdminConsultationStats> {
  return api.get<SuperAdminConsultationStats>('/consultation/super-admin/stats', { auth: true });
}