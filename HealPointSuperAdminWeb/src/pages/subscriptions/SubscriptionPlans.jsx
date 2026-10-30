import { useEffect, useState } from "react";
import {
  FaAward,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaCrown,
  FaEdit,
  FaEye,
  FaHospital,
  FaMedkit,
  FaPlus,
  FaSearch,
  FaStar,
  FaSyncAlt,
  FaTable,
  FaThLarge,
  FaTimes,
  FaToggleOff,
  FaToggleOn,
  FaUsers,
} from "react-icons/fa";
import Layout from "../../components/Layout/Layout";
import API from "../../Api/API";
import toast from "../../utils/notify";
import "./subscriptions.css";

const PER_PAGE = 8;

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getPlanIcon = (key = "") => {
  const k = String(key).toLowerCase();
  if (k.includes("enterprise") || k.includes("platinum")) return <FaCrown />;
  if (k.includes("premium") || k.includes("pro")) return <FaMedkit />;
  if (k.includes("basic") || k.includes("hospital")) return <FaHospital />;
  if (k.includes("starter") || k.includes("free")) return <FaStar />;
  return <FaAward />;
};

const emptyPlan = {
  key: "",
  name: "",
  monthlyPrice: "",
  yearlyPrice: "",
  features: "",
  trialDays: "",
  sortOrder: "",
  isActive: true,
};

const SubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [billingCycle, setBillingCycle] = useState("monthly"); // "monthly" | "yearly"
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: "create" | "edit" | "view", plan }

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await API.get("/subscription/plans");
      setPlans(data.plans || []);
    } catch (error) {
      setLoadError(
        error.response?.data?.message || "Unable to load subscription plans",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = plans.filter((plan) =>
    `${plan.name} ${plan.key} ${(plan.features || []).join(" ")}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleActive = async (plan) => {
    setBusy(true);
    try {
      const { data } = await API.patch(
        `/subscription/plans/${plan._id}/status`,
        {
          isActive: !plan.isActive,
        },
      );
      toast.success(data.message || "Plan status updated");
      load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update plan status",
      );
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async (values) => {
    if (!values.name?.trim()) {
      return toast.error("Plan name is required");
    }
    if (!values.key?.trim()) {
      return toast.error("Plan key is required");
    }

    setBusy(true);
    try {
      const payload = {
        ...values,
        key: values.key.trim().toLowerCase(),
        name: values.name.trim(),
        monthlyPrice: Math.max(0, Number(values.monthlyPrice) || 0),
        yearlyPrice: Math.max(0, Number(values.yearlyPrice) || 0),
        features: (typeof values.features === "string"
          ? values.features.split(",")
          : values.features || []
        )
          .map((item) => String(item).trim())
          .filter(Boolean),
        trialDays: Math.max(0, Number(values.trialDays) || 0),
        sortOrder: Number(values.sortOrder) || 0,
        isActive: Boolean(values.isActive),
      };

      if (modal.mode === "create") {
        const { data } = await API.post("/subscription/plans", payload);
        toast.success(data.message || "Plan created successfully");
      } else {
        const { data } = await API.patch(
          `/subscription/plans/${modal.plan._id}`,
          payload,
        );
        toast.success(data.message || "Plan updated successfully");
      }
      setModal(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="page-header-row page-intro">
        <div>
          <span className="eyebrow">Platform Catalog</span>
          <h2>Subscription Plans</h2>
          <p>
            Maintain healthcare tier packages and hospital subscription pricing.
            Prices are formatted in Indian Rupee (₹) and subscriber metrics
            reflect live database counts.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-light"
            onClick={load}
            disabled={loading}
          >
            <FaSyncAlt className={loading ? "fa-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ mode: "create" })}
          >
            <FaPlus /> New Plan
          </button>
        </div>
      </div>

      <div className="hp-plans-controls-bar">
        <form
          className="admin-search grow"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <FaSearch />
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search plans by name, key, or features…"
            aria-label="Search plans"
          />
        </form>

        <div className="hp-billing-cycle-toggle">
          <button
            type="button"
            className={`hp-cycle-btn ${billingCycle === "monthly" ? "active" : ""}`}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`hp-cycle-btn ${billingCycle === "yearly" ? "active" : ""}`}
            onClick={() => setBillingCycle("yearly")}
          >
            Yearly Billing (Save)
          </button>
        </div>

        <div className="hp-view-mode-toggle">
          <button
            type="button"
            className={`hp-view-btn ${viewMode === "cards" ? "active" : ""}`}
            onClick={() => setViewMode("cards")}
            title="Card View"
          >
            <FaThLarge /> Cards
          </button>
          <button
            type="button"
            className={`hp-view-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Table View"
          >
            <FaTable /> Table
          </button>
        </div>
      </div>

      {loading && (
        <div className="skeleton-loader">Loading subscription plans…</div>
      )}
      {!loading && loadError && (
        <div className="admin-error-box">{loadError}</div>
      )}
      {!loading && !loadError && !filtered.length && (
        <div className="empty-state">
          No subscription plans found matching your criteria.
        </div>
      )}

      {/* Cards View (Default & Primary presentation) */}
      {!loading &&
        !loadError &&
        viewMode === "cards" &&
        filtered.length > 0 && (
          <div className="hp-plan-cards-grid">
            {visible.map((plan) => {
              const priceVal =
                billingCycle === "monthly"
                  ? plan.monthlyPrice
                  : plan.yearlyPrice;
              const periodLabel =
                billingCycle === "monthly" ? "/ month" : "/ year";

              return (
                <article
                  className={`hp-plan-card ${!plan.isActive ? "inactive-plan" : ""}`}
                  key={plan._id}
                >
                  <div className="hp-plan-card-header">
                    <div className="hp-plan-badge-row">
                      <div className="hp-plan-icon-wrap">
                        {getPlanIcon(plan.key)}
                      </div>
                      <span
                        className={`status-pill ${plan.isActive ? "active" : "suspended"}`}
                      >
                        {plan.isActive ? "Active Plan" : "Inactive"}
                      </span>
                    </div>
                    <h3>{plan.name}</h3>
                    <span className="hp-plan-key-tag">Key: {plan.key}</span>
                  </div>

                  <div className="hp-plan-card-pricing">
                    <div className="hp-plan-price-main">
                      <span className="hp-plan-price-val">
                        {formatMoney(priceVal)}
                      </span>
                      <span className="hp-plan-price-period">
                        {periodLabel}
                      </span>
                    </div>
                    <p className="hp-plan-pricing-sub">
                      {billingCycle === "monthly"
                        ? `Annual price: ${formatMoney(plan.yearlyPrice)} / yr`
                        : `Monthly equivalent: ${formatMoney(Math.round((plan.yearlyPrice || 0) / 12))} / mo`}
                    </p>
                  </div>

                  <div className="hp-plan-card-meta">
                    <span>
                      <FaUsers /> Subscribers:{" "}
                      <strong>{plan.subscriberCount ?? 0}</strong>
                    </span>
                    <span>
                      Trial:{" "}
                      <strong>
                        {plan.trialDays ? `${plan.trialDays} days` : "None"}
                      </strong>
                    </span>
                  </div>

                  <div className="hp-plan-card-features">
                    <h5>Included Features</h5>
                    <ul className="hp-plan-features-list">
                      {(plan.features && plan.features.length > 0
                        ? plan.features
                        : ["Full healthcare management access"]
                      ).map((feature, idx) => (
                        <li key={idx} className="hp-plan-feature-item">
                          <FaCheckCircle />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="hp-plan-card-actions">
                    <button
                      type="button"
                      className="btn btn-light btn-sm grow"
                      onClick={() => setModal({ mode: "view", plan })}
                    >
                      <FaEye /> View
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm grow"
                      disabled={busy}
                      onClick={() => setModal({ mode: "edit", plan })}
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      disabled={busy}
                      onClick={() => toggleActive(plan)}
                      title={
                        plan.isActive ? "Deactivate plan" : "Activate plan"
                      }
                    >
                      {plan.isActive ? (
                        <FaToggleOff size={14} />
                      ) : (
                        <FaToggleOn size={14} color="#10b981" />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      {/* Table View (Alternative) */}
      {!loading &&
        !loadError &&
        viewMode === "table" &&
        filtered.length > 0 && (
          <div className="admin-table-scroll">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>PLAN</th>
                  <th>KEY</th>
                  <th>MONTHLY</th>
                  <th>YEARLY</th>
                  <th>TRIAL</th>
                  <th>SUBSCRIBERS</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((plan) => (
                  <tr key={plan._id}>
                    <td>
                      <strong>{plan.name}</strong>
                      <br />
                      <small className="admin-info-text">
                        {(plan.features || []).slice(0, 2).join(" · ") || "—"}
                      </small>
                    </td>
                    <td>
                      <code>{plan.key}</code>
                    </td>
                    <td>
                      <strong>{formatMoney(plan.monthlyPrice)}</strong>
                    </td>
                    <td>
                      <strong>{formatMoney(plan.yearlyPrice)}</strong>
                    </td>
                    <td>{plan.trialDays ? `${plan.trialDays}d` : "None"}</td>
                    <td>
                      <span className="badge badge-info">
                        {plan.subscriberCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${plan.isActive ? "active" : "suspended"}`}
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        onClick={() => setModal({ mode: "view", plan })}
                      >
                        <FaEye size={12} /> View
                      </button>{" "}
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        disabled={busy}
                        onClick={() => setModal({ mode: "edit", plan })}
                      >
                        <FaEdit size={12} /> Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="btn btn-light btn-sm"
                        disabled={busy}
                        onClick={() => toggleActive(plan)}
                      >
                        {plan.isActive ? (
                          <FaToggleOff size={12} />
                        ) : (
                          <FaToggleOn size={12} color="#10b981" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <div className="pagination-row">
        <button
          className="btn btn-light"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <FaChevronLeft /> Previous
        </button>
        <span>
          Page {page} of {totalPages} ({filtered.length} total plans)
        </span>
        <button
          className="btn btn-light"
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <FaChevronRight />
        </button>
      </div>

      {modal && (
        <PlanModal
          mode={modal.mode}
          plan={modal.plan}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={savePlan}
        />
      )}
    </Layout>
  );
};
const PlanModal = ({ mode, plan, busy, onClose, onSave }) => {
  const [values, setValues] = useState(
    plan
      ? {
          key: plan.key || "",
          name: plan.name || "",
          monthlyPrice: plan.monthlyPrice ?? "",
          yearlyPrice: plan.yearlyPrice ?? "",
          features: (plan.features || []).join(", "),
          trialDays: plan.trialDays ?? "",
          sortOrder: plan.sortOrder ?? "",
          isActive: plan.isActive ?? true,
        }
      : emptyPlan,
  );

  const set = (key) => (event) =>
    setValues({ ...values, [key]: event.target.value });

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-detail-head">
          <div>
            <h3>
              {mode === "create"
                ? "New subscription plan"
                : `Edit ${plan?.name}`}
            </h3>
            <span>
              {mode === "create"
                ? "Create a new plan in the catalog."
                : "Update plan details. Existing subscriptions keep their history."}
            </span>
          </div>
          <button
            type="button"
            className="app-confirm-close"
            aria-label="Close"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(values);
          }}
          className="admin-account-grid"
        >
          <label>
            Plan key (free/basic/professional/premium/enterprise)
            <input
              required
              value={values.key}
              onChange={set("key")}
              disabled={mode === "edit"}
            />
          </label>
          <label>
            Plan name
            <input required value={values.name} onChange={set("name")} />
          </label>
          <label>
            Monthly price (₹)
            <input
              type="number"
              min="0"
              value={values.monthlyPrice}
              onChange={set("monthlyPrice")}
            />
          </label>
          <label>
            Yearly price (₹)
            <input
              type="number"
              min="0"
              value={values.yearlyPrice}
              onChange={set("yearlyPrice")}
            />
          </label>
          <label>
            Trial days
            <input
              type="number"
              min="0"
              value={values.trialDays}
              onChange={set("trialDays")}
            />
          </label>
          <label>
            Sort order
            <input
              type="number"
              min="0"
              value={values.sortOrder}
              onChange={set("sortOrder")}
            />
          </label>
          <label className="admin-account-field-span">
            Features (comma separated)
            <textarea
              rows="3"
              value={values.features}
              onChange={set("features")}
              placeholder="Up to 50 doctors, Advanced analytics…"
            />
          </label>
          <div className="app-confirm-actions">
            <button
              type="button"
              className="btn btn-light"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "create"
                  ? "Create plan"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionPlans;
