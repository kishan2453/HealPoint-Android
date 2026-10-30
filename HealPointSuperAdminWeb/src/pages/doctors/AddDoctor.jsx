import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "../../utils/notify";
import { addDoctor } from "../../redux/actions/doctorActions";
import API from "../../Api/API";
import { doctorSpecialities } from "../../constants/doctorSpecialities";
import {
  FaArrowLeft,
  FaCamera,
  FaCheckCircle,
  FaClock,
  FaEnvelope,
  FaIdBadge,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaRupeeSign,
  FaStethoscope,
  FaUserMd,
} from "react-icons/fa";

const AddDoctor = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [experience, setExperience] = useState("");
  const [degree, setDegree] = useState("");
  const [about, setAbout] = useState("");
  const [fees, setFees] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [onlineStatus, setOnlineStatus] = useState("offline");
  const [hospitalId, setHospitalId] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [availabilitySchedule, setAvailabilitySchedule] = useState(
    "Mon - Sat, 09:00 AM - 05:00 PM",
  );

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.doctor);

  useEffect(() => {
    API.get("/hospital/get-all")
      .then((res) => {
        const hospitalList = res.data?.hospitals || [];
        setHospitals(hospitalList);
        if (hospitalList[0]?._id) setHospitalId(hospitalList[0]._id);
      })
      .catch(() => {
        setHospitals([]);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  const completion = useMemo(() => {
    const required = [
      name,
      email,
      about,
      speciality,
      fees,
      experience,
      degree,
      address,
      phone,
      image,
    ];
    return Math.round(
      (required.filter(Boolean).length / required.length) * 100,
    );
  }, [
    about,
    address,
    degree,
    email,
    experience,
    fees,
    image,
    name,
    phone,
    speciality,
  ]);

  const handleAddDoctor = async (event) => {
    event.preventDefault();
    const trimmedAbout = about.trim();
    const numericFees = Number(fees);
    const numericExperience = Number(experience);

    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim() ||
      !trimmedAbout ||
      !speciality ||
      !fees ||
      !experience ||
      !degree.trim() ||
      !address.trim() ||
      !phone.trim() ||
      !gender ||
      !image
    ) {
      return toast.error("Please provide all fields");
    }

    const trimmedEmail = email.trim();
    const emailRegex =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (
      !trimmedEmail ||
      trimmedEmail.includes("..") ||
      trimmedEmail.includes("@.") ||
      !emailRegex.test(trimmedEmail)
    ) {
      return toast.error("Please enter a valid email address");
    }

    if (trimmedAbout.length < 10) {
      return toast.error("About doctor must be at least 10 characters");
    }

    if (Number.isNaN(numericFees) || numericFees < 100) {
      return toast.error("Fees must be at least Rs. 100");
    }

    if (
      Number.isNaN(numericExperience) ||
      numericExperience < 1 ||
      numericExperience > 60
    ) {
      return toast.error("Experience must be between 1 and 60 years");
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("email", trimmedEmail);
    formData.append("password", password);
    formData.append("about", trimmedAbout);
    formData.append("speciality", speciality);
    formData.append("fees", String(numericFees));
    formData.append("experience", String(numericExperience));
    formData.append("degree", degree.trim());
    formData.append("address", address.trim());
    formData.append("phone", phone.trim());
    if (hospitalId) {
      formData.append("hospitalId", hospitalId);
      const selectedHospital = hospitals.find(
        (item) => item._id === hospitalId,
      );
      if (selectedHospital?.name)
        formData.append("hospitalName", selectedHospital.name);
    }
    formData.append("image", image);
    formData.append("gender", gender);
    formData.append("onlineStatus", onlineStatus);
    formData.append("availabilitySchedule", availabilitySchedule.trim());

    try {
      await dispatch(addDoctor(formData)).unwrap();
      toast.success("Doctor Created!");
      navigate("/all-doctors");
    } catch (error) {
      toast.error(error);
    }
  };
  return (
    <Layout>
      <section className="page-intro add-doctor-hero">
        <div>
          <span className="eyebrow">Doctor onboarding</span>
          <h2>Add New Doctor</h2>
          <p>
            Create a clean doctor profile with contact, fees, speciality and
            schedule.
          </p>
        </div>
        <button
          className="btn btn-light"
          onClick={() => navigate("/all-doctors")}
        >
          <FaArrowLeft /> Back to Doctors
        </button>
      </section>

      <form className="add-doctor-shell" onSubmit={handleAddDoctor}>
        <aside className="add-doctor-preview-card">
          <div className="doctor-photo-drop">
            {previewImage ? (
              <img
                src={previewImage}
                alt="Doctor preview"
                width={240}
                height={240}
                loading="eager"
                decoding="async"
                className="hd-profile-image"
              />
            ) : (
              <div>
                <FaCamera />
                <span>Upload photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files[0];
                setImage(file || null);
                if (previewImage) URL.revokeObjectURL(previewImage);
                setPreviewImage(file ? URL.createObjectURL(file) : "");
              }}
            />
          </div>
          <h3>{name || "Doctor name"}</h3>
          <p>{speciality || "Speciality not selected"}</p>
          <div className="doctor-completion">
            <div>
              <span>Profile readiness</span>
              <strong>{completion}%</strong>
            </div>
            <progress value={completion} max="100" />
          </div>
          <div className="doctor-preview-list">
            <span>
              <FaEnvelope /> {email || "Email pending"}
            </span>
            <span>
              <FaPhoneAlt /> {phone || "Phone pending"}
            </span>
            <span>
              <FaClock /> {availabilitySchedule}
            </span>
          </div>
        </aside>

        <section className="add-doctor-form-card">
          <div className="add-doctor-section-head">
            <h3>
              <FaUserMd /> Professional Details
            </h3>
            <span>Required profile fields</span>
          </div>
          <div className="add-doctor-grid">
            <label>
              <span>Full Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Dr. Priya Sharma"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="doctor@hospital.com"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a strong password"
              />
            </label>
            <label>
              <span>Degree</span>
              <input
                value={degree}
                onChange={(event) => setDegree(event.target.value)}
                placeholder="MBBS, MD"
              />
            </label>
            <label>
              <span>Speciality</span>
              <select
                value={speciality}
                onChange={(event) => setSpeciality(event.target.value)}
              >
                <option value="">Select Speciality</option>
                {doctorSpecialities.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Gender</span>
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>
              <span>Hospital</span>
              <select
                value={hospitalId}
                onChange={(event) => setHospitalId(event.target.value)}
              >
                {hospitals.length ? (
                  hospitals.map((hospital) => (
                    <option value={hospital._id} key={hospital._id}>
                      {hospital.name}
                    </option>
                  ))
                ) : (
                  <option value="">Default hospital will be assigned</option>
                )}
              </select>
            </label>
            <label>
              <span>Experience</span>
              <input
                type="number"
                min="1"
                max="60"
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                placeholder="8"
              />
            </label>
          </div>

          <div className="add-doctor-section-head">
            <h3>
              <FaIdBadge /> Clinic Information
            </h3>
            <span>Visible to patients</span>
          </div>
          <div className="add-doctor-grid">
            <label>
              <span>
                <FaRupeeSign /> Fees
              </span>
              <input
                type="number"
                min="0"
                value={fees}
                onChange={(event) => setFees(event.target.value)}
                placeholder="500"
              />
            </label>
            <label>
              <span>
                <FaPhoneAlt /> Phone
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>
            <label>
              <span>
                <FaStethoscope /> Online Status
              </span>
              <select
                value={onlineStatus}
                onChange={(event) => setOnlineStatus(event.target.value)}
              >
                <option value="online">online</option>
                <option value="offline">offline</option>
              </select>
            </label>
            <label>
              <span>
                <FaClock /> Availability Schedule
              </span>
              <input
                value={availabilitySchedule}
                onChange={(event) =>
                  setAvailabilitySchedule(event.target.value)
                }
              />
            </label>
            <label className="add-doctor-wide">
              <span>
                <FaMapMarkerAlt /> Address
              </span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Clinic address"
              />
            </label>
            <label className="add-doctor-wide">
              <span>About Doctor</span>
              <textarea
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                placeholder="Short bio, treatment approach, and areas of care."
                rows="5"
              />
            </label>
          </div>

          <div className="add-doctor-actions">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => navigate("/all-doctors")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              <FaCheckCircle /> {loading ? "Creating..." : "Create Doctor"}
            </button>
          </div>
        </section>
      </form>
    </Layout>
  );
};

export default AddDoctor;
