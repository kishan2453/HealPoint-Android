import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout/Layout";
import PremiumSelect from "../../components/common/PremiumSelect";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getAppointmentDetails,
  refundAppointmentPayment,
  updateAppointmentStatus,
  saveDoctorNotes,
} from "../../redux/actions/appointmentAction";
import { getAnalytics, getStats } from "../../redux/actions/userAction";
import toast from "../../utils/notify";
import { getAppointmentDisplayId } from "../../utils/appointmentDisplayId";

const valueOrNA = (value) => value || "NA";

const formatPaymentMethod = (method) =>
  method === "online" ? "Online Payment" : "Cash at appointment";

const formatPaymentStatus = (status) =>
  status ? status.replace("_", " ") : "NA";

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancel: "Cancelled",
  rescheduled: "Rescheduled",
  missed: "Missed Appointment",
};

const formatStatus = (status) => statusLabels[status] || valueOrNA(status);

const DetailItem = ({ label, value, wide = false }) => (
  <div className={`appointment-detail-item ${wide ? "is-wide" : ""}`}>
    <span>{label}</span>
    <strong>{valueOrNA(value)}</strong>
  </div>
);

const AppontementDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [appoinmtentStatus, setAppoinmtentStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");

  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [followUpAdvice, setFollowUpAdvice] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    dispatch(getAppointmentDetails(id));
  }, [dispatch, id]);

  const { appointment, loading, error } = useSelector((state) => state.appointments);

  const bookingStatus = appointment?.bookingStatus || "pending";
  const paymentStatus = appointment?.paymentStatus || "NA";
  const patientId =
    typeof appointment?.userId === "object"
      ? appointment?.userId?._id
      : appointment?.userId;
  const displayAppointmentId = appointment ? getAppointmentDisplayId(appointment) : "NA";
  const medicalReports = Array.isArray(appointment?.medicalReports) ? appointment.medicalReports : [];
  const isRefundAvailable =
    appointment?.paymentMethod === "online" &&
    appointment?.paymentStatus === "paid";

  useEffect(() => {
    if (appointment) {
      setAppoinmtentStatus(appointment?.bookingStatus);
      setDiagnosis(appointment?.diagnosis || "");
      setPrescription(appointment?.prescription || "");
      setMedicalNotes(appointment?.medicalNotes || "");
      setFollowUpAdvice(appointment?.followUpAdvice || "");
    }
  }, [appointment]);

  const handleUpdateStatus = async () => {
    try {
      await dispatch(updateAppointmentStatus({ id, appoinmtentStatus, reason: statusReason })).unwrap();
      dispatch(getAnalytics());
      dispatch(getStats());
      toast.success("Status Updated ");
      navigate("/all-appointments");
    } catch (error) {
      toast.error(error);
    }
  };

  const handleRefund = async () => {
    try {
      await dispatch(refundAppointmentPayment(id)).unwrap();
      dispatch(getAnalytics());
      dispatch(getStats());
      toast.success("Payment refunded successfully");
      dispatch(getAppointmentDetails(id));
    } catch (error) {
      toast.error(error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await dispatch(saveDoctorNotes({
        id,
        diagnosis,
        prescription,
        medicalNotes,
        followUpAdvice
      })).unwrap();
      toast.success("Doctor notes saved successfully");
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Layout>
      <section className="appointment-details-page">
        <section className="appointment-details-hero">
          <div>
            <span className="appointment-details-kicker">Appointment history</span>
            <h1>Appointment Details</h1>
            <p>
              View patient, doctor, payment, and booking status information in
              one operational summary.
            </p>
          </div>
          <div className="appointment-details-actions">
            <button
              className="btn btn-light"
              onClick={() => navigate("/all-appointments")}
            >
              Back
            </button>
            {patientId && (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/user-details/${patientId}`)}
              >
                👤 View Patient Profile
              </button>
            )}
            {isRefundAvailable && (
              <button className="btn btn-danger" onClick={handleRefund}>
                Refund Payment
              </button>
            )}
          </div>
        </section>

        {loading && !appointment && (
          <div className="empty-state">Loading appointment details...</div>
        )}

        {error && !loading && (
          <div className="empty-state">
            Unable to load appointment details. {error}
          </div>
        )}

        {!loading && !error && !appointment && (
          <div className="empty-state">Appointment details were not found.</div>
        )}

        {!loading && !error && appointment && (
        <>
        <div className="appointment-summary-grid">
          <div className="appointment-summary-card">
            <span>Appointment ID</span>
            <strong>{displayAppointmentId}</strong>
          </div>
          <div className="appointment-summary-card">
            <span>Booking Status</span>
            <strong className={`status-pill ${bookingStatus}`}>
              {formatStatus(bookingStatus)}
            </strong>
          </div>
          <div className="appointment-summary-card">
            <span>Payment</span>
            <strong>{formatPaymentStatus(paymentStatus)}</strong>
          </div>
          <div className="appointment-summary-card">
            <span>Amount</span>
            <strong>{appointment?.amount ? `Rs. ${appointment.amount}` : "NA"}</strong>
          </div>
          <div className="appointment-summary-card">
            <span>Schedule</span>
            <strong>
              {valueOrNA(appointment?.bookingDate)}{" "}
              {appointment?.bookingTime ? `at ${appointment.bookingTime}` : ""}
            </strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '2px solid #f1f5f9', marginTop: '24px' }}>
          <button 
            onClick={() => setActiveTab('details')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: '12px 12px 0 0', 
              border: 'none', 
              backgroundColor: activeTab === 'details' ? '#2563eb' : 'transparent', 
              color: activeTab === 'details' ? '#fff' : '#64748b', 
              fontWeight: '600',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'details' ? 'none' : '2px solid transparent'
            }}
          >
            Appointment Details
          </button>
          <button 
            onClick={() => setActiveTab('management')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: '12px 12px 0 0', 
              border: 'none', 
              backgroundColor: activeTab === 'management' ? '#2563eb' : 'transparent', 
              color: activeTab === 'management' ? '#fff' : '#64748b', 
              fontWeight: '600',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'management' ? 'none' : '2px solid transparent'
            }}
          >
            Appointment Management
          </button>
          <button 
            onClick={() => setActiveTab('medical')}
            style={{ 
              padding: '12px 24px', 
              borderRadius: '12px 12px 0 0', 
              border: 'none', 
              backgroundColor: activeTab === 'medical' ? '#2563eb' : 'transparent', 
              color: activeTab === 'medical' ? '#fff' : '#64748b', 
              fontWeight: '600',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === 'medical' ? 'none' : '2px solid transparent'
            }}
          >
            Medical Center
          </button>
        </div>

        {activeTab === 'details' && (
        <div className="appointment-details-shell">
          <div className="appointment-details-main">
            <section className="appointment-detail-card">
              <div className="appointment-detail-card-head">
                <div>
                  <h3>Patient Information</h3>
                  <p>Contact details linked with this appointment.</p>
                </div>
              </div>
              <div className="appointment-detail-grid">
                <DetailItem label="Patient Name" value={appointment?.clientName} />
                <DetailItem label="Patient Phone" value={appointment?.clientPhone} />
                <div className="appointment-detail-item is-wide">
                  <span>Patient Email</span>
                  <strong style={{ wordBreak: 'break-all' }}>{valueOrNA(appointment?.clientEmail)}</strong>
                </div>
              </div>
            </section>

            <section className="appointment-detail-card">
              <div className="appointment-detail-card-head">
                <div>
                  <h3>Doctor Information</h3>
                  <p>Doctor contact information recorded at booking time.</p>
                </div>
              </div>
              <div className="appointment-detail-grid">
                <DetailItem label="Doctor Name" value={appointment?.doctorName} />
                <DetailItem label="Doctor Phone" value={appointment?.doctorPhone} />
                <div className="appointment-detail-item is-wide">
                  <span>Doctor Email</span>
                  <strong style={{ wordBreak: 'break-all' }}>{valueOrNA(appointment?.doctorEmail)}</strong>
                </div>
              </div>
            </section>

            <section className="appointment-detail-card">
              <div className="appointment-detail-card-head">
                <div>
                  <h3>Payment Tracking</h3>
                  <p>Payment method, current payment state, and gateway IDs.</p>
                </div>
              </div>
              <div className="appointment-detail-grid">
                <DetailItem
                  label="Payment Method"
                  value={formatPaymentMethod(appointment?.paymentMethod)}
                />
                <DetailItem
                  label="Payment Status"
                  value={formatPaymentStatus(appointment?.paymentStatus)}
                />
                <div className="appointment-detail-item is-wide">
                  <span>Razorpay Payment ID</span>
                  <strong style={{ wordBreak: 'break-all' }}>{valueOrNA(appointment?.razorpayPaymentId)}</strong>
                </div>
                <div className="appointment-detail-item is-wide">
                  <span>Razorpay Refund ID</span>
                  <strong style={{ wordBreak: 'break-all' }}>{valueOrNA(appointment?.razorpayRefundId)}</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
        )}

        {activeTab === 'management' && (
        <div className="appointment-details-shell">
          <aside className="appointment-control-panel w-100" style={{ maxWidth: '100%' }}>
            <div className="appointment-timeline-card">
              <h3>Booking Timeline</h3>
              <div className="appointment-timeline-item">
                <span>Date</span>
                <strong>{valueOrNA(appointment?.bookingDate)}</strong>
              </div>
              <div className="appointment-timeline-item">
                <span>Time</span>
                <strong>{valueOrNA(appointment?.bookingTime)}</strong>
              </div>
              <div className="appointment-timeline-item">
                <span>Status</span>
                <strong className={`status-pill ${bookingStatus}`}>
                  {formatStatus(bookingStatus)}
                </strong>
              </div>
            </div>

            <div className="appointment-timeline-card">
              <h3>Status History</h3>
              {(appointment?.statusHistory || []).map((item, index) => (
                <div className="appointment-timeline-item" key={`${item.status}-${index}`}>
                  <span>{formatStatus(item.status)}</span>
                  <strong>{item.reason || "Status updated"}</strong>
                </div>
              ))}
              {!appointment?.statusHistory?.length && (
                <div className="appointment-timeline-item">
                  <span>Status</span>
                  <strong>No status history yet</strong>
                </div>
              )}
            </div>

            <div className="appointment-status-card">
              <h3>Update Booking Status</h3>
              <p>Change the operational state for this appointment.</p>
              
              {bookingStatus === "pending" && (
                <div className="approval-workflow mb-3">
                  <label>Doctor Approval Workflow</label>
                  <p className="small text-muted mb-2">Accept or reject this pending appointment.</p>
                  <div className="approval-actions">
                    <button 
                      className="btn btn-success approval-action approval-accept"
                      onClick={async () => {
                        try {
                          await dispatch(updateAppointmentStatus({ id, appoinmtentStatus: "confirmed", reason: statusReason || "Appointment accepted by admin" })).unwrap();
                          dispatch(getAnalytics());
                          dispatch(getStats());
                          toast.success("Appointment Accepted");
                          dispatch(getAppointmentDetails(id));
                        } catch (error) {
                          toast.error(error);
                        }
                      }}
                    >
                      Accept
                    </button>
                    <button 
                      className="btn btn-danger approval-action approval-reject"
                      onClick={async () => {
                        try {
                          if(!statusReason) {
                            toast.error("Please provide a rejection reason in the textarea below.");
                            return;
                          }
                          await dispatch(updateAppointmentStatus({ id, appoinmtentStatus: "cancel", reason: statusReason })).unwrap();
                          dispatch(getAnalytics());
                          dispatch(getStats());
                          toast.success("Appointment Rejected");
                          dispatch(getAppointmentDetails(id));
                        } catch (error) {
                          toast.error(error);
                        }
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              <label>Status</label>
              <select
                value={appoinmtentStatus}
                onChange={(e) => setAppoinmtentStatus(e.target.value)}
              >
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="completed">completed</option>
                <option value="cancel">cancel</option>
                <option value="rescheduled">rescheduled</option>
                <option value="missed">Missed Appointment</option>
              </select>
              <label>Reason</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Optional approval, rejection, or missed appointment reason"
                rows={3}
              />
              <button className="btn btn-primary" onClick={handleUpdateStatus}>
                Update Status
              </button>
            </div>
          </aside>
        </div>
        )}

        {activeTab === 'medical' && (
        <>
        <section className="appointment-detail-card">
          <div className="appointment-detail-card-head">
            <div>
              <h3>Medical Reports & Documents</h3>
              <p>View reports uploaded by the patient.</p>
            </div>
          </div>
          <div className="p-3">
            {medicalReports.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                {medicalReports.map((report, idx) => {
                  const reportUrl = typeof report?.url === "string" ? report.url : "";
                  const reportName = report?.name || report?.filename || "Medical report";
                  const uploadedAt = report?.uploadedAt ? new Date(report.uploadedAt) : null;
                  const uploadDate = uploadedAt && !Number.isNaN(uploadedAt.getTime())
                    ? uploadedAt.toLocaleString()
                    : "Upload date not available";
                  const isImage =
                    reportUrl.startsWith("data:image/") ||
                    /\.(jpeg|jpg|png)$/i.test(reportUrl);
                  return (
                    <div key={idx} className="border rounded p-3 d-flex align-items-start gap-3 bg-light">
                      {isImage ? (
                        <div style={{ width: "100px", height: "100px", flexShrink: 0, overflow: "hidden", borderRadius: "8px", border: "1px solid #ddd" }}>
                          <img src={reportUrl} alt={reportName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: "100px", height: "100px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e9ecef", borderRadius: "8px", fontSize: "2rem", color: "#6c757d" }}>
                          📄
                        </div>
                      )}
                      <div className="flex-grow-1">
                        <h5 className="mb-1">{reportName}</h5>
                        <p className="text-muted mb-2 small">
                          Patient: {appointment?.clientName || "Patient not available"}
                        </p>
                        <p className="text-muted mb-2 small">
                          Uploaded on: {uploadDate}
                        </p>
                        <p className="text-muted mb-2 small">
                          Type: <span className="badge bg-secondary">{report?.type || "report"}</span>
                        </p>
                        <div className="d-flex gap-2">
                          <a
                            href={reportUrl}
                            download={reportName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`btn btn-outline-primary btn-sm ${reportUrl ? "" : "disabled"}`}
                          >
                            Download
                          </a>
                          <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`btn btn-outline-secondary btn-sm ${reportUrl ? "" : "disabled"}`}
                          >
                            View
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted mb-0">No medical reports uploaded by patient.</p>
            )}
          </div>
        </section>

        <section className="appointment-detail-card mt-4">
          <div className="appointment-detail-card-head">
            <div>
              <h3>Doctor Notes & Prescription</h3>
              <p>Add consultation diagnosis, prescription, notes, and follow-up advice.</p>
            </div>
          </div>
          <div className="p-4">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Diagnosis</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Primary diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Follow-Up Advice</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Visit after 2 weeks"
                  value={followUpAdvice}
                  onChange={(e) => setFollowUpAdvice(e.target.value)}
                />
              </div>
              <div className="col-md-12">
                <label className="form-label fw-bold">Prescription</label>
                <textarea 
                  className="form-control" 
                  placeholder="Medication names, dosage, duration..."
                  rows={3}
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                />
              </div>
              <div className="col-md-12">
                <label className="form-label fw-bold">Medical Notes (Private)</label>
                <textarea 
                  className="form-control" 
                  placeholder="Internal observations and notes..."
                  rows={3}
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                />
              </div>
              <div className="col-12 mt-3">
                <button className="btn btn-primary px-4" onClick={handleSaveNotes}>
                  Save Doctor Notes
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="appointment-detail-card mt-4">
          <div className="appointment-detail-card-head">
            <div>
              <h3>Quick Patient History</h3>
              <p>Previous appointments, doctors, reviews, missed appointments, and last visit.</p>
            </div>
          </div>
          <div className="appointment-detail-grid">
            <DetailItem label="Total Appointments" value={appointment?.patientHistory?.totalAppointments} />
            <DetailItem label="Last Visit Date" value={appointment?.patientHistory?.lastVisitDate} />
            <DetailItem label="Missed Appointments" value={appointment?.patientHistory?.missedAppointments || 0} />
            <DetailItem
              label="Previous Doctors"
              value={appointment?.patientHistory?.previousDoctors?.join(", ")}
              wide
            />
            <DetailItem
              label="Previous Reviews"
              value={appointment?.patientHistory?.previousReviews?.length || 0}
              wide
            />
          </div>
        </section>
        </>
        )}
        </>
        )}
      </section>
    </Layout>
  );
};

export default AppontementDetails;
