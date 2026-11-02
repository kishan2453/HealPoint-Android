import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaTasks,
  FaPlus,
  FaCheckCircle,
  FaExclamationCircle,
  FaClock,
  FaFilter,
  FaCommentDots,
  FaUserCheck,
  FaSyncAlt,
} from "react-icons/fa";

export default function TaskManagement() {
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskForComment, setSelectedTaskForComment] = useState(null);
  const [commentText, setCommentText] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "Operations",
    priority: "medium",
    dueDate: "",
    assigneeName: "",
    assigneeRole: "staff",
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (overdueOnly) params.set("overdueOnly", "true");

      const [resTasks, resAnalytics] = await Promise.all([
        api.get(`/tasks?${params.toString()}`),
        api.get(`/tasks/analytics/workload`),
      ]);

      if (resTasks.data?.success) {
        setTasks(resTasks.data.tasks || []);
      }
      if (resAnalytics.data?.success) {
        setAnalytics(resAnalytics.data.stats || null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load operational tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter, overdueOnly]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Task status updated to ${newStatus}`);
        fetchTasks();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/tasks/${selectedTaskForComment._id}/comments`, {
        text: commentText,
      });
      if (res.data?.success) {
        toast.success("Comment added");
        setCommentText("");
        setSelectedTaskForComment(res.data.task);
        fetchTasks();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post comment");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        department: formData.department,
        priority: formData.priority,
        dueDate: formData.dueDate,
        assignedTo: {
          id: "staff-assigned",
          name: formData.assigneeName || "Operations Team",
          role: formData.assigneeRole,
        },
      };

      const res = await api.post("/tasks", payload);
      if (res.data?.success) {
        toast.success("Task assigned successfully");
        setShowCreateModal(false);
        setFormData({
          title: "",
          description: "",
          department: "Operations",
          priority: "medium",
          dueDate: "",
          assigneeName: "",
          assigneeRole: "staff",
        });
        fetchTasks();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create task");
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "medium":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaTasks className="text-blue-600" /> Advanced Task & Work Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track departmental workload, assign operational tasks, and monitor deadlines across hospital teams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTasks}
            className="p-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <FaSyncAlt />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow"
          >
            <FaPlus /> Assign New Task
          </button>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Total Tasks</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.total || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-blue-600 font-medium">In Progress</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {(analytics.inProgress || 0) + (analytics.assigned || 0)}
            </p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <FaExclamationCircle /> Overdue
            </span>
            <p className="text-2xl font-bold text-red-600 mt-1">{analytics.overdue || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <span className="text-xs text-green-600 font-medium">Completed</span>
            <p className="text-2xl font-bold text-green-600 mt-1">{analytics.completed || 0}</p>
          </div>
          <div className="bg-white border rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
            <span className="text-xs text-amber-600 font-medium">Urgent / High</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {(analytics.priorityBreakdown?.urgent || 0) + (analytics.priorityBreakdown?.high || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border rounded-xl shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-gray-500 font-semibold">
            <FaFilter /> Filters:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Under Review">Under Review</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded text-blue-600"
            />
            Show Overdue Only
          </label>
        </div>
        <span className="text-gray-400 font-medium">{tasks.length} tasks matched</span>
      </div>

      {/* Tasks Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] border-b">
              <tr>
                <th className="p-3.5">Task Title & Details</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Assigned To</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">
                    No operational tasks found matching criteria.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed";
                  return (
                    <tr key={t._id} className="hover:bg-gray-50">
                      <td className="p-3.5">
                        <p className="font-bold text-gray-900 text-sm">{t.title}</p>
                        {t.description && (
                          <p className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-gray-700">{t.department}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="flex items-center gap-1 font-medium text-gray-800">
                          <FaUserCheck className="text-gray-400" />
                          {t.assignedTo?.name || "Unassigned"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`font-semibold flex items-center gap-1 ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
                          <FaClock className="text-[10px]" />
                          {new Date(t.dueDate).toLocaleDateString()}
                          {isOverdue && <span className="text-[10px] bg-red-100 px-1 rounded">Overdue</span>}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t._id, e.target.value)}
                          className="border rounded p-1 text-[11px] font-semibold bg-gray-50"
                        >
                          <option value="New">New</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => setSelectedTaskForComment(t)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                        >
                          <FaCommentDots />
                          Comments ({t.comments?.length || 0})
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Comments Modal */}
      {selectedTaskForComment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedTaskForComment.title}</h3>
                <p className="text-xs text-gray-500">Internal Task Discussion</p>
              </div>
              <button
                onClick={() => setSelectedTaskForComment(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2.5 text-xs pr-1">
              {selectedTaskForComment.comments?.length === 0 ? (
                <p className="text-gray-400 italic py-4 text-center">No internal comments logged yet.</p>
              ) : (
                selectedTaskForComment.comments?.map((c, i) => (
                  <div key={i} className="bg-gray-50 p-2.5 rounded-lg border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-gray-800">{c.authorName} ({c.authorRole})</span>
                      <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-gray-600">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t text-xs">
              <input
                type="text"
                required
                placeholder="Add an internal operational note..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Assign Operational Task</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect Ultrasound Probe Sensor"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Description / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Detailed instructions for the assigned staff member..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full border rounded-lg p-2.5 bg-white text-xs"
                  >
                    <option value="Operations">Operations</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Nursing">Nursing</option>
                    <option value="Facilities">Facilities & Maintenance</option>
                    <option value="Billing">Billing & Desk</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full border rounded-lg p-2.5 bg-white text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Assignee Name</label>
                  <input
                    type="text"
                    placeholder="Staff or Doctor Name"
                    value={formData.assigneeName}
                    onChange={(e) => setFormData({ ...formData, assigneeName: e.target.value })}
                    className="w-full border rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
