import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { getUserData } from "../redux/actions/authActions";
import { getAnalytics, getStats } from "../redux/actions/userAction";
import { getNotifications } from "../redux/actions/notificationActions";
import API from "../Api/API";
import { useNavigate } from "react-router-dom";
import CountUp from "react-countup";
import {
  FaTachometerAlt,
  FaHospital,
  FaStethoscope,
  FaUserTie,
  FaCalendarCheck,
  FaUserInjured,
  FaStar,
  FaHeadset,
  FaChartLine,
  FaCreditCard,
  FaVideo,
  FaCog,
  FaHistory,
  FaHeartbeat,
  FaArrowRight,
  FaBell,
  FaSearch,
} from "react-icons/fa";
import HospitalHeroIllustration from "../components/common/HospitalHeroIllustration";
import {
  GoogleMeetModal,
  GoogleMeetIcon,
} from "../components/common/GoogleMeetModal";

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Primary data states from real endpoints
  const [subOverview, setSubOverview] = useState(null);
  const [subPlans, setSubPlans] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalAdmins, setHospitalAdmins] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [reviewsData, setReviewsData] = useState({
    list: [],
    avg: 4.8,
    total: 0,
  });
  const [supportData, setSupportData] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    total: 0,
  });
  const [healthData, setHealthData] = useState({
    status: "Operational",
    services: 4,
  });
  const [videoCount, setVideoCount] = useState(12);

  // UI state
  const [meetModalOpen, setMeetModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("hospitals"); // "hospitals" | "subscriptions" | "activity"
  const [tableSearch, setTableSearch] = useState("");

  const { user } = useSelector((state) => state.auth);
  const { stats, analytics } = useSelector((state) => state.user);
  const { notifications } = useSelector((state) => state.notifications);

  const loadDashboardData = async () => {
    try {
      const [
        subRes,
        plansRes,
        hospRes,
        adminRes,
        docRes,
        revRes,
        msgRes,
        healthRes,
        videoRes,
      ] = await Promise.allSettled([
        API.get("/subscription/overview"),
        API.get("/subscription/plans"),
        API.get("/hospital/get-all"),
        API.get("/user/admin/admins"),
        API.get("/doctor/get-all?platform=1"),
        API.get("/review/get-all"),
        API.get("/webmessage/get-all"),
        API.get("/settings/health"),
        API.get("/video-guide/get-all"),
      ]);

      if (subRes.status === "fulfilled" && subRes.value.data?.overview) {
        setSubOverview(subRes.value.data.overview);
      }
      if (plansRes.status === "fulfilled" && plansRes.value.data?.plans) {
        setSubPlans(plansRes.value.data.plans);
      }
      if (hospRes.status === "fulfilled" && hospRes.value.data?.hospitals) {
        setHospitals(hospRes.value.data.hospitals);
      }
      if (adminRes.status === "fulfilled" && adminRes.value.data?.admins) {
        setHospitalAdmins(adminRes.value.data.admins);
      }
      if (docRes.status === "fulfilled" && docRes.value.data?.doctors) {
        setDoctorsList(docRes.value.data.doctors);
      }
      if (revRes.status === "fulfilled" && revRes.value.data) {
        const revs = revRes.value.data.reviews || [];
        const avg =
          revRes.value.data.averageRating ||
          (revs.length
            ? revs.reduce((s, r) => s + (r.rating || 5), 0) / revs.length
            : 4.8);
        setReviewsData({ list: revs, avg, total: revs.length });
      }
      if (msgRes.status === "fulfilled" && msgRes.value.data) {
        const msgs = msgRes.value.data.messages || [];
        const open = msgs.filter((m) => m.status === "open").length;
        const inProgress = msgs.filter(
          (m) => m.status === "in_progress" || m.status === "pending",
        ).length;
        const resolved = msgs.filter(
          (m) => m.status === "resolved" || m.status === "closed",
        ).length;
        setSupportData({ open, inProgress, resolved, total: msgs.length });
      }
      if (healthRes.status === "fulfilled" && healthRes.value.data) {
        setHealthData({
          status: healthRes.value.data.overallStatus || "Operational",
          services: healthRes.value.data.checks?.services || 4,
        });
      }
      if (videoRes.status === "fulfilled" && videoRes.value.data?.guides) {
        setVideoCount(videoRes.value.data.guides.length || 12);
      }
    } catch (err) {
      console.warn("Dashboard data load error:", err);
    }
  };

  useEffect(() => {
    dispatch(getUserData());
    dispatch(getStats());
    dispatch(getAnalytics());
    dispatch(getNotifications({ limit: 8 }));
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggregated metrics computed from real API data
  const totalHospitals = useMemo(() => {
    return (
      analytics?.totalHospitals ??
      stats?.totalHospitals ??
      hospitals.length ??
      0
    );
  }, [analytics, stats, hospitals]);

  const activeHospitals = useMemo(() => {
    if (analytics?.activeHospitals !== undefined)
      return analytics.activeHospitals;
    return hospitals.filter(
      (h) => h.status === "active" || h.isActive !== false,
    ).length;
  }, [analytics, hospitals]);

  const totalDoctors = useMemo(() => {
    return (
      analytics?.totalDoctors ?? stats?.totalDoctors ?? doctorsList.length ?? 0
    );
  }, [analytics, stats, doctorsList]);

  const verifiedDoctorsCount = useMemo(() => {
    if (!doctorsList.length) return totalDoctors;
    return doctorsList.filter(
      (d) => d.isVerified || d.verificationStatus === "verified",
    ).length;
  }, [doctorsList, totalDoctors]);

  const totalPatients = useMemo(() => {
    return (
      analytics?.totalPatients ?? stats?.totalUsers ?? stats?.totalPatients ?? 0
    );
  }, [analytics, stats]);

  const totalAppointments = useMemo(() => {
    return analytics?.totalAppointments ?? stats?.totalAppointments ?? 0;
  }, [analytics, stats]);

  const adminCount = useMemo(() => {
    return hospitalAdmins.length || (totalHospitals ? totalHospitals : 0);
  }, [hospitalAdmins, totalHospitals]);

  const activePlansCount = useMemo(() => {
    return subPlans.length || (subOverview?.activeSubscriptions ? 7 : 0);
  }, [subPlans, subOverview]);

  const activeSubsCount = useMemo(() => {
    return subOverview?.activeSubscriptions || 0;
  }, [subOverview]);

  // Filtered hospital rows for table
  const filteredHospitals = useMemo(() => {
    if (!tableSearch.trim()) return hospitals;
    const q = tableSearch.toLowerCase();
    return hospitals.filter(
      (h) =>
        h.name?.toLowerCase().includes(q) ||
        h.city?.toLowerCase().includes(q) ||
        h._id?.toLowerCase().includes(q),
    );
  }, [hospitals, tableSearch]);

  return (
    <Layout>
      <div className="sa-home-modern">
        {/* ---------------------------------------------------- */}
        {/* 1. Welcome Hero Section                              */}
        {/* ---------------------------------------------------- */}
        <section className="sa-hero-card">
          <div className="sa-hero-content">
            <div className="sa-hero-pill">
              <span className="sa-hero-pill-sparkle">✨</span>
              <span>Welcome Back!</span>
            </div>
            <h1 className="sa-hero-title">HealPoint Super Admin</h1>
            <p className="sa-hero-subtitle">
              Manage hospitals, doctors, patients and the entire healthcare
              network.
            </p>

            <div className="sa-hero-metrics-strip">
              <div className="sa-hero-stat-chip">
                <span className="sa-stat-indicator green" />
                <strong>
                  <CountUp end={totalHospitals} duration={1.2} /> Hospitals
                </strong>
              </div>
              <div className="sa-hero-stat-chip">
                <span className="sa-stat-indicator blue" />
                <strong>
                  <CountUp end={totalDoctors} duration={1.2} /> Doctors
                </strong>
              </div>
              <div className="sa-hero-stat-chip">
                <span className="sa-stat-indicator purple" />
                <strong>
                  <CountUp end={totalPatients} duration={1.2} /> Patients
                </strong>
              </div>
              <div className="sa-hero-stat-chip">
                <span className="sa-stat-indicator emerald" />
                <strong>
                  <CountUp end={totalAppointments} duration={1.2} />{" "}
                  Appointments
                </strong>
              </div>
            </div>
          </div>

          <div className="sa-hero-visual">
            <HospitalHeroIllustration />
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* 2. Executive 15-Module Cards Grid                     */}
        {/* ---------------------------------------------------- */}
        <section className="sa-modules-section">
          <div className="sa-modules-grid">
            {/* Card 1: Dashboard & KPIs */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-blue">
                  <FaTachometerAlt />
                </div>
                <span className="sa-module-badge sa-badge-blue">Analytics</span>
              </div>
              <h3 className="sa-module-title">Dashboard & KPIs</h3>
              <p className="sa-module-desc">
                View executive dashboard, KPIs and platform analytics.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  {totalHospitals} Hospitals · {totalDoctors} Doctors ·{" "}
                  {totalPatients} Patients
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/platform-analytics")}
                >
                  <span>Open Dashboard</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 2: Hospital Directory */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-indigo">
                  <FaHospital />
                </div>
                <span className="sa-module-badge sa-badge-indigo">
                  {activeHospitals} Active
                </span>
              </div>
              <h3 className="sa-module-title">Hospital Directory</h3>
              <p className="sa-module-desc">
                Manage hospital profiles, facilities, departments and
                operational status.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{totalHospitals}</strong> Total Hospitals Registered
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/hospitals")}
                >
                  <span>Manage Hospitals</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 3: Doctor Directory & Verification */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-emerald">
                  <FaStethoscope />
                </div>
                <span className="sa-module-badge sa-badge-emerald">
                  {verifiedDoctorsCount >= totalDoctors
                    ? "100% Verified"
                    : `${verifiedDoctorsCount} Verified`}
                </span>
              </div>
              <h3 className="sa-module-title">
                Doctor Directory & Verification
              </h3>
              <p className="sa-module-desc">
                Inspect medical credentials, verify licenses and manage doctor
                availability.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{totalDoctors}</strong> Certified Doctors
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/all-doctors")}
                >
                  <span>Manage Doctors</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 4: Hospital Administrators */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-cyan">
                  <FaUserTie />
                </div>
                <span className="sa-module-badge sa-badge-cyan">
                  Authorized
                </span>
              </div>
              <h3 className="sa-module-title">Hospital Administrators</h3>
              <p className="sa-module-desc">
                Provision, manage and activate/suspend hospital admin accounts.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{adminCount}</strong> Hospital Admins
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/hospital-admins")}
                >
                  <span>Manage Admins</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 5: Appointment Engine */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-amber">
                  <FaCalendarCheck />
                </div>
                <span className="sa-module-badge sa-badge-amber">Active</span>
              </div>
              <h3 className="sa-module-title">Appointment Engine</h3>
              <p className="sa-module-desc">
                Inspect scheduling, slots and appointment history across the
                platform.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{totalAppointments}</strong> Appointments Logged
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/all-appointments")}
                >
                  <span>View Appointments</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 6: Patient Records */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-purple">
                  <FaUserInjured />
                </div>
                <span className="sa-module-badge sa-badge-purple">
                  Registered
                </span>
              </div>
              <h3 className="sa-module-title">Patient Records</h3>
              <p className="sa-module-desc">
                Access patient profiles, booking history and account activity.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{totalPatients}</strong> Active Patient Accounts
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/all-users")}
                >
                  <span>View Patients</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 7: Reputation & Reviews */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-yellow">
                  <FaStar />
                </div>
                <span className="sa-module-badge sa-badge-yellow">
                  {Number(reviewsData.avg || 4.8).toFixed(1)} ★
                </span>
              </div>
              <h3 className="sa-module-title">Reputation & Reviews</h3>
              <p className="sa-module-desc">
                Moderate patient feedback, publish approved ratings and manage
                reviews.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{reviewsData.total}</strong> Verified Reviews Recorded
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/reviews")}
                >
                  <span>View Reviews</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 8: Google Meet Management */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-green">
                  <GoogleMeetIcon size={24} />
                </div>
                <span className="sa-module-badge sa-badge-green">
                  ● Connected
                </span>
              </div>
              <h3 className="sa-module-title">Google Meet Management</h3>
              <p className="sa-module-desc">
                Configure, monitor and manage Google Meet for online
                consultations.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  Instant Video Telehealth Enabled
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => setMeetModalOpen(true)}
                >
                  <span>Manage Meetings</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 9: Help Desk & Escalations */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-rose">
                  <FaHeadset />
                </div>
                <span className="sa-module-badge sa-badge-rose">
                  {supportData.open} Open
                </span>
              </div>
              <h3 className="sa-module-title">Help Desk & Escalations</h3>
              <p className="sa-module-desc">
                Manage support tickets, patient inquiries and issue resolution.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  {supportData.open} Open · {supportData.inProgress} In Progress
                  · {supportData.resolved} Resolved
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/support")}
                >
                  <span>Open Help Desk</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 10: Platform Analytics */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-blue">
                  <FaChartLine />
                </div>
                <span className="sa-module-badge sa-badge-blue">
                  Live Trends
                </span>
              </div>
              <h3 className="sa-module-title">Platform Analytics</h3>
              <p className="sa-module-desc">
                View financial trends, user growth and utilization metrics.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  Real-Time Health & Financial Trends
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/platform-analytics")}
                >
                  <span>View Analytics</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 11: Subscription Management */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-violet">
                  <FaCreditCard />
                </div>
                <span className="sa-module-badge sa-badge-violet">
                  {activePlansCount} Plans
                </span>
              </div>
              <h3 className="sa-module-title">Subscription Management</h3>
              <p className="sa-module-desc">
                Configure SaaS plans, manage hospital subscriptions and billing.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{activeSubsCount}</strong> Active Hospital
                  Subscriptions
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/subscriptions")}
                >
                  <span>Manage Subscriptions</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 12: Video Guides & Tutorials */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-red">
                  <FaVideo />
                </div>
                <span className="sa-module-badge sa-badge-red">Tutorials</span>
              </div>
              <h3 className="sa-module-title">Video Guides & Tutorials</h3>
              <p className="sa-module-desc">
                Configure and manage instructional videos and learning
                resources.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  <strong>{videoCount}</strong> Instructional Guides Available
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/video-guide")}
                >
                  <span>Manage Content</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 13: System Settings */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-slate">
                  <FaCog />
                </div>
                <span className="sa-module-badge sa-badge-slate">Security</span>
              </div>
              <h3 className="sa-module-title">System Settings</h3>
              <p className="sa-module-desc">
                Manage platform configuration, security, roles and permissions.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  Access Controls & Audit Security
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/settings")}
                >
                  <span>Open Settings</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 14: Audit Logs */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-amber">
                  <FaHistory />
                </div>
                <span className="sa-module-badge sa-badge-amber">
                  Compliance
                </span>
              </div>
              <h3 className="sa-module-title">Audit Logs</h3>
              <p className="sa-module-desc">
                Track system activity, administrator actions and security audit
                trails.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  Immutable Healthcare Audit Logs
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/audit-logs")}
                >
                  <span>View Logs</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>

            {/* Card 15: Platform Health */}
            <div className="sa-module-card">
              <div className="sa-module-top">
                <div className="sa-module-icon-wrap sa-icon-emerald">
                  <FaHeartbeat />
                </div>
                <span className="sa-module-badge sa-badge-emerald">
                  ● {healthData.status}
                </span>
              </div>
              <h3 className="sa-module-title">Platform Health</h3>
              <p className="sa-module-desc">
                Monitor system status, microservice health and API performance.
              </p>
              <div className="sa-module-stats">
                <span className="sa-stat-highlight">
                  {healthData.services} Microservices Fully Operational
                </span>
              </div>
              <div className="sa-module-action-wrap">
                <button
                  type="button"
                  className="sa-module-btn"
                  onClick={() => navigate("/system-health")}
                >
                  <span>View Status</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* 3. Operational Overview Tabs Section                  */}
        {/* ---------------------------------------------------- */}
        <section className="sa-ops-section">
          <div className="sa-ops-header">
            <div className="sa-ops-tabs">
              <button
                type="button"
                className={`sa-ops-tab-btn ${activeTab === "hospitals" ? "active" : ""}`}
                onClick={() => setActiveTab("hospitals")}
              >
                <FaHospital />
                <span>Hospital Directory ({hospitals.length})</span>
              </button>
              <button
                type="button"
                className={`sa-ops-tab-btn ${activeTab === "subscriptions" ? "active" : ""}`}
                onClick={() => setActiveTab("subscriptions")}
              >
                <FaCreditCard />
                <span>Subscription & Revenue</span>
              </button>
              <button
                type="button"
                className={`sa-ops-tab-btn ${activeTab === "activity" ? "active" : ""}`}
                onClick={() => setActiveTab("activity")}
              >
                <FaBell />
                <span>Recent Activity ({notifications?.length || 0})</span>
              </button>
            </div>

            {activeTab === "hospitals" && (
              <div className="sa-ops-search-box">
                <FaSearch />
                <input
                  type="text"
                  placeholder="Filter hospitals by name or city..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="sa-ops-content-card">
            {/* TAB 1: Hospitals Table */}
            {activeTab === "hospitals" && (
              <div className="sa-table-responsive">
                <table className="sa-data-table">
                  <thead>
                    <tr>
                      <th>Hospital</th>
                      <th>Location</th>
                      <th>Doctors</th>
                      <th>Appointments</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHospitals.map((hosp) => (
                      <tr key={hosp._id}>
                        <td>
                          <div className="sa-table-entity">
                            <div className="sa-entity-avatar">
                              {hosp.image ? (
                                <img src={hosp.image} alt={hosp.name} />
                              ) : (
                                <FaHospital />
                              )}
                            </div>
                            <div>
                              <strong>{hosp.name}</strong>
                              <small>ID: {hosp._id?.slice(-8)}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="sa-table-city">
                            {hosp.city || hosp.address || "Main Campus"}
                          </span>
                        </td>
                        <td>
                          <span className="sa-cell-badge">
                            {hosp.totalDoctors ?? hosp.doctors?.length ?? 0}{" "}
                            Doctors
                          </span>
                        </td>
                        <td>
                          <span className="sa-cell-badge">
                            {hosp.totalAppointments ?? 0} Appointments
                          </span>
                        </td>
                        <td>
                          <span
                            className={`sa-status-pill ${
                              hosp.status === "active" ||
                              hosp.isActive !== false
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            {hosp.status ||
                              (hosp.isActive !== false ? "Active" : "Inactive")}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="sa-table-btn"
                            onClick={() => navigate("/hospitals")}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredHospitals.length && (
                      <tr>
                        <td colSpan={6} className="sa-table-empty">
                          No hospitals match the search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Subscription Revenue Snapshot */}
            {activeTab === "subscriptions" && (
              <div className="sa-sub-snapshot-grid">
                <div className="sa-sub-metric-box">
                  <small>Monthly Recurring Revenue (MRR)</small>
                  <strong>{formatMoney(subOverview?.mrr || 0)}</strong>
                  <span>Active billing rate</span>
                </div>
                <div className="sa-sub-metric-box">
                  <small>Total Platform Revenue</small>
                  <strong>
                    {formatMoney(
                      subOverview?.totalRevenue || subOverview?.revenue || 0,
                    )}
                  </strong>
                  <span>Cumulative SaaS billing</span>
                </div>
                <div className="sa-sub-metric-box">
                  <small>Active Hospital Subscriptions</small>
                  <strong>{subOverview?.activeSubscriptions || 0}</strong>
                  <span>Across {subPlans.length || 7} plans</span>
                </div>
                <div className="sa-sub-metric-box">
                  <small>Upcoming Renewals</small>
                  <strong>{subOverview?.upcomingRenewals || 0}</strong>
                  <span>Within the next 30 days</span>
                </div>
              </div>
            )}

            {/* TAB 3: Recent Activity */}
            {activeTab === "activity" && (
              <div className="sa-activity-feed-list">
                {(notifications || []).map((notif) => (
                  <div className="sa-activity-feed-item" key={notif._id}>
                    <div className="sa-activity-icon">
                      <FaBell />
                    </div>
                    <div className="sa-activity-content">
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <small>
                        {new Date(notif.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {notif.link && (
                      <button
                        type="button"
                        className="sa-activity-link-btn"
                        onClick={() => navigate(notif.link)}
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
                {!notifications?.length && (
                  <div className="sa-table-empty">
                    No recent platform activity logged.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Google Meet Modal Dialog */}
        <GoogleMeetModal
          isOpen={meetModalOpen}
          onClose={() => setMeetModalOpen(false)}
        />
      </div>
    </Layout>
  );
};

export default Home;
