import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import toast from "../utils/notify";
import API from "../Api/API";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  FaHeadset,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaReply,
  FaTrash,
  FaEnvelope,
  FaPhone,
  FaUser,
  FaTag,
  FaTimes,
  FaPaperPlane,
  FaTicketAlt,
  FaCheck,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

const formatDateTime = (val) => {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case "Open":
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
    case "In Progress":
      return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
    case "Resolved":
      return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
    case "Closed":
      return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
    default:
      return { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
  }
};

const getPriorityBadgeClass = (priority) => {
  switch (priority) {
    case "Urgent":
      return { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" };
    case "High":
      return { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" };
    case "Medium":
      return { bg: "#fef9c3", text: "#854d0e", border: "#fef08a" };
    case "Low":
      return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    default:
      return { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
  }
};

const QUICK_REPLIES = [
  "Thank you for contacting HealPoint Support. We have investigated and resolved your issue.",
  "We are currently reviewing your request with the hospital administration team.",
  "Your appointment records have been verified and updated in our system.",
  "Please provide additional details or a screenshot so our technical team can assist you better.",
];

const SupportManagement = () => {
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    unread: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter]);

  const totalPages = Math.ceil(tickets.length / PAGE_SIZE) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tickets.slice(start, start + PAGE_SIZE);
  }, [tickets, currentPage]);

  // Selection & Modals
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("Resolved");
  const [replyPriority, setReplyPriority] = useState("Medium");
  const [submittingReply, setSubmittingReply] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/webmessage/get-all", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
        },
      });

      if (res.data?.success) {
        setTickets(res.data.webMessages || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Unable to load support tickets.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.adminReply || "");
    setReplyStatus(ticket.status === "Closed" ? "Closed" : "Resolved");
    setReplyPriority(ticket.priority || "Medium");

    // If unread, mark as read
    if (!ticket.isRead) {
      API.patch(`/webmessage/read/${ticket._id}`, { isRead: true })
        .then(() => {
          setTickets((prev) =>
            prev.map((t) =>
              t._id === ticket._id ? { ...t, isRead: true } : t,
            ),
          );
          setCounts((prev) => ({
            ...prev,
            unread: Math.max(0, prev.unread - 1),
          }));
        })
        .catch(() => {});
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!replyText.trim()) {
      return toast.error("Please enter a reply message.");
    }

    setSubmittingReply(true);
    try {
      const res = await API.patch(`/webmessage/reply/${selectedTicket._id}`, {
        adminReply: replyText.trim(),
        status: replyStatus,
      });

      // Also update priority if changed
      if (replyPriority !== selectedTicket.priority) {
        await API.patch(`/webmessage/status/${selectedTicket._id}`, {
          priority: replyPriority,
        });
      }

      toast.success("Reply recorded and ticket updated.");
      setSelectedTicket(null);
      loadTickets();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to submit ticket reply.",
      );
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleQuickStatusChange = async (ticketId, newStatus) => {
    try {
      await API.patch(`/webmessage/status/${ticketId}`, { status: newStatus });
      toast.success(`Ticket marked as ${newStatus}.`);
      setTickets((prev) =>
        prev.map((t) => (t._id === ticketId ? { ...t, status: newStatus } : t)),
      );
      loadTickets();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update ticket status.",
      );
    }
  };

  const handleDeleteTicket = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`/webmessage/delete/${deleteTarget._id}`);
      toast.success("Support ticket deleted successfully.");
      setDeleteTarget(null);
      if (selectedTicket?._id === deleteTarget._id) {
        setSelectedTicket(null);
      }
      loadTickets();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to delete support ticket.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Support & Escalations</span>
          <h2>Help Desk & Ticket Management</h2>
          <p>
            Review inquiries, address patient & doctor complaints, and manage
            support tickets with audit tracking.
          </p>
        </div>
      </section>

      {/* Summary KPI Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            padding: "18px 20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: "600" }}
          >
            Total Inquiries
          </span>
          <strong
            style={{ fontSize: "1.6rem", color: "#0f172a", marginTop: "4px" }}
          >
            {counts.total || 0}
          </strong>
          <small
            style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "2px" }}
          >
            All lifetime tickets
          </small>
        </div>

        <div
          style={{
            background: "#eff6ff",
            padding: "18px 20px",
            borderRadius: "14px",
            border: "1px solid #bfdbfe",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{ fontSize: "0.82rem", color: "#1d4ed8", fontWeight: "600" }}
          >
            Open Tickets
          </span>
          <strong
            style={{ fontSize: "1.6rem", color: "#1e40af", marginTop: "4px" }}
          >
            {counts.open || 0}
          </strong>
          <small
            style={{ color: "#60a5fa", fontSize: "0.75rem", marginTop: "2px" }}
          >
            Awaiting response
          </small>
        </div>

        <div
          style={{
            background: "#fffbeb",
            padding: "18px 20px",
            borderRadius: "14px",
            border: "1px solid #fde68a",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{ fontSize: "0.82rem", color: "#b45309", fontWeight: "600" }}
          >
            In Progress
          </span>
          <strong
            style={{ fontSize: "1.6rem", color: "#92400e", marginTop: "4px" }}
          >
            {counts.inProgress || 0}
          </strong>
          <small
            style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: "2px" }}
          >
            Currently being addressed
          </small>
        </div>

        <div
          style={{
            background: "#ecfdf5",
            padding: "18px 20px",
            borderRadius: "14px",
            border: "1px solid #a7f3d0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{ fontSize: "0.82rem", color: "#047857", fontWeight: "600" }}
          >
            Resolved
          </span>
          <strong
            style={{ fontSize: "1.6rem", color: "#065f46", marginTop: "4px" }}
          >
            {counts.resolved || 0}
          </strong>
          <small
            style={{ color: "#10b981", fontSize: "0.75rem", marginTop: "2px" }}
          >
            Satisfactorily completed
          </small>
        </div>

        <div
          style={{
            background: "#f1f5f9",
            padding: "18px 20px",
            borderRadius: "14px",
            border: "1px solid #cbd5e1",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{ fontSize: "0.82rem", color: "#475569", fontWeight: "600" }}
          >
            Unread
          </span>
          <strong
            style={{ fontSize: "1.6rem", color: "#334155", marginTop: "4px" }}
          >
            {counts.unread || 0}
          </strong>
          <small
            style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "2px" }}
          >
            New messages
          </small>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="table-toolbar">
        <div
          className="search-filter-row"
          style={{ flexWrap: "wrap", gap: "12px" }}
        >
          <div
            className="search-input-wrapper"
            style={{ position: "relative", minWidth: "280px" }}
          >
            <input
              type="text"
              className="table-filter-input"
              placeholder="Search by sender, email, subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px" }}
            />
            <FaSearch
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
          </div>

          <select
            className="table-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            className="table-filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>

          {(search || statusFilter !== "all" || priorityFilter !== "all") && (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
            >
              Reset Filters
            </button>
          )}

          <span className="table-count" style={{ marginLeft: "auto" }}>
            Showing <strong>{tickets.length}</strong> tickets
          </span>
        </div>
      </div>

      {/* Main Tickets List */}
      {loading ? (
        <div
          className="loading-state"
          style={{ padding: "48px 0", textAlign: "center" }}
        >
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ marginBottom: "12px" }}
          />
          <p>Loading support tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: "54px 24px",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: "14px",
            border: "1px dashed #cbd5e1",
            margin: "20px 0",
          }}
        >
          <FaHeadset
            style={{ fontSize: "3rem", color: "#94a3b8", marginBottom: "14px" }}
          />
          <h3 style={{ color: "#0f172a", marginBottom: "6px" }}>
            No support tickets found
          </h3>
          <p
            style={{
              color: "#64748b",
              maxWidth: "440px",
              margin: "0 auto 16px",
            }}
          >
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No tickets match your filter criteria. Try clearing search or filters."
              : "All patient and doctor support queries have been handled. Outstanding issues will appear here."}
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            {paginatedTickets.map((ticket) => {
              const statusStyle = getStatusBadgeClass(ticket.status || "Open");
              const priorityStyle = getPriorityBadgeClass(
                ticket.priority || "Medium",
              );

              return (
                <div
                  key={ticket._id}
                  style={{
                    background: ticket.isRead ? "#ffffff" : "#f0fdf4",
                    border: ticket.isRead
                      ? "1px solid #e2e8f0"
                      : "1px solid #86efac",
                    borderRadius: "14px",
                    padding: "18px 22px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                >
                  {/* Header Row: ID, Badges, Date */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.82rem",
                          color: "#64748b",
                          background: "#f1f5f9",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontWeight: "600",
                        }}
                      >
                        #{ticket._id.slice(-6).toUpperCase()}
                      </span>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          border: `1px solid ${statusStyle.border}`,
                        }}
                      >
                        {ticket.status || "Open"}
                      </span>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: priorityStyle.bg,
                          color: priorityStyle.text,
                          border: `1px solid ${priorityStyle.border}`,
                        }}
                      >
                        {ticket.priority || "Medium"} Priority
                      </span>

                      {!ticket.isRead && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: "700",
                            color: "#16a34a",
                            background: "#dcfce7",
                            padding: "2px 8px",
                            borderRadius: "10px",
                          }}
                        >
                          ● New
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaClock /> {formatDateTime(ticket.createdAt)}
                    </div>
                  </div>

                  {/* Sender Info & Subject */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "280px" }}>
                      <h4
                        style={{
                          margin: "0 0 6px",
                          fontSize: "1.05rem",
                          color: "#0f172a",
                          cursor: "pointer",
                        }}
                        onClick={() => openTicketDetail(ticket)}
                      >
                        {ticket.subject || "No Subject Provided"}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          color: "#475569",
                          fontSize: "0.9rem",
                          lineHeight: "1.5",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {ticket.message}
                      </p>
                    </div>

                    <div
                      style={{
                        minWidth: "220px",
                        background: "#f8fafc",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.82rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "700",
                          color: "#0f172a",
                          marginBottom: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaUser style={{ color: "#0d9488" }} />{" "}
                        {ticket.name || "Anonymous"}
                      </div>
                      {ticket.email && (
                        <div
                          style={{
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "2px",
                          }}
                        >
                          <FaEnvelope style={{ fontSize: "0.75rem" }} />{" "}
                          {ticket.email}
                        </div>
                      )}
                      {(ticket.phone || ticket.contact) && (
                        <div
                          style={{
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <FaPhone style={{ fontSize: "0.75rem" }} />{" "}
                          {ticket.phone || ticket.contact}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Reply Snippet (if exists) */}
                  {ticket.adminReply && (
                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "0.85rem",
                        color: "#166534",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <FaReply
                        style={{
                          marginTop: "3px",
                          flexShrink: 0,
                          color: "#16a34a",
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong>Admin Reply:</strong> {ticket.adminReply}
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#15803d",
                            marginTop: "2px",
                          }}
                        >
                          Replied{" "}
                          {ticket.repliedAt
                            ? formatDateTime(ticket.repliedAt)
                            : ""}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "10px",
                      marginTop: "4px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        Quick Status:
                      </span>
                      {STATUS_OPTIONS.map((st) => (
                        <button
                          key={st}
                          type="button"
                          className="btn btn-light btn-sm"
                          onClick={() =>
                            handleQuickStatusChange(ticket._id, st)
                          }
                          disabled={ticket.status === st}
                          style={{
                            padding: "2px 8px",
                            fontSize: "0.75rem",
                            fontWeight: ticket.status === st ? "700" : "normal",
                            background:
                              ticket.status === st ? "#e2e8f0" : undefined,
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openTicketDetail(ticket)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaReply /> View & Reply
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(ticket)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div
              className="pagination-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(currentPage * PAGE_SIZE, tickets.length)} of{" "}
                {tickets.length} tickets
              </span>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaChevronLeft /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (num) => (
                    <button
                      type="button"
                      key={num}
                      className={`btn btn-sm ${num === currentPage ? "btn-primary" : "btn-light"}`}
                      onClick={() => setCurrentPage(num)}
                      style={{ minWidth: "32px", padding: "4px 8px" }}
                    >
                      {num}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Ticket Reply & Detail Modal */}
      {selectedTicket && (
        <div
          className="app-confirm-backdrop"
          role="presentation"
          onClick={() => setSelectedTicket(null)}
          style={{
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="app-confirm-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "28px",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    color: "#64748b",
                    background: "#f1f5f9",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontWeight: "600",
                  }}
                >
                  Ticket #{selectedTicket._id.slice(-8).toUpperCase()}
                </span>
                <h3
                  style={{
                    margin: "8px 0 4px",
                    fontSize: "1.25rem",
                    color: "#0f172a",
                  }}
                >
                  {selectedTicket.subject || "Support Inquiry"}
                </h3>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Received {formatDateTime(selectedTicket.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setSelectedTicket(null)}
                style={{
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  padding: 0,
                }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Sender Details Box */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                background: "#f8fafc",
                padding: "14px 18px",
                borderRadius: "12px",
                marginBottom: "20px",
                fontSize: "0.88rem",
              }}
            >
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "block",
                    fontSize: "0.78rem",
                  }}
                >
                  Sender Name
                </span>
                <strong>{selectedTicket.name}</strong>
              </div>
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "block",
                    fontSize: "0.78rem",
                  }}
                >
                  Email Address
                </span>
                <strong>{selectedTicket.email || "—"}</strong>
              </div>
              <div>
                <span
                  style={{
                    color: "#64748b",
                    display: "block",
                    fontSize: "0.78rem",
                  }}
                >
                  Contact Phone
                </span>
                <strong>
                  {selectedTicket.phone || selectedTicket.contact || "—"}
                </strong>
              </div>
            </div>

            {/* Inquirer's Message */}
            <div style={{ marginBottom: "24px" }}>
              <h5
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.95rem",
                  color: "#334155",
                }}
              >
                Patient / User Message
              </h5>
              <div
                style={{
                  background: "#f1f5f9",
                  padding: "16px",
                  borderRadius: "12px",
                  fontSize: "0.92rem",
                  color: "#1e293b",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedTicket.message}
              </div>
            </div>

            {/* Previous Admin Reply if exists */}
            {selectedTicket.adminReply && (
              <div style={{ marginBottom: "24px" }}>
                <h5
                  style={{
                    margin: "0 0 8px",
                    fontSize: "0.95rem",
                    color: "#166534",
                  }}
                >
                  Previous Response on Record
                </h5>
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    fontSize: "0.9rem",
                    color: "#065f46",
                    lineHeight: "1.5",
                  }}
                >
                  {selectedTicket.adminReply}
                  {selectedTicket.repliedAt && (
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "#047857",
                        marginTop: "6px",
                      }}
                    >
                      Logged at {formatDateTime(selectedTicket.repliedAt)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reply Form */}
            <form onSubmit={handleSendReply}>
              <h5
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.95rem",
                  color: "#0f172a",
                }}
              >
                Send Reply & Update Ticket
              </h5>

              {/* Status & Priority Selectors */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <label
                    className="label"
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "0.82rem",
                    }}
                  >
                    Resolution Status
                  </label>
                  <select
                    className="table-filter-select"
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="label"
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "0.82rem",
                    }}
                  >
                    Priority Flag
                  </label>
                  <select
                    className="table-filter-select"
                    value={replyPriority}
                    onChange={(e) => setReplyPriority(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p} Priority
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Reply Chips */}
              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "#64748b",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Quick Response Templates:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {QUICK_REPLIES.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={() => setReplyText(template)}
                      style={{
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        textAlign: "left",
                      }}
                    >
                      {template.slice(0, 42)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Textarea */}
              <div style={{ marginBottom: "20px" }}>
                <textarea
                  className="table-filter-input"
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your official response to the patient/doctor..."
                  style={{ width: "100%", resize: "vertical", padding: "12px" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setSelectedTicket(null)}
                  disabled={submittingReply}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReply || !replyText.trim()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FaPaperPlane />{" "}
                  {submittingReply ? "Submitting..." : "Send Response & Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Support Ticket"
        message={`Are you sure you want to permanently delete ticket #${deleteTarget?._id.slice(-6).toUpperCase()} from "${deleteTarget?.name}"?`}
        details="This action will remove the entire communication thread from the database."
        confirmLabel="Delete Ticket"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTicket}
        loading={deleting}
      />
    </Layout>
  );
};

export default SupportManagement;
