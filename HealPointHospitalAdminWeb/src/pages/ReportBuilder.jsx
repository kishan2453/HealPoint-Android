import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaFileAlt,
  FaDownload,
  FaFilter,
  FaTable,
  FaSyncAlt,
  FaSave,
} from "react-icons/fa";

export default function ReportBuilder() {
  const [reportType, setReportType] = useState("appointments");
  const [dateRangePreset, setDateRangePreset] = useState("last_7_days");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      const res = await api.post("/report-builder/generate", {
        reportType,
        dateRangePreset,
        customStartDate: customStart || undefined,
        customEndDate: customEnd || undefined,
        department: department || undefined,
        status: status || undefined,
        format: "json",
      });

      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerateReport();
  }, [reportType, dateRangePreset]);

  const handleExportCSV = async () => {
    try {
      const res = await api.post(
        "/report-builder/generate",
        {
          reportType,
          dateRangePreset,
          customStartDate: customStart || undefined,
          customEndDate: customEnd || undefined,
          department: department || undefined,
          status: status || undefined,
          format: "csv",
        },
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("CSV export downloaded");
    } catch {
      toast.error("Failed to download CSV");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaFileAlt className="text-blue-600" /> Advanced Report Builder
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Build custom operational reports with multidimensional filters and export directly to CSV.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={!reportData?.rows?.length}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow"
          >
            <FaDownload /> Export to CSV
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-4 border rounded-xl shadow-sm space-y-3 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Report Module</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border rounded-lg p-2 bg-gray-50 text-gray-800"
            >
              <option value="appointments">Appointments Master</option>
              <option value="revenue_billing">Revenue & Collected Billing</option>
              <option value="cancellations_noshow">Cancellations & Missed Pacing</option>
              <option value="waitlist_performance">Waitlist Conversion Rate</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Date Window</label>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value)}
              className="w-full border rounded-lg p-2 bg-gray-50 text-gray-800"
            >
              <option value="today">Today</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Department</label>
            <input
              type="text"
              placeholder="All Departments"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border rounded-lg p-2 text-xs"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white p-2 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <FaSyncAlt /> Run Report
            </button>
          </div>
        </div>

        {dateRangePreset === "custom" && (
          <div className="flex items-center gap-3 pt-2 border-t">
            <span className="text-gray-500 font-semibold">Custom Dates:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border rounded p-1.5"
            />
            <span>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border rounded p-1.5"
            />
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      {reportData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(reportData.summary).map(([k, v]) => (
            <div key={k} className="bg-white border rounded-xl p-4 shadow-sm">
              <span className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {k.toLowerCase().includes("revenue") ? `₹${Number(v).toLocaleString("en-IN")}` : String(v)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-3 border-b bg-gray-50 flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700 flex items-center gap-1.5">
            <FaTable className="text-blue-600" /> Report Records Preview
          </span>
          <span className="text-gray-500 font-medium">{reportData?.rows?.length || 0} rows found</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-[11px] border-b sticky top-0">
              <tr>
                {reportData?.rows?.[0] ? (
                  Object.keys(reportData.rows[0]).map((col) => (
                    <th key={col} className="p-3">
                      {col.replace(/([A-Z])/g, " $1")}
                    </th>
                  ))
                ) : (
                  <th className="p-3">Data</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-gray-500">
                    Compiling report data...
                  </td>
                </tr>
              ) : !reportData?.rows?.length ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-gray-400">
                    No records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {Object.values(row).map((val, cIdx) => (
                      <td key={cIdx} className="p-3 truncate max-w-xs">
                        {String(val)}
                      </td>
                    ))}
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
