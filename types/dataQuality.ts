export type DataQualitySeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type DataQualityCategory =
  | "patients"
  | "doctors"
  | "hospitals"
  | "appointments"
  | "slots"
  | "payments"
  | "subscriptions"
  | "documents_ocr"
  | "referrals_handover"
  | "consent"
  | "notifications"
  | "interoperability"
  | "audit"
  | "queue_checkin"
  | "wallet_timeline";

export type DataQualityIssueType =
  | "broken_reference"
  | "invalid_state"
  | "duplicate_candidate"
  | "orphaned_data"
  | "missing_required"
  | "conflict"
  | "quota_inconsistency"
  | "security_anomaly";

export type DataQualityIssueStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "ignored"
  | "reopened";

export interface DataQualityIssue {
  _id: string;
  issueId: string;
  fingerprint: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  issueType: DataQualityIssueType;
  title: string;
  description: string;
  resourceType: string;
  resourceId: string;
  hospitalId?: string;
  patientId?: string;
  doctorId?: string;
  evidence?: Record<string, unknown>;
  status: DataQualityIssueStatus;
  isSafeResolvable?: boolean;
  safeResolutionAction?: string;
  resolution?: {
    action?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolvedByName?: string;
    reason?: string;
    notes?: string;
  };
  ignoredInfo?: {
    ignoredAt?: string;
    ignoredBy?: string;
    ignoredByName?: string;
    reason?: string;
  };
  detectedAt: string;
  lastSeenAt: string;
  scanId?: string;
}

export interface DataIntegrityScan {
  _id: string;
  scanId: string;
  scanType: "full" | "targeted" | "collection";
  targetCategory: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  totalRecordsScanned: number;
  issuesFound: number;
  newIssuesCount: number;
  resolvedIssuesCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  summaryByCategory?: Record<string, number>;
  errorMessage?: string;
  triggeredByName?: string;
}

export interface DataQualityOverviewData {
  totalOpenIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalResolved: number;
  underReviewCount: number;
  ignoredCount: number;
  isScanRunning: boolean;
  runningScanId: string | null;
  lastScan: {
    scanId: string;
    scanType: string;
    completedAt: string;
    durationMs: number;
    totalRecordsScanned: number;
    issuesFound: number;
    criticalCount: number;
  } | null;
  categoryBreakdown: Record<string, number>;
  issueTypeBreakdown: Record<string, number>;
}

export interface DataQualityFilterParams {
  severity?: string;
  category?: string;
  issueType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}
