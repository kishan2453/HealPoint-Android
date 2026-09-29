/**
 * Helper utilities for Smart Hospital Financial Intelligence Center.
 * Strictly formatted and typed, zero mock data.
 */
import type {
  FinancialTransactionItem,
  FinancialReconciliationIssue,
} from "@/types";

export function formatINR(amount: number): string {
  const safe = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatShortINR(amount: number): string {
  const safe = Number(amount) || 0;
  if (safe >= 10000000) {
    return `₹${(safe / 10000000).toFixed(1)}Cr`;
  }
  if (safe >= 100000) {
    return `₹${(safe / 100000).toFixed(1)}L`;
  }
  if (safe >= 1000) {
    return `₹${(safe / 1000).toFixed(1)}k`;
  }
  return `₹${safe}`;
}

export function getPaymentStatusBadge(
  status: string,
  isVerifiedPaid: boolean,
): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  if (isVerifiedPaid) {
    return {
      label: "Verified Paid",
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    };
  }

  const s = String(status || "").toLowerCase();
  switch (s) {
    case "paid":
      return {
        label: "Paid",
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
      };
    case "cash_pending":
      return {
        label: "Cash Pending",
        bg: "bg-amber-500/15",
        text: "text-amber-400",
        border: "border-amber-500/30",
      };
    case "online_pending":
      return {
        label: "Online Pending",
        bg: "bg-cyan-500/15",
        text: "text-cyan-400",
        border: "border-cyan-500/30",
      };
    case "refunded":
      return {
        label: "Refunded",
        bg: "bg-purple-500/15",
        text: "text-purple-400",
        border: "border-purple-500/30",
      };
    case "failed":
      return {
        label: "Failed",
        bg: "bg-rose-500/15",
        text: "text-rose-400",
        border: "border-rose-500/30",
      };
    default:
      return {
        label: s.replace(/_/g, " ") || "Pending",
        bg: "bg-slate-500/15",
        text: "text-slate-400",
        border: "border-slate-500/30",
      };
  }
}

export function getSeverityStyle(severity: "high" | "medium" | "low"): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (severity) {
    case "high":
      return {
        bg: "bg-rose-950/30",
        text: "text-rose-400",
        border: "border-rose-800/50",
        badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      };
    case "medium":
      return {
        bg: "bg-amber-950/30",
        text: "text-amber-400",
        border: "border-amber-800/50",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      };
    case "low":
    default:
      return {
        bg: "bg-blue-950/30",
        text: "text-blue-400",
        border: "border-blue-800/50",
        badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      };
  }
}

export function generateFinancialCSV(
  transactions: FinancialTransactionItem[],
): string {
  const headers = [
    "Appointment ID",
    "Patient Name",
    "Patient Phone",
    "Doctor Name",
    "Department",
    "Slot Date",
    "Slot Time",
    "Amount",
    "Currency",
    "Payment Method",
    "Payment Status",
    "Verified Paid",
    "Razorpay Payment ID",
    "Razorpay Order ID",
    "Razorpay Refund ID",
    "Visit Status",
    "Consultation Type",
  ];

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = transactions.map((t) => [
    escapeCSV(t.displayAppointmentId || t.appointmentId),
    escapeCSV(t.patient?.name || "Patient"),
    escapeCSV(t.patient?.phone || ""),
    escapeCSV(t.doctor?.name || "Doctor"),
    escapeCSV(t.doctor?.department || "General OPD"),
    escapeCSV(t.slotDate),
    escapeCSV(t.slotTime),
    escapeCSV(t.amount),
    escapeCSV(t.currency || "INR"),
    escapeCSV(t.paymentMethod),
    escapeCSV(t.paymentStatus),
    escapeCSV(t.isVerifiedPaid ? "Yes" : "No"),
    escapeCSV(t.razorpayPaymentId || ""),
    escapeCSV(t.razorpayOrderId || ""),
    escapeCSV(t.razorpayRefundId || ""),
    escapeCSV(t.status),
    escapeCSV(t.consultationType),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
