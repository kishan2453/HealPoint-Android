import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaHeadset,
  FaExclamationTriangle,
  FaCheckCircle,
  FaUserCheck,
  FaCommentDots,
  FaClock,
  FaUndo,
  FaLevelUpAlt,
  FaSyncAlt,
} from "react-icons/fa";

export default function AdvancedSupport() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalMode, setModalMode] = useState(null); // "assign" | "escalate" | "note" | "reopen"
  const [actionInput, setActionInput] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("TIER_1_SUPPORT");

  const fetchSupportData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/advanced-support/dashboard");
      if (res.data?.success) {
        setStats(res.data.stats || null);
        setTickets(res.data.recentTickets || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load support operations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupportData();
  }, []);

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      if (modalMode === "assign") {
        await api.patch(`/advanced-support/${selectedTicket._id}/assign`, {
          team: selectedTeam,
          assignedToName: actionInput || "Support Desk",
        });
        toast.success("Ticket assigned to team");
      } else if (modalMode === "escalate") {
        await api.patch(`/advanced-support/${selectedTicket._id}/escalate`, {
          reason: actionInput,
          targetTeam: "ESCALATIONS_TEAM",
        });
        toast.success("Ticket escalated to Senior Operations");
      } else if (modalMode === "note") {
        await api.post(`/advanced-support/${selectedTicket._id}/internal-notes`, {
          noteText: actionInput,
        });
        toast.success("Internal note added");
      } else if (modalMode === "reopen") {
        await api.patch(`/advanced-support/${selectedTicket._id}/reopen`, {
          reason: actionInput,
        });
        toast.success("Ticket reopened");
      }

      setModalMode(null);
      setSelectedTicket(null);
      setActionInput("");
      fetchSupportData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaHeadset className="text-blue-600" /> Advanced Support & Complaints Desk
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Centrally manage patient complaints, team assignments, ticket escalations, and resolution analytics.
          </p>
        </div>
        <button
          onClick={fetchSupportData}
          className="p-2 border rounded-lg text-gray-600 hover:bg-gray-50"
          title="Refresh"
        >
          <FaSyncAlt />
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Total Tickets</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-blue-600 font-medium">Open / Assigned</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{(stats.open || 0) + (stats.inProgress || 0)}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <FaLevelUpAlt /> Escalated
            </span>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.escalated || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-green-600 font-medium">Resolved</span>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.resolved || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <FaClock /> Avg Resolution
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.averageResolutionHours || 0} hrs</p>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] border-b">
              <tr>
                <th className="p-3.5">Ticket # & Subject</th>
                <th className="p-3.5">Patient</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Team</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    Loading tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">
                    No support tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="p-3.5">
                      <span className="font-mono text-blue-600 font-bold">{t.ticketNumber}</span>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">{t.subject}</p>
                    </td>
                    <td className="p-3.5 font-medium text-gray-700">{t.patientName || "Anonymous"}</td>
                    <td className="p-3.5">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-gray-700">{t.team || "TIER_1_SUPPORT"}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.priority === "HIGH" || t.priority === "CRITICAL"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          t.status === "ESCALATED"
                            ? "bg-red-100 text-red-700"
                            : t.status === "RESOLVED"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setModalMode("assign");
                            setActionInput("");
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Assign
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setModalMode("escalate");
                            setActionInput("");
                          }}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          Escalate
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setModalMode("note");
                            setActionInput("");
                          }}
                          className="text-gray-600 hover:text-gray-800 font-semibold"
                        >
                          Note
                        </button>
                        {t.status === "RESOLVED" && (
                          <>
                            <span>•</span>
                            <button
                              onClick={() => {
                                setSelectedTicket(t);
                                setModalMode("reopen");
                                actionInput("");
                              }}
                              className="text-amber-600 hover:text-amber-800 font-semibold"
                            >
                              Reopen
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {modalMode && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base uppercase">
                  {modalMode === "assign"
                    ? "Assign Support Team"
                    : modalMode === "escalate"
                    ? "Escalate Complaint"
                    : modalMode === "note"
                    ? "Add Internal Note"
                    : "Reopen Resolved Ticket"}
                </h3>
                <p className="text-xs text-gray-500">Ticket: {selectedTicket.ticketNumber}</p>
              </div>
              <button
                onClick={() => {
                  setModalMode(null);
                  setSelectedTicket(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-3.5 text-xs">
              {modalMode === "assign" && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Target Support Team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="w-full border rounded-lg p-2.5 text-xs bg-white"
                  >
                    <option value="TIER_1_SUPPORT">Tier 1 Support</option>
                    <option value="TIER_2_SUPPORT">Tier 2 Technical Support</option>
                    <option value="CLINICAL_TEAM">Clinical & Medical Team</option>
                    <option value="BILLING_TEAM">Billing & Finance Desk</option>
                    <option value="ESCALATIONS_TEAM">Executive Escalations Team</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {modalMode === "note"
                    ? "Internal Note Body"
                    : modalMode === "escalate"
                    ? "Escalation Reason"
                    : modalMode === "assign"
                    ? "Assigned Agent Name (Optional)"
                    : "Reopening Reason"}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter details..."
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode(null);
                    setSelectedTicket(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
