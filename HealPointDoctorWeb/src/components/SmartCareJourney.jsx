import React from "react";
import {
  FaCheck,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarCheck,
  FaMoneyBillWave,
  FaHospitalUser,
  FaStethoscope,
  FaPrescriptionBottleAlt,
  FaFileMedical,
  FaCalendarPlus,
  FaVideo,
} from "react-icons/fa";

export default function SmartCareJourney({
  appointment,
  onAccept,
  onReject,
  onStartConsultation,
  onOpenPrescription,
  onOpenNotes,
  onUploadReports,
  busy = false,
}) {
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
  const consultStatus = (
    appointment.consultationStatus || "waiting"
  ).toLowerCase();
  const isInConsultation =
    consultStatus === "in_progress" ||
    appointment.queueStatus === "in_consultation";

  const hasPrescription =
    Boolean(appointment.prescription && appointment.prescription.trim()) ||
    Boolean(appointment.medicines && appointment.medicines.length > 0);
  const reportsCount = appointment.medicalReports?.length || 0;
  const followUpAdvice = (appointment.followUpAdvice || "").trim();

  // Define steps
  const steps = [
    {
      id: "booked",
      title: "Booked",
      icon: FaCalendarCheck,
      completed: true,
      current: false,
      failed: false,
      detail: `${appointment.slotDate} · ${appointment.slotTime}`,
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
          ? `₹${appointment.amount} Cash at Clinic`
          : `₹${appointment.amount} Pending`,
    },
    {
      id: "acceptance",
      title: "Doctor Acceptance",
      icon: FaCheckCircle,
      completed: isConfirmed || isCompleted,
      current: isPending && !isCancelled,
      failed: isCancelled,
      detail: isCancelled
        ? "Cancelled"
        : isConfirmed || isCompleted
          ? "Accepted"
          : "Action Required",
      canAction: isPending && !isCancelled,
    },
    {
      id: "checkin",
      title: isVideo ? "Virtual Room" : "Patient Arrival",
      icon: isVideo ? FaVideo : FaHospitalUser,
      completed:
        isCheckedIn ||
        (isVideo && (consultStatus === "in_progress" || isCompleted)),
      current:
        (isConfirmed && !isCheckedIn && !isCompleted && !isVideo) ||
        (isVideo && consultStatus === "ready_to_join"),
      failed: isCancelled,
      detail: isVideo
        ? isCompleted
          ? "Attended"
          : consultStatus === "ready_to_join"
            ? "Ready to join"
            : "Scheduled"
        : isCheckedIn
          ? `Checked In (Token: #${appointment.queueToken || "A-001"})`
          : "Expected on Arrival",
    },
    {
      id: "consultation",
      title: "Consultation",
      icon: FaStethoscope,
      completed: isCompleted,
      current:
        isInConsultation ||
        (isCheckedIn && !isCompleted) ||
        (isVideo && isConfirmed && !isCompleted),
      failed: isCancelled,
      detail: isCompleted
        ? "Completed"
        : isInConsultation
          ? "In Progress"
          : "Ready for Session",
    },
    {
      id: "rx",
      title: "Prescription",
      icon: FaPrescriptionBottleAlt,
      completed: hasPrescription,
      current: isCompleted && !hasPrescription,
      failed: false,
      detail: hasPrescription
        ? `${appointment.medicines?.length || 1} Medication(s)`
        : isCompleted
          ? "Not Recorded"
          : "Pending Session",
    },
  ];

  if (reportsCount > 0) {
    steps.push({
      id: "reports",
      title: "Reports",
      icon: FaFileMedical,
      completed: true,
      current: false,
      failed: false,
      detail: `${reportsCount} File(s) Attached`,
    });
  }

  if (followUpAdvice) {
    steps.push({
      id: "followup",
      title: "Follow-Up",
      icon: FaCalendarPlus,
      completed: true,
      current: false,
      failed: false,
      detail: followUpAdvice,
    });
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isCancelled
                  ? "#ef4444"
                  : isCompleted
                    ? "#10b981"
                    : "#0284c7",
              }}
            />
            Smart Care Journey & Lifecycle
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
            Real-time patient progress from booking through consultation and
            clinical records
          </p>
        </div>

        {/* Doctor Action Buttons if Pending */}
        {isPending && !isCancelled && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onAccept}
              disabled={busy}
              style={{
                backgroundColor: "#059669",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaCheck /> Accept Appointment
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              style={{
                backgroundColor: "#ffffff",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Decline
            </button>
          </div>
        )}

        {/* Start / Complete Consultation quick actions for doctor */}
        {isConfirmed && !isCompleted && !isCancelled && (
          <div style={{ display: "flex", gap: "8px" }}>
            {!isInConsultation ? (
              <button
                onClick={onStartConsultation}
                disabled={busy}
                style={{
                  backgroundColor: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaStethoscope /> Start Consultation
              </button>
            ) : (
              <button
                onClick={onOpenPrescription}
                disabled={busy}
                style={{
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaPrescriptionBottleAlt /> Complete & Prescribe
              </button>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Step Flow */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: "12px",
          overflowX: "auto",
        }}
      >
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = step.current;
          const isDone = step.completed;
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
                      ? "#f8fafc"
                      : "#ffffff",
                border: `1px solid ${
                  isCurrent
                    ? "#bae6fd"
                    : isErr
                      ? "#fecaca"
                      : isDone
                        ? "#e2e8f0"
                        : "#f1f5f9"
                }`,
                borderRadius: "8px",
                padding: "12px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                minWidth: "120px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
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
                    fontSize: "12px",
                  }}
                >
                  {isDone ? <FaCheck /> : <Icon />}
                </div>

                <span
                  style={{
                    fontSize: "11px",
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
                  {isDone
                    ? "✓ Done"
                    : isErr
                      ? "Cancelled"
                      : isCurrent
                        ? "Active"
                        : `Step ${idx + 1}`}
                </span>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isCurrent ? "#0369a1" : "#1e293b",
                  marginBottom: "4px",
                }}
              >
                {step.title}
              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  lineHeight: "1.3",
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
