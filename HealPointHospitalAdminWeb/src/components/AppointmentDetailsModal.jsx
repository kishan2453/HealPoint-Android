import React from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaClock,
  FaUserMd,
  FaUserInjured,
  FaCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaFilePdf,
  FaPrint,
  FaRupeeSign,
  FaCreditCard,
  FaMoneyBillWave,
  FaVideo,
  FaClinicMedical,
  FaHistory,
  FaNotesMedical,
  FaFileMedical,
  FaPhoneAlt,
  FaEnvelope,
  FaExclamationTriangle,
  FaHospital,
} from "react-icons/fa";
import { formatDoctorName } from "../services/doctorFormat";
import SmartCareJourney from "./SmartCareJourney";

export default function AppointmentDetailsModal({
  appointment,
  onClose,
  onStatusChange,
  onRescheduleClick,
  onCancelClick,
  busyId,
}) {
  if (!appointment) return null;

  const patient = appointment.userId || {};
  const doctor = appointment.doctorId || {};
  const status = appointment.status || "pending";
  const paymentStatus = appointment.paymentStatus || "cash_pending";
  const isPaid = paymentStatus === "paid" || appointment.payment === true;

  const statusBadgeClass =
    {
      pending: "status-pill status-amber",
      confirmed: "status-pill status-blue",
      completed: "status-pill status-green",
      cancel: "status-pill status-danger",
      rescheduled: "status-pill status-purple",
      missed: "status-pill status-gray",
    }[status] || "status-pill status-gray";

  const statusDisplay =
    {
      pending: "Pending Confirmation",
      confirmed: "Confirmed",
      completed: "Completed",
      cancel: "Cancelled",
      rescheduled: "Rescheduled",
      missed: "Missed Appointment",
    }[status] || status;

  const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal appointment-details-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: "780px",
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="modal-header-with-actions">
          <div className="modal-title-wrap">
            <span className="modal-badge-ico blue">
              <FaCalendarAlt />
            </span>
            <div>
              <div className="modal-top-tags">
                <span className="appt-id-badge">
                  ID: {appointment.appointmentId || appointment._id}
                </span>
                <span className={statusBadgeClass}>
                  <span className="status-dot"></span> {statusDisplay}
                </span>
              </div>
              <h2>Appointment Details</h2>
            </div>
          </div>
          <div className="modal-header-btns">
            <button
              type="button"
              className="modal-icon-btn"
              onClick={handlePrint}
              title="Print Appointment Summary"
            >
              <FaPrint />
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="appt-detail-sections-container">
          {/* Smart Care Journey Operational Flow */}
          <SmartCareJourney appointment={appointment} />

          {/* Patient & Doctor Two-Column Grid */}
          <div className="appt-stakeholders-grid">
            {/* Patient Card */}
            <div className="stakeholder-card">
              <div className="stakeholder-header">
                <div className="stakeholder-avatar patient-avatar">
                  {patient.image ? (
                    <img src={patient.image} alt={patient.name} />
                  ) : (
                    <FaUserInjured />
                  )}
                </div>
                <div>
                  <span className="stakeholder-role">Patient Information</span>
                  <h4 className="stakeholder-name">
                    {patient.name || "Patient"}
                  </h4>
                </div>
              </div>
              <div className="stakeholder-details">
                <div className="detail-item">
                  <FaPhoneAlt className="detail-ico" />
                  <span>
                    {appointment.patientPhone ||
                      patient.phone ||
                      "Phone not provided"}
                  </span>
                </div>
                <div className="detail-item">
                  <FaEnvelope className="detail-ico" />
                  <span>{patient.email || "Email not provided"}</span>
                </div>
                {patient.gender && (
                  <div className="detail-item">
                    <span className="detail-label">Gender / DOB:</span>
                    <span>
                      {patient.gender}
                      {patient.dob ? ` · ${patient.dob}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Doctor Card */}
            <div className="stakeholder-card">
              <div className="stakeholder-header">
                <div className="stakeholder-avatar doctor-avatar">
                  {doctor.image ? (
                    <img src={doctor.image} alt={doctor.name} />
                  ) : (
                    <FaUserMd />
                  )}
                </div>
                <div>
                  <span className="stakeholder-role">
                    Assigned Practitioner
                  </span>
                  <h4 className="stakeholder-name">
                    {formatDoctorName(doctor.name, "Doctor")}
                  </h4>
                </div>
              </div>
              <div className="stakeholder-details">
                <div className="detail-item">
                  <FaClinicMedical className="detail-ico" />
                  <span>
                    {doctor.speciality || "General Physician"} ·{" "}
                    <strong>{doctor.department || "Clinical Care"}</strong>
                  </span>
                </div>
                <div className="detail-item">
                  <FaPhoneAlt className="detail-ico" />
                  <span>{doctor.phone || "Hospital Extension"}</span>
                </div>
                {doctor.fees && (
                  <div className="detail-item">
                    <span className="detail-label">Consultation Fee:</span>
                    <strong>{formatMoney(doctor.fees)}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Schedule & Consultation Specs */}
          <div className="appt-spec-card">
            <h3>Schedule & Consultation Mode</h3>
            <div className="spec-items-grid">
              <div className="spec-box">
                <FaCalendarAlt className="spec-ico blue" />
                <div>
                  <small>Appointment Date</small>
                  <strong>{appointment.slotDate}</strong>
                </div>
              </div>
              <div className="spec-box">
                <FaClock className="spec-ico green" />
                <div>
                  <small>Time Slot</small>
                  <strong>{appointment.slotTime}</strong>
                </div>
              </div>
              <div className="spec-box">
                {appointment.consultationType === "video" ? (
                  <FaVideo className="spec-ico purple" />
                ) : (
                  <FaClinicMedical className="spec-ico amber" />
                )}
                <div>
                  <small>Consultation Mode</small>
                  <strong>
                    {appointment.consultationType === "video"
                      ? "Online Video Consult"
                      : "In-Hospital OPD Visit"}
                  </strong>
                </div>
              </div>
            </div>

            {appointment.consultationType === "video" &&
              appointment.meetingUrl && (
                <div className="video-meet-box">
                  <div className="meet-info">
                    <FaVideo />
                    <span>Google Meet Video Consultation Room Active</span>
                  </div>
                  <a
                    href={appointment.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-join-meet"
                  >
                    Join Meeting Room
                  </a>
                </div>
              )}
          </div>

          {/* Financial & Payment Breakdown */}
          <div className="appt-spec-card">
            <h3>Payment & Billing Details</h3>
            <div className="spec-items-grid">
              <div className="spec-box">
                <FaRupeeSign className="spec-ico green" />
                <div>
                  <small>Consultation Amount</small>
                  <strong>{formatMoney(appointment.amount)}</strong>
                </div>
              </div>
              <div className="spec-box">
                {appointment.paymentMethod === "online" ? (
                  <FaCreditCard className="spec-ico blue" />
                ) : (
                  <FaMoneyBillWave className="spec-ico amber" />
                )}
                <div>
                  <small>Payment Method</small>
                  <strong>
                    {appointment.paymentMethod === "online"
                      ? "Online (Razorpay)"
                      : "Pay at Hospital Desk (Cash)"}
                  </strong>
                </div>
              </div>
              <div className="spec-box">
                <div
                  className={`payment-status-pill ${
                    isPaid ? "paid" : "pending"
                  }`}
                >
                  {isPaid ? "Paid & Verified" : "Payment Pending"}
                </div>
                <div>
                  <small>Transaction Status</small>
                  <strong>
                    {paymentStatus.replace("_", " ").toUpperCase()}
                  </strong>
                </div>
              </div>
            </div>

            {appointment.razorpayOrderId && (
              <div className="payment-meta-details">
                <span className="meta-text">
                  Razorpay Order: <code>{appointment.razorpayOrderId}</code>
                </span>
                {appointment.razorpayPaymentId && (
                  <span className="meta-text">
                    Payment ID: <code>{appointment.razorpayPaymentId}</code>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Medical Reports & Clinical Notes */}
          {(appointment.medicalReports?.length > 0 ||
            appointment.medicalNotes ||
            appointment.diagnosis) && (
            <div className="appt-spec-card">
              <h3>Clinical Documentation & Reports</h3>
              {appointment.diagnosis && (
                <div className="clinical-notes-block">
                  <strong>Diagnosis / Clinical Assessment:</strong>
                  <p>{appointment.diagnosis}</p>
                </div>
              )}
              {appointment.medicalNotes && (
                <div className="clinical-notes-block">
                  <strong>Practitioner Notes:</strong>
                  <p>{appointment.medicalNotes}</p>
                </div>
              )}
              {appointment.medicalReports?.length > 0 && (
                <div className="attached-reports-list">
                  <strong>
                    Attached Medical Reports (
                    {appointment.medicalReports.length}):
                  </strong>
                  <div className="report-tags-container">
                    {appointment.medicalReports.map((report, idx) => (
                      <a
                        key={idx}
                        href={report.url}
                        target="_blank"
                        rel="noreferrer"
                        className="report-download-chip"
                      >
                        <FaFilePdf /> {report.name || `Report ${idx + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status History Timeline */}
          {appointment.statusHistory?.length > 0 && (
            <div className="appt-spec-card">
              <h3>Audit Trail & Status History</h3>
              <div className="status-timeline">
                {appointment.statusHistory.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-title-row">
                        <span className="timeline-status-badge">
                          {item.status.toUpperCase()}
                        </span>
                        <span className="timeline-actor">
                          By: {item.actor || "System"}
                        </span>
                        <span className="timeline-date">
                          {item.changedAt
                            ? new Date(item.changedAt).toLocaleString("en-IN")
                            : ""}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="timeline-reason">{item.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="modal-actions-premier appt-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={busyId === appointment._id}
          >
            Close
          </button>

          <div className="action-buttons-group">
            {/* Confirm button if pending or rescheduled */}
            {["pending", "rescheduled"].includes(status) && (
              <button
                type="button"
                className="btn-action-confirm"
                disabled={busyId === appointment._id}
                onClick={() => onStatusChange(appointment, "confirmed")}
              >
                <FaCheck /> Confirm Appointment
              </button>
            )}

            {/* Complete button if confirmed */}
            {status === "confirmed" && (
              <button
                type="button"
                className="btn-action-complete"
                disabled={busyId === appointment._id}
                onClick={() => onStatusChange(appointment, "completed")}
              >
                <FaCheckCircle /> Mark as Completed
              </button>
            )}

            {/* Reschedule button if not completed or cancelled */}
            {!["completed", "cancel", "missed"].includes(status) && (
              <button
                type="button"
                className="btn-action-reschedule"
                disabled={busyId === appointment._id}
                onClick={() => onRescheduleClick(appointment)}
              >
                <FaCalendarAlt /> Reschedule Slot
              </button>
            )}

            {/* Cancel button if not completed or cancelled */}
            {!["completed", "cancel", "missed"].includes(status) && (
              <button
                type="button"
                className="btn-action-cancel"
                disabled={busyId === appointment._id}
                onClick={() => onCancelClick(appointment)}
              >
                <FaTimesCircle /> Cancel Appointment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
