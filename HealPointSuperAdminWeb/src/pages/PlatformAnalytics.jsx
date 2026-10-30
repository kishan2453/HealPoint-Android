import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { getAnalytics, getStats } from "../redux/actions/userAction";
import API from "../Api/API";
import { useNavigate } from "react-router-dom";
import CountUp from "react-countup";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  FaBan,
  FaBuilding,
  FaCalendarCheck,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaHospital,
  FaHourglassHalf,
  FaHeartbeat,
  FaStethoscope,
  FaSyncAlt,
  FaTimesCircle,
  FaTrashAlt,
  FaUserInjured,
} from "react-icons/fa";

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const APPOINTMENT_STATUS_META = {
  pending: { label: "Pending", color: "#f59e0b" },
  confirmed: { label: "Confirmed", color: "#3b82f6" },
  completed: { label: "Completed", color: "#10b981" },
  cancelled: { label: "Cancelled", color: "#94a3b8" },
  missed: { label: "Missed", color: "#ef4444" },
  rejected: { label: "Rejected", color: "#f43f5e" },
};

const statusLabel = (value) => (value ? String(value).replace(/_/g, " ") : "—");

const chartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="sa-chart-tip">
      <strong>{item.name}</strong>
      <span>{item.value}</span>
    </div>
  );
};

const SkeletonCards = () => (
  <div className="sa-kpi-grid">
    {[0, 1, 2, 3, 4].map((i) => (
      <div className="sa-kpi sa-kpi-skeleton" key={i} />
    ))}
  </div>
);

const DataUnavailable = ({ title, detail, endpoint }) => (
  <div className="sa-unavailable">
    <FaExclamationTriangle />
    <strong>{title || "Data unavailable"}</strong>
    <p>{detail || "This metric is not returned for the Super Admin scope."}</p>
    {endpoint && <code>{endpoint}</code>}
  </div>
);

const PlatformAnalytics = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { stats, analytics } = useSelector((state) => state.user);

  const [subOverview, setSubOverview] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsError, setHospitalsError] = useState("");
  const [subError, setSubError] = useState("");
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [range, setRange] = useState("30d");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    dispatch(getStats());
    dispatch(getAnalytics(range));

    try {
      const subscriptionApi = await API.get("/subscription/overview");
      setSubOverview(subscriptionApi.data.overview);
      setSubError("");
    } catch (error) {
      setSubError(
        error?.response?.data?.message ||
          error.message ||
          "Failed to load subscription overview",
      );
    }

    try {
      const hospitalApi = await API.get("/hospital/get-all");
      setHospitals(hospitalApi.data.hospitals || []);
      setHospitalsError("");
    } catch (error) {
      setHospitalsError(
        error?.response?.data?.message || "Failed to load hospital directory",
      );
      setHospitals([]);
    } finally {
      setLoadingHospitals(false);
    }

    setTimeout(() => setRefreshing(false), 400);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const kpis = useMemo(() => {
    const base = {
      totalHospitals: analytics?.totalHospitals ?? stats?.totalHospitals,
      activeHospitals: analytics?.activeHospitals,
      totalDoctors: analytics?.totalDoctors ?? stats?.totalDoctors,
      totalPatients: analytics?.totalPatients ?? stats?.totalPatients,
      totalAppointments:
        analytics?.totalAppointments ?? stats?.totalAppointments,
    };
    return [
      {
        label: "Total Hospitals",
        value: base.totalHospitals,
        icon: <FaHospital />,
        tone: "blue",
        note: "Registered on the platform",
      },
      {
        label: "Active Hospitals",
        value: base.activeHospitals,
        icon: <FaBuilding />,
        tone: "teal",
        note: "Currently live",
      },
      {
        label: "Total Doctors",
        value: base.totalDoctors,
        icon: <FaStethoscope />,
        tone: "violet",
        note: "All specialist profiles",
      },
      {
        label: "Total Patients",
        value: base.totalPatients,
        icon: <FaUserInjured />,
        tone: "indigo",
        note: "Registered patient accounts",
      },
      {
        label: "Total Appointments",
        value: base.totalAppointments,
        icon: <FaCalendarCheck />,
        tone: "amber",
        note: "All-time bookings",
      },
    ];
  }, [analytics, stats]);

  const appointmentStatusData = useMemo(() => {
    const counts = analytics?.appointmentStatusCounts || [];
    return counts
      .map((item) => {
        const meta = APPOINTMENT_STATUS_META[item._id] || {
          label: String(item._id || "Other"),
          color: "#94a3b8",
        };
        return { name: meta.label, value: item.count, color: meta.color };
      })
      .filter((item) => Number(item.value) > 0);
  }, [analytics]);

  const hasStatusData = appointmentStatusData.length > 0;

  const subscriptionCards = useMemo(() => {
    if (!subOverview) return [];
    return [
      {
        label: "Total Hospitals",
        value: subOverview.totalHospitals ?? "—",
        tone: "blue",
        Icon: FaHospital,
      },
      {
        label: "Active Subscriptions",
        value: subOverview.activeSubscriptions ?? "—",
        tone: "teal",
        Icon: FaCheckCircle,
      },
      {
        label: "Trial",
        value: subOverview.trialCount ?? "—",
        tone: "amber",
        Icon: FaHourglassHalf,
      },
      {
        label: "Past Due",
        value: subOverview.pastDueCount ?? "—",
        tone: "orange",
        Icon: FaClock,
      },
      {
        label: "Suspended",
        value: subOverview.suspendedCount ?? "—",
        tone: "red",
        Icon: FaBan,
      },
      {
        label: "Expired",
        value: subOverview.expiredCount ?? "—",
        tone: "slate",
        Icon: FaTimesCircle,
      },
      {
        label: "Cancelled",
        value: subOverview.cancelledCount ?? "—",
        tone: "gray",
        Icon: FaTrashAlt,
      },
    ];
  }, [subOverview]);

  const topHospitals = useMemo(
    () =>
      [...(hospitals || [])]
        .sort(
          (a, b) =>
            Number(b?.appointmentCount || 0) - Number(a?.appointmentCount || 0),
        )
        .slice(0, 8),
    [hospitals],
  );

  const isAnalyticsReady = useMemo(
    () =>
      kpis.some(
        (kpi) =>
          kpi.value !== undefined &&
          kpi.value !== null &&
          Number.isFinite(Number(kpi.value)),
      ),
    [kpis],
  );
  return (
    <Layout>
      <div className="sa-heading">
        <div>
          <p className="sa-eyebrow">Overview / Platform Analytics</p>
          <h2>Platform Analytics</h2>
          <span>
            Live platform intelligence powered by backend data — no estimated or
            fabricated figures.
          </span>
        </div>
        <div className="sa-heading-actions">
          <select
            className="sa-range-select"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="12m">Last 12 months</option>
          </select>
          <button
            type="button"
            className="sa-btn sa-btn-outline"
            onClick={() => navigate("/system-health")}
            title="View live backend and infrastructure health diagnostics"
          >
            <FaHeartbeat style={{ color: "#ef4444" }} /> System Health
          </button>
          <button
            type="button"
            className="sa-btn sa-btn-outline"
            onClick={loadData}
          >
            <FaSyncAlt className={refreshing ? "sa-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {refreshing && (
        <div className="sa-refresh-banner">Refreshing platform analytics…</div>
      )}

      {isAnalyticsReady ? (
        <section className="sa-kpi-grid">
          {kpis.map((kpi) => (
            <article className={`sa-kpi sa-kpi-${kpi.tone}`} key={kpi.label}>
              <div className="sa-kpi-icon">{kpi.icon}</div>
              <div className="sa-kpi-body">
                <p>{kpi.label}</p>
                <strong>
                  <CountUp
                    end={Number(kpi.value) || 0}
                    duration={1.4}
                    separator=","
                  />
                </strong>
                <span>{kpi.note}</span>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <SkeletonCards />
      )}

      <section className="sa-analytics-grid">
        <article className="sa-card">
          <div className="sa-card-head">
            <h3>Appointment Status</h3>
            <span className="sa-source-badge">GET /user/analytics</span>
          </div>
          {hasStatusData ? (
            <>
              <div className="sa-chart-block">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={appointmentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={95}
                      paddingAngle={3}
                      cornerRadius={5}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {appointmentStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={chartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="sa-legend">
                {appointmentStatusData.map((entry) => (
                  <span key={entry.name}>
                    <i style={{ backgroundColor: entry.color }} />
                    {entry.name} · {entry.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <DataUnavailable
              title="Appointment breakdown unavailable"
              detail="There are currently no appointment records in the database."
              endpoint="GET /user/analytics"
            />
          )}
        </article>

        <article className="sa-card">
          <div className="sa-card-head">
            <h3>Subscription Snapshot</h3>
            <span className="sa-source-badge">GET /subscription/overview</span>
          </div>
          {subOverview ? (
            <>
              <div className="sa-mini-grid">
                {subscriptionCards.map(({ label, value, Icon, tone }) => (
                  <div className={`sa-mini-stat sa-mini-${tone}`} key={label}>
                    <span className="sa-mini-icon">
                      <Icon />
                    </span>
                    <div>
                      <strong>{value}</strong>
                      <p>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="sa-revenue-strip">
                <div className="sa-rev-pair">
                  <span>Expected revenue</span>
                  <strong>{formatMoney(subOverview.revenue || 0)}</strong>
                </div>
                <div className="sa-rev-pair">
                  <span>Paid revenue</span>
                  <strong>{formatMoney(subOverview.paidRevenue || 0)}</strong>
                </div>
              </div>
            </>
          ) : (
            <DataUnavailable
              title="Subscription data unavailable"
              detail={
                subError ||
                "The subscription overview endpoint could not be reached."
              }
              endpoint="GET /subscription/overview"
            />
          )}
        </article>
        <article className="sa-card">
          <div className="sa-card-head">
            <h3>Appointment Revenue</h3>
            <span className="sa-source-badge">GET /user/analytics</span>
          </div>
          <DataUnavailable
            title="Revenue restricted for Super Admin"
            detail="The backend returns platform totals only for Super Admin (privacyRestricted: true). Appointment-based revenue requires hospital-scoped access, so it is not shown here."
            endpoint="GET /user/analytics"
          />
        </article>

        <article className="sa-card">
          <div className="sa-card-head">
            <h3>Monthly Growth Trend</h3>
            <span className="sa-source-badge">GET /user/analytics</span>
          </div>
          <DataUnavailable
            title="Monthly trends unavailable"
            detail="The Super Admin analytics payload does not include monthly appointment/patient arrays. Trends are only computed for hospital-scoped sessions."
            endpoint="GET /user/analytics?range=30d"
          />
        </article>
      </section>

      <section className="sa-card sa-table-card">
        <div className="sa-card-head">
          <h3>Hospital Activity Breakdown</h3>
          <span className="sa-source-badge">GET /hospital/get-all</span>
          <button
            type="button"
            className="sa-btn sa-btn-ghost sa-head-cta"
            onClick={() => navigate("/hospitals")}
          >
            Manage hospitals →
          </button>
        </div>
        {hospitalsError || (!hospitals.length && !loadingHospitals) ? (
          <DataUnavailable
            title="Hospital directory unavailable"
            detail={
              hospitalsError || "The hospital API returned an empty list."
            }
            endpoint="GET /hospital/get-all"
          />
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Doctors</th>
                  <th>Patients</th>
                  <th>Appointments</th>
                  <th>Subscription</th>
                </tr>
              </thead>
              <tbody>
                {topHospitals.map((hospital) => (
                  <tr
                    key={hospital.hospitalId || hospital._id}
                    onClick={() => navigate("/hospitals")}
                  >
                    <td className="sa-cell-hospital">
                      {hospital.logo ? (
                        <img
                          className="sa-hosp-logo"
                          src={hospital.logo}
                          alt=""
                        />
                      ) : (
                        <span className="sa-hosp-logo sa-hosp-logo-fallback">
                          {String(hospital.name || "H").charAt(0)}
                        </span>
                      )}
                      <div>
                        <strong>{hospital.name}</strong>
                        <small>{hospital.location?.city || "—"}</small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`sa-pill ${
                          hospital.isActive
                            ? "sa-pill-success"
                            : "sa-pill-muted"
                        }`}
                      >
                        {hospital.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{hospital.doctorCount ?? 0}</td>
                    <td>{hospital.patientCount ?? 0}</td>
                    <td>{hospital.appointmentCount ?? 0}</td>
                    <td>
                      <span className="sa-pill sa-pill-info">
                        {statusLabel(hospital.subscriptionStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sa-card sa-credits">
        <div className="sa-card-head">
          <h3>Data Sources</h3>
        </div>
        <div className="sa-source-list">
          <span>
            <FaFileInvoiceDollar /> GET /user/get-stats — platform totals (live)
          </span>
          <span>
            <FaFileInvoiceDollar /> GET /user/analytics — platform totals &amp;
            appointment statuses (live)
          </span>
          <span>
            <FaFileInvoiceDollar /> GET /subscription/overview — subscriptions
            &amp; revenue (live)
          </span>
          <span>
            <FaFileInvoiceDollar /> GET /hospital/get-all — per-hospital
            doctor/patient/appointment counts (live)
          </span>
          <span className="sa-source-warn">
            <FaExclamationTriangle /> Only backend-provided values are rendered.
            Unavailable metrics show an explicit state instead of fake numbers.
          </span>
        </div>
      </section>
    </Layout>
  );
};

export default PlatformAnalytics;
