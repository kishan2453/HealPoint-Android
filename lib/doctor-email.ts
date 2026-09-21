/**
 * HealPoint - doctor email audit + consistency helpers (Super Admin).
 *
 * The backend owns the source of truth for doctor emails AND the matching
 * login account (auth always uses the authenticated User document via
 * `/user/login` — never a client-supplied doctor id / name / hospital). This
 * module only *analyses* the returned doctor catalog records so an admin can
 * spot records whose stored email is malformed, missing, suspicious or
 * duplicated across accounts. It never rewrites or invents emails.
 *
 * Consistent with the app-wide rule: the `.test` TLD is kept VALID for
 * development/demo records, while `.demo`, `.example`, `.localhost`, `.local`
 * and `.invalid` domains are flagged as suspicious dev domains.
 */
import { EMAIL_REGEX } from '@/lib/validation';
import { doctorHospitalName, doctorSpecialty } from '@/lib/doctor';
import type { Doctor } from '@/types';

export type DoctorEmailStatus = 'valid' | 'invalid' | 'missing' | 'suspicious';

export interface DoctorEmailFinding {
  doctorId: string;
  name: string;
  hospital: string;
  specialization: string;
  email: string;
  status: DoctorEmailStatus;
  reason?: string;
  /** Doctor names that share the same (normalised) email → ambiguous login. */
  duplicatesWith?: string[];
}

export interface DoctorEmailDuplicate {
  email: string;
  doctorIds: string[];
  doctorNames: string[];
}

export interface DoctorEmailHospitalGroup {
  name: string;
  findings: DoctorEmailFinding[];
}

export interface DoctorEmailAudit {
  total: number;
  valid: number;
  invalid: number;
  missing: number;
  suspicious: number;
  duplicates: DoctorEmailDuplicate[];
  findings: DoctorEmailFinding[];
  hospitals: DoctorEmailHospitalGroup[];
}
/** Known non-deliverable / dev-only domains that should never hold real logins. */
const SUSPICIOUS_DOMAINS = /\.(demo|example|localhost|local|invalid)$/i;

/**
 * Classify a stored doctor email.
 *  - missing   → no email stored at all
 *  - invalid   → fails the app-wide EMAIL_REGEX (doctor@, doctor@@…, no TLD…)
 *  - suspicious→ structurally valid but looks like machine-built/dev data that
 *                should be corrected before it is used as a login identifier
 *  - valid     → otherwise
 */
export function classifyDoctorEmail(email?: string | null): { status: DoctorEmailStatus; reason?: string } {
  const value = String(email || '').trim();
  if (!value) {
    return { status: 'missing', reason: 'No email stored on the doctor record.' };
  }
  if (!EMAIL_REGEX.test(value)) {
    return { status: 'invalid', reason: 'Malformed email format — not usable for login.' };
  }

  const domain = value.slice(value.indexOf('@') + 1).toLowerCase();
  const local = value.slice(0, value.indexOf('@'));
  const localSegments = local.split('.');
  const reasons: string[] = [];

  if (SUSPICIOUS_DOMAINS.test(domain)) {
    reasons.push(`Dev-only/suspicious domain "${domain}" — cannot be a real login.`);
  }
  if (local.length > 40) {
    reasons.push(`Unusually long local part (${local.length} chars) looks machine-built.`);
  } else if (localSegments.length > 3) {
    reasons.push(`Local part has ${localSegments.length} segments — looks machine-built.`);
  }

  if (reasons.length > 0) {
    return { status: 'suspicious', reason: reasons.join(' ') };
  }
  return { status: 'valid' };
}

/** Normalised login identifier (backend treats emails case-insensitively). */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
/**
 * Build the full audit report for a set of REAL doctor records.
 * Every entry keeps its original doctorId/hospital — nothing is merged or
 * rewritten.
 */
export function buildDoctorEmailAudit(doctors: Doctor[]): DoctorEmailAudit {
  const findings: DoctorEmailFinding[] = doctors.map((doctor) => {
    const email = doctor.email || doctor.clinicInfo?.email || '';
    const { status, reason } = classifyDoctorEmail(email || undefined);
    return {
      doctorId: String(doctor._id),
      name: doctor.name || 'Unknown doctor',
      hospital: doctorHospitalName(doctor),
      specialization: doctorSpecialty(doctor),
      email,
      status,
      reason,
    };
  });

  // Duplicate login-email detection across the whole platform.
  const byEmail = new Map<string, DoctorEmailFinding[]>();
  findings.forEach((finding) => {
    if (!finding.email) return;
    const key = normalizeEmail(finding.email);
    const bucket = byEmail.get(key) || [];
    bucket.push(finding);
    byEmail.set(key, bucket);
  });

  const duplicates: DoctorEmailDuplicate[] = [];
  byEmail.forEach((bucket, email) => {
    if (bucket.length > 1) {
      bucket.forEach((finding) => {
        finding.duplicatesWith = bucket
          .filter((other) => other.doctorId !== finding.doctorId)
          .map((other) => other.name);
      });
      duplicates.push({
        email,
        doctorIds: bucket.map((finding) => finding.doctorId),
        doctorNames: bucket.map((finding) => finding.name),
      });
    }
  });

  // Group every finding under its hospital (each hospital / each doctor).
  const groups = new Map<string, DoctorEmailHospitalGroup>();
  findings.forEach((finding) => {
    const group = groups.get(finding.hospital) || { name: finding.hospital, findings: [] };
    group.findings.push(finding);
    groups.set(finding.hospital, group);
  });
  const hospitals = Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    total: findings.length,
    valid: findings.filter((finding) => finding.status === 'valid').length,
    invalid: findings.filter((finding) => finding.status === 'invalid').length,
    missing: findings.filter((finding) => finding.status === 'missing').length,
    suspicious: findings.filter((finding) => finding.status === 'suspicious').length,
    duplicates,
    findings,
    hospitals,
  };
}

/** Human-friendly status label used in badges. */
export function emailStatusLabel(status: DoctorEmailStatus): string {
  switch (status) {
    case 'valid': return 'Valid';
    case 'invalid': return 'Invalid';
    case 'missing': return 'Missing';
    case 'suspicious': return 'Suspicious';
    default: return 'Unknown';
  }
}