/**
 * HealPoint — Smart QR Check-In & Live Queue Service.
 */
import { api } from "./api";

export interface AppointmentQRResponse {
  success: boolean;
  token: string;
  qrToken?: string;
  qrPayload: string;
  appointment: {
    _id: string;
    appointmentId: string;
    patientName?: string;
    patientPhone?: string;
    doctorName: string;
    doctorSpeciality: string;
    doctorDepartment?: string;
    doctorImage?: string;
    doctorDegree?: string;
    hospitalName: string;
    hospitalSlug: string;
    hospitalLogo?: string;
    hospitalAddress?: string;
    hospitalCity?: string;
    hospitalMapsUrl?: string;
    hospitalPhone?: string;
    slotDate: string;
    slotTime: string;
    status: string;
    consultationType?: string;
    consultationMode?: string;
    amount?: number;
    paymentStatus?: string;
    paymentMethod?: string;
    payment?: boolean;
    meetingUrl?: string;
    checkedIn: boolean;
    checkInAt: string | null;
    queueToken: string | null;
    queueStatus: string;
    isEligibleForCheckIn: boolean;
  };
  message?: string;
}

export interface PatientQueueStatusResponse {
  success: boolean;
  checkedIn: boolean;
  queueToken?: string;
  queueStatus?:
    | "not_checked_in"
    | "waiting"
    | "called"
    | "in_consultation"
    | "completed"
    | "cancelled";
  currentServingToken?: string | null;
  patientsAhead?: number;
  checkInAt?: string;
  doctorName?: string;
  hospitalName?: string;
  slotDate?: string;
  slotTime?: string;
  calledAt?: string | null;
  message?: string;
}

/**
 * Fetch digital check-in QR and appointment summary.
 */
export async function getAppointmentQR(
  appointmentId: string,
): Promise<AppointmentQRResponse> {
  return api.get<AppointmentQRResponse>(
    `/checkin/appointment/${appointmentId}/qr`,
  );
}

/**
 * Fetch live queue position, token, and serving status for an appointment.
 */
export async function getPatientQueueStatus(
  appointmentId: string,
): Promise<PatientQueueStatusResponse> {
  return api.get<PatientQueueStatusResponse>(
    `/checkin/appointment/${appointmentId}/queue-status`,
  );
}
