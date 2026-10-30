import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import SmartCareJourney from "../components/SmartCareJourney";

export default function AppointmentDetails() {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const stored = JSON.parse(localStorage.getItem("doctorApp") || "null");
  const [editor, setEditor] = useState(null); // "notes" | "prescription"
  const [notesText, setNotesText] = useState("");
  const [rxForm, setRxForm] = useState({
    prescription: "",
    diagnosis: "",
    followUpAdvice: "",
  });
  const [saving, setSaving] = useState(false);
  const doctorId = stored?.doctor?._id;

  const fetchAppointment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}`);
      const found = (res.data.dashboard?.allAppointments || []).find(
        (item) => item._id === id,
      );
      if (!found) throw new Error("Appointment not found");
      setAppointment(found);
      setPatient(found.patient || found.userId);
      if (found.patient?._id || found.userId?._id) {
        try {
          const historyRes = await api.get(
            `/api/v1/doctor/panel/${doctorId}/patient/${found.patient?._id || found.userId?._id}/history`,
          );
          setHistory(historyRes.data.history);
        } catch {
          setHistory(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
    // eslint-disable-next-line
  }, [id]);

  const openNotesEditor = () => {
    setNotesText(appointment?.medicalNotes || "");
    setEditor("notes");
  };

  const openPrescriptionEditor = () => {
    setRxForm({
      prescription: appointment?.prescription || "",
      diagnosis: appointment?.diagnosis || "",
      followUpAdvice: appointment?.followUpAdvice || "",
    });
    setEditor("prescription");
  };

  const saveEditor = async () => {
    setSaving(true);
    try {
      const payload =
        editor === "notes"
          ? { medicalNotes: notesText || "" }
          : {
              diagnosis: rxForm.diagnosis || "",
              prescription: rxForm.prescription || "",
              followUpAdvice: rxForm.followUpAdvice || "",
            };
      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/appointment/${id}/prescription`,
        payload,
      );
      toast.success(res.data.message || "Saved");
      setEditor(null);
      fetchAppointment();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadReports = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const reports = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                url: reader.result,
                type: "doctor_report",
                filename: file.name,
                mimeType: file.type,
                size: file.size,
              });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    );

    try {
      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/appointment/${id}/prescription`,
        { reports },
      );
      toast.success(res.data.message || "Reports uploaded");
      event.target.value = "";
      fetchAppointment();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleAcceptAppointment = async () => {
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${id}/status`,
        { status: "confirmed" },
      );
      toast.success(res.data.message || "Appointment accepted");
      fetchAppointment();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAppointment = async () => {
    const reason =
      window.prompt("Please enter a reason for declining this appointment:") ||
      "Doctor unavailable at scheduled time";
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${id}/status`,
        { status: "cancel", reason },
      );
      toast.info(res.data.message || "Appointment declined");
      fetchAppointment();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartConsultation = async () => {
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/consultation/${id}/start`,
      );
      toast.success(res.data.message || "Consultation started");
      fetchAppointment();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!appointment) return <div>No appointment found</div>;

  return (
    <div>
      {/* Smart Care Journey & Appointment Lifecycle */}
      <SmartCareJourney
        appointment={appointment}
        onAccept={handleAcceptAppointment}
        onReject={handleRejectAppointment}
        onStartConsultation={handleStartConsultation}
        onOpenPrescription={openPrescriptionEditor}
        onOpenNotes={openNotesEditor}
        onUploadReports={uploadReports}
        busy={saving}
      />

      <h2>Appointment Details</h2>
      <div>
        <strong>Patient:</strong> {patient?.name || appointment.userId?.name}
      </div>
      <div>
        <strong>Date/Time:</strong> {appointment.slotDate}{" "}
        {appointment.slotTime}
      </div>
      <div>
        <strong>Status:</strong> {appointment.status}
      </div>
      <div>
        <strong>Arrival / Pass Status:</strong>{" "}
        {appointment.checkedIn ? (
          <span
            style={{
              color: "#059669",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            ✓ Patient Arrived / In Queue (Token:{" "}
            {appointment.queueToken || "A-001"} · Status:{" "}
            {appointment.queueStatus || "waiting"})
          </span>
        ) : (
          <span style={{ color: "#b45309", fontWeight: 600 }}>
            Expected on arrival (Not checked in yet)
          </span>
        )}
      </div>
      <div>
        <strong>Amount:</strong> {appointment.amount}
      </div>
      <div>
        <strong>Payment:</strong> {appointment.paymentStatus || "cash_pending"}{" "}
        ({appointment.paymentMethod || "cash"})
      </div>
      <div>
        <strong>Diagnosis:</strong>
        <p>{appointment.diagnosis || "-"}</p>
      </div>
      <div>
        <strong>Prescription:</strong>
        <p>{appointment.prescription || "-"}</p>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={openNotesEditor}>Add / Edit Notes</button>{" "}
        <button onClick={openPrescriptionEditor}>Upload Prescription</button>{" "}
        <label
          className="btn btn-light"
          style={{ display: "inline-flex", cursor: "pointer" }}
        >
          Upload Reports
          <input
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg"
            onChange={uploadReports}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Medical Reports</h3>
        {appointment.medicalReports?.length ? (
          <ul>
            {appointment.medicalReports.map((r) => (
              <li key={r._id}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name}
                </a>{" "}
                ({r.type})
              </li>
            ))}
          </ul>
        ) : (
          <div>No reports</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Patient History</h3>
        {history?.appointments?.length ? (
          <ul>
            {history.appointments.map((item) => (
              <li key={item._id}>
                {item.slotDate} {item.slotTime} - {item.status} with{" "}
                {item.doctorId?.name || "Doctor"}
              </li>
            ))}
          </ul>
        ) : (
          <div>No previous patient history</div>
        )}
      </div>

      {/* Notes / Prescription editor modal */}
      {editor && (
        <div className="modal-backdrop" onMouseDown={() => setEditor(null)}>
          <div
            className="detail-modal"
            style={{ maxWidth: 560 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>
              {editor === "notes" ? "Edit Medical Notes" : "Edit Prescription"}
            </h3>
            {editor === "notes" ? (
              <label className="form-label">
                Medical Notes
                <textarea
                  rows={6}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="form-label">
                  Diagnosis
                  <textarea
                    rows={2}
                    value={rxForm.diagnosis}
                    onChange={(e) =>
                      setRxForm({ ...rxForm, diagnosis: e.target.value })
                    }
                  />
                </label>
                <label className="form-label">
                  Prescription
                  <textarea
                    rows={4}
                    value={rxForm.prescription}
                    onChange={(e) =>
                      setRxForm({ ...rxForm, prescription: e.target.value })
                    }
                  />
                </label>
                <label className="form-label">
                  Follow-up Advice
                  <textarea
                    rows={2}
                    value={rxForm.followUpAdvice}
                    onChange={(e) =>
                      setRxForm({ ...rxForm, followUpAdvice: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            <div className="button-row">
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={saveEditor}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn btn-light"
                onClick={() => setEditor(null)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
