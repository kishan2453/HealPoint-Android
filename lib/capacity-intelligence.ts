/**
 * HealPoint — Smart Hospital Capacity & Resource Intelligence Engine.
 *
 * Deterministic capacity, department load, doctor availability, and appointment
 * demand computations derived strictly from authentic MongoDB appointments,
 * doctor profiles, hospital departments, and live queue status.
 *
 * Strict safety rules:
 * - NO fake predictions, dummy metrics, or placeholder counters.
 * - If capacity cannot be calculated from existing slot records, reports
 *   a transparent "Data not available" state with the exact reason.
 * - Operational load states ("Normal", "Busy", "High Load", "No Current Activity")
 *   are computed neutrally from real patient counts (never medical severity).
 */

import type {
  Appointment,
  Doctor,
  HospitalDepartment,
  HospitalConsultationStats,
} from "@/types";
import { parseSlotDate } from "@/lib/appointments";
import type { TrendBar } from "@/components/admin/TrendBars";
import type { AnalyticsBarItem } from "@/components/admin/AnalyticsBar";

export type DepartmentLoadState =
  | "No Current Activity"
  | "Normal"
  | "Busy"
  | "High Load";

export interface DepartmentLoadItem {
  departmentId: string;
  name: string;
  todayCount: number;
  upcomingCount: number;
  waitingCount: number;
  assignedDoctorsCount: number;
  availableDoctorsCount: number;
  loadState: DepartmentLoadState;
  loadVariant: "neutral" | "success" | "warning" | "error";
}

export type DoctorAvailabilityStatus =
  | "available"
  | "in_consultation"
  | "busy"
  | "on_leave"
  | "offline";

export interface DoctorAvailabilityIntelligenceItem {
  doctorId: string;
  doctorName: string;
  speciality: string;
  department: string;
  status: DoctorAvailabilityStatus;
  statusLabel: string;
  statusVariant: "success" | "primary" | "warning" | "neutral";
  todayAppointmentsCount: number;
  waitingCount: number;
  upcomingCount: number;
  isOnlineConsultationEnabled: boolean;
  doctor: Doctor;
}

export interface HospitalCapacityOverview {
  totalToday: number;
  confirmedToday: number;
  completedToday: number;
  cancelledToday: number;
  checkedInToday: number;
  waitingToday: number;
  inConsultationToday: number;
  availableDoctorsCount: number;
  busyDoctorsCount: number;
  unavailableDoctorsCount: number;
  onlineConsultationLoad: number;
  inClinicLoad: number;
  totalUpcomingCount: number;
}

export interface CapacityUtilizationResult {
  hasData: boolean;
  confirmedCount: number;
  totalCapacity: number;
  utilizationPercent: number;
  missingReason?: string;
}

export interface AppointmentDemandResult {
  range: "today" | "next_7_days" | "month";
  trend: TrendBar[];
  byDepartment: AnalyticsBarItem[];
  byDoctor: AnalyticsBarItem[];
  byType: { clinic: number; video: number };
  totalCount: number;
}

export interface SmartOperationalAlert {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  message: string;
  department?: string;
}

/**
 * Resolves normalized doctor ID string.
 */
function resolveDoctorId(docOrAppt: unknown): string {
  if (!docOrAppt) return "";
  if (typeof docOrAppt === "object" && docOrAppt !== null) {
    if ("_id" in docOrAppt) return String((docOrAppt as { _id: unknown })._id);
    if ("doctorId" in docOrAppt) {
      const dId = (docOrAppt as { doctorId: unknown }).doctorId;
      if (typeof dId === "object" && dId !== null && "_id" in dId) {
        return String((dId as { _id: unknown })._id);
      }
      return String(dId || "");
    }
  }
  return String(docOrAppt);
}

/**
 * Resolves normalized department name from an appointment or doctor.
 */
function resolveDepartmentName(item: Appointment | Doctor): string {
  if ("speciality" in item && item.speciality) return item.speciality.trim();
  if ("department" in item && item.department) return item.department.trim();
  if (
    "doctorId" in item &&
    typeof item.doctorId === "object" &&
    item.doctorId
  ) {
    const dObj = item.doctorId as { speciality?: string; department?: string };
    if (dObj.speciality) return dObj.speciality.trim();
    if (dObj.department) return dObj.department.trim();
  }
  return "General Medicine";
}

/**
 * 1. Compute hospital-wide capacity and real-time load overview.
 */
export function computeHospitalCapacityOverview(
  todayAppointments: Appointment[],
  upcomingAppointments: Appointment[],
  doctors: Doctor[],
  consultationStats?: HospitalConsultationStats | null,
): HospitalCapacityOverview {
  let confirmedToday = 0;
  let completedToday = 0;
  let cancelledToday = 0;
  let checkedInToday = 0;
  let waitingToday = 0;
  let inConsultationToday = 0;
  let onlineConsultationLoad = 0;
  let inClinicLoad = 0;

  for (const a of todayAppointments) {
    const s = (a.status || "").toLowerCase();
    const qs = (a.queueStatus || "").toLowerCase();
    const cs = (a.consultationStatus || "").toLowerCase();
    const isChecked = a.checkedIn === true || Boolean(a.checkInAt);

    if (s === "confirmed") confirmedToday++;
    if (s === "completed") completedToday++;
    if (s === "cancel" || s === "missed") cancelledToday++;

    if (a.consultationType === "video") {
      onlineConsultationLoad++;
    } else {
      inClinicLoad++;
    }

    if (
      isChecked ||
      qs === "waiting" ||
      qs === "called" ||
      qs === "in_consultation"
    ) {
      checkedInToday++;
    }

    if (qs === "in_consultation" || cs === "in_progress") {
      inConsultationToday++;
    } else if (
      qs === "waiting" ||
      qs === "called" ||
      (isChecked && s !== "completed" && s !== "cancel" && s !== "missed")
    ) {
      waitingToday++;
    }
  }

  // Doctor status breakdown
  let availableDoctorsCount = 0;
  let busyDoctorsCount = 0;
  let unavailableDoctorsCount = 0;

  for (const doc of doctors) {
    const docIdStr = String(doc._id);
    const isOffline = doc.available === false || doc.isActive === false;

    if (isOffline) {
      unavailableDoctorsCount++;
      continue;
    }

    // Check if currently consulting or busy with waiting queue today
    const docTodayAppts = todayAppointments.filter(
      (a) => resolveDoctorId(a) === docIdStr,
    );
    const hasActivePatient = docTodayAppts.some(
      (a) =>
        a.queueStatus === "in_consultation" ||
        a.consultationStatus === "in_progress",
    );
    const hasWaitingPatients = docTodayAppts.some(
      (a) =>
        a.queueStatus === "waiting" ||
        a.queueStatus === "called" ||
        (a.checkedIn && a.status !== "completed" && a.status !== "cancel"),
    );

    if (hasActivePatient || hasWaitingPatients) {
      busyDoctorsCount++;
    } else {
      availableDoctorsCount++;
    }
  }

  return {
    totalToday: todayAppointments.length,
    confirmedToday,
    completedToday,
    cancelledToday,
    checkedInToday,
    waitingToday,
    inConsultationToday,
    availableDoctorsCount,
    busyDoctorsCount,
    unavailableDoctorsCount,
    onlineConsultationLoad,
    inClinicLoad,
    totalUpcomingCount: upcomingAppointments.length,
  };
}

/**
 * 2. Compute Department-wise load from real appointments and doctors.
 */
export function computeDepartmentLoads(
  departments: HospitalDepartment[],
  todayAppointments: Appointment[],
  upcomingAppointments: Appointment[],
  doctors: Doctor[],
): DepartmentLoadItem[] {
  // Collect all known departments from both registered list and doctor specialities
  const deptMap = new Map<
    string,
    {
      id: string;
      name: string;
      todayCount: number;
      upcomingCount: number;
      waitingCount: number;
      assignedDoctors: Doctor[];
    }
  >();

  // Initialize from official departments
  for (const d of departments) {
    const name = d.name.trim();
    const key = name.toLowerCase();
    deptMap.set(key, {
      id: d._id,
      name,
      todayCount: 0,
      upcomingCount: 0,
      waitingCount: 0,
      assignedDoctors: [],
    });
  }

  // Map doctors to departments
  for (const doc of doctors) {
    const deptName = resolveDepartmentName(doc);
    const key = deptName.toLowerCase();
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        id: `dept-${key}`,
        name: deptName,
        todayCount: 0,
        upcomingCount: 0,
        waitingCount: 0,
        assignedDoctors: [],
      });
    }
    deptMap.get(key)!.assignedDoctors.push(doc);
  }

  // Aggregate today's appointments and waiting counts
  for (const a of todayAppointments) {
    const deptName = resolveDepartmentName(a);
    const key = deptName.toLowerCase();
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        id: `dept-${key}`,
        name: deptName,
        todayCount: 0,
        upcomingCount: 0,
        waitingCount: 0,
        assignedDoctors: [],
      });
    }

    const entry = deptMap.get(key)!;
    entry.todayCount++;

    const qs = (a.queueStatus || "").toLowerCase();
    const s = (a.status || "").toLowerCase();
    const isChecked = a.checkedIn === true || Boolean(a.checkInAt);
    if (
      qs === "waiting" ||
      qs === "called" ||
      (isChecked && s !== "completed" && s !== "cancel" && s !== "missed")
    ) {
      entry.waitingCount++;
    }
  }

  // Aggregate upcoming appointments
  for (const a of upcomingAppointments) {
    const deptName = resolveDepartmentName(a);
    const key = deptName.toLowerCase();
    if (deptMap.has(key)) {
      deptMap.get(key)!.upcomingCount++;
    }
  }

  // Determine operational load state for each department
  const results: DepartmentLoadItem[] = [];

  for (const entry of deptMap.values()) {
    const availableDocs = entry.assignedDoctors.filter(
      (d) => d.available !== false && d.isActive !== false,
    ).length;

    let loadState: DepartmentLoadState = "Normal";
    let loadVariant: "neutral" | "success" | "warning" | "error" = "success";

    if (entry.todayCount === 0 && entry.waitingCount === 0) {
      loadState = "No Current Activity";
      loadVariant = "neutral";
    } else if (
      entry.waitingCount >= 4 ||
      (availableDocs > 0 && entry.todayCount / availableDocs > 12)
    ) {
      loadState = "High Load";
      loadVariant = "error";
    } else if (entry.waitingCount > 0 || entry.todayCount >= 5) {
      loadState = "Busy";
      loadVariant = "warning";
    } else {
      loadState = "Normal";
      loadVariant = "success";
    }

    results.push({
      departmentId: entry.id,
      name: entry.name,
      todayCount: entry.todayCount,
      upcomingCount: entry.upcomingCount,
      waitingCount: entry.waitingCount,
      assignedDoctorsCount: entry.assignedDoctors.length,
      availableDoctorsCount: availableDocs,
      loadState,
      loadVariant,
    });
  }

  // Sort by highest load first
  return results.sort((a, b) => b.todayCount - a.todayCount);
}

/**
 * 3. Compute Doctor Availability Intelligence.
 */
export function computeDoctorAvailabilityIntelligence(
  doctors: Doctor[],
  todayAppointments: Appointment[],
  upcomingAppointments: Appointment[],
): DoctorAvailabilityIntelligenceItem[] {
  return doctors.map((doc) => {
    const docIdStr = String(doc._id);
    const name = doc.name || "Doctor";
    const spec = doc.speciality || doc.specialization || "General Physician";
    const dept = resolveDepartmentName(doc);

    // Today's appointments for this doctor
    const docTodayAppts = todayAppointments.filter(
      (a) => resolveDoctorId(a) === docIdStr,
    );
    const docUpcomingAppts = upcomingAppointments.filter(
      (a) => resolveDoctorId(a) === docIdStr,
    );

    const activeAppt = docTodayAppts.find(
      (a) =>
        a.queueStatus === "in_consultation" ||
        a.consultationStatus === "in_progress",
    );

    const waitingAppts = docTodayAppts.filter(
      (a) =>
        a.queueStatus === "waiting" ||
        a.queueStatus === "called" ||
        (a.checkedIn && a.status !== "completed" && a.status !== "cancel"),
    );

    let status: DoctorAvailabilityStatus = "available";
    let statusLabel = "Available";
    let statusVariant: "success" | "primary" | "warning" | "neutral" =
      "success";

    if (doc.available === false || doc.isActive === false) {
      status = "offline";
      statusLabel = "Unavailable";
      statusVariant = "neutral";
    } else if (activeAppt) {
      status = "in_consultation";
      statusLabel = "In Consultation";
      statusVariant = "primary";
    } else if (waitingAppts.length > 0) {
      status = "busy";
      statusLabel = `Busy (${waitingAppts.length} waiting)`;
      statusVariant = "warning";
    }

    const isOnlineConsultationEnabled = Boolean(
      (doc as { onlineConsultationEnabled?: boolean })
        .onlineConsultationEnabled ||
      (doc as { onlineStatus?: string }).onlineStatus === "online",
    );

    return {
      doctorId: docIdStr,
      doctorName: name,
      speciality: spec,
      department: dept,
      status,
      statusLabel,
      statusVariant,
      todayAppointmentsCount: docTodayAppts.length,
      waitingCount: waitingAppts.length,
      upcomingCount: docUpcomingAppts.length,
      isOnlineConsultationEnabled,
      doctor: doc,
    };
  });
}

/**
 * 4. Compute Appointment Demand View (Today, Next 7 Days, Month).
 */
export function computeAppointmentDemand(
  allAppointments: Appointment[],
  range: "today" | "next_7_days" | "month",
): AppointmentDemandResult {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Filter appointments within range
  const filtered = allAppointments.filter((a) => {
    const slotStr = a.slotDate || a.appointmentDate;
    if (!slotStr) return false;
    const parsed = parseSlotDate(slotStr);
    if (!parsed) return false;
    parsed.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (range === "today") {
      return diffDays === 0;
    } else if (range === "next_7_days") {
      return diffDays >= 0 && diffDays <= 6;
    } else {
      // Month (next 30 days)
      return diffDays >= 0 && diffDays <= 30;
    }
  });

  // Daily Trend aggregation
  const dateCountsMap = new Map<string, { label: string; count: number }>();

  if (range === "today") {
    dateCountsMap.set("today", { label: "Today", count: filtered.length });
  } else if (range === "next_7_days") {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayStr = `${String(d.getDate()).padStart(2, "0")}-${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}-${d.getFullYear()}`;
      const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        d.getDay()
      ];
      dateCountsMap.set(dayStr, {
        label: i === 0 ? "Today" : `${weekday} ${d.getDate()}`,
        count: 0,
      });
    }

    for (const a of filtered) {
      const slot = a.slotDate || a.appointmentDate || "";
      if (dateCountsMap.has(slot)) {
        dateCountsMap.get(slot)!.count++;
      }
    }
  } else {
    // 30 days in 5-day intervals
    for (let i = 0; i < 6; i++) {
      const startD = new Date(now.getTime() + i * 5 * 24 * 60 * 60 * 1000);
      const label = `${startD.getDate()}/${startD.getMonth() + 1}`;
      dateCountsMap.set(`block-${i}`, { label, count: 0 });
    }

    for (const a of filtered) {
      const slotStr = a.slotDate || a.appointmentDate || "";
      const parsed = parseSlotDate(slotStr);
      if (parsed) {
        const diff = Math.floor(
          (parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const blockIdx = Math.min(5, Math.max(0, Math.floor(diff / 5)));
        dateCountsMap.get(`block-${blockIdx}`)!.count++;
      }
    }
  }

  const trend: TrendBar[] = Array.from(dateCountsMap.entries()).map(
    ([k, v]) => ({
      key: k,
      label: v.label,
      count: v.count,
    }),
  );

  // Department breakdown
  const deptCountMap = new Map<string, number>();
  for (const a of filtered) {
    const dept = resolveDepartmentName(a);
    deptCountMap.set(dept, (deptCountMap.get(dept) || 0) + 1);
  }
  const byDepartment: AnalyticsBarItem[] = Array.from(deptCountMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Doctor breakdown
  const docCountMap = new Map<string, number>();
  for (const a of filtered) {
    const docName =
      (typeof a.doctorId === "object" && a.doctorId && a.doctorId.name) ||
      a.doctorName ||
      "Specialist";
    docCountMap.set(docName, (docCountMap.get(docName) || 0) + 1);
  }
  const byDoctor: AnalyticsBarItem[] = Array.from(docCountMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Consultation Mode breakdown
  let clinic = 0;
  let video = 0;
  for (const a of filtered) {
    if (a.consultationType === "video") video++;
    else clinic++;
  }

  return {
    range,
    trend,
    byDepartment,
    byDoctor,
    byType: { clinic, video },
    totalCount: filtered.length,
  };
}

/**
 * 5. Compute Capacity vs Demand utilization.
 * Where total appointment slot capacity exists, calculates confirmed / capacity.
 * If capacity cannot be calculated from existing slot inventory, returns an honest
 * "Data not available" state.
 */
export function computeCapacityUtilization(
  todayAppointments: Appointment[],
  doctors: Doctor[],
): CapacityUtilizationResult {
  const confirmedCount = todayAppointments.filter(
    (a) => (a.status || "").toLowerCase() === "confirmed",
  ).length;

  // Check if hospital doctors have generated slots or slot count defined
  let totalCapacity = 0;
  let doctorsWithSlots = 0;

  for (const doc of doctors) {
    const slots = (doc as { timeSlots?: unknown[] }).timeSlots;
    if (Array.isArray(slots) && slots.length > 0) {
      totalCapacity += slots.length;
      doctorsWithSlots++;
    }
  }

  if (totalCapacity <= 0 || doctorsWithSlots === 0) {
    return {
      hasData: false,
      confirmedCount,
      totalCapacity: 0,
      utilizationPercent: 0,
      missingReason:
        "Daily slot capacity has not been generated for hospital doctors yet. Generate slots in the Slot Management center to activate live capacity tracking.",
    };
  }

  const utilizationPercent = Math.min(
    100,
    Math.round((confirmedCount / totalCapacity) * 100),
  );

  return {
    hasData: true,
    confirmedCount,
    totalCapacity,
    utilizationPercent,
  };
}

/**
 * 6. Generate Smart Operational Alerts strictly from real conditions.
 */
export function deriveOperationalAlerts(
  capacity: HospitalCapacityOverview,
  departments: DepartmentLoadItem[],
  doctors: DoctorAvailabilityIntelligenceItem[],
): SmartOperationalAlert[] {
  const alerts: SmartOperationalAlert[] = [];

  // Waiting queue alert
  if (capacity.waitingToday >= 5) {
    alerts.push({
      id: "alert-waiting-high",
      type: "warning",
      title: "Elevated OPD Waiting Queue",
      message: `${capacity.waitingToday} patients are currently waiting across hospital OPD areas.`,
    });
  }

  // Doctor shortage in department with waiting patients
  for (const dept of departments) {
    if (dept.waitingCount > 0 && dept.availableDoctorsCount === 0) {
      alerts.push({
        id: `alert-dept-shortage-${dept.departmentId}`,
        type: "error",
        title: `Doctor Shortage in ${dept.name}`,
        message: `${dept.waitingCount} patient(s) waiting in ${dept.name}, but 0 doctors are currently marked available.`,
        department: dept.name,
      });
    } else if (dept.loadState === "High Load") {
      alerts.push({
        id: `alert-dept-highload-${dept.departmentId}`,
        type: "warning",
        title: `High Appointment Load in ${dept.name}`,
        message: `${dept.name} is running at high load with ${dept.todayCount} bookings and ${dept.waitingCount} waiting.`,
        department: dept.name,
      });
    }
  }

  // Doctor concentration alert
  for (const doc of doctors) {
    if (doc.waitingCount >= 4) {
      alerts.push({
        id: `alert-doc-queue-${doc.doctorId}`,
        type: "warning",
        title: `Heavy Patient Queue for ${doc.doctorName}`,
        message: `${doc.waitingCount} patients are waiting in ${doc.doctorName}'s queue.`,
      });
    }
  }

  return alerts;
}
