import { api } from "./api";
import type {
  SupportTicket,
  ServiceDeskKpiSummary,
  GetTicketsParams,
  CreateTicketPayload,
  PostTicketMessagePayload,
  AssignTicketPayload,
  TransitionTicketStatusPayload,
  EscalateTicketPayload,
  ResolveTicketPayload,
} from "../types";

// ---------------------------------------------------------------------------
// Smart Healthcare Customer Support & Service Desk Center — API Service
// ---------------------------------------------------------------------------

/** Create a new support ticket */
export const createTicket = async (
  payload: CreateTicketPayload,
): Promise<{ success: boolean; ticket: SupportTicket; message?: string }> => {
  return api.post<{
    success: boolean;
    ticket: SupportTicket;
    message?: string;
  }>("/service-desk/ticket", payload, { auth: true });
};

/** Get paginated ticket list (patient: own tickets; admin: scoped list) */
export const getMyTickets = async (
  params: GetTicketsParams = {},
): Promise<{
  success: boolean;
  tickets: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const q = new URLSearchParams();
  if (params.page) q.append("page", String(params.page));
  if (params.limit) q.append("limit", String(params.limit));
  if (params.status && params.status !== "all")
    q.append("status", params.status);
  if (params.category) q.append("category", params.category);
  if (params.priority) q.append("priority", params.priority);
  if (params.team) q.append("team", params.team);
  if (params.hospitalId) q.append("hospitalId", params.hospitalId);
  if (params.search) q.append("search", params.search);
  const qs = q.toString();
  return api.get<{
    success: boolean;
    tickets: SupportTicket[];
    total: number;
    page: number;
    totalPages: number;
  }>(`/service-desk/tickets${qs ? `?${qs}` : ""}`, { auth: true });
};

/** Get a single ticket by ID */
export const getTicketById = async (
  ticketId: string,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.get<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}`,
    { auth: true },
  );
};

/** Post a reply or internal staff note on a ticket */
export const postMessage = async (
  ticketId: string,
  payload: PostTicketMessagePayload,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/message`,
    payload,
    { auth: true },
  );
};

/** Assign ticket to an agent (admin only) */
export const assignTicket = async (
  ticketId: string,
  payload: AssignTicketPayload,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/assign`,
    payload,
    { auth: true },
  );
};

/** Transition ticket status (admin only) */
export const updateStatus = async (
  ticketId: string,
  payload: TransitionTicketStatusPayload,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/status`,
    payload,
    { auth: true },
  );
};

/** Escalate a ticket (admin only) */
export const escalateTicket = async (
  ticketId: string,
  payload: EscalateTicketPayload,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/escalate`,
    payload,
    { auth: true },
  );
};

/** Link a service recovery record to a ticket (admin only) */
export const linkRecovery = async (
  ticketId: string,
  recoveryId: string,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/link-recovery`,
    { recoveryId },
    { auth: true },
  );
};

/** Resolve and close a ticket (admin only) */
export const resolveTicket = async (
  ticketId: string,
  payload: ResolveTicketPayload,
): Promise<{ success: boolean; ticket: SupportTicket }> => {
  return api.post<{ success: boolean; ticket: SupportTicket }>(
    `/service-desk/ticket/${encodeURIComponent(ticketId)}/resolve`,
    payload,
    { auth: true },
  );
};

/** Get KPI summary for service desk dashboard (admin/super-admin only) */
export const getServiceDeskKpis = async (
  hospitalId?: string,
): Promise<{ success: boolean; kpis: ServiceDeskKpiSummary }> => {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  return api.get<{ success: boolean; kpis: ServiceDeskKpiSummary }>(
    `/service-desk/kpis${qs}`,
    { auth: true },
  );
};
