import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  FaCheck,
  FaCheckCircle,
  FaClock,
  FaLink,
  FaTrash,
  FaVideo,
} from "react-icons/fa";
import api from "../services/api";
import VideoConsultationRoom from "./VideoConsultationRoom";

/**
 * HealPoint — Doctor Online Consultations (real Google Meet).
 *
 * The doctor can go Online / Offline (persisted to the backend), see their
 * assigned online (video) consultations, add / remove the real Google Meet
 * link, start the consultation (opens the actual Meet URL) and complete it.
 *
 * No fake video UI is rendered. "Start Consultation" opens the stored Google
 * Meet URL, exactly like the patient's "Join Consultation".
 */

const GOOGLE_MEET_URL_REGEX =
  /^https:\/\/(meet\.)?google\.com\/[a-z0-9][a-z0-9-]{2,}(\?[a-zA-Z0-9=&_.-]*)?$/i;

const statusLabel = {
  pending: "Pending",
  confirmed: "Accepted",
  completed: "Completed",
  cancel: "Cancelled",
  rescheduled: "Rescheduled",
  missed: "Missed",
};

const meetingLabel = (status) =>
  ({
    not_created: "Not created",
    ready: "Ready",
    started: "Started",
    completed: "Completed",
  })[status] || "Not created";

const consultLabel = (status) =>
  ({
    waiting: "Waiting for doctor",
    doctor_ready: "Doctor is ready",
    ready_to_join: "Ready to join",
    in_progress: "Consultation in progress",
    completed: "Completed",
    unavailable: "Doctor unavailable",
  })[status] || "Waiting";

const isValidGoogleMeetUrl = (value) =>
  GOOGLE_MEET_URL_REGEX.test(String(value || "").trim());

const openMeetLink = (url) => {
  if (url && /^https:\/\/meet\.google\.com\//i.test(String(url).trim())) {
    window.open(String(url).trim(), "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
};
export default function OnlineConsultations({ doctorId, doctor }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // consultation id being given a Meet link
  const [meetInput, setMeetInput] = useState("");
  const [busyId, setBusyId] = useState("");
  const [activeCallAppointmentId, setActiveCallAppointmentId] = useState(null);

  const online = doctor?.onlineConsultationEnabled === true;

  const load = async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/consultation/doctor/${doctorId}`);
      setItems(res.data.consultations || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load consultations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line useeffect
  }, [doctorId]);

  const toggleOnline = async () => {
    setBusyId("__toggle__");
    try {
      const res = await api.patch(`/api/v1/consultation/doctor/${doctorId}/toggle`, {
        online: !online,
      });
      toast.success(res.data.message || "Online status updated");
      if (typeof doctor?.refresh === "function") doctor.refresh();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update online status");
    } finally {
      setBusyId("");
    }
  };

  const updateStatus = async (id, consultationStatus) => {
    setBusyId(id);
    try {
      const res = await api.patch(
        `/api/v1/consultation/doctor/${doctorId}/status/${id}`,
        { consultationStatus },
      );
      toast.success(res.data.message || "Consultation status updated");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update status");
    } finally {
      setBusyId("");
    }
  };

  const startConsultation = (item) => {
    if (!openMeetLink(item.meetingUrl)) {
      toast.error("Video meeting has not been created yet. Add a Google Meet link first.");
      return;
    }
    if (item.consultationStatus !== "in_progress") {
      updateStatus(item._id, "in_progress");
    }
  };

  const openMet = (item) => {
    if (!openMeetLink(item.meetingUrl)) {
      toast.error("Video meeting has not been created yet.");
    }
  };

  const openEditor = (item) => {
    setEditing(item._id);
    setMeetInput(item.meetingUrl || "");
  };

  const saveMeeting = async (id) => {
    if (!isValidGoogleMeetUrl(meetInput)) {
      toast.error("Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).");
      return;
    }
    setBusyId(id);
    try {
      const res = await api.post(
        `/api/v1/consultation/doctor/${doctorId}/meeting-link/${id}`,
        { meetingUrl: meetInput.trim() },
      );
      toast.success(res.data.message || "Google Meet link saved");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save meeting link");
    } finally {
      setBusyId("");
    }
  };

  const removeMeeting = async (id) => {
    setBusyId(id);
    try {
      const res = await api.delete(`/api/v1/consultation/doctor/${doctorId}/meeting-link/${id}`);
      toast.success(res.data.message || "Meeting link removed");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to remove meeting link");
    } finally {
      setBusyId("");
    }
  };
const myConsultations = items.filter(
    (item) => item.status !== "cancel" && item.status !== "missed",
  );

  if (loading && !items.length) {
    return (
      <div className="dp-empty">
        <FaVideo /> <strong>Loading consultations…</strong>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Online consultations</h2>
          <span className="record-count">
            {myConsultations.length} active · {items.length} total
          </span>
        </div>
        <button
          type="button"
          className={`btn ${online ? "btn-light" : "btn-primary"}`}
          disabled={busyId === "__toggle__"}
          onClick={toggleOnline}
        >
          <FaVideo /> {online ? "Go Offline" : "Go Online"}
        </button>
      </div>

      {!myConsultations.length ? (
        <div className="dp-empty">
          <FaVideo />
          <strong>No online consultations yet</strong>
          <p>
            When a patient books a video consultation with you, it will appear
            here with a Google Meet link to join.
          </p>
        </div>
      ) : (
        <div className="online-consult-grid">
          {myConsultations.map((item) => {
            const patient = item.patient || {};
            const completed =
              item.status === "completed" || item.consultationStatus === "completed";
            return (
              <article className="online-consult-card" key={item._id}>
                <div className="online-consult-head">
                  <div>
                    <h3>{patient.name || "Patient"}</h3>
                    <p>
                      {patient.phone || "No phone"} · {patient.email || "No email"}
                    </p>
                  </div>
                  <span className={`consult-badge ${item.consultationStatus}`}>
                    {statusLabel[item.status] || item.status}
                  </span>
                </div>

                <div className="online-consult-meta">
                  <span>
                    {item.slotDate} at {item.slotTime}
                  </span>
                  <span>
                    {item.consultationMode === "instant" ? "Instant" : "Scheduled"} · Rs {item.amount || 0}
                  </span>
                </div>

                <div className="meeting-status-row">
                  <span className={`meeting-badge ${item.meetingStatus}`}>
                    Meeting: {meetingLabel(item.meetingStatus)}
                  </span>
                  <span className={`consult-badge ${item.consultationStatus}`}>
                    {consultLabel(item.consultationStatus)}
                  </span>
                </div>

                {editing === item._id ? (
                  <div className="meet-editor-row">
                    <input
                      className="form-input"
                      placeholder="https://meet.google.com/abc-defg-hij"
                      value={meetInput}
                      onChange={(e) => setMeetInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === item._id}
                      onClick={() => saveMeeting(item._id)}
                    >
                      Save link
                    </button>
                    <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                ) : null}

                <div className="online-consult-actions">
                  {!completed ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        backgroundColor: "#2563eb",
                        borderColor: "#2563eb",
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                      onClick={() => setActiveCallAppointmentId(item._id)}
                    >
                      <FaVideo /> In-App Video Call
                    </button>
                  ) : null}

                  <button type="button" className="btn btn-light" onClick={() => openEditor(item)}>
                    <FaLink /> {item.meetingUrl ? "Edit Meet link" : "Add Google Meet link"}
                  </button>
                  {item.meetingUrl ? (
                    <button type="button" className="btn btn-light" onClick={() => removeMeeting(item._id)}>
                      <FaTrash /> Remove
                    </button>
                  ) : null}
                  {!completed && item.meetingUrl ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === item._id}
                      onClick={() => startConsultation(item)}
                    >
                      <FaVideo /> {item.consultationStatus === "in_progress" ? "Open Google Meet" : "Start Consultation"}
                    </button>
                  ) : null}
                  {item.meetingUrl ? (
                    <button type="button" className="btn btn-outline" disabled={busyId === item._id} onClick={() => openMet(item)}>
                      Join Google Meet
                    </button>
                  ) : null}
                  {!completed ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busyId === item._id}
                      onClick={() => updateStatus(item._id, "completed")}
                    >
                      <FaCheck /> Complete consultation
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeCallAppointmentId && (
        <VideoConsultationRoom
          appointmentId={activeCallAppointmentId}
          doctorId={doctorId}
          onClose={() => {
            setActiveCallAppointmentId(null);
            load();
          }}
          onCompleted={() => {
            setActiveCallAppointmentId(null);
            load();
          }}
        />
      )}
    </section>
  );
}