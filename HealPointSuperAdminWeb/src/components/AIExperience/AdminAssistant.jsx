import React, { useState } from "react";
import { FaBrain, FaChartLine, FaComments, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const AdminAssistant = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className={`admin-ai-assistant ${open ? "open" : ""}`}>
      {open && (
        <div className="admin-ai-panel">
          <div className="admin-ai-head">
            <div>
              <span>Command AI</span>
              <strong>Operational copilot</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)}>
              <FaTimes />
            </button>
          </div>
          <div className="admin-ai-feed">
            <p>
              Patient engagement is trending up. Review pending appointments and
              unread messages.
            </p>
            <p className="typing">Generating smart action plan...</p>
          </div>
          <div className="admin-ai-actions">
            <button onClick={() => navigate("/support")}>
              <FaComments /> Support Tickets
            </button>
            <button onClick={() => navigate("/earnings")}>
              <FaChartLine /> Revenue
            </button>
          </div>
        </div>
      )}
      <button
        className="admin-ai-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <FaBrain />
      </button>
    </div>
  );
};

export default AdminAssistant;
