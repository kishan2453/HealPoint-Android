/**
 * HealPoint - shared domain types.
 *
 * These mirror the backend models/controllers in `Doctor-apppointment/
 * server-with-client`. Field names match the server responses exactly (the
 * server is the source of truth). Where the backend returns a misspelled or
 * flattened key we keep that name on purpose.
 */

// ---------------------------------------------------------------------------
// API envelope
// ---------------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export type ApiErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "SERVER"
  | "UNKNOWN";

export type ApiErrorCategory =
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SERVER"
  | "VALIDATION"
  | "UNKNOWN";

// ---------------------------------------------------------------------------
// Auth / user
// ---------------------------------------------------------------------------
export type UserRole =
  // Legacy display strings from older backend versions (kept for compatibility).
  | "Patient"
  | "Hospital Admin"
  | "Super Admin"
  | "Administrator"
  | "Staff"
  // Canonical role values returned by the role-aware backend.
  | "patient"
  | "doctor"
  | "admin"
  | "super_admin";

export type FamilyRelationship =
  | "Self"
  | "Father"
  | "Mother"
  | "Spouse"
  | "Son"
  | "Daughter"
  | "Brother"
  | "Sister"
  | "Other";

export interface FamilyMember {
  _id: string;
  userId: string;
  name: string;
  relationship: FamilyRelationship;
  gender?: "male" | "female" | "other" | string;
  dob?: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  image?: string;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  image?: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  role?: UserRole;
  familyMembers?: FamilyMember[];
  // Doctor portal context (populated for doctors via /doctor/login).
  hospitalId?: string;
  hospitalName?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  authProvider?: "password" | "google" | "both";
  googleId?: string;
  favorites?: FavoriteDoctor[];
  favoriteHospitals?: FavoriteHospital[];
  appointmentStats?: {
    totalBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    missedAppointments: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Hospital
// ---------------------------------------------------------------------------
export interface HospitalContact {
  phone?: string;
  emergency?: string;
  reception?: string;
  email?: string;
  website?: string;
}

export interface HospitalLocation {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  mapsUrl?: string;
  lat?: number;
  lng?: number;
}

export interface Hospital {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  coverImage?: string;
  about?: string;
  location?: HospitalLocation;
  contact?: HospitalContact;
  departments?: string[];
  services?: string[];
  gallery?: string[];
  hospitalImages?: string[];
  facilitiesInfo?: {
    ambulance?: boolean;
    icu?: boolean;
    operationTheatre?: boolean;
    facilities?: string[];
  };
  beds?: number;
  icuBeds?: number;
  emergencyFacility?: boolean;
  opdTimings?: string;
  rating?: number;
  reviewCount?: number;
  isActive?: boolean;
  reviews?: Review[];
  // Enriched fields returned by /hospital/public/get-all and get-details.
  doctors?: Doctor[];
  doctorCount?: number;
  availableDoctorCount?: number;
  // Platform directory counts returned by the Super Admin endpoints.
  patientCount?: number;
  appointmentCount?: number;
  consultationFee?: number;
  icu?: boolean;
  onlineConsultationAvailable?: boolean;
  galleryImages?: {
    src?: string;
    title?: string;
    category?: string;
    width?: number;
    height?: number;
  }[];
  specializations?: string[];
}

export interface HospitalDepartment {
  _id: string;
  name: string;
  description?: string;
  headOfDepartment?: string;
  icon?: string;
  image?: string;
  isActive?: boolean;
  doctorCount?: number;
  appointmentCount?: number;
  doctors?: {
    _id: string;
    name: string;
    speciality?: string;
    available?: boolean;
    status?: string;
    image?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface HospitalDepartmentStats {
  total: number;
  active: number;
  inactive: number;
  withDoctors: number;
  withoutDoctors: number;
  totalDoctors: number;
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------
export interface DoctorTimeSlot {
  date?: string;
  startTime?: string;
  endTime?: string;
  isAvailable?: boolean;
}

export interface ScheduleSession {
  name?: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleBreak {
  name?: string;
  startTime: string;
  endTime: string;
}

export interface WeeklySchedule {
  day?: string;
  enabled?: boolean;
  startTime?: string;
  endTime?: string;
  sessions?: ScheduleSession[];
  breaks?: ScheduleBreak[];
  shifts?: { start: string; end: string }[];
}

export interface DoctorLeave {
  _id?: string;
  leaveType: "full_day" | "multi_day" | "partial_day";
  startDate: string;
  endDate?: string;
  dates?: string[];
  startTime?: string;
  endTime?: string;
  reason?: string;
  status?: "approved" | "pending" | "cancelled";
  createdAt?: string;
}

export interface DoctorDateOverride {
  _id?: string;
  date: string;
  isClosed?: boolean;
  reason?: string;
  startTime?: string;
  endTime?: string;
  sessions?: ScheduleSession[];
  breaks?: ScheduleBreak[];
  createdAt?: string;
}

export interface DoctorProfileTimeline {
  title?: string;
  institute?: string;
  hospital?: string;
  year?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
}

export interface Doctor {
  _id: string;
  name: string;
  about?: string;
  degree?: string;
  qualification?: string;
  registrationNumber?: string;
  speciality?: string;
  department?: string;
  specialization?: string;
  rating?: number;
  reviewCount?: number;
  appointmentCount?: number;
  experience?: number;
  fees?: number;
  email?: string;
  phone?: string;
  address?: string;
  image?: string;
  coverBanner?: string;
  hdProfilePicture?: string;
  hospitalId?: string | Hospital;
  hospitalName?: string;
  clinicInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    roomNo?: string;
  };
  available?: boolean;
  onlineStatus?: "online" | "offline";
  isActive?: boolean;
  languages?: string[];
  gender?: string;
  availabilitySchedule?: string;
  leaveDates?: string[];
  leaves?: DoctorLeave[];
  dateOverrides?: DoctorDateOverride[];
  weeklySchedule?: WeeklySchedule[];
  blockedHolidays?: { date?: string; reason?: string }[];
  timeSlots?: DoctorTimeSlot[];
  slotDurationMinutes?: number;
  consultationTypes?: ConsultationType[];
  verificationStatus?: string;
  onlineConsultationEnabled?: boolean;
  instantConsultationEnabled?: boolean;
  nextAvailableSlot?: {
    date: string;
    time: string;
    slotCountToday: number;
    weekday: string;
  } | null;
  awards?: string[];
  achievements?: string[];
  qualificationTimeline?: DoctorProfileTimeline[];
  educationTimeline?: DoctorProfileTimeline[];
  experienceTimeline?: DoctorProfileTimeline[];
  reviews?: Review[];
  patientFeedback?: Review[];
}

export interface GetAllDoctorsParams {
  search?: string;
  q?: string;
  hospitalId?: string;
  hospitalName?: string;
  doctorName?: string;
  department?: string;
  specialization?: string;
  speciality?: string;
  language?: string;
  gender?: string;
  availability?: boolean;
  onlineConsultation?: boolean;
  offlineConsultation?: boolean;
  location?: string;
  minExperience?: number;
  maxExperience?: number;
  minFee?: number;
  maxFee?: number;
  minRating?: number;
  limit?: number;
  /**
   * Super Admin platform mode â requests the full doctor list + verification
   * counts (backend returns an empty list without this flag).
   */
  platform?: boolean;
  /** Super Admin / Hospital Admin: filter by verification status. */
  verificationStatus?: string;
}

// ---------------------------------------------------------------------------
// Appointment
// ---------------------------------------------------------------------------
export interface PopulatedAppointmentDoctor {
  _id: string;
  name?: string;
  speciality?: string;
  department?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  hospitalName?: string;
}

export interface AppointmentBillingBreakdownItem {
  key: string;
  label: string;
  amount: number;
  type: "fee" | "charge" | "discount" | "benefit" | "total";
}

export interface AppointmentBilling {
  consultationFee: number;
  serviceFee?: number;
  platformFee?: number;
  discount?: number;
  subscriptionBenefit?: number;
  planApplied?: string;
  planName?: string;
  subtotal: number;
  totalAmount: number;
  currency?: string;
  calculatedAt?: string;
  notes?: string;
  breakdown?: AppointmentBillingBreakdownItem[];
}

export interface Appointment {
  _id: string;
  appointmentId?: string;
  displayAppointmentId?: string;
  userId: string;
  doctorId: string | PopulatedAppointmentDoctor;
  hospitalId: string | Hospital;
  hospitalName?: string;
  slotDate?: string;
  slotTime?: string;
  date?: string;
  time?: string;
  appointmentDate?: string;
  patientName?: string;
  patientId?: string | User;
  patientPhone?: string;
  familyMemberId?: string;
  familyRelationship?: FamilyRelationship;
  isFamilyBooking?: boolean;
  amount?: number;
  billing?: AppointmentBilling;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  meetingUrl?: string;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
  status: AppointmentStatus;
  payment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  diagnosis?: string;
  prescription?: string;
  medicines?: AppointmentMedicineItem[];
  medicalNotes?: string;
  followUpAdvice?: string;
  medicalReports?: AppointmentMedicalReportItem[];
  doctorName?: string;
  doctorSpecialty?: string;
  doctorImage?: string;
  statusLabel?: string;
  hasPrescription?: boolean;
  medicinesCount?: number;
  reportsCount?: number;
  doctor?: PopulatedAppointmentDoctor;
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    spO2?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  clinicalNotes?: {
    chiefComplaint?: string;
    symptoms?: string;
    historyOfPresentIllness?: string;
    examination?: string;
    clinicalFindings?: string;
    assessment?: string;
    treatmentPlan?: string;
    additionalNotes?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  doctorPhone?: string;
  doctorEmail?: string;
  bookingStatusLabel?: string;
  isReviewed?: boolean;
  reviewId?: string;
  statusHistory?: unknown[];
  appointmentHistory?: unknown[];
  checkedIn?: boolean;
  checkInAt?: string;
  queueToken?: string;
  queueStatus?:
    | "not_checked_in"
    | "waiting"
    | "called"
    | "in_consultation"
    | "completed"
    | "cancelled";
  calledAt?: string;
  preparation?: AppointmentPreparationState;
  originalAppointmentId?: string;
  followUp?: {
    required?: boolean;
    recommendedDate?: string;
    timeframe?: string;
    notes?: string;
    linkedFollowUpAppointmentId?: string;
    status?: "none" | "recommended" | "scheduled" | "completed" | "overdue";
    updatedAt?: string;
  };
}

/** Shape returned by GET /appointment/get-user-appointments/:id. */
export interface UserAppointmentsResponse {
  success: boolean;
  message?: string;
  totalCount: number;
  appoinmtent: Appointment[];
}

/** Shape returned by GET /appointment/get-user-appointment-details/:id. */
export interface AppointmentDetailsResponse {
  success: boolean;
  message?: string;
  appointmentDetails: AppointmentDetails;
}

export interface PatientQuestionItem {
  _id?: string;
  question: string;
  sharedWithDoctor: boolean;
  createdAt?: string;
}

export interface AppointmentPreparationState {
  patientQuestions: PatientQuestionItem[];
  checklistCompleted: string[];
  instructionsAcknowledged: boolean;
  symptomsNotes: string;
  updatedAt?: string | null;
}

export interface PreparationChecklistItem {
  key: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isAutoVerified: boolean;
  actionType:
    | "profile"
    | "instructions"
    | "documents"
    | "questions"
    | "pass"
    | "video";
}

export interface PreparationInstructionDetails {
  type: "clinic" | "video";
  title: string;
  guidelines: string[];
  isAcknowledged: boolean;
}

export interface PreparationReadinessSummary {
  overallReady: boolean;
  progressPercentage: number;
  completedSteps: number;
  totalSteps: number;
  badge: string;
}

export interface PreparationDocumentItem {
  _id: string;
  title: string;
  category: string;
  documentDate?: string;
  notes?: string;
  url: string;
  mimeType?: string;
  size?: number;
  isSharedWithDoctor: boolean;
  sharedAt?: string | null;
}

export interface PreparationHistoryItem {
  _id: string;
  slotDate?: string;
  slotTime?: string;
  consultationType?: ConsultationType;
  diagnosis?: string;
  prescription?: string;
  medicines?: AppointmentMedicineItem[];
  medicalReports?: AppointmentMedicalReportItem[];
}

export interface AppointmentPreparationResponse {
  success: boolean;
  message?: string;
  appointment: {
    _id: string;
    appointmentId?: string;
    slotDate?: string;
    slotTime?: string;
    status: AppointmentStatus;
    statusLabel?: string;
    paymentStatus?: string;
    consultationType: ConsultationType;
    meetingUrl?: string;
    meetingStatus?: MeetingStatus;
    consultationStatus?: ConsultationStatus;
    queueToken?: string;
    checkedIn?: boolean;
    hospitalId?: string;
    doctorId?: string;
  };
  patient: {
    name: string;
    phone: string;
    isFamilyMember: boolean;
    relationship: string;
    familyMemberId?: string | null;
    age?: number;
    gender?: string;
  };
  doctor: {
    _id: string;
    name: string;
    speciality?: string;
    department?: string;
    hospitalName?: string;
    image?: string;
    phone?: string;
    email?: string;
  };
  hospital: {
    _id: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    emergency?: string;
  };
  preparation: AppointmentPreparationState;
  checklist: PreparationChecklistItem[];
  readiness: PreparationReadinessSummary;
  instructions: PreparationInstructionDetails;
  documents: PreparationDocumentItem[];
  previousHistory: PreparationHistoryItem[];
  videoEntitlement?: {
    planKey: string;
    planName: string;
    isEligibleForVideoConsultation: boolean;
    remainingQuota: number;
    message?: string;
  } | null;
}

export interface AppointmentStatusHistoryItem {
  status: string;
  reason?: string;
  actor?: string;
  changedAt?: string;
}

export interface AppointmentMedicalReportItem {
  _id?: string;
  name: string;
  url: string;
  type?: string;
  category?: string;
  notes?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

export interface AppointmentMedicineItem {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  timing?: string;
  instructions?: string;
}

export interface PatientReportItem {
  _id: string;
  appointmentId: string;
  displayAppointmentId?: string;
  name: string;
  url: string;
  type?: string;
  category?: string;
  notes?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  date?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
}

export interface PatientDiagnosisItem {
  diagnosis: string;
  date: string;
  doctorName?: string;
  appointmentId: string;
}

export interface PatientFollowUpItem {
  id?: string;
  appointmentId: string;
  displayAppointmentId?: string;
  date?: string;
  originalVisitDate?: string;
  originalVisitTime?: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
  department?: string;
  consultationType?: "clinic" | "video";
  advice: string;
  timeframe?: string;
  recommendedTimeframe?: string;
  targetDate?: string;
  recommendedTargetDate?: string;
  status?: "pending_booking" | "scheduled" | "completed" | "cancelled";
  statusLabel?: string;
  statusVariant?: "warning" | "primary" | "success" | "neutral";
  hasPrescription?: boolean;
  medicinesCount?: number;
  hasReports?: boolean;
  reportsCount?: number;
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  actionRoute?: string;
  actionParams?: Record<string, string>;
  actionLabel?: string;
  nextAction?: {
    key: string;
    label: string;
    icon: string;
    variant: "primary" | "secondary" | "outline";
    route: string;
    params?: Record<string, string>;
  };
}

export interface FollowUpOverviewItem {
  id: string;
  appointmentId: string;
  displayAppointmentId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorImage?: string;
  doctorFees?: number;
  doctorAvailable?: boolean;
  doctorConsultationTypes?: ConsultationType[];
  hospitalId?: string;
  hospitalName: string;
  department: string;
  consultationType: ConsultationType;
  originalVisitDate: string;
  originalVisitTime: string;
  originalStatus: string;
  originalBookingStatus?: string;
  patientName: string;
  patientRelationship: string;
  familyMemberId?: string | null;
  advice: string;
  timeframe: string;
  targetDate?: string;
  status: "pending_booking" | "scheduled" | "completed" | "cancelled";
  statusLabel: string;
  statusVariant: "warning" | "primary" | "success" | "neutral";
  hasPrescription: boolean;
  medicinesCount: number;
  hasReports: boolean;
  reportsCount: number;
  diagnosis?: string;
  prescriptionInstructions?: {
    followUpInstructions?: string;
    specialDietaryAdvice?: string;
    activityRestrictions?: string;
  } | null;
  medicalNotes?: string;
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  linkedAppointmentStatus?: string;
  linkedDisplayAppointmentId?: string;
  videoQuotaAvailable?: boolean;
}

export interface FollowUpCenterResponse {
  success: boolean;
  message?: string;
  followUps: FollowUpOverviewItem[];
  stats: {
    total: number;
    pendingBooking: number;
    scheduled: number;
    completed: number;
  };
  patient: {
    _id: string;
    name: string;
    familyMembers?: FamilyMember[];
  };
}

export interface FollowUpOverviewParams {
  familyMemberId?: string;
  status?: "all" | "pending_booking" | "scheduled" | "completed" | "cancelled";
  search?: string;
}

// ---------------------------------------------------------------------------
// SMART MEDICATION & PRESCRIPTION REMINDER CENTER
// ---------------------------------------------------------------------------

export interface MedicationReminderLog {
  _id?: string;
  scheduledTime: string;
  scheduledDate: string;
  status: "taken" | "skipped" | "snoozed" | "pending";
  actionTime?: string | null;
  snoozeUntil?: string | null;
  notes?: string;
}

export interface MedicationReminder {
  _id: string;
  userId: string;
  familyMemberId?: string | null;
  patientName?: string;
  patientRelationship?: string;
  appointmentId: string;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  timing?: string;
  doctorId?: string;
  doctorName?: string;
  hospitalId?: string;
  hospitalName?: string;
  reminderTimes: string[];
  frequencyType: "daily" | "twice_daily" | "thrice_daily" | "custom";
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  logs?: MedicationReminderLog[];
  lastAction?: "taken" | "skipped" | "snoozed" | "none";
  lastActionAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodayMedicationDose {
  reminderId: string;
  appointmentId: string;
  medicineName: string;
  dosage: string;
  timing: string;
  instructions: string;
  doctorName: string;
  hospitalName: string;
  scheduledTime: string;
  scheduledDate: string;
  status: "taken" | "skipped" | "snoozed" | "pending";
  actionTime?: string | null;
  snoozeUntil?: string | null;
  patientName?: string;
  patientRelationship?: string;
  familyMemberId?: string | null;
}

export interface AvailablePrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
  hasActiveReminder: boolean;
}

export interface AvailablePrescriptionItem {
  appointmentId: string;
  displayAppointmentId: string;
  date: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  patientName: string;
  patientRelationship: string;
  familyMemberId?: string | null;
  diagnosis: string;
  medicines: AvailablePrescriptionMedicine[];
}

export interface MedicationRemindersResponse {
  success: boolean;
  message?: string;
  reminders: MedicationReminder[];
  todayReminders: TodayMedicationDose[];
  stats: {
    activeReminders: number;
    todayTotal: number;
    todayTaken: number;
    todaySkipped: number;
    todayPending: number;
  };
  availablePrescriptions: AvailablePrescriptionItem[];
  patient: {
    _id: string;
    name: string;
    familyMembers?: FamilyMember[];
  };
}

export interface CreateMedicationReminderPayload {
  appointmentId: string;
  medicineName: string;
  reminderTimes: string[];
  frequencyType?: "daily" | "twice_daily" | "thrice_daily" | "custom";
  startDate?: string;
  endDate?: string;
}

export interface RecordMedicationActionPayload {
  action: "taken" | "skipped" | "snoozed";
  scheduledTime?: string;
  scheduledDate?: string;
  snoozeMinutes?: number;
  notes?: string;
}

export interface MedicationRemindersParams {
  familyMemberId?: string;
  status?: "active" | "all";
  date?: string;
}

export interface PatientMedicalHistoryResponse {
  success: boolean;
  message?: string;
  summary: {
    totalConsultations: number;
    totalPrescriptions: number;
    totalReports: number;
    totalDiagnoses: number;
  };
  consultations: Appointment[];
  prescriptions: Appointment[];
  reports: PatientReportItem[];
  diagnoses: PatientDiagnosisItem[];
  followUps: PatientFollowUpItem[];
}

// ---------------------------------------------------------------------------
// SMART HEALTH GOALS & WELLNESS PROGRESS CENTER
// ---------------------------------------------------------------------------

export type HealthGoalType =
  | "appointment_adherence"
  | "medication_adherence"
  | "followup_completion"
  | "record_organization";

export type HealthGoalStatus = "active" | "paused" | "completed" | "cancelled";

export interface HealthGoal {
  _id: string;
  userId: string;
  familyMemberId?: string | null;
  title: string;
  goalType: HealthGoalType;
  target: number;
  current: number;
  startDate: string;
  endDate?: string | null;
  status: HealthGoalStatus;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HealthGoalProgress {
  current: number;
  target: number;
  percentage: number;
  hasEnoughData: boolean;
  label: string;
}

export interface HealthGoalsResponse {
  success: boolean;
  message?: string;
  goals: HealthGoal[];
  stats: {
    total: number;
    active: number;
    completed: number;
    paused: number;
  };
  patient?: {
    _id: string;
    name: string;
    familyMembers?: FamilyMember[];
  };
}

export interface CreateHealthGoalPayload {
  title: string;
  goalType: HealthGoalType;
  target: number;
  startDate: string;
  endDate?: string;
  familyMemberId?: string;
}

export interface UpdateHealthGoalPayload {
  title?: string;
  target?: number;
  endDate?: string | null;
  status?: HealthGoalStatus;
}

export type TimelineFilterType =
  | "all"
  | "appointments"
  | "consultations"
  | "prescriptions"
  | "reports"
  | "followups";

export type PatientTimelineEventType =
  | "appointment"
  | "payment"
  | "consultation"
  | "prescription"
  | "report"
  | "followup";

export interface PatientTimelineDoctor {
  _id?: string;
  name: string;
  speciality: string;
  department?: string;
  qualification?: string;
  image?: string;
  rating?: number;
}

export interface PatientTimelineHospital {
  _id?: string;
  name: string;
  address?: string;
  city?: string;
}

export interface PatientTimelineAction {
  label: string;
  type: "navigate";
  route: string;
  params?: Record<string, string>;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
}

export interface PatientTimelineEvent {
  id: string;
  appointmentId: string;
  displayAppointmentId?: string;
  eventType: PatientTimelineEventType;
  filterCategory: TimelineFilterType;
  date: string;
  time: string;
  timestamp: number;
  status: "completed" | "current" | "upcoming" | "cancelled";
  badgeLabel: string;
  badgeVariant:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "error"
    | "neutral";
  title: string;
  description: string;
  details?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  doctor: PatientTimelineDoctor;
  hospital: PatientTimelineHospital;
  department?: string;
  consultationType?: "clinic" | "video";
  prescriptionDetails?: {
    medicinesCount: number;
    medicines?: {
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    }[];
    instructions?: {
      dietInstructions?: string;
      generalInstructions?: string;
      followUpInstructions?: string;
      additionalNotes?: string;
    };
  };
  reportDetails?: {
    name: string;
    url: string;
    type?: string;
    category?: string;
    filename?: string;
    mimeType?: string;
  };
  followUpAdvice?: string;
  actions: PatientTimelineAction[];
}

export interface PatientTimelineSummary {
  totalEvents: number;
  totalAppointments: number;
  totalConsultations: number;
  totalPrescriptions: number;
  totalReports: number;
  totalFollowUps: number;
  nextAppointment?: {
    appointmentId: string;
    displayAppointmentId?: string;
    date: string;
    time: string;
    doctorName: string;
    hospitalName: string;
    consultationType: string;
  } | null;
  lastConsultation?: {
    appointmentId: string;
    displayAppointmentId?: string;
    date: string;
    time: string;
    doctorName: string;
    hospitalName: string;
    diagnosis?: string;
  } | null;
}

export interface PatientTimelinePagination {
  page: number;
  limit: number;
  totalEvents: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PatientTimelineResponse {
  success: boolean;
  message?: string;
  summary: PatientTimelineSummary;
  pagination: PatientTimelinePagination;
  events: PatientTimelineEvent[];
}

export interface PatientMedicalOverview {
  totalAppointments: number;
  completedConsultations: number;
  upcomingAppointments: number;
  prescriptionsCount: number;
  medicalRecordsCount: number;
  reportsCount: number;
  reviewsSubmitted: number;
}

export interface HealthActivityItem {
  id: string;
  type: "consultation" | "prescription" | "report" | "status" | "notification";
  title: string;
  description: string;
  date: string;
  timestamp: number;
  icon: string;
  tint: string;
  badgeLabel?: string;
  badgeVariant?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "error"
    | "neutral";
  route?: string;
  routeParams?: Record<string, string>;
}

export interface AppointmentDetails {
  /** Mongo ObjectId â same as mongoAppointmentId (backend may omit one). */
  _id?: string;
  appointmentId: string;
  displayAppointmentId?: string;
  mongoAppointmentId: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorDepartment?: string;
  doctorDegree?: string;
  doctorImage?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalCity?: string;
  hospitalPhone?: string;
  hospitalLogo?: string;
  hospitalMapsUrl?: string;
  doctorPhone?: string;
  doctorEmail?: string;
  doctorSignatureImage?: string;
  bookingDate?: string;
  bookingTime?: string;
  slotDate?: string;
  slotTime?: string;
  date?: string;
  time?: string;
  amount?: number;
  billing?: AppointmentBilling;
  bookingStatus?: string;
  bookingStatusLabel?: string;
  patientName?: string;
  patientPhone?: string;
  familyMemberId?: string;
  familyRelationship?: FamilyRelationship;
  isFamilyBooking?: boolean;
  statusHistory?: AppointmentStatusHistoryItem[];
  medicalReports?: AppointmentMedicalReportItem[];
  appointmentHistory?: unknown[];
  reminders?: unknown[];
  patientHistory?: unknown[];
  payment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  meetingUrl?: string;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
  diagnosis?: string;
  prescription?: string;
  medicines?: AppointmentMedicineItem[];
  followUpAdvice?: string;
  medicalNotes?: string;
  isReviewed?: boolean;
  reviewId?: string;
  checkedIn?: boolean;
  checkInAt?: string;
  queueToken?: string;
  queueStatus?:
    | "not_checked_in"
    | "waiting"
    | "called"
    | "in_consultation"
    | "completed"
    | "cancelled";
  calledAt?: string;
  preparation?: AppointmentPreparationState;
  originalAppointmentId?: string;
  followUp?: {
    required?: boolean;
    recommendedDate?: string;
    timeframe?: string;
    notes?: string;
    linkedFollowUpAppointmentId?: string;
    status?: "none" | "recommended" | "scheduled" | "completed" | "overdue";
    updatedAt?: string;
  };
  createdAt?: string;
}

export interface AvailableSlotsResponse {
  success: boolean;
  doctorId: string;
  slotDate: string;
  availableSlots: string[];
  totalSlots: number;
}

export interface BookAppointmentPayload {
  doctorId: string;
  slotDate: string; // DD-MM-YYYY
  slotTime: string; // "09:00 AM"
  paymentMethod?: PaymentMethod;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  familyMemberId?: string;
  patientName?: string;
  patientRelationship?: FamilyRelationship;
  patientPhone?: string;
  patientGender?: string;
  patientDob?: string;
  originalAppointmentId?: string;
}

export interface BookAppointmentResponse {
  success: boolean;
  message?: string;
  appointment: Appointment;
  razorpayOrder?: RazorpayOrder | null;
  razorpayKey?: string;
}

export interface ReschedulePayload {
  slotDate: string;
  slotTime: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationCategory =
  | "appointments"
  | "payments"
  | "consultations"
  | "prescriptions"
  | "reports"
  | "referrals"
  | "consent"
  | "documents"
  | "subscriptions"
  | "security"
  | "operations"
  | "general";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationChannel = "in_app" | "push" | "email" | "sms";

export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface NotificationPreferences {
  channels: {
    inApp: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: {
    appointments: boolean;
    payments: boolean;
    consultations: boolean;
    prescriptions: boolean;
    reports: boolean;
    referrals: boolean;
    consent: boolean;
    documents: boolean;
    subscriptions: boolean;
    security: boolean;
  };
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
  };
  pushTokens?: string[];
}

export interface Notification {
  _id: string;
  type?: string;
  eventType?: string;
  eventId?: string;
  dedupKey?: string;
  category?: NotificationCategory | string;
  title: string;
  message: string;
  isRead: boolean;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  deliveryStatus?: NotificationDeliveryStatus;
  link?: string;
  actorName?: string;
  createdAt?: string;
  updatedAt?: string;
  readAt?: string;
  sentAt?: string;
  recipientRole?: string;
  hospitalId?: string;
  refModel?: string;
  refId?: string;
  metadata?: {
    familyMemberName?: string;
    inQuietHours?: boolean;
    [key: string]: unknown;
  };
}

export interface NotificationsResponse {
  success: boolean;
  message?: string;
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  page?: number;
  totalPages?: number;
}

export interface NotificationPreferencesResponse {
  success: boolean;
  message?: string;
  preferences: NotificationPreferences;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export interface Review {
  _id?: string;
  patientId?: string | { _id: string; name?: string; image?: string };
  doctorId?:
    | string
    | {
        _id: string;
        name?: string;
        speciality?: string;
        image?: string;
        hospitalName?: string;
      };
  doctorName?: string;
  patientName?: string;
  hospitalId?:
    | string
    | {
        _id: string;
        name?: string;
        location?: unknown;
        coverImage?: string;
        logo?: string;
      };
  hospitalName?: string;
  appointmentId?:
    | string
    | {
        _id: string;
        slotDate?: string;
        slotTime?: string;
        consultationType?: string;
        status?: string;
        appointmentId?: string;
      };
  name?: string;
  email?: string;
  rating: number;
  title?: string;
  comment: string;
  tags?: string[];
  avatar?: string;
  isApproved?: boolean;
  isHidden?: boolean;
  createdAt?: string;
}

export interface CreateReviewPayload {
  doctorId: string;
  appointmentId?: string;
  hospitalId?: string;
  hospitalName?: string;
  name?: string;
  email?: string;
  rating: number;
  title?: string;
  comment: string;
  tags?: string[];
  avatar?: string;
}

// ---------------------------------------------------------------------------
// Profile update
// ---------------------------------------------------------------------------
export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  image?: Blob | { uri: string; name?: string; type?: string } | null;
}

export interface FavoriteDoctor {
  doctorId: string;
  addedAt?: string;
}

export interface FavoriteHospital {
  hospitalId: string;
  addedAt?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token: string;
  user: User;
  sessionId: string;
}

/**
 * Doctor-account subset returned by the doctor portal auth endpoints. Doctors
 * live in their own `doctors` collection (separate from the patient/admin
 * `users` collection), so their login uses `/doctor/login` and the session is
 * revalidated via `/doctor/panel/:id`.
 */
export interface DoctorAccount {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  image?: string;
  /** Backend copies `email` into this field on the doctor login response. */
  portalEmail?: string;
  speciality?: string;
  department?: string;
  hospitalId?: string;
  hospitalName?: string;
  isActive?: boolean;
  verificationStatus?: string;
}

/** Hospital context resolved by the backend during doctor authentication. */
export interface DoctorHospitalContext {
  _id: string;
  name?: string;
  slug?: string;
  logo?: string | null;
}

export interface DoctorLoginResponse {
  success: boolean;
  message?: string;
  token: string;
  doctor: DoctorAccount;
  /** Server-resolved hospital for the authenticated doctor. */
  hospital?: DoctorHospitalContext | null;
}

export interface DoctorPanelResponse {
  success: boolean;
  message?: string;
  doctor?: DoctorAccount;
}

/** Doctor signup mirrors the web doctor panel + backend `signupDoctor`. */
export interface DoctorSignupPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  hospitalId: string;
  department?: string;
  category?: string;
  speciality?: string;
  specialization?: string;
  experience: number | string;
}

export interface DoctorSignupResponse {
  success: boolean;
  message?: string;
  doctor?: DoctorAccount;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  user: User;
}

export interface VerifyOtpResponse {
  success: boolean;
  message?: string;
  resetToken: string;
}

// ---------------------------------------------------------------------------
// Appointment status / consultation / payment
// ---------------------------------------------------------------------------
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancel"
  | "rescheduled"
  | "missed";

export type ConsultationType = "clinic" | "video";
export type ConsultationMode = "scheduled" | "instant";
export type MeetingStatus = "not_created" | "ready" | "started" | "completed";
export type ConsultationStatus =
  | "waiting"
  | "doctor_ready"
  | "ready_to_join"
  | "in_progress"
  | "completed"
  | "unavailable";
export type PaymentMethod = "cash" | "online";

/**
 * Canonical payment states used once the backend has been wired to Razorpay.
 * The backend owns the state machine and never marks a payment SUCCESS before
 * it has verified the Razorpay signature. These mirror the server contract.
 */
export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

/**
 * Razorpay order created server-side (with the Key Secret) and returned to the
 * app. `amount` is in the smallest currency unit (paise for INR) as Razorpay
 * returns it.
 */
export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string; // 'INR'
}

/**
 * Shape returned by `POST /appointment/payment/order/:appointmentId` â the
 * endpoint that creates (or re-creates) a Razorpay order for an existing
 * booking so a pending/failed payment can be retried.
 */
export interface CreatePaymentOrderResponse {
  success: boolean;
  message?: string;
  appointmentId: string;
  razorpayOrder?: RazorpayOrder | null;
  razorpayKey?: string;
}

/**
 * Shape returned by `POST /appointment/verify-payment`. `success` is only true
 * once the backend has verified the Razorpay signature against its own secret.
 */
export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  appointment?: AppointmentDetails | null;
}
// ---------------------------------------------------------------------------
// Subscriptions (Super Admin + Hospital Admin)
// ---------------------------------------------------------------------------
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "expired"
  | "cancelled"
  | "suspended"
  | "past_due";

export type SubscriptionBillingCycle = "monthly" | "yearly" | "none";
export type SubscriptionPaymentStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refunded"
  | "n/a";

export interface SubscriptionPlanFeatureDetail {
  code: string;
  label: string;
  included: boolean;
  detail?: string;
}

export interface SubscriptionPricingMetrics {
  billingInterval: "monthly" | "yearly" | "free";
  price: number;
  referenceMonthlyPrice?: number;
  annualizedMonthlyCost?: number;
  annualSavings: number;
  savingsPercentage: number;
  effectiveMonthlyPrice: number;
  exactEffectiveMonthlyPrice?: number;
  effectiveDailyPrice: number;
  monthsFree: number;
  costPerConsultation: number;
  totalAnnualVisits: number;
}

export interface SubscriptionPlan {
  _id: string;
  key:
    | "free"
    | "care_starter"
    | "care_plus"
    | "care_pro"
    | "family_care"
    | "family_prime"
    | "annual_care_pro"
    | "annual_family_prime"
    | "gold"
    | "platinum"
    | "prime"
    | "basic"
    | "professional"
    | "premium"
    | "enterprise"
    | (string & {});
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  price?: number;
  billingInterval?: "monthly" | "yearly" | "free";
  referenceMonthlyPlanKey?: string | null;
  currency: string;
  features: string[];
  featureDetails?: SubscriptionPlanFeatureDetail[];
  pricingMetrics?: SubscriptionPricingMetrics;
  familyMembersLimit?: number;
  badge?: string;
  isActive: boolean;
  trialDays: number;
  sortOrder: number;
  subscriberCount: number;
  /** Monthly video consultations included (0 for Free, 2-10 for monthly, or Super Admin configured). */
  videoConsultationsMonthly?: number;
  /** Healthcare-themed plan picture/artwork (stored on the plan record). */
  imageUrl?: string;
  /** Optional short marketing description shown on the plan card. */
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionHistoryEntry {
  _id?: string;
  action: string;
  note?: string;
  fromStatus?: string;
  toStatus?: string;
  changedBy?: string;
  changedByName?: string;
  createdAt: string;
}

export interface SubscriptionPlanSnapshot {
  planId?: string;
  planKey?: string;
  name?: string;
  billingInterval?: string;
  price?: number;
  currency?: string;
  videoConsultationsMonthly?: number;
  familyMembersLimit?: number;
  features?: string[];
  badge?: string;
  purchasedAt?: string;
  planVersion?: number;
}

export interface SubscriptionPaymentRecord {
  _id?: string;
  amount: number;
  currency?: string;
  billingCycle: Extract<SubscriptionBillingCycle, "monthly" | "yearly">;
  paymentStatus: Exclude<SubscriptionPaymentStatus, "n/a">;
  method?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  receiptNumber?: string;
  failureReason?: string;
  verifiedAt?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface Subscription {
  _id: string;
  userId?: string;
  hospitalId?: string | Hospital;
  hospital?: Hospital | null;
  hospitalName?: string;
  planId?: string;
  planKey?: string;
  planName: string;
  planDetails?: SubscriptionPlan | null;
  planSnapshot?: SubscriptionPlanSnapshot;
  pendingDowngradePlanKey?: string | null;
  pendingDowngradeDate?: string | null;
  lastRenewalDate?: string | null;
  status: SubscriptionStatus;
  startDate?: string;
  expiryDate?: string;
  amount: number;
  billingCycle: SubscriptionBillingCycle;
  paymentStatus: SubscriptionPaymentStatus;
  autoRenew: boolean;
  videoConsultationsAllowance?: number;
  videoConsultationsUsed?: number;
  videoConsultationsRemaining?: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  history: SubscriptionHistoryEntry[];
  payments: SubscriptionPaymentRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionReceipt {
  receiptNumber: string;
  issuedAt: string;
  status: string;
  subscriber: {
    name: string;
    email: string;
    type: string;
  };
  plan: {
    key: string;
    name: string;
    billingInterval: string;
    videoConsultationsQuota: number;
    familyMembersLimit: number;
    features: string[];
  };
  payment: {
    gateway: string;
    currency: string;
    amountPaid: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    method?: string;
  };
  coveragePeriod: {
    startDate?: string;
    expiryDate?: string;
    durationDays: number;
  };
  issuer: {
    company: string;
    system: string;
    website: string;
    supportEmail: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    financials?: any;
  } | null;
}

export interface SubscriptionReconciliationIssue {
  _id: string;
  issueId: string;
  issueType:
    | "payment_verified_sub_inactive"
    | "sub_active_payment_unverified"
    | "missing_plan_reference"
    | "amount_snapshot_mismatch"
    | "quota_entitlement_mismatch"
    | "expired_still_active"
    | "failed_activation_orphaned"
    | "renewal_overdue";
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "auto_repaired" | "manually_resolved" | "dismissed";
  subscriptionId: string;
  userId?: string | null;
  hospitalId?: string | null;
  subscriberName: string;
  subscriberType: "patient" | "hospital";
  planKey: string;
  evidence: Record<string, any>;
  paymentReference?: {
    orderId?: string;
    paymentId?: string;
    amount?: number;
    status?: string;
  };
  planSnapshot?: SubscriptionPlanSnapshot;
  currentEntitlement?: any;
  recommendedResolution?: string;
  autoRepairEligible: boolean;
  resolutionAction?: string;
  resolutionNotes?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionReconciliationOverview {
  totalSubscriptions: number;
  activeCount: number;
  pastDueCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  openIssuesCount: number;
  autoRepairedCount: number;
  manuallyResolvedCount: number;
}

export interface SubscriptionRenewalItem {
  hospitalId: string;
  hospitalName?: string;
  planName?: string;
  planKey?: string;
  status?: string;
  expiryDate?: string;
  amount?: number;
}

export interface SubscriptionOverview {
  totalHospitals: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  activeCount: number;
  trialCount: number;
  expiredCount: number;
  cancelledCount: number;
  suspendedCount: number;
  pastDueCount: number;
  revenue: number;
  paidRevenue: number;
  upcomingRenewals: SubscriptionRenewalItem[];
  expiringCount: number;
  expiringSubscriptions: SubscriptionRenewalItem[];
}

export interface SubscriptionListResponse {
  success: boolean;
  message?: string;
  totalCount: number;
  page: number;
  limit: number;
  subscriptions: Subscription[];
}

export interface SubscriptionDetailResponse {
  success: boolean;
  message?: string;
  subscription: Subscription;
}

export interface SubscriptionPlansResponse {
  success: boolean;
  message?: string;
  plans: SubscriptionPlan[];
}

export type SubscriptionEntitlementCode =
  | "consultation_available"
  | "quota_exhausted"
  | "subscription_required"
  | "appointment_not_eligible";

export interface FeatureCatalogItem {
  key: string;
  name: string;
  description: string;
  type: "boolean" | "quota" | "limit" | "access";
  unit?: string;
  isSupported: boolean;
  defaultForFree: boolean;
  dependencies: string[];
}

export interface PlanFeatureMatrixItem {
  planKey: string;
  name: string;
  billingInterval: string;
  videoConsultationsMonthly: number;
  familyMembersLimit: number;
  features: {
    key: string;
    name: string;
    description: string;
    type: string;
    unit?: string;
    isIncluded: boolean;
    limit: number | null;
    dependencies: string[];
  }[];
}

export interface PlanValidationIssue {
  code: string;
  message: string;
}

export interface PlanValidationResponse {
  success: boolean;
  validation: {
    isValid: boolean;
    issues: PlanValidationIssue[];
    warnings: PlanValidationIssue[];
    planKey?: string;
    name?: string;
    price?: number;
    videoLimit?: number;
    familyLimit?: number;
  };
}

export interface EntitlementOverride {
  _id?: string;
  featureKey: string;
  overrideValue: any;
  reason: string;
  authorizedByName?: string;
  validFrom?: string;
  validUntil?: string | null;
  isActive?: boolean;
}

export interface UserFeatureEntitlementItem {
  featureKey: string;
  name: string;
  description: string;
  type: string;
  unit?: string;
  isIncluded: boolean;
  limit: number | null;
  remaining: number | null;
  source: string;
}

export interface UserSubscriptionEntitlement {
  hasActiveSubscription: boolean;
  planKey: string;
  planName: string;
  monthlyQuota: number;
  videoConsultationsMonthly?: number;
  familyMembersLimit?: number;
  usedThisMonth: number;
  remainingQuota: number;
  isEligibleForVideoConsultation: boolean;
  code: SubscriptionEntitlementCode;
  message: string;
  billingInterval?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  expiryDate?: string;
  startDate?: string;
  canUpgrade?: boolean;
  activePlan?: SubscriptionPlan;
  featureMap?: Record<string, boolean>;
  featureMatrix?: UserFeatureEntitlementItem[];
  activeOverrides?: EntitlementOverride[];
}

export interface SubscriptionEntitlementResponse {
  success: boolean;
  message?: string;
  entitlement: UserSubscriptionEntitlement;
}

export interface SubscriptionInvoice {
  _id: string;
  invoiceNumber: string;
  transactionType: "SUBSCRIPTION";
  subscriptionId?: string;
  userId?: string;
  hospitalId?: string;
  subscriberSnapshot: {
    name: string;
    email: string;
    phone?: string;
    billingAddress?: string;
    subscriberType: "patient" | "hospital";
  };
  planSnapshot: {
    planId?: string;
    planKey: string;
    name: string;
    billingInterval: "monthly" | "yearly" | "free" | string;
    price: number;
    currency: string;
    videoConsultationsMonthly: number;
    familyMembersLimit: number;
    features: string[];
    badge?: string;
    planVersion?: number;
  };
  coveragePeriod: {
    startDate: string;
    expiryDate: string;
    durationDays: number;
  };
  paymentDetails: {
    gateway: string;
    razorpayOrderId?: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    receiptNumber?: string;
    method: string;
    paidAt: string;
    verifiedAt: string;
  };
  financials: {
    currency: string;
    baseAmount: number;
    discountAmount: number;
    isTaxApplicable: boolean;
    taxName: string;
    taxRate: number;
    taxAmount: number;
    taxIdentificationNumber?: string;
    hsnSacCode?: string;
    taxCalculationMode: "not_configured" | "exclusive" | "inclusive" | string;
    totalAmount: number;
  };
  status: "paid" | "pending" | "failed" | "refunded" | "void";
  refundDetails?: {
    isRefunded: boolean;
    refundAmount: number;
    razorpayRefundId?: string;
    refundedAt?: string;
    reason?: string;
  };
  issuerSnapshot?: {
    legalEntityName: string;
    registeredAddress: string;
    supportEmail: string;
    website: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionTaxConfig {
  _id?: string;
  isEnabled: boolean;
  taxName: string;
  taxRate: number;
  taxIdentificationNumber: string;
  hsnSacCode: string;
  legalEntityName: string;
  registeredAddress: string;
  supportEmail: string;
  taxCalculationMode: "exclusive" | "inclusive";
  notes?: string;
  version: number;
  versionHistory?: Array<{
    version: number;
    isEnabled: boolean;
    taxName?: string;
    taxRate?: number;
    taxIdentificationNumber?: string;
    hsnSacCode?: string;
    taxCalculationMode?: string;
    updatedByName?: string;
    reason?: string;
    effectiveFrom: string;
  }>;
  lastUpdatedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingOverviewMetrics {
  totalRevenue: number;
  totalTaxCollected: number;
  totalBaseAmount: number;
  totalPaidInvoices: number;
  totalInvoices: number;
  averageOrderValue: number;
}

export interface BillingOverview {
  metrics: BillingOverviewMetrics;
  taxConfig: {
    isEnabled: boolean;
    taxName: string;
    taxRate: number;
    taxIdentificationNumber: string;
    hsnSacCode: string;
    taxCalculationMode: string;
    version: number;
  };
  cycleBreakdown: Array<{ _id: string; count: number; revenue: number }>;
  recentInvoices: SubscriptionInvoice[];
}

export interface InvoiceListResponse {
  success: boolean;
  invoices: SubscriptionInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type SubscriptionListSort = "renewal" | "amount" | "hospital" | "recent";

// ---------------------------------------------------------------------------
// Smart Subscription Offers, Coupons & Promotion Engine Types
// ---------------------------------------------------------------------------

export type PromotionDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromotionBillingCycle = "monthly" | "yearly" | "both";
export type PromotionEligibility = "all" | "first_time_only" | "returning_only";
export type PromotionStatus =
  | "draft"
  | "active"
  | "scheduled"
  | "expired"
  | "disabled";

export interface PromotionRedemption {
  _id?: string;
  userId?: string;
  hospitalId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  discountApplied: number;
  finalPayableAmount: number;
  planKey: string;
  billingCycle: string;
  redeemedAt: string;
}

export interface SubscriptionPromotion {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  discountType: PromotionDiscountType;
  discountValue: number;
  applicablePlans: string[];
  applicableBillingCycles: PromotionBillingCycle;
  startDate: string;
  endDate: string;
  usageLimit: number;
  timesRedeemed: number;
  perUserLimit: number;
  minimumPlanAmount: number;
  maxDiscountAmount?: number;
  customerEligibility: PromotionEligibility;
  status: PromotionStatus;
  stackableWithOtherDiscounts: boolean;
  priority: number;
  redemptions?: PromotionRedemption[];
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionValidationPricing {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  discountType: PromotionDiscountType;
  discountValue: number;
  currency: string;
}

export interface PromotionValidationResponse {
  success: boolean;
  valid: boolean;
  code: string;
  message: string;
  pricing?: PromotionValidationPricing;
  promotion?: {
    id: string;
    code: string;
    name: string;
    discountType: PromotionDiscountType;
    discountValue: number;
    description?: string;
  };
}

export interface PromotionAnalyticsOverview {
  success: boolean;
  summary: {
    totalPromotions: number;
    activePromotions: number;
    totalRedemptions: number;
    totalDiscountDistributed: number;
    associatedRevenueGenerated: number;
    avgDiscountPerRedemption: number;
  };
  topPerformers: Array<{
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
    timesRedeemed: number;
    totalDiscountDistributed: number;
    associatedRevenue: number;
    status: string;
  }>;
  recentRedemptions: Array<{
    code: string;
    promoName: string;
    userId?: string;
    hospitalId?: string;
    discountApplied: number;
    finalPayableAmount: number;
    planKey: string;
    billingCycle: string;
    redeemedAt: string;
  }>;
}

export interface PromotionListResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  promotions: SubscriptionPromotion[];
}

export interface PromotionRedemptionsResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  code: string;
  name: string;
  redemptions: PromotionRedemption[];
}

// ---------------------------------------------------------------------------
// Platform analytics / stats (Super Admin)
// ---------------------------------------------------------------------------
export interface PlatformStats {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalHospitals: number;
  totalAppointments: number;
  earnings: number;
  missedAppointments: number;
}

export interface PlatformAnalytics {
  totalHospitals: number;
  activeHospitals: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  appointmentStatusCounts: { _id: string; count: number }[];
}

export interface AppointmentStatusCount {
  _id: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Platform users (Super Admin)
// ---------------------------------------------------------------------------
export interface PlatformUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  gender?: string;
  dob?: string;
  role?: UserRole;
  isAdmin?: boolean;
  isActive?: boolean;
  authProvider?: string;
  hospital?: Pick<Hospital, "_id" | "name" | "slug" | "isActive"> | null;
  hospitalId?: string | Hospital;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformUsersResponse {
  success: boolean;
  totalCount: number;
  page: number;
  limit: number;
  users: PlatformUser[];
}

// ---------------------------------------------------------------------------
// Web messages (Super Admin / Hospital Admin)
// ---------------------------------------------------------------------------
export interface WebMessage {
  _id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  isRead?: boolean;
  adminReply?: string;
  repliedAt?: string;
  userId?: string;
  createdAt?: string;
}

export interface WebMessagesResponse {
  success: boolean;
  message?: string;
  totalCount: number;
  webMessages: WebMessage[];
}

// ---------------------------------------------------------------------------
// Hospital Admin (own hospital only)
// ---------------------------------------------------------------------------
export interface HospitalAdminDashboardResponse {
  success: boolean;
  hospital: Hospital;
  doctors: Doctor[];
  patients: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    image?: string;
    gender?: string;
    dob?: string;
    createdAt?: string;
  }[];
  appointments: Appointment[];
  reviews: Review[];
  notifications: Notification[];
  dashboard: {
    totals: {
      doctors: number;
      patients: number;
      today: number;
      pending: number;
      completed: number;
      revenue: number;
    };
    weekly: { label: string; value: number }[];
    monthly: { label: string; value: number }[];
  };
}
// ---------------------------------------------------------------------------
// Online consultation (Google Meet) â mirrors routes/consultationRoutes.js
// ---------------------------------------------------------------------------

export interface OnlineDoctor extends Doctor {
  onlineStatus?: "online" | "offline";
  onlineConsultationEnabled?: boolean;
  instantConsultationEnabled?: boolean;
  nextAvailableSlot?: {
    date: string;
    time: string;
    slotCountToday: number;
    weekday: string;
  } | null;
  hospital?: Pick<Hospital, "_id" | "name" | "logo"> | null;
}

export interface OnlineDoctorsResponse {
  success: boolean;
  message?: string;
  totalCount: number;
  doctors: OnlineDoctor[];
}

export interface ConsultationJoinView {
  allowed: boolean;
  reason?: string | null;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
}

export interface CareJourney {
  steps: { key: string; label: string }[];
  currentIndex: number;
  current: string;
}

export interface ConsultationDoctorSummary {
  _id: string;
  name: string;
  speciality?: string;
  department?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  hospitalName?: string;
}

export interface PatientConsultation {
  _id: string;
  appointmentId?: string;
  doctor: ConsultationDoctorSummary | null;
  hospitalName?: string;
  slotDate?: string;
  slotTime?: string;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  status: AppointmentStatus;
  payment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  amount?: number;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
  diagnosis?: string;
  prescription?: string;
  followUpAdvice?: string;
  medicines?: AppointmentMedicineItem[];
  isReviewed?: boolean;
  reviewId?: string;
  createdAt?: string;
}

export interface PatientConsultationDetail extends PatientConsultation {
  meetingUrl?: string;
  join?: ConsultationJoinView;
  careJourney?: CareJourney;
}

export interface PatientConsultationsResponse {
  success: boolean;
  totalCount: number;
  consultations: PatientConsultation[];
}

export interface PatientConsultationDetailResponse {
  success: boolean;
  message?: string;
  consultation: PatientConsultationDetail;
}

export interface PatientMeetingLinkResponse {
  success: boolean;
  allowed: boolean;
  message?: string;
  meetingUrl?: string;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
  subscriptionCode?: SubscriptionEntitlementCode;
  quotaRemaining?: number;
  monthlyQuota?: number;
}

export interface DoctorConsultationPatient {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
  image?: string;
  gender?: string;
  dob?: string;
}

export interface DoctorConsultation {
  _id: string;
  appointmentId?: string;
  patient?: DoctorConsultationPatient | null;
  slotDate?: string;
  slotTime?: string;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  amount?: number;
  status: AppointmentStatus;
  payment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  meetingStatus?: MeetingStatus;
  consultationStatus?: ConsultationStatus;
  consultationStartedAt?: string;
  consultationCompletedAt?: string;
  diagnosis?: string;
  prescription?: string;
  followUpAdvice?: string;
  createdAt?: string;
  meetingUrl?: string;
  join?: ConsultationJoinView;
}

export interface DoctorConsultationsResponse {
  success: boolean;
  totalCount: number;
  consultations: DoctorConsultation[];
}

export interface ConsultationActionResponse {
  success: boolean;
  message?: string;
  appointment?: DoctorConsultation;
}

export interface HospitalConsultationStats {
  success: boolean;
  stats: {
    total: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    activeOnlineDoctors: number;
    revenue: number;
  };
  doctors?: (Pick<Doctor, "_id" | "name" | "speciality"> & {
    onlineConsultationEnabled?: boolean;
    onlineStatus?: "online" | "offline";
  })[];
  recent?: unknown[];
}

export interface SuperAdminConsultationStats {
  success: boolean;
  stats: {
    total: number;
    upcoming: number;
    completed: number;
    cancelled: number;
    activeOnlineDoctors: number;
    consultationRevenue: number;
    statusBreakdown: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Doctor Clinical Workspace 2.0
// ---------------------------------------------------------------------------

export interface ClinicalVitals {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  spO2?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface ClinicalNotes {
  chiefComplaint?: string;
  symptoms?: string;
  historyOfPresentIllness?: string;
  examination?: string;
  clinicalFindings?: string;
  assessment?: string;
  treatmentPlan?: string;
  additionalNotes?: string;
}

export interface StructuredMedicineItem {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  timing?: string;
  instructions?: string;
}

export interface PrescriptionInstructions {
  dietInstructions?: string;
  generalInstructions?: string;
  followUpInstructions?: string;
  additionalNotes?: string;
  labTestsAdvised?: string;
}

export interface HistoricalVitalsEntry {
  appointmentId: string;
  date?: string;
  time?: string;
  vitals: ClinicalVitals;
}

export interface HistoricalPrescriptionEntry {
  date?: string;
  prescription: string;
  diagnosis?: string;
}

export interface PreviousConsultationSummary {
  date?: string;
  diagnosis?: string;
  notes?: string;
  prescription?: string;
  followUpAdvice?: string;
}

export interface DoctorConsultationContextResponse {
  success: boolean;
  appointment: Appointment;
  patient: User;
  previousVitals: HistoricalVitalsEntry[];
  previousDiagnoses: string[];
  previousPrescriptions: HistoricalPrescriptionEntry[];
  previousConsultationSummary: PreviousConsultationSummary | null;
  totalVisits: number;
  consentStatus?: {
    isRestricted: boolean;
    accessType: string;
    reason?: string;
  };
  clinicalAuthorizations?: ClinicalAuthorizationRecord[];
  clinicalHandovers?: ClinicalHandoverRecord[];
}

export interface SaveDoctorConsultationPayload {
  vitals?: ClinicalVitals;
  clinicalNotes?: ClinicalNotes;
  diagnosis?: string;
  prescription?: string;
  medicines?: StructuredMedicineItem[];
  prescriptionInstructions?: PrescriptionInstructions;
  followUpAdvice?: string;
  medicalNotes?: string;
  allergies?: string[];
  chronicConditions?: string[];
  bloodGroup?: string;
}

export interface CompleteDoctorConsultationPayload extends SaveDoctorConsultationPayload {
  // At least diagnosis or notes are validated on backend
}

export interface SaveDoctorPrescriptionPayload {
  diagnosis?: string;
  prescription?: string;
  medicines?: StructuredMedicineItem[];
  prescriptionInstructions?: PrescriptionInstructions;
  medicalNotes?: string;
  followUpAdvice?: string;
  reports?: AppointmentMedicalReportItem[];
}

export interface DoctorQueueItem extends Appointment {
  queueStage?:
    | "in_consultation"
    | "checked_in"
    | "waiting"
    | "completed"
    | "cancelled";
  queueToken?: string;
  estimatedWaitMinutes?: number;
}

export interface DoctorPatientQueueSummary {
  todayDate: string;
  doctorName: string;
  hospitalName: string;
  department: string;
  totalToday: number;
  waitingCount: number;
  checkedInCount: number;
  inConsultationCount: number;
  completedCount: number;
  cancelledCount: number;
  currentConsultation: DoctorQueueItem | null;
}

export interface DoctorPatientQueueResponse {
  success: boolean;
  summary: DoctorPatientQueueSummary;
  queue: DoctorQueueItem[];
  sections: {
    inConsultation: DoctorQueueItem[];
    checkedIn: DoctorQueueItem[];
    waiting: DoctorQueueItem[];
    completed: DoctorQueueItem[];
    cancelled: DoctorQueueItem[];
  };
}

export interface DoctorAppointmentsListResponse {
  success: boolean;
  appointments: Appointment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  counts: {
    all: number;
    today: number;
    upcoming: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
}

// -------------------------------------------------------------
// Hospital Financial Intelligence & Revenue Center Types
// -------------------------------------------------------------

export interface HospitalFinancialKPIs {
  totalVerifiedRevenue: number;
  totalAppointmentsCount: number;
  paidAppointmentsCount: number;
  pendingRevenue: number;
  pendingAppointmentsCount: number;
  refundedAmount: number;
  refundedCount: number;
  failedAmount: number;
  failedCount: number;
  averageOrderValue: number;
  onlineRevenue: number;
  onlineCount: number;
  cashRevenue: number;
  cashCount: number;
  todayRevenue: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  thisYearRevenue: number;
  lifetimeRevenue: number;
}

export interface PaymentStatusDistributionItem {
  count: number;
  amount: number;
}

export interface PaymentStatusDistribution {
  paid: PaymentStatusDistributionItem;
  cash_pending: PaymentStatusDistributionItem;
  online_pending: PaymentStatusDistributionItem;
  failed: PaymentStatusDistributionItem;
  refunded: PaymentStatusDistributionItem;
  cancelled_unpaid: PaymentStatusDistributionItem;
}

export interface RevenueDailyTrendItem {
  date: string;
  label: string;
  revenue: number;
  count: number;
  paidCount: number;
}

export interface RevenueMonthlyTrendItem {
  monthKey: string;
  label: string;
  revenue: number;
  count: number;
  paidCount: number;
}

export interface DoctorRevenueBreakdownItem {
  doctorId: string;
  doctorName: string;
  speciality: string;
  department: string;
  doctorFees: number;
  image?: string;
  totalAppointments: number;
  completedAppointments: number;
  paidAppointments: number;
  totalVerifiedRevenue: number;
  note: string;
}

export interface DepartmentRevenueBreakdownItem {
  department: string;
  totalAppointments: number;
  paidAppointments: number;
  totalVerifiedRevenue: number;
}

export interface ConsultationModeSplitItem {
  count: number;
  revenue: number;
  paidCount: number;
}

export interface ConsultationModeBreakdown {
  clinic: ConsultationModeSplitItem;
  video: ConsultationModeSplitItem;
}

export interface RefundLogItem {
  _id: string;
  appointmentId: string;
  displayAppointmentId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  doctorDepartment: string;
  amount: number;
  currency: string;
  razorpayRefundId: string;
  razorpayPaymentId: string;
  slotDate: string;
  refundedAt: string | null;
  status: string;
}

export type FinancialReconciliationIssueType =
  | "PAID_BUT_PENDING_CONFIRMATION"
  | "COMPLETED_UNPAID"
  | "ONLINE_CHECKOUT_ABANDONED"
  | "REFUND_STATUS_INCONSISTENCY"
  | "DUPLICATE_PAYMENT_REF";

export interface FinancialReconciliationIssue {
  issueType: FinancialReconciliationIssueType;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  appointmentId: string;
  displayAppointmentId: string;
  patientName: string;
  doctorName: string;
  amount: number;
  slotDate: string;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpayRefundId?: string;
}

export interface FinancialTransactionItem {
  _id: string;
  appointmentId: string;
  displayAppointmentId: string;
  patient: {
    name: string;
    phone: string;
    email: string;
    image?: string;
  };
  doctor: {
    name: string;
    speciality: string;
    department: string;
    fees: number;
  };
  slotDate: string;
  slotTime: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  isVerifiedPaid: boolean;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpayRefundId?: string;
  status: string;
  consultationType: string;
  billing?: {
    consultationFee?: number;
    serviceFee?: number;
    platformFee?: number;
    discount?: number;
    totalAmount?: number;
  };
  paidAt: string | null;
  createdAt: string;
}

export interface HospitalFinancialOverviewResponse {
  success: boolean;
  message?: string;
  hospital: {
    id: string;
    name: string;
  };
  summary: HospitalFinancialKPIs;
  paymentDistribution: PaymentStatusDistribution;
  revenueTrends: {
    daily: RevenueDailyTrendItem[];
    monthly: RevenueMonthlyTrendItem[];
  };
  doctorBreakdown: DoctorRevenueBreakdownItem[];
  departmentBreakdown: DepartmentRevenueBreakdownItem[];
  consultationModeBreakdown: ConsultationModeBreakdown;
  refundsLog: RefundLogItem[];
  reconciliationIssues: FinancialReconciliationIssue[];
  transactions: FinancialTransactionItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Secure Consent & Patient Data Access Management
// ---------------------------------------------------------------------------
export type ConsentCategory =
  | "medical_records"
  | "prescriptions"
  | "reports"
  | "documents"
  | "vitals"
  | "all";

export type ConsentStatus =
  | "active"
  | "revoked"
  | "expired"
  | "pending"
  | "rejected";

export type ConsentAccessLevel =
  | "view_only"
  | "consultation_only"
  | "full_access"
  | "emergency_break_glass";

export type ConsentAccessType =
  | "encounter"
  | "consent"
  | "emergency_break_glass"
  | "direct_owner"
  | "admin_compliance";

export interface PatientConsentRecord {
  _id: string;
  patientId: string;
  familyMemberId?: string;
  patientName: string;
  patientRelationship?: string;
  granteeType: "doctor" | "hospital";
  doctorId?:
    | {
        _id: string;
        name: string;
        speciality?: string;
        department?: string;
        qualification?: string;
        image?: string;
        hospitalName?: string;
      }
    | string;
  doctorName?: string;
  doctorSpeciality?: string;
  hospitalId?:
    | {
        _id: string;
        name: string;
        logo?: string;
        location?: string;
        city?: string;
      }
    | string;
  hospitalName?: string;
  department?: string;
  dataCategories: ConsentCategory[];
  purpose: string;
  accessLevel: ConsentAccessLevel;
  status: ConsentStatus;
  grantedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  requestDetails?: {
    requestedByDoctorId?: string;
    requestedAt?: string;
    requestMessage?: string;
    rejectionReason?: string;
  };
  breakGlassDetails?: {
    isBreakGlass?: boolean;
    justification?: string;
    overrideTime?: string;
    authorizedDoctorId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PatientDataAccessLogItem {
  _id: string;
  patientId: string;
  familyMemberId?: string;
  patientName?: string;
  accessorId: string;
  accessorRole: "Doctor" | "Hospital Admin" | "Patient" | "System";
  accessorName?: string;
  hospitalId?: string;
  hospitalName?: string;
  dataCategory: ConsentCategory | "consultations" | "emr";
  purpose: string;
  accessType: ConsentAccessType;
  consentId?: string;
  appointmentId?: string;
  result: "allowed" | "denied";
  denialReason?: string;
  breakGlassJustification?: string;
  timestamp: string;
}

export interface PatientConsentsResponse {
  success: boolean;
  message?: string;
  consents: PatientConsentRecord[];
  counts: {
    total: number;
    active: number;
    pending: number;
    revoked: number;
    expired: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PatientAccessAuditLogResponse {
  success: boolean;
  message?: string;
  logs: PatientDataAccessLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GrantConsentPayload {
  granteeType?: "doctor" | "hospital";
  doctorId?: string;
  hospitalId?: string;
  dataCategories: ConsentCategory[];
  purpose: string;
  duration:
    | "24_hours"
    | "7_days"
    | "30_days"
    | "90_days"
    | "1_year"
    | "indefinite";
  accessLevel?: ConsentAccessLevel;
  familyMemberId?: string;
}

export interface DoctorConsentStatusResponse {
  success: boolean;
  isAuthorized: boolean;
  accessType: ConsentAccessType;
  reason?: string;
  activeConsent?: PatientConsentRecord | null;
  pendingRequest?: PatientConsentRecord | null;
  allowedCategories: ConsentCategory[];
}

// ---------------------------------------------------------------------------
// Smart Clinical Consent & Treatment Authorization Center
// ---------------------------------------------------------------------------
export type ClinicalAuthorizationType =
  | "consultation_acknowledgement"
  | "online_consultation_acknowledgement"
  | "document_review_authorization"
  | "follow_up_care_acknowledgement"
  | "treatment_care_plan_acknowledgement";

export type ClinicalAuthorizationStatus =
  | "pending"
  | "approved"
  | "declined"
  | "revoked"
  | "expired";

export interface ClinicalAuthorizationRecord {
  _id: string;
  scopeType: "clinical_authorization";
  authorizationType: ClinicalAuthorizationType;
  appointmentId:
    | {
        _id: string;
        slotDate: string;
        slotTime: string;
        consultationType?: string;
        status?: string;
        appointmentId?: string;
        diagnosis?: string;
        prescription?: string;
      }
    | string;
  consultationId?: string;
  patientId: string;
  patientName: string;
  familyMemberId?: string;
  doctorId?:
    | {
        _id: string;
        name: string;
        speciality?: string;
        department?: string;
        image?: string;
      }
    | string;
  doctorName?: string;
  doctorSpeciality?: string;
  hospitalId?:
    | {
        _id: string;
        name: string;
        logo?: string;
        location?: string;
      }
    | string;
  hospitalName?: string;
  department?: string;
  purpose: string;
  status: ClinicalAuthorizationStatus;
  clinicalContext?: {
    title: string;
    summary: string;
    notes?: string;
    actionRequired?: boolean;
  };
  requestDetails?: {
    requestedByDoctorId?: string;
    requestedAt?: string;
    requestMessage?: string;
  };
  respondedAt?: string;
  declinedReason?: string;
  grantedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalAuthorizationsListResponse {
  success: boolean;
  message?: string;
  authorizations: ClinicalAuthorizationRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestClinicalAuthorizationPayload {
  appointmentId: string;
  patientId?: string;
  authorizationType: ClinicalAuthorizationType;
  title?: string;
  summary?: string;
  notes?: string;
  clinicalContext?: {
    title?: string;
    summary?: string;
    notes?: string;
    actionRequired?: string;
  };
  expiresAt?: string;
}

export interface RespondClinicalAuthorizationPayload {
  decision: "approve" | "decline";
  declinedReason?: string;
}

// ---------------------------------------------------------------------------
// Clinical Handover & Care Continuity Center
// ---------------------------------------------------------------------------
export type HandoverType =
  | "doctor_to_doctor_handover"
  | "department_handover"
  | "follow_up_handover";

export type HandoverStatus =
  | "draft"
  | "pending_patient_authorization"
  | "sent"
  | "in_review"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled";

export type HandoverPriority = "routine" | "urgent" | "critical";

export interface HandoverTimelineEntry {
  action: string;
  performedBy?: string;
  performerRole?: string;
  timestamp: string;
  notes?: string;
}

export interface HandoverPendingAction {
  _id?: string;
  title?: string;
  description: string;
  dueDate?: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  isCompleted?: boolean;
}

export interface HandoverFollowUpPlan {
  recommendedIntervalDays?: number;
  recommendedTimeframe?: string;
  specificInstructions?: string;
  instructions?: string;
  suggestedFollowUpDate?: string | null;
}

export interface HandoverSharedContext {
  includeConsultationNotes: boolean;
  includePrescriptions: boolean;
  includeReports: boolean;
  includeVitals: boolean;
  includeFollowUpPlan: boolean;
  consultationNotes?: string;
  activePrescriptionIds?: string[];
  selectedPrescriptionIds?: string[];
  selectedReportIds?: string[];
  latestVitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    weight?: string;
    spo2?: string;
  };
}

export interface HandoverPatientAuthorization {
  required: boolean;
  status: "not_required" | "pending" | "approved" | "declined";
  authorizedAt?: string | null;
  rejectionReason?: string;
}

export interface ClinicalHandoverRecord {
  _id: string;
  handoverDisplayId?: string;
  hospitalId:
    | string
    | { _id: string; name: string; address?: string; phone?: string };
  hospitalName?: string;
  patientId:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        image?: string;
        age?: number;
        gender?: string;
      };
  familyMemberId?: string;
  patientName?: string;
  patientGender?: string;
  patientDob?: string;
  patientPhone?: string;

  originatingDoctorId:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        image?: string;
        speciality?: string;
        department?: string;
      };
  senderDoctorId?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        image?: string;
        speciality?: string;
        department?: string;
      };
  senderDoctorName?: string;

  receivingDoctorId?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        image?: string;
        speciality?: string;
        department?: string;
      };
  recipientDoctorId?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        image?: string;
        speciality?: string;
        department?: string;
      };
  recipientDoctorName?: string;

  fromDepartment?: string;
  toDepartment?: string;
  department?: string;

  originatingAppointmentId?:
    | string
    | {
        _id: string;
        date?: string;
        time?: string;
        slotTime?: string;
        amount?: number;
        status?: string;
      };
  targetAppointmentId?:
    | string
    | {
        _id: string;
        date?: string;
        time?: string;
        slotTime?: string;
        amount?: number;
        status?: string;
      };

  handoverType: HandoverType;
  priority: HandoverPriority;
  status: HandoverStatus;

  reasonForHandover: string;
  reason?: string;
  clinicalSummary: string;

  sharedContext: HandoverSharedContext;
  pendingActions: HandoverPendingAction[];
  followUpPlan: HandoverFollowUpPlan;
  patientAuthorization: HandoverPatientAuthorization;

  acknowledgement?: {
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    notes?: string;
  };
  declineReason?: string;
  outcomeSummary?: string;

  timeline: HandoverTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateHandoverPayload {
  patientId: string;
  familyMemberId?: string | null;
  originatingAppointmentId?: string | null;
  receivingDoctorId?: string | null;
  toDepartment?: string;
  handoverType: HandoverType;
  priority: HandoverPriority;
  clinicalSummary: string;
  reasonForHandover: string;
  sharedContext?: Partial<HandoverSharedContext>;
  pendingActions?: Array<{
    title?: string;
    description: string;
    dueDate?: string | null;
  }>;
  followUpPlan?: Partial<HandoverFollowUpPlan>;
  requiresPatientAuthorization?: boolean;
}

export interface AcceptHandoverPayload {
  notes?: string;
}

export interface DeclineHandoverPayload {
  declineReason: string;
}

export interface CompleteHandoverPayload {
  outcomeSummary: string;
  targetAppointmentId?: string | null;
}

export interface RespondPatientHandoverPayload {
  decision: "approved" | "declined";
  rejectionReason?: string;
}

// ---------------------------------------------------------------------------
// Clinical Referral & Specialist Routing
// ---------------------------------------------------------------------------
export type ReferralStatus =
  | "draft"
  | "pending_patient_authorization"
  | "sent"
  | "in_review"
  | "accepted"
  | "appointment_pending"
  | "appointment_booked"
  | "consultation_completed"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";

export type ReferralUrgency = "routine" | "urgent" | "stat_emergency";

export interface SpecialistRoutingDoctorItem {
  _id: string;
  name: string;
  degree?: string;
  speciality: string;
  department?: string;
  specialization?: string;
  experience?: number;
  rating?: number;
  reviewCount?: number;
  fees?: number;
  image?: string;
  available?: boolean;
}

export interface ReferralTimelineEntry {
  stage: string;
  actorRole: "doctor" | "patient" | "system" | "admin";
  actorId?: string;
  actorName?: string;
  timestamp: string;
  notes?: string;
}

export interface ClinicalReferralRecord {
  _id: string;
  referralDisplayId?: string;
  patientId:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        gender?: string;
        dob?: string;
        image?: string;
      };
  familyMemberId?: string;
  patientName?: string;
  patientGender?: string;
  patientDob?: string;
  patientPhone?: string;

  referringDoctorId:
    | string
    | {
        _id: string;
        name: string;
        speciality?: string;
        department?: string;
        degree?: string;
        image?: string;
        phone?: string;
        email?: string;
      };
  referringDoctorName?: string;

  receivingDoctorId?:
    | string
    | {
        _id: string;
        name: string;
        speciality?: string;
        department?: string;
        degree?: string;
        image?: string;
        fees?: number;
        phone?: string;
        email?: string;
      }
    | null;
  receivingDoctorName?: string;

  hospitalId:
    | string
    | {
        _id: string;
        name: string;
        address?: string;
        phone?: string;
      };
  hospitalName?: string;

  department: string;
  targetSpeciality?: string;

  referralType?: "intra_hospital" | "inter_hospital";
  originatingHospitalId?:
    | string
    | {
        _id: string;
        name: string;
        address?: string;
        phone?: string;
      };
  originatingHospitalName?: string;
  receivingHospitalId?:
    | string
    | {
        _id: string;
        name: string;
        address?: string;
        phone?: string;
      }
    | null;
  receivingHospitalName?: string;
  assignedByAdmin?: {
    adminId?: string;
    adminName?: string;
    assignedAt?: string;
  };
  networkStatus?:
    | "not_applicable"
    | "pending_patient_authorization"
    | "pending_receiving_review"
    | "receiving_accepted"
    | "department_assigned"
    | "doctor_assigned"
    | "appointment_booked"
    | "completed"
    | "receiving_declined"
    | "cancelled"
    | "expired";

  originatingAppointmentId?:
    | string
    | {
        _id: string;
        slotDate?: string;
        slotTime?: string;
        amount?: number;
        consultationType?: string;
      };
  linkedAppointmentId?:
    | string
    | {
        _id: string;
        appointmentId?: string;
        slotDate?: string;
        slotTime?: string;
        status?: string;
        amount?: number;
        consultationType?: string;
      }
    | null;
  clinicalHandoverId?: string | null;

  reasonForReferral: string;
  clinicalSummary: string;
  provisionalDiagnosis?: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;

  sharedContext?: {
    includeConsultationNotes?: boolean;
    includePrescriptions?: boolean;
    includeReports?: boolean;
    includeVitals?: boolean;
    includeFollowUpPlan?: boolean;
    consultationNotesExcerpt?: string;
    prescriptionIds?: string[];
    reportIds?: string[];
  };

  patientAuthorization?: {
    required: boolean;
    status: "not_required" | "pending" | "approved" | "declined";
    requestedAt?: string;
    respondedAt?: string;
    decisionNotes?: string;
  };

  acceptance?: {
    acceptedAt?: string;
    acceptedBy?: string;
    acceptanceNotes?: string;
  };

  decline?: {
    declinedAt?: string;
    declinedBy?: string;
    declineReason?: string;
  };

  completion?: {
    completedAt?: string;
    completedBy?: string;
    outcomeSummary?: string;
  };

  expiresAt?: string;
  timeline: ReferralTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferralPayload {
  patientId: string;
  familyMemberId?: string | null;
  originatingAppointmentId?: string | null;
  receivingDoctorId?: string | null;
  department: string;
  targetSpeciality?: string;
  reasonForReferral: string;
  clinicalSummary: string;
  provisionalDiagnosis?: string;
  urgency?: ReferralUrgency;
  sharedContext?: {
    includeConsultationNotes?: boolean;
    includePrescriptions?: boolean;
    includeReports?: boolean;
    includeVitals?: boolean;
    includeFollowUpPlan?: boolean;
    consultationNotesExcerpt?: string;
    prescriptionIds?: string[];
    reportIds?: string[];
  };
  followUpContext?: {
    recommendedTimeframe?: string;
    instructions?: string;
  };
  requiresPatientAuthorization?: boolean;
}

export interface AcceptReferralPayload {
  acceptanceNotes?: string;
}

export interface DeclineReferralPayload {
  declineReason: string;
}

export interface RespondPatientReferralPayload {
  decision: "approved" | "declined";
  decisionNotes?: string;
}

export interface LinkReferralAppointmentPayload {
  appointmentId: string;
}

export interface NetworkReferralHospitalItem {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  image?: string;
  departments?: string[];
  totalDoctors?: number;
  availableDoctorsCount?: number;
}

export interface CreateNetworkReferralPayload {
  patientId: string;
  familyMemberId?: string | null;
  originatingAppointmentId?: string | null;
  receivingHospitalId: string;
  department: string;
  targetSpeciality?: string;
  receivingDoctorId?: string | null;
  reasonForReferral: string;
  clinicalSummary: string;
  provisionalDiagnosis?: string;
  urgency?: ReferralUrgency;
  sharedContext?: {
    includeConsultationNotes?: boolean;
    includePrescriptions?: boolean;
    includeReports?: boolean;
    includeVitals?: boolean;
    includeFollowUpPlan?: boolean;
    consultationNotesExcerpt?: string;
    prescriptionIds?: string[];
    reportIds?: string[];
  };
  followUpContext?: {
    recommendedTimeframe?: string;
    instructions?: string;
  };
}

export interface AssignDepartmentPayload {
  department: string;
}

export interface AssignDoctorPayload {
  doctorId: string;
}

export interface HospitalNetworkStatsResponse {
  incomingTotal: number;
  incomingPendingReview: number;
  incomingAwaitingAssignment: number;
  incomingAccepted: number;
  incomingCompleted: number;
  outgoingTotal: number;
  outgoingPendingConsent: number;
  outgoingAccepted: number;
}

// ---------------------------------------------------------------------------
// Smart Healthcare Document Intelligence & OCR Types
// ---------------------------------------------------------------------------
export type DocumentProcessingStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "partially_processed"
  | "failed";

export interface ExtractedTestResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange?: string;
  flag?: "normal" | "high" | "low" | string;
}

export interface ExtractedMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export interface DocumentExtractedMetadata {
  documentTitle?: string;
  documentType?: string;
  documentDate?: string;
  patientName?: string;
  doctorName?: string;
  hospitalName?: string;
  referenceNumber?: string;
  confidence?: number;
  testResults?: ExtractedTestResult[];
  medicines?: ExtractedMedicine[];
}

export interface DocumentUserCorrections {
  isCorrected?: boolean;
  correctedAt?: string;
  correctedBy?: string;
  originalExtracted?: Record<string, unknown>;
  notes?: string;
  verifiedByUser?: boolean;
  verifiedAt?: string;
}

export interface HealthDocumentRecord {
  _id: string;
  userId: string;
  uploadedBy: string;
  familyMemberId?: string | null;
  patientName: string;
  patientRelationship?: string;
  title: string;
  category: string;
  documentDate?: string;
  notes?: string;
  filename: string;
  originalName?: string;
  url: string;
  mimeType?: string;
  size?: number;
  contentHash?: string;
  processingStatus: DocumentProcessingStatus;
  processingError?: string;
  processedAt?: string;
  ocrProvider?: string;
  extractedText?: string;
  extractedMetadata?: DocumentExtractedMetadata;
  userCorrections?: DocumentUserCorrections;
  doctorSummary?: {
    summary?: string;
    generatedAt?: string;
  };
  retryCount?: number;
  lastRetriedAt?: string;
  sharedWith?: {
    _id?: string;
    doctorId: string | { _id: string; name: string; speciality?: string };
    sharedAt?: string;
    note?: string;
  }[];
  linkedAppointmentId?: unknown;
  linkedDoctorId?: unknown;
  linkedHospitalId?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDocumentMetadataPayload {
  title?: string;
  category?: string;
  documentDate?: string;
  doctorName?: string;
  hospitalName?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface DocumentSearchResponse {
  success: boolean;
  query?: string;
  documents: HealthDocumentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// Observability & System Reliability
// ---------------------------------------------------------------------------
export type ServiceHealthStatus =
  | "Operational"
  | "Degraded"
  | "Attention Required"
  | "Unavailable"
  | "Unknown";

export interface ServiceHealthItem {
  id: string;
  name: string;
  category: string;
  status: ServiceHealthStatus;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface ApiTelemetrySummary {
  uptimeSeconds: number;
  totalRequests: number;
  successRequests: number;
  clientErrors: number;
  serverErrors: number;
  errorRatePct: number;
  reqPerMinute: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  statusDistribution: Record<string, number>;
  topRoutes?: {
    path: string;
    requests: number;
    errors: number;
    errorRatePct: number;
    avgLatencyMs: number;
  }[];
}

export interface SystemIncident {
  _id: string;
  incidentId: string;
  service: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "detected" | "acknowledged" | "investigating" | "resolved" | "closed";
  affectedOperation?: string;
  correlationIds?: string[];
  errorCount?: number;
  lastErrorSnippet?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  acknowledgedBy?: {
    id?: string;
    name?: string;
    role?: string;
    at?: string;
  };
  resolvedBy?: {
    id?: string;
    name?: string;
    role?: string;
    at?: string;
  };
  resolutionNotes?: string;
  hospitalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemErrorLogItem {
  _id: string;
  correlationId?: string;
  service: string;
  route: string;
  method: string;
  statusCode: number;
  errorCategory: string;
  sanitizedMessage: string;
  durationMs?: number;
  occurredAt: string;
  hospitalId?: string;
  userId?: string;
}

export interface SystemHealthResponse {
  success: boolean;
  overallStatus: ServiceHealthStatus;
  timestamp: string;
  totalDurationMs: number;
  servicesCount: number;
  operationalCount: number;
  degradedCount: number;
  unavailableCount: number;
  activeIncidentsCount?: number;
  telemetry?: ApiTelemetrySummary;
  services: ServiceHealthItem[];
}

export interface IncidentsResponse {
  success: boolean;
  incidents: SystemIncident[];
  totalCount: number;
  activeCount: number;
  resolvedCount: number;
  page: number;
  totalPages: number;
}

export interface ErrorsResponse {
  success: boolean;
  errors: SystemErrorLogItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Smart Backup, Disaster Recovery & Data Integrity Center
// ---------------------------------------------------------------------------
export type BackupType =
  | "database_full"
  | "documents_storage"
  | "system_combined";
export type BackupStatus = "pending" | "in_progress" | "completed" | "failed";
export type VerificationStatus = "unverified" | "verified" | "failed";
export type RecoveryTestStatus =
  | "not_tested"
  | "previewed"
  | "dry_run_passed"
  | "failed";

export interface BackupRecord {
  _id: string;
  backupId: string;
  type: BackupType;
  status: BackupStatus;
  sourceEnvironment: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256?: string;
  recordsCount?: Record<string, number>;
  fileCount?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  initiatedBy?: {
    id?: string;
    name?: string;
    role?: string;
    mode: "manual" | "automated_schedule";
  };
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verificationDetails?: {
    checkedAt?: string;
    sizeVerified?: boolean;
    checksumMatches?: boolean;
    archiveIntegrity?: boolean;
    error?: string;
  };
  recoveryTestStatus: RecoveryTestStatus;
  recoveryTestedAt?: string;
  recoveryTestNotes?: string;
  failureReason?: string;
  retentionDays?: number;
  isRestorable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryChecklistItem {
  id: string;
  title: string;
  description: string;
  verified: boolean;
  statusText: string;
  lastChecked: string | null;
}

export interface BackupOverviewResponse {
  success: boolean;
  overview: {
    totalBackups: number;
    latestDatabaseBackup: {
      backupId: string;
      completedAt: string;
      sizeBytes: number;
      ageMinutes: number | null;
      verificationStatus: VerificationStatus;
    } | null;
    latestDocumentsBackup: {
      backupId: string;
      completedAt: string;
      sizeBytes: number;
      fileCount: number;
      ageMinutes: number | null;
      verificationStatus: VerificationStatus;
    } | null;
    latestVerifiedBackup: {
      backupId: string;
      verifiedAt: string;
    } | null;
    latestRecoveryTest: {
      backupId: string;
      testedAt: string;
      status: RecoveryTestStatus;
    } | null;
    recoveryReadiness: string;
    readinessPct: number;
    checklist: RecoveryChecklistItem[];
    integrityStatus: string;
  };
}

export interface BackupListResponse {
  success: boolean;
  backups: BackupRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BackupDetailResponse {
  success: boolean;
  backup: BackupRecord;
}

export interface RecoveryPreviewResponse {
  success: boolean;
  message?: string;
  preview: {
    backupId: string;
    type: BackupType;
    createdTimestamp: string;
    sizeBytes: number;
    sourceEnvironment: string;
    collectionsInArchive: string[];
    collectionCounts: Record<string, number>;
    schemaCompatibility: {
      status: string;
      inspectedModels: string[];
      missingInCurrentApp: string[];
    };
    safetyGuardrails: {
      productionTargetProtected: boolean;
      requiresExplicitConfirmation: boolean;
      destructiveDirectRestoreDisabled: boolean;
      isolatedDryRunVerified: boolean;
    };
    recommendedAction: string;
  };
}

export interface IntegrityCategoryStats {
  status: "healthy" | "issues_detected" | "not_checked";
  checkedCount: number;
  issueCount: number;
}

export interface IntegrityIssueItem {
  entityType: string;
  recordId: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  detectedAt: string;
  recommendedAction: string;
}

export interface DataIntegrityScanReport {
  scannedAt: string;
  overallStatus: "healthy" | "issues_detected";
  totalIssues: number;
  orphanRecordsCount: number;
  duplicateRecordsCount: number;
  categories: {
    appointments: IntegrityCategoryStats;
    payments: IntegrityCategoryStats;
    clinical_records: IntegrityCategoryStats;
    documents_storage: IntegrityCategoryStats;
    referrals_handovers: IntegrityCategoryStats;
    consents: IntegrityCategoryStats;
    family_data: IntegrityCategoryStats;
    audit_trail: IntegrityCategoryStats;
  };
  issues: IntegrityIssueItem[];
}

export interface DataIntegrityResponse {
  success: boolean;
  message?: string;
  report: DataIntegrityScanReport;
}

export interface RecoveryChecklistResponse {
  success: boolean;
  checklist: RecoveryChecklistItem[];
  verifiedCount: number;
  totalCount: number;
  readinessPct: number;
  readinessStatus: string;
}

// ---------------------------------------------------------------------------
// Smart Data Migration & Environment Management Center
// ---------------------------------------------------------------------------
export type EnvironmentType = "development" | "staging" | "production";

export interface ConfigHealthItem {
  subsystem: string;
  key: string;
  status: string;
  isHealthy: boolean;
  detail: string;
}

export interface EnvironmentMismatch {
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  message: string;
  recommendation: string;
}

export interface EnvironmentOverviewResponse {
  success: boolean;
  environment: EnvironmentType;
  application: {
    name: string;
    backendVersion: string;
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
  };
  database: {
    provider: string;
    driver: string;
    connectionState: string;
    hostType: string;
  };
  configurationHealth: ConfigHealthItem[];
  mismatches: EnvironmentMismatch[];
  safeApiBaseUrl: string;
}

export type MigrationCategory =
  | "schema"
  | "index"
  | "master_data"
  | "configuration";
export type MigrationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "rolled_back";

export interface RegisteredMigration {
  version: string;
  name: string;
  category: MigrationCategory;
  description: string;
  affectedCollections: string[];
  riskLevel: "low" | "medium" | "high";
  rollbackSupported: boolean;
  status: MigrationStatus;
  executedAt?: string | null;
  durationMs?: number | null;
  recordsAffected?: number;
  actor?: string | null;
}

export interface RegisteredMigrationsResponse {
  success: boolean;
  migrations: RegisteredMigration[];
}

export interface DataMigrationRecord {
  _id: string;
  migrationId: string;
  version: string;
  name: string;
  category: MigrationCategory;
  environment: EnvironmentType;
  status: MigrationStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  actor?: {
    id?: string;
    name?: string;
    role?: string;
    mode: "manual" | "automated_deployment";
  };
  affectedCollections: string[];
  recordsAffected: number;
  errorSummary?: string;
  rollbackSupported: boolean;
  rolledBackAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationHistoryResponse {
  success: boolean;
  history: DataMigrationRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MigrationPreviewResponse {
  success: boolean;
  preview: {
    version: string;
    name: string;
    category: MigrationCategory;
    description: string;
    targetEnvironment: EnvironmentType;
    affectedCollections: string[];
    riskLevel: "low" | "medium" | "high";
    rollbackSupported: boolean;
    safetyNotice: string;
  };
}

export interface DatabaseCollectionStatus {
  name: string;
  count: number;
  sizeBytes: number;
  avgObjSizeBytes: number;
  indexesCount: number;
  indexNames: string[];
}

export interface DatabaseCollectionsResponse {
  success: boolean;
  collections: DatabaseCollectionStatus[];
  totalCollections: number;
  totalDocuments: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Smart Healthcare Interoperability & Secure Data Exchange Center
// ---------------------------------------------------------------------------

export type ExternalSystemType =
  | "Hospital"
  | "Laboratory"
  | "Diagnostic Center"
  | "EMR/EHR"
  | "Pharmacy"
  | "Other Healthcare System";

export type ConnectionStatus =
  | "not_configured"
  | "configured"
  | "connected"
  | "failed"
  | "disabled";

export type InteroperabilityAuthType =
  | "api_key"
  | "oauth2"
  | "mutual_tls"
  | "webhook_secret"
  | "none";

export interface ExternalHealthcareSystem {
  _id: string;
  systemKey: string;
  name: string;
  systemType: ExternalSystemType;
  organization: string;
  environment: "development" | "staging" | "production";
  integrationVersion: string;
  connectionStatus: ConnectionStatus;
  authType: InteroperabilityAuthType;
  endpointUrl?: string;
  healthCheckUrl?: string;
  maskedCredentialPreview: string;
  supportedResources: string[];
  supportedDirections: "inbound" | "outbound" | "bidirectional";
  hospitalId?: string;
  isGlobal?: boolean;
  lastHealthCheckAt?: string;
  lastHealthCheckResult?: {
    status: "healthy" | "unhealthy" | "unreachable" | "pending";
    latencyMs: number;
    statusCode?: number;
    message: string;
  };
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ExchangeDirection = "inbound" | "outbound";

export type ExchangeStatus =
  | "pending"
  | "validating"
  | "authorized"
  | "sending"
  | "received"
  | "accepted"
  | "processed"
  | "rejected"
  | "failed"
  | "conflict"
  | "cancelled";

export type ExchangeResourceType =
  | "Patient"
  | "Appointment"
  | "Encounter"
  | "Medication"
  | "Observation"
  | "Document"
  | "Referral"
  | "Bundle";

export type ExchangeErrorCategory =
  | "none"
  | "validation_failed"
  | "consent_denied"
  | "network_timeout"
  | "authentication_failed"
  | "conflict_detected"
  | "schema_mismatch"
  | "rate_limited"
  | "internal_error";

export interface InteroperabilityExchange {
  _id: string;
  exchangeId: string;
  direction: ExchangeDirection;
  externalSystemId: string;
  systemKey: string;
  systemName: string;
  systemType: string;
  hospitalId?: string;
  hospitalName?: string;
  patientId?: string;
  familyMemberId?: string;
  patientName?: string;
  dataScope: string[];
  resourceType: ExchangeResourceType;
  status: ExchangeStatus;
  mappingVersion?: string;
  correlationId: string;
  idempotencyKey?: string;
  sourceRecordId?: string;
  consentId?: string;
  consentVerified: boolean;
  consentPolicySummary?: string;
  authorizedBy?: {
    userId?: string;
    role?: string;
    name?: string;
  };
  recordsCount: number;
  payloadSummary?: {
    recordType?: string;
    fieldsCount?: number;
    identifier?: string;
    sourceCategory?: string;
  };
  conflictDetails?: {
    hasConflict: boolean;
    conflictingField?: string;
    localValue?: string;
    incomingValue?: string;
    resolutionStatus?: string;
  };
  errorCategory: ExchangeErrorCategory;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InteroperabilityMappingField {
  healpointField: string;
  externalField: string;
  direction: "inbound" | "outbound" | "bidirectional";
  transformType:
    | "direct"
    | "date_iso"
    | "string_trim"
    | "number_cast"
    | "status_map"
    | "custom";
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface InteroperabilityMapping {
  _id: string;
  mappingId: string;
  name: string;
  version: string;
  resourceType: ExchangeResourceType;
  systemType: string;
  fieldMappings: InteroperabilityMappingField[];
  isActive: boolean;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InteroperabilityStats {
  totalExchanges: number;
  inboundCount: number;
  outboundCount: number;
  processedCount: number;
  failedCount: number;
  conflictCount: number;
  activeSystemsCount: number;
  successRate: number;
  recentErrors: Array<{
    exchangeId: string;
    systemName: string;
    resourceType: string;
    errorCategory: string;
    errorMessage: string;
    createdAt: string;
  }>;
}

export interface PatientExchangeHistoryItem {
  exchangeId: string;
  direction: ExchangeDirection;
  recipientOrganization: string;
  recipientType: string;
  sharedDataScope: string[];
  resourceType: ExchangeResourceType;
  status: ExchangeStatus;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Health Data Portability & Secure Health Export
// ---------------------------------------------------------------------------

export type HealthExportCategory =
  | "demographics"
  | "appointments"
  | "consultations"
  | "prescriptions"
  | "reports"
  | "documents"
  | "timeline"
  | "follow_ups"
  | "billing"
  | "hospital_pass";

export type HealthExportFormat = "json" | "csv";

export type HealthExportStatus =
  | "requested"
  | "preparing"
  | "ready"
  | "downloaded"
  | "expired"
  | "failed"
  | "cancelled";

export type HealthExportShareRecipientType =
  | "doctor"
  | "hospital"
  | "external_system"
  | "family_member";

export type HealthExportShareStatus =
  | "active"
  | "expired"
  | "revoked"
  | "accessed"
  | "failed";

export interface HealthExportRecordsSummary {
  demographics: number;
  appointments: number;
  consultations: number;
  prescriptions: number;
  reports: number;
  documents: number;
  timeline: number;
  follow_ups: number;
  billing: number;
  hospital_pass: number;
  totalRecords: number;
}

export interface HealthExportJob {
  _id: string;
  exportId: string;
  patientId: string;
  patientName: string;
  familyMemberId?: string;
  familyMemberName?: string;
  categories: HealthExportCategory[];
  dateRange: {
    type: "all" | "custom";
    from?: string;
    to?: string;
  };
  format: HealthExportFormat;
  status: HealthExportStatus;
  correlationId: string;
  fileSize?: number;
  checksum?: string;
  recordsSummary?: HealthExportRecordsSummary;
  generatedAt?: string;
  completedAt?: string;
  expiresAt: string;
  downloadedAt?: string;
  downloadCount: number;
  maxDownloads: number;
  shareCount: number;
  errorCategory?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportShare {
  _id: string;
  shareId: string;
  exportJobId: string;
  exportId: string;
  patientId: string;
  patientName: string;
  familyMemberId?: string;
  recipientType: HealthExportShareRecipientType;
  recipientId?: string;
  recipientName: string;
  recipientDetail?: string;
  categories: HealthExportCategory[];
  dateRange?: {
    type: "all" | "custom";
    from?: string;
    to?: string;
  };
  consentId?: string;
  maskedTokenPreview: string;
  status: HealthExportShareStatus;
  expiresAt: string;
  accessedAt?: string;
  accessCount: number;
  revokedAt?: string;
  revokeReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportDataSummaryResponse {
  patientName: string;
  subjectName: string;
  familyMemberName?: string;
  availableCategories: HealthExportCategory[];
  recordsSummary: HealthExportRecordsSummary;
  totalRecords: number;
}

export interface ExportPreviewResult {
  patientName: string;
  subjectName: string;
  familyMemberName?: string;
  selectedCategories: HealthExportCategory[];
  recordsSummary: Record<string, number>;
  totalRecords: number;
  dateRange: {
    type: "all" | "custom";
    from?: string;
    to?: string;
  };
  format: HealthExportFormat;
  reusableExportAvailable: boolean;
  reusableExportId?: string;
}

export interface ExportAccessHistoryResponse {
  recentExports: HealthExportJob[];
  recentShares: HealthExportShare[];
  accessLogs: Array<{
    _id: string;
    patientName: string;
    accessorRole: string;
    accessorName: string;
    dataCategory: string;
    purpose: string;
    accessType: string;
    result: string;
    timestamp: string;
  }>;
}

export interface SuperAdminExportMonitoringData {
  metrics: {
    totalExports: number;
    readyExports: number;
    preparingExports: number;
    failedExports: number;
    expiredExports: number;
    totalShares: number;
    activeShares: number;
    revokedShares: number;
  };
  securityConfig: {
    maxDailyExportsPerPatient: number;
    defaultRetentionHours: number;
    maxDownloadsPerPackage: number;
    storageStrategy: string;
    encryptionAtRest: string;
    shortLivedTokenExpiryMinutes: number;
  };
  recentJobs: HealthExportJob[];
}

// ---------------------------------------------------------------------------
// Smart Subscription Analytics & Cohort Intelligence Center
// ---------------------------------------------------------------------------

export interface SubscriptionAnalyticsKPIs {
  totalRegisteredUsers: number;
  freeUsersCount: number;
  activePaidSubscribers: number;
  activeMonthlySubscribers: number;
  activeYearlySubscribers: number;
  newSubscriptionsPeriod: number;
  renewalsPeriod: number;
  expiredSubscriptionsPeriod: number;
  cancellationsPeriod: number;
  upgradesPeriod: number;
  downgradesPeriod: number;
  verifiedRevenuePeriod: number;
  verifiedRevenueAllTime: number;
  failedPaymentsPeriodCount: number;
  failedPaymentsPeriodAmount: number;
  pendingPaymentsPeriodCount: number;
  arpu: number;
}

export interface PlanPerformanceMetric {
  key: string;
  name: string;
  billingInterval: string;
  catalogPrice: number;
  subscribersTotal: number;
  activeSubscribers: number;
  newPurchasesPeriod: number;
  renewalsPeriod: number;
  cancellationsPeriod: number;
  verifiedRevenue: number;
  videoQuotaPerUser: number;
  totalQuotaAllocated: number;
  totalQuotaUsed: number;
  videoUtilizationRate: number;
  sortOrder: number;
}

export interface ConversionFunnelStage {
  stage: string;
  count: number | null;
  status: "tracked" | "untracked";
  displayValue?: string;
  conversionFromPrevious?: number;
  notes: string;
}

export interface MonthlyVsYearlyComparison {
  monthly: {
    activeSubscribers: number;
    subscribersSharePct: number;
    verifiedRevenue: number;
    revenueSharePct: number;
    averageDurationDays: number;
    videoUtilizationPct: number;
  };
  yearly: {
    activeSubscribers: number;
    subscribersSharePct: number;
    verifiedRevenue: number;
    revenueSharePct: number;
    averageDurationDays: number;
    videoUtilizationPct: number;
  };
}

export interface CohortMetric {
  cohortMonth: string;
  activated: number;
  activeAfter30Days: number;
  retention30dRate: number;
  renewed: number;
  expired: number;
  cancelled: number;
  upgraded: number;
  downgraded: number;
}

export interface SubscriptionAnalyticsResponse {
  success: boolean;
  timeframe: string;
  range: { start: string; end: string };
  freshness: "real_time" | "cached" | "historical";
  cachedSecondsAgo?: number;
  calculatedAt: string;
  kpis: SubscriptionAnalyticsKPIs;
  revenue: {
    verifiedRevenuePeriod: number;
    monthlyRevenuePeriod: number;
    yearlyRevenuePeriod: number;
    verifiedRevenueAllTime: number;
    revenueTrend: Array<{ date: string; revenue: number }>;
  };
  planPerformance: PlanPerformanceMetric[];
  conversionFunnel: {
    freeToPaidConversionRatePct: number;
    paymentVerificationRatePct: number;
    stages: ConversionFunnelStage[];
  };
  monthlyVsYearly: MonthlyVsYearlyComparison;
  cohorts: CohortMetric[];
  churn: {
    churnRatePct: number;
    definition: string;
    breakdown: {
      voluntaryCancellations: number;
      naturalExpirations: number;
      paymentFailuresPastDue: number;
    };
  };
  retention: {
    retentionRatePct: number;
    definition: string;
  };
  videoUtilization: {
    totalIncludedQuota: number;
    totalConsumedQuota: number;
    totalRemainingQuota: number;
    overallUtilizationPct: number;
    subscribersQuotaExhausted: number;
    subscribersZeroUsage: number;
    quotaAnomaliesCount: number;
  };
  anomalies: {
    totalOpenIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    recentIssues: Array<{
      issueId: string;
      title: string;
      severity: string;
      issueType: string;
      createdAt: string;
    }>;
  };
}

export * from "./dataQuality";
export * from "./policy";

// ---------------------------------------------------------------------------
// Healthcare Case & Incident Management
// ---------------------------------------------------------------------------
export type HealthcareCaseCategory =
  | "APPOINTMENT_BOOKING"
  | "CLINICAL_WORKFLOW"
  | "PAYMENT_BILLING"
  | "SUBSCRIPTION_ENTITLEMENT"
  | "PATIENT_CONSENT_PRIVACY"
  | "CLINICAL_REFERRAL"
  | "DOCUMENT_OCR"
  | "SECURITY_ACCESS"
  | "INTEGRATION_INTEROP"
  | "FACILITY_OPERATIONS"
  | "GENERAL_SUPPORT";

export type HealthcareCaseSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type HealthcareCaseStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

export type HealthcareCaseSource =
  | "MANUAL_ADMIN"
  | "PATIENT_REPORT"
  | "DOCTOR_REPORT"
  | "AUTOMATED_MONITOR"
  | "PAYMENT_RECONCILIATION"
  | "OCR_PIPELINE"
  | "INTEGRATION_SYNC";

export interface HealthcareCaseTimelineEvent {
  _id?: string;
  event: string;
  note?: string;
  performedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface HealthcareCaseInternalNote {
  _id?: string;
  note: string;
  author?: {
    id?: string;
    name?: string;
    role?: string;
  };
  createdAt: string;
  isConfidential?: boolean;
}

export interface HealthcareCase {
  _id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: HealthcareCaseCategory;
  severity: HealthcareCaseSeverity;
  status: HealthcareCaseStatus;
  source: HealthcareCaseSource;
  hospitalId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
      }
    | string;
  patientId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        bloodGroup?: string;
      }
    | string;
  doctorId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        specialization?: string;
        specialty?: string;
        experience?: string;
      }
    | string;
  appointmentId?:
    | {
        _id: string;
        date?: string;
        time?: string;
        appointmentDate?: string;
        appointmentTime?: string;
        status?: string;
        amount?: number;
        paymentStatus?: string;
      }
    | string;
  subscriptionId?:
    | {
        _id: string;
        planKey?: string;
        planName?: string;
        status?: string;
        currentPeriodEnd?: string;
      }
    | string;
  paymentId?: string;
  documentId?:
    | {
        _id: string;
        title?: string;
        category?: string;
        originalName?: string;
        fileType?: string;
      }
    | string;
  referralId?:
    | {
        _id: string;
        referralCode?: string;
        priority?: string;
        status?: string;
        reason?: string;
      }
    | string;
  assignedTo?: {
    id: string;
    name: string;
    role: string;
    assignedAt?: string;
  };
  slaHours: number;
  slaDeadline: string;
  slaBreached: boolean;
  escalated: boolean;
  escalatedAt?: string;
  escalatedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  escalationReason?: string;
  resolutionNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  resolvedAt?: string;
  resolvedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  closedAt?: string;
  closedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  timeline: HealthcareCaseTimelineEvent[];
  internalNotes: HealthcareCaseInternalNote[];
  dedupFingerprint?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthcareCaseKpiSummary {
  total: number;
  active: number;
  open: number;
  inProgress: number;
  escalated: number;
  critical: number;
  slaBreached: number;
  resolvedToday: number;
  avgResolutionHours: number;
}

export interface GetCasesParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  severity?: string;
  hospitalId?: string;
  search?: string;
  sla?: string;
}

export interface CreateCasePayload {
  title: string;
  description: string;
  category: HealthcareCaseCategory;
  severity?: HealthcareCaseSeverity;
  source?: HealthcareCaseSource;
  hospitalId?: string;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  subscriptionId?: string;
  paymentId?: string;
  documentId?: string;
  referralId?: string;
  assignedToUserId?: string;
  metadata?: Record<string, any>;
}

export interface ResolveCasePayload {
  resolutionNotes: string;
  rootCause?: string;
  correctiveAction?: string;
}

// ---------------------------------------------------------------------------
// Smart Patient Service SLA & Escalation Center
// ---------------------------------------------------------------------------
export type ServiceSlaType =
  | "APPOINTMENT_CONFIRMATION"
  | "DOCTOR_ACCEPTANCE"
  | "RESCHEDULE_HANDLING"
  | "CHECKIN_QUEUE"
  | "ONLINE_CONSULTATION_JOIN"
  | "PRESCRIPTION_PREPARATION"
  | "REPORT_DELIVERY"
  | "REFERRAL_HANDOVER"
  | "PAYMENT_RECONCILIATION"
  | "SUBSCRIPTION_RESOLUTION"
  | "DOCUMENT_OCR_PROCESSING"
  | "PATIENT_SUPPORT_RESOLUTION";

export type ServiceSlaSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ServiceSlaStatus =
  | "STARTED"
  | "WITHIN_SLA"
  | "WARNING"
  | "BREACHED"
  | "ESCALATED"
  | "RESOLVED"
  | "CANCELLED";

export type ServiceSlaEscalationLevel =
  | "NONE"
  | "LEVEL_1"
  | "LEVEL_2"
  | "LEVEL_3";

export interface ServiceSlaPolicy {
  _id: string;
  policyKey: string;
  title: string;
  serviceType: ServiceSlaType;
  severity: ServiceSlaSeverity;
  scope: "global" | "hospital";
  hospitalId?: string | { _id: string; name: string };
  targetDurationMinutes: number;
  warningThresholdMinutes: number;
  escalationThresholdMinutes: number;
  escalationTargets?: {
    level1?: { role: string; notify: boolean };
    level2?: { role: string; notify: boolean; autoCreateCase: boolean };
    level3?: { role: string; notify: boolean; autoCreateCase: boolean };
  };
  patientMessageTemplate: string;
  isActive: boolean;
  version: number;
  effectiveDate: string;
  description?: string;
  updatedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SlaEscalationRecord {
  _id?: string;
  level: ServiceSlaEscalationLevel;
  escalatedAt: string;
  escalatedToRole?: string;
  reason?: string;
  caseId?: string | { _id: string; caseNumber: string; status: string };
}

export interface SlaTimelineEvent {
  _id?: string;
  event: string;
  note?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PatientServiceSla {
  _id: string;
  slaNumber: string;
  policyId?: string;
  policyKey: string;
  serviceType: ServiceSlaType;
  severity: ServiceSlaSeverity;
  status: ServiceSlaStatus;
  hospitalId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        city?: string;
        address?: string;
      }
    | string;
  patientId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        bloodGroup?: string;
      }
    | string;
  doctorId?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        specialization?: string;
        specialty?: string;
        experience?: string;
      }
    | string;
  entityType: string;
  entityId: string;
  workflowStage: string;
  startedAt: string;
  targetDeadline: string;
  warningTime: string;
  escalationTime: string;
  resolvedAt?: string;
  cancelledAt?: string;
  actualDurationMinutes?: number;
  isWarningTriggered: boolean;
  isBreached: boolean;
  escalationState: ServiceSlaEscalationLevel;
  escalationHistory: SlaEscalationRecord[];
  linkedCaseId?:
    | {
        _id: string;
        caseNumber: string;
        status: string;
        severity?: string;
        title?: string;
        assignedTo?: { name?: string; role?: string };
      }
    | string;
  patientFriendlyStatus: string;
  timeline: SlaTimelineEvent[];
  dedupFingerprint?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PatientServiceSlaKpiSummary {
  total: number;
  active: number;
  withinSla: number;
  warning: number;
  breached: number;
  escalated: number;
  resolvedToday: number;
  avgResolutionMinutes: number;
}

export interface GetSlaRecordsParams {
  page?: number;
  limit?: number;
  status?: string;
  serviceType?: string;
  severity?: string;
  hospitalId?: string;
  search?: string;
}

export interface PatientSafeSlaStatus {
  tracked: boolean;
  serviceType?: ServiceSlaType;
  status?: "IN_PROGRESS" | "DELAYED" | "RESOLVED";
  friendlyStatus: string;
  isDelayed: boolean;
  startedAt?: string;
  targetDeadline?: string;
  resolvedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Smart Healthcare Service Recovery & Resolution Center
// ---------------------------------------------------------------------------
export type ServiceRecoveryType =
  | "APPOINTMENT_RECOVERY"
  | "QUEUE_CHECKIN_RECOVERY"
  | "ONLINE_CONSULTATION_RECOVERY"
  | "PAYMENT_RECOVERY"
  | "SUBSCRIPTION_RECOVERY"
  | "PRESCRIPTION_REPORT_RECOVERY"
  | "REFERRAL_HANDOVER_RECOVERY"
  | "DOCUMENT_OCR_RECOVERY"
  | "HOSPITAL_OPERATIONAL_RECOVERY"
  | "SUPPORT_ESCALATION_RECOVERY";

export type ServiceRecoveryStatus =
  | "OPEN"
  | "ASSESSING"
  | "ACTION_REQUIRED"
  | "ACTION_IN_PROGRESS"
  | "WAITING_FOR_PATIENT"
  | "WAITING_FOR_HOSPITAL"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

export type ServiceRecoveryPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ServiceRecoveryRootCause =
  | "DELAY"
  | "TECHNICAL_FAILURE"
  | "PROVIDER_UNAVAILABLE"
  | "PAYMENT_GATEWAY_ERROR"
  | "STAFF_ERROR"
  | "COMMUNICATION_BREAKDOWN"
  | "PATIENT_EMERGENCY"
  | "OTHER";

export type ServiceRecoveryResolutionType =
  | "RESCHEDULE"
  | "REFUND"
  | "CREDIT_BENEFIT"
  | "CONSULT_RECONNECTED"
  | "CLINICAL_ESCALATION"
  | "APOLOGY_EXPLANATION"
  | "SERVICE_RESTORED";

export type PatientSatisfactionLevel =
  | "SATISFIED"
  | "NEUTRAL"
  | "DISSATISFIED"
  | "PENDING_SURVEY"
  | "UNREACHABLE";

export type RecoveryActionOutcome =
  | "SUCCESS"
  | "FAILED"
  | "PARTIAL"
  | "PENDING_VERIFICATION";

export interface RecoveryActionRecord {
  _id?: string;
  actionType: string;
  executedAt: string;
  executedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  outcome: RecoveryActionOutcome;
  details?: string;
  metadata?: Record<string, any>;
}

export interface RecoveryTimelineEvent {
  _id?: string;
  event: string;
  note?: string;
  performedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RecoveryInternalNote {
  _id?: string;
  note: string;
  author?: {
    id?: string;
    name?: string;
    role?: string;
  };
  createdAt: string;
  isConfidential: boolean;
}

export interface RecoveryActionEvidence {
  rescheduledAppointmentId?: any;
  newSlotDate?: string;
  newSlotTime?: string;
  razorpayRefundId?: string;
  reconciledPaymentStatus?: string;
  consultationMeetingUrl?: string;
  quotaRestoredCount?: number;
  notificationEventId?: string;
  externalReference?: string;
}

export interface ServiceRecovery {
  _id: string;
  recoveryNumber: string;
  title: string;
  recoveryType: ServiceRecoveryType;
  status: ServiceRecoveryStatus;
  priority: ServiceRecoveryPriority;

  caseId?:
    | {
        _id: string;
        caseNumber: string;
        title: string;
        status: string;
        severity?: string;
      }
    | string;
  slaId?:
    | {
        _id: string;
        slaNumber: string;
        serviceType: string;
        status: string;
        targetDeadline?: string;
      }
    | string;
  hospitalId?:
    | {
        _id: string;
        name: string;
        address?: string;
        phone?: string;
      }
    | string;
  hospitalName?: string;
  patientId?:
    | {
        _id: string;
        name: string;
        phone?: string;
        email?: string;
      }
    | string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  doctorId?:
    | {
        _id: string;
        name: string;
        specialization?: string;
      }
    | string;
  doctorName?: string;
  appointmentId?: any;
  paymentId?: string;

  assignedTo?: {
    id?: string;
    name?: string;
    role?: string;
  };

  rootCauseCategory: ServiceRecoveryRootCause;
  rootCauseDescription: string;

  actionsExecuted: RecoveryActionRecord[];

  resolutionType?: ServiceRecoveryResolutionType;
  resolutionSummary?: string;
  actionEvidence?: RecoveryActionEvidence;

  patientFriendlyStatus: string;
  patientSatisfaction: PatientSatisfactionLevel;
  patientFeedback?: string;

  resolvedAt?: string;
  resolvedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  closedAt?: string;
  closedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };

  timeline: RecoveryTimelineEvent[];
  internalNotes: RecoveryInternalNote[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecoveryKpiSummary {
  total: number;
  open: number;
  actionRequired: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  critical: number;
  activeCount: number;
  resolutionRate: number;
  avgRecoveryMinutes: number;
  satisfactionRate: number;
  satisfactionMap: Record<PatientSatisfactionLevel, number>;
  recoveryByType: Record<string, number>;
}

export interface GetRecoveriesParams {
  page?: number;
  limit?: number;
  status?: string;
  recoveryType?: string;
  priority?: string;
  hospitalId?: string;
  search?: string;
}

export interface ExecuteRecoveryActionPayload {
  actionType:
    | "RESCHEDULE_APPOINTMENT"
    | "RECONCILE_PAYMENT"
    | "RECONNECT_CONSULTATION"
    | "RESTORE_BENEFITS"
    | "DISPATCH_PATIENT_COMMUNICATION";
  payload?: Record<string, any>;
}

export interface ResolveRecoveryPayload {
  resolutionType: ServiceRecoveryResolutionType;
  resolutionSummary: string;
  patientSatisfaction?: PatientSatisfactionLevel;
  patientFeedback?: string;
}

// ---------------------------------------------------------------------------
// Smart Healthcare Customer Support & Service Desk Center
// ---------------------------------------------------------------------------
export type SupportTicketCategory =
  | "APPOINTMENT_BOOKING"
  | "APPOINTMENT_CANCELLATION"
  | "APPOINTMENT_RESCHEDULING"
  | "DOCTOR_FEEDBACK"
  | "PAYMENT_BILLING"
  | "REFUND_REQUEST"
  | "SUBSCRIPTION_BENEFITS"
  | "SUBSCRIPTION_UPGRADE_DOWNGRADE"
  | "ONLINE_CONSULTATION"
  | "PRESCRIPTION_REPORTS"
  | "MEDICAL_RECORDS"
  | "QUEUE_CHECKIN"
  | "REFERRAL"
  | "CLINICAL_HANDOVER"
  | "PRIVACY_DATA"
  | "SECURITY_ACCESS"
  | "TECHNICAL_APP"
  | "GENERAL_ENQUIRY"
  | "FEEDBACK_SUGGESTION"
  | "COMPLAINT";

export type SupportTicketStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_PATIENT"
  | "WAITING_FOR_HOSPITAL"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SupportTicketTeam =
  | "TIER_1_SUPPORT"
  | "TIER_2_SUPPORT"
  | "BILLING_TEAM"
  | "CLINICAL_TEAM"
  | "TECHNICAL_TEAM"
  | "ESCALATIONS_TEAM"
  | "MANAGEMENT";

export interface SupportTicketMessage {
  _id?: string;
  sender: {
    id?: string;
    name: string;
    role: "patient" | "admin" | "doctor" | "agent" | "system";
  };
  body: string;
  isInternalNote?: boolean;
  attachments?: string[];
  sentAt: string;
}

export interface SupportTicketTimelineEvent {
  _id?: string;
  event: string;
  note?: string;
  performedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  timestamp: string;
}

export interface SupportTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  body: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  team?: SupportTicketTeam;

  patientId?:
    | {
        _id: string;
        name: string;
        phone?: string;
        email?: string;
      }
    | string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;

  hospitalId?:
    | {
        _id: string;
        name: string;
      }
    | string;
  hospitalName?: string;

  doctorId?: string;
  familyMemberId?: string;
  appointmentId?: string;
  paymentId?: string;
  subscriptionId?: string;
  consultationId?: string;
  caseId?: string;
  slaId?: string;
  recoveryId?: string;

  assignedTo?: {
    id?: string;
    name?: string;
    role?: string;
    team?: string;
  };
  assignedAt?: string;

  messages: SupportTicketMessage[];
  timeline: SupportTicketTimelineEvent[];

  resolvedAt?: string;
  resolvedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
  resolutionNote?: string;

  closedAt?: string;
  firstResponseAt?: string;
  firstResponseMinutes?: number;

  // legacy backward-compat
  isRead?: boolean;
  adminReply?: string;
  repliedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ServiceDeskKpiSummary {
  total: number;
  open: number;
  triaged: number;
  assigned: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  closed: number;
  waitingForPatient: number;
  waitingForHospital: number;
  critical: number;
  activeCount: number;
  resolutionRate: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  byCategory: Record<string, number>;
  byTeam: Record<string, number>;
}

export interface GetTicketsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  team?: string;
  hospitalId?: string;
  search?: string;
  assignedToMe?: boolean;
}

export interface CreateTicketPayload {
  subject: string;
  body: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  appointmentId?: string;
  paymentId?: string;
  subscriptionId?: string;
  consultationId?: string;
  familyMemberId?: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  hospitalId?: string;
}

export interface PostTicketMessagePayload {
  body: string;
  isInternalNote?: boolean;
}

export interface AssignTicketPayload {
  agentId: string;
  agentName?: string;
  agentRole?: string;
  team?: SupportTicketTeam;
  note?: string;
}

export interface TransitionTicketStatusPayload {
  status: SupportTicketStatus;
  note?: string;
}

export interface EscalateTicketPayload {
  reason: string;
  escalateTo?: SupportTicketTeam;
  createCase?: boolean;
}

export interface ResolveTicketPayload {
  resolutionNote: string;
}

// =============================================================================
// Smart Patient Care Passport Types
// =============================================================================

/** Access scope for a Care Passport QR or share */
export type PassportScope =
  | "APPOINTMENT_ONLY"
  | "CARE_EPISODE"
  | "SHARED_RECORDS";

/** Next action derived from real appointment state */
export interface PassportNextAction {
  key:
    | "PAY_NOW"
    | "AWAIT_CONFIRMATION"
    | "CHECK_IN"
    | "JOIN_CONSULT"
    | "WAITING"
    | "BOOK_FOLLOWUP"
    | "VIEW_PRESCRIPTION"
    | "VIEW_SUMMARY"
    | "REBOOK"
    | "VIEW_DETAILS";
  label: string;
  icon: string;
}

/**
 * A single Care Episode  lightweight summary referencing an existing appointment.
 * Contains NO raw clinical data (no prescription text, no report content).
 */
export interface CarePassportEpisode {
  appointmentId: string;
  displayId: string;
  doctorId: string;
  doctorName: string;
  doctorSpeciality: string;
  doctorImage: string;
  hospitalId: string;
  hospitalName: string;
  department: string;
  slotDate: string;
  slotTime: string;
  consultationType: string;
  status: string;
  paymentStatus: "paid" | "pending";
  checkedIn: boolean;
  checkInAt: string | null;
  queueToken: string | null;
  meetingUrl: string | null;
  // Status flags  presence indicators, not raw clinical text
  hasConsultation: boolean;
  hasPrescription: boolean;
  hasReports: boolean;
  hasFollowUp: boolean;
  // Patient identity (for family member context)
  patientName: string;
  familyMemberId: string | null;
  familyRelationship: string;
  createdAt: string;
  updatedAt: string;
  nextAction: PassportNextAction;
}

/** Care Passport settings */
export interface PassportSettings {
  qrExpiryMinutes: number;
  defaultScope: PassportScope;
  allowHospitalScan: boolean;
  allowDoctorAccess: boolean;
}

/** The assembled Care Passport for a patient or family member */
export interface CarePassport {
  passportId: string;
  userId: string;
  familyMemberId: string | null;
  settings: PassportSettings;
  activeEpisode: CarePassportEpisode | null;
  recentEpisodes: CarePassportEpisode[];
  activeShareCount: number;
  totalAccessEvents: number;
  lastAccessedAt: string | null;
}

/** QR token response from the server */
export interface PassportQRResponse {
  token: string;
  scope: PassportScope;
  expiresAt: string;
  expiryMinutes: number;
  containsPII: boolean;
  containsMedicalData: boolean;
}

/** Result of verifying a scanned Care Passport QR */
export interface PassportVerifyResponse {
  success: boolean;
  scope: PassportScope;
  patientUserId: string;
  familyMemberId: string | null;
  episode: Partial<CarePassportEpisode> | null;
  accessedAt: string;
  reason?: string;
  message?: string;
}

/** An active share record */
export interface PassportShareRecord {
  shareId: string;
  scope: PassportScope;
  expiresAt: string;
  recipientRole: "doctor" | "hospital_admin" | "family" | "self";
  recipientLabel: string;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

/** A passport access event (patient-facing history entry) */
export interface PassportAccessEvent {
  accessedAt: string;
  accessedByRole: string;
  recipientLabel: string;
  hospitalId: string | null;
  scope: PassportScope;
  accessCount: number;
  source: "QR_SCAN";
}

/** Payload to create a share token */
export interface CreatePassportSharePayload {
  familyMemberId?: string | null;
  scope?: PassportScope;
  appointmentId?: string | null;
  recipientRole?: "doctor" | "hospital_admin" | "family" | "self";
  recipientId?: string | null;
  recipientLabel?: string;
  expiryMinutes?: number;
}

/** Settings patch payload */
export interface PatchPassportSettingsPayload {
  familyMemberId?: string | null;
  qrExpiryMinutes?: number;
  defaultScope?: PassportScope;
  allowHospitalScan?: boolean;
  allowDoctorAccess?: boolean;
}

// =============================================================================
// Smart Healthcare Continuity Graph Types
// =============================================================================

export type ContinuityNodeType =
  | "patient"
  | "family_member"
  | "care_episode"
  | "hospital"
  | "department"
  | "doctor"
  | "appointment"
  | "checkin"
  | "consultation"
  | "prescription"
  | "report"
  | "followup"
  | "referral"
  | "handover"
  | "medical_document"
  | "service_recovery";

export type ContinuityRelationshipType =
  | "PATIENT_HAS_CARE_EPISODE"
  | "HOSPITAL_HAS_DEPARTMENT"
  | "DOCTOR_WORKS_IN_DEPARTMENT"
  | "DOCTOR_BELONGS_TO_HOSPITAL"
  | "CARE_EPISODE_CONTAINS_APPOINTMENT"
  | "APPOINTMENT_WITH_DOCTOR"
  | "APPOINTMENT_AT_HOSPITAL"
  | "APPOINTMENT_HAS_CHECKIN"
  | "APPOINTMENT_HAS_CONSULTATION"
  | "CONSULTATION_GENERATED_PRESCRIPTION"
  | "CONSULTATION_GENERATED_REPORT"
  | "APPOINTMENT_HAS_FOLLOWUP"
  | "APPOINTMENT_CREATED_REFERRAL"
  | "REFERRAL_TO_DOCTOR"
  | "REFERRAL_TO_HOSPITAL"
  | "APPOINTMENT_HAD_HANDOVER"
  | "PATIENT_OWNS_DOCUMENT"
  | "DOCUMENT_SHARED_WITH_DOCTOR"
  | "RECOVERY_RELATES_TO_APPOINTMENT";

export type ContinuityTimeframe =
  | "ALL"
  | "CURRENT"
  | "RECENT"
  | "HISTORICAL"
  | "UPCOMING";

export type ContinuityCategory =
  | "all"
  | "clinical"
  | "network"
  | "documents"
  | "support";

export interface ContinuityNodeMetadata {
  appointmentId?: string | null;
  displayId?: string;
  doctorId?: string | null;
  doctorName?: string;
  speciality?: string;
  hospitalId?: string | null;
  hospitalName?: string;
  department?: string;
  slotDate?: string;
  slotTime?: string;
  status?: string;
  paymentStatus?: string;
  meetingUrl?: string | null;
  diagnosis?: string;
  consultationType?: string;
  medicineCount?: number;
  reportName?: string;
  reportType?: string;
  url?: string;
  advice?: string;
  referralId?: string;
  urgency?: string;
  referringDoctorName?: string;
  receivingDoctorName?: string;
  receivingHospitalName?: string;
  handoverId?: string;
  priority?: string;
  documentId?: string;
  category?: string;
  fileUrl?: string;
  recoveryId?: string;
  type?: string;
  userId?: string;
  familyMemberId?: string | null;
  [key: string]: unknown;
}

export interface ContinuityGraphNode {
  id: string;
  type: ContinuityNodeType;
  label: string;
  subLabel?: string;
  status?: string;
  statusVariant?: "primary" | "success" | "warning" | "error" | "neutral";
  timestamp?: string;
  icon?: string;
  metadata?: ContinuityNodeMetadata;
}

export interface ContinuityGraphEdge {
  id: string;
  source: string;
  target: string;
  type: ContinuityRelationshipType;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface ContinuityNextAction {
  key: string;
  label: string;
  icon: string;
  route: string;
}

export interface ContinuityGraphFocus {
  focusNodeId: string | null;
  activeEpisodeId: string | null;
  nextAction: ContinuityNextAction | null;
}

export interface ContinuityGraphStats {
  totalNodes: number;
  totalEdges: number;
  activeEpisodes: number;
  doctorsCount: number;
  hospitalsCount: number;
  prescriptionsCount: number;
  reportsCount: number;
  referralsCount: number;
}

export interface ContinuityGraphData {
  nodes: ContinuityGraphNode[];
  edges: ContinuityGraphEdge[];
  focus: ContinuityGraphFocus;
  stats: ContinuityGraphStats;
  timeframe: ContinuityTimeframe;
  category: ContinuityCategory;
  generatedAt: string;
}

export interface ContinuityGraphResponse {
  success: boolean;
  graph: ContinuityGraphData;
  message?: string;
}

export interface ContinuityAiContextResponse {
  success: boolean;
  aiContext: string;
  stats: ContinuityGraphStats;
  focus: ContinuityGraphFocus;
  message?: string;
}

// =============================================================================
// Smart Care Gap & Continuity Monitoring Types
// =============================================================================

export type CareGapType =
  | "FOLLOW_UP_NOT_RECORDED"
  | "PENDING_PRESCRIPTION"
  | "PENDING_DIAGNOSTIC_REPORT"
  | "REFERRAL_AWAITING_PROVIDER"
  | "HANDOVER_PENDING_ACCEPTANCE"
  | "UNRESOLVED_APPOINTMENT_PAYMENT"
  | "CHECKIN_ARRIVAL_PENDING"
  | "TELEHEALTH_MEETING_PENDING"
  | "SERVICE_RECOVERY_IN_PROGRESS";

export type CareGapSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export type CareGapStatus =
  | "DETECTED"
  | "REVIEWED"
  | "ACTION_REQUIRED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export interface CareGapNextAction {
  key: string;
  label: string;
  icon: string;
  route: string;
}

export interface CareGap {
  _id: string;
  gapNumber: string;
  fingerprint: string;
  gapType: CareGapType;
  severity: CareGapSeverity;
  status: CareGapStatus;
  patientId: string;
  familyMemberId?: string | null;
  patientName?: string;
  doctorId?: string | null;
  doctorName?: string;
  hospitalId?: string | null;
  hospitalName?: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  nextAction?: CareGapNextAction;
  detectedAt: string;
  lastEvaluatedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string;
  resolutionEvidence?: Record<string, unknown>;
  dismissedAt?: string | null;
  dismissReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CareGapStats {
  total: number;
  active: number;
  actionRequired: number;
  resolved: number;
  dismissed: number;
}

export interface CareGapListResponse {
  success: boolean;
  gaps: CareGap[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: CareGapStats;
  message?: string;
}

export interface CareGapDetailResponse {
  success: boolean;
  gap: CareGap;
  message?: string;
}

export interface CareGapAiContextResponse {
  success: boolean;
  aiContext: string;
  activeCount: number;
  message?: string;
}

// =============================================================================
// WORKFLOW AUTOMATION ENGINE TYPES
// =============================================================================

export type WorkflowAutomationCategory =
  | "appointments"
  | "payments"
  | "clinical"
  | "referrals"
  | "handovers"
  | "subscriptions"
  | "sla"
  | "recoveries"
  | "system";

export type WorkflowTargetModule =
  | "care_gaps"
  | "notifications"
  | "timeline"
  | "wallet"
  | "care_journey"
  | "referrals"
  | "sla"
  | "cases"
  | "recovery"
  | "audit";

export interface WorkflowAutomationAction {
  _id?: string;
  targetModule: WorkflowTargetModule;
  actionType: string;
  parameters?: Record<string, unknown>;
  description?: string;
}

export interface WorkflowAutomationRule {
  _id: string;
  ruleId: string;
  name: string;
  description?: string;
  triggerEvent: string;
  category: WorkflowAutomationCategory;
  scope: "global" | "hospital";
  hospitalId?: string | null;
  conditions?: Record<string, unknown>;
  actions: WorkflowAutomationAction[];
  priority: number;
  version: number;
  isEnabled: boolean;
  maxRetries: number;
  conflictResolution: "STOP_ON_CONFLICT" | "PRIORITY_WINS";
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTER";

export type WorkflowErrorType =
  | "TRANSIENT"
  | "BUSINESS_LOGIC"
  | "DATA_INTEGRITY"
  | "AUTHORIZATION"
  | "CONSENT_BLOCKED"
  | "LOOP_DETECTED"
  | "UNKNOWN";

export interface WorkflowActionExecutionResult {
  _id?: string;
  targetModule: string;
  actionType: string;
  status: "PENDING" | "SUCCESS" | "SKIPPED" | "FAILED";
  result?: unknown;
  error?: string | null;
  executedAt: string;
  durationMs: number;
}

export interface WorkflowAutomationExecution {
  _id: string;
  executionId: string;
  idempotencyKey: string;
  ruleId: string;
  ruleName?: string;
  ruleVersion: number;
  eventId: string;
  eventType: string;
  correlationId?: string;
  entityType?: string;
  entityId?: string;
  patientId?: string | null;
  hospitalId?: string | null;
  status: WorkflowExecutionStatus;
  errorType?: WorkflowErrorType | null;
  errorDetails?: unknown;
  retryCount: number;
  maxRetries: number;
  executionDepth: number;
  actionResults: WorkflowActionExecutionResult[];
  isDryRun: boolean;
  startedAt: string;
  completedAt?: string | null;
  executionDurationMs: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowAutomationStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  succeeded: number;
  failed: number;
  retrying: number;
  deadLetter: number;
  successRate: number;
  recentExecutions: WorkflowAutomationExecution[];
}

export interface WorkflowSimulationStep {
  ruleId: string;
  ruleName: string;
  priority: number;
  conditionPassed: boolean;
  idempotencyKey: string;
  projectedActions: {
    targetModule: string;
    actionType: string;
    projectedStatus: string;
    parameters?: Record<string, unknown>;
    description?: string;
  }[];
  safetyAssessment: {
    clinicalDiagnosisAltered: boolean;
    financialStateDirectlyAltered: boolean;
    requiresPatientConsent: boolean;
    safeForAutoExecution: boolean;
  };
}

export interface WorkflowSimulationResult {
  isDryRun: boolean;
  eventType: string;
  rulesEvaluated: number;
  matchingRuleCount: number;
  simulationSteps: WorkflowSimulationStep[];
  simulationDurationMs: number;
  timestamp: string;
}

// =============================================================================
// EVENT REPLAY & RECOVERY ENGINE TYPES
// =============================================================================

export type EventRecoveryState =
  | "RECEIVED"
  | "PROCESSED"
  | "FAILED"
  | "RETRYING"
  | "RECOVERED"
  | "MANUAL_REVIEW"
  | "REPLAYED"
  | "IGNORED";

export type EventFailureCategory =
  | "TRANSIENT"
  | "BUSINESS_STATE_CONFLICT"
  | "AUTHORIZATION_FAILURE"
  | "DATA_INTEGRITY_FAILURE"
  | "EXTERNAL_SERVICE_FAILURE"
  | "DUPLICATE"
  | "UNKNOWN";

export interface EventReplayAttempt {
  _id?: string;
  replayId: string;
  actorId: string;
  actorName: string;
  reason: string;
  previousState: string;
  currentState: string;
  actionAttempted: string;
  result?: unknown;
  error?: string | null;
  correlationId?: string;
  timestamp: string;
}

export interface EventConcurrencyLock {
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt?: string | null;
  lockExpiresAt?: string | null;
}

export interface EventRecoveryRecord {
  _id: string;
  recoveryId: string;
  eventId: string;
  executionId?: string;
  eventType: string;
  source: string;
  entityType?: string;
  entityId?: string;
  hospitalId?: string | null;
  patientId?: string | null;
  correlationId?: string;
  state: EventRecoveryState;
  failureCategory: EventFailureCategory;
  failureReason?: string;
  failureDetails?: unknown;
  businessStateSnapshot?: Record<string, unknown>;
  currentBusinessState?: Record<string, unknown>;
  isReplayEligible: boolean;
  ineligibilityReason?: string;
  suggestedAction?: string;
  replayCount: number;
  maxReplays: number;
  lock?: EventConcurrencyLock;
  replays: EventReplayAttempt[];
  linkedCaseId?: string | null;
  linkedIncidentId?: string | null;
  linkedSlaId?: string | null;
  linkedServiceRecoveryId?: string | null;
  manualReviewNotes?: string;
  recoveredAt?: string | null;
  lastEvaluatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecoveryKpis {
  totalFailed: number;
  manualReview: number;
  retryable: number;
  recovered: number;
  criticalFailures: number;
  recentEvents: EventRecoveryRecord[];
}

export interface EventReplayValidationResult {
  eligible: boolean;
  ineligibilityReason?: string | null;
  duplicateDetected: boolean;
  suggestedAction: string;
  safetyChecksPassed: boolean;
  currentBusinessState: Record<string, unknown>;
  failureCategory: EventFailureCategory;
  replayCount: number;
  maxReplays: number;
  idempotencyKey: string;
  isLocked?: boolean;
}

// ==========================================
// Smart Healthcare Change Impact & Dependency Types
// ==========================================

export type ChangeType =
  | "SUBSCRIPTION_PLAN_CHANGE"
  | "DOCTOR_STATUS_CHANGE"
  | "HOSPITAL_STATUS_CHANGE"
  | "SLA_POLICY_CHANGE"
  | "AUTOMATION_RULE_CHANGE"
  | "SECURITY_POLICY_CHANGE";

export type ChangeTargetType =
  | "subscription_plan"
  | "doctor"
  | "hospital"
  | "service_sla_policy"
  | "workflow_automation_rule"
  | "policy_rule";

export type ChangeStatus =
  | "PREVIEWED"
  | "VALIDATED"
  | "APPROVED"
  | "APPLIED"
  | "REJECTED"
  | "ROLLED_BACK";

export type DependencyCountLevel = "LOW" | "MEDIUM" | "HIGH";

export interface DependencyTreeNode {
  id: string;
  label: string;
  category:
    | "core_catalog"
    | "active_subscribers"
    | "doctor_schedule"
    | "appointment_queue"
    | "patient_safety"
    | "financial_gateway"
    | "service_sla"
    | "workflow_automation"
    | "compliance_audit"
    | "notifications";
  description?: string;
  count: number;
  severity: "info" | "warning" | "blocking" | "critical" | "neutral";
  linkPath?: string;
  children?: DependencyTreeNode[];
}

export interface ChangeWarning {
  level: "info" | "warning" | "blocking";
  category: string;
  message: string;
  recommendation?: string;
}

export interface ChangeValidationCheck {
  checkId: string;
  label: string;
  passed: boolean;
  details?: string;
}

export interface ChangeImpactReport {
  changeType?: ChangeType;
  targetType?: ChangeTargetType;
  targetId?: string;
  targetName?: string;
  targetVersion?: number | string | null;
  currentState?: Record<string, unknown> | null;
  proposedState?: Record<string, unknown>;
  dependencyCountLevel: DependencyCountLevel;
  impactReport: {
    affectedModules: string[];
    affectedWorkflows: string[];
    affectedRecordCounts: Record<string, number>;
    dependencyTree: DependencyTreeNode[];
    warnings: ChangeWarning[];
    validationChecks: ChangeValidationCheck[];
  };
  hasBlockingIssues?: boolean;
}

export interface ChangeRequest {
  _id: string;
  changeId: string;
  changeType: ChangeType;
  targetType: ChangeTargetType;
  targetId: string;
  targetName: string;
  scope: "global" | "hospital";
  hospitalId?: string | null;
  currentState?: Record<string, unknown>;
  proposedState: Record<string, unknown>;
  targetVersion?: number | string | null;
  status: ChangeStatus;
  dependencyCountLevel: DependencyCountLevel;
  impactReport: {
    affectedModules: string[];
    affectedWorkflows: string[];
    affectedRecordCounts: Record<string, number>;
    dependencyTree: DependencyTreeNode[];
    warnings: ChangeWarning[];
    validationChecks: ChangeValidationCheck[];
  };
  reason: string;
  requestedBy: string;
  requestedByName: string;
  appliedAt?: string | null;
  appliedBy?: string | null;
  appliedByName?: string;
  applicationResult?: Record<string, unknown> | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeGovernanceKpis {
  totalChanges: number;
  pendingPreviews: number;
  highImpactChanges: number;
  appliedChanges: number;
  rejectedChanges: number;
  recentActivity: ChangeRequest[];
}

export interface CandidateTargets {
  subscription_plans: Array<{
    _id: string;
    key: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    price: number;
    isActive: boolean;
    planVersion: number;
  }>;
  doctors: Array<{
    _id: string;
    name: string;
    speciality: string;
    hospitalName: string;
    available: boolean;
    isActive: boolean;
    fees: number;
  }>;
  hospitals: Array<{
    _id: string;
    name: string;
    slug: string;
    location?: { city?: string };
    departments?: string[];
    subscriptionPlan: string;
    isActive: boolean;
  }>;
  sla_policies: Array<{
    _id: string;
    policyKey: string;
    title: string;
    serviceType: string;
    severity: string;
    targetDurationMinutes: number;
    scope: string;
  }>;
  automation_rules: Array<{
    _id: string;
    ruleId: string;
    name: string;
    triggerEvent: string;
    isActive: boolean;
    category?: string;
  }>;
}

// ==========================================
// Smart Healthcare Release Governance & Production Readiness Types
// ==========================================

export type ReleaseGateStatus =
  | "PASS"
  | "WARNING"
  | "BLOCKED"
  | "UNKNOWN"
  | "NOT_CONFIGURED";

export type ReleaseGateCategory =
  | "security"
  | "database"
  | "payments"
  | "authentication"
  | "api"
  | "mobile_eas"
  | "notifications"
  | "realtime"
  | "ai_ocr"
  | "appointments"
  | "subscriptions"
  | "data_integrity"
  | "backup_recovery"
  | "observability"
  | "privacy"
  | "cross_portal";

export type ReleaseStatus =
  | "DRAFT"
  | "VALIDATING"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "READY_FOR_DEPLOYMENT"
  | "DEPLOYED"
  | "REJECTED";

export type OverallReadinessLevel =
  | "READY_TO_RELEASE"
  | "ACTION_REQUIRED_WARNINGS"
  | "RELEASE_BLOCKED";

export interface ReleaseGate {
  gateId: string;
  name: string;
  category: ReleaseGateCategory;
  status: ReleaseGateStatus;
  severity: "info" | "warning" | "critical";
  evidence: string;
  affectedModule: string;
  lastCheckedAt: string;
  recommendedAction?: string;
  dependencyRef?: string;
}

export interface GateSummary {
  total: number;
  passed: number;
  warnings: number;
  blocked: number;
  unknown: number;
  notConfigured: number;
}

export interface LiveReadinessReport {
  evaluatedAt: string;
  overallReadiness: OverallReadinessLevel;
  configurationFingerprint: string;
  gateSummary: GateSummary;
  gateResults: ReleaseGate[];
  blockers: string[];
  warnings: string[];
}

export interface ReleaseCandidate {
  _id: string;
  releaseId: string;
  version: string;
  targetEnvironment: "production" | "staging" | "preview";
  gitCommit: string;
  configurationFingerprint: string;
  status: ReleaseStatus;
  overallReadiness: OverallReadinessLevel;
  gateSummary: GateSummary;
  gateResults: ReleaseGate[];
  blockers: string[];
  warnings: string[];
  changeImpactSnapshot?: {
    pendingChangesCount?: number;
    sampleChanges?: Array<{
      changeId: string;
      changeType: string;
      targetName: string;
      level: string;
    }>;
  };
  rollbackReadiness: {
    rollbackStrategy: string;
    backupPrerequisiteMet: boolean;
    mobileRollbackLimitations: string;
    paymentCompatibilityNotes: string;
  };
  approvalWorkflow: {
    requestedBy?: string;
    requestedByName?: string;
    requestedAt?: string;
    reviewedBy?: string;
    approvedBy?: string;
    approvedByName?: string;
    approvalNotes?: string;
    approvedAt?: string | null;
    rejectedBy?: string;
    rejectionReason?: string;
    rejectedAt?: string | null;
  };
  postDeploymentVerification?: {
    status: "PENDING" | "PASSED" | "DEGRADED" | "FAILED";
    verifiedAt?: string | null;
    verifiedBy?: string;
    verifiedByName?: string;
    results?: Record<string, unknown>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseGovernanceKpis {
  totalReleases: number;
  activeCandidates: number;
  approvedReleases: number;
  deployedReleases: number;
  liveOverallReadiness: OverallReadinessLevel;
  liveGateSummary: GateSummary;
  recentReleases: ReleaseCandidate[];
}

// ==========================================
// Business Continuity & Failover Readiness
// ==========================================

export type ContinuityMode =
  | "NORMAL"
  | "DEGRADED"
  | "RECOVERY"
  | "READ_ONLY"
  | "MAINTENANCE";

export type ServiceOperationalState =
  | "HEALTHY"
  | "DEGRADED"
  | "FAILED"
  | "RECOVERING"
  | "UNKNOWN"
  | "NOT_CONFIGURED";

export type FailoverReadinessStatus =
  | "READY"
  | "PARTIAL"
  | "NOT_READY"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export type ServiceCriticality = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface CriticalDependency {
  id: string;
  name: string;
  category: "core" | "financial" | "communication" | "ai_document" | "infrastructure";
  criticality: ServiceCriticality;
  operationalState: ServiceOperationalState;
  failoverReadiness: FailoverReadinessStatus;
  healthIndicators: Record<string, unknown>;
  fallbackMechanism: {
    available: boolean;
    implemented: boolean;
    description: string;
    runbookId: string;
  };
  activeIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  manualOverride: "AUTOMATIC" | "FORCE_DEGRADED" | "FORCE_FAILOVER" | "FORCE_MAINTENANCE";
  lastChecked: string;
}

export interface RecoveryRunbook {
  runbookId: string;
  title: string;
  serviceKey: string;
  category: string;
  severity: string;
  estimatedRTO: string;
  estimatedRPO: string;
  triggerCondition: string;
  fallbackBehavior: string;
  safetyPreconditions: string[];
  steps: string[];
  dataConsistencyGuarantees: string;
  postRecoveryVerification: string;
}

export interface ContinuityOverviewKpis {
  totalDependencies: number;
  healthyCount: number;
  degradedCount: number;
  failedCount: number;
  notConfiguredCount: number;
  failoverReadyCount: number;
  failoverPartialCount: number;
  failoverNotReadyCount: number;
  activeIncidentsCount: number;
  pendingRecoveryCount: number;
  manualReviewRecoveryCount: number;
  recentErrorsCount: number;
}

export interface ContinuityOverview {
  currentMode: ContinuityMode;
  modeReason: string;
  modeChangedAt: string;
  modeChangedByName: string;
  kpis: ContinuityOverviewKpis;
  lastBackup: {
    timestamp: string | null;
    status: string;
    sizeMb: string | null;
  };
  lastUpdated: string;
}

export interface RecoveryQueueItem {
  _id: string;
  eventId: string;
  eventType: string;
  aggregateType?: string;
  state: "RECEIVED" | "PROCESSED" | "FAILED" | "RETRYING" | "RECOVERED" | "MANUAL_REVIEW" | "REPLAYED" | "IGNORED";
  failureCategory: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  idempotencyKey?: string;
  lockedUntil?: string | null;
  replays?: Array<{
    replayId: string;
    actorId?: string | null;
    actorName?: string;
    reason: string;
    previousState?: string;
    currentState?: string;
    actionAttempted: string;
    executedAt: string;
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryVerificationResult {
  serviceKey: string;
  name: string;
  operationalState: ServiceOperationalState;
  failoverReadiness: FailoverReadinessStatus;
  isHealthy: boolean;
  criticality: ServiceCriticality;
  fallbackAvailable: boolean;
  verifiedAt: string;
}

