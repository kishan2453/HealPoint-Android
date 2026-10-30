import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { getAllDoctors } from "../../redux/actions/doctorActions";
import { reset } from "../../redux/slice/doctorSlice";

const getDoctorImage = (image) => {
  if (!image) return "https://placehold.co/120x120?text=Doctor";
  if (/^https:\/\/images\.unsplash\.com/i.test(image)) {
    const separator = image.includes("?") ? "&" : "?";
    return /[?&]q=/i.test(image) ? image : `${image}${separator}q=95&w=1200&dpr=2`;
  }
  return /^(https?:|data:|blob:)/i.test(image)
    ? image
    : `data:image/jpeg;base64,${image}`;
};

const AllDoctors = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [speciality, setSpeciality] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    dispatch(getAllDoctors());
    dispatch(reset());
  }, [dispatch]);

  const { doctors } = useSelector((state) => state.doctor);
  const doctorList = doctors || [];

  const specialities = useMemo(() => {
    return [...new Set(doctorList.map((doctor) => doctor?.speciality).filter(Boolean))];
  }, [doctorList]);

  const stats = useMemo(() => {
    const available = doctorList.filter((doctor) => doctor?.available).length;
    const online = doctorList.filter((doctor) => doctor?.onlineStatus === "online").length;

    return [
      { label: "Total Doctors", value: doctorList.length },
      { label: "Available", value: available },
      { label: "Unavailable", value: doctorList.length - available },
      { label: "Online", value: online },
    ];
  }, [doctorList]);

  const filteredDoctors = useMemo(() => {
    return doctorList.filter((doctor) => {
      const query = `${doctor?.name || ""} ${doctor?.email || ""} ${doctor?.phone || ""} ${doctor?.speciality || ""} ${doctor?.degree || ""}`.toLowerCase();
      const matchesSearch = query.includes(search.toLowerCase());
      const matchesAvailability =
        availability === "all" ||
        (availability === "available" && doctor?.available) ||
        (availability === "unavailable" && !doctor?.available);
      const matchesSpeciality =
        speciality === "all" || doctor?.speciality === speciality;

      return matchesSearch && matchesAvailability && matchesSpeciality;
    });
  }, [availability, doctorList, search, speciality]);

  const totalPages = Math.max(Math.ceil(filteredDoctors.length / perPage), 1);
  const paginatedDoctors = filteredDoctors.slice(
    (page - 1) * perPage,
    page * perPage
  );

  return (
    <Layout>
      <section className="doctor-list-page">
        <section className="page-intro doctor-list-hero">
          <div>
            <span className="eyebrow">Doctor operations</span>
            <h2>All Doctors</h2>
            <p>
              Manage doctor profiles, availability, speciality, fees, and
              detail updates from one clean workspace.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/add-doctor")}
          >
            Add Doctor
          </button>
        </section>

        <div className="doctor-list-stats">
          {stats.map((item) => (
            <div className="doctor-list-stat" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="filters-row doctor-list-filters">
          <div className="admin-search grow">
            <span>Search</span>
            <input
              placeholder="Name, email, phone, speciality"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Availability</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <select
            value={speciality}
            onChange={(e) => {
              setSpeciality(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Specialities</option>
            {specialities.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div
          className={`admin-table-scroll doctor-list-table ${
            filteredDoctors.length > 10 ? "is-scrollable" : ""
          }`}
        >
          <table className="table">
          <thead>
            <tr>
              <th>SNO</th>
              <th>DOCTOR</th>
              <th>SPECIALITY</th>
              <th>CONTACT</th>
              <th>FEES</th>
              <th>AVAILABLE</th>
              <th>ONLINE</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDoctors.map((d, i) => (
              <tr key={i + 1}>
                <td>{(page - 1) * perPage + i + 1}</td>
                <td>
                  <div className="doctor-list-identity">
                    <img
                      src={getDoctorImage(d?.image)}
                      alt={d?.name ? `${d.name} profile` : "Doctor profile"}
                      width={72}
                      height={72}
                      loading="lazy"
                      decoding="async"
                      className="hd-profile-image"
                    />
                    <div>
                      <strong>{d?.name || "NA"}</strong>
                      <small>{d?.degree || "Degree not added"}</small>
                    </div>
                  </div>
                </td>
                <td>{d?.speciality || "NA"}</td>
                <td>
                  <div className="doctor-list-contact">
                    <strong>{d?.phone || "NA"}</strong>
                    <small>{d?.email || "Email not added"}</small>
                  </div>
                </td>
                <td>{d?.fees ? `Rs. ${d.fees}` : "NA"}</td>
                <td>
                  <span className={`status-pill ${d?.available ? "completed" : "cancel"}`}>
                    {d?.available ? "Available" : "Not Available"}
                  </span>
                </td>
                <td>
                  <span
                    className={`doctor-online-pill ${
                      d?.onlineStatus === "online" ? "online" : "offline"
                    }`}
                  >
                    {d?.onlineStatus || "offline"}
                  </span>
                </td>
                <td>
                  <Link className="doctor-details-link" to={`/doctor-details/${d?._id}`}>
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        {!filteredDoctors.length && (
          <div className="empty-state">No doctors match your filters.</div>
        )}

        <div className="pagination-row doctor-list-pagination">
          <button
            className="btn btn-light"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-light"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </Layout>
  );
};

export default AllDoctors;
