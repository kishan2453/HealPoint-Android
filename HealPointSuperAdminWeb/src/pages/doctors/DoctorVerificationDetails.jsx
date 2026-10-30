import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaBan, FaCheck, FaClock, FaFileAlt, FaHistory, FaPauseCircle, FaRedo, FaTimes } from "react-icons/fa";
import API from "../../Api/API";
import Layout from "../../components/Layout/Layout";

const documentGroups = [
  ["medicalLicenseUrl", "Medical License"],
  ["mbbsCertificateUrl", "MBBS Certificate"],
  ["mdMsCertificateUrl", "MD/MS Certificate"],
  ["specializationCertificateUrl", "Specialization Certificate"],
  ["governmentIdUrl", "Government ID"],
  ["aadhaarPanUrl", "Aadhaar/PAN"],
  ["hospitalAffiliationLetterUrl", "Hospital Affiliation Letter"],
];

const actionButtons = [
  { status: "Verified", label: "Approve Doctor", icon: <FaCheck />, className: "approve" },
  { status: "Rejected", label: "Reject Doctor", icon: <FaTimes />, className: "reject" },
  { status: "Correction Requested", label: "Request Document Correction", icon: <FaRedo />, className: "correction" },
  { status: "Suspended", label: "Suspend Doctor", icon: <FaPauseCircle />, className: "suspend" },
  { status: "Blocked", label: "Block Doctor", icon: <FaBan />, className: "block" },
];

const DoctorVerificationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [requestedDocuments, setRequestedDocuments] = useState("");

  const fetchDoctorDetails = async () => {
    try {
      const res = await API.get(`/doctor/get-details/${id}`);
      setDoctor(res.data?.doctor);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Unable to load doctor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorDetails();
  }, [id]);

  const documents = useMemo(() => {
    if (!doctor) return [];
    const fixed = documentGroups.map(([key, label]) => ({ label, url: doctor[key] })).filter((item) => item.url);
    const experience = (doctor.experienceCertificatesUrls || []).map((url, index) => ({
      label: `Experience Certificate ${index + 1}`,
      url,
    }));
    const additional = (doctor.additionalCertificatesUrls || []).map((url, index) => ({
      label: `Additional Certificate ${index + 1}`,
      url,
    }));
    const certificates = (doctor.certificates || []).map((certificate) => ({
      label: certificate.name,
      url: certificate.fileUrl,
    }));
    return [...fixed, ...experience, ...additional, ...certificates];
  }, [doctor]);

  const handleUpdateStatus = async (status) => {
    setSaving(true);
    try {
      const res = await API.patch(`/doctor/update-verification-status/${id}`, {
        status,
        note,
        requestedDocuments: requestedDocuments.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setDoctor(res.data?.doctor);
      setNote("");
      setRequestedDocuments("");
      if (status === "Verified" || status === "Blocked") navigate("/doctors/verification");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="admin-empty-state">Loading verification details...</div></Layout>;
  if (error && !doctor) return <Layout><div className="admin-empty-state">{error}</div></Layout>;
  if (!doctor) return <Layout><div className="admin-empty-state">No doctor found.</div></Layout>;

  const verificationDate = doctor.verificationDate || doctor.verifiedAt || doctor.updatedAt;

  return (
    <Layout>
      <main className="verification-details">
        <Link className="admin-link-button light" to="/doctors/verification">Back to Verification</Link>

        <section className="verification-profile">
          <img src={doctor.hdProfilePicture || doctor.image} alt={doctor.name} />
          <div>
            <span className={`verification-badge ${doctor.verificationStatus?.toLowerCase().replace(/\s+/g, "-")}`}>{doctor.verificationStatus}</span>
            <h1>{doctor.name}</h1>
            <p>{doctor.speciality} | {doctor.department || "Department not assigned"} | {doctor.hospitalId?.name || doctor.hospitalName}</p>
            <div className="verification-meta">
              <span>Email: {doctor.email}</span>
              <span>Phone: {doctor.phone || "Not added"}</span>
              <span>Verification Date: {verificationDate ? new Date(verificationDate).toLocaleString("en-IN") : "Not reviewed"}</span>
              <span>Registration: {doctor.registrationNumber || doctor.medicalCouncilRegistrationNumber || "Not added"}</span>
            </div>
          </div>
        </section>

        {error && <div className="admin-empty-state">{error}</div>}

        <section className="verification-layout">
          <article className="verification-card">
            <h2><FaFileAlt /> Uploaded Documents</h2>
            <div className="verification-doc-grid">
              {documents.length ? documents.map((doc) => (
                <a key={`${doc.label}-${doc.url}`} href={doc.url} target="_blank" rel="noopener noreferrer">
                  <FaFileAlt />
                  <span>{doc.label}</span>
                  <small>Open document</small>
                </a>
              )) : <p>No verification documents uploaded yet.</p>}
            </div>
          </article>

          <article className="verification-card action-panel">
            <h2>Admin Actions</h2>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Verification note, rejection reason, suspension reason, or correction instruction" />
            <input value={requestedDocuments} onChange={(event) => setRequestedDocuments(event.target.value)} placeholder="Correction documents needed, comma separated" />
            <div className="verification-action-grid">
              {actionButtons.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className={`verification-action ${action.className}`}
                  onClick={() => handleUpdateStatus(action.status)}
                  disabled={saving}
                >
                  {action.icon} {saving ? "Saving..." : action.label}
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="verification-card">
          <h2><FaHistory /> Verification History</h2>
          <div className="verification-history">
            {(doctor.verificationLogs || []).slice().reverse().map((log) => (
              <article key={log._id || `${log.status}-${log.createdAt}`}>
                <span><FaClock /> {new Date(log.createdAt).toLocaleString("en-IN")}</span>
                <strong>{log.status}</strong>
                <p>{log.note || "No note added."}</p>
                {log.requestedDocuments?.length > 0 && <small>Requested: {log.requestedDocuments.join(", ")}</small>}
                <em>By {log.changedByName || "Admin"}</em>
              </article>
            ))}
            {!doctor.verificationLogs?.length && <p>No verification logs yet.</p>}
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default DoctorVerificationDetails;
