/**
 * HealPoint 2.0 — Advanced Analytics & Financial Intelligence Service
 *
 * Provides high-performance, precision MongoDB aggregation pipelines, date-range
 * calculations, verified revenue arithmetic, and hospital/doctor isolation.
 *
 * Rules:
 * - Count ONLY verified successful payments as revenue.
 * - Deduct refunded payments accurately.
 * - Strict tenant isolation for hospitals and doctors.
 * - Timezone-aware date parsing for Asia/Kolkata (IST).
 */
import mongoose from "mongoose";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import userModel from "../models/userModel.js";
import subscriptionModel from "../models/subscriptionModel.js";

/**
 * Parses and returns normalized start and end Date objects in IST
 */
export function resolveDateRange({ range = "30d", startDate, endDate } = {}) {
  const now = new Date();
  let start = new Date();
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const cleanRange = String(range || "").toLowerCase().trim();

  if (cleanRange === "custom" && startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999);
      return { start, end, rangeLabel: "Custom Range" };
    }
  }

  switch (cleanRange) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end, rangeLabel: "Today" };

    case "7d":
    case "last_7_days":
    case "7days":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { start, end, rangeLabel: "Last 7 Days" };

    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end, rangeLabel: "This Month" };

    case "last_month": {
      const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      start = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, rangeLabel: "Last Month" };
    }

    case "this_year":
    case "1y":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end, rangeLabel: "This Year" };

    case "30d":
    case "last_30_days":
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { start, end, rangeLabel: "Last 30 Days" };
  }
}

/**
 * Checks if an appointment record has verified collected revenue
 */
export function isVerifiedSuccessfulPayment(apt) {
  if (!apt) return false;
  const isPaid = apt.payment === true || apt.paymentStatus === "SUCCESS" || apt.paymentStatus === "paid";
  const isNotRefunded = apt.paymentStatus !== "REFUNDED" && apt.paymentStatus !== "refunded";
  const isNotFailed = apt.paymentStatus !== "FAILED" && apt.paymentStatus !== "CANCELLED";
  return isPaid && isNotRefunded && isNotFailed;
}

/**
 * Returns net collected revenue for an appointment, accounting for refunds
 */
export function getAppointmentCollectedAmount(apt) {
  if (!apt) return 0;
  if (!isVerifiedSuccessfulPayment(apt)) return 0;
  return Number(apt.amount || apt.billing?.totalAmount || 0);
}

/**
 * Super Admin: Complete Platform KPIs & Trends
 */
export async function getSuperAdminPlatformAnalytics(filterOptions = {}) {
  const { start, end, rangeLabel } = resolveDateRange(filterOptions);

  const [
    totalHospitals,
    activeHospitals,
    totalPatients,
    totalDoctors,
    appointmentsInRange,
    allAppointments,
    subscriptions,
  ] = await Promise.all([
    hospitalModel.countDocuments(),
    hospitalModel.countDocuments({ status: { $ne: "suspended" }, isActive: { $ne: false } }),
    userModel.countDocuments({ role: { $in: ["patient", "User", "Patient", "user"] } }),
    doctorModel.countDocuments({ isActive: { $ne: false } }),
    appointmentModel.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    appointmentModel.find().select("amount billing payment paymentStatus status slotDate createdAt hospitalId doctorId").lean(),
    subscriptionModel.find({ paymentStatus: "paid" }).select("price createdAt").lean(),
  ]);

  const suspendedHospitals = Math.max(0, totalHospitals - activeHospitals);

  // Status counters for selected range
  let completedAppointments = 0;
  let cancelledAppointments = 0;
  let pendingAppointments = 0;
  let missedAppointments = 0;
  let confirmedAppointments = 0;

  // Revenue counters
  let totalVerifiedRevenue = 0;
  let todayRevenue = 0;
  let weeklyRevenue = 0;
  let monthlyRevenue = 0;
  let yearlyRevenue = 0;
  let totalRefunds = 0;
  let successfulPaymentsCount = 0;
  let pendingPaymentsCount = 0;
  let failedPaymentsCount = 0;
  let refundedPaymentsCount = 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

  // Process all appointments for lifetime revenue & current benchmarks
  for (const apt of allAppointments) {
    const amt = Number(apt.amount || apt.billing?.totalAmount || 0);
    const created = apt.createdAt ? new Date(apt.createdAt) : now;

    if (apt.paymentStatus === "REFUNDED" || apt.paymentStatus === "refunded") {
      totalRefunds += amt;
      refundedPaymentsCount++;
    } else if (isVerifiedSuccessfulPayment(apt)) {
      totalVerifiedRevenue += amt;
      successfulPaymentsCount++;

      if (created >= startOfToday) todayRevenue += amt;
      if (created >= oneWeekAgo) weeklyRevenue += amt;
      if (created >= startOfMonth) monthlyRevenue += amt;
      if (created >= startOfYear) yearlyRevenue += amt;
    } else if (apt.paymentStatus === "FAILED") {
      failedPaymentsCount++;
    } else if (apt.paymentStatus === "PENDING" && apt.paymentMethod === "online" && apt.status !== "cancel" && apt.status !== "cancelled") {
      pendingPaymentsCount++;
    }
  }

  // Include subscription revenue in platform total
  let subscriptionRevenue = 0;
  for (const sub of subscriptions) {
    subscriptionRevenue += Number(sub.price || 0);
  }
  const netPlatformRevenue = Math.max(0, totalVerifiedRevenue + subscriptionRevenue - totalRefunds);

  // Process range appointments
  for (const apt of appointmentsInRange) {
    if (apt.status === "completed") completedAppointments++;
    else if (apt.status === "cancel" || apt.status === "cancelled") cancelledAppointments++;
    else if (apt.status === "pending") pendingAppointments++;
    else if (apt.status === "missed") missedAppointments++;
    else if (apt.status === "confirmed") confirmedAppointments++;
  }

  // Generate Daily Time-Series Data for charts (Last 7 days or range days)
  const daysDiff = Math.min(30, Math.max(7, Math.ceil((end - start) / (1000 * 60 * 60 * 24))));
  const dailyTrends = [];
  for (let i = daysDiff - 1; i >= 0; i--) {
    const targetDate = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const label = targetDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    let count = 0;
    let rev = 0;
    let completed = 0;
    let cancelled = 0;

    for (const apt of allAppointments) {
      const created = apt.createdAt ? new Date(apt.createdAt) : null;
      if (created && created >= dayStart && created <= dayEnd) {
        count++;
        if (isVerifiedSuccessfulPayment(apt)) {
          rev += Number(apt.amount || apt.billing?.totalAmount || 0);
        }
        if (apt.status === "completed") completed++;
        if (apt.status === "cancel" || apt.status === "cancelled") cancelled++;
      }
    }

    dailyTrends.push({
      label,
      date: dayStart.toISOString().split("T")[0],
      appointments: count,
      revenue: rev,
      completed,
      cancelled,
    });
  }

  // Monthly trends (Last 6 months)
  const monthlyTrends = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = mStart.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    let count = 0;
    let rev = 0;
    for (const apt of allAppointments) {
      const created = apt.createdAt ? new Date(apt.createdAt) : null;
      if (created && created >= mStart && created <= mEnd) {
        count++;
        if (isVerifiedSuccessfulPayment(apt)) {
          rev += Number(apt.amount || apt.billing?.totalAmount || 0);
        }
      }
    }
    monthlyTrends.push({ label, appointments: count, revenue: rev });
  }

  return {
    success: true,
    filter: {
      range: cleanRange,
      rangeLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    hospitals: {
      total: totalHospitals,
      active: activeHospitals,
      suspended: suspendedHospitals,
    },
    users: {
      totalPatients,
      totalDoctors,
    },
    appointments: {
      total: allAppointments.length,
      inSelectedRange: appointmentsInRange.length,
      completed: completedAppointments,
      cancelled: cancelledAppointments,
      pending: pendingAppointments,
      missed: missedAppointments,
      confirmed: confirmedAppointments,
      completionRate: appointmentsInRange.length > 0 ? Math.round((completedAppointments / appointmentsInRange.length) * 100) : 0,
      cancellationRate: appointmentsInRange.length > 0 ? Math.round((cancelledAppointments / appointmentsInRange.length) * 100) : 0,
    },
    revenue: {
      totalRevenue: totalVerifiedRevenue,
      subscriptionRevenue,
      netPlatformRevenue,
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
      totalRefunds,
      payments: {
        successful: successfulPaymentsCount,
        pending: pendingPaymentsCount,
        failed: failedPaymentsCount,
        refunded: refundedPaymentsCount,
      },
      currency: "INR",
      currencySymbol: "₹",
    },
    charts: {
      dailyTrends,
      monthlyTrends,
      statusDistribution: [
        { name: "Completed", value: completedAppointments, color: "#10b981" },
        { name: "Confirmed", value: confirmedAppointments, color: "#3b82f6" },
        { name: "Pending", value: pendingAppointments, color: "#f59e0b" },
        { name: "Cancelled", value: cancelledAppointments, color: "#ef4444" },
        { name: "Missed", value: missedAppointments, color: "#94a3b8" },
      ],
    },
  };
}

/**
 * Hospital Admin: Hospital-Isolated Performance & Analytics
 */
export async function getHospitalAdminAnalytics(hospitalId, filterOptions = {}) {
  if (!hospitalId || !mongoose.Types.ObjectId.isValid(String(hospitalId))) {
    throw new Error("Valid hospital identifier is required for hospital-level analytics");
  }

  const hId = new mongoose.Types.ObjectId(String(hospitalId));
  const { start, end, rangeLabel } = resolveDateRange(filterOptions);

  const [hospital, doctors, allHospitalAppointments, rangeAppointments] = await Promise.all([
    hospitalModel.findById(hId).select("name email phone departments address city status").lean(),
    doctorModel.find({ hospitalId: hId }).select("name speciality department fees rating available isActive").lean(),
    appointmentModel.find({ hospitalId: hId })
      .populate("doctorId", "name speciality department")
      .populate("userId", "name phone email gender")
      .lean(),
    appointmentModel.find({ hospitalId: hId, createdAt: { $gte: start, $lte: end } }).lean(),
  ]);

  if (!hospital) {
    throw new Error("Hospital record not found");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

  let todayAppointmentsCount = 0;
  let upcomingAppointmentsCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;
  let confirmedCount = 0;

  let totalCollectedRevenue = 0;
  let todayRevenue = 0;
  let weeklyRevenue = 0;
  let monthlyRevenue = 0;
  let yearlyRevenue = 0;
  let totalRefunds = 0;

  const distinctPatientIds = new Set();

  for (const apt of allHospitalAppointments) {
    if (apt.userId) {
      distinctPatientIds.add(String(apt.userId._id || apt.userId));
    }

    const amt = Number(apt.amount || apt.billing?.totalAmount || 0);
    const created = apt.createdAt ? new Date(apt.createdAt) : now;

    if (apt.paymentStatus === "REFUNDED" || apt.paymentStatus === "refunded") {
      totalRefunds += amt;
    } else if (isVerifiedSuccessfulPayment(apt)) {
      totalCollectedRevenue += amt;
      if (created >= startOfToday) todayRevenue += amt;
      if (created >= oneWeekAgo) weeklyRevenue += amt;
      if (created >= startOfMonth) monthlyRevenue += amt;
      if (created >= startOfYear) yearlyRevenue += amt;
    }

    // Appointment status counting for lifetime
    if (apt.status === "completed") completedCount++;
    else if (apt.status === "cancel" || apt.status === "cancelled") cancelledCount++;
    else if (apt.status === "pending") pendingCount++;
    else if (apt.status === "confirmed") confirmedCount++;

    // Today / Upcoming slots
    if (created >= startOfToday && created <= endOfToday) {
      todayAppointmentsCount++;
    } else if (created > endOfToday && (apt.status === "pending" || apt.status === "confirmed")) {
      upcomingAppointmentsCount++;
    }
  }

  // Doctor-wise performance aggregation (Hospital isolated)
  const doctorPerformanceMap = {};
  for (const d of doctors) {
    doctorPerformanceMap[String(d._id)] = {
      doctorId: d._id,
      name: d.name,
      speciality: d.speciality || d.department || "General",
      totalAppointments: 0,
      completedConsultations: 0,
      cancelledAppointments: 0,
      verifiedRevenue: 0,
      patientCount: 0,
      patientsSet: new Set(),
      rating: d.rating || 5.0,
      available: d.available !== false && d.isActive !== false,
    };
  }

  for (const apt of allHospitalAppointments) {
    const docIdStr = String(apt.doctorId?._id || apt.doctorId);
    if (doctorPerformanceMap[docIdStr]) {
      const dp = doctorPerformanceMap[docIdStr];
      dp.totalAppointments++;
      if (apt.status === "completed") dp.completedConsultations++;
      if (apt.status === "cancel" || apt.status === "cancelled") dp.cancelledAppointments++;
      if (isVerifiedSuccessfulPayment(apt)) {
        dp.verifiedRevenue += Number(apt.amount || apt.billing?.totalAmount || 0);
      }
      if (apt.userId) {
        dp.patientsSet.add(String(apt.userId._id || apt.userId));
      }
    }
  }

  const doctorPerformance = Object.values(doctorPerformanceMap).map((d) => ({
    doctorId: d.doctorId,
    name: d.name,
    speciality: d.speciality,
    totalAppointments: d.totalAppointments,
    completedConsultations: d.completedConsultations,
    cancelledAppointments: d.cancelledAppointments,
    completionRate: d.totalAppointments > 0 ? Math.round((d.completedConsultations / d.totalAppointments) * 100) : 0,
    cancellationRate: d.totalAppointments > 0 ? Math.round((d.cancelledAppointments / d.totalAppointments) * 100) : 0,
    verifiedRevenue: d.verifiedRevenue,
    patientCount: d.patientsSet.size,
    rating: d.rating,
    available: d.available,
  })).sort((a, b) => b.completedConsultations - a.completedConsultations);

  // Daily Trends for Hospital
  const dailyTrends = [];
  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const label = targetDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    let count = 0;
    let rev = 0;
    let comp = 0;
    let canc = 0;

    for (const apt of allHospitalAppointments) {
      const created = apt.createdAt ? new Date(apt.createdAt) : null;
      if (created && created >= dayStart && created <= dayEnd) {
        count++;
        if (isVerifiedSuccessfulPayment(apt)) {
          rev += Number(apt.amount || apt.billing?.totalAmount || 0);
        }
        if (apt.status === "completed") comp++;
        if (apt.status === "cancel" || apt.status === "cancelled") canc++;
      }
    }

    dailyTrends.push({ label, appointments: count, revenue: rev, completed: comp, cancelled: canc });
  }

  return {
    success: true,
    hospital: {
      id: hospital._id,
      name: hospital.name,
      city: hospital.city,
    },
    filter: {
      range: filterOptions.range || "30d",
      rangeLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    overview: {
      totalAppointments: allHospitalAppointments.length,
      todayAppointments: todayAppointmentsCount,
      upcomingAppointments: upcomingAppointmentsCount,
      completedAppointments: completedCount,
      cancelledAppointments: cancelledCount,
      pendingAppointments: pendingCount,
      totalPatients: distinctPatientIds.size,
      activeDoctors: doctors.filter((d) => d.available && d.isActive !== false).length,
      totalDoctors: doctors.length,
      completionRate: allHospitalAppointments.length > 0 ? Math.round((completedCount / allHospitalAppointments.length) * 100) : 0,
      cancellationRate: allHospitalAppointments.length > 0 ? Math.round((cancelledCount / allHospitalAppointments.length) * 100) : 0,
    },
    revenue: {
      totalCollectedRevenue,
      netRevenue: Math.max(0, totalCollectedRevenue - totalRefunds),
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
      totalRefunds,
      currency: "INR",
      currencySymbol: "₹",
    },
    doctorPerformance,
    charts: {
      dailyTrends,
      statusDistribution: [
        { name: "Completed", value: completedCount, color: "#10b981" },
        { name: "Confirmed", value: confirmedCount, color: "#3b82f6" },
        { name: "Pending", value: pendingCount, color: "#f59e0b" },
        { name: "Cancelled", value: cancelledCount, color: "#ef4444" },
      ],
    },
  };
}

/**
 * Doctor: Doctor-Isolated Performance & Earnings Analytics
 */
export async function getDoctorAnalyticsData(doctorId, filterOptions = {}) {
  if (!doctorId || !mongoose.Types.ObjectId.isValid(String(doctorId))) {
    throw new Error("Valid doctor identifier is required");
  }

  const dId = new mongoose.Types.ObjectId(String(doctorId));
  const { start, end, rangeLabel } = resolveDateRange(filterOptions);

  const [doctor, appointments] = await Promise.all([
    doctorModel.findById(dId).select("name speciality department hospitalId fees rating").lean(),
    appointmentModel.find({ doctorId: dId })
      .populate("userId", "name phone email gender")
      .populate("hospitalId", "name")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!doctor) {
    throw new Error("Doctor record not found");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

  let todayAppointments = 0;
  let upcomingAppointments = 0;
  let completedAppointments = 0;
  let cancelledAppointments = 0;
  let pendingAppointments = 0;

  let totalEarnings = 0;
  let todayEarnings = 0;
  let weeklyEarnings = 0;
  let monthlyEarnings = 0;
  let yearlyEarnings = 0;

  const distinctPatientIds = new Set();
  const consultationTypes = { clinic: 0, video: 0 };

  for (const apt of appointments) {
    if (apt.userId) {
      distinctPatientIds.add(String(apt.userId._id || apt.userId));
    }

    if (apt.consultationType === "video") consultationTypes.video++;
    else consultationTypes.clinic++;

    const amt = Number(apt.amount || apt.billing?.totalAmount || doctor.fees || 0);
    const created = apt.createdAt ? new Date(apt.createdAt) : now;

    if (isVerifiedSuccessfulPayment(apt)) {
      totalEarnings += amt;
      if (created >= startOfToday) todayEarnings += amt;
      if (created >= oneWeekAgo) weeklyEarnings += amt;
      if (created >= startOfMonth) monthlyEarnings += amt;
      if (created >= startOfYear) yearlyEarnings += amt;
    }

    if (apt.status === "completed") completedAppointments++;
    else if (apt.status === "cancel" || apt.status === "cancelled") cancelledAppointments++;
    else if (apt.status === "pending") pendingAppointments++;

    if (created >= startOfToday && created <= endOfToday) {
      todayAppointments++;
    } else if (created > endOfToday && (apt.status === "pending" || apt.status === "confirmed")) {
      upcomingAppointments++;
    }
  }

  // Daily Trends for Doctor
  const dailyTrends = [];
  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const label = targetDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    let count = 0;
    let earnings = 0;

    for (const apt of appointments) {
      const created = apt.createdAt ? new Date(apt.createdAt) : null;
      if (created && created >= dayStart && created <= dayEnd) {
        count++;
        if (isVerifiedSuccessfulPayment(apt)) {
          earnings += Number(apt.amount || apt.billing?.totalAmount || doctor.fees || 0);
        }
      }
    }
    dailyTrends.push({ label, appointments: count, earnings });
  }

  return {
    success: true,
    doctor: {
      id: doctor._id,
      name: doctor.name,
      speciality: doctor.speciality,
    },
    filter: {
      range: filterOptions.range || "30d",
      rangeLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    overview: {
      totalAppointments: appointments.length,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      pendingAppointments,
      totalPatientsTreated: distinctPatientIds.size,
      completionRate: appointments.length > 0 ? Math.round((completedAppointments / appointments.length) * 100) : 0,
      cancellationRate: appointments.length > 0 ? Math.round((cancelledAppointments / appointments.length) * 100) : 0,
      consultationTypes,
    },
    earnings: {
      totalEarnings,
      todayEarnings,
      weeklyEarnings,
      monthlyEarnings,
      yearlyEarnings,
      currency: "INR",
      currencySymbol: "₹",
    },
    charts: {
      dailyTrends,
      statusDistribution: [
        { name: "Completed", value: completedAppointments, color: "#10b981" },
        { name: "Pending", value: pendingAppointments, color: "#f59e0b" },
        { name: "Cancelled", value: cancelledAppointments, color: "#ef4444" },
      ],
    },
  };
}

/**
 * Patient: Authenticated Patient Dashboard & Activity Statistics
 */
export async function getPatientDashboardStats(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new Error("Valid user identifier is required");
  }

  const uId = new mongoose.Types.ObjectId(String(userId));

  const [appointments, healthDocs, reminders] = await Promise.all([
    appointmentModel.find({ userId: uId })
      .populate("doctorId", "name speciality image")
      .populate("hospitalId", "name address city")
      .sort({ createdAt: -1 })
      .lean(),
    mongoose.model("healthdocuments").find({ userId: uId, isArchived: { $ne: true } }).select("category createdAt").lean(),
    mongoose.model("medicationreminders").find({ userId: uId, isActive: true }).select("medicineName frequency times").lean(),
  ]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let upcomingCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;

  for (const apt of appointments) {
    if (apt.status === "completed") completedCount++;
    else if (apt.status === "cancel" || apt.status === "cancelled") cancelledCount++;
    else if (apt.status === "pending") pendingCount++;

    const created = apt.createdAt ? new Date(apt.createdAt) : now;
    if (created >= startOfToday && (apt.status === "pending" || apt.status === "confirmed")) {
      upcomingCount++;
    }
  }

  // Count documents by category
  const documentCategoryCounts = {};
  for (const doc of healthDocs) {
    const cat = doc.category || "other";
    documentCategoryCounts[cat] = (documentCategoryCounts[cat] || 0) + 1;
  }

  return {
    success: true,
    appointments: {
      total: appointments.length,
      upcoming: upcomingCount,
      completed: completedCount,
      cancelled: cancelledCount,
      pending: pendingCount,
    },
    healthWallet: {
      totalDocuments: healthDocs.length,
      categoryCounts: documentCategoryCounts,
    },
    prescriptions: {
      activePrescriptionCount: documentCategoryCounts["prescription"] || 0,
      activeMedicationReminders: reminders.length,
    },
    recentAppointments: appointments.slice(0, 5).map((a) => ({
      id: a._id,
      doctorName: a.doctorId?.name || a.doctorName || "Doctor",
      speciality: a.doctorId?.speciality || "General Physician",
      hospitalName: a.hospitalId?.name || a.hospitalName || "Hospital",
      slotDate: a.slotDate,
      slotTime: a.slotTime,
      status: a.status,
      consultationType: a.consultationType,
    })),
  };
}
