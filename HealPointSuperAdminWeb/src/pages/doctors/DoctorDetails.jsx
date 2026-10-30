import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout/Layout";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteDoctor,
  getDoctorDetails,
  updateDoctor,
  updateStatus,
} from "../../redux/actions/doctorActions";
import toast from "../../utils/notify";
import VerifiedBadge from "../../components/common/VerifiedBadge";
import { doctorSpecialities } from "../../constants/doctorSpecialities";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const DetailField = ({
  label,
  value,
  setValue,
  disabled,
  type = "text",
  multiline = false,
}) => (
  <div className={`doctor-detail-field ${multiline ? "is-wide" : ""}`}>
    <label>{label}</label>
    {multiline ? (
      <textarea
        value={value || ""}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={4}
      />
    ) : (
      <input
        type={type}
        value={value || ""}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
    )}
  </div>
);

const DetailSelect = ({ label, value, setValue, options, disabled }) => (
  <div className="doctor-detail-field">
    <label>{label}</label>
    <select
      value={value || ""}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
    >
      {options?.map((op, i) => (
        <option value={op} key={i + 1}>
          {op}
        </option>
      ))}
    </select>
  </div>
);

const DoctorDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(getDoctorDetails(id));
  }, [dispatch, id]);

  const { doctor } = useSelector((state) => state.doctor);
  const [edit, setEdit] = useState(true);

  const [name, setName] = useState(doctor?.name);
  const [email, setEmail] = useState(doctor?.email);
  const [imageFile, setImageFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [previewSignature, setPreviewSignature] = useState("");
  const [speciality, setSpeciality] = useState(doctor?.speciality);
  const [experience, setExperience] = useState(doctor?.experience);
  const [degree, setDegree] = useState(doctor?.degree);
  const [about, setAbout] = useState(doctor?.about);
  const [fees, setFees] = useState(doctor?.fees);
  const [address, setAddress] = useState(doctor?.address);
  const [gender, setGender] = useState(doctor?.gender);
  const [phone, setPhone] = useState(doctor?.phone);
  const [onlineStatus, setOnlineStatus] = useState(
    doctor?.onlineStatus || "offline",
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [availabilitySchedule, setAvailabilitySchedule] = useState(
    doctor?.availabilitySchedule || "",
  );
  const [qualification, setQualification] = useState(doctor?.qualification);
  const [registrationNumber, setRegistrationNumber] = useState(
    doctor?.registrationNumber,
  );

  useEffect(() => {
    if (doctor) {
      setName(doctor?.name);
      setEmail(doctor?.email);
      setSpeciality(doctor?.speciality);
      setExperience(doctor?.experience);
      setDegree(doctor?.degree);
      setAbout(doctor?.about);
      setAddress(doctor?.address);
      setFees(doctor?.fees);
      setGender(doctor?.gender);
      setPhone(doctor?.phone);
      setOnlineStatus(doctor?.onlineStatus || "offline");
      setAvailabilitySchedule(doctor?.availabilitySchedule || "");
      setQualification(doctor?.qualification);
      setRegistrationNumber(doctor?.registrationNumber);
      setPreviewImage(
        doctor?.image
          ? /^(https?:|data:|blob:)/i.test(doctor.image)
            ? doctor.image
            : `data:image/jpeg;base64,${doctor.image}`
          : "",
      );
      setPreviewSignature(
        doctor?.signatureImage
          ? /^(https?:|data:|blob:)/i.test(doctor.signatureImage)
            ? doctor.signatureImage
            : `data:image/png;base64,${doctor.signatureImage}`
          : "",
      );
    }
  }, [doctor]);

  //update
  const handleUpdate = async () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("about", about);
    formData.append("speciality", speciality);
    formData.append("fees", fees);
    formData.append("experience", experience);
    formData.append("degree", degree);
    formData.append("address", address);
    formData.append("phone", phone);
    if (imageFile) {
      formData.append("image", imageFile);
    }
    if (signatureFile) {
      formData.append("signatureImage", signatureFile);
    }
    formData.append("gender", gender);
    formData.append("onlineStatus", onlineStatus);
    formData.append("availabilitySchedule", availabilitySchedule);
    formData.append("qualification", qualification);
    formData.append("registrationNumber", registrationNumber);
    try {
      await dispatch(updateDoctor({ id, formData })).unwrap();
      toast.success("Doctor updated");
      dispatch(getDoctorDetails(id));
      setEdit(true);
    } catch (error) {
      toast.error(error);
    }
  };

  //delete doctor
  const handleDelete = async () => {
    try {
      await dispatch(deleteDoctor(id)).unwrap();
      toast.success("Doctor Deleted!");
      setDeleteOpen(false);
      navigate("/all-doctors");
    } catch (error) {
      toast.error(error);
    }
  };

  const handleUpdateStatus = async (id, availableStatus) => {
    try {
      await dispatch(updateStatus({ id, availableStatus })).unwrap();
      toast.success("Doctor status updated!");
    } catch (error) {
      toast.error(error);
    }
  };
  const availabilityLabel = doctor?.available ? "Available" : "Unavailable";
  const modeLabel = edit ? "View mode" : "Editing";

  return (
    <Layout>
      <section className="doctor-details-page">
        <div className="doctor-details-hero">
          <div>
            <span className="doctor-details-kicker">{modeLabel}</span>
            <h1>Doctor Details</h1>
            <p>
              Review profile, availability, contact details, and appointment
              settings from one place.
            </p>
          </div>
          <div className="doctor-details-actions">
            <button
              className="btn btn-light"
              onClick={() => navigate("/all-doctors")}
            >
              Back
            </button>
            <button
              className={`btn ${edit ? "btn-warning" : "btn-secondary"}`}
              onClick={() => setEdit(!edit)}
            >
              {edit ? "Edit" : "Cancel"}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="doctor-details-shell">
          <aside className="doctor-profile-panel">
            <div className="doctor-image-wrap">
              <img
                src={previewImage || "https://placehold.co/250x250?text=Doctor"}
                alt={name ? `${name} profile` : "Doctor profile"}
                width={250}
                height={250}
                loading="eager"
                decoding="async"
                className="hd-profile-image"
              />
              <span
                className={`doctor-status-dot ${
                  onlineStatus === "online" ? "online" : "offline"
                }`}
              />
              <VerifiedBadge
                isVerified={doctor?.verificationStatus === "Verified"}
              />
            </div>
            <h2>{name || "Doctor name"}</h2>
            <p>{speciality || "Speciality not selected"}</p>
            <div
              className={`doctor-availability-banner ${
                doctor?.available ? "available" : "unavailable"
              }`}
            >
              {availabilityLabel}
            </div>
            <div className="doctor-profile-stats">
              <div>
                <span>Experience</span>
                <strong>{experience || "NA"}</strong>
              </div>
              <div>
                <span>Fees</span>
                <strong>{fees ? `Rs. ${fees}` : "NA"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{onlineStatus || "offline"}</strong>
              </div>
            </div>
            <div className="doctor-upload-control">
              <label>Profile Image</label>
              <input
                type="file"
                accept="image/*"
                disabled={edit}
                onChange={(e) => {
                  const file = e.target.files[0];
                  setImageFile(file);
                  if (file) {
                    setPreviewImage(URL.createObjectURL(file));
                  }
                }}
              />
            </div>
            <div className="doctor-signature-upload">
              <label>Doctor Signature</label>
              <div className="doctor-signature-preview">
                {previewSignature ? (
                  <img
                    src={previewSignature}
                    alt={`${name || "Doctor"} signature`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span>Digital signature not uploaded</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={edit}
                onChange={(e) => {
                  const file = e.target.files[0];
                  setSignatureFile(file);
                  if (file) {
                    setPreviewSignature(URL.createObjectURL(file));
                  }
                }}
              />
            </div>
          </aside>

          <div className="doctor-detail-main">
            <div className="doctor-detail-section">
              <div className="doctor-detail-section-head">
                <div>
                  <h3>Verification Status</h3>
                  <p>Current status of the doctor's verification.</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/doctors/verification/${id}`)}
                >
                  Verify Doctor
                </button>
              </div>
              <div className="doctor-detail-grid">
                <DetailField
                  label="Verification Status"
                  value={doctor?.verificationStatus}
                  disabled
                />
                <DetailField
                  label="Qualification"
                  value={qualification}
                  setValue={setQualification}
                  disabled={edit}
                />
                <DetailField
                  label="Registration Number"
                  value={registrationNumber}
                  setValue={setRegistrationNumber}
                  disabled={edit}
                />
              </div>
            </div>

            <div className="doctor-detail-section">
              <div className="doctor-detail-section-head">
                <div>
                  <h3>Profile Information</h3>
                  <p>Core identity and professional information.</p>
                </div>
              </div>
              <div className="doctor-detail-grid">
                <DetailField
                  label="Name"
                  value={name}
                  setValue={setName}
                  disabled={edit}
                />
                <DetailField
                  label="Email"
                  value={email}
                  setValue={setEmail}
                  disabled={edit}
                  type="email"
                />
                <DetailField
                  label="Degree"
                  value={degree}
                  setValue={setDegree}
                  disabled={edit}
                />
                <DetailSelect
                  label="Speciality"
                  value={speciality}
                  setValue={setSpeciality}
                  disabled={edit}
                  options={["Select Speciality", ...doctorSpecialities]}
                />
                <DetailSelect
                  label="Gender"
                  value={gender}
                  setValue={setGender}
                  disabled={edit}
                  options={["Select Gender", "Male", "Female"]}
                />
                <DetailField
                  label="Experience"
                  value={experience}
                  setValue={setExperience}
                  disabled={edit}
                />
              </div>
            </div>

            <div className="doctor-detail-section">
              <div className="doctor-detail-section-head">
                <div>
                  <h3>Practice Details</h3>
                  <p>Pricing, contact, schedule, and public description.</p>
                </div>
              </div>
              <div className="doctor-detail-grid">
                <DetailField
                  label="Fees"
                  value={fees}
                  setValue={setFees}
                  disabled={edit}
                />
                <DetailField
                  label="Phone"
                  value={phone}
                  setValue={setPhone}
                  disabled={edit}
                />
                <DetailField
                  label="Address"
                  value={address}
                  setValue={setAddress}
                  disabled={edit}
                  multiline
                />
                <DetailSelect
                  label="Online Status"
                  value={onlineStatus}
                  setValue={setOnlineStatus}
                  disabled={edit}
                  options={["online", "offline"]}
                />
                <DetailField
                  label="Availability Schedule"
                  value={availabilitySchedule}
                  setValue={setAvailabilitySchedule}
                  disabled={edit}
                />
                <DetailField
                  label="About"
                  value={about}
                  setValue={setAbout}
                  disabled={edit}
                  multiline
                />
              </div>
            </div>

            <div className="doctor-detail-actionbar">
              <button
                className="btn btn-primary"
                onClick={() => handleUpdate(doctor?._id)}
                disabled={edit}
              >
                Update Doctor
              </button>
              {doctor?.available ? (
                <button
                  className="btn btn-danger"
                  onClick={() => handleUpdateStatus(doctor?._id, false)}
                >
                  Mark Unavailable
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={() => handleUpdateStatus(doctor?._id, true)}
                >
                  Mark Available
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Doctor"
        message={`Are you sure you want to delete ${doctor?.name || "this doctor"}?`}
        details="This action cannot be undone and the doctor profile will be removed from the system."
        confirmLabel="Delete Doctor"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </Layout>
  );
};

export default DoctorDetails;
