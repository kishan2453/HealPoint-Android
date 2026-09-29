export type PolicyCategory =
  | "appointments"
  | "subscriptions"
  | "consultations"
  | "family"
  | "privacy"
  | "referrals"
  | "queue"
  | "data_export"
  | "notifications"
  | "hospital_ops"
  | "security";

export type PolicyScope = "global" | "hospital";

export interface PolicyRule {
  _id: string;
  policyKey: string;
  title: string;
  category: PolicyCategory;
  scope: PolicyScope;
  hospitalId?: string | null;
  description?: string;
  isEnabled: boolean;
  conditions: Record<string, any>;
  version: number;
  updatedBy?: string | null;
  updatedByName?: string;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyVersionHistory {
  _id: string;
  policyKey: string;
  policyRuleId: string;
  version: number;
  title: string;
  category: PolicyCategory;
  scope: PolicyScope;
  hospitalId?: string | null;
  isEnabled: boolean;
  snapshotConditions: Record<string, any>;
  previousConditions?: Record<string, any> | null;
  action: "created" | "updated" | "rollback" | "toggled";
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  reason: string;
  createdAt: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reasonCode: string;
  message: string;
  policyKey: string;
  policyVersion: number;
  metadata?: Record<string, any>;
}

export interface PolicySimulationRequest {
  policyKey: string;
  context: Record<string, any>;
}

export interface PolicySimulationResult {
  success: boolean;
  simulation: PolicyDecision;
}

export interface PolicyConflictItem {
  field: string;
  message: string;
}
