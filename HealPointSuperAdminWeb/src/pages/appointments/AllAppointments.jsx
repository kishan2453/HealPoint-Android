import React, { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { getAllAppointments } from "../../redux/actions/appointmentAction";
import { FaDownload, FaFilePdf, FaSearch, FaTimes } from "react-icons/fa";
import { matchesSearchText } from "../../utils/searchUtils";
import PremiumSelect from "../../components/common/PremiumSelect";
import { getAppointmentDisplayId } from "../../utils/appointmentDisplayId";
import { subscribeAdminSync } from "../../services/socket";

const statusLabels = {
  all: "All Status",
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancel: "Cancelled",
  rescheduled: "Rescheduled",
  missed: "Missed Appointment",
};

const cleanCell = (value) =>
  String(value ?? "NA")
    .replace(/\s+/g, " ")
    .trim();

const escapeCsvCell = (value) => `"${cleanCell(value).replace(/"/g, '""')}"`;

const escapeHtmlCell = (value) =>
  cleanCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isTodayValue = (value) => {
  if (!value) return false;

  const today = new Date();
  const parsedDate = new Date(value);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toDateString() === today.toDateString();
  }

  const rawValue = cleanCell(value).toLowerCase();
  const todayTokens = [
    today.toISOString().slice(0, 10),
    today.toLocaleDateString().toLowerCase(),
    today.toLocaleDateString("en-GB").toLowerCase(),
  ];

  return todayTokens.some((token) => rawValue.includes(token));
};

const AllAppointments = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getAllAppointments());

    let debounceTimer = null;
    const unsubscribe = subscribeAdminSync({
      onAppointmentSync: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          dispatch(getAllAppointments());
        }, 400);
      },
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [dispatch]);

  const { appointments } = useSelector((state) => state.appointments);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [smartFilter, setSmartFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 8;

  const applySearch = (event) => {
    event?.preventDefault();
    setSearch((value) => value.trim());
    setPage(1);
  };

  const filteredAppointments = useMemo(() => {
    return (appointments || []).filter((appointment) => {
      const matchesSearch = matchesSearchText(
        [
          appointment?._id,
          getAppointmentDisplayId(appointment),
          appointment?.userId?._id,
          appointment?.userId?.name,
          appointment?.userId?.email,
          appointment?.userId?.phone,
          appointment?.patientPhone,
          appointment?.doctorId?.name,
          appointment?.doctorId?.email,
          appointment?.doctorId?.phone,
          appointment?.doctorId?.speciality,
          appointment?.doctorId?.department,
          appointment?.doctorId?.specialization,
          appointment?.slotDate,
          appointment?.slotTime,
          appointment?.amount,
          appointment?.status,
          appointment?.paymentStatus,
          appointment?.paymentMethod,
        ],
        search,
      );
      const matchesStatus = status === "all" || appointment?.status === status;
      const matchesSmartFilter =
        smartFilter === "all" ||
        (smartFilter === "today" && isTodayValue(appointment?.slotDate)) ||
        (smartFilter === "online" && appointment?.paymentMethod === "online") ||
        (smartFilter === "cash" && appointment?.paymentMethod !== "online");

      return matchesSearch && matchesStatus && matchesSmartFilter;
    });
  }, [appointments, search, smartFilter, status]);

  const paginatedAppointments = filteredAppointments.slice(
    (page - 1) * perPage,
    page * perPage,
  );
  const totalPages = Math.max(
    Math.ceil(filteredAppointments.length / perPage),
    1,
  );
  const hasActiveFilters =
    Boolean(search.trim()) || status !== "all" || smartFilter !== "all";

  const appointmentSmartCounts = useMemo(() => {
    const list = appointments || [];

    return {
      today: list.filter((appointment) => isTodayValue(appointment?.slotDate))
        .length,
      online: list.filter(
        (appointment) => appointment?.paymentMethod === "online",
      ).length,
      cash: list.filter(
        (appointment) => appointment?.paymentMethod !== "online",
      ).length,
      pending: list.filter((appointment) => appointment?.status === "pending")
        .length,
      missed: list.filter((appointment) => appointment?.status === "missed")
        .length,
    };
  }, [appointments]);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSmartFilter("all");
    setPage(1);
  };

  const applySmartFilter = (nextFilter, nextStatus = "all") => {
    setSmartFilter(nextFilter);
    setStatus(nextStatus);
    setPage(1);
  };

  const getExportRows = () => [
    [
      "SNO",
      "Appointment ID",
      "Patient",
      "Email",
      "Doctor",
      "Date",
      "Amount",
      "Status",
      "Payment Method",
      "Payment Status",
    ],
    ...filteredAppointments.map((a, index) => [
      index + 1,
      getAppointmentDisplayId(a),
      a?.userId?.name,
      a?.userId?.email,
      a?.doctorId?.name,
      a?.slotDate,
      a?.amount ? `${a.amount} RS` : "NA",
      a?.status,
      a?.paymentMethod === "online" ? "Online" : "Cash",
      a?.paymentStatus?.replace("_", " "),
    ]),
  ];

  const exportCsv = () => {
    const rows = getExportRows();
    const csv = rows
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = getExportRows();
    const printableRows = rows
      .map(
        (row, index) => `
          <tr>
            ${row.map((cell) => `<${index === 0 ? "th" : "td"}>${escapeHtmlCell(cell)}</${index === 0 ? "th" : "td"}>`).join("")}
          </tr>
        `,
      )
      .join("");
    const reportWindow = window.open("", "_blank", "width=1200,height=800");

    if (!reportWindow) {
      window.print();
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>HealPoint — Appointments Report</title>
          <style>
            * { box-sizing: border-box; }
            body { color: #111827; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 26px; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid #12343b; padding-bottom: 12px; margin-bottom: 14px; }
            .brand h1 { font-size: 22px; margin: 0; color: #12343b; letter-spacing: 0.5px; }
            .brand p { color: #4B5563; margin: 3px 0 0; font-size: 12px; }
            .brand .logo { color: #12343b; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-align: right; text-transform: uppercase; }
            .meta { display: flex; justify-content: space-between; align-items: center; color: #4B5563; font-size: 12px; margin: 0 0 16px; }
            .meta strong { color: #111827; }
            table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th, td { border: 1px solid #CBD5E1; font-size: 11px; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #12343b; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
            tr:nth-child(even) td { background: #F8FAFC; }
            .foot { display: flex; justify-content: space-between; gap: 16px; margin-top: 22px; padding-top: 12px; border-top: 1px solid #CBD5E1; color: #6B7280; font-size: 11px; }
            @page { margin: 14mm; size: landscape; }
          </style>
        </head>
        <body>
          <div class="brand">
            <div>
              <h1>Appointments Report</h1>
              <p>${filteredAppointments.length} appointment(s) exported on ${new Date().toLocaleString()}</p>
            </div>
            <div class="logo">HealPoint<br/>Doctor Appointment Management</div>
          </div>
          <div class="meta"><span>Generated: <strong>${new Date().toLocaleString()}</strong></span><span>Total: <strong>${filteredAppointments.length}</strong></span></div>
          <table>${printableRows}</table>
          <div class="foot"><span>Confidential — for authorised hospital staff only.</span><span>HealPoint · Patient care at its heart</span></div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Appointment operations</span>
          <h2>All Appointments</h2>
          <p>
            Track appointment status, payment state, history, search, filters,
            and exports.
          </p>
        </div>
        <div className="table-actions">
          <button className="btn btn-light" onClick={exportCsv}>
            <FaDownload /> Excel/CSV
          </button>
          <button className="btn btn-light" onClick={exportPdf}>
            <FaFilePdf /> PDF
          </button>
        </div>
      </section>
      <form className="filters-row page-search-row" onSubmit={applySearch}>
        <div className="admin-search grow">
          <FaSearch />
          <input
            placeholder="Search email, patient, phone, appointment ID, patient ID, doctor"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {hasActiveFilters && (
          <button
            className="btn btn-light"
            type="button"
            onClick={clearFilters}
          >
            <FaTimes /> Clear
          </button>
        )}
        <PremiumSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All Status" },
            { value: "pending", label: "Pending" },
            { value: "confirmed", label: "Confirmed" },
            { value: "completed", label: "Completed" },
            { value: "cancel", label: "Cancelled" },
            { value: "rescheduled", label: "Rescheduled" },
            { value: "missed", label: "Missed Appointment" },
          ]}
        />
      </form>
      <div className="search-summary-row">
        <span>
          {filteredAppointments.length} of {(appointments || []).length}{" "}
          appointments
        </span>
        <span>{statusLabels[status]}</span>
        {smartFilter !== "all" && <span>Smart: {smartFilter}</span>}
        {search.trim() && <span>Search: {search.trim()}</span>}
      </div>
      <div className="smart-filter-row" aria-label="Smart appointment filters">
        <button
          className={
            status === "pending" && smartFilter === "all" ? "active" : ""
          }
          type="button"
          onClick={() => applySmartFilter("all", "pending")}
        >
          Pending <span>{appointmentSmartCounts.pending}</span>
        </button>
        <button
          className={
            status === "missed" && smartFilter === "all" ? "active" : ""
          }
          type="button"
          onClick={() => applySmartFilter("all", "missed")}
        >
          Missed <span>{appointmentSmartCounts.missed}</span>
        </button>
        <button
          className={smartFilter === "today" ? "active" : ""}
          type="button"
          onClick={() => applySmartFilter("today")}
        >
          Today <span>{appointmentSmartCounts.today}</span>
        </button>
        <button
          className={smartFilter === "online" ? "active" : ""}
          type="button"
          onClick={() => applySmartFilter("online")}
        >
          Online <span>{appointmentSmartCounts.online}</span>
        </button>
        <button
          className={smartFilter === "cash" ? "active" : ""}
          type="button"
          onClick={() => applySmartFilter("cash")}
        >
          Cash <span>{appointmentSmartCounts.cash}</span>
        </button>
      </div>
      <div className="admin-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>SNO</th>
              <th>ID</th>
              <th>PATIENT</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th>PAYMENT</th>
              <th>Details/Edit</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAppointments?.map((a, i) => (
              <tr key={a?._id || i + 1}>
                <td>{(page - 1) * perPage + i + 1}</td>
                <td>{getAppointmentDisplayId(a)}</td>
                <td>
                  {a?.userId?.name || "NA"}
                  <br />
                  <small>{a?.userId?.email}</small>
                </td>
                <td>{a?.slotDate}</td>
                <td>{a?.amount}/- RS</td>
                <td>
                  <span className={`status-pill ${a?.status}`}>
                    {statusLabels[a?.status] || a?.status}
                  </span>
                </td>
                <td>
                  {a?.paymentMethod === "online" ? "Online" : "Cash"} -{" "}
                  {a?.paymentStatus?.replace("_", " ")}
                </td>
                <td>
                  <Link to={`/appointment-details/${a?._id}`}>
                    More Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filteredAppointments.length && (
        <div className="empty-state">No Results Found</div>
      )}
      <div className="pagination-row">
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
    </Layout>
  );
};

export default AllAppointments;
