import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaCogs,
  FaPlay,
  FaPlus,
  FaCheckCircle,
  FaTimesCircle,
  FaHistory,
  FaSyncAlt,
  FaExclamationTriangle,
  FaToggleOn,
  FaToggleOff,
  FaTrash,
} from "react-icons/fa";

export default function WorkflowsAutomation() {
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rules"); // "rules" | "executions"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testingId, setTestingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger: "appointment_booked",
    actionType: "internal_notification",
    actionTitle: "New Appointment Booked",
    actionMessage: "Appointment confirmed for {patientName} on {slotDate} at {slotTime}.",
    conditionField: "status",
    conditionOperator: "equals",
    conditionValue: "confirmed",
  });

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/workflows");
      if (res.data?.success) {
        setWorkflows(res.data.workflows || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const res = await api.get("/workflows/executions?limit=30");
      if (res.data?.success) {
        setExecutions(res.data.executions || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchExecutions();
  }, []);

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/workflows/${id}/toggle`);
      if (res.data?.success) {
        toast.success("Workflow status updated");
        fetchWorkflows();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle workflow");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this workflow?")) return;
    try {
      const res = await api.delete(`/workflows/${id}`);
      if (res.data?.success) {
        toast.success("Workflow deleted");
        fetchWorkflows();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete workflow");
    }
  };

  const handleTestTrigger = async (triggerName) => {
    try {
      setTestingId(triggerName);
      const res = await api.post("/workflows/test-trigger", {
        trigger: triggerName,
        eventData: {
          patientName: "Amitabh Patel",
          slotDate: "15-11-2026",
          slotTime: "11:00 AM",
          department: "Cardiology",
          status: "confirmed",
        },
      });
      if (res.data?.success) {
        toast.success(`Trigger executed: ${res.data.result?.triggeredCount || 0} workflows fired.`);
        fetchWorkflows();
        fetchExecutions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Test trigger failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        trigger: formData.trigger,
        conditions: [
          {
            field: formData.conditionField,
            operator: formData.conditionOperator,
            value: formData.conditionValue,
          },
        ],
        actions: [
          {
            type: formData.actionType,
            order: 1,
            params: {
              title: formData.actionTitle,
              message: formData.actionMessage,
              severity: "info",
              category: "operations",
            },
          },
        ],
      };

      const res = await api.post("/workflows", payload);
      if (res.data?.success) {
        toast.success("Workflow created successfully");
        setShowCreateModal(false);
        setFormData({
          name: "",
          description: "",
          trigger: "appointment_booked",
          actionType: "internal_notification",
          actionTitle: "New Appointment Booked",
          actionMessage: "Appointment confirmed for {patientName} on {slotDate} at {slotTime}.",
          conditionField: "status",
          conditionOperator: "equals",
          conditionValue: "confirmed",
        });
        fetchWorkflows();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create workflow");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaCogs className="text-blue-600" /> Workflow Automation Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automate routine hospital events, notifications, and operational task assignments with zero external dependencies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchWorkflows();
              fetchExecutions();
            }}
            className="p-2 border rounded-lg text-gray-600 hover:bg-gray-50"
            title="Refresh Workflows"
          >
            <FaSyncAlt />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow"
          >
            <FaPlus /> New Workflow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 font-semibold text-sm border-b-2 transition ${
            activeTab === "rules"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Configured Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab("executions")}
          className={`pb-3 font-semibold text-sm border-b-2 transition ${
            activeTab === "executions"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Execution History ({executions.length})
        </button>
      </div>

      {activeTab === "rules" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-gray-500">Loading workflows...</div>
          ) : workflows.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <FaCogs className="mx-auto text-4xl text-gray-400 mb-2" />
              <p className="text-gray-600 font-medium">No automated workflows configured yet.</p>
              <p className="text-xs text-gray-400 mt-1">Create your first automated trigger rule to optimize hospital operations.</p>
            </div>
          ) : (
            workflows.map((wf) => (
              <div
                key={wf._id}
                className={`bg-white border rounded-xl p-5 shadow-sm space-y-4 transition ${
                  wf.status === "active" ? "border-blue-200" : "border-gray-200 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">
                      {wf.trigger.replace(/_/g, " ")}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-2 text-base">{wf.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{wf.description || "Automated operational rule"}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(wf._id)}
                    className="text-2xl text-gray-600 hover:text-blue-600"
                    title={wf.status === "active" ? "Deactivate" : "Activate"}
                  >
                    {wf.status === "active" ? (
                      <FaToggleOn className="text-blue-600" />
                    ) : (
                      <FaToggleOff className="text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="text-xs bg-gray-50 p-2.5 rounded-lg space-y-1.5 border border-gray-100">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Actions:</span>
                    <span className="font-semibold text-gray-700">
                      {wf.actions?.map((a) => a.type.replace(/_/g, " ")).join(", ") || "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Executed:</span>
                    <span className="font-semibold text-gray-700">{wf.executionCount || 0} times</span>
                  </div>
                  {wf.lastExecutedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Run:</span>
                      <span className="font-medium text-gray-600">
                        {new Date(wf.lastExecutedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <button
                    onClick={() => handleTestTrigger(wf.trigger)}
                    disabled={testingId === wf.trigger}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FaPlay className="text-[10px]" />
                    {testingId === wf.trigger ? "Testing..." : "Simulate Trigger"}
                  </button>
                  <button
                    onClick={() => handleDelete(wf._id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Delete Workflow"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Execution Logs Table */
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] border-b">
                <tr>
                  <th className="p-3.5">Workflow</th>
                  <th className="p-3.5">Trigger</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Steps Executed</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-gray-400">
                      No workflow execution logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  executions.map((ex) => (
                    <tr key={ex._id} className="hover:bg-gray-50">
                      <td className="p-3.5 font-semibold text-gray-900">{ex.workflowName}</td>
                      <td className="p-3.5">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px]">
                          {ex.trigger}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 w-max ${
                            ex.status === "success"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {ex.status === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
                          {ex.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {ex.stepsExecuted?.length || 0} action(s)
                      </td>
                      <td className="p-3.5 text-gray-500">{ex.durationMs || 0} ms</td>
                      <td className="p-3.5 text-gray-500">
                        {new Date(ex.executedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Create Operational Workflow</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Workflow Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cancellation Slot Notice"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Trigger Event</label>
                <select
                  value={formData.trigger}
                  onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white"
                >
                  <option value="appointment_booked">Appointment Booked</option>
                  <option value="appointment_cancelled">Appointment Cancelled</option>
                  <option value="support_ticket_created">Support Ticket Created</option>
                  <option value="task_overdue">Operational Task Overdue</option>
                  <option value="leave_approved">Staff Leave Approved</option>
                  <option value="resource_maintenance_due">Resource Maintenance Due</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Action Type</label>
                <select
                  value={formData.actionType}
                  onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm bg-white"
                >
                  <option value="internal_notification">Internal Alert / Notification</option>
                  <option value="create_task">Create Departmental Task</option>
                  <option value="update_status">Update Entity Status</option>
                  <option value="send_reminder">Internal Staff Reminder</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Action Title</label>
                <input
                  type="text"
                  required
                  value={formData.actionTitle}
                  onChange={(e) => setFormData({ ...formData, actionTitle: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Action Message / Notes</label>
                <textarea
                  rows={2}
                  value={formData.actionMessage}
                  onChange={(e) => setFormData({ ...formData, actionMessage: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
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
                  Save Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
