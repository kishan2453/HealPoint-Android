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
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SERVER'
  | 'UNKNOWN';

export type ApiErrorCategory =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'VALIDATION'
  | 'UNKNOWN';

// ---------------------------------------------------------------------------
// Auth / user
// ---------------------------------------------------------------------------
export type UserRole =
  // Legacy display strings from older backend versions (kept for compatibility).
  | 'Patient'
  | 'Hospital Admin'
  | 'Super Admin'
  | 'Administrator'
  | 'Staff'
  // Canonical role values returned by the role-aware backend.
  | 'patient'
  | 'doctor'
  | 'admin'
  | 'super_admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  image?: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  role?: UserRole;
  isAdmin?: boolean;
  isActive?: boolean;
  authProvider?: 'password' | 'google' | 'both';
  googleId?: string;
  favorites?: FavoriteDoctor[];
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
  consultationFee?: number;
  icu?: boolean;
  galleryImages?: {
    src?: string;
    title?: string;
    category?: string;
    width?: number;
    height?: number;
  }[];
  specializations?: string[];
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

export interface WeeklySchedule {
  day?: string;
  enabled?: boolean;
  startTime?: string;
  endTime?: string;
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
  speciality?: string;
  department?: string;
  specialization?: string;
  rating?: number;
  reviewCount?: number;
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
  onlineStatus?: 'online' | 'offline';
  isActive?: boolean;
  languages?: string[];
  gender?: string;
  availabilitySchedule?: string;
  leaveDates?: string[];
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
  patientPhone?: string;
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
  createdAt?: string;
  updatedAt?: string;
  doctorPhone?: string;
  doctorEmail?: string;
  bookingStatusLabel?: string;
  statusHistory?: unknown[];
  appointmentHistory?: unknown[];
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

export interface AppointmentDetails {
  _id: string;
  appointmentId: string;
  mongoAppointmentId: string;
  doctorName?: string;
  hospitalId?: string;
  hospitalName?: string;
  doctorPhone?: string;
  doctorEmail?: string;
  doctorSignatureImage?: string;
  bookingDate?: string;
  bookingTime?: string;
  amount?: number;
  bookingStatus?: string;
  bookingStatusLabel?: string;
  patientPhone?: string;
  statusHistory?: unknown[];
  medicalReports?: unknown[];
  appointmentHistory?: unknown[];
  reminders?: unknown[];
  patientHistory?: unknown[];
  payment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  consultationType?: ConsultationType;
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
  priority?: 'low' | 'normal' | 'high';
  link?: string;
  actorName?: string;
  createdAt?: string;
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
  doctorId?: string | { _id: string; name?: string; speciality?: string };
  doctorName?: string;
  name?: string;
  email?: string;
  rating: number;
  title?: string;
  comment: string;
  avatar?: string;
  isApproved?: boolean;
  isHidden?: boolean;
  createdAt?: string;
}

export interface CreateReviewPayload {
  doctorId: string;
  name?: string;
  email?: string;
  rating: number;
  title?: string;
  comment: string;
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
  image?: Blob | { uri: string; name?: string; type?: string } | null;
}

export interface FavoriteDoctor {
  doctorId: string;
  addedAt?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token: string;
  user: User;
  sessionId: string;
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
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancel'
  | 'rescheduled'
  | 'missed';

export type ConsultationType = 'clinic' | 'video';
export type ConsultationMode = 'scheduled' | 'instant';
export type MeetingStatus = 'not_created' | 'ready' | 'started' | 'completed';
export type ConsultationStatus =
  | 'waiting'
  | 'doctor_ready'
  | 'ready_to_join'
  | 'in_progress'
  | 'completed'
  | 'unavailable';
export type PaymentMethod = 'cash' | 'online';

/**
 * Canonical payment states used once the backend has been wired to Razorpay.
 * The backend owns the state machine and never marks a payment SUCCESS before
 * it has verified the Razorpay signature. These mirror the server contract.
 */
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

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
  | 'trial'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'suspended'
  | 'past_due';

export type SubscriptionBillingCycle = 'monthly' | 'yearly' | 'none';
export type SubscriptionPaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded' | 'n/a';

export interface SubscriptionPlan {
  _id: string;
  key: 'free' | 'basic' | 'professional' | 'premium' | 'enterprise';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  isActive: boolean;
  trialDays: number;
  sortOrder: number;
  subscriberCount: number;
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
  billingCycle: Extract<SubscriptionBillingCycle, 'monthly' | 'yearly'>;
  paymentStatus: Exclude<SubscriptionPaymentStatus, 'n/a'>;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface Subscription {
  _id: string;
  hospitalId: string | Hospital;
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

export type SubscriptionListSort = 'renewal' | 'amount' | 'hospital' | 'recent';

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
  role?: UserRole;
  isAdmin?: boolean;
  isActive?: boolean;
  authProvider?: string;
  hospital?: Pick<Hospital, '_id' | 'name' | 'slug' | 'isActive'> | null;
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
  onlineStatus?: 'online' | 'offline';
  onlineConsultationEnabled?: boolean;
  instantConsultationEnabled?: boolean;
  nextAvailableSlot?: {
    date: string;
    time: string;
    slotCountToday: number;
    weekday: string;
  } | null;
  hospital?: Pick<Hospital, '_id' | 'name' | 'logo'> | null;
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
  doctors?: (Pick<Doctor, '_id' | 'name' | 'speciality'> & {
    onlineConsultationEnabled?: boolean;
    onlineStatus?: 'online' | 'offline';
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