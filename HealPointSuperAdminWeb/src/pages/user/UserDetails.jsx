import React, { useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { getUserDetails } from "../../redux/actions/userAction";
import { useNavigate, useParams } from "react-router-dom";

const getPatientImage = (image) => {
  if (!image) return "https://placehold.co/160x160?text=Patient";
  if (/^https:\/\/images\.unsplash\.com/i.test(image)) {
    const separator = image.includes("?") ? "&" : "?";
    return /[?&]q=/i.test(image) ? image : `${image}${separator}q=95&w=1200&dpr=2`;
  }
  return /^(https?:|data:|blob:)/i.test(image)
    ? image
    : `data:image/jpeg;base64,${image}`;
};

const valueOrNA = (value) => value || "NA";

const getAge = (user) => {
  if (user?.age) return user.age;
  if (!user?.dob) return null;

  const dob = new Date(user.dob);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const UserDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(getUserDetails(id));
  }, [dispatch, id]);

  const { user, appoinmtents, loading, error } = useSelector((state) => state.user);
  const appointments = appoinmtents || [];
  const currentAppointment = appointments[0];
  const medicalHistory = appointments
    .flatMap((appointment) => [
      appointment?.diagnosis,
      appointment?.prescription,
      appointment?.medicalNotes,
      appointment?.followUpAdvice,
    ])
    .filter(Boolean);
  const completedCount = appointments.filter(
    (appointment) => appointment?.status === "completed"
  ).length;
  const pendingCount = appointments.filter(
    (appointment) => appointment?.status === "pending"
  ).length;
  const totalAmount = appointments.reduce(
    (sum, appointment) => sum + Number(appointment?.amount || 0),
    0
  );

  return (
    <Layout>
      <section className="patient-details-page">
        <section className="patient-details-hero">
          <div>
            <span className="patient-details-kicker">Patient profile</span>
            <h1>Patient Details</h1>
            <p>
              Review patient contact information, appointment activity, payment
              preference, and booking history.
            </p>
          </div>
          <button className="btn btn-light" onClick={() => navigate("/all-users")}>
            Back
          </button>
        </section>

        {loading && !user && (
          <div className="empty-state">Loading patient profile...</div>
        )}

        {error && !loading && (
          <div className="empty-state">
            Unable to load patient profile. {error}
          </div>
        )}

        {!loading && !error && !user && (
          <div className="empty-state">Patient profile was not found.</div>
        )}

        {!loading && !error && user && (
        <div className="patient-details-shell">
          <aside className="patient-profile-panel">
            <img
              src={getPatientImage(user?.image)}
              alt={user?.name ? `${user.name} profile` : "Patient profile"}
              width={160}
              height={160}
              loading="eager"
              decoding="async"
              className="hd-profile-image"
            />
            <h2>{user?.name || "Patient name"}</h2>
            <p>{user?.email || "Email not added"}</p>
            <div className="patient-contact-list">
              <div>
                <span>Phone</span>
                <strong>{valueOrNA(user?.phone)}</strong>
              </div>
              <div>
                <span>Address</span>
                <strong>{valueOrNA(user?.address)}</strong>
              </div>
              <div>
                <span>Age</span>
                <strong>{valueOrNA(getAge(user))}</strong>
              </div>
              <div>
                <span>Gender</span>
                <strong>{valueOrNA(user?.gender)}</strong>
              </div>
            </div>
          </aside>

          <div className="patient-details-main">
            <div className="patient-stats-grid">
              <div className="patient-stat-card">
                <span>Total Appointments</span>
                <strong>{appointments.length}</strong>
              </div>
              <div className="patient-stat-card">
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </div>
              <div className="patient-stat-card">
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </div>
              <div className="patient-stat-card">
                <span>Total Fees</span>
                <strong>{totalAmount ? `Rs. ${totalAmount}` : "NA"}</strong>
              </div>
            </div>

            <section className="patient-history-card">
              <div className="patient-history-head">
                <div>
                  <h3>Current Appointment Details</h3>
                  <p>Most recent booking connected with this patient.</p>
                </div>
              </div>
              {currentAppointment ? (
                <div className="appointment-detail-grid">
                  <div className="appointment-detail-item">
                    <span>Date</span>
                    <strong>{valueOrNA(currentAppointment?.slotDate)}</strong>
                  </div>
                  <div className="appointment-detail-item">
                    <span>Time</span>
                    <strong>{valueOrNA(currentAppointment?.slotTime)}</strong>
                  </div>
                  <div className="appointment-detail-item">
                    <span>Doctor</span>
                    <strong>{valueOrNA(currentAppointment?.doctorId?.name || currentAppointment?.doctorId)}</strong>
                  </div>
                  <div className="appointment-detail-item">
                    <span>Status</span>
                    <strong className={`status-pill ${currentAppointment?.status || "pending"}`}>
                      {valueOrNA(currentAppointment?.status)}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No current appointment found.</div>
              )}
            </section>

            <section className="patient-history-card">
              <div className="patient-history-head">
                <div>
                  <h3>Medical History</h3>
                  <p>Available diagnosis, prescription, and doctor notes.</p>
                </div>
              </div>
              {medicalHistory.length ? (
                <div className="appointment-detail-grid">
                  {medicalHistory.map((item, index) => (
                    <div className="appointment-detail-item is-wide" key={`${item}-${index}`}>
                      <span>Record {index + 1}</span>
                      <strong>{item}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No medical history available.</div>
              )}
            </section>

            <section className="patient-history-card">
              <div className="patient-history-head">
                <div>
                  <h3>Appointment History</h3>
                  <p>All bookings connected with this patient profile.</p>
                </div>
              </div>
              <div
                className={`admin-table-scroll ${
                  appointments.length > 10 ? "is-scrollable" : ""
                }`}
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Date</th>
                      <th>Doctor</th>
                      <th>Fees</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((a, i) => (
                      <tr key={i + 1}>
                        <td>{i + 1}</td>
                        <td>{valueOrNA(a?.slotDate)}</td>
                        <td>{valueOrNA(a?.doctorId?.name || a?.doctorId)}</td>
                        <td>{a?.amount ? `Rs. ${a.amount}` : "NA"}</td>
                        <td>
                          <span className={`status-pill ${a?.status || "pending"}`}>
                            {valueOrNA(a?.status)}
                          </span>
                        </td>
                        <td>{a?.payment ? "Online" : "Cash"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!appointments.length && (
                <div className="empty-state">No appointments found for this patient.</div>
              )}
            </section>
          </div>
        </div>
        )}
      </section>
    </Layout>
  );
};

export default UserDetails;
