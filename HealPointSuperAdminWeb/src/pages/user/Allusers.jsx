import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { getAllUsers } from "../../redux/actions/userAction";
import { Link } from "react-router-dom";
import { matchesSearchText } from "../../utils/searchUtils";
import {
  FaCalendarAlt,
  FaArrowRight,
  FaClipboardCheck,
  FaEnvelope,
  FaFilter,
  FaHistory,
  FaPhoneAlt,
  FaSearch,
  FaTimes,
  FaUserCheck,
  FaUserInjured,
  FaUserTimes,
  FaWallet,
} from "react-icons/fa";

const getInitials = (name = "Patient") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";

const formatDate = (date) => {
  if (!date) return "Not available";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getProfileCompletion = (user) => {
  const fields = [user?.name, user?.email, user?.phone, user?.address, user?.dob, user?.gender, user?.image];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

const getAppointmentTotal = (user) => Number(user?.appointmentStats?.totalBookings || 0);

const getPaymentStatus = (user) => {
  const stats = user?.appointmentStats || {};
  if (Number(stats.completedBookings || 0) > 0) return { label: "Paid history", tone: "paid" };
  if (Number(stats.totalBookings || 0) > 0) return { label: "Pending", tone: "pending" };
  return { label: "No billing", tone: "neutral" };
};

const getLastAppointmentInfo = (user) =>
  getAppointmentTotal(user) > 0
    ? formatDate(user?.lastActivityAt || user?.updatedAt)
    : "No appointment record";

const Allusers = () => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const perPage = 8;

  useEffect(() => {
    dispatch(getAllUsers());
  }, [dispatch]);

  const { users, loading } = useSelector((state) => state.user);
  const patients = users || [];

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return patients.filter((user) => {
      const matchesSearch = matchesSearchText(
        [
          user?._id,
          user?.name,
          user?.email,
          user?.phone,
          user?.address,
          user?.appointmentSearchText,
          ...(user?.appointmentSearchMeta?.appointmentIds || []),
          ...(user?.appointmentSearchMeta?.doctorNames || []),
        ],
        query
      );
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "contact-ready" && user?.phone) ||
        (statusFilter === "needs-follow-up" && !user?.phone) ||
        (statusFilter === "has-appointments" && getAppointmentTotal(user) > 0);
      const completion = getProfileCompletion(user);
      const matchesProfile =
        profileFilter === "all" ||
        (profileFilter === "complete" && completion >= 80) ||
        (profileFilter === "incomplete" && completion < 80);

      return matchesSearch && matchesStatus && matchesProfile;
    });
  }, [patients, profileFilter, searchTerm, statusFilter]);

  const totalPages = Math.max(Math.ceil(filteredPatients.length / perPage), 1);
  const paginatedPatients = filteredPatients.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, profileFilter]);

  const directoryStats = useMemo(
    () => [
      {
        label: "Total Patients",
        value: patients.length,
        note: "Registered profiles",
        icon: <FaUserInjured />,
      },
      {
        label: "With Phone",
        value: patients.filter((user) => user?.phone).length,
        note: "Ready for calls",
        icon: <FaPhoneAlt />,
      },
      {
        label: "With Email",
        value: patients.filter((user) => user?.email).length,
        note: "Digital contact",
        icon: <FaEnvelope />,
      },
      {
        label: "Missing Phone",
        value: patients.filter((user) => !user?.phone).length,
        note: "Needs follow-up",
        icon: <FaUserTimes />,
      },
      {
        label: "Booked Patients",
        value: patients.filter((user) => getAppointmentTotal(user) > 0).length,
        note: "Appointment activity",
        icon: <FaCalendarAlt />,
      },
    ],
    [patients]
  );

  return (
    <Layout>
      <section className="page-intro patient-directory-hero">
        <div>
          <span className="eyebrow">Patient directory</span>
          <h2>All Patients</h2>
          <p>Review registered patient profiles and their appointment history.</p>
        </div>
        <div className="patient-directory-search">
          <FaSearch />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by email, name, phone, patient ID, appointment ID, doctor..."
          />
        </div>
      </section>

      <section className="patient-filter-panel">
        <div>
          <span><FaFilter /> Filters</span>
          <strong>Refine patient records</strong>
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="contact-ready">Contact ready</option>
          <option value="needs-follow-up">Needs follow-up</option>
          <option value="has-appointments">Has appointments</option>
        </select>
        <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)}>
          <option value="all">All profiles</option>
          <option value="complete">Profile 80%+</option>
          <option value="incomplete">Profile below 80%</option>
        </select>
      </section>

      <div className="patient-directory-stats">
        {directoryStats.map((item) => (
          <article className="patient-directory-stat" key={item.label}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.value}</strong>
              <p>{item.label}</p>
              <small>{item.note}</small>
            </div>
          </article>
        ))}
      </div>

      <section className="patient-card-grid">
        {paginatedPatients.slice(0, 4).map((user) => {
          const completion = getProfileCompletion(user);
          const payment = getPaymentStatus(user);
          return (
            <article className="patient-profile-card" key={`card-${user?._id}`}>
              <div className="patient-profile-card-top">
                <span>{getInitials(user?.name)}</span>
                <div>
                  <strong>{user?.name || "Unnamed patient"}</strong>
                  <small>{user?.email || "Email not added"}</small>
                </div>
              </div>
              <div className="patient-mini-metrics">
                <span><FaCalendarAlt /> {getAppointmentTotal(user)} appointments</span>
                <span><FaWallet /> {payment.label}</span>
              </div>
              <div className="patient-completion-meter">
                <div>
                  <span>Profile completion</span>
                  <strong>{completion}%</strong>
                </div>
                <progress value={completion} max="100" />
              </div>
              <button type="button" className="patient-details-link as-button" onClick={() => setSelectedPatient(user)}>
                Quick View <FaArrowRight />
              </button>
            </article>
          );
        })}
      </section>

      <section className="patient-directory-card">
        <div className="patient-directory-card-head">
          <div>
            <h3><FaUserCheck /> Patient Records</h3>
            <p>
              Showing {filteredPatients.length} of {patients.length} patients
            </p>
          </div>
          {!!searchTerm && (
            <button type="button" className="btn btn-light" onClick={() => setSearchTerm("")}>
              Clear
            </button>
          )}
        </div>

        <div className={`admin-table-scroll ${filteredPatients.length > 10 ? "is-scrollable" : ""}`}>
          <table className="table patient-directory-table">
            <thead>
              <tr>
                <th>SN</th>
                <th>Patient</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Appointments</th>
                <th>Payment</th>
                <th>Profile</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.map((user, i) => {
                const completion = getProfileCompletion(user);
                const payment = getPaymentStatus(user);
                return (
                <tr key={user?._id || i}>
                  <td>{(page - 1) * perPage + i + 1}</td>
                  <td>
                    <div className="patient-cell">
                      <span>{getInitials(user?.name)}</span>
                      <div>
                        <strong>{user?.name || "Unnamed patient"}</strong>
                        <small>{user?._id ? `ID: ${user._id.slice(-6).toUpperCase()}` : "No ID"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <a href={user?.email ? `mailto:${user.email}` : undefined}>
                      {user?.email || "Email not added"}
                    </a>
                  </td>
                  <td>{user?.phone || "NA"}</td>
                  <td>
                    <span className={`status-pill ${user?.phone ? "completed" : "pending"}`}>
                      {user?.phone ? "Contact ready" : "Phone missing"}
                    </span>
                  </td>
                  <td>
                    <div className="patient-table-stack">
                      <strong>{getAppointmentTotal(user)}</strong>
                      <small>Last: {getLastAppointmentInfo(user)}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`payment-status-pill ${payment.tone}`}>
                      {payment.label}
                    </span>
                  </td>
                  <td>
                    <div className="profile-completion-cell">
                      <strong>{completion}%</strong>
                      <progress value={completion} max="100" />
                    </div>
                  </td>
                  <td>
                    <button type="button" className="patient-details-link as-button" onClick={() => setSelectedPatient(user)}>
                      View <FaClipboardCheck />
                    </button>
                    <Link className="patient-details-link" to={`/user-details/${user?._id}`}>
                      Open <FaArrowRight />
                    </Link>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        <div className="patient-pagination">
          <span>Page {page} of {totalPages}</span>
          <div>
            <button type="button" className="btn btn-light" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <button type="button" className="btn btn-light" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </button>
          </div>
        </div>

        {!loading && !filteredPatients.length && (
          <div className="empty-state">No Results Found</div>
        )}
      </section>

      {selectedPatient && (
        <div className="patient-detail-drawer-backdrop" role="dialog" aria-modal="true">
          <aside className="patient-detail-drawer">
            <button type="button" className="patient-drawer-close" onClick={() => setSelectedPatient(null)} aria-label="Close patient details">
              <FaTimes />
            </button>
            <div className="patient-drawer-head">
              <span>{getInitials(selectedPatient?.name)}</span>
              <div>
                <h3>{selectedPatient?.name || "Unnamed patient"}</h3>
                <p>{selectedPatient?.email || "Email not added"}</p>
              </div>
            </div>
            <div className="patient-drawer-metrics">
              <article><strong>{getAppointmentTotal(selectedPatient)}</strong><span>Total Appointments</span></article>
              <article><strong>{selectedPatient?.appointmentStats?.completedBookings || 0}</strong><span>Completed</span></article>
              <article><strong>{getProfileCompletion(selectedPatient)}%</strong><span>Profile Completion</span></article>
            </div>
            <div className="patient-activity-history">
              <h4><FaHistory /> Patient Activity History</h4>
              <div><span>Registered</span><strong>{formatDate(selectedPatient?.createdAt)}</strong></div>
              <div><span>Last Appointment Information</span><strong>{getLastAppointmentInfo(selectedPatient)}</strong></div>
              <div><span>Payment status</span><strong>{getPaymentStatus(selectedPatient).label}</strong></div>
              <div><span>Contact</span><strong>{selectedPatient?.phone || "Phone missing"}</strong></div>
            </div>
            <Link className="btn btn-primary" to={`/user-details/${selectedPatient?._id}`}>
              Open Full Patient Details
            </Link>
          </aside>
        </div>
      )}
    </Layout>
  );
};

export default Allusers;
