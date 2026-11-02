import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaSlidersH,
  FaEdit,
  FaHistory,
  FaCheckCircle,
  FaTimesCircle,
  FaUndo,
  FaSyncAlt,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";

export default function BusinessRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [configValues, setConfigValues] = useState({});
  const [changeReason, setChangeReason] = useState("");
  const [selectedRuleHistory, setSelectedRuleHistory] = useState(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.get("/business-rules");
      if (res.data?.success) {
        setRules(res.data.rules || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load business rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (id) => {
    try {
      const res = await api.patch(`/business-rules/${id}/toggle`);
      if (res.data?.success) {
        toast.success("Rule status updated");
        fetchRules();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle rule");
    }
  };

  const handleEditClick = (rule) => {
    setEditingRule(rule);
    setConfigValues({ ...(rule.config || {}) });
    setChangeReason("");
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/business-rules/${editingRule._id}`, {
        config: configValues,
        changeReason,
      });
      if (res.data?.success) {
        toast.success("Business rule parameters saved");
        setEditingRule(null);
        fetchRules();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update business rule");
    }
  };

  const handleRollback = async (ruleId, targetVersion) => {
    if (!window.confirm(`Roll back configuration to version ${targetVersion}?`)) return;
    try {
      const res = await api.post(`/business-rules/${ruleId}/rollback`, { targetVersion });
      if (res.data?.success) {
        toast.success(`Rolled back to version ${targetVersion}`);
        setSelectedRuleHistory(null);
        fetchRules();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Rollback failed");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaSlidersH className="text-blue-600" /> Configurable Business Rule Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enforce server-side hospital policies for appointment cancellations, advance booking, queue pacing, and shifts.
          </p>
        </div>
        <button
          onClick={fetchRules}
          className="p-2 border rounded-lg text-gray-600 hover:bg-gray-50"
          title="Refresh Rules"
        >
          <FaSyncAlt />
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Loading business rules...</div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule._id}
              className={`bg-white border rounded-xl p-5 shadow-sm space-y-4 transition ${
                rule.isActive ? "border-blue-200" : "border-gray-200 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">
                    v{rule.version || 1} • {rule.category.replace(/_/g, " ")}
                  </span>
                  <h3 className="font-bold text-gray-900 mt-2 text-base">{rule.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rule.description}</p>
                </div>
                <button
                  onClick={() => handleToggle(rule._id)}
                  className="text-2xl text-gray-600 hover:text-blue-600"
                  title={rule.isActive ? "Deactivate" : "Activate"}
                >
                  {rule.isActive ? <FaToggleOn className="text-blue-600" /> : <FaToggleOff className="text-gray-400" />}
                </button>
              </div>

              {/* Config Key-Value Display */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs space-y-1.5 font-mono">
                {Object.entries(rule.config || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}:</span>
                    <span className="font-semibold text-gray-800">{String(v)}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <button
                  onClick={() => handleEditClick(rule)}
                  className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5"
                >
                  <FaEdit /> Edit Parameters
                </button>
                {rule.history?.length > 0 && (
                  <button
                    onClick={() => setSelectedRuleHistory(rule)}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1 font-medium"
                  >
                    <FaHistory /> Audit History ({rule.history.length})
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{editingRule.name}</h3>
                <p className="text-xs text-gray-500">Edit Rule Configuration</p>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
              {Object.keys(configValues).map((key) => (
                <div key={key}>
                  <label className="block font-semibold text-gray-700 mb-1">{key}</label>
                  {typeof configValues[key] === "boolean" ? (
                    <select
                      value={String(configValues[key])}
                      onChange={(e) =>
                        setConfigValues({
                          ...configValues,
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
                      type={typeof configValues[key] === "number" ? "number" : "text"}
                      value={configValues[key]}
                      onChange={(e) =>
                        setConfigValues({
                          ...configValues,
                          [key]:
                            typeof configValues[key] === "number"
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
                <label className="block font-semibold text-gray-700 mb-1">Reason for Policy Change</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adjusted advance booking window to 90 days"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History & Rollback Modal */}
      {selectedRuleHistory && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{selectedRuleHistory.name}</h3>
                <p className="text-xs text-gray-500">Version History & Rollback</p>
              </div>
              <button
                onClick={() => setSelectedRuleHistory(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 text-xs pr-1">
              {selectedRuleHistory.history?.map((h, i) => (
                <div key={i} className="bg-gray-50 p-3 rounded-xl border space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-gray-800">
                    <span>Version {h.version}</span>
                    <span className="text-[10px] text-gray-400 font-normal">{new Date(h.changedAt).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-500 italic text-[11px]">{h.reason || "Updated by " + h.changedBy}</p>
                  <pre className="bg-white p-2 rounded border text-[10px] font-mono text-gray-700 overflow-x-auto">
                    {JSON.stringify(h.config, null, 2)}
                  </pre>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleRollback(selectedRuleHistory._id, h.version)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <FaUndo /> Roll Back to v{h.version}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
