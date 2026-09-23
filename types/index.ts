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
   * Super Admin platform mode — requests the full doctor list + verification
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
  patientId?: any;
  patientPhone?: string;
  familyMemberId?: string;
  familyRelationship?: FamilyRelationship;
  isFamilyBooking?: boolean;
  amount?: number;
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
  /** Mongo ObjectId — same as mongoAppointmentId (backend may omit one). */
  _id?: string;
  appointmentId: string;
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
  amount?: number;
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
export interface Notification {
  _id: string;
  type?: string;
  title: string;
  message: string;
  isRead: boolean;
  priority?: "low" | "normal" | "high";
  link?: string;
  actorName?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Owning account fields returned by the backend (used by Super Admin center). */
  recipientRole?: string;
  refModel?: string;
  refId?: string;
}

export interface NotificationsResponse {
  success: boolean;
  message?: string;
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
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
 * Shape returned by `POST /appointment/payment/order/:appointmentId` — the
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

export interface SubscriptionPlan {
  _id: string;
  key:
    | "free"
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
  currency: string;
  features: string[];
  isActive: boolean;
  trialDays: number;
  sortOrder: number;
  subscriberCount: number;
  /** Monthly video consultations included (0 for Free, 4 Gold, 7 Platinum, 10 Prime, or Super Admin configured). */
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

export interface SubscriptionPaymentRecord {
  _id?: string;
  amount: number;
  billingCycle: Extract<SubscriptionBillingCycle, "monthly" | "yearly">;
  paymentStatus: Exclude<SubscriptionPaymentStatus, "n/a">;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
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

export interface UserSubscriptionEntitlement {
  hasActiveSubscription: boolean;
  planKey: string;
  planName: string;
  monthlyQuota: number;
  usedThisMonth: number;
  remainingQuota: number;
  isEligibleForVideoConsultation: boolean;
  code: SubscriptionEntitlementCode;
  message: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  expiryDate?: string;
  canUpgrade: boolean;
  activePlan?: SubscriptionPlan;
}

export interface SubscriptionEntitlementResponse {
  success: boolean;
  message?: string;
  entitlement: UserSubscriptionEntitlement;
}

export type SubscriptionListSort = "renewal" | "amount" | "hospital" | "recent";

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
// Online consultation (Google Meet) — mirrors routes/consultationRoutes.js
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
