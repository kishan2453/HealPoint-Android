import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { getAnalytics, getStats } from "../redux/actions/userAction";
import {
  FaArrowDown,
  FaArrowUp,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCreditCard,
  FaFire,
  FaReceipt,
  FaRupeeSign,
  FaStar,
  FaStethoscope,
  FaSyncAlt,
  FaTimesCircle,
  FaTrophy,
  FaUndo,
  FaUserPlus,
} from "react-icons/fa";

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const rangeMap = {
  Today: "today",
  "7 Days": "7d",
  "30 Days": "30d",
  "90 Days": "12m",
  "Custom Range": "7d",
};

const parseMetricValue = (value) => Number(String(value || 0).replace(/[^\d.-]/g, "")) || 0;

const getImageSrc = (image) => {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  return `data:image/jpeg;base64,${image}`;
};

const CountUpValue = ({ value, formatter = (item) => item }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = parseMetricValue(value);

  useEffect(() => {
    const duration = 720;
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [numericValue]);

  return formatter(displayValue);
};

const Sparkline = ({ points = [], dataKey = "revenue" }) => {
  const values = points.map((item) => Number(item?.[dataKey] || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const path = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 28;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="metric-sparkline" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <path d={path || "M 0 30 L 100 30"} />
    </svg>
  );
};

const SmoothChart = ({ data = [], dataKey = "revenue", formatValue }) => {
  const [active, setActive] = useState(null);
  const values = data.map((item) => Number(item?.[dataKey] || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const width = 720;
  const height = 260;
  const padding = 24;
  const coordinates = values.map((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y, value, item: data[index], index };
  });
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const fillPath = coordinates.length
    ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`
    : "";

  return (
    <div className="smooth-chart-shell" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue trend chart">
        <defs>
          <linearGradient id={`chartStroke-${dataKey}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id={`chartFill-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={padding}
            x2={width - padding}
            y1={padding + line * ((height - padding * 2) / 3)}
            y2={padding + line * ((height - padding * 2) / 3)}
          />
        ))}
        <path className="smooth-chart-fill" d={fillPath} fill={`url(#chartFill-${dataKey})`} />
        <path className="smooth-chart-line" d={linePath || ""} stroke={`url(#chartStroke-${dataKey})`} />
        {coordinates.map((point) => (
          <circle
            key={`${point.item?.label}-${point.index}`}
            cx={point.x}
            cy={point.y}
            r={active?.index === point.index ? 6 : 4}
            onMouseEnter={() => setActive({ ...point.item, value: point.value, index: point.index })}
          />
        ))}
      </svg>
      <div className="smooth-chart-labels">
        {data.map((item, index) => <small key={`${item.label}-${index}`}>{item.label}</small>)}
      </div>
      {active && (
        <div className="chart-tooltip" style={{ left: `${((active.index + 0.5) / Math.max(data.length, 1)) * 100}%` }}>
          <span>{active.label}</span>
          <strong>{formatValue ? formatValue(active.value) : active.value}</strong>
        </div>
      )}
    </div>
  );
};

const EarningsDashboard = () => {
  const dispatch = useDispatch();
  const [filter, setFilter] = useState("7 Days");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const { analytics, analyticsRefreshing, analyticsLastUpdated, loading } = useSelector(
    (state) => state.user
  );

  useEffect(() => {
    const refresh = () => {
      dispatch(getAnalytics(rangeMap[filter] || "7d"));
      dispatch(getStats());
    };
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [dispatch, filter]);

  const cards = useMemo(
    () => [
      { label: "Total Revenue", value: analytics?.totalRevenue || 0, money: true, icon: <FaRupeeSign />, trend: 18.4, accent: "emerald" },
      { label: "Today Revenue", value: analytics?.todayRevenue || 0, money: true, icon: <FaCalendarAlt />, trend: 9.7, accent: "blue" },
      { label: "Weekly Revenue", value: analytics?.weeklyRevenue || 0, money: true, icon: <FaClock />, trend: 14.2, accent: "cyan" },
      { label: "Monthly Growth", value: analytics?.monthlyRevenue || 0, money: true, icon: <FaArrowUp />, trend: 22.8, accent: "emerald" },
      { label: "Yearly Revenue", value: analytics?.yearlyRevenue || 0, money: true, icon: <FaRupeeSign />, trend: 31.6, accent: "blue" },
      { label: "Total Appointments", value: analytics?.totalAppointments || 0, icon: <FaCalendarAlt />, trend: 12.5, accent: "cyan" },
      { label: "Completed", value: analytics?.completedAppointments || 0, icon: <FaCheckCircle />, trend: 8.2, accent: "emerald" },
      { label: "Pending", value: analytics?.pendingAppointments || 0, icon: <FaClock />, trend: -3.4, accent: "amber" },
      { label: "Cancelled", value: analytics?.cancelledAppointments || 0, icon: <FaTimesCircle />, trend: -6.1, accent: "rose" },
      { label: "Missed Appointment", value: analytics?.missedAppointments || 0, icon: <FaTimesCircle />, trend: -2.3, accent: "rose" },
    ],
    [analytics]
  );

  const revenueChart = analytics?.revenueChart?.length
    ? analytics.revenueChart
    : [
        { label: "Mon", revenue: 2400 },
        { label: "Tue", revenue: 3600 },
        { label: "Wed", revenue: 3100 },
        { label: "Thu", revenue: 5200 },
        { label: "Fri", revenue: 4700 },
        { label: "Sat", revenue: 6400 },
        { label: "Sun", revenue: 5900 },
      ];

  const appointmentGrowth = analytics?.appointmentGrowth?.length
    ? analytics.appointmentGrowth
    : revenueChart.map((item, index) => ({ label: item.label, appointments: 8 + index * 3 }));

  const departments = [
    { label: "Cardiology", value: analytics?.weeklyRevenue || 48000, percent: 86 },
    { label: "Pediatrics", value: analytics?.todayRevenue || 22000, percent: 62 },
    { label: "Dermatology", value: 18000, percent: 48 },
    { label: "Dental Care", value: 15000, percent: 41 },
  ];

  const topDoctors = analytics?.doctorPerformance?.length
    ? analytics.doctorPerformance.slice(0, 5)
    : [];
  const maxDoctorRevenue = Math.max(
    ...topDoctors.map((doctor) => Number(doctor.revenue || 0)),
    1
  );
  const topBookedDoctors = analytics?.doctorPerformance?.length
    ? [...analytics.doctorPerformance]
        .sort((a, b) => Number(b.appointments || 0) - Number(a.appointments || 0))
        .slice(0, 5)
    : [];
  const maxBookedAppointments = Math.max(
    ...topBookedDoctors.map((doctor) => Number(doctor.appointments || 0)),
    1
  );

  const transactions = [
    { label: "Payment received", meta: "Appointment #A1024", amount: 900, tone: "success" },
    { label: "Appointment booked", meta: "New cardiology visit", amount: 700, tone: "success" },
    { label: "Refund processed", meta: "Cancelled dental consult", amount: -500, tone: "warning" },
    { label: "Payment received", meta: "Online video consult", amount: 650, tone: "success" },
  ];

  const liveUpdates = [
    { icon: <FaCalendarAlt />, text: "Appointment booked", time: "Just now" },
    { icon: <FaCreditCard />, text: "Payment received", time: "2m ago" },
    { icon: <FaUndo />, text: "Refund processed", time: "8m ago" },
    { icon: <FaUserPlus />, text: "New patient joined", time: "12m ago" },
  ];

  const lastSync = analyticsLastUpdated
    ? new Date(analyticsLastUpdated).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "syncing";

  return (
    <Layout>
      <section className="page-intro earnings-hero">
        <div>
          <span className="eyebrow">Earnings analytics</span>
          <h2>Financial performance and appointment analytics</h2>
          <p>Revenue, booking health, doctor performance, and patient payment activity in one clean workspace.</p>
        </div>
        <div className="analytics-live-stack">
          <div className={`live-sync-pill ${analyticsRefreshing ? "refreshing" : ""}`}>
            <FaSyncAlt />
            <span>{analyticsRefreshing ? "Refreshing" : "Live sync"}</span>
            <strong>{lastSync}</strong>
          </div>
          <div className="segmented-control">
            {Object.keys(rangeMap).map((item) => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {filter === "Custom Range" && (
            <div className="custom-range-row">
              <input type="date" value={customRange.from} onChange={(e) => setCustomRange((value) => ({ ...value, from: e.target.value }))} />
              <input type="date" value={customRange.to} onChange={(e) => setCustomRange((value) => ({ ...value, to: e.target.value }))} />
            </div>
          )}
        </div>
      </section>

      {loading && !analytics ? (
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="metric-grid earnings-metric-grid">
            {cards.map((card) => (
              <article className={`metric-card live-metric-card ${card.accent}`} key={card.label}>
                <div className="metric-icon">{card.icon}</div>
                <p>{card.label}</p>
                <strong>
                  <CountUpValue value={card.value} formatter={card.money ? currency : (value) => value.toLocaleString("en-IN")} />
                </strong>
                <span className={`trend-badge ${card.trend >= 0 ? "up" : "down"}`}>
                  {card.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                  {card.trend >= 0 ? "+" : ""}{card.trend}% this week
                </span>
                <Sparkline points={revenueChart} dataKey="revenue" />
              </article>
            ))}
          </div>

          <div className="earnings-insight-row">
            <article className="panel-card earnings-summary-card">
              <span>Weekly revenue</span>
              <strong>{currency(analytics?.weeklyRevenue || 0)}</strong>
              <p><FaArrowUp /> +18.4% compared with previous week</p>
            </article>
            <article className="panel-card earnings-summary-card">
              <span>Monthly growth</span>
              <strong>{currency(analytics?.monthlyRevenue || 0)}</strong>
              <p><FaArrowUp /> +22.8% patient booking value</p>
            </article>
            <article className="panel-card earnings-summary-card">
              <span>Peak booking time</span>
              <strong>6 PM - 8 PM</strong>
              <p><FaFire /> Highest conversion window today</p>
            </article>
          </div>

          <div className="analytics-grid premium-analytics-grid">
            <article className="panel-card wide premium-chart-card">
              <div className="panel-heading">
                <h3>Revenue Trend</h3>
                <span>{filter}</span>
              </div>
              <SmoothChart
                data={revenueChart}
                dataKey="revenue"
                formatValue={currency}
              />
            </article>

            <article className="panel-card premium-chart-card">
              <div className="panel-heading">
                <h3>Appointment Growth</h3>
                <span>7 day velocity</span>
              </div>
              <SmoothChart
                data={appointmentGrowth}
                dataKey="appointments"
              />
            </article>

            <article className="panel-card performance-panel revenue-doctor-panel">
              <div className="panel-heading">
                <h3><FaTrophy /> Top Revenue Generating Doctors</h3>
                <span>Real MongoDB data</span>
              </div>
              <div className="revenue-doctor-list">
                {topDoctors.length ? (
                  topDoctors.map((doctor, index) => {
                    const revenue = Number(doctor.revenue || 0);
                    const progress = Math.max((revenue / maxDoctorRevenue) * 100, revenue ? 8 : 0);
                    const image = getImageSrc(doctor.image);
                    return (
                      <div className="revenue-doctor-row" key={doctor._id || doctor.label}>
                        <div className="revenue-doctor-rank">
                          {index === 0 ? <FaTrophy /> : String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="revenue-doctor-avatar">
                          {image ? (
                            <img src={image} alt={doctor.name || doctor.label} width={54} height={54} loading="lazy" decoding="async" />
                          ) : (
                            <FaStethoscope />
                          )}
                        </div>
                        <div className="revenue-doctor-main">
                          <div className="revenue-doctor-title">
                            <div>
                              <strong>{doctor.name || doctor.label}</strong>
                              <small>{doctor.speciality || "Specialist"}</small>
                            </div>
                            <em>{currency(revenue)}</em>
                          </div>
                          <i className="revenue-doctor-progress" aria-hidden="true">
                            <b style={{ width: `${progress}%` }} />
                          </i>
                          <div className="revenue-doctor-metrics">
                            <span>{Number(doctor.totalAppointments || doctor.appointments || 0).toLocaleString("en-IN")} appts</span>
                            <span>{Number(doctor.completionRate || 0).toFixed(1)}% complete</span>
                            <span><FaStar /> {Number(doctor.rating || 0).toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">No Data Available</div>
                )}
              </div>
            </article>

            <article className="panel-card wide premium-chart-card top-booked-panel">
              <div className="panel-heading">
                <h3>Top 5 Most Booked Doctors</h3>
                <span>Real appointment volume</span>
              </div>
              {topBookedDoctors.length ? (
                <div className="top-booked-doctors">
                  {topBookedDoctors.map((doctor, index) => {
                    const appointments = Number(doctor.appointments || 0);
                    const percent = Math.max((appointments / maxBookedAppointments) * 100, 6);
                    return (
                      <div className="top-booked-row" key={`${doctor.label}-${index}`}>
                        <span className="top-booked-rank">
                          {index === 0 ? <FaTrophy /> : String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="top-booked-info">
                          <div>
                            <strong>{doctor.label}</strong>
                            <small>{currency(doctor.revenue)} revenue</small>
                          </div>
                          <i aria-hidden="true">
                            <b style={{ width: `${percent}%` }} />
                          </i>
                        </div>
                        <em>{appointments.toLocaleString("en-IN")} bookings</em>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state top-booked-empty">No Data Available</div>
              )}
            </article>
          </div>

          <div className="earnings-detail-grid">
            <article className="panel-card department-panel">
              <div className="panel-heading">
                <h3>Revenue By Department</h3>
                <span>Top services</span>
              </div>
              <div className="department-list">
                {departments.map((item) => (
                  <div className="department-row" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{currency(item.value)}</span>
                    </div>
                    <i><b style={{ width: `${item.percent}%` }} /></i>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card specialization-panel">
              <div className="panel-heading">
                <h3>Most Booked Specialization</h3>
                <span>Current leader</span>
              </div>
              <div className="specialization-hero">
                <FaStethoscope />
                <strong>Cardiology</strong>
                <p>42 bookings and {currency(analytics?.weeklyRevenue || 42000)} revenue this week.</p>
              </div>
            </article>

            <article className="panel-card transactions-panel">
              <div className="panel-heading">
                <h3>Recent Transactions</h3>
                <span>Payment feed</span>
              </div>
              <div className="transaction-list">
                {transactions.map((item) => (
                  <div className={`transaction-row ${item.tone}`} key={`${item.label}-${item.meta}`}>
                    <FaReceipt />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.meta}</span>
                    </div>
                    <em>{item.amount < 0 ? "-" : "+"}{currency(Math.abs(item.amount))}</em>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card live-activity-panel">
              <div className="panel-heading">
                <h3>Live Activity</h3>
                <span>Real-time updates</span>
              </div>
              <div className="earnings-live-list">
                {liveUpdates.map((item) => (
                  <div className="earnings-live-row" key={`${item.text}-${item.time}`}>
                    <span className="live-dot" />
                    <i>{item.icon}</i>
                    <div>
                      <strong>{item.text}</strong>
                      <small>{item.time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      )}
    </Layout>
  );
};

export default EarningsDashboard;
