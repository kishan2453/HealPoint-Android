import React, { useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaRobot,
  FaPaperPlane,
  FaLightbulb,
  FaChartPie,
  FaShieldAlt,
  FaCheckCircle,
  FaSpinner,
} from "react-icons/fa";

const QUICK_QUESTIONS = [
  "Which department has the highest appointment load?",
  "Which days have the most cancellations?",
  "Which tasks are overdue?",
  "What is current facility resource & bed utilization?",
  "Which doctors have highest schedule load?",
  "Summarize overall hospital operations this week.",
];

export default function AiAdminAssistant() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAsk = async (questionToAsk) => {
    const q = questionToAsk || query;
    if (!q || !q.trim()) return;

    try {
      setLoading(true);
      const res = await api.post("/ai-assistant/query", { query: q });
      if (res.data?.success) {
        setResult(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to get AI operational response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
            <FaRobot className="text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Administrative Operations Assistant</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Instant natural language intelligence over your hospital appointments, queue pacing, bed capacity and tasks.
            </p>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
        <FaShieldAlt className="text-blue-600 text-base flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Administrative Analytics Guardrail:</span> This assistant performs aggregate
          operational analytics from authorized database records. It is non-clinical and strictly does not provide
          medical advice or diagnostic conclusions.
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white p-4 border rounded-2xl shadow-sm space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(query);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ask about department volume, cancellations, doctor load, or facility resources..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 shadow"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
            Ask AI
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-gray-400 font-medium">Quick Prompts:</span>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(q);
                handleAsk(q);
              }}
              className="bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Response Panel */}
      {result && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-5 animate-fadeIn">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wider">
              AI Operational Analysis
            </span>
            <div className="mt-3 text-gray-800 text-sm leading-relaxed whitespace-pre-line font-normal">
              {result.answer}
            </div>
          </div>

          {/* Key Metrics Cards */}
          {result.keyMetrics && Object.keys(result.keyMetrics).length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <FaChartPie className="text-blue-600" /> Operational Metrics Verified
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {Object.entries(result.keyMetrics).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    <p className="text-base font-bold text-gray-900 mt-1">{String(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-1.5">
                <FaLightbulb className="text-amber-500" /> Actionable Recommendations
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-700">
                {result.suggestions.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <FaCheckCircle className="text-green-500 text-xs mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer Disclaimer */}
          <div className="text-[11px] text-gray-400 border-t pt-3 italic">
            {result.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}
