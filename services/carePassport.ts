/**
 * HealPoint — Smart Patient Care Passport Service.
 *
 * Type-safe API client for all Care Passport endpoints.
 * References existing appointment, wallet, and timeline data — never duplicates records.
 */
import { api } from "./api";
import type {
  CarePassport,
  CarePassportEpisode,
  PassportQRResponse,
  PassportVerifyResponse,
  PassportShareRecord,
  PassportAccessEvent,
  CreatePassportSharePayload,
  PatchPassportSettingsPayload,
  PassportScope,
} from "@/types";

// ---------------------------------------------------------------------------
// Patient — own passport
// ---------------------------------------------------------------------------

/** Get the authenticated patient's Care Passport (with optional family member) */
export const getMyPassport = async (
  familyMemberId?: string | null,
): Promise<{ success: boolean; passport: CarePassport }> => {
  const qs = familyMemberId
    ? `?familyMemberId=${encodeURIComponent(familyMemberId)}`
    : "";
  return api.get<{ success: boolean; passport: CarePassport }>(
    `/passport${qs}`,
    { auth: true },
  );
};

/** Get a specific care episode by appointmentId */
export const getCareEpisode = async (
  appointmentId: string,
): Promise<{ success: boolean; episode: CarePassportEpisode }> => {
  return api.get<{ success: boolean; episode: CarePassportEpisode }>(
    `/passport/episode/${encodeURIComponent(appointmentId)}`,
    { auth: true },
  );
};

// ---------------------------------------------------------------------------
// QR Token
// ---------------------------------------------------------------------------

/** Generate a secure Care Passport QR token */
export const generateQR = async (opts: {
  scope?: PassportScope;
  familyMemberId?: string | null;
  appointmentId?: string | null;
  expiryMinutes?: number;
}): Promise<{ success: boolean; qr: PassportQRResponse }> => {
  const q = new URLSearchParams();
  if (opts.scope) q.append("scope", opts.scope);
  if (opts.familyMemberId) q.append("familyMemberId", opts.familyMemberId);
  if (opts.appointmentId) q.append("appointmentId", opts.appointmentId);
  if (opts.expiryMinutes) q.append("expiryMinutes", String(opts.expiryMinutes));
  const qs = q.toString();
  return api.get<{ success: boolean; qr: PassportQRResponse }>(
    `/passport/qr${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
};

/** Verify a scanned Care Passport QR token */
export const verifyQR = async (
  token: string,
): Promise<PassportVerifyResponse> => {
  return api.post<PassportVerifyResponse>(
    "/passport/verify",
    { token },
    { auth: true },
  );
};

// ---------------------------------------------------------------------------
// Share management
// ---------------------------------------------------------------------------

/** Get the patient's active share tokens */
export const getShares = async (
  familyMemberId?: string | null,
): Promise<{ success: boolean; shares: PassportShareRecord[] }> => {
  const qs = familyMemberId
    ? `?familyMemberId=${encodeURIComponent(familyMemberId)}`
    : "";
  return api.get<{ success: boolean; shares: PassportShareRecord[] }>(
    `/passport/shares${qs}`,
    { auth: true },
  );
};

/** Create a controlled, expiring share token */
export const createShare = async (
  payload: CreatePassportSharePayload,
): Promise<{
  success: boolean;
  share: PassportShareRecord & { token: string };
}> => {
  return api.post<{
    success: boolean;
    share: PassportShareRecord & { token: string };
  }>("/passport/share", payload, { auth: true });
};

/** Revoke a share immediately */
export const revokeShare = async (
  shareId: string,
): Promise<{ success: boolean; message: string }> => {
  return api.delete<{ success: boolean; message: string }>(
    `/passport/share/${encodeURIComponent(shareId)}`,
    { auth: true },
  );
};

// ---------------------------------------------------------------------------
// Access history
// ---------------------------------------------------------------------------

/** Get passport access history */
export const getAccessLog = async (
  limit = 20,
): Promise<{ success: boolean; history: PassportAccessEvent[] }> => {
  return api.get<{ success: boolean; history: PassportAccessEvent[] }>(
    `/passport/access-log?limit=${limit}`,
    { auth: true },
  );
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Update passport settings */
export const patchSettings = async (
  payload: PatchPassportSettingsPayload,
): Promise<{ success: boolean; message: string }> => {
  return api.patch<{ success: boolean; message: string }>(
    "/passport/settings",
    payload,
    { auth: true },
  );
};
