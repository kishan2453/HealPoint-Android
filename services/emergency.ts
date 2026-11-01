/**
 * HealPoint - Emergency SOS & Ambulance Services API.
 * Connects to /api/v1/emergency backend routes.
 */
import { api } from "./api";
import type {
  EmergencyContactItem,
  EmergencyRequest,
  EmergencyResponse,
  TriggerEmergencyPayload,
} from "@/types";

const RESOURCE = "/emergency";

export async function triggerEmergencySOS(
  payload: TriggerEmergencyPayload,
): Promise<EmergencyResponse> {
  return api.post<EmergencyResponse>(`${RESOURCE}/sos`, payload, {
    auth: true,
    timeout: 15000,
  });
}

export async function getActiveEmergency(): Promise<{
  success: boolean;
  activeEmergency: EmergencyRequest | null;
}> {
  return api.get<{
    success: boolean;
    activeEmergency: EmergencyRequest | null;
  }>(`${RESOURCE}/active`, {
    auth: true,
  });
}

export async function getMyEmergencyHistory(): Promise<{
  success: boolean;
  count: number;
  emergencies: EmergencyRequest[];
}> {
  return api.get<{
    success: boolean;
    count: number;
    emergencies: EmergencyRequest[];
  }>(`${RESOURCE}/my-history`, {
    auth: true,
  });
}

export async function cancelEmergency(
  id: string,
  reason = "False alarm / patient cancelled",
): Promise<EmergencyResponse> {
  return api.post<EmergencyResponse>(
    `${RESOURCE}/${id}/cancel`,
    { reason },
    {
      auth: true,
    },
  );
}

export async function getEmergencyContacts(): Promise<{
  success: boolean;
  contacts: EmergencyContactItem[];
}> {
  return api.get<{
    success: boolean;
    contacts: EmergencyContactItem[];
  }>(`${RESOURCE}/contacts`, {
    auth: true,
  });
}

export async function saveEmergencyContact(payload: {
  name: string;
  phone: string;
  relation?: string;
  isPrimary?: boolean;
  contactId?: string;
}): Promise<{
  success: boolean;
  message: string;
  contacts: EmergencyContactItem[];
}> {
  return api.post<{
    success: boolean;
    message: string;
    contacts: EmergencyContactItem[];
  }>(`${RESOURCE}/contacts`, payload, {
    auth: true,
  });
}

export async function deleteEmergencyContact(contactId: string): Promise<{
  success: boolean;
  message: string;
  contacts: EmergencyContactItem[];
}> {
  return api.delete<{
    success: boolean;
    message: string;
    contacts: EmergencyContactItem[];
  }>(`${RESOURCE}/contacts/${contactId}`, {
    auth: true,
  });
}

