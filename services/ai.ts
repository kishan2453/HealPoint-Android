/**
 * HealPoint - AI Healthcare Assistant Service.
 *
 * Provides typed communication with the HealPoint AI assistant endpoint (/api/v1/ai/chat).
 * Requires authenticated patient session, supports caller AbortSignal, and returns
 * structured healthcare actions and cards.
 */
import { api, toErrorMessage } from "./api";

export interface AiChatAction {
  label: string;
  route: string;
  params?: Record<string, string>;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
}

export interface AiDoctorCardData {
  _id: string;
  name: string;
  degree?: string;
  speciality?: string;
  specialization?: string;
  experience?: number;
  fees?: number;
  rating?: number;
  reviewCount?: number;
  image?: string;
  hospitalName?: string;
}

export interface AiAppointmentCardData {
  _id: string;
  doctorName?: string;
  speciality?: string;
  hospitalName?: string;
  slotDate?: string;
  slotTime?: string;
  status?: string;
  consultationType?: string;
  meetingStatus?: string;
}

export interface AiHospitalCardData {
  _id: string;
  name: string;
  image?: string;
  city?: string;
  phone?: string;
  rating?: number;
}

export interface AiEmergencyCardData {
  title: string;
  description: string;
  hotline: string;
}

export type AiCardData =
  | AiDoctorCardData
  | AiAppointmentCardData
  | AiHospitalCardData
  | AiEmergencyCardData
  | Record<string, unknown>;

export interface AiChatCard {
  type:
    | "appointment"
    | "doctor"
    | "hospital"
    | "emergency"
    | "prescription"
    | "report";
  data: AiCardData;
}

export interface AiActionConfirmation {
  action: "CANCEL_APPOINTMENT";
  appointmentId: string;
  doctorName: string;
  hospitalName?: string;
  slotDate: string;
  slotTime: string;
  speciality?: string;
  prompt: string;
}

export interface AiActionResult {
  success: boolean;
  message: string;
  appointmentId?: string;
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  disclaimer?: string;
  intent?: string;
  actionConfirmation?: AiActionConfirmation | null;
  actions?: AiChatAction[];
  cards?: AiChatCard[];
  message?: string;
}

export interface AiChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  disclaimer?: string;
  actionConfirmation?: AiActionConfirmation | null;
  actions?: AiChatAction[];
  cards?: AiChatCard[];
  timestamp: string;
  isError?: boolean;
}

/**
 * Sends a message to the HealPoint AI Assistant.
 * Uses the authenticated user's session token automatically.
 */
export async function sendAiMessage(
  message: string,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  try {
    const data = await api.post<AiChatResponse>(
      "/ai/chat",
      { message: trimmed },
      {
        auth: true,
        signal,
        timeout: 15000,
        retry: 0,
      },
    );

    if (!data || data.success === false) {
      throw new Error(
        data?.message || "HealPoint AI was unable to process your request.",
      );
    }

    return data;
  } catch (error) {
    const msg = toErrorMessage(
      error,
      "Sorry, I'm having trouble connecting right now. Please try again.",
    );
    throw new Error(msg);
  }
}

/**
 * Executes a verified, patient-confirmed action on the HealPoint backend.
 */
export async function executeAiAction(
  action: "CANCEL_APPOINTMENT",
  appointmentId: string,
): Promise<AiActionResult> {
  if (!appointmentId) {
    throw new Error("Appointment ID is required.");
  }

  try {
    const data = await api.post<AiActionResult>(
      "/ai/action",
      { action, appointmentId },
      {
        auth: true,
        timeout: 15000,
        retry: 0,
      },
    );

    if (!data || data.success === false) {
      throw new Error(data?.message || "Failed to execute action.");
    }

    return data;
  } catch (error) {
    const msg = toErrorMessage(
      error,
      "Failed to execute AI action. Please try again.",
    );
    throw new Error(msg);
  }
}
