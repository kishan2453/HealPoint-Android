import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaCommentDots,
  FaSyncAlt,
  FaExclamationCircle,
} from "react-icons/fa";

export default function DoctorTasksView({ doctor }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentText, setCommentText] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await api.get(`/tasks?${params.toString()}`);
      if (res.data?.success) {
        setTasks(res.data.tasks || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load assigned tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Task status updated to ${newStatus}`);
        fetchTasks();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update task status");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTask) return;
    try {
      const res = await api.post(`/tasks/${selectedTask._id}/comments`, {
        text: commentText,
      });
      if (res.data?.success) {
        toast.success("Note added to task");
        setCommentText("");
        setSelectedTask(res.data.task);
        fetchTasks();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post comment");
    }
  };

  return (
    <div className="dp-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10, color: "#1e293b" }}>
            <FaTasks style={{ color: "#2563eb" }} /> Clinical & Operational Tasks
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0 0" }}>
            Tasks assigned to your schedule, department handovers, and patient follow-up protocols.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
          >
            <option value="all">All Tasks</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <button
            onClick={fetchTasks}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}
            title="Refresh"
          >
            <FaSyncAlt />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
          <FaCheckCircle style={{ fontSize: 36, color: "#10b981", marginBottom: 8 }} />
          <p style={{ fontWeight: 600, color: "#334155" }}>No active tasks assigned to you right now.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {tasks.map((t) => {
            const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed";
            return (
              <div
                key={t._id}
                style={{
                  border: isOverdue ? "1px solid #fecaca" : "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                  background: isOverdue ? "#fff5f5" : "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: 100, background: "#eff6ff", color: "#2563eb" }}>
                      {t.department}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: t.priority === "urgent" ? "#dc2626" : "#475569" }}>
                      {t.priority}
                    </span>
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px 0", color: "#0f172a" }}>{t.title}</h4>
                  {t.description && (
                    <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px 0" }}>{t.description}</p>
                  )}
                  <div style={{ fontSize: 12, color: isOverdue ? "#dc2626" : "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaClock style={{ fontSize: 11 }} />
                    <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                    {isOverdue && <span style={{ fontWeight: 700 }}>(Overdue)</span>}
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <select
                    value={t.status}
                    onChange={(e) => handleUpdateStatus(t._id, e.target.value)}
                    style={{ fontSize: 12, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                  >
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>

                  <button
                    onClick={() => setSelectedTask(t)}
                    style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <FaCommentDots /> Notes ({t.comments?.length || 0})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comment Modal */}
      {selectedTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, maxWidth: 480, width: "100%", padding: 20, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedTask.title}</h3>
              <button onClick={() => setSelectedTask(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>&times;</button>
            </div>

            <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
              {selectedTask.comments?.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "20px 0" }}>No notes logged yet.</p>
              ) : (
                selectedTask.comments?.map((c, i) => (
                  <div key={i} style={{ background: "#f8fafc", padding: 8, borderRadius: 8, marginBottom: 8, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: "#334155" }}>{c.authorName} ({c.authorRole})</div>
                    <div style={{ color: "#475569", marginTop: 2 }}>{c.text}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Add clinical or operational comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
              />
              <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
