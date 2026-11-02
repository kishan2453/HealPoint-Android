import React, { useState, useEffect } from "react";
import Layout from "../components/Layout/Layout";
import API from "../Api/API";
import { toast } from "react-hot-toast";
import {
  FaCreditCard,
  FaCheckCircle,
  FaPlus,
  FaFileInvoiceDollar,
  FaHospital,
  FaLayerGroup,
  FaSyncAlt,
  FaShieldAlt,
} from "react-icons/fa";

export default function HospitalSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("subscriptions"); // subscriptions | plans | invoices

  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    hospitalId: "",
    planCode: "professional",
    billingCycle: "monthly",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes, invRes, hospRes] = await Promise.all([
        API.get("/hospital-subscriptions/plans"),
        API.get("/hospital-subscriptions/overview"),
        API.get("/hospital-subscriptions/invoices"),
        API.get("/hospital/get-all"),
      ]);

      if (plansRes.data?.success) setPlans(plansRes.data.plans || []);
      if (subRes.data?.success) setSubscriptions(subRes.data.subscriptions || []);
      if (invRes.data?.success) setInvoices(invRes.data.invoices || []);
      if (hospRes.data?.success) setHospitals(hospRes.data.hospitals || hospRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load hospital subscription data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignPlan = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/hospital-subscriptions/assign", assignForm);
      if (res.data?.success) {
        toast.success(res.data.message || "Plan assigned successfully");
        setShowAssignModal(false);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign plan");
    }
  };

  return (
    <Layout>
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1E293B", margin: 0 }}>
              Hospital Subscriptions & SaaS Plan Management
            </h1>
            <p style={{ color: "#64748B", fontSize: "14px", marginTop: "4px" }}>
              Configure hospital subscription tiers, enforce usage limits, and manage simulated SaaS billing
            </p>
          </div>

          <button
            onClick={() => setShowAssignModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <FaPlus /> Assign Hospital Plan
          </button>
        </div>

        {/* Safety Disclaimer Banner */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px 18px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <FaShieldAlt size={20} color="#2563EB" />
          <div style={{ fontSize: "13px", color: "#1E40AF" }}>
            <strong>Internal Platform Management:</strong> All subscription limits, feature entitlements, and invoices are internally simulated. Zero live payments or external gateway calls are processed.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", marginBottom: "20px" }}>
          {[
            { id: "subscriptions", label: "Hospital Subscriptions", icon: FaHospital },
            { id: "plans", label: "Configured Plan Tiers", icon: FaLayerGroup },
            { id: "invoices", label: "Simulated Invoices", icon: FaFileInvoiceDollar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 18px",
                  border: "none",
                  background: "none",
                  borderBottom: isActive ? "2px solid #2563EB" : "2px solid transparent",
                  color: isActive ? "#2563EB" : "#64748B",
                  fontWeight: isActive ? "600" : "500",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <Icon /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Subscriptions Table */}
        {activeTab === "subscriptions" && (
          <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Loading subscriptions...</div>
            ) : subscriptions.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No active hospital subscriptions found.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                    <th style={{ padding: "14px 16px" }}>HOSPITAL</th>
                    <th style={{ padding: "14px 16px" }}>ASSIGNED PLAN</th>
                    <th style={{ padding: "14px 16px" }}>CYCLE</th>
                    <th style={{ padding: "14px 16px" }}>DOCTORS LIMIT</th>
                    <th style={{ padding: "14px 16px" }}>APPOINTMENTS LIMIT</th>
                    <th style={{ padding: "14px 16px" }}>STATUS</th>
                    <th style={{ padding: "14px 16px" }}>EXPIRY</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1E293B" }}>
                        {sub.hospitalName || sub.hospitalId?.name || "Partner Hospital"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#2563EB", fontWeight: "600" }}>{sub.planName}</td>
                      <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "#475569" }}>{sub.billingCycle}</td>
                      <td style={{ padding: "14px 16px", color: "#475569" }}>{sub.limits?.maxDoctors || 25} Doctors</td>
                      <td style={{ padding: "14px 16px", color: "#475569" }}>{sub.limits?.maxAppointmentsPerMonth || 2000}/mo</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: "#DCFCE7", color: "#15803D", textTransform: "capitalize" }}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748B" }}>
                        {new Date(sub.expiryDate).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Plan Tiers */}
        {activeTab === "plans" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {plans.map((p) => (
              <div key={p._id} style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{p.name}</h3>
                  <span style={{ background: "#DBEAFE", color: "#1D4ED8", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                    {p.badge}
                  </span>
                </div>
                <p style={{ color: "#64748B", fontSize: "13px", minHeight: "36px" }}>{p.description}</p>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#1E293B", margin: "14px 0" }}>
                  ₹{p.monthlyPriceSimulated} <span style={{ fontSize: "14px", color: "#64748B", fontWeight: "400" }}>/month</span>
                </div>
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#475569" }}>
                  <div>✓ Max Active Doctors: <strong>{p.maxDoctors}</strong></div>
                  <div>✓ Max Monthly Appointments: <strong>{p.maxAppointmentsPerMonth}</strong></div>
                  <div>✓ Digital Queue Management: <strong>{p.hasQueueManagement ? "Yes" : "No"}</strong></div>
                  <div>✓ Resource & Bed Inventory: <strong>{p.hasResourceManagement ? "Yes" : "No"}</strong></div>
                  <div>✓ Staff & Duty Roster: <strong>{p.hasStaffRoster ? "Yes" : "No"}</strong></div>
                  <div>✓ Predictive Analytics: <strong>{p.hasAdvancedAnalytics ? "Yes" : "No"}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Simulated Invoices */}
        {activeTab === "invoices" && (
          <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {invoices.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No simulated invoices generated yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                    <th style={{ padding: "14px 16px" }}>INVOICE #</th>
                    <th style={{ padding: "14px 16px" }}>HOSPITAL</th>
                    <th style={{ padding: "14px 16px" }}>PLAN</th>
                    <th style={{ padding: "14px 16px" }}>PERIOD</th>
                    <th style={{ padding: "14px 16px" }}>AMOUNT</th>
                    <th style={{ padding: "14px 16px" }}>STATUS</th>
                    <th style={{ padding: "14px 16px" }}>ISSUE DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: "700", color: "#1E293B" }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: "14px 16px", color: "#1E293B" }}>{inv.hospitalName}</td>
                      <td style={{ padding: "14px 16px", color: "#475569" }}>{inv.planName}</td>
                      <td style={{ padding: "14px 16px", color: "#64748B" }}>{inv.billingPeriod}</td>
                      <td style={{ padding: "14px 16px", fontWeight: "700", color: "#16A34A" }}>₹{inv.amount}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: "#DCFCE7", color: "#15803D" }}>
                          Paid (Simulated)
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748B" }}>
                        {new Date(inv.issueDate).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "480px", padding: "24px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#1E293B" }}>Assign Hospital Subscription</h2>
              <form onSubmit={handleAssignPlan} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Select Partner Hospital *</label>
                  <select
                    required
                    value={assignForm.hospitalId}
                    onChange={(e) => setAssignForm({ ...assignForm, hospitalId: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    <option value="">-- Choose Hospital --</option>
                    {hospitals.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Select Plan Tier *</label>
                  <select
                    required
                    value={assignForm.planCode}
                    onChange={(e) => setAssignForm({ ...assignForm, planCode: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>{p.name} (₹{p.monthlyPriceSimulated}/mo)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Billing Cycle</label>
                  <select
                    value={assignForm.billingCycle}
                    onChange={(e) => setAssignForm({ ...assignForm, billingCycle: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly (Annual)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    style={{ background: "#F1F5F9", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                  >
                    Confirm & Activate
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
