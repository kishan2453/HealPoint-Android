/**
 * Appointment API — mirrors routes/appointmentRoutes.js on the backend.
 * All endpoints below require a Bearer token except the public slot lookup.
 *
 * Date format for slots is `DD-MM-YYYY` and time format is `"09:00 AM"` (both
 * enforced by the server).
 */
import { api } from "./api";
import { deriveFollowUpsFromAppointments } from "@/lib/followup-intelligence";
import * as slotService from "./slots";
import type {
  Appointment,
  AppointmentDetailsResponse,
  AvailableSlotsResponse,
  BookAppointmentPayload,
  BookAppointmentResponse,
  PatientMedicalHistoryResponse,
  PatientReportItem,
  PatientTimelineResponse,
  ReschedulePayload,
  TimelineFilterType,
  UserAppointmentsResponse,
  VerifyPaymentResponse,
} from "@/types";

export async function getAvailableSlots(
  doctorId: string,
  date: string,
): Promise<AvailableSlotsResponse> {
  // Prefer the SMART SLOT inventory (same source the Hospital Admin generates
  // + blocks): blocked/booked slots never appear. When the slot module is not
  // mounted on the deployed backend, fall back to the legacy endpoint so
  // booking keeps working everywhere.
  try {
    const synced = await slotService.getSlotAvailability(doctorId, date);
    if (
      synced &&
      synced.success &&
      synced.data &&
      Array.isArray(synced.data.slots)
    ) {
      return {
        success: true,
        doctorId,
        slotDate: date,
        availableSlots: [...synced.data.slots],
        totalSlots: synced.data.slots.length,
      };
    }
  } catch (err) {
    // Fall through to the legacy endpoint (network/404 = module not mounted).
  }
  // The live backend reads `slotDate`; the source-of-truth controller accepts
  // `date` as a fallback. Sending both keeps the booking flow working against
  // any deployed backend version.
  const query = new URLSearchParams();
  query.set("date", date);
  query.set("slotDate", date);
  return api.get<AvailableSlotsResponse>(
    `/appointment/get-available-slots/${doctorId}?${query.toString()}`,
  );
}

export async function validateSlot(
  doctorId: string,
  slotDate: string,
  slotTime: string,
): Promise<{ success: boolean; available?: boolean; message?: string }> {
  return api.post<{ success: boolean; available?: boolean; message?: string }>(
    `/appointment/validate-slot/${doctorId}`,
    { slotDate, slotTime },
    { auth: true },
  );
}

export async function bookAppointment(
  payload: BookAppointmentPayload,
): Promise<BookAppointmentResponse> {
  return api.post<BookAppointmentResponse>("/appointment/create", payload, {
    auth: true,
  });
}

export async function getUserAppointments(
  userId: string,
  options?: { signal?: AbortSignal | null },
): Promise<UserAppointmentsResponse> {
  return api.get<UserAppointmentsResponse>(
    `/appointment/get-user-appointments/${userId}`,
    {
      auth: true,
      ...(options?.signal ? { signal: options.signal } : {}),
    },
  );
}

export async function getUserAppointmentDetails(
  appointmentId: string,
): Promise<AppointmentDetailsResponse> {
  return api.get<AppointmentDetailsResponse>(
    `/appointment/get-user-appointment-details/${appointmentId}`,
    { auth: true },
  );
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/appointment/cancel/${appointmentId}`,
    undefined,
    {
      auth: true,
    },
  );
}

export async function rescheduleAppointment(
  appointmentId: string,
  payload: ReschedulePayload,
): Promise<{ success: boolean; message: string; appointment: unknown }> {
  return api.patch<{ success: boolean; message: string; appointment: unknown }>(
    `/appointment/reschedule/${appointmentId}`,
    payload,
    { auth: true },
  );
}

export async function verifyAppointmentPayment(payload: {
  appointmentId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyPaymentResponse> {
  return api.post<VerifyPaymentResponse>(
    "/appointment/verify-payment",
    payload,
    { auth: true },
  );
}

// ---- Patient Medical Records & Health History -----------------------------

function matchesFamilyMember(
  appt: Appointment,
  filterMemberId?: string,
): boolean {
  if (!filterMemberId || filterMemberId === "all") return true;
  if (filterMemberId === "self") {
    return !appt.familyMemberId || appt.familyRelationship === "Self";
  }
  return appt.familyMemberId === filterMemberId;
}

export async function getPatientMedicalHistory(
  filterMemberId?: string,
): Promise<PatientMedicalHistoryResponse> {
  const query = new URLSearchParams();
  if (filterMemberId && filterMemberId !== "all") {
    query.set("familyMemberId", filterMemberId);
  }
  const qs = query.toString();

  let history: PatientMedicalHistoryResponse;

  try {
    history = await api.get<PatientMedicalHistoryResponse>(
      `/appointment/patient/medical-history${qs ? `?${qs}` : ""}`,
      { auth: true },
    );
  } catch {
    // Fallback: derive medical records from user appointments
    const res = await getUserAppointments("me");
    let appointments = res.appoinmtent || [];

    if (filterMemberId && filterMemberId !== "all") {
      appointments = appointments.filter((a) =>
        matchesFamilyMember(a, filterMemberId),
      );
    }

    const consultations = appointments;
    const prescriptions = appointments.filter(
      (a) => Boolean(a.prescription?.trim()) || Boolean(a.medicines?.length),
    );
    const reports: PatientReportItem[] = [];
    const diagnosesMap = new Map<
      string,
      {
        diagnosis: string;
        date: string;
        doctorName?: string;
        appointmentId: string;
      }
    >();

    for (const appt of appointments) {
      const docName =
        typeof appt.doctorId === "object" && appt.doctorId?.name
          ? appt.doctorId.name
          : "Doctor";
      const docSpecialty =
        typeof appt.doctorId === "object" && appt.doctorId?.speciality
          ? appt.doctorId.speciality
          : "Medical Specialist";
      const hospName =
        typeof appt.hospitalId === "object" && appt.hospitalId?.name
          ? appt.hospitalId.name
          : appt.hospitalName || "HealPoint Hospital";

      if (Array.isArray(appt.medicalReports)) {
        for (const r of appt.medicalReports) {
          reports.push({
            _id: r._id || `${appt._id}-${reports.length}`,
            appointmentId: appt._id,
            displayAppointmentId:
              appt.displayAppointmentId || appt.appointmentId,
            name: r.name,
            url: r.url,
            type: r.type || r.category || "Report",
            category: r.category || r.type || "Medical Report",
            notes: r.notes,
            filename: r.filename,
            mimeType: r.mimeType,
            size: r.size,
            uploadedAt: r.uploadedAt || appt.createdAt,
            date: appt.slotDate,
            doctorName: docName,
            doctorSpecialty: docSpecialty,
            hospitalName: hospName,
          });
        }
      }

      if (appt.diagnosis?.trim()) {
        const key = appt.diagnosis.trim().toLowerCase();
        if (!diagnosesMap.has(key)) {
          diagnosesMap.set(key, {
            diagnosis: appt.diagnosis.trim(),
            date: appt.slotDate || "",
            doctorName: docName,
            appointmentId: appt._id,
          });
        }
      }
    }

    const followUps = deriveFollowUpsFromAppointments(consultations);

    history = {
      success: true,
      summary: {
        totalConsultations: consultations.length,
        totalPrescriptions: prescriptions.length,
        totalReports: reports.length,
        totalDiagnoses: diagnosesMap.size,
      },
      consultations,
      prescriptions,
      reports,
      diagnoses: Array.from(diagnosesMap.values()),
      followUps,
    };
  }

  // Also filter client-side to guarantee 100% data separation
  if (filterMemberId && filterMemberId !== "all") {
    const filteredConsultations = (history.consultations || []).filter((a) =>
      matchesFamilyMember(a, filterMemberId),
    );
    const filteredPrescriptions = (history.prescriptions || []).filter((a) =>
      matchesFamilyMember(a, filterMemberId),
    );
    const validAppointmentIds = new Set(
      filteredConsultations.map((a) => a._id),
    );
    const filteredReports = (history.reports || []).filter(
      (r) =>
        r.appointmentId && validAppointmentIds.has(String(r.appointmentId)),
    );
    const filteredDiagnoses = (history.diagnoses || []).filter(
      (d) =>
        d.appointmentId && validAppointmentIds.has(String(d.appointmentId)),
    );
    const filteredFollowUps = (history.followUps || []).filter(
      (f) =>
        f.appointmentId && validAppointmentIds.has(String(f.appointmentId)),
    );

    return {
      ...history,
      summary: {
        totalConsultations: filteredConsultations.length,
        totalPrescriptions: filteredPrescriptions.length,
        totalReports: filteredReports.length,
        totalDiagnoses: filteredDiagnoses.length,
      },
      consultations: filteredConsultations,
      prescriptions: filteredPrescriptions,
      reports: filteredReports,
      diagnoses: filteredDiagnoses,
      followUps: filteredFollowUps,
    };
  }

  return history;
}

export interface PatientTimelineParams {
  filter?: TimelineFilterType;
  familyMemberId?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetches the authenticated patient's chronological health timeline.
 * Calls /appointment/patient/health-timeline on the live backend.
 */
export async function getPatientHealthTimeline(
  params: PatientTimelineParams = {},
): Promise<PatientTimelineResponse> {
  const query = new URLSearchParams();
  if (params.filter && params.filter !== "all")
    query.set("filter", params.filter);
  if (params.familyMemberId && params.familyMemberId !== "all")
    query.set("familyMemberId", params.familyMemberId);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  try {
    return await api.get<PatientTimelineResponse>(
      `/appointment/patient/health-timeline${qs ? `?${qs}` : ""}`,
      { auth: true },
    );
  } catch (err) {
    // Fallback: fetch medical history and construct timeline client-side
    const history = await getPatientMedicalHistory(params.familyMemberId);
    const allEvents: PatientTimelineResponse["events"] = [];

    for (const appt of history.consultations || []) {
      const docName =
        typeof appt.doctorId === "object" && appt.doctorId?.name
          ? appt.doctorId.name
          : appt.doctorName || "Doctor";
      const docSpec =
        typeof appt.doctorId === "object" && appt.doctorId?.speciality
          ? appt.doctorId.speciality
          : "Specialist";
      const hospName =
        typeof appt.hospitalId === "object" && appt.hospitalId?.name
          ? appt.hospitalId.name
          : appt.hospitalName || "HealPoint Hospital";

      allEvents.push({
        id: `appt-${appt._id}`,
        appointmentId: appt._id,
        displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
        eventType: "appointment",
        filterCategory: "appointments",
        date: appt.slotDate || "",
        time: appt.slotTime || "",
        timestamp: new Date(appt.createdAt || Date.now()).getTime(),
        status: appt.status === "completed" ? "completed" : "current",
        badgeLabel: appt.statusLabel || appt.status || "Visit",
        badgeVariant: appt.status === "completed" ? "primary" : "success",
        title: `${appt.consultationType === "video" ? "Online Video" : "In-Clinic"} Visit Booked`,
        description: `Scheduled with ${docName} at ${hospName}`,
        details: `Slot: ${appt.slotDate} • ${appt.slotTime}`,
        icon: appt.consultationType === "video" ? "videocam" : "calendar",
        iconBg: appt.consultationType === "video" ? "#F5F3FF" : "#EFF6FF",
        iconColor: appt.consultationType === "video" ? "#7C3AED" : "#0284C7",
        doctor: { name: docName, speciality: docSpec },
        hospital: { name: hospName },
        actions: [
          {
            label: "View Appointment",
            type: "navigate",
            route: "/appointment/[id]",
            params: { id: appt._id },
            variant: "secondary",
          },
        ],
      });

      // If follow-up was advised, add a dedicated follow-up milestone
      if (appt.followUpAdvice?.trim()) {
        const dId =
          typeof appt.doctorId === "object" && appt.doctorId
            ? String((appt.doctorId as { _id?: string })._id || "")
            : "";

        allEvents.push({
          id: `fu-${appt._id}`,
          appointmentId: appt._id,
          displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
          eventType: "followup",
          filterCategory: "followups",
          date: appt.slotDate || "",
          time: appt.slotTime || "",
          timestamp: new Date(appt.createdAt || Date.now()).getTime() + 1000,
          status: "current",
          badgeLabel: "Follow-Up Advised",
          badgeVariant: "warning",
          title: "Follow-Up Care Plan Recommended",
          description: `Doctor's Advice: ${appt.followUpAdvice.trim()}`,
          details: `Advised by ${docName} (${docSpec})`,
          icon: "refresh-outline",
          iconBg: "#FEF3C7",
          iconColor: "#D97706",
          doctor: { name: docName, speciality: docSpec },
          hospital: { name: hospName },
          actions: [
            ...(dId
              ? [
                  {
                    label: "Book Follow-Up Slot",
                    type: "navigate" as const,
                    route: "/booking/[doctorId]",
                    params: { doctorId: dId },
                    variant: "primary" as const,
                  },
                ]
              : []),
            {
              label: "View Care Plan",
              type: "navigate" as const,
              route: "/health/follow-ups",
              variant: "secondary" as const,
            },
          ],
        });
      }
    }

    const filtered =
      params.filter && params.filter !== "all"
        ? allEvents.filter((e) => e.filterCategory === params.filter)
        : allEvents;

    return {
      success: true,
      summary: {
        totalEvents: allEvents.length,
        totalAppointments: history.consultations?.length || 0,
        totalConsultations: history.summary?.totalConsultations || 0,
        totalPrescriptions: history.summary?.totalPrescriptions || 0,
        totalReports: history.summary?.totalReports || 0,
        totalFollowUps: history.followUps?.length || 0,
      },
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        totalEvents: filtered.length,
        totalPages: 1,
        hasMore: false,
      },
      events: filtered,
    };
  }
}

export async function uploadMedicalReport(
  appointmentId: string,
  payload: {
    name: string;
    url: string;
    type?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
  },
): Promise<{ success: boolean; message: string; appointment: unknown }> {
  return api.post<{ success: boolean; message: string; appointment: unknown }>(
    `/appointment/upload-report/${appointmentId}`,
    payload,
    { auth: true },
  );
}

export async function deleteMedicalReport(
  appointmentId: string,
  reportId: string,
): Promise<{ success: boolean; message: string }> {
  return api.delete<{ success: boolean; message: string }>(
    `/appointment/report/${appointmentId}/${reportId}`,
    { auth: true },
  );
}

// ---- Admin / Super Admin platform view --------------------------------------
export interface AdminAppointmentsResponse {
  success: boolean;
  message?: string;
  privacyRestricted?: boolean;
  totalCount: number;
  statusCounts?: { _id: string; count: number }[];
  appointments: Appointment[];
}

export interface AdminAppointmentsParams {
  platform?: boolean;
  limit?: number;
  /** 1-based server-side page. Older backends may ignore this; callers dedupe. */
  page?: number;
  /** Best-effort server-side search term (doctor/patient/hospital/searchable text). */
  search?: string;
  /** Best-effort status filter (pending/confirmed/completed/cancel/missed). */
  status?: string;
  /** Best-effort payment-status filter (paid/pending/failed/refunded). */
  paymentStatus?: string;
  hospitalId?: string;
  doctorId?: string;
}

/**
 * Admin appointment list. Hospital Admins get their hospital's appointments;
 * Super Admin gets the full platform list when `platform: true` is sent.
 *
 * Only `platform` and `limit` are guaranteed by every deployed backend; the
 * other params are passed best-effort for backend versions that support them.
 * The appointment monitoring screen therefore also filters the returned real
 * records client-side so search/filters always work on real backend data.
 */
export async function getAllAdminAppointments(
  params: AdminAppointmentsParams = {},
): Promise<AdminAppointmentsResponse> {
  const query = new URLSearchParams();
  if (params.platform) query.set("platform", "1");
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.search && params.search.trim())
    query.set("search", params.search.trim());
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.paymentStatus && params.paymentStatus !== "all")
    query.set("paymentStatus", params.paymentStatus);
  if (params.hospitalId) query.set("hospitalId", params.hospitalId);
  if (params.doctorId) query.set("doctorId", params.doctorId);
  const qs = query.toString();
  return api.get<AdminAppointmentsResponse>(
    `/appointment/get-all${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}
