import React, { useState, useEffect } from "react";
import Layout from "../components/Layout/Layout";
import api from "../Api/API";
import toast from "react-hot-toast";
import {
  FaSlidersH,
  FaShieldAlt,
  FaLock,
  FaHistory,
  FaSave,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCogs,
  FaCalendarCheck,
} from "react-icons/fa";

export default function SystemConfiguration() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [updateReason, setUpdateReason] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/system-config");
      if (res.data?.success) {
        setConfigs(res.data.configs || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load system configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEditClick = (config) => {
    setEditingConfig(config);
    setEditValues({ ...(config.values || {}) });
    setUpdateReason("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingConfig) return;

    try {
      const res = await api.put(`/system-config/${editingConfig.configKey}`, {
        values: editValues,
        reason: updateReason || "Super Admin policy update",
      });

      if (res.data?.success) {
        toast.success("Configuration policy updated successfully");
        setEditingConfig(null);
        fetchConfigs();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update configuration");
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaSlidersH className="text-blue-600" /> Internal System Configuration Center
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Centralized platform policies, feature availability, appointment rules, and simulation safety locks.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800">
            <FaLock /> Simulation Safety Active
          </div>
        </div>

        {/* Safety Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-sm">
          <FaShieldAlt className="text-blue-600 text-lg flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm block mb-0.5">Platform Integrity & Compliance Guardrail</span>
            This platform operates in standalone simulation mode. All emergency dispatch, live external SMS/calls,
            and real payment transactions are strictly locked and prohibited by platform architecture.
          </div>
        </div>

        {/* Configuration Cards */}
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading platform configuration policies...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {configs.map((c) => (
              <div
                key={c._id}
                className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${
                  c.isLocked ? "border-amber-200 bg-amber-50/10" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <h3 className="font-bold text-gray-900 mt-2 text-base">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                  </div>
                  {c.isLocked ? (
                    <span className="text-amber-600 bg-amber-100 p-2 rounded-xl text-xs font-bold flex items-center gap-1" title="Locked Simulation Policy">
                      <FaLock /> Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleEditClick(c)}
                      className="bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Configure
                    </button>
                  )}
                </div>

                {/* Values Table */}
                <div className="bg-gray-50 p-3 rounded-xl border text-xs font-mono space-y-1.5">
                  {Object.entries(c.values || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-gray-500">{k}:</span>
                      <span className={`font-semibold ${typeof v === "boolean" ? (v ? "text-green-600" : "text-gray-600") : "text-gray-900"}`}>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Audit trail summary */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <FaHistory /> Audit Log: {c.auditTrail?.length || 0} change(s)
                  </span>
                  <span>Updated: {new Date(c.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Configuration Modal */}
        {editingConfig && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{editingConfig.name}</h3>
                  <p className="text-xs text-gray-500">Edit System Parameters</p>
                </div>
                <button
                  onClick={() => setEditingConfig(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5 text-xs">
                {Object.keys(editValues).map((key) => (
                  <div key={key}>
                    <label className="block font-semibold text-gray-700 mb-1">{key}</label>
                    {typeof editValues[key] === "boolean" ? (
                      <select
                        value={String(editValues[key])}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            [key]: e.target.value === "true",
                          })
                        }
                        className="w-full border rounded-lg p-2 text-xs bg-white"
                      >
                        <option value="true">True (Enabled)</option>
                        <option value="false">False (Disabled)</option>
                      </select>
                    ) : (
                      <input
                        type={typeof editValues[key] === "number" ? "number" : "text"}
                        value={editValues[key]}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            [key]:
                              typeof editValues[key] === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                          })
                        }
                        className="w-full border rounded-lg p-2 text-xs"
                      />
                    )}
                  </div>
                ))}

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Reason for Policy Update</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Updated maximum advance booking window for seasonal schedule"
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    className="w-full border rounded-lg p-2 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setEditingConfig(null)}
                    className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
