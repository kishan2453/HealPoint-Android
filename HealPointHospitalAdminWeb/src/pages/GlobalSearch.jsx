import React, { useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaSearch,
  FaUserMd,
  FaClipboardList,
  FaTasks,
  FaHeadset,
  FaLayerGroup,
  FaHospital,
  FaSpinner,
} from "react-icons/fa";

export default function GlobalSearch({ onNavigateTab }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;

    try {
      setLoading(true);
      const res = await api.get(`/global-search?query=${encodeURIComponent(query)}&category=${category}`);
      if (res.data?.success) {
        setResults(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (cat) => {
    switch (cat.toLowerCase()) {
      case "doctor":
        return <FaUserMd className="text-blue-500" />;
      case "appointment":
        return <FaClipboardList className="text-green-500" />;
      case "task":
        return <FaTasks className="text-amber-500" />;
      case "support ticket":
        return <FaHeadset className="text-purple-500" />;
      case "resource":
        return <FaLayerGroup className="text-indigo-500" />;
      default:
        return <FaHospital className="text-gray-500" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FaSearch className="text-blue-600" /> Global Search & Command Center
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Instant unified search across doctors, appointments, operational tasks, support tickets, and hospital resources.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-4 border rounded-2xl shadow-sm space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search by doctor name, patient name, appointment ID, task, or equipment..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 shadow"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
            Search
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-gray-400 font-medium">Filter By:</span>
          {["all", "doctors", "appointments", "tasks", "support", "resources"].map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold capitalize transition ${
                category === c
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results Container */}
      {results && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold border-b pb-2">
            <span>Query: "{results.query}"</span>
            <span>{results.total} matching items found</span>
          </div>

          {results.total === 0 ? (
            <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed text-gray-500">
              <FaSearch className="mx-auto text-3xl text-gray-300 mb-2" />
              <p className="font-semibold text-base">No matching records found.</p>
              <p className="text-xs text-gray-400 mt-1">Try refining your search keyword or selecting a broader category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(results.results || {}).map(([catKey, items]) => {
                if (!items || items.length === 0) return null;
                return items.map((item) => (
                  <div
                    key={`${item.category}-${item.id}`}
                    onClick={() => onNavigateTab && onNavigateTab(item.route.replace("/", ""))}
                    className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer flex items-start gap-3.5 border-gray-200"
                  >
                    <div className="p-3 bg-gray-50 rounded-xl text-lg flex-shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mt-1 truncate">{item.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                ));
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
