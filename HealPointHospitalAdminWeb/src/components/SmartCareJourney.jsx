import React from "react";
import {
  FaCheck,
  FaCalendarCheck,
  FaMoneyBillWave,
  FaUserCheck,
  FaHospitalUser,
  FaStethoscope,
  FaPrescriptionBottleAlt,
  FaVideo,
} from "react-icons/fa";

export default function SmartCareJourney({ appointment }) {
  if (!appointment) return null;

  const status = (appointment.status || "pending").toLowerCase();
  const isCancelled = status === "cancel";
  const isCompleted = status === "completed";
  const isConfirmed = status === "confirmed";
  const isPending = status === "pending";

  const rawPaymentStatus = (appointment.paymentStatus || "")
    .trim()
    .toLowerCase();
  const isPaid =
    appointment.payment === true ||
    ["paid", "success", "succeeded", "captured"].includes(rawPaymentStatus);
  const isCash = appointment.paymentMethod === "cash";
  const isVideo = appointment.consultationType === "video";
  const isCheckedIn = Boolean(appointment.checkedIn);
  const queueStatus = (
    appointment.queueStatus || "not_checked_in"
  ).toLowerCase();
  const queueToken = appointment.queueToken;

  const hasPrescription =
    Boolean(appointment.prescription && appointment.prescription.trim()) ||
    Boolean(appointment.medicines && appointment.medicines.length > 0);

  const steps = [
    {
      id: "booked",
      title: "Booking Received",
      icon: FaCalendarCheck,
      completed: true,
      current: false,
      failed: false,
      detail: `${appointment.slotDate || ""} ${appointment.slotTime ? `· ${appointment.slotTime}` : ""}`,
      badge: "Booked",
    },
    {
      id: "payment",
      title: "Payment",
      icon: FaMoneyBillWave,
      completed: isPaid || Number(appointment.amount || 0) === 0,
      current: !isPaid && !isCancelled,
      failed: isCancelled,
      detail: isPaid
        ? `₹${appointment.amount} Paid`
        : isCash
          ? `₹${appointment.amount} Pay at Desk`
          : `₹${appointment.amount} Online Pending`,
      badge: isPaid ? "Paid" : isCash ? "Cash" : "Pending",
    },
    {
      id: "acceptance",
      title: "Doctor Accepted",
      icon: FaUserCheck,
      completed: isConfirmed || isCompleted,
      current: isPending && !isCancelled,
      failed: isCancelled,
      detail: isCancelled
        ? "Cancelled"
        : isConfirmed || isCompleted
          ? "Accepted by Doctor"
          : "Pending Doctor Action",
      badge: isCancelled
        ? "Cancelled"
        : isConfirmed || isCompleted
          ? "Confirmed"
          : "Pending",
    },
    {
      id: "checkin",
      title: isVideo ? "Virtual Room" : "Patient Check-In",
      icon: isVideo ? FaVideo : FaHospitalUser,
      completed: isCheckedIn || (isVideo && isCompleted),
      current:
        (!isCheckedIn && isConfirmed && !isCompleted && !isVideo) ||
        (isVideo && !isCompleted),
      failed: isCancelled,
      detail: isVideo
        ? isCompleted
          ? "Completed Session"
          : "Virtual Meet"
        : isCheckedIn
          ? `Token #${queueToken || "A-001"} (${queueStatus.replace("_", " ")})`
          : "Awaiting Arrival / QR Scan",
      badge: isCheckedIn ? `Token #${queueToken || "A-001"}` : "Unchecked",
    },
    {
      id: "consultation",
      title: "Consultation",
      icon: FaStethoscope,
      completed: isCompleted,
      current:
        (isCheckedIn && !isCompleted) || queueStatus === "in_consultation",
      failed: isCancelled,
      detail: isCompleted
        ? "Session Completed"
        : queueStatus === "in_consultation"
          ? "With Doctor"
          : isCheckedIn
            ? "Waiting in Queue"
            : "Scheduled",
      badge: isCompleted ? "Done" : isCheckedIn ? "In Queue" : "Scheduled",
    },
    {
      id: "clinical",
      title: "Clinical Output",
      icon: FaPrescriptionBottleAlt,
      completed: hasPrescription,
      current: isCompleted && !hasPrescription,
      failed: false,
      detail: hasPrescription
        ? "Prescription Recorded"
        : isCompleted
          ? "Awaiting Rx Entry"
          : "Post-Consultation",
      badge: hasPrescription ? "Rx Ready" : "Pending",
    },
  ];

  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: isCancelled
                ? "#ef4444"
                : isCompleted
                  ? "#10b981"
                  : "#0284c7",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.01em",
            }}
          >
            Smart Care Journey & Operational Flow
          </span>
        </div>
        <span
          style={{
            fontSize: "12px",
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          {steps.filter((s) => s.completed).length} of {steps.length} Milestones
          Done
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: "10px",
          overflowX: "auto",
        }}
      >
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = step.completed;
          const isCurrent = step.current;
          const isErr = step.failed;

          return (
            <div
              key={step.id}
              style={{
                backgroundColor: isCurrent
                  ? "#f0f9ff"
                  : isErr
                    ? "#fef2f2"
                    : isDone
                      ? "#ffffff"
                      : "#f8fafc",
                border: `1px solid ${
                  isCurrent
                    ? "#38bdf8"
                    : isErr
                      ? "#fca5a5"
                      : isDone
                        ? "#cbd5e1"
                        : "#e2e8f0"
                }`,
                borderRadius: "8px",
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                minWidth: "110px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: isDone
                      ? "#10b981"
                      : isErr
                        ? "#ef4444"
                        : isCurrent
                          ? "#0284c7"
                          : "#cbd5e1",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                  }}
                >
                  {isDone ? <FaCheck /> : <Icon />}
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: isDone
                      ? "#059669"
                      : isErr
                        ? "#dc2626"
                        : isCurrent
                          ? "#0284c7"
                          : "#94a3b8",
                  }}
                >
                  {step.badge}
                </span>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: isCurrent ? "#0369a1" : "#1e293b",
                  marginBottom: "2px",
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontSize: "10.5px",
                  color: "#64748b",
                  lineHeight: "1.25",
                  wordBreak: "break-word",
                }}
              >
                {step.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
