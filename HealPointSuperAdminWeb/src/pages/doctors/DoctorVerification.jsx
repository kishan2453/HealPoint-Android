import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaBan, FaCheckCircle, FaClock, FaEdit, FaFileAlt, FaSearch, FaTimesCircle, FaUserShield } from "react-icons/fa";
import API from "../../Api/API";
import Layout from "../../components/Layout/Layout";

const statusClass = {
  Verified: "verified",
  Rejected: "rejected",
  "Correction Requested": "correction",
  Suspended: "suspended",
  Blocked: "blocked",
  Pending: "pending",
};

const statusIcon = {
  Verified: <FaCheckCircle />,
  Rejected: <FaTimesCircle />,
  "Correction Requested": <FaEdit />,
  Suspended: <FaClock />,
  Blocked: <FaBan />,
  Pending: <FaClock />,
};

const DoctorVerification = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await API.get("/doctor/get-all?platform=1");
        setDoctors(res.data?.doctors || []);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Unable to load doctors");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const filteredDoctors = useMemo(() => {
    const term = search.trim().toLowerCase();
    return doctors.filter((doctor) => {
      const matchesStatus = status === "all" || doctor.verificationStatus === status;
      const text = `${doctor.name} ${doctor.email} ${doctor.speciality} ${doctor.hospitalName}`.toLowerCase();
      return matchesStatus && (!term || text.includes(term));
    });
  }, [doctors, search, status]);

  const stats = useMemo(
    () =>
      doctors.reduce(
        (items, doctor) => {
          const key = doctor.verificationStatus || "Pending";
          items[key] = (items[key] || 0) + 1;
          return items;
        },
        { Pending: 0, Verified: 0, Rejected: 0, "Correction Requested": 0, Suspended: 0, Blocked: 0 }
      ),
    [doctors]
  );

  return (
    <Layout>
      <main className="verification-dashboard">
        <section className="verification-hero">
          <div>
            <span><FaUserShield /> Admin Verification Dashboard</span>
            <h1>Doctor verification command center</h1>
            <p>Review uploaded documents, approve, reject, request corrections, suspend, block, and audit every verification action.</p>
          </div>
        </section>

        <section className="verification-stats">
          {Object.entries(stats).map(([label, count]) => (
            <article key={label} className={`verification-stat ${statusClass[label] || "pending"}`}>
              {statusIcon[label] || <FaClock />}
              <span>{label}</span>
              <strong>{count}</strong>
            </article>
          ))}
        </section>

        <section className="verification-toolbar">
          <label>
            <FaSearch />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search doctor, hospital, speciality" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All status</option>
            {Object.keys(stats).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </section>

        {loading && <div className="admin-empty-state">Loading doctors...</div>}
        {error && <div className="admin-empty-state">{error}</div>}

        {!loading && !error && (
          <section className="verification-table-wrap">
            <table className="verification-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Hospital</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Verification Date</th>
                  <th>History</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map((doctor) => {
                  const docsCount = [
                    doctor.medicalLicenseUrl,
                    doctor.mbbsCertificateUrl,
                    doctor.mdMsCertificateUrl,
                    doctor.specializationCertificateUrl,
                    doctor.governmentIdUrl,
                    doctor.aadhaarPanUrl,
                    doctor.hospitalAffiliationLetterUrl,
                    ...(doctor.experienceCertificatesUrls || []),
                    ...(doctor.additionalCertificatesUrls || []),
                    ...(doctor.certificates || []),
                  ].filter(Boolean).length;
                  const verificationDate = doctor.verificationDate || doctor.verifiedAt || doctor.updatedAt;
                  return (
                    <tr key={doctor._id}>
                      <td>
                        <strong>{doctor.name}</strong>
                        <small>{doctor.email}</small>
                        <small>{doctor.speciality}</small>
                      </td>
                      <td>{doctor.hospitalId?.name || doctor.hospitalName || "Hospital not assigned"}</td>
                      <td><FaFileAlt /> {docsCount} uploaded</td>
                      <td><span className={`verification-badge ${statusClass[doctor.verificationStatus] || "pending"}`}>{doctor.verificationStatus || "Pending"}</span></td>
                      <td>{verificationDate ? new Date(verificationDate).toLocaleString("en-IN") : "Not reviewed"}</td>
                      <td>{doctor.verificationLogs?.length || 0} logs</td>
                      <td><Link className="admin-link-button" to={`/doctors/verification/${doctor._id}`}>Review</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredDoctors.length && <div className="admin-empty-state">No doctors found.</div>}
          </section>
        )}
      </main>
    </Layout>
  );
};

export default DoctorVerification;
