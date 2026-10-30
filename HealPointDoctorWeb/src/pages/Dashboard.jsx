import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const stored = JSON.parse(localStorage.getItem("doctorApp") || "null");
  const doctorId = stored?.doctor?._id;
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPanel = async () => {
      if (!doctorId) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await api.get(`/api/v1/doctor/panel/${doctorId}`);
        setPanel(res.data);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Unable to open doctor portal");
        localStorage.removeItem("doctorApp");
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadPanel();
  }, [doctorId, navigate]);

  const dashboard = panel?.dashboard || {};
  const doctor = panel?.doctor || stored?.doctor || {};
  const nextAppointments = useMemo(
    () => [...(dashboard.todayAppointments || []), ...(dashboard.upcomingAppointments || [])].slice(0, 6),
    [dashboard.todayAppointments, dashboard.upcomingAppointments]
  );

  const logout = () => {
    localStorage.removeItem("doctorApp");
    navigate("/login", { replace: true });
  };

  if (loading) return <div className="doctor-dashboard-loading">Opening your doctor portal...</div>;

  return (
    <div className="doctor-dashboard">
      <aside className="sidebar">
        <h3>Doctor Portal</h3>
        <ul>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/appointments?filter=today">Today's Appointments</Link></li>
          <li><Link to="/appointments?filter=upcoming">Upcoming Appointments</Link></li>
          <li><Link to="/appointments?filter=pending">Pending Appointments</Link></li>
          <li><Link to="/verification">Verification</Link></li>
        </ul>
        <button type="button" className="doctor-logout" onClick={logout}>Logout</button>
      </aside>

      <main className="content">
        <header className="doctor-portal-header">
          <div>
            <span>{doctor.verificationStatus || "Pending"} verification</span>
            <h1>Welcome, {doctor.name || "Doctor"}</h1>
            <p>{doctor.speciality} | {doctor.hospitalId?.name || doctor.hospitalName || "Hospital"}</p>
          </div>
          <strong>{doctor.email || doctor.portalEmail || "doctor@healpoint.doctor"}</strong>
        </header>

        <section className="doctor-portal-stats">
          <article><span>Today</span><strong>{dashboard.totals?.today || 0}</strong></article>
          <article><span>Upcoming</span><strong>{dashboard.totals?.upcoming || 0}</strong></article>
          <article><span>Pending</span><strong>{dashboard.totals?.pending || 0}</strong></article>
          <article><span>Completed</span><strong>{dashboard.totals?.completed || 0}</strong></article>
          <article><span>Reviews</span><strong>{dashboard.totals?.reviews || 0}</strong></article>
          <article><span>Earnings</span><strong>Rs {dashboard.totals?.earnings || 0}</strong></article>
        </section>

        <section className="doctor-portal-grid">
          <article>
            <h2>Next Appointments</h2>
            {nextAppointments.length ? nextAppointments.map((appointment) => (
              <Link key={appointment._id} to={`/appointments/${appointment._id}`}>
                <strong>{appointment.patient?.name || "Patient"}</strong>
                <span>{appointment.slotDate} at {appointment.slotTime}</span>
                <em>{appointment.bookingStatusLabel || appointment.status}</em>
              </Link>
            )) : <p>No upcoming appointments.</p>}
          </article>

          <article>
            <h2>Verification History</h2>
            {(doctor.verificationLogs || []).slice(-5).reverse().map((log) => (
              <div key={log._id || log.createdAt} className="doctor-log-row">
                <strong>{log.status}</strong>
                <span>{new Date(log.createdAt).toLocaleString("en-IN")}</span>
                <p>{log.note || "No note"}</p>
              </div>
            ))}
            {!doctor.verificationLogs?.length && <p>No verification actions yet.</p>}
          </article>
        </section>
      </main>
    </div>
  );
}
