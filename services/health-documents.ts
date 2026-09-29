/**
 * HealPoint — Smart Healthcare Document Intelligence & Health Documents API Service.
 *
 * Connects to /api/v1/document endpoints for:
 * - Secure document upload with duplicate check
 * - Document Intelligence status polling
 * - Idempotent OCR retry
 * - Human verification & metadata correction
 * - Full-text and entity search
 * - Doctor summary retrieval
 * - Controlled doctor sharing & revocation
 */
import { api } from "./api";
import type {
  DocumentProcessingStatus,
  DocumentSearchResponse,
  HealthDocumentRecord,
  UpdateDocumentMetadataPayload,
} from "@/types";

export interface GetMyDocumentsParams {
  familyMemberId?: string;
  category?: string;
  search?: string;
  sort?: "newest" | "oldest";
  page?: number;
  limit?: number;
}

export interface MyDocumentsResponse {
  success: boolean;
  documents: HealthDocumentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UploadDocumentResponse {
  success: boolean;
  message?: string;
  document: HealthDocumentRecord;
  isDuplicate?: boolean;
  existingDocumentId?: string | null;
}

export interface DocumentStatusResponse {
  success: boolean;
  documentId: string;
  title: string;
  category: string;
  processingStatus: DocumentProcessingStatus;
  processedAt?: string;
  ocrProvider?: string;
  confidence: number;
  processingError?: string;
  extractedMetadata?: HealthDocumentRecord["extractedMetadata"];
  userCorrections?: HealthDocumentRecord["userCorrections"];
  retryCount?: number;
  lastRetriedAt?: string;
}

export interface DoctorSummaryResponse {
  success: boolean;
  documentId: string;
  title: string;
  category: string;
  patientName: string;
  doctorSummary: string;
  summary?: string;
  generatedAt?: string;
  extractedMetadata?: HealthDocumentRecord["extractedMetadata"];
}

/**
 * Upload a health document (multipart/form-data)
 */
export async function uploadHealthDocument(
  formData: FormData,
): Promise<UploadDocumentResponse> {
  return api.post<UploadDocumentResponse>("/document/upload", formData, {
    auth: true,
  });
}

/**
 * List patient's own documents with family member filtering
 */
export async function getMyHealthDocuments(
  params: GetMyDocumentsParams = {},
): Promise<MyDocumentsResponse> {
  const query = new URLSearchParams();
  if (params.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params.category && params.category !== "All") {
    query.set("category", params.category);
  }
  if (params.search && params.search.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.sort) query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<MyDocumentsResponse>(`/document/my${qs ? `?${qs}` : ""}`, {
    auth: true,
  });
}

/**
 * Get single health document details
 */
export async function getHealthDocumentById(
  documentId: string,
): Promise<{ success: boolean; document: HealthDocumentRecord }> {
  return api.get<{ success: boolean; document: HealthDocumentRecord }>(
    `/document/${documentId}`,
    { auth: true },
  );
}

/**
 * Get processing status and OCR progress
 */
export async function getDocumentProcessingStatus(
  documentId: string,
): Promise<DocumentStatusResponse> {
  return api.get<DocumentStatusResponse>(`/document/${documentId}/status`, {
    auth: true,
  });
}

/**
 * Retry failed or partial document intelligence analysis
 */
export async function retryDocumentProcessing(documentId: string): Promise<{
  success: boolean;
  message: string;
  document: HealthDocumentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    document: HealthDocumentRecord;
  }>(`/document/${documentId}/retry`, {}, { auth: true });
}

/**
 * Correct and verify detected metadata (Human-in-the-loop)
 */
export async function updateDocumentMetadata(
  documentId: string,
  payload: UpdateDocumentMetadataPayload,
): Promise<{
  success: boolean;
  message: string;
  document: HealthDocumentRecord;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    document: HealthDocumentRecord;
  }>(`/document/${documentId}/metadata`, payload, { auth: true });
}

/**
 * Full-text and entity search across health documents
 */
export async function searchHealthDocuments(params: {
  q?: string;
  category?: string;
  familyMemberId?: string;
  page?: number;
  limit?: number;
}): Promise<DocumentSearchResponse> {
  const query = new URLSearchParams();
  if (params.q && params.q.trim()) query.set("q", params.q.trim());
  if (params.category && params.category !== "All") {
    query.set("category", params.category);
  }
  if (params.familyMemberId && params.familyMemberId !== "all") {
    query.set("familyMemberId", params.familyMemberId);
  }
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return api.get<DocumentSearchResponse>(
    `/document/search${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Get doctor summary of shared document (Doctor Only)
 */
export async function getDocumentDoctorSummary(
  documentId: string,
): Promise<DoctorSummaryResponse> {
  return api.get<DoctorSummaryResponse>(
    `/document/${documentId}/doctor-summary`,
    { auth: true },
  );
}

/**
 * Share health document with treating doctor
 */
export async function shareDocumentWithDoctor(
  documentId: string,
  payload: { doctorId: string; appointmentId?: string; note?: string },
): Promise<{
  success: boolean;
  message: string;
  document: HealthDocumentRecord;
}> {
  return api.post<{
    success: boolean;
    message: string;
    document: HealthDocumentRecord;
  }>(`/document/${documentId}/share`, payload, { auth: true });
}

/**
 * Revoke doctor share
 */
export async function revokeDocumentShare(
  documentId: string,
  doctorId: string,
): Promise<{
  success: boolean;
  message: string;
  document: HealthDocumentRecord;
}> {
  return api.delete<{
    success: boolean;
    message: string;
    document: HealthDocumentRecord;
  }>(`/document/${documentId}/share/${doctorId}`, { auth: true });
}

/**
 * Soft delete own document
 */
export async function deleteHealthDocument(
  documentId: string,
): Promise<{ success: boolean; message: string }> {
  return api.delete<{ success: boolean; message: string }>(
    `/document/${documentId}`,
    { auth: true },
  );
}
