import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaSearch, FaHospital, FaUserMd, FaUsers, FaCalendarAlt, FaStar, FaCog, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import API from "../../Api/API";

const QUICK_ROUTES = [
  { label: "Hospital Directory", category: "Module", to: "/hospitals", icon: <FaHospital color="#0284C7" /> },
  { label: "Doctor Directory", category: "Module", to: "/all-doctors", icon: <FaUserMd color="#0EA5E9" /> },
  { label: "Patient Records", category: "Module", to: "/all-users", icon: <FaUsers color="#10B981" /> },
  { label: "Appointments Engine", category: "Module", to: "/all-appointments", icon: <FaCalendarAlt color="#F59E0B" /> },
  { label: "Reputation & Reviews", category: "Module", to: "/reviews", icon: <FaStar color="#EAB308" /> },
  { label: "System Settings", category: "Module", to: "/settings", icon: <FaCog color="#64748B" /> },
];

export const GlobalAdminSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      try {
        const [hospRes, docRes] = await Promise.all([
          API.get("/hospital/get-all").catch(() => ({ data: {} })),
          API.get("/doctor/get-all?platform=1").catch(() => ({ data: {} })),
        ]);
        if (active) {
          setHospitals(hospRes.data?.hospitals || []);
          setDoctors(docRes.data?.doctors || []);
        }
      } catch {
        // Silent fallback to quick routes
      }
    };
    fetchCatalog();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matchedRoutes = QUICK_ROUTES.filter(r => r.label.toLowerCase().includes(q))
      .map(r => ({ ...r, type: "Navigation" }));

    const matchedHospitals = hospitals.filter(h =>
      (h.name || "").toLowerCase().includes(q) ||
      (h.location?.city || "").toLowerCase().includes(q)
    ).slice(0, 4).map(h => ({
      label: h.name,
      sublabel: `${h.location?.city || "Hospital"} · ${h.doctorCount || 0} Doctors`,
      category: "Hospital",
      to: `/hospitals?search=${encodeURIComponent(h.name)}`,
      icon: <FaHospital color="#0284C7" />,
    }));

    const matchedDoctors = doctors.filter(d =>
      (d.name || "").toLowerCase().includes(q) ||
      (d.speciality || "").toLowerCase().includes(q) ||
      (d.hospitalName || "").toLowerCase().includes(q)
    ).slice(0, 4).map(d => ({
      label: d.name,
      sublabel: `${d.speciality || "Specialist"} · ${d.hospitalName || "HealPoint"}`,
      category: "Doctor",
      to: `/all-doctors?search=${encodeURIComponent(d.name)}`,
      icon: <FaUserMd color="#0EA5E9" />,
    }));

    return [...matchedRoutes, ...matchedHospitals, ...matchedDoctors];
  }, [query, hospitals, doctors]);

  const handleSelect = (to) => {
    setIsOpen(false);
    setQuery("");
    navigate(to);
  };

  return (
    <div ref={wrapRef} className="hp-global-search-wrap" style={{ position: "relative", width: "100%", maxWidth: "440px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#F1F5F9",
          border: isOpen ? "1px solid #93C5FD" : "1px solid #E2E8F0",
          borderRadius: "9999px",
          padding: "7px 16px",
          transition: "all 0.15s ease",
          boxShadow: isOpen ? "0 0 0 3px rgba(2, 132, 199, 0.12)" : "none",
        }}
      >
        <FaSearch color="#64748B" size={14} style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search hospitals, doctors, patients, appointments..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            width: "100%",
            fontSize: "0.86rem",
            color: "#0F172A",
            fontFamily: "inherit",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setIsOpen(false); }}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <FaTimes size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
            maxHeight: "360px",
            overflowY: "auto",
            zIndex: 90,
            padding: "8px",
          }}
        >
          {query.trim() ? (
            results.length > 0 ? (
              results.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(item.to)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#F1F5F9",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#0F172A" }}>
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          color: "#64748B",
                          background: "#F1F5F9",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    {item.sublabel && (
                      <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "0.85rem" }}>
                No matches found for "{query}".
              </div>
            )
          ) : (
            <div>
              <p
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#94A3B8",
                  padding: "6px 10px 4px",
                  margin: 0,
                }}
              >
                Quick Navigation
              </p>
              {QUICK_ROUTES.map((route, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(route.to)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.84rem",
                    color: "#1E293B",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ display: "grid", placeItems: "center" }}>{route.icon}</span>
                  <span>{route.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

