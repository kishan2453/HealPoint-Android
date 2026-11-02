import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaExchangeAlt,
  FaDownload,
  FaUpload,
  FaCheckCircle,
  FaExclamationCircle,
  FaHistory,
  FaUndo,
  FaSyncAlt,
} from "react-icons/fa";

export default function DataImportExport() {
  const [entityType, setEntityType] = useState("staff");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get("/import-export/history");
      if (res.data?.success) {
        setHistory(res.data.history || []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/import-export/template?entityType=${entityType}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityType}-import-template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("CSV template downloaded");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) {
      setParsedRows([]);
      return;
    }
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) {
      toast.error("CSV must contain a header and at least one data row");
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      data.push(row);
    }

    setParsedRows(data);
    toast.info(`Parsed ${data.length} records ready for preview & import.`);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    try {
      setLoading(true);
      const res = await api.post("/import-export/execute", {
        entityType,
        records: parsedRows,
        fileName: `${entityType}_batch_upload.csv`,
      });

      if (res.data?.success) {
        toast.success(`Import completed: ${res.data.importedCount} inserted, ${res.data.failedCount} errors.`);
        setCsvText("");
        setParsedRows([]);
        fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Import execution failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (importId) => {
    if (!window.confirm("Are you sure you want to rollback this import and remove all imported records?")) return;
    try {
      const res = await api.post(`/import-export/rollback/${importId}`);
      if (res.data?.success) {
        toast.success(res.data.message || "Rollback completed");
        fetchHistory();
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
            <FaExchangeAlt className="text-blue-600" /> Advanced Synthetic Data Import & Export
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Safely bulk import synthetic hospital records (staff, beds, equipment, tasks) with strict validation, duplicate detection, and safe rollback.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="border text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
        >
          <FaDownload /> Download CSV Template
        </button>
      </div>

      {/* Import Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload & CSV Input */}
        <div className="bg-white p-5 border rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <FaUpload className="text-blue-600" /> 1. Select Entity & Paste CSV
          </h3>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Target Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setParsedRows([]);
              }}
              className="w-full border rounded-lg p-2 text-xs bg-gray-50"
            >
              <option value="staff">Hospital Staff & Clinicians</option>
              <option value="resources">Facility Beds & Diagnostic Resources</option>
              <option value="tasks">Operational Tasks</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Raw CSV Content (with column headers)
            </label>
            <textarea
              rows={8}
              placeholder="employeeId,name,email,phone,role,department,designation&#10;EMP-901,Dr. John Doe,john@healpoint.demo,9876543210,doctor,Cardiology,Consultant"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full border rounded-xl p-3 text-xs font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleParseCsv}
              disabled={!csvText.trim()}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              Parse & Validate
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={loading || parsedRows.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              {loading ? "Importing..." : `Execute Import (${parsedRows.length})`}
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="bg-white p-5 border rounded-2xl shadow-sm space-y-4 flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <FaCheckCircle className="text-green-600" /> 2. Records Preview & Validation
            </h3>
            <span className="text-xs text-gray-400 font-semibold">{parsedRows.length} rows parsed</span>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto max-h-80 border rounded-xl bg-gray-50 p-2">
            {parsedRows.length === 0 ? (
              <div className="py-24 text-center text-gray-400 text-xs italic">
                Paste CSV on the left and click "Parse & Validate" to view verified rows.
              </div>
            ) : (
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="border-b bg-gray-100 text-gray-700 font-bold sticky top-0">
                  <tr>
                    {Object.keys(parsedRows[0]).map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-white">
                      {Object.values(r).map((v, c) => (
                        <td key={c} className="p-2 truncate max-w-[120px]">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Import History & Rollback Log */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700 flex items-center gap-1.5">
            <FaHistory className="text-blue-600" /> Audit Trail & Rollback History
          </span>
          <button onClick={fetchHistory} className="text-gray-500 hover:text-gray-800">
            <FaSyncAlt />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] border-b">
              <tr>
                <th className="p-3.5">File Name & Entity</th>
                <th className="p-3.5">Imported By</th>
                <th className="p-3.5">Total Rows</th>
                <th className="p-3.5">Successful</th>
                <th className="p-3.5">Failed</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyLoading ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-gray-500">
                    Loading history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-gray-400">
                    No imports recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h._id} className="hover:bg-gray-50">
                    <td className="p-3.5">
                      <span className="font-bold text-gray-900">{h.fileName}</span>
                      <p className="text-[10px] text-gray-500 uppercase">{h.entityType}</p>
                    </td>
                    <td className="p-3.5 font-medium">{h.importedBy}</td>
                    <td className="p-3.5">{h.totalRows}</td>
                    <td className="p-3.5 text-green-600 font-bold">{h.importedCount}</td>
                    <td className="p-3.5 text-red-600 font-bold">{h.failedCount}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          h.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : h.status === "rolled_back"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {h.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-400 font-mono text-[11px]">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5">
                      {h.status !== "rolled_back" && h.importedCount > 0 ? (
                        <button
                          onClick={() => handleRollback(h._id)}
                          className="text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 text-xs"
                        >
                          <FaUndo /> Rollback
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs italic">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
